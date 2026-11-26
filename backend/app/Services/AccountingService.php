<?php

namespace App\Services;

use App\Models\AccountingPeriod;
use App\Models\ChartOfAccount;
use App\Models\JournalEntry;
use App\Models\JournalEntryDetail;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AccountingService
{
    public function coaByCode(string $code): ChartOfAccount
    {
        return ChartOfAccount::where('code', $code)->firstOrFail();
    }

    public function resolveOpenPeriod(string $entryDate): ?AccountingPeriod
    {
        $date = Carbon::parse($entryDate)->toDateString();

        $period = AccountingPeriod::query()
            ->whereDate('start_date', '<=', $date)
            ->whereDate('end_date', '>=', $date)
            ->first();

        if ($period && $period->isLocked()) {
            throw ValidationException::withMessages([
                'entry_date' => ["Accounting period {$period->code} is {$period->status}. Posting to closed/locked periods is prohibited."],
            ]);
        }

        return $period;
    }

    /**
     * Post an immutable balanced double-entry journal.
     *
     * @param  array<int, array{coa_id?: int, coa_code?: string, debit?: float|int, credit?: float|int, memo?: string|null}>  $lines
     */
    public function postJournal(
        string $entryDate,
        string $description,
        array $lines,
        string $sourceModule = 'manual',
        ?string $sourceType = null,
        ?int $sourceId = null,
        ?User $actor = null,
        ?int $reversesJournalId = null
    ): JournalEntry {
        if (count($lines) < 2) {
            throw ValidationException::withMessages([
                'lines' => ['A double-entry journal requires at least 2 lines.'],
            ]);
        }

        return DB::transaction(function () use (
            $entryDate, $description, $lines, $sourceModule, $sourceType, $sourceId, $actor, $reversesJournalId
        ) {
            $period = $this->resolveOpenPeriod($entryDate);

            $normalized = [];
            $totalDebit = 0.0;
            $totalCredit = 0.0;

            foreach ($lines as $idx => $line) {
                $debit = round((float) ($line['debit'] ?? 0), 2);
                $credit = round((float) ($line['credit'] ?? 0), 2);

                if ($debit < 0 || $credit < 0) {
                    throw ValidationException::withMessages([
                        "lines.{$idx}" => ['Debit and credit amounts must be non-negative.'],
                    ]);
                }

                if ($debit === 0.0 && $credit === 0.0) {
                    continue;
                }

                if ($debit > 0 && $credit > 0) {
                    throw ValidationException::withMessages([
                        "lines.{$idx}" => ['A single journal line cannot have both debit and credit values.'],
                    ]);
                }

                $coaId = $line['coa_id'] ?? null;
                if (! $coaId && ! empty($line['coa_code'])) {
                    $coaId = $this->coaByCode($line['coa_code'])->id;
                }

                if (! $coaId) {
                    throw ValidationException::withMessages([
                        "lines.{$idx}.coa_id" => ['Valid Chart of Account is required.'],
                    ]);
                }

                $totalDebit = round($totalDebit + $debit, 2);
                $totalCredit = round($totalCredit + $credit, 2);

                $normalized[] = [
                    'coa_id' => $coaId,
                    'debit' => $debit,
                    'credit' => $credit,
                    'memo' => $line['memo'] ?? null,
                ];
            }

            if (count($normalized) < 2 || $totalDebit <= 0) {
                throw ValidationException::withMessages([
                    'lines' => ['Journal entry must have positive balanced debit and credit lines.'],
                ]);
            }

            if (abs($totalDebit - $totalCredit) > 0.005) {
                throw ValidationException::withMessages([
                    'lines' => [sprintf(
                        'Double-entry journal is unbalanced: SUM(debit) %.2f !== SUM(credit) %.2f.',
                        $totalDebit,
                        $totalCredit
                    )],
                ]);
            }

            $number = sprintf(
                'JRN-%s-%05d',
                Carbon::parse($entryDate)->format('Ym'),
                (JournalEntry::max('id') ?? 0) + 1
            );

            $journal = JournalEntry::create([
                'journal_number' => $number,
                'accounting_period_id' => $period?->id,
                'entry_date' => $entryDate,
                'description' => $description,
                'source_module' => $sourceModule,
                'source_type' => $sourceType,
                'source_id' => $sourceId,
                'total_debit' => $totalDebit,
                'total_credit' => $totalCredit,
                'status' => 'posted',
                'reverses_journal_id' => $reversesJournalId,
                'is_immutable' => true,
                'created_by' => $actor?->id,
                'posted_by' => $actor?->id,
                'posted_at' => now(),
            ]);

            foreach ($normalized as $line) {
                JournalEntryDetail::create([
                    'journal_entry_id' => $journal->id,
                    'coa_id' => $line['coa_id'],
                    'debit' => $line['debit'],
                    'credit' => $line['credit'],
                    'memo' => $line['memo'],
                ]);
            }

            return $journal->load('details.account');
        });
    }

    public function reverseJournal(JournalEntry $original, string $reason, ?string $reversalDate = null, ?User $actor = null): JournalEntry
    {
        if ($original->status === 'reversed') {
            throw ValidationException::withMessages([
                'journal' => ['This journal entry has already been reversed.'],
            ]);
        }

        return DB::transaction(function () use ($original, $reason, $reversalDate, $actor) {
            $original->load('details');
            $date = $reversalDate ?? now()->toDateString();

            $reversedLines = [];
            foreach ($original->details as $detail) {
                $reversedLines[] = [
                    'coa_id' => $detail->coa_id,
                    'debit' => (float) $detail->credit,
                    'credit' => (float) $detail->debit,
                    'memo' => "Reversal of {$original->journal_number}: {$reason}",
                ];
            }

            $reversal = $this->postJournal(
                entryDate: $date,
                description: "REVERSAL [{$original->journal_number}]: {$reason}",
                lines: $reversedLines,
                sourceModule: 'reversal',
                sourceType: JournalEntry::class,
                sourceId: $original->id,
                actor: $actor,
                reversesJournalId: $original->id
            );

            $original->update([
                'status' => 'reversed',
                'reversed_by_journal_id' => $reversal->id,
            ]);

            return $reversal;
        });
    }

    public function closePeriod(AccountingPeriod $period, User $actor): AccountingPeriod
    {
        if ($period->isLocked()) {
            throw ValidationException::withMessages([
                'period' => ["Period {$period->code} is already {$period->status}."],
            ]);
        }

        $period->update([
            'status' => 'closed',
            'closed_by' => $actor->id,
            'closed_at' => now(),
        ]);

        AuditLogger::log('ACCOUNTING_PERIOD_CLOSED', 'accounting', 'info', $actor, null, AccountingPeriod::class, $period->id);

        return $period->fresh();
    }

    public function generalLedger(?int $coaId = null, ?string $fromDate = null, ?string $toDate = null): array
    {
        $query = JournalEntryDetail::query()
            ->join('journal_entries', 'journal_entries.id', '=', 'journal_entry_details.journal_entry_id')
            ->join('chart_of_accounts', 'chart_of_accounts.id', '=', 'journal_entry_details.coa_id')
            ->whereIn('journal_entries.status', ['posted', 'reversed'])
            ->select([
                'journal_entry_details.id',
                'journal_entries.journal_number',
                'journal_entries.entry_date',
                'journal_entries.description as journal_description',
                'journal_entries.source_module',
                'chart_of_accounts.id as coa_id',
                'chart_of_accounts.code as coa_code',
                'chart_of_accounts.name as coa_name',
                'chart_of_accounts.normal_balance',
                'journal_entry_details.debit',
                'journal_entry_details.credit',
                'journal_entry_details.memo',
            ])
            ->orderBy('chart_of_accounts.code')
            ->orderBy('journal_entries.entry_date')
            ->orderBy('journal_entry_details.id');

        if ($coaId) {
            $query->where('chart_of_accounts.id', $coaId);
        }
        if ($fromDate) {
            $query->whereDate('journal_entries.entry_date', '>=', $fromDate);
        }
        if ($toDate) {
            $query->whereDate('journal_entries.entry_date', '<=', $toDate);
        }

        $rows = $query->get();
        $runningByCoa = [];
        $ledger = [];

        foreach ($rows as $row) {
            $key = $row->coa_code;
            $runningByCoa[$key] = $runningByCoa[$key] ?? 0.0;
            $delta = $row->normal_balance === 'debit'
                ? ((float) $row->debit - (float) $row->credit)
                : ((float) $row->credit - (float) $row->debit);
            $runningByCoa[$key] = round($runningByCoa[$key] + $delta, 2);

            $ledger[] = [
                'journal_number' => $row->journal_number,
                'entry_date' => $row->entry_date,
                'coa_code' => $row->coa_code,
                'coa_name' => $row->coa_name,
                'description' => $row->journal_description,
                'memo' => $row->memo,
                'source_module' => $row->source_module,
                'debit' => (float) $row->debit,
                'credit' => (float) $row->credit,
                'running_balance' => $runningByCoa[$key],
            ];
        }

        return $ledger;
    }

    public function trialBalance(?string $asOfDate = null): array
    {
        $query = DB::table('chart_of_accounts as coa')
            ->leftJoin('journal_entry_details as jed', 'jed.coa_id', '=', 'coa.id')
            ->leftJoin('journal_entries as je', function ($join) use ($asOfDate) {
                $join->on('je.id', '=', 'jed.journal_entry_id')
                    ->whereIn('je.status', ['posted', 'reversed']);
                if ($asOfDate) {
                    $join->whereDate('je.entry_date', '<=', $asOfDate);
                }
            })
            ->where('coa.is_header', false)
            ->groupBy('coa.id', 'coa.code', 'coa.name', 'coa.account_type', 'coa.normal_balance')
            ->orderBy('coa.code')
            ->select([
                'coa.id',
                'coa.code',
                'coa.name',
                'coa.account_type',
                'coa.normal_balance',
                DB::raw('COALESCE(SUM(CASE WHEN je.id IS NOT NULL THEN jed.debit ELSE 0 END), 0) as sum_debit'),
                DB::raw('COALESCE(SUM(CASE WHEN je.id IS NOT NULL THEN jed.credit ELSE 0 END), 0) as sum_credit'),
            ])
            ->get();

        $rows = [];
        $totalDebit = 0.0;
        $totalCredit = 0.0;

        foreach ($query as $acc) {
            $netDebit = round((float) $acc->sum_debit - (float) $acc->sum_credit, 2);
            $debitBalance = $netDebit > 0 ? $netDebit : 0.0;
            $creditBalance = $netDebit < 0 ? abs($netDebit) : 0.0;

            if ($debitBalance == 0.0 && $creditBalance == 0.0) {
                continue;
            }

            $totalDebit = round($totalDebit + $debitBalance, 2);
            $totalCredit = round($totalCredit + $creditBalance, 2);

            $rows[] = [
                'coa_id' => $acc->id,
                'code' => $acc->code,
                'name' => $acc->name,
                'account_type' => $acc->account_type,
                'normal_balance' => $acc->normal_balance,
                'debit' => $debitBalance,
                'credit' => $creditBalance,
            ];
        }

        return [
            'as_of_date' => $asOfDate ?? now()->toDateString(),
            'accounts' => $rows,
            'total_debit' => $totalDebit,
            'total_credit' => $totalCredit,
            'is_balanced' => abs($totalDebit - $totalCredit) < 0.01,
            'difference' => round($totalDebit - $totalCredit, 2),
        ];
    }

    public function incomeStatement(?string $fromDate = null, ?string $toDate = null): array
    {
        $balances = $this->accountBalancesByRange($fromDate, $toDate);

        $grossSales = 0.0;
        $salesReturnsAndDiscounts = 0.0;
        $cogs = 0.0;
        $operatingExpenses = 0.0;
        $otherIncome = 0.0;
        $otherExpense = 0.0;

        $revenueItems = [];
        $cogsItems = [];
        $expenseItems = [];
        $otherItems = [];

        foreach ($balances as $row) {
            $amt = $row['natural_balance'];
            if (abs($amt) < 0.005) {
                continue;
            }
            if ($row['account_type'] === 'revenue') {
                if (str_starts_with($row['code'], '42') || str_contains(strtolower($row['name']), 'retur') || str_contains(strtolower($row['name']), 'diskon')) {
                    $salesReturnsAndDiscounts += abs($amt);
                } else {
                    $grossSales += $amt;
                }
                $revenueItems[] = $row;
            } elseif ($row['account_type'] === 'cogs') {
                $cogs += $amt;
                $cogsItems[] = $row;
            } elseif ($row['account_type'] === 'expense') {
                $operatingExpenses += $amt;
                $expenseItems[] = $row;
            } elseif ($row['account_type'] === 'other_income') {
                $otherIncome += $amt;
                $otherItems[] = $row;
            } elseif ($row['account_type'] === 'other_expense') {
                $otherExpense += $amt;
                $otherItems[] = $row;
            }
        }

        $netSales = round($grossSales - $salesReturnsAndDiscounts, 2);
        $grossProfit = round($netSales - $cogs, 2);
        $operatingProfit = round($grossProfit - $operatingExpenses, 2);
        $netProfit = round($operatingProfit + $otherIncome - $otherExpense, 2);

        return [
            'from_date' => $fromDate,
            'to_date' => $toDate ?? now()->toDateString(),
            'gross_sales' => round($grossSales, 2),
            'sales_returns_and_discounts' => round($salesReturnsAndDiscounts, 2),
            'net_sales' => $netSales,
            'cogs' => round($cogs, 2),
            'gross_profit' => $grossProfit,
            'operating_expenses' => round($operatingExpenses, 2),
            'operating_profit' => $operatingProfit,
            'other_income' => round($otherIncome, 2),
            'other_expense' => round($otherExpense, 2),
            'net_profit' => $netProfit,
            'gross_margin_percent' => $netSales > 0 ? round(($grossProfit / $netSales) * 100, 2) : 0.0,
            'net_margin_percent' => $netSales > 0 ? round(($netProfit / $netSales) * 100, 2) : 0.0,
            'details' => [
                'revenue' => $revenueItems,
                'cogs' => $cogsItems,
                'expenses' => $expenseItems,
                'other' => $otherItems,
            ],
        ];
    }

    public function balanceSheet(?string $asOfDate = null): array
    {
        $balances = $this->accountBalancesByRange(null, $asOfDate);
        $incomeStatement = $this->incomeStatement(null, $asOfDate);
        $currentEarnings = $incomeStatement['net_profit'];

        $assets = [];
        $liabilities = [];
        $equity = [];

        $totalAssets = 0.0;
        $totalLiabilities = 0.0;
        $totalEquity = 0.0;

        foreach ($balances as $row) {
            $amt = $row['natural_balance'];
            if (abs($amt) < 0.005) {
                continue;
            }
            if ($row['account_type'] === 'asset') {
                $assets[] = $row;
                $totalAssets = round($totalAssets + $amt, 2);
            } elseif ($row['account_type'] === 'liability') {
                $liabilities[] = $row;
                $totalLiabilities = round($totalLiabilities + $amt, 2);
            } elseif ($row['account_type'] === 'equity') {
                $equity[] = $row;
                $totalEquity = round($totalEquity + $amt, 2);
            }
        }

        if (abs($currentEarnings) >= 0.005) {
            $equity[] = [
                'code' => '3999',
                'name' => 'Laba (Rugi) Periode Berjalan',
                'account_type' => 'equity',
                'natural_balance' => $currentEarnings,
            ];
            $totalEquity = round($totalEquity + $currentEarnings, 2);
        }

        $liabilitiesPlusEquity = round($totalLiabilities + $totalEquity, 2);

        return [
            'as_of_date' => $asOfDate ?? now()->toDateString(),
            'assets' => $assets,
            'liabilities' => $liabilities,
            'equity' => $equity,
            'total_assets' => $totalAssets,
            'total_liabilities' => $totalLiabilities,
            'total_equity' => $totalEquity,
            'total_liabilities_and_equity' => $liabilitiesPlusEquity,
            'difference' => round($totalAssets - $liabilitiesPlusEquity, 2),
            'is_balanced' => abs($totalAssets - $liabilitiesPlusEquity) < 0.01,
        ];
    }

    public function cashFlowStatement(?string $fromDate = null, ?string $toDate = null): array
    {
        $cashCoaIds = ChartOfAccount::where('code', 'like', '11%')->pluck('id')->all();

        $query = JournalEntryDetail::query()
            ->join('journal_entries', 'journal_entries.id', '=', 'journal_entry_details.journal_entry_id')
            ->whereIn('journal_entry_details.coa_id', $cashCoaIds)
            ->whereIn('journal_entries.status', ['posted', 'reversed'])
            ->where('journal_entries.source_module', '!=', 'cash_transfer');

        if ($fromDate) {
            $query->whereDate('journal_entries.entry_date', '>=', $fromDate);
        }
        if ($toDate) {
            $query->whereDate('journal_entries.entry_date', '<=', $toDate);
        }

        $rows = $query->select([
            'journal_entries.source_module',
            DB::raw('SUM(journal_entry_details.debit) as cash_in'),
            DB::raw('SUM(journal_entry_details.credit) as cash_out'),
        ])->groupBy('journal_entries.source_module')->get();

        $operating = 0.0;
        $investing = 0.0;
        $financing = 0.0;

        foreach ($rows as $row) {
            $net = round((float) $row->cash_in - (float) $row->cash_out, 2);
            if (in_array($row->source_module, ['opening_equity', 'financing'], true)) {
                $financing += $net;
            } elseif ($row->source_module === 'investing') {
                $investing += $net;
            } else {
                $operating += $net;
            }
        }

        return [
            'from_date' => $fromDate,
            'to_date' => $toDate ?? now()->toDateString(),
            'operating_cash_flow' => round($operating, 2),
            'investing_cash_flow' => round($investing, 2),
            'financing_cash_flow' => round($financing, 2),
            'net_change_in_cash' => round($operating + $investing + $financing, 2),
        ];
    }

    public function changesInEquity(?string $fromDate = null, ?string $toDate = null): array
    {
        $balances = $this->accountBalancesByRange(null, $toDate);
        $openingCapital = 0.0;
        foreach ($balances as $row) {
            if ($row['account_type'] === 'equity') {
                $openingCapital += $row['natural_balance'];
            }
        }
        $netProfit = $this->incomeStatement($fromDate, $toDate)['net_profit'];

        return [
            'from_date' => $fromDate,
            'to_date' => $toDate ?? now()->toDateString(),
            'paid_in_capital_and_retained' => round($openingCapital, 2),
            'current_period_net_profit' => $netProfit,
            'ending_equity' => round($openingCapital + $netProfit, 2),
        ];
    }

    private function accountBalancesByRange(?string $fromDate, ?string $toDate): array
    {
        $query = DB::table('chart_of_accounts as coa')
            ->join('journal_entry_details as jed', 'jed.coa_id', '=', 'coa.id')
            ->join('journal_entries as je', 'je.id', '=', 'jed.journal_entry_id')
            ->whereIn('je.status', ['posted', 'reversed']);

        if ($fromDate) {
            $query->whereDate('je.entry_date', '>=', $fromDate);
        }
        if ($toDate) {
            $query->whereDate('je.entry_date', '<=', $toDate);
        }

        $rows = $query->groupBy('coa.id', 'coa.code', 'coa.name', 'coa.account_type', 'coa.normal_balance')
            ->orderBy('coa.code')
            ->select([
                'coa.id',
                'coa.code',
                'coa.name',
                'coa.account_type',
                'coa.normal_balance',
                DB::raw('SUM(jed.debit) as sum_debit'),
                DB::raw('SUM(jed.credit) as sum_credit'),
            ])->get();

        $result = [];
        foreach ($rows as $row) {
            $natural = $row->normal_balance === 'debit'
                ? round((float) $row->sum_debit - (float) $row->sum_credit, 2)
                : round((float) $row->sum_credit - (float) $row->sum_debit, 2);

            $result[] = [
                'coa_id' => $row->id,
                'code' => $row->code,
                'name' => $row->name,
                'account_type' => $row->account_type,
                'normal_balance' => $row->normal_balance,
                'debit' => round((float) $row->sum_debit, 2),
                'credit' => round((float) $row->sum_credit, 2),
                'natural_balance' => $natural,
            ];
        }

        return $result;
    }
}

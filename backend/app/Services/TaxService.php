<?php

namespace App\Services;

use App\Models\FinancialAccount;
use App\Models\TaxPayment;
use App\Models\TaxPeriod;
use App\Models\TaxRate;
use App\Models\TaxTransaction;
use App\Models\TaxType;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TaxService
{
    public function __construct(private readonly AccountingService $accounting) {}

    /**
     * Resolve configurable TaxRate from database by tax type code and effective date.
     * Supports Indonesia PPN 12% with DPP Nilai Lain 11/12 (effective 11%) as well as custom rates.
     */
    public function resolveEffectiveRate(string $taxTypeCode, ?string $asOfDate = null, ?string $rateCode = null): TaxRate
    {
        $date = Carbon::parse($asOfDate ?? now()->toDateString())->toDateString();

        if ($rateCode) {
            $explicit = TaxRate::where('code', $rateCode)->first();
            if ($explicit) {
                return $explicit;
            }
        }

        $taxType = TaxType::where('code', $taxTypeCode)->firstOrFail();

        $rate = TaxRate::query()
            ->where('tax_type_id', $taxType->id)
            ->whereDate('effective_from', '<=', $date)
            ->where(function ($q) use ($date) {
                $q->whereNull('effective_to')->orWhereDate('effective_to', '>=', $date);
            })
            ->orderByDesc('is_default')
            ->orderByDesc('effective_from')
            ->first();

        if (! $rate) {
            throw ValidationException::withMessages([
                'tax_rate' => ["No active tax rate configured for {$taxTypeCode} on {$date}."],
            ]);
        }

        return $rate;
    }

    /**
     * Calculate PPN using database-configured statutory rate & DPP ratio (e.g., 11/12 * base * 12% = 11% effective).
     */
    public function calculatePpn(float $baseAmount, ?string $asOfDate = null, ?string $rateCode = null): array
    {
        $rate = $this->resolveEffectiveRate('PPN', $asOfDate, $rateCode);

        $num = max(1, (int) $rate->dpp_ratio_numerator);
        $den = max(1, (int) $rate->dpp_ratio_denominator);
        $dppAmount = round($baseAmount * ($num / $den), 2);
        $statutoryRate = (float) $rate->rate_percent;
        $taxAmount = round($dppAmount * ($statutoryRate / 100), 2);
        $effectiveRate = round(($num / $den) * $statutoryRate, 4);

        return [
            'tax_type_id' => $rate->tax_type_id,
            'tax_rate_id' => $rate->id,
            'rate_code' => $rate->code,
            'rate_name' => $rate->name,
            'base_amount' => round($baseAmount, 2),
            'dpp_ratio' => "{$num}/{$den}",
            'dpp_amount' => $dppAmount,
            'statutory_rate_percent' => $statutoryRate,
            'effective_rate_percent' => $effectiveRate,
            'tax_amount' => $taxAmount,
            'total_with_tax' => round($baseAmount + $taxAmount, 2),
        ];
    }

    /**
     * Calculate monthly PPh 21 TER (PP 58/2023 / PMK 168/2023 progressive brackets by Category A/B/C).
     */
    public function calculatePph21Ter(float $grossMonthly, string $terCategory = 'A'): array
    {
        $cat = strtoupper(trim($terCategory));
        $brackets = match ($cat) {
            'B' => [
                [6200000, 0.00], [6500000, 0.25], [6850000, 0.50], [7300000, 0.75],
                [9200000, 1.00], [10750000, 1.50], [11250000, 2.00], [11600000, 2.50],
                [12600000, 3.00], [13600000, 4.00], [14950000, 5.00], [16400000, 6.00],
                [18450000, 7.00], [21850000, 8.00], [26000000, 9.00], [27700000, 10.00],
                [33650000, 12.00], [43850000, 15.00], [PHP_FLOAT_MAX, 20.00],
            ],
            'C' => [
                [6600000, 0.00], [6950000, 0.25], [7350000, 0.50], [7800000, 0.75],
                [8850000, 1.00], [9800000, 1.50], [10950000, 2.00], [11200000, 2.50],
                [12050000, 3.00], [12950000, 4.00], [14150000, 5.00], [15550000, 6.00],
                [17050000, 7.00], [19500000, 8.00], [22700000, 9.00], [26600000, 10.00],
                [32200000, 12.00], [41400000, 15.00], [PHP_FLOAT_MAX, 20.00],
            ],
            default => [ // Category A (TK/0, TK/1, K/0)
                [5400000, 0.00], [5650000, 0.25], [5950000, 0.50], [6300000, 0.75],
                [6750000, 1.00], [7500000, 1.25], [8550000, 1.50], [9650000, 1.75],
                [10050000, 2.00], [10350000, 2.25], [10700000, 2.50], [11050000, 3.00],
                [11600000, 3.50], [12500000, 4.00], [13750000, 5.00], [15100000, 6.00],
                [16950000, 7.00], [19750000, 8.00], [24150000, 9.00], [26450000, 10.00],
                [30050000, 12.00], [38900000, 15.00], [PHP_FLOAT_MAX, 20.00],
            ],
        };

        $ratePercent = 0.0;
        foreach ($brackets as [$upper, $rate]) {
            if ($grossMonthly <= $upper) {
                $ratePercent = $rate;
                break;
            }
        }

        return [
            'ter_category' => in_array($cat, ['A', 'B', 'C'], true) ? $cat : 'A',
            'gross_monthly' => round($grossMonthly, 2),
            'ter_rate_percent' => $ratePercent,
            'pph21_amount' => round($grossMonthly * ($ratePercent / 100), 2),
        ];
    }

    public function recordTaxTransaction(
        string $taxTypeCode,
        string $direction,
        string $transactionDate,
        float $baseAmount,
        float $dppAmount,
        float $rateApplied,
        float $taxAmount,
        ?int $taxRateId = null,
        ?string $sourceType = null,
        ?int $sourceId = null,
        ?string $counterpartyName = null,
        ?string $counterpartyNpwp = null,
        ?string $notes = null
    ): TaxTransaction {
        $taxType = TaxType::where('code', $taxTypeCode)->firstOrFail();
        $date = Carbon::parse($transactionDate);
        $periodCode = sprintf('%s-%04d-%02d', $taxType->code, $date->year, $date->month);

        $period = TaxPeriod::firstOrCreate(
            ['code' => $periodCode],
            [
                'tax_type_id' => $taxType->id,
                'year' => $date->year,
                'month' => $date->month,
                'due_date' => $date->copy()->addMonth()->day($taxType->code === 'PPN' ? 28 : 10)->toDateString(),
                'status' => 'open',
            ]
        );

        $taxNumber = sprintf('TAX-%s-%s-%05d', $taxType->code, $date->format('Ym'), (TaxTransaction::max('id') ?? 0) + 1);

        $tx = TaxTransaction::create([
            'tax_number' => $taxNumber,
            'tax_type_id' => $taxType->id,
            'tax_rate_id' => $taxRateId,
            'tax_period_id' => $period->id,
            'direction' => $direction,
            'transaction_date' => $date->toDateString(),
            'base_amount' => round($baseAmount, 2),
            'dpp_amount' => round($dppAmount, 2),
            'tax_rate_applied' => $rateApplied,
            'tax_amount' => round($taxAmount, 2),
            'source_type' => $sourceType,
            'source_id' => $sourceId,
            'counterparty_name' => $counterpartyName,
            'counterparty_npwp' => $counterpartyNpwp,
            'status' => 'recorded',
            'notes' => $notes,
        ]);

        $this->recalculateTaxPeriod($period);

        return $tx;
    }

    public function recalculateTaxPeriod(TaxPeriod $period): TaxPeriod
    {
        $output = (float) TaxTransaction::where('tax_period_id', $period->id)
            ->whereIn('direction', ['output', 'withholding'])
            ->sum('tax_amount');

        $input = (float) TaxTransaction::where('tax_period_id', $period->id)
            ->where('direction', 'input')
            ->sum('tax_amount');

        $period->update([
            'total_output_tax' => round($output, 2),
            'total_input_tax' => round($input, 2),
            'net_tax_payable' => round($output - $input, 2),
        ]);

        return $period->fresh();
    }

    public function recordTaxPayment(array $data, User $actor): TaxPayment
    {
        return DB::transaction(function () use ($data, $actor) {
            $taxType = TaxType::findOrFail($data['tax_type_id']);
            $account = FinancialAccount::lockForUpdate()->findOrFail($data['financial_account_id']);
            $amount = round((float) $data['amount'], 2);

            if ((float) $account->current_balance < $amount) {
                throw ValidationException::withMessages([
                    'amount' => ['Insufficient balance in selected financial account for tax payment.'],
                ]);
            }

            $liabilityCode = match ($taxType->code) {
                'PPN' => '2121',
                'PPH21' => '2122',
                default => '2123',
            };

            $journal = $this->accounting->postJournal(
                entryDate: $data['payment_date'],
                description: "Setoran Pajak {$taxType->name} ({$data['ntpn_code']})",
                lines: [
                    ['coa_code' => $liabilityCode, 'debit' => $amount, 'credit' => 0, 'memo' => "Pelunasan {$taxType->code}"],
                    ['coa_id' => $account->coa_id, 'debit' => 0, 'credit' => $amount, 'memo' => "Pembayaran via {$account->name}"],
                ],
                sourceModule: 'tax_payment',
                actor: $actor
            );

            $account->update(['current_balance' => round((float) $account->current_balance - $amount, 2)]);

            $payment = TaxPayment::create([
                'payment_number' => sprintf('TPAY-%s-%04d', now()->format('Ym'), (TaxPayment::max('id') ?? 0) + 1),
                'tax_type_id' => $taxType->id,
                'tax_period_id' => $data['tax_period_id'] ?? null,
                'financial_account_id' => $account->id,
                'payment_date' => $data['payment_date'],
                'amount' => $amount,
                'ntpn_code' => $data['ntpn_code'] ?? null,
                'billing_code' => $data['billing_code'] ?? null,
                'status' => 'paid',
                'notes' => $data['notes'] ?? null,
                'created_by' => $actor->id,
                'journal_entry_id' => $journal->id,
            ]);

            if (! empty($data['tax_period_id'])) {
                TaxPeriod::where('id', $data['tax_period_id'])->update(['status' => 'paid']);
            }

            return $payment;
        });
    }

    public function summary(?int $year = null, ?int $month = null): array
    {
        $query = TaxTransaction::query()->with('taxType');
        if ($year) {
            $query->whereYear('transaction_date', $year);
        }
        if ($month) {
            $query->whereMonth('transaction_date', $month);
        }

        $txs = $query->get();

        $ppnOutput = 0.0;
        $ppnInput = 0.0;
        $pph21Total = 0.0;

        foreach ($txs as $tx) {
            if ($tx->taxType?->code === 'PPN') {
                if ($tx->direction === 'output') {
                    $ppnOutput += (float) $tx->tax_amount;
                } elseif ($tx->direction === 'input') {
                    $ppnInput += (float) $tx->tax_amount;
                }
            } elseif ($tx->taxType?->code === 'PPH21') {
                $pph21Total += (float) $tx->tax_amount;
            }
        }

        return [
            'ppn_output' => round($ppnOutput, 2),
            'ppn_input' => round($ppnInput, 2),
            'ppn_net_payable' => round($ppnOutput - $ppnInput, 2),
            'pph21_withheld' => round($pph21Total, 2),
            'total_tax_paid' => round((float) TaxPayment::sum('amount'), 2),
            'compliance_disclaimer' => 'Perhitungan pajak mengikuti konfigurasi tarif aktif (termasuk PPN 12% dengan DPP Nilai Lain 11/12 = 11% efektif dan PPh 21 TER). Wajib diverifikasi konsultan pajak/DJP sebelum pelaporan SPT resmi.',
        ];
    }
}

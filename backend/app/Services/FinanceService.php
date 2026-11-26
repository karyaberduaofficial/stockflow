<?php

namespace App\Services;

use App\Models\AccountsPayable;
use App\Models\AccountsReceivable;
use App\Models\CashBankTransaction;
use App\Models\ChartOfAccount;
use App\Models\CustomerPayment;
use App\Models\ExpenseTransaction;
use App\Models\FinancialAccount;
use App\Models\IncomeTransaction;
use App\Models\SupplierInvoice;
use App\Models\SupplierPayment;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class FinanceService
{
    public function __construct(private readonly AccountingService $accounting) {}

    public function recordIncome(array $data, User $actor): IncomeTransaction
    {
        return DB::transaction(function () use ($data, $actor) {
            $account = FinancialAccount::lockForUpdate()->findOrFail($data['financial_account_id']);
            $incomeCoa = ChartOfAccount::findOrFail($data['coa_id']);
            $amount = round((float) $data['amount'], 2);

            $journal = $this->accounting->postJournal(
                entryDate: $data['transaction_date'],
                description: "Pendapatan: {$data['category']} - ".($data['description'] ?? ''),
                lines: [
                    ['coa_id' => $account->coa_id, 'debit' => $amount, 'credit' => 0, 'memo' => "Kas/Bank masuk {$account->name}"],
                    ['coa_id' => $incomeCoa->id, 'debit' => 0, 'credit' => $amount, 'memo' => $incomeCoa->name],
                ],
                sourceModule: 'finance_income',
                actor: $actor
            );

            $account->update(['current_balance' => round((float) $account->current_balance + $amount, 2)]);

            $ref = sprintf('INC-%s-%04d', now()->format('Ym'), (IncomeTransaction::max('id') ?? 0) + 1);

            CashBankTransaction::create([
                'reference_number' => 'CB-'.$ref,
                'transaction_type' => 'inflow',
                'to_account_id' => $account->id,
                'transaction_date' => $data['transaction_date'],
                'amount' => $amount,
                'is_internal_transfer' => false,
                'description' => $data['description'] ?? $data['category'],
                'created_by' => $actor->id,
                'journal_entry_id' => $journal->id,
            ]);

            return IncomeTransaction::create([
                'reference_number' => $ref,
                'financial_account_id' => $account->id,
                'coa_id' => $incomeCoa->id,
                'transaction_date' => $data['transaction_date'],
                'category' => $data['category'],
                'amount' => $amount,
                'description' => $data['description'] ?? null,
                'created_by' => $actor->id,
                'journal_entry_id' => $journal->id,
            ]);
        });
    }

    public function recordExpense(array $data, User $actor): ExpenseTransaction
    {
        return DB::transaction(function () use ($data, $actor) {
            $account = FinancialAccount::lockForUpdate()->findOrFail($data['financial_account_id']);
            $expenseCoa = ChartOfAccount::findOrFail($data['coa_id']);
            $amount = round((float) $data['amount'], 2);

            if ((float) $account->current_balance < $amount) {
                throw ValidationException::withMessages([
                    'amount' => ['Insufficient balance in selected cash/bank account.'],
                ]);
            }

            $journal = $this->accounting->postJournal(
                entryDate: $data['transaction_date'],
                description: "Beban Operasional: {$data['category']} - ".($data['description'] ?? ''),
                lines: [
                    ['coa_id' => $expenseCoa->id, 'debit' => $amount, 'credit' => 0, 'memo' => $expenseCoa->name],
                    ['coa_id' => $account->coa_id, 'debit' => 0, 'credit' => $amount, 'memo' => "Pengeluaran dari {$account->name}"],
                ],
                sourceModule: 'finance_expense',
                actor: $actor
            );

            $account->update(['current_balance' => round((float) $account->current_balance - $amount, 2)]);

            $ref = sprintf('EXP-%s-%04d', now()->format('Ym'), (ExpenseTransaction::max('id') ?? 0) + 1);

            CashBankTransaction::create([
                'reference_number' => 'CB-'.$ref,
                'transaction_type' => 'outflow',
                'from_account_id' => $account->id,
                'transaction_date' => $data['transaction_date'],
                'amount' => $amount,
                'is_internal_transfer' => false,
                'description' => $data['description'] ?? $data['category'],
                'created_by' => $actor->id,
                'journal_entry_id' => $journal->id,
            ]);

            return ExpenseTransaction::create([
                'reference_number' => $ref,
                'financial_account_id' => $account->id,
                'coa_id' => $expenseCoa->id,
                'transaction_date' => $data['transaction_date'],
                'category' => $data['category'],
                'vendor_name' => $data['vendor_name'] ?? null,
                'amount' => $amount,
                'description' => $data['description'] ?? null,
                'status' => 'posted',
                'created_by' => $actor->id,
                'approved_by' => $actor->id,
                'journal_entry_id' => $journal->id,
            ]);
        });
    }

    /**
     * Inter-account transfer between Cash/Bank accounts.
     * STRICTLY non-income and non-expense (Assets <-> Assets only).
     */
    public function transferBetweenAccounts(array $data, User $actor): CashBankTransaction
    {
        if ((int) $data['from_account_id'] === (int) $data['to_account_id']) {
            throw ValidationException::withMessages([
                'to_account_id' => ['Destination financial account must differ from source account.'],
            ]);
        }

        return DB::transaction(function () use ($data, $actor) {
            $from = FinancialAccount::lockForUpdate()->findOrFail($data['from_account_id']);
            $to = FinancialAccount::lockForUpdate()->findOrFail($data['to_account_id']);
            $amount = round((float) $data['amount'], 2);

            if ((float) $from->current_balance < $amount) {
                throw ValidationException::withMessages([
                    'amount' => ['Insufficient source account balance for transfer.'],
                ]);
            }

            $journal = $this->accounting->postJournal(
                entryDate: $data['transaction_date'],
                description: "Transfer Internal Kas/Bank: {$from->name} -> {$to->name}",
                lines: [
                    ['coa_id' => $to->coa_id, 'debit' => $amount, 'credit' => 0, 'memo' => "Masuk ke {$to->name} (non-income)"],
                    ['coa_id' => $from->coa_id, 'debit' => 0, 'credit' => $amount, 'memo' => "Keluar dari {$from->name} (non-expense)"],
                ],
                sourceModule: 'cash_transfer',
                actor: $actor
            );

            $from->update(['current_balance' => round((float) $from->current_balance - $amount, 2)]);
            $to->update(['current_balance' => round((float) $to->current_balance + $amount, 2)]);

            return CashBankTransaction::create([
                'reference_number' => sprintf('CTR-%s-%04d', now()->format('Ym'), (CashBankTransaction::max('id') ?? 0) + 1),
                'transaction_type' => 'transfer',
                'from_account_id' => $from->id,
                'to_account_id' => $to->id,
                'transaction_date' => $data['transaction_date'],
                'amount' => $amount,
                'is_internal_transfer' => true,
                'description' => $data['description'] ?? "Internal transfer {$from->code} -> {$to->code}",
                'created_by' => $actor->id,
                'journal_entry_id' => $journal->id,
            ]);
        });
    }

    /**
     * Pay Accounts Payable (Liability reduction ONLY - NO double expense!).
     */
    public function payAccountsPayable(AccountsPayable $ap, array $data, User $actor): SupplierPayment
    {
        return DB::transaction(function () use ($ap, $data, $actor) {
            $ap = AccountsPayable::lockForUpdate()->findOrFail($ap->id);
            $account = FinancialAccount::lockForUpdate()->findOrFail($data['financial_account_id']);
            $amount = round((float) $data['amount'], 2);

            if ($amount <= 0 || $amount > (float) $ap->balance_amount + 0.01) {
                throw ValidationException::withMessages([
                    'amount' => ['Payment amount must be positive and not exceed remaining AP balance.'],
                ]);
            }
            if ((float) $account->current_balance < $amount) {
                throw ValidationException::withMessages([
                    'amount' => ['Insufficient cash/bank balance to pay AP.'],
                ]);
            }

            $journal = $this->accounting->postJournal(
                entryDate: $data['payment_date'],
                description: "Pembayaran Hutang Usaha {$ap->ap_number}",
                lines: [
                    ['coa_code' => '2110', 'debit' => $amount, 'credit' => 0, 'memo' => 'Pelunasan Hutang Usaha (AP)'],
                    ['coa_id' => $account->coa_id, 'debit' => 0, 'credit' => $amount, 'memo' => "Keluar dari {$account->name}"],
                ],
                sourceModule: 'ap_payment',
                sourceType: AccountsPayable::class,
                sourceId: $ap->id,
                actor: $actor
            );

            $account->update(['current_balance' => round((float) $account->current_balance - $amount, 2)]);

            $newPaid = round((float) $ap->paid_amount + $amount, 2);
            $newBalance = round(max(0, (float) $ap->total_amount - $newPaid), 2);
            $ap->update([
                'paid_amount' => $newPaid,
                'balance_amount' => $newBalance,
                'status' => $newBalance <= 0.005 ? 'paid' : 'partial',
            ]);

            if ($ap->supplier_invoice_id) {
                $invoice = SupplierInvoice::find($ap->supplier_invoice_id);
                if ($invoice) {
                    $invoice->update([
                        'paid_amount' => $newPaid,
                        'status' => $newBalance <= 0.005 ? 'paid' : 'partial',
                    ]);
                }
            }

            return SupplierPayment::create([
                'payment_number' => sprintf('SPAY-%s-%04d', now()->format('Ym'), (SupplierPayment::max('id') ?? 0) + 1),
                'supplier_invoice_id' => $ap->supplier_invoice_id,
                'supplier_id' => $ap->supplier_id,
                'financial_account_id' => $account->id,
                'payment_date' => $data['payment_date'],
                'amount' => $amount,
                'payment_method' => $data['payment_method'] ?? 'transfer',
                'reference' => $data['reference'] ?? null,
                'notes' => $data['notes'] ?? null,
                'created_by' => $actor->id,
                'journal_entry_id' => $journal->id,
            ]);
        });
    }

    /**
     * Collect Accounts Receivable (Cash/Bank Debit, AR Credit - NO double revenue!).
     */
    public function collectAccountsReceivable(AccountsReceivable $ar, array $data, User $actor): CustomerPayment
    {
        return DB::transaction(function () use ($ar, $data, $actor) {
            $ar = AccountsReceivable::lockForUpdate()->findOrFail($ar->id);
            $account = FinancialAccount::lockForUpdate()->findOrFail($data['financial_account_id']);
            $amount = round((float) $data['amount'], 2);

            if ($amount <= 0 || $amount > (float) $ar->balance_amount + 0.01) {
                throw ValidationException::withMessages([
                    'amount' => ['Collection amount must be positive and not exceed remaining AR balance.'],
                ]);
            }

            $journal = $this->accounting->postJournal(
                entryDate: $data['payment_date'],
                description: "Penerimaan Piutang Usaha {$ar->ar_number}",
                lines: [
                    ['coa_id' => $account->coa_id, 'debit' => $amount, 'credit' => 0, 'memo' => "Masuk ke {$account->name}"],
                    ['coa_code' => '1130', 'debit' => 0, 'credit' => $amount, 'memo' => 'Pelunasan Piutang Usaha (AR)'],
                ],
                sourceModule: 'ar_collection',
                sourceType: AccountsReceivable::class,
                sourceId: $ar->id,
                actor: $actor
            );

            $account->update(['current_balance' => round((float) $account->current_balance + $amount, 2)]);

            $newPaid = round((float) $ar->paid_amount + $amount, 2);
            $newBalance = round(max(0, (float) $ar->total_amount - $newPaid), 2);
            $ar->update([
                'paid_amount' => $newPaid,
                'balance_amount' => $newBalance,
                'status' => $newBalance <= 0.005 ? 'paid' : 'partial',
            ]);

            if ($ar->sale) {
                $ar->sale->update([
                    'paid_amount' => $newPaid,
                    'payment_status' => $newBalance <= 0.005 ? 'paid' : 'partial',
                ]);
            }

            return CustomerPayment::create([
                'payment_number' => sprintf('CPAY-%s-%04d', now()->format('Ym'), (CustomerPayment::max('id') ?? 0) + 1),
                'sale_id' => $ar->sale_id,
                'customer_id' => $ar->customer_id,
                'financial_account_id' => $account->id,
                'payment_date' => $data['payment_date'],
                'amount' => $amount,
                'payment_method' => $data['payment_method'] ?? 'transfer',
                'reference' => $data['reference'] ?? null,
                'notes' => $data['notes'] ?? null,
                'created_by' => $actor->id,
                'journal_entry_id' => $journal->id,
            ]);
        });
    }

    public function summary(?string $fromDate = null, ?string $toDate = null): array
    {
        $profitLoss = $this->accounting->incomeStatement($fromDate, $toDate);
        $accounts = FinancialAccount::where('is_active', true)->get();

        return [
            'total_cash_and_bank' => round((float) $accounts->sum('current_balance'), 2),
            'total_ar_open' => round((float) AccountsReceivable::whereIn('status', ['open', 'partial', 'overdue'])->sum('balance_amount'), 2),
            'total_ap_open' => round((float) AccountsPayable::whereIn('status', ['open', 'partial', 'overdue'])->sum('balance_amount'), 2),
            'accounts' => $accounts,
            'net_profit_waterfall' => [
                'gross_sales' => $profitLoss['gross_sales'],
                'sales_returns_and_discounts' => $profitLoss['sales_returns_and_discounts'],
                'net_sales' => $profitLoss['net_sales'],
                'cogs' => $profitLoss['cogs'],
                'gross_profit' => $profitLoss['gross_profit'],
                'operating_expenses' => $profitLoss['operating_expenses'],
                'other_income' => $profitLoss['other_income'],
                'other_expense' => $profitLoss['other_expense'],
                'net_profit' => $profitLoss['net_profit'],
            ],
        ];
    }
}

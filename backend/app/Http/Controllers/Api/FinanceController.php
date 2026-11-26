<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountsPayable;
use App\Models\AccountsReceivable;
use App\Models\CashBankTransaction;
use App\Models\ExpenseTransaction;
use App\Models\FinancialAccount;
use App\Models\IncomeTransaction;
use App\Services\FinanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FinanceController extends Controller
{
    public function __construct(private readonly FinanceService $finance) {}

    public function summary(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->finance->summary($request->query('from_date'), $request->query('to_date')),
        ]);
    }

    public function accounts(): JsonResponse
    {
        return response()->json(['data' => FinancialAccount::with('coa')->orderBy('code')->get()]);
    }

    public function incomes(): JsonResponse
    {
        return response()->json(['data' => IncomeTransaction::orderByDesc('id')->get()]);
    }

    public function storeIncome(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'financial_account_id' => ['required', 'exists:financial_accounts,id'],
            'coa_id' => ['required', 'exists:chart_of_accounts,id'],
            'transaction_date' => ['required', 'date'],
            'category' => ['required', 'string', 'max:80'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'description' => ['nullable', 'string'],
        ]);

        return response()->json(['data' => $this->finance->recordIncome($validated, $request->user())], 201);
    }

    public function expenses(): JsonResponse
    {
        return response()->json(['data' => ExpenseTransaction::orderByDesc('id')->get()]);
    }

    public function storeExpense(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'financial_account_id' => ['required', 'exists:financial_accounts,id'],
            'coa_id' => ['required', 'exists:chart_of_accounts,id'],
            'transaction_date' => ['required', 'date'],
            'category' => ['required', 'string', 'max:80'],
            'vendor_name' => ['nullable', 'string', 'max:160'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'description' => ['nullable', 'string'],
        ]);

        return response()->json(['data' => $this->finance->recordExpense($validated, $request->user())], 201);
    }

    public function cashBank(): JsonResponse
    {
        return response()->json(['data' => CashBankTransaction::orderByDesc('id')->get()]);
    }

    public function transfer(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from_account_id' => ['required', 'exists:financial_accounts,id'],
            'to_account_id' => ['required', 'exists:financial_accounts,id'],
            'transaction_date' => ['required', 'date'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'description' => ['nullable', 'string'],
        ]);

        return response()->json(['data' => $this->finance->transferBetweenAccounts($validated, $request->user())], 201);
    }

    public function accountsReceivable(): JsonResponse
    {
        return response()->json(['data' => AccountsReceivable::with(['customer', 'sale'])->orderByDesc('id')->get()]);
    }

    public function collectAr(Request $request, AccountsReceivable $ar): JsonResponse
    {
        $validated = $request->validate([
            'financial_account_id' => ['required', 'exists:financial_accounts,id'],
            'payment_date' => ['required', 'date'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'payment_method' => ['sometimes', 'string', 'max:32'],
            'reference' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string'],
        ]);

        return response()->json(['data' => $this->finance->collectAccountsReceivable($ar, $validated, $request->user())], 201);
    }

    public function accountsPayable(): JsonResponse
    {
        return response()->json(['data' => AccountsPayable::with('supplier')->orderByDesc('id')->get()]);
    }

    public function payAp(Request $request, AccountsPayable $ap): JsonResponse
    {
        $validated = $request->validate([
            'financial_account_id' => ['required', 'exists:financial_accounts,id'],
            'payment_date' => ['required', 'date'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'payment_method' => ['sometimes', 'string', 'max:32'],
            'reference' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string'],
        ]);

        return response()->json(['data' => $this->finance->payAccountsPayable($ap, $validated, $request->user())], 201);
    }
}

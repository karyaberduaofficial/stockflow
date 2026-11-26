<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountingPeriod;
use App\Models\ChartOfAccount;
use App\Models\JournalEntry;
use App\Services\AccountingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccountingController extends Controller
{
    public function __construct(private readonly AccountingService $accounting) {}

    public function coa(): JsonResponse
    {
        return response()->json(['data' => ChartOfAccount::orderBy('code')->get()]);
    }

    public function storeCoa(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:24', 'unique:chart_of_accounts,code'],
            'name' => ['required', 'string', 'max:160'],
            'account_type' => ['required', 'in:asset,liability,equity,revenue,cogs,expense,other_income,other_expense'],
            'normal_balance' => ['required', 'in:debit,credit'],
            'parent_id' => ['nullable', 'exists:chart_of_accounts,id'],
            'is_header' => ['sometimes', 'boolean'],
            'description' => ['nullable', 'string'],
        ]);

        return response()->json(['data' => ChartOfAccount::create($validated)], 201);
    }

    public function journals(): JsonResponse
    {
        return response()->json([
            'data' => JournalEntry::with('details.account')->orderByDesc('entry_date')->orderByDesc('id')->get(),
        ]);
    }

    public function postJournal(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'entry_date' => ['required', 'date'],
            'description' => ['required', 'string', 'max:255'],
            'lines' => ['required', 'array', 'min:2'],
            'lines.*.coa_id' => ['nullable', 'exists:chart_of_accounts,id'],
            'lines.*.coa_code' => ['nullable', 'string', 'exists:chart_of_accounts,code'],
            'lines.*.debit' => ['nullable', 'numeric', 'min:0'],
            'lines.*.credit' => ['nullable', 'numeric', 'min:0'],
            'lines.*.memo' => ['nullable', 'string', 'max:255'],
        ]);

        $journal = $this->accounting->postJournal(
            entryDate: $validated['entry_date'],
            description: $validated['description'],
            lines: $validated['lines'],
            sourceModule: 'manual',
            actor: $request->user()
        );

        return response()->json(['data' => $journal], 201);
    }

    public function reverseJournal(Request $request, JournalEntry $journal): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:255'],
            'reversal_date' => ['nullable', 'date'],
        ]);

        $reversal = $this->accounting->reverseJournal(
            original: $journal,
            reason: $validated['reason'],
            reversalDate: $validated['reversal_date'] ?? null,
            actor: $request->user()
        );

        return response()->json(['data' => $reversal], 201);
    }

    public function generalLedger(Request $request): JsonResponse
    {
        $coaId = $request->filled('coa_id') ? (int) $request->input('coa_id') : null;

        return response()->json([
            'data' => $this->accounting->generalLedger($coaId, $request->query('from_date'), $request->query('to_date')),
        ]);
    }

    public function trialBalance(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->accounting->trialBalance($request->query('as_of_date'))]);
    }

    public function incomeStatement(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->accounting->incomeStatement($request->query('from_date'), $request->query('to_date')),
        ]);
    }

    public function balanceSheet(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->accounting->balanceSheet($request->query('as_of_date'))]);
    }

    public function cashFlow(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->accounting->cashFlowStatement($request->query('from_date'), $request->query('to_date')),
        ]);
    }

    public function changesInEquity(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->accounting->changesInEquity($request->query('from_date'), $request->query('to_date')),
        ]);
    }

    public function periods(): JsonResponse
    {
        return response()->json(['data' => AccountingPeriod::orderByDesc('start_date')->get()]);
    }

    public function closePeriod(Request $request, AccountingPeriod $period): JsonResponse
    {
        return response()->json(['data' => $this->accounting->closePeriod($period, $request->user())]);
    }
}

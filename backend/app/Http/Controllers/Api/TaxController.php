<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TaxPayment;
use App\Models\TaxPeriod;
use App\Models\TaxRate;
use App\Models\TaxTransaction;
use App\Models\TaxType;
use App\Services\TaxService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TaxController extends Controller
{
    public function __construct(private readonly TaxService $tax) {}

    public function summary(Request $request): JsonResponse
    {
        $year = $request->filled('year') ? (int) $request->input('year') : null;
        $month = $request->filled('month') ? (int) $request->input('month') : null;

        return response()->json(['data' => $this->tax->summary($year, $month)]);
    }

    public function types(): JsonResponse
    {
        return response()->json(['data' => TaxType::with('rates')->orderBy('code')->get()]);
    }

    public function rates(): JsonResponse
    {
        return response()->json(['data' => TaxRate::with('taxType')->orderByDesc('effective_from')->get()]);
    }

    public function storeRate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'tax_type_id' => ['required', 'exists:tax_types,id'],
            'code' => ['required', 'string', 'max:48', 'unique:tax_rates,code'],
            'name' => ['required', 'string', 'max:160'],
            'rate_percent' => ['required', 'numeric', 'min:0', 'max:100'],
            'dpp_ratio_numerator' => ['sometimes', 'integer', 'min:1'],
            'dpp_ratio_denominator' => ['sometimes', 'integer', 'min:1'],
            'effective_from' => ['required', 'date'],
            'effective_to' => ['nullable', 'date', 'after_or_equal:effective_from'],
            'is_default' => ['sometimes', 'boolean'],
            'notes' => ['nullable', 'string'],
        ]);

        $num = $validated['dpp_ratio_numerator'] ?? 1;
        $den = $validated['dpp_ratio_denominator'] ?? 1;
        $validated['effective_rate_percent'] = round(($num / $den) * (float) $validated['rate_percent'], 4);

        return response()->json(['data' => TaxRate::create($validated)], 201);
    }

    public function calculatePpn(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'base_amount' => ['required', 'numeric', 'min:0'],
            'as_of_date' => ['nullable', 'date'],
            'rate_code' => ['nullable', 'string'],
        ]);

        return response()->json([
            'data' => $this->tax->calculatePpn(
                (float) $validated['base_amount'],
                $validated['as_of_date'] ?? null,
                $validated['rate_code'] ?? null
            ),
        ]);
    }

    public function calculatePph21(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'gross_monthly' => ['required', 'numeric', 'min:0'],
            'ter_category' => ['sometimes', 'in:A,B,C'],
        ]);

        return response()->json([
            'data' => $this->tax->calculatePph21Ter(
                (float) $validated['gross_monthly'],
                $validated['ter_category'] ?? 'A'
            ),
        ]);
    }

    public function transactions(): JsonResponse
    {
        return response()->json(['data' => TaxTransaction::with(['taxType', 'taxRate'])->orderByDesc('id')->get()]);
    }

    public function periods(): JsonResponse
    {
        return response()->json(['data' => TaxPeriod::with('taxType')->orderByDesc('year')->orderByDesc('month')->get()]);
    }

    public function payments(): JsonResponse
    {
        return response()->json(['data' => TaxPayment::with('taxType')->orderByDesc('id')->get()]);
    }

    public function storePayment(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'tax_type_id' => ['required', 'exists:tax_types,id'],
            'tax_period_id' => ['nullable', 'exists:tax_periods,id'],
            'financial_account_id' => ['required', 'exists:financial_accounts,id'],
            'payment_date' => ['required', 'date'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'ntpn_code' => ['required', 'string', 'max:64'],
            'billing_code' => ['nullable', 'string', 'max:64'],
            'notes' => ['nullable', 'string'],
        ]);

        return response()->json(['data' => $this->tax->recordTaxPayment($validated, $request->user())], 201);
    }
}

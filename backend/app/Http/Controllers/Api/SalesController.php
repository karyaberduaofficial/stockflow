<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Sale;
use App\Models\SalesReturn;
use App\Services\SalesService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SalesController extends Controller
{
    public function __construct(private readonly SalesService $sales) {}

    public function index(): JsonResponse
    {
        return response()->json([
            'data' => Sale::with(['customer', 'warehouse', 'items.product'])->orderByDesc('id')->get(),
        ]);
    }

    public function show(Sale $sale): JsonResponse
    {
        return response()->json([
            'data' => $sale->load(['customer', 'warehouse', 'items.product']),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customer_id' => ['nullable', 'exists:customers,id'],
            'warehouse_id' => ['required', 'exists:warehouses,id'],
            'sale_date' => ['nullable', 'date'],
            'payment_method' => ['sometimes', 'in:cash,transfer,credit,qris'],
            'discount_amount' => ['sometimes', 'numeric', 'min:0'],
            'tax_rate_code' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'exists:products,id'],
            'items.*.product_variant_id' => ['nullable', 'exists:product_variants,id'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'items.*.discount_amount' => ['sometimes', 'numeric', 'min:0'],
        ]);

        return response()->json(['data' => $this->sales->createSale($validated, $request->user())], 201);
    }

    public function returns(): JsonResponse
    {
        return response()->json([
            'data' => SalesReturn::with(['sale', 'items'])->orderByDesc('id')->get(),
        ]);
    }

    public function createReturn(Request $request, Sale $sale): JsonResponse
    {
        $validated = $request->validate([
            'return_date' => ['nullable', 'date'],
            'reason' => ['required', 'string', 'max:255'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'exists:products,id'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
        ]);

        return response()->json(['data' => $this->sales->createSalesReturn($sale, $validated, $request->user())], 201);
    }
}

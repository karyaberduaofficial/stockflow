<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GoodsReceipt;
use App\Models\PurchaseOrder;
use App\Models\SupplierInvoice;
use App\Services\AnalyticsService;
use App\Services\ProcurementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProcurementController extends Controller
{
    public function __construct(
        private readonly ProcurementService $procurement,
        private readonly AnalyticsService $analytics
    ) {}

    public function purchaseOrders(): JsonResponse
    {
        return response()->json([
            'data' => PurchaseOrder::with(['supplier', 'warehouse', 'items.product'])->orderByDesc('id')->get(),
        ]);
    }

    public function createPurchaseOrder(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'supplier_id' => ['required', 'exists:suppliers,id'],
            'warehouse_id' => ['required', 'exists:warehouses,id'],
            'order_date' => ['nullable', 'date'],
            'expected_date' => ['nullable', 'date'],
            'payment_method' => ['sometimes', 'in:cash,credit,transfer'],
            'discount_amount' => ['sometimes', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'exists:products,id'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
        ]);

        return response()->json(['data' => $this->procurement->createPurchaseOrder($validated, $request->user())], 201);
    }

    public function approvePurchaseOrder(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        return response()->json(['data' => $this->procurement->approvePurchaseOrder($purchaseOrder, $request->user())]);
    }

    public function receiveGoods(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $validated = $request->validate([
            'receipt_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
            'items' => ['sometimes', 'array', 'min:1'],
            'items.*.purchase_order_item_id' => ['nullable', 'exists:purchase_order_items,id'],
            'items.*.product_id' => ['required_with:items', 'exists:products,id'],
            'items.*.quantity_received' => ['required_with:items', 'numeric', 'gt:0'],
            'items.*.unit_cost' => ['required_with:items', 'numeric', 'min:0'],
        ]);

        return response()->json(['data' => $this->procurement->receiveGoods($purchaseOrder, $validated, $request->user())], 201);
    }

    public function goodsReceipts(): JsonResponse
    {
        return response()->json(['data' => GoodsReceipt::with(['purchaseOrder', 'items'])->orderByDesc('id')->get()]);
    }

    public function supplierInvoices(): JsonResponse
    {
        return response()->json(['data' => SupplierInvoice::with('supplier')->orderByDesc('id')->get()]);
    }

    public function supplierScorecards(): JsonResponse
    {
        return response()->json(['data' => $this->analytics->supplierScorecards()]);
    }
}

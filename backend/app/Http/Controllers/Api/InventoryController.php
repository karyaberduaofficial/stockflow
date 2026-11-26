<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryStock;
use App\Models\StockAdjustment;
use App\Models\StockMovement;
use App\Models\StockOpname;
use App\Models\WarehouseTransfer;
use App\Services\InventoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InventoryController extends Controller
{
    public function __construct(private readonly InventoryService $inventory) {}

    public function stocks(Request $request): JsonResponse
    {
        $query = InventoryStock::with(['product.category', 'product.unit', 'warehouse']);
        if ($request->filled('warehouse_id')) {
            $query->where('warehouse_id', (int) $request->input('warehouse_id'));
        }

        return response()->json(['data' => $query->orderBy('warehouse_id')->get()]);
    }

    public function movements(Request $request): JsonResponse
    {
        $query = StockMovement::with(['product', 'warehouse'])->orderByDesc('id');
        if ($request->filled('warehouse_id')) {
            $query->where('warehouse_id', (int) $request->input('warehouse_id'));
        }

        return response()->json(['data' => $query->limit(200)->get()]);
    }

    public function valuation(Request $request): JsonResponse
    {
        $warehouseId = $request->filled('warehouse_id') ? (int) $request->input('warehouse_id') : null;

        return response()->json(['data' => $this->inventory->valuationReport($warehouseId)]);
    }

    public function barcodeLookup(string $code): JsonResponse
    {
        $result = $this->inventory->lookupByBarcode($code);
        if (! $result) {
            return response()->json(['message' => 'Product or variant not found for barcode/SKU.'], 404);
        }

        return response()->json(['data' => $result]);
    }

    public function stockIn(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => ['required', 'exists:products,id'],
            'product_variant_id' => ['nullable', 'exists:product_variants,id'],
            'warehouse_id' => ['required', 'exists:warehouses,id'],
            'quantity' => ['required', 'numeric', 'gt:0'],
            'unit_cost' => ['required', 'numeric', 'min:0'],
            'reference_number' => ['nullable', 'string', 'max:64'],
            'notes' => ['nullable', 'string'],
        ]);

        $stock = $this->inventory->stockIn(
            productId: (int) $validated['product_id'],
            warehouseId: (int) $validated['warehouse_id'],
            quantity: (float) $validated['quantity'],
            unitCost: (float) $validated['unit_cost'],
            referenceNumber: $validated['reference_number'] ?? ('SIN-'.now()->format('YmdHis')),
            movementType: 'in',
            variantId: $validated['product_variant_id'] ?? null,
            notes: $validated['notes'] ?? null,
            actor: $request->user()
        );

        return response()->json(['data' => $stock->load('product', 'warehouse')], 201);
    }

    public function stockOut(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => ['required', 'exists:products,id'],
            'product_variant_id' => ['nullable', 'exists:product_variants,id'],
            'warehouse_id' => ['required', 'exists:warehouses,id'],
            'quantity' => ['required', 'numeric', 'gt:0'],
            'reference_number' => ['nullable', 'string', 'max:64'],
            'notes' => ['nullable', 'string'],
        ]);

        $result = $this->inventory->stockOut(
            productId: (int) $validated['product_id'],
            warehouseId: (int) $validated['warehouse_id'],
            quantity: (float) $validated['quantity'],
            referenceNumber: $validated['reference_number'] ?? ('SOUT-'.now()->format('YmdHis')),
            movementType: 'out',
            variantId: $validated['product_variant_id'] ?? null,
            notes: $validated['notes'] ?? null,
            actor: $request->user()
        );

        return response()->json(['data' => $result], 201);
    }

    public function adjustments(): JsonResponse
    {
        return response()->json(['data' => StockAdjustment::with(['warehouse', 'items.product'])->orderByDesc('id')->get()]);
    }

    public function createAdjustment(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'warehouse_id' => ['required', 'exists:warehouses,id'],
            'adjustment_date' => ['nullable', 'date'],
            'reason' => ['required', 'string', 'max:120'],
            'notes' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'exists:products,id'],
            'items.*.actual_qty' => ['required', 'numeric', 'min:0'],
        ]);

        return response()->json(['data' => $this->inventory->createAdjustmentRequest($validated, $request->user())], 201);
    }

    public function approveAdjustment(Request $request, StockAdjustment $adjustment): JsonResponse
    {
        return response()->json(['data' => $this->inventory->approveAdjustment($adjustment, $request->user())]);
    }

    public function opnames(): JsonResponse
    {
        return response()->json(['data' => StockOpname::with(['warehouse', 'items.product'])->orderByDesc('id')->get()]);
    }

    public function createOpname(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'warehouse_id' => ['required', 'exists:warehouses,id'],
            'opname_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'exists:products,id'],
            'items.*.counted_qty' => ['required', 'numeric', 'min:0'],
        ]);

        return response()->json(['data' => $this->inventory->createStockOpname($validated, $request->user())], 201);
    }

    public function transfers(): JsonResponse
    {
        return response()->json(['data' => WarehouseTransfer::with(['fromWarehouse', 'toWarehouse', 'items.product'])->orderByDesc('id')->get()]);
    }

    public function createTransfer(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from_warehouse_id' => ['required', 'exists:warehouses,id'],
            'to_warehouse_id' => ['required', 'exists:warehouses,id'],
            'transfer_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'exists:products,id'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
        ]);

        return response()->json(['data' => $this->inventory->initiateTransfer($validated, $request->user())], 201);
    }

    public function receiveTransfer(Request $request, WarehouseTransfer $transfer): JsonResponse
    {
        return response()->json(['data' => $this->inventory->receiveTransfer($transfer, $request->user())]);
    }
}

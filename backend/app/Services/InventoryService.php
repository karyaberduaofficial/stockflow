<?php

namespace App\Services;

use App\Models\InventoryStock;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StockAdjustment;
use App\Models\StockAdjustmentItem;
use App\Models\StockMovement;
use App\Models\StockOpname;
use App\Models\StockOpnameItem;
use App\Models\User;
use App\Models\WarehouseTransfer;
use App\Models\WarehouseTransferItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InventoryService
{
    public function __construct(private readonly AccountingService $accounting) {}

    /**
     * Lock or create an inventory stock bucket inside an active DB transaction.
     */
    private function lockStock(int $productId, int $warehouseId, ?int $variantId = null): InventoryStock
    {
        $query = InventoryStock::query()
            ->where('product_id', $productId)
            ->where('warehouse_id', $warehouseId);

        if ($variantId === null) {
            $query->whereNull('product_variant_id');
        } else {
            $query->where('product_variant_id', $variantId);
        }

        $stock = $query->lockForUpdate()->first();

        if (! $stock) {
            $product = Product::findOrFail($productId);
            $stock = InventoryStock::create([
                'product_id' => $productId,
                'product_variant_id' => $variantId,
                'warehouse_id' => $warehouseId,
                'quantity' => 0,
                'reserved_quantity' => 0,
                'average_cost' => (float) $product->cost_price,
                'total_value' => 0,
            ]);
        }

        return $stock;
    }

    /**
     * Stock In with Weighted Average Cost (WAC = Total Value / Total Qty).
     */
    public function stockIn(
        int $productId,
        int $warehouseId,
        float $quantity,
        float $unitCost,
        string $referenceNumber,
        string $movementType = 'in',
        ?int $variantId = null,
        ?string $referenceType = null,
        ?int $referenceId = null,
        ?string $notes = null,
        ?User $actor = null
    ): InventoryStock {
        if ($quantity <= 0) {
            throw ValidationException::withMessages(['quantity' => ['Stock in quantity must be greater than zero.']]);
        }
        if ($unitCost < 0) {
            throw ValidationException::withMessages(['unit_cost' => ['Unit cost cannot be negative.']]);
        }

        return DB::transaction(function () use (
            $productId, $warehouseId, $quantity, $unitCost, $referenceNumber,
            $movementType, $variantId, $referenceType, $referenceId, $notes, $actor
        ) {
            $stock = $this->lockStock($productId, $warehouseId, $variantId);

            $oldQty = (float) $stock->quantity;
            $oldValue = (float) $stock->total_value;
            $incomingValue = round($quantity * $unitCost, 2);

            $newQty = round($oldQty + $quantity, 2);
            $newValue = round($oldValue + $incomingValue, 2);
            $newWac = $newQty > 0 ? round($newValue / $newQty, 4) : 0.0;

            $stock->update([
                'quantity' => $newQty,
                'average_cost' => $newWac,
                'total_value' => $newValue,
                'last_movement_at' => now(),
            ]);

            StockMovement::create([
                'reference_number' => $referenceNumber,
                'product_id' => $productId,
                'product_variant_id' => $variantId,
                'warehouse_id' => $warehouseId,
                'movement_type' => $movementType,
                'quantity' => $quantity,
                'unit_cost' => $unitCost,
                'total_cost' => $incomingValue,
                'balance_before' => $oldQty,
                'balance_after' => $newQty,
                'reference_type' => $referenceType,
                'reference_id' => $referenceId,
                'notes' => $notes,
                'created_by' => $actor?->id,
                'moved_at' => now(),
            ]);

            return $stock->fresh();
        });
    }

    /**
     * Stock Out strictly rejecting negative stock (HTTP 422) and computing COGS via WAC.
     *
     * @return array{stock: InventoryStock, unit_cost: float, total_cost: float}
     */
    public function stockOut(
        int $productId,
        int $warehouseId,
        float $quantity,
        string $referenceNumber,
        string $movementType = 'out',
        ?int $variantId = null,
        ?string $referenceType = null,
        ?int $referenceId = null,
        ?string $notes = null,
        ?User $actor = null
    ): array {
        if ($quantity <= 0) {
            throw ValidationException::withMessages(['quantity' => ['Stock out quantity must be greater than zero.']]);
        }

        return DB::transaction(function () use (
            $productId, $warehouseId, $quantity, $referenceNumber,
            $movementType, $variantId, $referenceType, $referenceId, $notes, $actor
        ) {
            $stock = $this->lockStock($productId, $warehouseId, $variantId);
            $oldQty = (float) $stock->quantity;

            if ($oldQty < $quantity) {
                throw ValidationException::withMessages([
                    'quantity' => [sprintf(
                        'Insufficient stock: available %.2f, requested %.2f. Negative stock is strictly prohibited.',
                        $oldQty,
                        $quantity
                    )],
                ]);
            }

            $wac = (float) $stock->average_cost;
            $outgoingCost = round($quantity * $wac, 2);
            $newQty = round($oldQty - $quantity, 2);
            $newValue = $newQty > 0 ? round(max(0, (float) $stock->total_value - $outgoingCost), 2) : 0.0;

            $stock->update([
                'quantity' => $newQty,
                'total_value' => $newValue,
                'last_movement_at' => now(),
            ]);

            StockMovement::create([
                'reference_number' => $referenceNumber,
                'product_id' => $productId,
                'product_variant_id' => $variantId,
                'warehouse_id' => $warehouseId,
                'movement_type' => $movementType,
                'quantity' => -$quantity,
                'unit_cost' => $wac,
                'total_cost' => $outgoingCost,
                'balance_before' => $oldQty,
                'balance_after' => $newQty,
                'reference_type' => $referenceType,
                'reference_id' => $referenceId,
                'notes' => $notes,
                'created_by' => $actor?->id,
                'moved_at' => now(),
            ]);

            return [
                'stock' => $stock->fresh(),
                'unit_cost' => $wac,
                'total_cost' => $outgoingCost,
            ];
        });
    }

    public function createAdjustmentRequest(array $data, User $actor): StockAdjustment
    {
        return DB::transaction(function () use ($data, $actor) {
            $number = sprintf('ADJ-%s-%04d', now()->format('Ym'), (StockAdjustment::max('id') ?? 0) + 1);

            $adjustment = StockAdjustment::create([
                'adjustment_number' => $number,
                'warehouse_id' => $data['warehouse_id'],
                'adjustment_date' => $data['adjustment_date'] ?? now()->toDateString(),
                'reason' => $data['reason'],
                'status' => 'pending',
                'notes' => $data['notes'] ?? null,
                'requested_by' => $actor->id,
            ]);

            foreach ($data['items'] as $item) {
                $stock = $this->lockStock($item['product_id'], $data['warehouse_id'], $item['product_variant_id'] ?? null);
                $systemQty = (float) $stock->quantity;
                $actualQty = (float) $item['actual_qty'];
                if ($actualQty < 0) {
                    throw ValidationException::withMessages(['items' => ['Actual quantity cannot be negative.']]);
                }
                $variance = round($actualQty - $systemQty, 2);
                $unitCost = (float) $stock->average_cost;

                StockAdjustmentItem::create([
                    'stock_adjustment_id' => $adjustment->id,
                    'product_id' => $item['product_id'],
                    'product_variant_id' => $item['product_variant_id'] ?? null,
                    'system_qty' => $systemQty,
                    'actual_qty' => $actualQty,
                    'variance_qty' => $variance,
                    'unit_cost' => $unitCost,
                    'variance_value' => round($variance * $unitCost, 2),
                    'notes' => $item['notes'] ?? null,
                ]);
            }

            return $adjustment->load('items.product', 'warehouse');
        });
    }

    public function approveAdjustment(StockAdjustment $adjustment, User $approver): StockAdjustment
    {
        if ($adjustment->status !== 'pending') {
            throw ValidationException::withMessages(['status' => ['Only pending stock adjustments can be approved.']]);
        }

        return DB::transaction(function () use ($adjustment, $approver) {
            $adjustment->load('items');
            $totalGain = 0.0;
            $totalLoss = 0.0;

            foreach ($adjustment->items as $item) {
                $variance = (float) $item->variance_qty;
                if ($variance > 0) {
                    $this->stockIn(
                        productId: $item->product_id,
                        warehouseId: $adjustment->warehouse_id,
                        quantity: $variance,
                        unitCost: (float) $item->unit_cost,
                        referenceNumber: $adjustment->adjustment_number,
                        movementType: 'adjustment_in',
                        variantId: $item->product_variant_id,
                        referenceType: StockAdjustment::class,
                        referenceId: $adjustment->id,
                        notes: $adjustment->reason,
                        actor: $approver
                    );
                    $totalGain += abs((float) $item->variance_value);
                } elseif ($variance < 0) {
                    $out = $this->stockOut(
                        productId: $item->product_id,
                        warehouseId: $adjustment->warehouse_id,
                        quantity: abs($variance),
                        referenceNumber: $adjustment->adjustment_number,
                        movementType: 'adjustment_out',
                        variantId: $item->product_variant_id,
                        referenceType: StockAdjustment::class,
                        referenceId: $adjustment->id,
                        notes: $adjustment->reason,
                        actor: $approver
                    );
                    $totalLoss += $out['total_cost'];
                }
            }

            $journalId = null;
            $lines = [];
            if ($totalGain > 0) {
                $lines[] = ['coa_code' => '1140', 'debit' => round($totalGain, 2), 'credit' => 0, 'memo' => 'Kenaikan persediaan (stock adjustment)'];
                $lines[] = ['coa_code' => '7100', 'debit' => 0, 'credit' => round($totalGain, 2), 'memo' => 'Pendapatan selisih persediaan'];
            }
            if ($totalLoss > 0) {
                $lines[] = ['coa_code' => '6170', 'debit' => round($totalLoss, 2), 'credit' => 0, 'memo' => 'Beban susut/selisih persediaan'];
                $lines[] = ['coa_code' => '1140', 'debit' => 0, 'credit' => round($totalLoss, 2), 'memo' => 'Penurunan persediaan (stock adjustment)'];
            }
            if (! empty($lines)) {
                $journal = $this->accounting->postJournal(
                    entryDate: $adjustment->adjustment_date->toDateString(),
                    description: "Penyesuaian Persediaan {$adjustment->adjustment_number}",
                    lines: $lines,
                    sourceModule: 'inventory_adjustment',
                    sourceType: StockAdjustment::class,
                    sourceId: $adjustment->id,
                    actor: $approver
                );
                $journalId = $journal->id;
            }

            $adjustment->update([
                'status' => 'approved',
                'approved_by' => $approver->id,
                'approved_at' => now(),
                'journal_entry_id' => $journalId,
            ]);

            return $adjustment->fresh()->load('items.product', 'warehouse');
        });
    }

    public function createStockOpname(array $data, User $actor): StockOpname
    {
        return DB::transaction(function () use ($data, $actor) {
            $opname = StockOpname::create([
                'opname_number' => sprintf('OPN-%s-%04d', now()->format('Ym'), (StockOpname::max('id') ?? 0) + 1),
                'warehouse_id' => $data['warehouse_id'],
                'opname_date' => $data['opname_date'] ?? now()->toDateString(),
                'status' => 'completed',
                'notes' => $data['notes'] ?? null,
                'conducted_by' => $actor->id,
            ]);

            foreach ($data['items'] as $item) {
                $stock = $this->lockStock($item['product_id'], $data['warehouse_id'], $item['product_variant_id'] ?? null);
                $systemQty = (float) $stock->quantity;
                $countedQty = (float) $item['counted_qty'];
                $variance = round($countedQty - $systemQty, 2);
                $unitCost = (float) $stock->average_cost;

                StockOpnameItem::create([
                    'stock_opname_id' => $opname->id,
                    'product_id' => $item['product_id'],
                    'product_variant_id' => $item['product_variant_id'] ?? null,
                    'system_qty' => $systemQty,
                    'counted_qty' => $countedQty,
                    'variance_qty' => $variance,
                    'unit_cost' => $unitCost,
                    'variance_value' => round($variance * $unitCost, 2),
                    'notes' => $item['notes'] ?? null,
                ]);
            }

            return $opname->load('items.product', 'warehouse');
        });
    }

    /**
     * Multi-warehouse transfer Step 1: deduct from source warehouse and mark `in_transit`.
     */
    public function initiateTransfer(array $data, User $actor): WarehouseTransfer
    {
        if ((int) $data['from_warehouse_id'] === (int) $data['to_warehouse_id']) {
            throw ValidationException::withMessages([
                'to_warehouse_id' => ['Destination warehouse must differ from source warehouse.'],
            ]);
        }

        return DB::transaction(function () use ($data, $actor) {
            $number = sprintf('TRF-%s-%04d', now()->format('Ym'), (WarehouseTransfer::max('id') ?? 0) + 1);

            $transfer = WarehouseTransfer::create([
                'transfer_number' => $number,
                'from_warehouse_id' => $data['from_warehouse_id'],
                'to_warehouse_id' => $data['to_warehouse_id'],
                'transfer_date' => $data['transfer_date'] ?? now()->toDateString(),
                'status' => 'in_transit',
                'notes' => $data['notes'] ?? null,
                'created_by' => $actor->id,
            ]);

            foreach ($data['items'] as $item) {
                $out = $this->stockOut(
                    productId: $item['product_id'],
                    warehouseId: $data['from_warehouse_id'],
                    quantity: (float) $item['quantity'],
                    referenceNumber: $number,
                    movementType: 'transfer_out',
                    variantId: $item['product_variant_id'] ?? null,
                    referenceType: WarehouseTransfer::class,
                    referenceId: $transfer->id,
                    notes: "Transfer to warehouse #{$data['to_warehouse_id']}",
                    actor: $actor
                );

                WarehouseTransferItem::create([
                    'warehouse_transfer_id' => $transfer->id,
                    'product_id' => $item['product_id'],
                    'product_variant_id' => $item['product_variant_id'] ?? null,
                    'quantity' => (float) $item['quantity'],
                    'received_quantity' => 0,
                    'unit_cost' => $out['unit_cost'],
                    'total_cost' => $out['total_cost'],
                ]);
            }

            return $transfer->load('items.product', 'fromWarehouse', 'toWarehouse');
        });
    }

    /**
     * Multi-warehouse transfer Step 2: confirm arrival at destination warehouse.
     */
    public function receiveTransfer(WarehouseTransfer $transfer, User $actor): WarehouseTransfer
    {
        if ($transfer->status !== 'in_transit') {
            throw ValidationException::withMessages(['status' => ['Only in-transit transfers can be received.']]);
        }

        return DB::transaction(function () use ($transfer, $actor) {
            $transfer->load('items');

            foreach ($transfer->items as $item) {
                $this->stockIn(
                    productId: $item->product_id,
                    warehouseId: $transfer->to_warehouse_id,
                    quantity: (float) $item->quantity,
                    unitCost: (float) $item->unit_cost,
                    referenceNumber: $transfer->transfer_number,
                    movementType: 'transfer_in',
                    variantId: $item->product_variant_id,
                    referenceType: WarehouseTransfer::class,
                    referenceId: $transfer->id,
                    notes: "Received from warehouse #{$transfer->from_warehouse_id}",
                    actor: $actor
                );

                $item->update(['received_quantity' => $item->quantity]);
            }

            $transfer->update([
                'status' => 'received',
                'received_date' => now()->toDateString(),
                'received_by' => $actor->id,
            ]);

            return $transfer->fresh()->load('items.product', 'fromWarehouse', 'toWarehouse');
        });
    }

    public function lookupByBarcode(string $code): ?array
    {
        $product = Product::with(['category', 'brand', 'unit', 'stocks.warehouse'])
            ->where('barcode', $code)
            ->orWhere('sku', $code)
            ->first();

        if ($product) {
            return [
                'match_type' => 'product',
                'product' => $product,
                'total_stock' => (float) $product->stocks->sum('quantity'),
            ];
        }

        $variant = ProductVariant::with(['product.category', 'product.brand', 'product.unit'])
            ->where('barcode', $code)
            ->orWhere('sku', $code)
            ->first();

        if ($variant) {
            $stocks = InventoryStock::with('warehouse')
                ->where('product_variant_id', $variant->id)
                ->get();

            return [
                'match_type' => 'variant',
                'product' => $variant->product,
                'variant' => $variant,
                'stocks' => $stocks,
                'total_stock' => (float) $stocks->sum('quantity'),
            ];
        }

        return null;
    }

    public function valuationReport(?int $warehouseId = null): array
    {
        $query = InventoryStock::with(['product.category', 'product.unit', 'warehouse'])
            ->where('quantity', '>', 0);

        if ($warehouseId) {
            $query->where('warehouse_id', $warehouseId);
        }

        $rows = $query->get();

        return [
            'method' => 'Weighted Average Cost (WAC)',
            'total_sku_buckets' => $rows->count(),
            'total_quantity' => round((float) $rows->sum('quantity'), 2),
            'total_inventory_value' => round((float) $rows->sum('total_value'), 2),
            'items' => $rows->map(fn (InventoryStock $s) => [
                'product_id' => $s->product_id,
                'sku' => $s->product?->sku,
                'product_name' => $s->product?->name,
                'category' => $s->product?->category?->name,
                'warehouse' => $s->warehouse?->name,
                'quantity' => (float) $s->quantity,
                'average_cost' => (float) $s->average_cost,
                'total_value' => (float) $s->total_value,
                'min_stock' => (int) ($s->product?->min_stock ?? 0),
                'status' => $s->quantity <= ($s->product?->min_stock ?? 0) ? 'LOW_STOCK' : 'HEALTHY',
            ])->values()->all(),
        ];
    }
}

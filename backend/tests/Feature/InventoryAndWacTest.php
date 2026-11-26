<?php

namespace Tests\Feature;

use App\Models\InventoryStock;
use App\Models\Product;
use App\Models\User;
use App\Models\Warehouse;
use Database\Seeders\StockFlowSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class InventoryAndWacTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(StockFlowSeeder::class);
    }

    public function test_negative_stock_out_is_strictly_rejected_with_422(): void
    {
        $warehouseStaff = User::where('primary_role', 'warehouse')->firstOrFail();
        $product = Product::where('sku', 'SKU-SF-001')->firstOrFail();
        $warehouse = Warehouse::where('code', 'WH-JKT')->firstOrFail();

        $beforeQty = (float) InventoryStock::where('product_id', $product->id)
            ->where('warehouse_id', $warehouse->id)
            ->value('quantity');

        Sanctum::actingAs($warehouseStaff);

        $this->postJson('/api/inventory/stock-out', [
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
            'quantity' => $beforeQty + 50,
            'notes' => 'Attempt overdraw',
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['quantity']);

        $afterQty = (float) InventoryStock::where('product_id', $product->id)
            ->where('warehouse_id', $warehouse->id)
            ->value('quantity');

        $this->assertSame($beforeQty, $afterQty);
    }

    public function test_weighted_average_cost_and_cogs_calculation_precision(): void
    {
        $warehouseStaff = User::where('primary_role', 'warehouse')->firstOrFail();
        $product = Product::where('sku', 'SKU-NK-008')->firstOrFail();
        $warehouse = Warehouse::where('code', 'WH-BDG')->firstOrFail(); // Clean 0 stock bucket

        Sanctum::actingAs($warehouseStaff);

        // Batch 1: 10 units @ Rp 1,000,000 -> Total 10,000,000, WAC = 1,000,000
        $this->postJson('/api/inventory/stock-in', [
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
            'quantity' => 10,
            'unit_cost' => 1000000,
        ])->assertCreated();

        // Batch 2: 10 units @ Rp 1,400,000 -> Total 24,000,000, WAC = 1,200,000
        $this->postJson('/api/inventory/stock-in', [
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
            'quantity' => 10,
            'unit_cost' => 1400000,
        ])->assertCreated();

        $stock = InventoryStock::where('product_id', $product->id)->where('warehouse_id', $warehouse->id)->firstOrFail();
        $this->assertEquals(20.0, (float) $stock->quantity);
        $this->assertEquals(1200000.0, (float) $stock->average_cost);
        $this->assertEquals(24000000.0, (float) $stock->total_value);

        // Stock out 5 units -> COGS = 5 * 1,200,000 = 6,000,000; Remaining = 15 units, Value = 18,000,000
        $outRes = $this->postJson('/api/inventory/stock-out', [
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
            'quantity' => 5,
        ])->assertCreated();

        $this->assertEquals(1200000.0, (float) $outRes->json('data.unit_cost'));
        $this->assertEquals(6000000.0, (float) $outRes->json('data.total_cost'));

        $stock->refresh();
        $this->assertEquals(15.0, (float) $stock->quantity);
        $this->assertEquals(18000000.0, (float) $stock->total_value);
    }

    public function test_multi_warehouse_transfer_in_transit_and_receive_lifecycle(): void
    {
        $warehouseStaff = User::where('primary_role', 'warehouse')->firstOrFail();
        $product = Product::where('sku', 'SKU-LM-003')->firstOrFail();
        $fromWh = Warehouse::where('code', 'WH-JKT')->firstOrFail();
        $toWh = Warehouse::where('code', 'WH-SBY')->firstOrFail();

        $fromBefore = (float) InventoryStock::where('product_id', $product->id)->where('warehouse_id', $fromWh->id)->value('quantity');

        Sanctum::actingAs($warehouseStaff);

        $createRes = $this->postJson('/api/inventory/transfers', [
            'from_warehouse_id' => $fromWh->id,
            'to_warehouse_id' => $toWh->id,
            'items' => [['product_id' => $product->id, 'quantity' => 4]],
        ])->assertCreated()
            ->assertJsonPath('data.status', 'in_transit');

        $transferId = $createRes->json('data.id');

        // Source deducted immediately while in transit; destination not yet credited
        $this->assertEquals(
            $fromBefore - 4,
            (float) InventoryStock::where('product_id', $product->id)->where('warehouse_id', $fromWh->id)->value('quantity')
        );
        $this->assertEquals(
            0.0,
            (float) (InventoryStock::where('product_id', $product->id)->where('warehouse_id', $toWh->id)->value('quantity') ?? 0)
        );

        // Confirm receipt at destination warehouse
        $this->postJson("/api/inventory/transfers/{$transferId}/receive")
            ->assertOk()
            ->assertJsonPath('data.status', 'received');

        $this->assertEquals(
            4.0,
            (float) InventoryStock::where('product_id', $product->id)->where('warehouse_id', $toWh->id)->value('quantity')
        );
    }

    public function test_stock_adjustment_maker_checker_approval_and_barcode_lookup(): void
    {
        $warehouseStaff = User::where('primary_role', 'warehouse')->firstOrFail();
        $manager = User::where('primary_role', 'manager')->firstOrFail();
        $product = Product::where('sku', 'SKU-SF-001')->firstOrFail();
        $wh = Warehouse::where('code', 'WH-JKT')->firstOrFail();

        Sanctum::actingAs($warehouseStaff);
        $this->getJson('/api/inventory/barcode/8991001000011')
            ->assertOk()
            ->assertJsonPath('data.product.sku', 'SKU-SF-001');

        $adjRes = $this->postJson('/api/inventory/adjustments', [
            'warehouse_id' => $wh->id,
            'reason' => 'Stock opname damaged frame write-off',
            'items' => [['product_id' => $product->id, 'actual_qty' => 17]],
        ])->assertCreated()
            ->assertJsonPath('data.status', 'pending');

        $adjId = $adjRes->json('data.id');

        // Warehouse cannot approve its own adjustment
        $this->postJson("/api/inventory/adjustments/{$adjId}/approve")->assertStatus(403);

        // Manager approves adjustment -> posts stock delta + auto journal
        Sanctum::actingAs($manager);
        $this->postJson("/api/inventory/adjustments/{$adjId}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');
    }
}

<?php

namespace Tests\Feature;

use App\Models\AccountsPayable;
use App\Models\Customer;
use App\Models\FinancialAccount;
use App\Models\Product;
use App\Models\Supplier;
use App\Models\User;
use App\Models\Warehouse;
use Database\Seeders\StockFlowSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProcurementSalesTaxTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(StockFlowSeeder::class);
    }

    public function test_ppn_12_percent_with_dpp_11_12_yields_exact_11_percent_effective_tax(): void
    {
        $finance = User::where('primary_role', 'finance')->firstOrFail();
        Sanctum::actingAs($finance);

        $res = $this->postJson('/api/tax/calculate/ppn', [
            'base_amount' => 10000000,
            'as_of_date' => '2026-03-01',
        ])->assertOk();

        $res->assertJsonPath('data.dpp_ratio', '11/12')
            ->assertJsonPath('data.statutory_rate_percent', 12)
            ->assertJsonPath('data.effective_rate_percent', 11)
            ->assertJsonPath('data.dpp_amount', 9166666.67)
            ->assertJsonPath('data.tax_amount', 1100000)
            ->assertJsonPath('data.total_with_tax', 11100000);
    }

    public function test_end_to_end_procurement_ap_payment_sales_and_return_keep_accounting_balanced(): void
    {
        $purchasing = User::where('primary_role', 'purchasing')->firstOrFail();
        $manager = User::where('primary_role', 'manager')->firstOrFail();
        $warehouse = User::where('primary_role', 'warehouse')->firstOrFail();
        $salesUser = User::where('primary_role', 'sales')->firstOrFail();
        $finance = User::where('primary_role', 'finance')->firstOrFail();

        $supplier = Supplier::firstOrFail();
        $customer = Customer::firstOrFail();
        $wh = Warehouse::where('code', 'WH-JKT')->firstOrFail();
        $product = Product::where('sku', 'SKU-MJ-002')->firstOrFail();

        // 1. Purchasing creates PO (5 units @ Rp 5,500,000 = 27,500,000 + 11% PPN 3,025,000 = 30,525,000)
        Sanctum::actingAs($purchasing);
        $poRes = $this->postJson('/api/procurement/purchase-orders', [
            'supplier_id' => $supplier->id,
            'warehouse_id' => $wh->id,
            'order_date' => '2026-02-05',
            'payment_method' => 'credit',
            'items' => [['product_id' => $product->id, 'quantity' => 5, 'unit_price' => 5500000]],
        ])->assertCreated();

        $poId = $poRes->json('data.id');
        $this->assertEquals(3025000.0, (float) $poRes->json('data.tax_amount'));

        // 2. Manager approves PO
        Sanctum::actingAs($manager);
        $this->postJson("/api/procurement/purchase-orders/{$poId}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');

        // 3. Warehouse receives goods -> posts Stock In + PPN Masukan + AP + Journal
        Sanctum::actingAs($warehouse);
        $this->postJson("/api/procurement/purchase-orders/{$poId}/receive", [
            'receipt_date' => '2026-02-08',
        ])->assertCreated();

        // 4. Finance pays AP (Liability settlement ONLY — no double expense!)
        Sanctum::actingAs($finance);
        $ap = AccountsPayable::latest('id')->firstOrFail();
        $bank = FinancialAccount::where('code', 'FIN-BMRI-01')->firstOrFail();
        $expBefore = $this->getJson('/api/accounting/statements/income')->json('data.operating_expenses');

        $this->postJson("/api/finance/accounts-payable/{$ap->id}/pay", [
            'financial_account_id' => $bank->id,
            'payment_date' => '2026-02-10',
            'amount' => (float) $ap->balance_amount,
        ])->assertCreated();

        $expAfter = $this->getJson('/api/accounting/statements/income')->json('data.operating_expenses');
        $this->assertEquals($expBefore, $expAfter, 'AP payment must NOT record duplicate operating expense');
        $this->assertSame('paid', $ap->fresh()->status);

        // 5. Sales sells 2 units @ Rp 8,900,000 + PPN + COGS
        Sanctum::actingAs($salesUser);
        $saleRes = $this->postJson('/api/sales', [
            'customer_id' => $customer->id,
            'warehouse_id' => $wh->id,
            'sale_date' => '2026-02-12',
            'payment_method' => 'cash',
            'items' => [['product_id' => $product->id, 'quantity' => 2, 'unit_price' => 8900000]],
        ])->assertCreated();

        $saleId = $saleRes->json('data.id');
        $this->assertEquals(11000000.0, (float) $saleRes->json('data.total_cogs'));

        // 6. Sales Return of 1 unit
        $this->postJson("/api/sales/{$saleId}/returns", [
            'return_date' => '2026-02-14',
            'reason' => 'Minor scratch on delivery',
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->assertCreated();

        // 7. Verify Balance Sheet remains 100% balanced (Assets === Liabilities + Equity)
        Sanctum::actingAs($finance);
        $bs = $this->getJson('/api/accounting/statements/balance-sheet')->assertOk()->json('data');
        $this->assertTrue($bs['is_balanced']);
        $this->assertEquals($bs['total_assets'], $bs['total_liabilities_and_equity']);
    }
}

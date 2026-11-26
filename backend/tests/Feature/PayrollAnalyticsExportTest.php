<?php

namespace Tests\Feature;

use App\Models\FinancialAccount;
use App\Models\Payroll;
use App\Models\PayrollPeriod;
use App\Models\User;
use App\Services\AnalyticsService;
use Database\Seeders\StockFlowSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PayrollAnalyticsExportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(StockFlowSeeder::class);
    }

    public function test_payroll_gross_net_and_employer_bpjs_never_deducted_from_employee(): void
    {
        $hr = User::where('primary_role', 'hr_payroll')->firstOrFail();
        $manager = User::where('primary_role', 'manager')->firstOrFail();
        $finance = User::where('primary_role', 'finance')->firstOrFail();

        $period = PayrollPeriod::where('code', 'PAY-2026-01')->firstOrFail();
        $payrolls = Payroll::where('payroll_period_id', $period->id)->get();

        $this->assertGreaterThanOrEqual(4, $payrolls->count());

        foreach ($payrolls as $p) {
            // Employer BPJS MUST be positive (>0) as company expense
            $this->assertGreaterThan(0, (float) $p->bpjs_employer_total);

            // Employee total_deductions MUST ONLY include PPh 21 + Employee BPJS + Other (NEVER Employer BPJS!)
            $expectedDeductions = round((float) $p->pph21_amount + (float) $p->bpjs_employee_total + (float) $p->other_deductions, 2);
            $this->assertEquals($expectedDeductions, (float) $p->total_deductions);

            // Net Salary === Gross - Employee Deductions
            $expectedNet = round((float) $p->gross_salary - $expectedDeductions, 2);
            $this->assertEquals($expectedNet, (float) $p->net_salary);
        }

        // Complete Maker-Checker Workflow: HR Check -> Manager Approve -> Finance Disburse
        Sanctum::actingAs($hr);
        $this->postJson("/api/payroll/periods/{$period->id}/hr-check")
            ->assertOk()
            ->assertJsonPath('data.status', 'hr_checked');

        // HR cannot self-approve Manager stage
        $this->postJson("/api/payroll/periods/{$period->id}/manager-approve")->assertStatus(403);

        Sanctum::actingAs($manager);
        $this->postJson("/api/payroll/periods/{$period->id}/manager-approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'manager_approved');

        Sanctum::actingAs($finance);
        $bank = FinancialAccount::where('code', 'FIN-BMRI-01')->firstOrFail();
        $this->postJson("/api/payroll/periods/{$period->id}/disburse", [
            'financial_account_id' => $bank->id,
        ])->assertOk()
            ->assertJsonPath('data.status', 'finance_paid');

        // Balance sheet MUST stay balanced after payroll disbursement journal!
        $bs = $this->getJson('/api/accounting/statements/balance-sheet')->assertOk()->json('data');
        $this->assertTrue($bs['is_balanced']);
        $this->assertEquals($bs['total_assets'], $bs['total_liabilities_and_equity']);
    }

    public function test_moving_average_demand_forecast_and_reorder_point_formulas(): void
    {
        /** @var AnalyticsService $analytics */
        $analytics = app(AnalyticsService::class);

        // Moving average: (12 + 15 + 18) / 3 = 15.0
        $this->assertSame(15.0, $analytics->calculateMovingAverage([10, 12, 15, 18], 3));

        // Reorder Point: (2.5 * 7) + 5 = 22.5
        $this->assertSame(22.5, $analytics->calculateReorderPoint(2.5, 7, 5));

        $manager = User::where('primary_role', 'manager')->firstOrFail();
        Sanctum::actingAs($manager);

        $this->postJson('/api/reports/forecasts/generate', ['window_months' => 3])
            ->assertCreated()
            ->assertJsonPath('data.formula_moving_average', 'SUM(D_i) / n');
    }

    public function test_document_export_bridge_enforces_rbac_and_streams_valid_binary_files(): void
    {
        // Sales role MUST be blocked from financial export (403)
        $sales = User::where('primary_role', 'sales')->firstOrFail();
        Sanctum::actingAs($sales);
        $this->get('/api/exports/financial/pdf')
            ->assertStatus(403)
            ->assertJsonPath('error_code', 'EXPORT_FORBIDDEN');

        // Finance role downloads real PDF via document-service/generate_export.py
        $finance = User::where('primary_role', 'finance')->firstOrFail();
        Sanctum::actingAs($finance);

        $pdfResponse = $this->get('/api/exports/financial/pdf');
        $pdfResponse->assertOk();
        $pdfResponse->assertDownload();
        $pdfContent = file_get_contents($pdfResponse->getFile()->getPathname());
        $this->assertNotFalse($pdfContent);
        $this->assertStringStartsWith('%PDF-', $pdfContent);

        // Warehouse role downloads real Excel (.xlsx) via document-service/generate_export.py
        $warehouse = User::where('primary_role', 'warehouse')->firstOrFail();
        Sanctum::actingAs($warehouse);

        $xlsxResponse = $this->get('/api/exports/inventory/xlsx');
        $xlsxResponse->assertOk();
        $xlsxResponse->assertDownload();
        $xlsxContent = file_get_contents($xlsxResponse->getFile()->getPathname());
        $this->assertNotFalse($xlsxContent);
        $this->assertStringStartsWith('PK', $xlsxContent);
    }
}

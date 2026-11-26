<?php

namespace Tests\Feature;

use App\Models\FinancialAccount;
use App\Models\JournalEntry;
use App\Models\User;
use Database\Seeders\StockFlowSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use RuntimeException;
use Tests\TestCase;

class AccountingAndFinanceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(StockFlowSeeder::class);
    }

    public function test_unbalanced_double_entry_journal_is_strictly_rejected(): void
    {
        $finance = User::where('primary_role', 'finance')->firstOrFail();
        Sanctum::actingAs($finance);

        $this->postJson('/api/accounting/journals', [
            'entry_date' => '2026-02-10',
            'description' => 'Unbalanced test journal',
            'lines' => [
                ['coa_code' => '6140', 'debit' => 1500000, 'credit' => 0],
                ['coa_code' => '1110', 'debit' => 0, 'credit' => 1000000],
            ],
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['lines']);
    }

    public function test_posting_to_closed_accounting_period_is_blocked(): void
    {
        $finance = User::where('primary_role', 'finance')->firstOrFail();
        Sanctum::actingAs($finance);

        $this->postJson('/api/accounting/journals', [
            'entry_date' => '2025-12-20',
            'description' => 'Attempt backdated entry into closed period',
            'lines' => [
                ['coa_code' => '6140', 'debit' => 500000, 'credit' => 0],
                ['coa_code' => '1110', 'debit' => 0, 'credit' => 500000],
            ],
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['entry_date']);
    }

    public function test_posted_journal_is_immutable_and_supports_reversal(): void
    {
        $finance = User::where('primary_role', 'finance')->firstOrFail();
        Sanctum::actingAs($finance);

        $createRes = $this->postJson('/api/accounting/journals', [
            'entry_date' => '2026-02-11',
            'description' => 'Beban Listrik Showroom',
            'lines' => [
                ['coa_code' => '6140', 'debit' => 2500000, 'credit' => 0],
                ['coa_code' => '1121', 'debit' => 0, 'credit' => 2500000],
            ],
        ])->assertCreated();

        $journal = JournalEntry::findOrFail($createRes->json('data.id'));

        // Direct mutation or deletion MUST throw RuntimeException
        $this->expectException(RuntimeException::class);
        try {
            $journal->update(['description' => 'Tampered description']);
        } finally {
            // Reversal entry via API succeeds cleanly
            $revRes = $this->postJson("/api/accounting/journals/{$journal->id}/reverse", [
                'reason' => 'Duplicate entry correction',
                'reversal_date' => '2026-02-12',
            ])->assertCreated();

            $this->assertEquals(2500000.0, (float) $revRes->json('data.total_debit'));
            $this->assertSame('reversed', $journal->fresh()->status);
        }
    }

    public function test_cash_bank_internal_transfer_is_non_income_and_non_expense_and_balance_sheet_stays_balanced(): void
    {
        $finance = User::where('primary_role', 'finance')->firstOrFail();
        Sanctum::actingAs($finance);

        $plBefore = $this->getJson('/api/accounting/statements/income')->assertOk()->json('data');

        $fromAcc = FinancialAccount::where('code', 'FIN-BMRI-01')->firstOrFail();
        $toAcc = FinancialAccount::where('code', 'FIN-KAS-01')->firstOrFail();
        $fromBefore = (float) $fromAcc->current_balance;
        $toBefore = (float) $toAcc->current_balance;

        $this->postJson('/api/finance/transfers', [
            'from_account_id' => $fromAcc->id,
            'to_account_id' => $toAcc->id,
            'transaction_date' => '2026-02-15',
            'amount' => 25000000,
            'description' => 'Topup Kas Showroom dari Bank Mandiri',
        ])->assertCreated()
            ->assertJsonPath('data.is_internal_transfer', true);

        $this->assertEquals($fromBefore - 25000000, (float) $fromAcc->fresh()->current_balance);
        $this->assertEquals($toBefore + 25000000, (float) $toAcc->fresh()->current_balance);

        // Income Statement MUST remain completely unaffected!
        $plAfter = $this->getJson('/api/accounting/statements/income')->assertOk()->json('data');
        $this->assertEquals($plBefore['net_sales'], $plAfter['net_sales']);
        $this->assertEquals($plBefore['operating_expenses'], $plAfter['operating_expenses']);
        $this->assertEquals($plBefore['net_profit'], $plAfter['net_profit']);

        // Trial Balance & Balance Sheet MUST be 100% balanced (Assets == Liabilities + Equity)
        $tb = $this->getJson('/api/accounting/trial-balance')->assertOk()->json('data');
        $this->assertTrue($tb['is_balanced']);
        $this->assertEquals($tb['total_debit'], $tb['total_credit']);

        $bs = $this->getJson('/api/accounting/statements/balance-sheet')->assertOk()->json('data');
        $this->assertTrue($bs['is_balanced']);
        $this->assertEquals($bs['total_assets'], $bs['total_liabilities_and_equity']);
    }
}

<?php

namespace App\Services;

use App\Models\AccountsReceivable;
use App\Models\Customer;
use App\Models\FinancialAccount;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\SalesReturn;
use App\Models\SalesReturnItem;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SalesService
{
    public function __construct(
        private readonly InventoryService $inventory,
        private readonly AccountingService $accounting,
        private readonly TaxService $tax
    ) {}

    /**
     * Create POS / Invoice Sale:
     * 1. Check & deduct inventory stock (strict non-negative) & compute COGS using WAC
     * 2. Compute configurable PPN (e.g., 12% x 11/12 DPP = 11% effective)
     * 3. Update Cash/Bank or create Accounts Receivable
     * 4. Record PPN Keluaran in Tax module
     * 5. Post balanced Double-Entry Journal (Cash/AR, Revenue, PPN Keluaran, COGS, Inventory)
     */
    public function createSale(array $data, User $actor): Sale
    {
        return DB::transaction(function () use ($data, $actor) {
            $saleDate = $data['sale_date'] ?? now()->toDateString();
            $invoiceNumber = sprintf('INV-%s-%04d', Carbon::parse($saleDate)->format('Ym'), (Sale::max('id') ?? 0) + 1);
            $discount = round((float) ($data['discount_amount'] ?? 0), 2);
            $paymentMethod = $data['payment_method'] ?? 'cash';

            $sale = Sale::create([
                'invoice_number' => $invoiceNumber,
                'customer_id' => $data['customer_id'] ?? null,
                'warehouse_id' => $data['warehouse_id'],
                'sale_date' => $saleDate,
                'payment_method' => $paymentMethod,
                'payment_status' => $paymentMethod === 'credit' ? 'unpaid' : 'paid',
                'status' => 'completed',
                'discount_amount' => $discount,
                'notes' => $data['notes'] ?? null,
                'cashier_id' => $actor->id,
            ]);

            $subtotal = 0.0;
            $totalCogs = 0.0;

            foreach ($data['items'] as $item) {
                $qty = (float) $item['quantity'];
                $unitPrice = (float) $item['unit_price'];
                $lineDiscount = (float) ($item['discount_amount'] ?? 0);
                $lineSub = round(($qty * $unitPrice) - $lineDiscount, 2);

                $out = $this->inventory->stockOut(
                    productId: $item['product_id'],
                    warehouseId: $data['warehouse_id'],
                    quantity: $qty,
                    referenceNumber: $invoiceNumber,
                    movementType: 'sale',
                    variantId: $item['product_variant_id'] ?? null,
                    referenceType: Sale::class,
                    referenceId: $sale->id,
                    notes: "POS Sale {$invoiceNumber}",
                    actor: $actor
                );

                SaleItem::create([
                    'sale_id' => $sale->id,
                    'product_id' => $item['product_id'],
                    'product_variant_id' => $item['product_variant_id'] ?? null,
                    'quantity' => $qty,
                    'unit_price' => $unitPrice,
                    'unit_cost' => $out['unit_cost'],
                    'discount_amount' => $lineDiscount,
                    'subtotal' => $lineSub,
                    'cogs_amount' => $out['total_cost'],
                ]);

                $subtotal = round($subtotal + $lineSub, 2);
                $totalCogs = round($totalCogs + $out['total_cost'], 2);
            }

            $netSales = max(0, round($subtotal - $discount, 2));
            $ppn = $this->tax->calculatePpn($netSales, $saleDate, $data['tax_rate_code'] ?? null);
            $grandTotal = round($netSales + $ppn['tax_amount'], 2);

            $debitCoaId = null;
            $debitCoaCode = '1130';
            if ($paymentMethod !== 'credit') {
                $accountType = $paymentMethod === 'cash' ? 'cash' : 'bank';
                $account = FinancialAccount::lockForUpdate()
                    ->where('account_type', $accountType)
                    ->first() ?? FinancialAccount::lockForUpdate()->first();
                if ($account) {
                    $account->update(['current_balance' => round((float) $account->current_balance + $grandTotal, 2)]);
                    $debitCoaId = $account->coa_id;
                } else {
                    $debitCoaCode = '1110';
                }
            }

            $lines = [
                $debitCoaId
                    ? ['coa_id' => $debitCoaId, 'debit' => $grandTotal, 'credit' => 0, 'memo' => "Penerimaan {$invoiceNumber}"]
                    : ['coa_code' => $debitCoaCode, 'debit' => $grandTotal, 'credit' => 0, 'memo' => "Piutang / Kas {$invoiceNumber}"],
                ['coa_code' => '4100', 'debit' => 0, 'credit' => $netSales, 'memo' => "Penjualan {$invoiceNumber}"],
            ];
            if ($ppn['tax_amount'] > 0) {
                $lines[] = ['coa_code' => '2121', 'debit' => 0, 'credit' => $ppn['tax_amount'], 'memo' => 'PPN Keluaran'];
            }
            if ($totalCogs > 0) {
                $lines[] = ['coa_code' => '5100', 'debit' => $totalCogs, 'credit' => 0, 'memo' => "HPP (WAC) {$invoiceNumber}"];
                $lines[] = ['coa_code' => '1140', 'debit' => 0, 'credit' => $totalCogs, 'memo' => "Pengurangan Persediaan {$invoiceNumber}"];
            }

            $journal = $this->accounting->postJournal(
                entryDate: $saleDate,
                description: "Penjualan {$invoiceNumber}",
                lines: $lines,
                sourceModule: 'sales',
                sourceType: Sale::class,
                sourceId: $sale->id,
                actor: $actor
            );

            $sale->update([
                'subtotal' => $subtotal,
                'dpp_amount' => $ppn['dpp_amount'],
                'tax_rate' => $ppn['effective_rate_percent'],
                'tax_amount' => $ppn['tax_amount'],
                'total_amount' => $grandTotal,
                'paid_amount' => $paymentMethod === 'credit' ? 0 : $grandTotal,
                'total_cogs' => $totalCogs,
                'journal_entry_id' => $journal->id,
            ]);

            $customer = $sale->customer_id ? Customer::find($sale->customer_id) : null;

            if ($ppn['tax_amount'] > 0) {
                $this->tax->recordTaxTransaction(
                    taxTypeCode: 'PPN',
                    direction: 'output',
                    transactionDate: $saleDate,
                    baseAmount: $netSales,
                    dppAmount: $ppn['dpp_amount'],
                    rateApplied: $ppn['effective_rate_percent'],
                    taxAmount: $ppn['tax_amount'],
                    taxRateId: $ppn['tax_rate_id'],
                    sourceType: Sale::class,
                    sourceId: $sale->id,
                    counterpartyName: $customer?->name ?? 'Walk-in Customer',
                    counterpartyNpwp: $customer?->npwp,
                    notes: "PPN Keluaran {$invoiceNumber}"
                );
            }

            if ($paymentMethod === 'credit' && $customer) {
                AccountsReceivable::create([
                    'ar_number' => sprintf('AR-%s-%04d', Carbon::parse($saleDate)->format('Ym'), (AccountsReceivable::max('id') ?? 0) + 1),
                    'customer_id' => $customer->id,
                    'sale_id' => $sale->id,
                    'issue_date' => $saleDate,
                    'due_date' => Carbon::parse($saleDate)->addDays(30)->toDateString(),
                    'total_amount' => $grandTotal,
                    'paid_amount' => 0,
                    'balance_amount' => $grandTotal,
                    'status' => 'open',
                ]);
            }

            return $sale->fresh()->load('items.product', 'customer', 'warehouse');
        });
    }

    public function createSalesReturn(Sale $sale, array $data, User $actor): SalesReturn
    {
        return DB::transaction(function () use ($sale, $data, $actor) {
            $sale->load('items');
            $returnDate = $data['return_date'] ?? now()->toDateString();
            $returnNumber = sprintf('RET-%s-%04d', Carbon::parse($returnDate)->format('Ym'), (SalesReturn::max('id') ?? 0) + 1);

            $salesReturn = SalesReturn::create([
                'return_number' => $returnNumber,
                'sale_id' => $sale->id,
                'customer_id' => $sale->customer_id,
                'warehouse_id' => $sale->warehouse_id,
                'return_date' => $returnDate,
                'reason' => $data['reason'],
                'status' => 'completed',
                'processed_by' => $actor->id,
            ]);

            $subtotal = 0.0;
            $cogsReversed = 0.0;

            foreach ($data['items'] as $item) {
                $saleItem = $sale->items->firstWhere('product_id', $item['product_id']);
                if (! $saleItem || (float) $item['quantity'] > (float) $saleItem->quantity) {
                    throw ValidationException::withMessages([
                        'items' => ['Return quantity exceeds original sold quantity.'],
                    ]);
                }

                $qty = (float) $item['quantity'];
                $lineSub = round($qty * (float) $saleItem->unit_price, 2);
                $lineCogs = round($qty * (float) $saleItem->unit_cost, 2);

                SalesReturnItem::create([
                    'sales_return_id' => $salesReturn->id,
                    'sales_item_id' => $saleItem->id,
                    'product_id' => $saleItem->product_id,
                    'product_variant_id' => $saleItem->product_variant_id,
                    'quantity' => $qty,
                    'unit_price' => $saleItem->unit_price,
                    'unit_cost' => $saleItem->unit_cost,
                    'subtotal' => $lineSub,
                ]);

                $this->inventory->stockIn(
                    productId: $saleItem->product_id,
                    warehouseId: $sale->warehouse_id,
                    quantity: $qty,
                    unitCost: (float) $saleItem->unit_cost,
                    referenceNumber: $returnNumber,
                    movementType: 'return',
                    variantId: $saleItem->product_variant_id,
                    referenceType: SalesReturn::class,
                    referenceId: $salesReturn->id,
                    notes: "Return of {$sale->invoice_number}",
                    actor: $actor
                );

                $subtotal = round($subtotal + $lineSub, 2);
                $cogsReversed = round($cogsReversed + $lineCogs, 2);
            }

            $ppn = $this->tax->calculatePpn($subtotal, $returnDate);
            $refundTotal = round($subtotal + $ppn['tax_amount'], 2);

            $lines = [
                ['coa_code' => '4200', 'debit' => $subtotal, 'credit' => 0, 'memo' => "Retur Penjualan {$returnNumber}"],
            ];
            if ($ppn['tax_amount'] > 0) {
                $lines[] = ['coa_code' => '2121', 'debit' => $ppn['tax_amount'], 'credit' => 0, 'memo' => 'Koreksi PPN Keluaran'];
            }
            $lines[] = ['coa_code' => '1110', 'debit' => 0, 'credit' => $refundTotal, 'memo' => "Pengembalian dana {$returnNumber}"];

            if ($cogsReversed > 0) {
                $lines[] = ['coa_code' => '1140', 'debit' => $cogsReversed, 'credit' => 0, 'memo' => 'Pengembalian persediaan retur'];
                $lines[] = ['coa_code' => '5100', 'debit' => 0, 'credit' => $cogsReversed, 'memo' => 'Koreksi HPP retur'];
            }

            $journal = $this->accounting->postJournal(
                entryDate: $returnDate,
                description: "Retur Penjualan {$returnNumber} ({$sale->invoice_number})",
                lines: $lines,
                sourceModule: 'sales_return',
                sourceType: SalesReturn::class,
                sourceId: $salesReturn->id,
                actor: $actor
            );

            $salesReturn->update([
                'subtotal' => $subtotal,
                'tax_amount' => $ppn['tax_amount'],
                'total_refund' => $refundTotal,
                'total_cogs_reversed' => $cogsReversed,
                'journal_entry_id' => $journal->id,
            ]);

            return $salesReturn->fresh()->load('items', 'sale');
        });
    }
}

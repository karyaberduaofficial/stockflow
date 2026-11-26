<?php

namespace App\Services;

use App\Models\AccountsPayable;
use App\Models\FinancialAccount;
use App\Models\GoodsReceipt;
use App\Models\GoodsReceiptItem;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\SupplierInvoice;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ProcurementService
{
    public function __construct(
        private readonly InventoryService $inventory,
        private readonly AccountingService $accounting,
        private readonly TaxService $tax
    ) {}

    public function createPurchaseOrder(array $data, User $actor): PurchaseOrder
    {
        return DB::transaction(function () use ($data, $actor) {
            $orderDate = $data['order_date'] ?? now()->toDateString();
            $subtotal = 0.0;
            $discount = round((float) ($data['discount_amount'] ?? 0), 2);

            foreach ($data['items'] as $item) {
                $lineSub = round(((float) $item['quantity'] * (float) $item['unit_price']) - (float) ($item['discount_amount'] ?? 0), 2);
                $subtotal = round($subtotal + $lineSub, 2);
            }

            $taxableBase = max(0, round($subtotal - $discount, 2));
            $ppn = $this->tax->calculatePpn($taxableBase, $orderDate, $data['tax_rate_code'] ?? null);

            $po = PurchaseOrder::create([
                'po_number' => sprintf('PO-%s-%04d', Carbon::parse($orderDate)->format('Ym'), (PurchaseOrder::max('id') ?? 0) + 1),
                'supplier_id' => $data['supplier_id'],
                'warehouse_id' => $data['warehouse_id'],
                'order_date' => $orderDate,
                'expected_date' => $data['expected_date'] ?? Carbon::parse($orderDate)->addDays(7)->toDateString(),
                'status' => $data['status'] ?? 'waiting_approval',
                'payment_method' => $data['payment_method'] ?? 'credit',
                'subtotal' => $subtotal,
                'discount_amount' => $discount,
                'dpp_amount' => $ppn['dpp_amount'],
                'tax_rate' => $ppn['effective_rate_percent'],
                'tax_amount' => $ppn['tax_amount'],
                'total_amount' => round($taxableBase + $ppn['tax_amount'], 2),
                'notes' => $data['notes'] ?? null,
                'created_by' => $actor->id,
            ]);

            foreach ($data['items'] as $item) {
                $lineSub = round(((float) $item['quantity'] * (float) $item['unit_price']) - (float) ($item['discount_amount'] ?? 0), 2);
                PurchaseOrderItem::create([
                    'purchase_order_id' => $po->id,
                    'product_id' => $item['product_id'],
                    'product_variant_id' => $item['product_variant_id'] ?? null,
                    'quantity' => (float) $item['quantity'],
                    'received_quantity' => 0,
                    'unit_price' => (float) $item['unit_price'],
                    'discount_amount' => (float) ($item['discount_amount'] ?? 0),
                    'subtotal' => $lineSub,
                ]);
            }

            return $po->load('items.product', 'supplier', 'warehouse');
        });
    }

    public function approvePurchaseOrder(PurchaseOrder $po, User $approver): PurchaseOrder
    {
        if (! in_array($po->status, ['draft', 'waiting_approval'], true)) {
            throw ValidationException::withMessages(['status' => ['PO cannot be approved from current status.']]);
        }

        $po->update([
            'status' => 'approved',
            'approved_by' => $approver->id,
            'approved_at' => now(),
        ]);

        return $po->fresh()->load('items.product', 'supplier', 'warehouse');
    }

    /**
     * Goods Receipt -> Stock In (WAC update) + PPN Masukan + AP/Cash + Auto Double-Entry Journal.
     */
    public function receiveGoods(PurchaseOrder $po, array $data, User $actor): GoodsReceipt
    {
        if (! in_array($po->status, ['approved', 'ordered', 'partially_received'], true)) {
            throw ValidationException::withMessages([
                'status' => ['Purchase Order must be approved or ordered before receiving goods.'],
            ]);
        }

        return DB::transaction(function () use ($po, $data, $actor) {
            $po = PurchaseOrder::lockForUpdate()->with(['items', 'supplier'])->findOrFail($po->id);
            $receiptDate = $data['receipt_date'] ?? now()->toDateString();
            $receiptNumber = sprintf('GR-%s-%04d', Carbon::parse($receiptDate)->format('Ym'), (GoodsReceipt::max('id') ?? 0) + 1);

            $receivedSubtotal = 0.0;
            $receipt = GoodsReceipt::create([
                'receipt_number' => $receiptNumber,
                'purchase_order_id' => $po->id,
                'supplier_id' => $po->supplier_id,
                'warehouse_id' => $po->warehouse_id,
                'receipt_date' => $receiptDate,
                'status' => 'received',
                'notes' => $data['notes'] ?? null,
                'received_by' => $actor->id,
            ]);

            $itemsPayload = $data['items'] ?? $po->items->map(fn ($i) => [
                'purchase_order_item_id' => $i->id,
                'product_id' => $i->product_id,
                'product_variant_id' => $i->product_variant_id,
                'quantity_received' => max(0, (float) $i->quantity - (float) $i->received_quantity),
                'unit_cost' => (float) $i->unit_price,
            ])->all();

            foreach ($itemsPayload as $item) {
                $qty = (float) $item['quantity_received'];
                if ($qty <= 0) {
                    continue;
                }
                $unitCost = (float) $item['unit_cost'];
                $lineSub = round($qty * $unitCost, 2);
                $receivedSubtotal = round($receivedSubtotal + $lineSub, 2);

                GoodsReceiptItem::create([
                    'goods_receipt_id' => $receipt->id,
                    'purchase_order_item_id' => $item['purchase_order_item_id'] ?? null,
                    'product_id' => $item['product_id'],
                    'product_variant_id' => $item['product_variant_id'] ?? null,
                    'quantity_received' => $qty,
                    'unit_cost' => $unitCost,
                    'subtotal' => $lineSub,
                ]);

                if (! empty($item['purchase_order_item_id'])) {
                    $poItem = PurchaseOrderItem::find($item['purchase_order_item_id']);
                    if ($poItem) {
                        $poItem->increment('received_quantity', $qty);
                    }
                }

                $this->inventory->stockIn(
                    productId: $item['product_id'],
                    warehouseId: $po->warehouse_id,
                    quantity: $qty,
                    unitCost: $unitCost,
                    referenceNumber: $receiptNumber,
                    movementType: 'purchase',
                    variantId: $item['product_variant_id'] ?? null,
                    referenceType: GoodsReceipt::class,
                    referenceId: $receipt->id,
                    notes: "PO {$po->po_number}",
                    actor: $actor
                );
            }

            if ($receivedSubtotal <= 0) {
                throw ValidationException::withMessages(['items' => ['At least one positive item quantity is required.']]);
            }

            $ppn = $this->tax->calculatePpn($receivedSubtotal, $receiptDate);
            $grandTotal = round($receivedSubtotal + $ppn['tax_amount'], 2);

            $creditCoaCode = '2110';
            $cashAccount = null;
            if ($po->payment_method === 'cash') {
                $cashAccount = FinancialAccount::lockForUpdate()->where('account_type', 'bank')->orWhere('account_type', 'cash')->first();
                if ($cashAccount && (float) $cashAccount->current_balance >= $grandTotal) {
                    $creditCoaCode = $cashAccount->coa->code;
                    $cashAccount->update(['current_balance' => round((float) $cashAccount->current_balance - $grandTotal, 2)]);
                } else {
                    $cashAccount = null;
                }
            }

            $journalLines = [
                ['coa_code' => '1140', 'debit' => $receivedSubtotal, 'credit' => 0, 'memo' => "Persediaan dari {$receiptNumber}"],
            ];
            if ($ppn['tax_amount'] > 0) {
                $journalLines[] = ['coa_code' => '1150', 'debit' => $ppn['tax_amount'], 'credit' => 0, 'memo' => 'PPN Masukan'];
            }
            $journalLines[] = ['coa_code' => $creditCoaCode, 'debit' => 0, 'credit' => $grandTotal, 'memo' => $cashAccount ? 'Pembelian tunai' : 'Hutang Usaha Supplier'];

            $journal = $this->accounting->postJournal(
                entryDate: $receiptDate,
                description: "Penerimaan Barang {$receiptNumber} ({$po->po_number})",
                lines: $journalLines,
                sourceModule: 'procurement',
                sourceType: GoodsReceipt::class,
                sourceId: $receipt->id,
                actor: $actor
            );

            $receipt->update([
                'subtotal' => $receivedSubtotal,
                'tax_amount' => $ppn['tax_amount'],
                'total_amount' => $grandTotal,
                'journal_entry_id' => $journal->id,
            ]);

            if ($ppn['tax_amount'] > 0) {
                $this->tax->recordTaxTransaction(
                    taxTypeCode: 'PPN',
                    direction: 'input',
                    transactionDate: $receiptDate,
                    baseAmount: $receivedSubtotal,
                    dppAmount: $ppn['dpp_amount'],
                    rateApplied: $ppn['effective_rate_percent'],
                    taxAmount: $ppn['tax_amount'],
                    taxRateId: $ppn['tax_rate_id'],
                    sourceType: GoodsReceipt::class,
                    sourceId: $receipt->id,
                    counterpartyName: $po->supplier?->name,
                    counterpartyNpwp: $po->supplier?->npwp,
                    notes: "PPN Masukan {$receiptNumber}"
                );
            }

            $dueDate = Carbon::parse($receiptDate)->addDays($po->supplier?->payment_terms_days ?? 30)->toDateString();
            $invoice = SupplierInvoice::create([
                'invoice_number' => sprintf('SINV-%s-%04d', Carbon::parse($receiptDate)->format('Ym'), (SupplierInvoice::max('id') ?? 0) + 1),
                'purchase_order_id' => $po->id,
                'goods_receipt_id' => $receipt->id,
                'supplier_id' => $po->supplier_id,
                'invoice_date' => $receiptDate,
                'due_date' => $dueDate,
                'subtotal' => $receivedSubtotal,
                'tax_amount' => $ppn['tax_amount'],
                'total_amount' => $grandTotal,
                'paid_amount' => $cashAccount ? $grandTotal : 0,
                'status' => $cashAccount ? 'paid' : 'unpaid',
                'journal_entry_id' => $journal->id,
            ]);

            if (! $cashAccount) {
                AccountsPayable::create([
                    'ap_number' => sprintf('AP-%s-%04d', Carbon::parse($receiptDate)->format('Ym'), (AccountsPayable::max('id') ?? 0) + 1),
                    'supplier_id' => $po->supplier_id,
                    'supplier_invoice_id' => $invoice->id,
                    'purchase_order_id' => $po->id,
                    'issue_date' => $receiptDate,
                    'due_date' => $dueDate,
                    'total_amount' => $grandTotal,
                    'paid_amount' => 0,
                    'balance_amount' => $grandTotal,
                    'status' => 'open',
                ]);
            }

            $po->refresh()->load('items');
            $allReceived = $po->items->every(fn ($i) => (float) $i->received_quantity >= (float) $i->quantity);
            $po->update(['status' => $allReceived ? 'received' : 'partially_received']);

            return $receipt->fresh()->load('items', 'purchaseOrder');
        });
    }
}

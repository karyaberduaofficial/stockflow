<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccountsPayable extends Model
{
    protected $table = 'accounts_payable';

    protected $fillable = [
        'ap_number', 'supplier_id', 'supplier_invoice_id', 'purchase_order_id',
        'issue_date', 'due_date', 'total_amount', 'paid_amount', 'balance_amount', 'status',
    ];

    protected function casts(): array
    {
        return [
            'issue_date' => 'date',
            'due_date' => 'date',
            'total_amount' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'balance_amount' => 'decimal:2',
        ];
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }
}

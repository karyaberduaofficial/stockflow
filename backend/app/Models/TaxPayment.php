<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaxPayment extends Model
{
    protected $fillable = [
        'payment_number', 'tax_type_id', 'tax_period_id', 'financial_account_id',
        'payment_date', 'amount', 'ntpn_code', 'billing_code', 'status',
        'notes', 'created_by', 'journal_entry_id',
    ];

    protected function casts(): array
    {
        return [
            'payment_date' => 'date',
            'amount' => 'decimal:2',
        ];
    }

    public function taxType(): BelongsTo
    {
        return $this->belongsTo(TaxType::class);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaxTransaction extends Model
{
    protected $fillable = [
        'tax_number', 'tax_type_id', 'tax_rate_id', 'tax_period_id', 'direction',
        'transaction_date', 'base_amount', 'dpp_amount', 'tax_rate_applied', 'tax_amount',
        'source_type', 'source_id', 'counterparty_name', 'counterparty_npwp', 'status', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'transaction_date' => 'date',
            'base_amount' => 'decimal:2',
            'dpp_amount' => 'decimal:2',
            'tax_rate_applied' => 'decimal:4',
            'tax_amount' => 'decimal:2',
        ];
    }

    public function taxType(): BelongsTo
    {
        return $this->belongsTo(TaxType::class);
    }

    public function taxRate(): BelongsTo
    {
        return $this->belongsTo(TaxRate::class);
    }
}

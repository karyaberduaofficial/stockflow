<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaxRate extends Model
{
    protected $fillable = [
        'tax_type_id', 'code', 'name', 'rate_percent',
        'dpp_ratio_numerator', 'dpp_ratio_denominator', 'effective_rate_percent',
        'effective_from', 'effective_to', 'is_default', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'rate_percent' => 'decimal:4',
            'effective_rate_percent' => 'decimal:4',
            'effective_from' => 'date',
            'effective_to' => 'date',
            'is_default' => 'boolean',
        ];
    }

    public function taxType(): BelongsTo
    {
        return $this->belongsTo(TaxType::class);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaxPeriod extends Model
{
    protected $fillable = [
        'code', 'tax_type_id', 'year', 'month', 'due_date', 'status',
        'total_output_tax', 'total_input_tax', 'net_tax_payable',
    ];

    protected function casts(): array
    {
        return [
            'due_date' => 'date',
            'total_output_tax' => 'decimal:2',
            'total_input_tax' => 'decimal:2',
            'net_tax_payable' => 'decimal:2',
        ];
    }

    public function taxType(): BelongsTo
    {
        return $this->belongsTo(TaxType::class);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockAdjustmentItem extends Model
{
    protected $fillable = [
        'stock_adjustment_id', 'product_id', 'product_variant_id',
        'system_qty', 'actual_qty', 'variance_qty', 'unit_cost', 'variance_value', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'system_qty' => 'decimal:2',
            'actual_qty' => 'decimal:2',
            'variance_qty' => 'decimal:2',
            'unit_cost' => 'decimal:4',
            'variance_value' => 'decimal:2',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}

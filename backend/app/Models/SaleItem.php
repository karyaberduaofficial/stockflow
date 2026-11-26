<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SaleItem extends Model
{
    protected $table = 'sales_items';

    protected $fillable = [
        'sale_id', 'product_id', 'product_variant_id', 'quantity',
        'unit_price', 'unit_cost', 'discount_amount', 'subtotal', 'cogs_amount',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
            'unit_price' => 'decimal:2',
            'unit_cost' => 'decimal:4',
            'discount_amount' => 'decimal:2',
            'subtotal' => 'decimal:2',
            'cogs_amount' => 'decimal:2',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}

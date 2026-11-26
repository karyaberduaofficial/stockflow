<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SalesReturnItem extends Model
{
    protected $fillable = [
        'sales_return_id', 'sales_item_id', 'product_id', 'product_variant_id',
        'quantity', 'unit_price', 'unit_cost', 'subtotal',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
            'unit_price' => 'decimal:2',
            'unit_cost' => 'decimal:4',
            'subtotal' => 'decimal:2',
        ];
    }
}

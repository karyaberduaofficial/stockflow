<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GoodsReceiptItem extends Model
{
    protected $fillable = [
        'goods_receipt_id', 'purchase_order_item_id', 'product_id',
        'product_variant_id', 'quantity_received', 'unit_cost', 'subtotal',
    ];

    protected function casts(): array
    {
        return [
            'quantity_received' => 'decimal:2',
            'unit_cost' => 'decimal:4',
            'subtotal' => 'decimal:2',
        ];
    }
}

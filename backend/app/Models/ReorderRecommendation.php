<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReorderRecommendation extends Model
{
    protected $fillable = [
        'product_id', 'warehouse_id', 'current_stock', 'avg_daily_demand',
        'lead_time_days', 'safety_stock', 'reorder_point', 'suggested_order_qty',
        'priority', 'status', 'calculated_at',
    ];

    protected function casts(): array
    {
        return [
            'current_stock' => 'decimal:2',
            'avg_daily_demand' => 'decimal:4',
            'safety_stock' => 'decimal:2',
            'reorder_point' => 'decimal:2',
            'suggested_order_qty' => 'decimal:2',
            'calculated_at' => 'datetime',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }
}

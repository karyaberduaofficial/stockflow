<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DemandForecast extends Model
{
    protected $fillable = [
        'product_id', 'warehouse_id', 'forecast_period', 'window_months',
        'historical_demand', 'moving_average_demand', 'recommended_order_qty', 'generated_at',
    ];

    protected function casts(): array
    {
        return [
            'historical_demand' => 'array',
            'moving_average_demand' => 'decimal:2',
            'recommended_order_qty' => 'decimal:2',
            'generated_at' => 'datetime',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}

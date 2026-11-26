<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StockAdjustment extends Model
{
    protected $fillable = [
        'adjustment_number', 'warehouse_id', 'adjustment_date', 'reason',
        'status', 'notes', 'requested_by', 'approved_by', 'approved_at', 'journal_entry_id',
    ];

    protected function casts(): array
    {
        return [
            'adjustment_date' => 'date',
            'approved_at' => 'datetime',
        ];
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(StockAdjustmentItem::class);
    }
}

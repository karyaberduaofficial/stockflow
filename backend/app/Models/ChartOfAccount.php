<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ChartOfAccount extends Model
{
    protected $fillable = [
        'code', 'name', 'account_type', 'normal_balance', 'parent_id',
        'is_header', 'is_system', 'is_active', 'description',
    ];

    protected function casts(): array
    {
        return [
            'is_header' => 'boolean',
            'is_system' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(ChartOfAccount::class, 'parent_id');
    }

    public function journalDetails(): HasMany
    {
        return $this->hasMany(JournalEntryDetail::class, 'coa_id');
    }
}

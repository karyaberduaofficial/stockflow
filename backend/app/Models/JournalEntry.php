<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use RuntimeException;

class JournalEntry extends Model
{
    protected $fillable = [
        'journal_number', 'accounting_period_id', 'entry_date', 'description',
        'source_module', 'source_type', 'source_id', 'total_debit', 'total_credit',
        'status', 'reversed_by_journal_id', 'reverses_journal_id', 'is_immutable',
        'created_by', 'posted_by', 'posted_at',
    ];

    protected function casts(): array
    {
        return [
            'entry_date' => 'date',
            'total_debit' => 'decimal:2',
            'total_credit' => 'decimal:2',
            'is_immutable' => 'boolean',
            'posted_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::updating(function (self $entry) {
            if ($entry->getOriginal('status') === 'posted' && $entry->getOriginal('is_immutable')) {
                $dirty = array_keys($entry->getDirty());
                $allowedReversalFields = ['status', 'reversed_by_journal_id', 'updated_at'];
                $disallowed = array_diff($dirty, $allowedReversalFields);
                if (! empty($disallowed) || ($entry->status !== 'reversed' && $entry->status !== 'posted')) {
                    throw new RuntimeException('Posted journal entries are immutable. Use reversal entries to correct.');
                }
            }
        });

        static::deleting(function (self $entry) {
            if ($entry->is_immutable && in_array($entry->status, ['posted', 'reversed'], true)) {
                throw new RuntimeException('Posted journal entries cannot be deleted.');
            }
        });
    }

    public function period(): BelongsTo
    {
        return $this->belongsTo(AccountingPeriod::class, 'accounting_period_id');
    }

    public function details(): HasMany
    {
        return $this->hasMany(JournalEntryDetail::class);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use RuntimeException;

class ActivityLog extends Model
{
    protected $fillable = [
        'user_id',
        'role',
        'action',
        'module',
        'severity',
        'http_method',
        'route',
        'ip_address',
        'user_agent',
        'subject_type',
        'subject_id',
        'old_values',
        'new_values',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'old_values' => 'array',
            'new_values' => 'array',
            'metadata' => 'array',
        ];
    }

    protected static function booted(): void
    {
        static::updating(function () {
            throw new RuntimeException('Activity logs are immutable and cannot be modified.');
        });

        static::deleting(function () {
            throw new RuntimeException('Activity logs are immutable and cannot be deleted.');
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

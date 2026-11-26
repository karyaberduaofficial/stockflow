<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AccountingPeriod extends Model
{
    protected $fillable = [
        'code', 'name', 'start_date', 'end_date', 'status', 'closed_by', 'closed_at',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'closed_at' => 'datetime',
        ];
    }

    public function isLocked(): bool
    {
        return in_array($this->status, ['closed', 'locked'], true);
    }
}

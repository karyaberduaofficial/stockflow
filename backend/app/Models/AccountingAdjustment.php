<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AccountingAdjustment extends Model
{
    protected $fillable = [
        'adjustment_number', 'accounting_period_id', 'adjustment_date',
        'adjustment_type', 'description', 'journal_entry_id', 'created_by',
    ];

    protected function casts(): array
    {
        return ['adjustment_date' => 'date'];
    }
}

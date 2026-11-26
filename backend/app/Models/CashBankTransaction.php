<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CashBankTransaction extends Model
{
    protected $fillable = [
        'reference_number', 'transaction_type', 'from_account_id', 'to_account_id',
        'transaction_date', 'amount', 'is_internal_transfer', 'description',
        'source_type', 'source_id', 'created_by', 'journal_entry_id',
    ];

    protected function casts(): array
    {
        return [
            'transaction_date' => 'date',
            'amount' => 'decimal:2',
            'is_internal_transfer' => 'boolean',
        ];
    }
}

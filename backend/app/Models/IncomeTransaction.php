<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IncomeTransaction extends Model
{
    protected $fillable = [
        'reference_number', 'financial_account_id', 'coa_id', 'transaction_date',
        'category', 'amount', 'description', 'source_type', 'source_id', 'created_by', 'journal_entry_id',
    ];

    protected function casts(): array
    {
        return [
            'transaction_date' => 'date',
            'amount' => 'decimal:2',
        ];
    }
}

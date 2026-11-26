<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ExpenseTransaction extends Model
{
    protected $fillable = [
        'reference_number', 'financial_account_id', 'coa_id', 'transaction_date',
        'category', 'vendor_name', 'amount', 'description', 'status',
        'created_by', 'approved_by', 'journal_entry_id',
    ];

    protected function casts(): array
    {
        return [
            'transaction_date' => 'date',
            'amount' => 'decimal:2',
        ];
    }
}

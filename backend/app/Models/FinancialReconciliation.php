<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FinancialReconciliation extends Model
{
    protected $fillable = [
        'financial_account_id', 'reconciliation_date', 'statement_balance',
        'book_balance', 'difference', 'status', 'notes', 'reconciled_by',
    ];

    protected function casts(): array
    {
        return [
            'reconciliation_date' => 'date',
            'statement_balance' => 'decimal:2',
            'book_balance' => 'decimal:2',
            'difference' => 'decimal:2',
        ];
    }
}

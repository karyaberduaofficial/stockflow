<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CustomerPayment extends Model
{
    protected $fillable = [
        'payment_number', 'sale_id', 'customer_id', 'financial_account_id',
        'payment_date', 'amount', 'payment_method', 'reference', 'notes', 'created_by', 'journal_entry_id',
    ];

    protected function casts(): array
    {
        return [
            'payment_date' => 'date',
            'amount' => 'decimal:2',
        ];
    }
}

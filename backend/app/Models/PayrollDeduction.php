<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PayrollDeduction extends Model
{
    protected $fillable = ['payroll_id', 'code', 'name', 'category', 'amount'];

    protected function casts(): array
    {
        return ['amount' => 'decimal:2'];
    }
}

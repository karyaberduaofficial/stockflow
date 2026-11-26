<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PayrollDetail extends Model
{
    protected $fillable = ['payroll_id', 'salary_component_id', 'component_name', 'type', 'amount'];

    protected function casts(): array
    {
        return ['amount' => 'decimal:2'];
    }
}

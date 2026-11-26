<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PayrollPeriod extends Model
{
    protected $fillable = [
        'code', 'name', 'year', 'month', 'start_date', 'end_date', 'payment_date', 'status',
        'total_gross', 'total_employee_deductions', 'total_employer_bpjs', 'total_pph21', 'total_net',
        'hr_checked_by', 'hr_checked_at', 'manager_approved_by', 'manager_approved_at',
        'finance_paid_by', 'finance_paid_at', 'journal_entry_id',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'payment_date' => 'date',
            'total_gross' => 'decimal:2',
            'total_employee_deductions' => 'decimal:2',
            'total_employer_bpjs' => 'decimal:2',
            'total_pph21' => 'decimal:2',
            'total_net' => 'decimal:2',
            'hr_checked_at' => 'datetime',
            'manager_approved_at' => 'datetime',
            'finance_paid_at' => 'datetime',
        ];
    }

    public function payrolls(): HasMany
    {
        return $this->hasMany(Payroll::class);
    }
}

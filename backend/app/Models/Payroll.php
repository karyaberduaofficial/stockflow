<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Payroll extends Model
{
    protected $fillable = [
        'payslip_number', 'payroll_period_id', 'employee_id', 'working_days', 'present_days',
        'overtime_hours', 'base_salary', 'total_allowances', 'overtime_pay', 'gross_salary',
        'pph21_ter_rate', 'pph21_amount', 'bpjs_employee_total', 'bpjs_employer_total',
        'other_deductions', 'total_deductions', 'net_salary', 'status', 'paid_at',
    ];

    protected function casts(): array
    {
        return [
            'overtime_hours' => 'decimal:2',
            'base_salary' => 'decimal:2',
            'total_allowances' => 'decimal:2',
            'overtime_pay' => 'decimal:2',
            'gross_salary' => 'decimal:2',
            'pph21_ter_rate' => 'decimal:4',
            'pph21_amount' => 'decimal:2',
            'bpjs_employee_total' => 'decimal:2',
            'bpjs_employer_total' => 'decimal:2',
            'other_deductions' => 'decimal:2',
            'total_deductions' => 'decimal:2',
            'net_salary' => 'decimal:2',
            'paid_at' => 'datetime',
        ];
    }

    public function period(): BelongsTo
    {
        return $this->belongsTo(PayrollPeriod::class, 'payroll_period_id');
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function details(): HasMany
    {
        return $this->hasMany(PayrollDetail::class);
    }

    public function deductions(): HasMany
    {
        return $this->hasMany(PayrollDeduction::class);
    }
}

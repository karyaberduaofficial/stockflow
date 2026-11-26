<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeBpjs extends Model
{
    protected $table = 'employee_bpjs';

    protected $fillable = [
        'employee_id', 'bpjs_kesehatan_number', 'bpjs_ketenagakerjaan_number',
        'kesehatan_employee_rate', 'kesehatan_employer_rate',
        'jht_employee_rate', 'jht_employer_rate',
        'jp_employee_rate', 'jp_employer_rate',
        'jkk_employer_rate', 'jkm_employer_rate',
        'kesehatan_salary_cap', 'jp_salary_cap', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'kesehatan_employee_rate' => 'decimal:4',
            'kesehatan_employer_rate' => 'decimal:4',
            'jht_employee_rate' => 'decimal:4',
            'jht_employer_rate' => 'decimal:4',
            'jp_employee_rate' => 'decimal:4',
            'jp_employer_rate' => 'decimal:4',
            'jkk_employer_rate' => 'decimal:4',
            'jkm_employer_rate' => 'decimal:4',
            'kesehatan_salary_cap' => 'decimal:2',
            'jp_salary_cap' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Employee extends Model
{
    protected $fillable = [
        'employee_code', 'user_id', 'department_id', 'position_id', 'full_name',
        'email', 'phone', 'nik', 'npwp', 'bank_name', 'bank_account_number',
        'bank_account_holder', 'ptkp_status', 'ter_category', 'base_salary',
        'join_date', 'employment_status', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'nik' => 'encrypted',
            'npwp' => 'encrypted',
            'bank_account_number' => 'encrypted',
            'base_salary' => 'decimal:2',
            'join_date' => 'date',
            'is_active' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function position(): BelongsTo
    {
        return $this->belongsTo(Position::class);
    }

    public function bpjs(): HasOne
    {
        return $this->hasOne(EmployeeBpjs::class);
    }

    public function salaryComponents(): HasMany
    {
        return $this->hasMany(EmployeeSalaryComponent::class);
    }

    public function payrolls(): HasMany
    {
        return $this->hasMany(Payroll::class);
    }

    public static function maskSensitive(?string $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        $clean = trim($value);
        $len = strlen($clean);
        if ($len <= 4) {
            return str_repeat('*', $len);
        }

        return str_repeat('*', max(4, $len - 4)).substr($clean, -4);
    }

    public function toScopedArray(bool $revealPii = false): array
    {
        return [
            'id' => $this->id,
            'employee_code' => $this->employee_code,
            'user_id' => $this->user_id,
            'department_id' => $this->department_id,
            'department' => $this->relationLoaded('department') ? $this->department?->name : null,
            'position_id' => $this->position_id,
            'position' => $this->relationLoaded('position') ? $this->position?->title : null,
            'full_name' => $this->full_name,
            'email' => $this->email,
            'phone' => $this->phone,
            'nik' => $revealPii ? $this->nik : self::maskSensitive($this->nik),
            'npwp' => $revealPii ? $this->npwp : self::maskSensitive($this->npwp),
            'bank_name' => $this->bank_name,
            'bank_account_number' => $revealPii ? $this->bank_account_number : self::maskSensitive($this->bank_account_number),
            'bank_account_holder' => $this->bank_account_holder,
            'ptkp_status' => $this->ptkp_status,
            'ter_category' => $this->ter_category,
            'base_salary' => (float) $this->base_salary,
            'join_date' => $this->join_date?->toDateString(),
            'employment_status' => $this->employment_status,
            'is_active' => $this->is_active,
            'pii_masked' => ! $revealPii,
        ];
    }
}

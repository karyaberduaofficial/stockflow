<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeAttendance extends Model
{
    protected $fillable = [
        'employee_id', 'attendance_date', 'check_in', 'check_out',
        'status', 'overtime_hours', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'attendance_date' => 'date',
            'overtime_hours' => 'decimal:2',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }
}

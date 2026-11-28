<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AttendanceRecord extends Model
{
    protected $fillable = [
        'user_id',
        'employee_id',
        'full_name',
        'employee_code',
        'role_slug',
        'department',
        'work_location',
        'shift',
        'attendance_type',
        'status',
        'attendance_date',
        'attendance_time',
        'latitude',
        'longitude',
        'accuracy_m',
        'location_address',
        'captured_at',
        'photo_path',
        'photo_mime',
        'notes',
        'ip_address',
    ];

    protected function casts(): array
    {
        return [
            'attendance_date' => 'date:Y-m-d',
            'latitude' => 'float',
            'longitude' => 'float',
            'accuracy_m' => 'float',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }
}

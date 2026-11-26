<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Position extends Model
{
    protected $fillable = [
        'department_id', 'code', 'title', 'base_salary_min', 'base_salary_max', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'base_salary_min' => 'decimal:2',
            'base_salary_max' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }
}

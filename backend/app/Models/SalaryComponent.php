<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SalaryComponent extends Model
{
    protected $fillable = ['code', 'name', 'type', 'is_taxable', 'default_amount', 'is_active'];

    protected function casts(): array
    {
        return [
            'is_taxable' => 'boolean',
            'default_amount' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }
}

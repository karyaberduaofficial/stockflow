<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Supplier extends Model
{
    protected $fillable = [
        'code', 'name', 'contact_person', 'email', 'phone', 'address', 'city',
        'npwp', 'payment_terms_days', 'rating', 'on_time_delivery_rate', 'quality_score', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'rating' => 'decimal:2',
            'on_time_delivery_rate' => 'decimal:2',
            'quality_score' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }
}

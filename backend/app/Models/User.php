<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * Strictly allow only non-privileged profile attributes for mass assignment.
     * Privileged fields (primary_role, status, google_id, approved_by, approved_at)
     * MUST ONLY be mutated explicitly inside Admin/Auth services.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'phone',
        'avatar',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'locked_until' => 'datetime',
            'last_login_at' => 'datetime',
            'approved_at' => 'datetime',
        ];
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'user_roles')
            ->withPivot(['assigned_by', 'assigned_at'])
            ->withTimestamps();
    }

    public function employee(): HasOne
    {
        return $this->hasOne(Employee::class);
    }

    public function getRoleSlugs(): array
    {
        $slugs = $this->roles()->pluck('slug')->all();
        if ($this->primary_role && ! in_array($this->primary_role, $slugs, true)) {
            $slugs[] = $this->primary_role;
        }

        return array_values(array_unique($slugs));
    }

    public function hasRole(string $slug): bool
    {
        return $this->primary_role === $slug || in_array($slug, $this->getRoleSlugs(), true);
    }

    public function hasAnyRole(array $slugs): bool
    {
        if (in_array($this->primary_role, $slugs, true)) {
            return true;
        }

        return count(array_intersect($this->getRoleSlugs(), $slugs)) > 0;
    }

    public function hasPermission(string $permissionSlug): bool
    {
        if ($this->primary_role === 'guest_pending' || $this->status !== 'active') {
            return false;
        }

        if ($this->primary_role === 'admin') {
            return true;
        }

        return Permission::query()
            ->where('slug', $permissionSlug)
            ->whereHas('roles', function ($q) {
                $q->where('slug', $this->primary_role)
                    ->orWhereIn('roles.id', $this->roles()->pluck('roles.id'));
            })
            ->exists();
    }

    public function getPermissionSlugs(): array
    {
        if ($this->primary_role === 'guest_pending' || $this->status !== 'active') {
            return [];
        }

        if ($this->primary_role === 'admin') {
            return Permission::query()->pluck('slug')->all();
        }

        return Permission::query()
            ->whereHas('roles', function ($q) {
                $q->where('slug', $this->primary_role)
                    ->orWhereIn('roles.id', $this->roles()->pluck('roles.id'));
            })
            ->pluck('slug')
            ->unique()
            ->values()
            ->all();
    }

    public function syncSingleRole(string $roleSlug, ?int $assignedBy = null): void
    {
        $role = Role::where('slug', $roleSlug)->firstOrFail();
        $this->forceFill(['primary_role' => $role->slug])->save();
        $this->roles()->sync([
            $role->id => [
                'assigned_by' => $assignedBy,
                'assigned_at' => now(),
            ],
        ]);
    }
}

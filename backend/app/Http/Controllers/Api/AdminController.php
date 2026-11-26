<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Permission;
use App\Models\Role;
use App\Models\SystemSetting;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminController extends Controller
{
    public function listUsers(Request $request): JsonResponse
    {
        $query = User::with('roles');

        if ($request->filled('role')) {
            $query->where('primary_role', $request->string('role'));
        }
        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        return response()->json([
            'data' => $query->orderByDesc('id')->get(),
        ]);
    }

    public function createUser(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'phone' => ['nullable', 'string', 'max:32'],
            'role' => ['required', 'string', 'exists:roles,slug'],
            'status' => ['sometimes', Rule::in(['active', 'pending_approval', 'suspended', 'inactive'])],
        ]);

        $user = new User;
        $user->forceFill([
            'name' => $validated['name'],
            'email' => strtolower($validated['email']),
            'password' => $validated['password'],
            'phone' => $validated['phone'] ?? null,
            'status' => $validated['status'] ?? 'active',
            'primary_role' => $validated['role'],
            'email_verified_at' => now(),
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
        ])->save();

        $user->syncSingleRole($validated['role'], $request->user()->id);

        AuditLogger::log('ADMIN_USER_CREATED', 'admin', 'info', $request->user(), $request, User::class, $user->id, null, [
            'email' => $user->email,
            'role' => $user->primary_role,
        ]);

        return response()->json(['data' => $user->fresh()->load('roles')], 201);
    }

    public function updateUser(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:32'],
            'role' => ['sometimes', 'string', 'exists:roles,slug'],
            'status' => ['sometimes', Rule::in(['active', 'pending_approval', 'suspended', 'inactive'])],
        ]);

        $old = ['primary_role' => $user->primary_role, 'status' => $user->status];

        $user->forceFill(array_filter([
            'name' => $validated['name'] ?? null,
            'phone' => $validated['phone'] ?? null,
            'status' => $validated['status'] ?? null,
        ], fn ($v) => $v !== null))->save();

        if (! empty($validated['role'])) {
            $user->syncSingleRole($validated['role'], $request->user()->id);
        }

        AuditLogger::log('ADMIN_USER_UPDATED', 'admin', 'info', $request->user(), $request, User::class, $user->id, $old, [
            'primary_role' => $user->primary_role,
            'status' => $user->status,
        ]);

        return response()->json(['data' => $user->fresh()->load('roles')]);
    }

    public function approveUser(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'role' => [
                'required',
                'string',
                'exists:roles,slug',
                Rule::notIn(['guest_pending']),
            ],
        ]);

        $old = ['primary_role' => $user->primary_role, 'status' => $user->status];

        $user->forceFill([
            'status' => 'active',
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
        ])->save();

        $user->syncSingleRole($validated['role'], $request->user()->id);

        AuditLogger::log('ADMIN_USER_APPROVED', 'admin', 'info', $request->user(), $request, User::class, $user->id, $old, [
            'primary_role' => $validated['role'],
            'status' => 'active',
        ]);

        return response()->json([
            'message' => 'User approved and role assigned.',
            'data' => $user->fresh()->load('roles'),
        ]);
    }

    public function suspendUser(Request $request, User $user): JsonResponse
    {
        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'Cannot suspend your own administrator account.'], 422);
        }

        $user->forceFill(['status' => 'suspended'])->save();
        $user->tokens()->delete();

        AuditLogger::log('ADMIN_USER_SUSPENDED', 'admin', 'warning', $request->user(), $request, User::class, $user->id);

        return response()->json(['message' => 'User suspended and active tokens revoked.']);
    }

    public function listRoles(): JsonResponse
    {
        return response()->json([
            'roles' => Role::with('permissions')->orderBy('id')->get(),
            'permissions' => Permission::orderBy('module')->orderBy('slug')->get(),
        ]);
    }

    public function updateRolePermissions(Request $request, Role $role): JsonResponse
    {
        if ($role->slug === 'guest_pending') {
            return response()->json(['message' => 'Quarantined guest_pending role cannot be granted permissions.'], 422);
        }

        $validated = $request->validate([
            'permission_ids' => ['required', 'array'],
            'permission_ids.*' => ['integer', 'exists:permissions,id'],
        ]);

        $role->permissions()->sync($validated['permission_ids']);

        AuditLogger::log('ADMIN_ROLE_PERMISSIONS_UPDATED', 'admin', 'info', $request->user(), $request, Role::class, $role->id);

        return response()->json(['data' => $role->fresh()->load('permissions')]);
    }

    public function listSettings(): JsonResponse
    {
        return response()->json(['data' => SystemSetting::orderBy('group')->orderBy('key')->get()]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'settings' => ['required', 'array', 'min:1'],
            'settings.*.key' => ['required', 'string', 'max:80'],
            'settings.*.value' => ['nullable', 'string'],
            'settings.*.group' => ['sometimes', 'string', 'max:40'],
        ]);

        foreach ($validated['settings'] as $item) {
            SystemSetting::updateOrCreate(
                ['key' => $item['key']],
                [
                    'group' => $item['group'] ?? 'general',
                    'value' => $item['value'] ?? '',
                    'updated_by' => $request->user()->id,
                ]
            );
        }

        AuditLogger::log('ADMIN_SETTINGS_UPDATED', 'admin', 'info', $request->user(), $request);

        return response()->json(['data' => SystemSetting::orderBy('group')->orderBy('key')->get()]);
    }

    public function activityLogs(Request $request): JsonResponse
    {
        $query = ActivityLog::with('user:id,name,email,primary_role')->orderByDesc('id');

        if ($request->filled('severity')) {
            $query->where('severity', $request->string('severity'));
        }
        if ($request->filled('module')) {
            $query->where('module', $request->string('module'));
        }

        return response()->json([
            'data' => $query->limit(200)->get(),
        ]);
    }
}

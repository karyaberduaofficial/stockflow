<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Http\Request;

class AuditLogger
{
    public static function log(
        string $action,
        string $module,
        string $severity = 'info',
        ?User $user = null,
        ?Request $request = null,
        ?string $subjectType = null,
        int|string|null $subjectId = null,
        ?array $oldValues = null,
        ?array $newValues = null,
        array $metadata = []
    ): ActivityLog {
        $req = $request ?? request();
        $actor = $user ?? $req?->user();

        return ActivityLog::create([
            'user_id' => $actor?->id,
            'role' => $actor?->primary_role ?? 'anonymous',
            'action' => $action,
            'module' => $module,
            'severity' => $severity,
            'http_method' => $req?->method(),
            'route' => $req ? '/'.ltrim($req->path(), '/') : null,
            'ip_address' => $req?->ip(),
            'user_agent' => substr((string) ($req?->userAgent() ?? ''), 0, 255),
            'subject_type' => $subjectType,
            'subject_id' => $subjectId !== null ? (string) $subjectId : null,
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'metadata' => $metadata,
        ]);
    }

    public static function logForbidden(
        Request $request,
        string $reason,
        string $module = 'security',
        array $metadata = []
    ): ActivityLog {
        return self::log(
            action: 'RBAC_FORBIDDEN_ATTEMPT',
            module: $module,
            severity: 'warning',
            user: $request->user(),
            request: $request,
            metadata: array_merge(['reason' => $reason], $metadata)
        );
    }
}

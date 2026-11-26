<?php

namespace App\Http\Middleware;

use App\Services\AuditLogger;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckPermission
{
    public function handle(Request $request, Closure $next, string ...$requiredPermissions): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'message' => 'Unauthenticated.',
                'error_code' => 'UNAUTHENTICATED',
            ], 401);
        }

        foreach ($requiredPermissions as $permission) {
            if ($user->hasPermission($permission)) {
                return $next($request);
            }
        }

        AuditLogger::logForbidden(
            $request,
            'Permission denied for endpoint.',
            'rbac',
            ['required_permissions' => $requiredPermissions, 'actual_role' => $user->primary_role]
        );

        return response()->json([
            'message' => 'Forbidden: missing required permission.',
            'error_code' => 'INSUFFICIENT_PERMISSION',
            'required_permissions' => $requiredPermissions,
        ], 403);
    }
}

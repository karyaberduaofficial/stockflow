<?php

namespace App\Http\Middleware;

use App\Services\AuditLogger;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckRole
{
    public function handle(Request $request, Closure $next, string ...$allowedRoles): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'message' => 'Unauthenticated.',
                'error_code' => 'UNAUTHENTICATED',
            ], 401);
        }

        $roles = [];
        foreach ($allowedRoles as $chunk) {
            foreach (explode('|', $chunk) as $part) {
                $trimmed = trim($part);
                if ($trimmed !== '') {
                    $roles[] = $trimmed;
                }
            }
        }

        if (! $user->hasAnyRole($roles)) {
            AuditLogger::logForbidden(
                $request,
                'Role not permitted for this endpoint.',
                'rbac',
                ['required_roles' => $roles, 'actual_role' => $user->primary_role]
            );

            return response()->json([
                'message' => 'Forbidden: insufficient role privileges.',
                'error_code' => 'INSUFFICIENT_ROLE',
                'required_roles' => $roles,
            ], 403);
        }

        return $next($request);
    }
}

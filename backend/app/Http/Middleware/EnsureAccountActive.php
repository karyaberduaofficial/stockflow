<?php

namespace App\Http\Middleware;

use App\Services\AuditLogger;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureAccountActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'message' => 'Unauthenticated.',
                'error_code' => 'UNAUTHENTICATED',
            ], 401);
        }

        if ($user->primary_role === 'guest_pending' || $user->status === 'pending_approval') {
            AuditLogger::logForbidden(
                $request,
                'Quarantined guest_pending account attempted to access protected endpoint.',
                'auth_quarantine',
                ['user_status' => $user->status, 'primary_role' => $user->primary_role]
            );

            return response()->json([
                'message' => 'Account is pending administrator approval. Access to business modules is denied.',
                'error_code' => 'ACCOUNT_PENDING_APPROVAL',
            ], 403);
        }

        if ($user->status !== 'active') {
            AuditLogger::logForbidden(
                $request,
                'Inactive or suspended account attempted API access.',
                'auth_status',
                ['user_status' => $user->status]
            );

            return response()->json([
                'message' => 'Account is not active.',
                'error_code' => 'ACCOUNT_INACTIVE',
            ], 403);
        }

        return $next($request);
    }
}

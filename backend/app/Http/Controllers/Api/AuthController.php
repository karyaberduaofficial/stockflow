<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\GoogleOAuthService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;

class AuthController extends Controller
{
    public function __construct(private readonly GoogleOAuthService $googleOAuth) {}

    public function healthz(): JsonResponse
    {
        $dbOk = true;
        try {
            DB::select('SELECT 1');
        } catch (\Throwable) {
            $dbOk = false;
        }

        return response()->json([
            'status' => $dbOk ? 'ok' : 'degraded',
            'service' => 'StockFlow v2.0 API',
            'database' => $dbOk ? 'connected' : 'error',
            'timestamp' => now()->toIso8601String(),
        ], $dbOk ? 200 : 503);
    }

    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', strtolower($credentials['email']))->first();

        if (! $user) {
            AuditLogger::log('AUTH_LOGIN_FAILED', 'auth', 'warning', null, $request, null, null, null, null, [
                'email' => $credentials['email'],
                'reason' => 'user_not_found',
            ]);

            return response()->json([
                'message' => 'Invalid email or password.',
                'error_code' => 'INVALID_CREDENTIALS',
            ], 401);
        }

        if ($user->locked_until && now()->lessThan($user->locked_until)) {
            AuditLogger::log('AUTH_LOGIN_LOCKED', 'auth', 'warning', $user, $request);

            return response()->json([
                'message' => 'Account temporarily locked due to repeated failed attempts. Try again later.',
                'error_code' => 'ACCOUNT_LOCKED',
                'locked_until' => $user->locked_until->toIso8601String(),
            ], 423);
        }

        if (! Hash::check($credentials['password'], $user->password)) {
            $attempts = $user->failed_login_attempts + 1;
            $lockedUntil = $attempts >= 5 ? now()->addMinutes(15) : null;
            $user->forceFill([
                'failed_login_attempts' => $attempts,
                'locked_until' => $lockedUntil,
            ])->save();

            AuditLogger::log('AUTH_LOGIN_FAILED', 'auth', 'warning', $user, $request, User::class, $user->id, null, null, [
                'failed_attempts' => $attempts,
                'locked' => $lockedUntil !== null,
            ]);

            return response()->json([
                'message' => 'Invalid email or password.',
                'error_code' => 'INVALID_CREDENTIALS',
            ], 401);
        }

        if (in_array($user->status, ['suspended', 'inactive'], true)) {
            AuditLogger::log('AUTH_LOGIN_BLOCKED_INACTIVE', 'auth', 'warning', $user, $request);

            return response()->json([
                'message' => 'Your account is suspended or inactive.',
                'error_code' => 'ACCOUNT_INACTIVE',
            ], 403);
        }

        $user->forceFill([
            'failed_login_attempts' => 0,
            'locked_until' => null,
            'last_login_at' => now(),
        ])->save();

        // Rotate: revoke expired/previous tokens of same device name
        $user->tokens()->where('name', 'stockflow-web')->delete();
        $token = $user->createToken('stockflow-web', [$user->primary_role])->plainTextToken;

        AuditLogger::log('AUTH_LOGIN_SUCCESS', 'auth', 'info', $user, $request, User::class, $user->id);

        return response()->json([
            'token' => $token,
            'token_type' => 'Bearer',
            'user' => $this->formatUser($user),
            'quarantined' => $user->primary_role === 'guest_pending' || $user->status === 'pending_approval',
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'user' => $this->formatUser($request->user()),
        ]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:32'],
            'avatar' => ['sometimes', 'nullable', 'url', 'max:255'],
        ]);

        /** @var User $user */
        $user = $request->user();
        // Explicitly fill ONLY non-privileged fields (role/status cannot be mass-assigned!)
        $user->fill($validated);
        $user->save();

        AuditLogger::log('AUTH_PROFILE_UPDATED', 'auth', 'info', $user, $request, User::class, $user->id);

        return response()->json([
            'message' => 'Profile updated.',
            'user' => $this->formatUser($user->fresh()),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->currentAccessToken()?->delete();

        AuditLogger::log('AUTH_LOGOUT', 'auth', 'info', $user, $request, User::class, $user->id);

        return response()->json(['message' => 'Logged out successfully.']);
    }

    public function rotateToken(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->currentAccessToken()?->delete();
        $newToken = $user->createToken('stockflow-web', [$user->primary_role])->plainTextToken;

        AuditLogger::log('AUTH_TOKEN_ROTATED', 'auth', 'info', $user, $request, User::class, $user->id);

        return response()->json([
            'token' => $newToken,
            'token_type' => 'Bearer',
        ]);
    }

    public function requestPasswordReset(Request $request): JsonResponse
    {
        $validated = $request->validate(['email' => ['required', 'email']]);
        $email = strtolower($validated['email']);
        $user = User::where('email', $email)->first();

        if ($user) {
            $token = Str::random(64);
            DB::table('password_reset_tokens')->updateOrInsert(
                ['email' => $email],
                ['token' => Hash::make($token), 'created_at' => now()]
            );
            AuditLogger::log('AUTH_PASSWORD_RESET_REQUESTED', 'auth', 'info', $user, $request);
        }

        // Anti-enumeration generic message
        return response()->json([
            'message' => 'If an account with that email exists, password reset instructions have been issued.',
        ]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'token' => ['required', 'string'],
            'password' => ['required', 'string', 'min:10', 'confirmed'],
        ]);

        $email = strtolower($validated['email']);
        $record = DB::table('password_reset_tokens')->where('email', $email)->first();

        if (! $record || ! Hash::check($validated['token'], $record->token)) {
            return response()->json(['message' => 'Invalid or expired reset token.'], 422);
        }

        if ($record->created_at && Carbon::parse($record->created_at)->addMinutes(60)->isPast()) {
            DB::table('password_reset_tokens')->where('email', $email)->delete();

            return response()->json(['message' => 'Invalid or expired reset token.'], 422);
        }

        $user = User::where('email', $email)->firstOrFail();
        $user->forceFill(['password' => $validated['password']])->save();
        $user->tokens()->delete();
        DB::table('password_reset_tokens')->where('email', $email)->delete();

        AuditLogger::log('AUTH_PASSWORD_RESET_COMPLETED', 'auth', 'info', $user, $request);

        return response()->json(['message' => 'Password has been reset. All previous sessions were revoked.']);
    }

    public function googleRedirect(): JsonResponse
    {
        $payload = $this->googleOAuth->buildRedirectUrl();

        return response()->json($payload);
    }

    public function googleCallback(Request $request): JsonResponse
    {
        $state = $request->query('state');
        if (! $this->googleOAuth->validateState($state)) {
            AuditLogger::log('GOOGLE_OAUTH_INVALID_STATE', 'auth', 'warning', null, $request);

            return response()->json([
                'message' => 'Invalid or expired OAuth state parameter (CSRF check failed).',
                'error_code' => 'OAUTH_INVALID_STATE',
            ], 403);
        }

        try {
            $socialUser = Socialite::driver('google')->stateless()->user();
            $rawUser = is_array($socialUser->user ?? null) ? $socialUser->user : [];
            $emailVerified = filter_var($rawUser['email_verified'] ?? false, FILTER_VALIDATE_BOOLEAN);
            if (! $emailVerified || empty($socialUser->getEmail())) {
                return response()->json([
                    'message' => 'Google account email must be verified.',
                    'error_code' => 'OAUTH_EMAIL_UNVERIFIED',
                ], 403);
            }

            $user = $this->googleOAuth->findOrQuarantineUser([
                'sub' => (string) $socialUser->getId(),
                'email' => strtolower($socialUser->getEmail()),
                'name' => $socialUser->getName() ?: $socialUser->getEmail(),
                'picture' => $socialUser->getAvatar(),
                'email_verified' => true,
            ]);
        } catch (\Throwable $e) {
            AuditLogger::log('GOOGLE_OAUTH_CALLBACK_FAILED', 'auth', 'warning', null, $request, null, null, null, null, [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Google OAuth callback authentication failed.',
                'error_code' => 'OAUTH_FAILED',
            ], 401);
        }

        if (in_array($user->status, ['suspended', 'inactive'], true)) {
            AuditLogger::log('GOOGLE_OAUTH_BLOCKED_INACTIVE', 'auth', 'warning', $user, $request);

            return response()->json([
                'message' => 'Account is suspended or inactive.',
                'error_code' => 'ACCOUNT_INACTIVE',
            ], 403);
        }

        $token = $user->createToken('stockflow-google', [$user->primary_role])->plainTextToken;

        return response()->json([
            'token' => $token,
            'token_type' => 'Bearer',
            'user' => $this->formatUser($user),
            'quarantined' => $user->primary_role === 'guest_pending',
        ]);
    }

    public function googleTokenLogin(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'id_token' => ['required', 'string'],
        ]);

        $profile = $this->googleOAuth->verifyIdToken($validated['id_token']);
        $user = $this->googleOAuth->findOrQuarantineUser($profile);

        if (in_array($user->status, ['suspended', 'inactive'], true)) {
            return response()->json([
                'message' => 'Account is suspended or inactive.',
                'error_code' => 'ACCOUNT_INACTIVE',
            ], 403);
        }

        $token = $user->createToken('stockflow-google', [$user->primary_role])->plainTextToken;

        AuditLogger::log('GOOGLE_OAUTH_TOKEN_LOGIN', 'auth', 'info', $user, $request, User::class, $user->id, null, null, [
            'quarantined' => $user->primary_role === 'guest_pending',
        ]);

        return response()->json([
            'token' => $token,
            'token_type' => 'Bearer',
            'user' => $this->formatUser($user),
            'quarantined' => $user->primary_role === 'guest_pending',
        ]);
    }

    public function logClientForbiddenAttempt(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'route' => ['required', 'string', 'max:255'],
            'role' => ['nullable', 'string', 'max:40'],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        AuditLogger::logForbidden(
            $request,
            $validated['reason'] ?? 'Client-side unauthorized navigation attempt.',
            'rbac_ui',
            ['attempted_ui_route' => $validated['route']]
        );

        return response()->json(['recorded' => true], 201);
    }

    private function formatUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'avatar' => $user->avatar,
            'google_connected' => ! empty($user->google_id),
            'status' => $user->status,
            'role' => $user->primary_role,
            'primary_role' => $user->primary_role,
            'roles' => $user->getRoleSlugs(),
            'permissions' => $user->getPermissionSlugs(),
            'employee_id' => $user->employee?->id,
        ];
    }
}

<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class GoogleOAuthService
{
    /**
     * Build signed CSRF state and Google OAuth2 authorization URL.
     */
    public function buildRedirectUrl(): array
    {
        $state = Str::random(48);
        cache()->put("google_oauth_state:{$state}", true, now()->addMinutes(10));

        $clientId = config('services.google.client_id') ?: 'configured-in-env';
        $redirectUri = config('services.google.redirect');

        $query = http_build_query([
            'client_id' => $clientId,
            'redirect_uri' => $redirectUri,
            'response_type' => 'code',
            'scope' => 'openid email profile',
            'state' => $state,
            'access_type' => 'offline',
            'prompt' => 'select_account',
        ]);

        return [
            'url' => 'https://accounts.google.com/o/oauth2/v2/auth?'.$query,
            'state' => $state,
        ];
    }

    public function validateState(?string $state): bool
    {
        if (! $state) {
            return false;
        }

        return (bool) cache()->pull("google_oauth_state:{$state}");
    }

    /**
     * Verify Google ID Token via Google's official tokeninfo endpoint (mockable via Http::fake in tests).
     *
     * @return array{sub: string, email: string, name: string, picture: ?string, email_verified: bool}
     */
    public function verifyIdToken(string $idToken): array
    {
        $response = Http::timeout(8)->get('https://oauth2.googleapis.com/tokeninfo', [
            'id_token' => $idToken,
        ]);

        if (! $response->successful()) {
            throw ValidationException::withMessages([
                'id_token' => ['Google ID token verification failed.'],
            ]);
        }

        $claims = $response->json();
        $expectedAud = config('services.google.client_id');

        if ($expectedAud && ($claims['aud'] ?? null) !== $expectedAud) {
            throw ValidationException::withMessages([
                'id_token' => ['Google ID token audience mismatch.'],
            ]);
        }

        $verified = filter_var($claims['email_verified'] ?? false, FILTER_VALIDATE_BOOLEAN);
        if (! $verified || empty($claims['email']) || empty($claims['sub'])) {
            throw ValidationException::withMessages([
                'id_token' => ['Google account email must be verified.'],
            ]);
        }

        return [
            'sub' => (string) $claims['sub'],
            'email' => strtolower(trim((string) $claims['email'])),
            'name' => (string) ($claims['name'] ?? explode('@', (string) $claims['email'])[0]),
            'picture' => $claims['picture'] ?? null,
            'email_verified' => true,
        ];
    }

    /**
     * CRITICAL ANTI-PRIVILEGE-ESCALATION HANDLER:
     * - Pre-provisioned users (matched by google_id or email) are linked & retain their Admin-assigned role.
     * - ANY unknown Google user is STRICTLY quarantined as role `guest_pending` & status `pending_approval`!
     */
    public function findOrQuarantineUser(array $googleProfile): User
    {
        $user = User::where('google_id', $googleProfile['sub'])->first()
            ?? User::where('email', $googleProfile['email'])->first();

        if ($user) {
            $user->forceFill([
                'google_id' => $googleProfile['sub'],
                'avatar' => $googleProfile['picture'] ?? $user->avatar,
                'email_verified_at' => $user->email_verified_at ?? now(),
                'last_login_at' => now(),
            ])->save();

            return $user->fresh();
        }

        // Unknown external Google user -> STRICT quarantine!
        $quarantined = new User;
        $quarantined->forceFill([
            'name' => $googleProfile['name'],
            'email' => $googleProfile['email'],
            'google_id' => $googleProfile['sub'],
            'avatar' => $googleProfile['picture'],
            'email_verified_at' => now(),
            'password' => Str::random(40),
            'status' => 'pending_approval',
            'primary_role' => 'guest_pending',
            'last_login_at' => now(),
        ])->save();

        $quarantined->syncSingleRole('guest_pending');

        AuditLogger::log(
            action: 'GOOGLE_OAUTH_USER_QUARANTINED',
            module: 'auth',
            severity: 'warning',
            user: $quarantined,
            subjectType: User::class,
            subjectId: $quarantined->id,
            metadata: ['email' => $quarantined->email, 'assigned_role' => 'guest_pending']
        );

        return $quarantined->fresh();
    }
}

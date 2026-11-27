<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Employee;
use App\Models\Payroll;
use App\Models\User;
use Database\Seeders\StockFlowSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuthAndRbacSecurityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(StockFlowSeeder::class);
    }

    public function test_healthz_returns_ok_and_hardened_security_headers(): void
    {
        $response = $this->getJson('/api/healthz');

        $response->assertOk()
            ->assertJson(['status' => 'ok', 'service' => 'StockFlow v2.0 API'])
            ->assertHeader('X-Frame-Options', 'DENY')
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

        $this->assertStringContainsString("default-src 'self'", (string) $response->headers->get('Content-Security-Policy'));
        $this->assertStringContainsString('max-age=31536000', (string) $response->headers->get('Strict-Transport-Security'));
        $this->assertStringContainsString('microphone=()', (string) $response->headers->get('Permissions-Policy'));
    }

    public function test_unknown_google_user_is_quarantined_as_guest_pending_with_zero_business_access(): void
    {
        Http::fake([
            'https://oauth2.googleapis.com/tokeninfo*' => Http::response([
                'sub' => 'google-sub-unknown-999',
                'aud' => config('services.google.client_id'),
                'email' => 'guest-stranger@example.com',
                'email_verified' => 'true',
                'name' => 'Unknown Google Visitor',
                'picture' => 'https://example.test/avatar.png',
            ], 200),
        ]);

        $authResponse = $this->postJson('/api/auth/google/token', [
            'id_token' => 'mock-valid-google-id-token',
        ]);

        $authResponse->assertOk()
            ->assertJsonPath('quarantined', true)
            ->assertJsonPath('user.primary_role', 'guest_pending')
            ->assertJsonPath('user.status', 'pending_approval');

        $token = $authResponse->json('token');

        // Allowed ONLY on /api/auth/me
        $this->withToken($token)->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('user.primary_role', 'guest_pending');

        // STRICTLY BLOCKED (403) across ALL business & admin endpoints!
        $blockedEndpoints = [
            '/api/dashboard/summary',
            '/api/admin/users',
            '/api/inventory/stocks',
            '/api/accounting/journals',
            '/api/finance/summary',
            '/api/tax/transactions',
            '/api/hr/employees',
            '/api/exports/inventory/xlsx',
        ];

        foreach ($blockedEndpoints as $uri) {
            $this->withToken($token)->getJson($uri)
                ->assertStatus(403)
                ->assertJsonPath('error_code', 'ACCOUNT_PENDING_APPROVAL');
        }

        // Verify 403 attempts were logged in activity_logs with severity=warning
        $warningLogs = ActivityLog::where('action', 'RBAC_FORBIDDEN_ATTEMPT')
            ->where('severity', 'warning')
            ->count();
        $this->assertGreaterThanOrEqual(count($blockedEndpoints), $warningLogs);

        // Allowed on /api/auth/logout
        $this->withToken($token)->postJson('/api/auth/logout')->assertOk();
    }

    public function test_google_callback_rejects_invalid_csrf_state(): void
    {
        $this->getJson('/api/auth/google/callback?state=forged-invalid-state&code=abc')
            ->assertStatus(403)
            ->assertJsonPath('error_code', 'OAUTH_INVALID_STATE');
    }

    public function test_only_admin_can_access_admin_routes_and_all_other_roles_receive_403_with_audit_log(): void
    {
        $nonAdminRoles = ['manager', 'warehouse', 'purchasing', 'sales', 'finance', 'hr_payroll', 'guest_pending'];

        foreach ($nonAdminRoles as $role) {
            $user = User::where('primary_role', $role)->firstOrFail();
            Sanctum::actingAs($user);

            $this->getJson('/api/admin/users')->assertStatus(403);
            $this->getJson('/api/admin/roles')->assertStatus(403);
        }

        $admin = User::where('primary_role', 'admin')->firstOrFail();
        Sanctum::actingAs($admin);

        $this->getJson('/api/admin/users')->assertOk();
        $this->getJson('/api/admin/roles')->assertOk();
        $this->getJson('/api/admin/activity-logs')->assertOk();

        // Confirm warning logs exist for non-admin attempts
        $this->assertGreaterThanOrEqual(
            count($nonAdminRoles),
            ActivityLog::where('action', 'RBAC_FORBIDDEN_ATTEMPT')->where('severity', 'warning')->count()
        );
    }

    public function test_admin_can_approve_guest_pending_user_and_grant_scoped_role(): void
    {
        $guest = User::where('primary_role', 'guest_pending')->firstOrFail();
        $admin = User::where('primary_role', 'admin')->firstOrFail();

        Sanctum::actingAs($admin);
        $this->postJson("/api/admin/users/{$guest->id}/approve", ['role' => 'warehouse'])
            ->assertOk()
            ->assertJsonPath('data.primary_role', 'warehouse')
            ->assertJsonPath('data.status', 'active');

        $guest->refresh();
        Sanctum::actingAs($guest);

        // Now permitted on warehouse endpoint, still denied on admin & finance!
        $this->getJson('/api/inventory/stocks')->assertOk();
        $this->getJson('/api/admin/users')->assertStatus(403);
        $this->getJson('/api/finance/summary')->assertStatus(403);
    }

    public function test_mass_assignment_cannot_escalate_role_or_status_via_profile_update(): void
    {
        $warehouse = User::where('primary_role', 'warehouse')->firstOrFail();
        Sanctum::actingAs($warehouse);

        $this->putJson('/api/auth/profile', [
            'name' => 'Budi Updated',
            'primary_role' => 'admin',
            'role' => 'admin',
            'status' => 'suspended',
        ])->assertOk();

        $warehouse->refresh();
        $this->assertSame('Budi Updated', $warehouse->name);
        $this->assertSame('warehouse', $warehouse->primary_role);
        $this->assertSame('active', $warehouse->status);
    }

    public function test_idor_protection_blocks_employee_from_viewing_another_employees_payslip(): void
    {
        $warehouseUser = User::where('primary_role', 'warehouse')->firstOrFail();
        $salesUser = User::where('primary_role', 'sales')->firstOrFail();

        $ownPayslip = Payroll::where('employee_id', $warehouseUser->employee->id)->firstOrFail();
        $otherPayslip = Payroll::where('employee_id', $salesUser->employee->id)->firstOrFail();

        Sanctum::actingAs($warehouseUser);

        // Own payslip -> 200 OK
        $this->getJson("/api/payroll/payslips/{$ownPayslip->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $ownPayslip->id);

        // Another employee's payslip -> 403 IDOR_FORBIDDEN + logged as warning
        $this->getJson("/api/payroll/payslips/{$otherPayslip->id}")
            ->assertStatus(403)
            ->assertJsonPath('error_code', 'IDOR_FORBIDDEN');

        $this->assertDatabaseHas('activity_logs', [
            'user_id' => $warehouseUser->id,
            'action' => 'RBAC_FORBIDDEN_ATTEMPT',
            'module' => 'hr_payroll_idor',
            'severity' => 'warning',
        ]);
    }

    public function test_employee_pii_is_encrypted_at_rest_and_masked_for_non_hr_roles(): void
    {
        $employee = Employee::where('employee_code', 'EMP-001')->firstOrFail();

        // Raw database value MUST NOT equal plaintext NIK or bank account number (encrypted cast!)
        $rawRow = DB::table('employees')->where('id', $employee->id)->first();
        $this->assertNotSame('3174010101900001', $rawRow->nik);
        $this->assertNotSame('1230001122334', $rawRow->bank_account_number);
        $this->assertSame('3174010101900001', $employee->nik);

        // Manager receives MASKED PII
        $manager = User::where('primary_role', 'manager')->firstOrFail();
        Sanctum::actingAs($manager);
        $mgrRes = $this->getJson("/api/hr/employees/{$employee->id}")->assertOk();
        $mgrRes->assertJsonPath('data.pii_masked', true);
        $this->assertStringContainsString('****', (string) $mgrRes->json('data.nik'));
        $this->assertStringEndsWith('0001', (string) $mgrRes->json('data.nik'));

        // HR Payroll receives UNMASKED PII
        $hr = User::where('primary_role', 'hr_payroll')->firstOrFail();
        Sanctum::actingAs($hr);
        $hrRes = $this->getJson("/api/hr/employees/{$employee->id}")->assertOk();
        $hrRes->assertJsonPath('data.pii_masked', false)
            ->assertJsonPath('data.nik', '3174010101900001');
    }

    public function test_login_lockout_triggers_after_5_failed_attempts(): void
    {
        $email = 'sales@stockflow.local';

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/login', [
                'email' => $email,
                'password' => 'WrongPassword#999',
            ])->assertStatus(401);
        }

        // Verify user account locked flag in DB (and 6th attempt returns 429 rate-limit or 423 locked)
        $user = User::where('email', $email)->firstOrFail();
        $this->assertSame(5, $user->failed_login_attempts);
        $this->assertNotNull($user->locked_until);
    }

    public function test_expired_password_reset_token_is_rejected_and_user_role_contract_matches_frontend(): void
    {
        $sales = User::where('primary_role', 'sales')->firstOrFail();

        // Insert a 65-minute-old reset token -> MUST be rejected (422) and purged
        DB::table('password_reset_tokens')->updateOrInsert(
            ['email' => $sales->email],
            ['token' => bcrypt('expired-reset-token-123'), 'created_at' => now()->subMinutes(65)]
        );

        $this->postJson('/api/auth/password/reset', [
            'email' => $sales->email,
            'token' => 'expired-reset-token-123',
            'password' => 'NewStrongPass#2026',
            'password_confirmation' => 'NewStrongPass#2026',
        ])->assertStatus(422);

        $this->assertDatabaseMissing('password_reset_tokens', ['email' => $sales->email]);

        // Verify /api/auth/me returns both `role` and `primary_role` for frontend AuthContext parity
        Sanctum::actingAs($sales);
        $this->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('user.role', 'sales')
            ->assertJsonPath('user.primary_role', 'sales');
    }

    public function test_company_email_registration_supports_official_roles_and_enforces_rbac(): void
    {
        // Reject guest_pending self-registration and password mismatch
        $this->postJson('/api/auth/register', [
            'username' => 'intruder',
            'email' => 'intruder@karyaberdua.co.id',
            'role' => 'guest_pending',
            'password' => 'StrongPass#2026',
            'password_confirmation' => 'Mismatch#2026',
        ])->assertStatus(422);

        // Register valid HR account with company email
        $res = $this->postJson('/api/auth/register', [
            'username' => 'siti.hr',
            'email' => 'siti.hr@karyaberdua.co.id',
            'role' => 'hr_payroll',
            'password' => 'StrongPass#2026',
            'password_confirmation' => 'StrongPass#2026',
        ]);

        $res->assertStatus(201)
            ->assertJsonPath('user.name', 'siti.hr')
            ->assertJsonPath('user.email', 'siti.hr@karyaberdua.co.id')
            ->assertJsonPath('user.role', 'hr_payroll')
            ->assertJsonPath('user.primary_role', 'hr_payroll')
            ->assertJsonPath('quarantined', false);

        $token = (string) $res->json('token');
        $createdUserId = (int) $res->json('user.id');

        // Confirm pivot user_roles was attached via role slug
        $hrRoleId = DB::table('roles')->where('slug', 'hr_payroll')->value('id');
        $this->assertDatabaseHas('user_roles', [
            'user_id' => $createdUserId,
            'role_id' => $hrRoleId,
        ]);

        // Duplicate email rejected
        $this->postJson('/api/auth/register', [
            'username' => 'siti.dup',
            'email' => 'siti.hr@karyaberdua.co.id',
            'role' => 'warehouse',
            'password' => 'StrongPass#2026',
            'password_confirmation' => 'StrongPass#2026',
        ])->assertStatus(422);

        // Newly registered HR user can access HR endpoints, blocked (403) on Admin endpoints
        $this->withToken($token)->getJson('/api/hr/employees')->assertOk();
        $this->withToken($token)->getJson('/api/admin/users')->assertStatus(403);
    }
}

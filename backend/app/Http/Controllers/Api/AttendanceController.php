<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceRecord;
use App\Models\EmployeeAttendance;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class AttendanceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $canViewAll = $user->hasAnyRole(['admin', 'manager', 'hr_payroll']);

        $query = AttendanceRecord::query()->orderByDesc('id');

        if (! $canViewAll) {
            $query->where('user_id', $user->id);
        } elseif ($request->filled('role')) {
            $query->where('role_slug', (string) $request->input('role'));
        }

        if ($request->filled('date')) {
            $query->whereDate('attendance_date', (string) $request->input('date'));
        }

        $records = $query->limit(200)->get()->map(fn (AttendanceRecord $r) => $this->formatRecord($r))->values();

        return response()->json([
            'data' => $records,
            'scope' => $canViewAll ? 'all' : 'self',
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'full_name' => ['required', 'string', 'min:2', 'max:160'],
            'employee_code' => ['required', 'string', 'min:2', 'max:40'],
            'role_slug' => ['required', 'string', 'in:admin,manager,warehouse,purchasing,sales,finance,hr_payroll'],
            'department' => ['required', 'string', 'max:100'],
            'work_location' => ['required', 'string', 'max:120'],
            'shift' => ['required', 'string', 'max:60'],
            'attendance_type' => ['required', 'string', 'in:check_in,check_out'],
            'status' => ['required', 'string', 'in:present,late,field_duty,leave,sick'],
            'attendance_date' => ['required', 'date'],
            'attendance_time' => ['required', 'string', 'max:16'],
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'accuracy_m' => ['nullable', 'numeric', 'min:0', 'max:100000'],
            'location_address' => ['required', 'string', 'min:4', 'max:500'],
            'captured_at' => ['required', 'string', 'max:40'],
            'photo_data_url' => ['required', 'string'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        // Strict binary image validation (prevents XSS / SVG / arbitrary payload upload)
        if (! preg_match('/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+\/=]+)$/', $validated['photo_data_url'], $matches)) {
            return response()->json([
                'message' => 'Foto absensi wajib berupa gambar JPEG, PNG, atau WebP ber-tag lokasi.',
                'error_code' => 'INVALID_ATTENDANCE_PHOTO',
            ], 422);
        }

        $ext = $matches[1] === 'jpeg' ? 'jpg' : $matches[1];
        $mime = 'image/' . ($matches[1] === 'jpg' ? 'jpeg' : $matches[1]);
        $binary = base64_decode($matches[2], true);

        if ($binary === false || strlen($binary) < 64 || strlen($binary) > 3 * 1024 * 1024) {
            return response()->json([
                'message' => 'Ukuran foto absensi tidak valid (maksimal 3 MB).',
                'error_code' => 'INVALID_PHOTO_SIZE',
            ], 422);
        }

        if (@getimagesizefromstring($binary) === false) {
            return response()->json([
                'message' => 'File foto absensi tidak terdeteksi sebagai gambar yang valid.',
                'error_code' => 'CORRUPT_PHOTO_DATA',
            ], 422);
        }

        $user = $request->user();
        $filename = sprintf('attendance/%s_%d_%s.%s', now()->format('Ymd_His'), $user->id, Str::random(10), $ext);
        Storage::disk('local')->put($filename, $binary);

        $record = AttendanceRecord::create([
            'user_id' => $user->id,
            'employee_id' => $user->employee?->id,
            'full_name' => trim($validated['full_name']),
            'employee_code' => trim($validated['employee_code']),
            'role_slug' => $validated['role_slug'],
            'department' => trim($validated['department']),
            'work_location' => trim($validated['work_location']),
            'shift' => trim($validated['shift']),
            'attendance_type' => $validated['attendance_type'],
            'status' => $validated['status'],
            'attendance_date' => $validated['attendance_date'],
            'attendance_time' => trim($validated['attendance_time']),
            'latitude' => (float) $validated['latitude'],
            'longitude' => (float) $validated['longitude'],
            'accuracy_m' => isset($validated['accuracy_m']) ? (float) $validated['accuracy_m'] : null,
            'location_address' => trim($validated['location_address']),
            'captured_at' => trim($validated['captured_at']),
            'photo_path' => $filename,
            'photo_mime' => $mime,
            'notes' => isset($validated['notes']) ? trim((string) $validated['notes']) : null,
            'ip_address' => $request->ip(),
        ]);

        // Auto-sync summary into employee_attendances for payroll attendance tracking when linked
        if ($user->employee) {
            $mappedStatus = in_array($validated['status'], ['present', 'late', 'leave'], true)
                ? $validated['status']
                : ($validated['status'] === 'sick' ? 'leave' : 'present');
            $patch = [
                'status' => $mappedStatus,
                'notes' => $validated['location_address'],
            ];
            if ($validated['attendance_type'] === 'check_in') {
                $patch['check_in'] = $validated['attendance_time'];
            } else {
                $patch['check_out'] = $validated['attendance_time'];
            }
            EmployeeAttendance::updateOrCreate(
                ['employee_id' => $user->employee->id, 'attendance_date' => $validated['attendance_date']],
                $patch
            );
        }

        AuditLogger::log('ATTENDANCE_RECORDED', 'attendance', 'info', $user, $request, AttendanceRecord::class, $record->id, null, null, [
            'role_slug' => $record->role_slug,
            'attendance_type' => $record->attendance_type,
            'latitude' => $record->latitude,
            'longitude' => $record->longitude,
        ]);

        return response()->json([
            'data' => $this->formatRecord($record),
        ], 201);
    }

    public function photo(Request $request, AttendanceRecord $record): Response|JsonResponse
    {
        $user = $request->user();
        $isAuthorized = $user->hasAnyRole(['admin', 'manager', 'hr_payroll']) || $record->user_id === $user->id;

        if (! $isAuthorized) {
            AuditLogger::logForbidden(
                $request,
                "IDOR blocked: user #{$user->id} attempted to access attendance photo #{$record->id}.",
                'attendance_idor',
                ['target_record_id' => $record->id]
            );

            return response()->json([
                'message' => 'Forbidden: Anda tidak berhak melihat foto absensi karyawan lain.',
                'error_code' => 'IDOR_FORBIDDEN',
            ], 403);
        }

        if (! Storage::disk('local')->exists($record->photo_path)) {
            return response()->json(['message' => 'Foto absensi tidak ditemukan.'], 404);
        }

        return response(Storage::disk('local')->get($record->photo_path), 200, [
            'Content-Type' => $record->photo_mime ?: 'image/jpeg',
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, max-age=3600',
        ]);
    }

    private function formatRecord(AttendanceRecord $record): array
    {
        return [
            'id' => $record->id,
            'user_id' => $record->user_id,
            'employee_id' => $record->employee_id,
            'full_name' => $record->full_name,
            'employee_code' => $record->employee_code,
            'role_slug' => $record->role_slug,
            'department' => $record->department,
            'work_location' => $record->work_location,
            'shift' => $record->shift,
            'attendance_type' => $record->attendance_type,
            'status' => $record->status,
            'attendance_date' => $record->attendance_date?->format('Y-m-d'),
            'attendance_time' => $record->attendance_time,
            'latitude' => (float) $record->latitude,
            'longitude' => (float) $record->longitude,
            'accuracy_m' => $record->accuracy_m !== null ? (float) $record->accuracy_m : null,
            'location_address' => $record->location_address,
            'captured_at' => $record->captured_at,
            'photo_url' => '/api/attendance/' . $record->id . '/photo',
            'notes' => $record->notes,
            'created_at' => $record->created_at?->toIso8601String(),
        ];
    }
}

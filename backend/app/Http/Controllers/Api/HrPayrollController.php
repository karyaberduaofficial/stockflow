<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\Employee;
use App\Models\EmployeeAttendance;
use App\Models\EmployeeLeave;
use App\Models\Payroll;
use App\Models\PayrollPeriod;
use App\Models\Position;
use App\Services\AuditLogger;
use App\Services\PayrollService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HrPayrollController extends Controller
{
    public function __construct(private readonly PayrollService $payroll) {}

    public function departments(): JsonResponse
    {
        return response()->json(['data' => Department::with('positions')->orderBy('code')->get()]);
    }

    public function positions(): JsonResponse
    {
        return response()->json(['data' => Position::with('department')->orderBy('code')->get()]);
    }

    public function employees(Request $request): JsonResponse
    {
        $revealPii = $request->user()->hasRole('hr_payroll');
        $employees = Employee::with(['department', 'position'])->orderBy('employee_code')->get();

        return response()->json([
            'data' => $employees->map(fn (Employee $e) => $e->toScopedArray($revealPii))->values(),
        ]);
    }

    public function showEmployee(Request $request, Employee $employee): JsonResponse
    {
        $user = $request->user();
        $isOwn = $employee->user_id !== null && $employee->user_id === $user->id;
        $revealPii = $user->hasRole('hr_payroll') || $isOwn;

        return response()->json([
            'data' => $employee->load(['department', 'position'])->toScopedArray($revealPii),
        ]);
    }

    public function storeEmployee(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'employee_code' => ['required', 'string', 'max:32', 'unique:employees,employee_code'],
            'user_id' => ['nullable', 'exists:users,id', 'unique:employees,user_id'],
            'department_id' => ['required', 'exists:departments,id'],
            'position_id' => ['required', 'exists:positions,id'],
            'full_name' => ['required', 'string', 'max:160'],
            'email' => ['required', 'email', 'unique:employees,email'],
            'phone' => ['nullable', 'string', 'max:32'],
            'nik' => ['nullable', 'string', 'max:32'],
            'npwp' => ['nullable', 'string', 'max:32'],
            'bank_name' => ['nullable', 'string', 'max:80'],
            'bank_account_number' => ['nullable', 'string', 'max:64'],
            'bank_account_holder' => ['nullable', 'string', 'max:160'],
            'ptkp_status' => ['sometimes', 'string', 'max:16'],
            'ter_category' => ['sometimes', 'in:A,B,C'],
            'base_salary' => ['required', 'numeric', 'min:0'],
            'join_date' => ['required', 'date'],
        ]);

        $employee = Employee::create($validated);

        return response()->json(['data' => $employee->load(['department', 'position'])->toScopedArray(true)], 201);
    }

    public function attendances(): JsonResponse
    {
        return response()->json(['data' => EmployeeAttendance::with('employee:id,employee_code,full_name')->orderByDesc('attendance_date')->limit(200)->get()]);
    }

    public function storeAttendance(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'employee_id' => ['required', 'exists:employees,id'],
            'attendance_date' => ['required', 'date'],
            'check_in' => ['nullable', 'string'],
            'check_out' => ['nullable', 'string'],
            'status' => ['required', 'in:present,late,absent,leave,half_day'],
            'overtime_hours' => ['sometimes', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
        ]);

        $att = EmployeeAttendance::updateOrCreate(
            ['employee_id' => $validated['employee_id'], 'attendance_date' => $validated['attendance_date']],
            $validated
        );

        return response()->json(['data' => $att], 201);
    }

    public function leaves(): JsonResponse
    {
        return response()->json(['data' => EmployeeLeave::with('employee:id,employee_code,full_name')->orderByDesc('id')->get()]);
    }

    public function storeLeave(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'employee_id' => ['required', 'exists:employees,id'],
            'leave_type' => ['required', 'string', 'max:40'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'days' => ['required', 'integer', 'min:1'],
            'reason' => ['nullable', 'string'],
        ]);

        return response()->json(['data' => EmployeeLeave::create($validated)], 201);
    }

    public function payrollPeriods(): JsonResponse
    {
        return response()->json(['data' => PayrollPeriod::orderByDesc('year')->orderByDesc('month')->get()]);
    }

    public function createPayrollPeriod(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:32', 'unique:payroll_periods,code'],
            'name' => ['required', 'string', 'max:120'],
            'year' => ['required', 'integer', 'min:2020'],
            'month' => ['required', 'integer', 'min:1', 'max:12'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'payment_date' => ['nullable', 'date'],
        ]);

        return response()->json(['data' => PayrollPeriod::create($validated)], 201);
    }

    public function runPayroll(PayrollPeriod $period): JsonResponse
    {
        return response()->json(['data' => $this->payroll->runPeriodPayroll($period)]);
    }

    public function hrCheck(Request $request, PayrollPeriod $period): JsonResponse
    {
        return response()->json(['data' => $this->payroll->hrCheck($period, $request->user())]);
    }

    public function managerApprove(Request $request, PayrollPeriod $period): JsonResponse
    {
        return response()->json(['data' => $this->payroll->managerApprove($period, $request->user())]);
    }

    public function disbursePayroll(Request $request, PayrollPeriod $period): JsonResponse
    {
        $validated = $request->validate([
            'financial_account_id' => ['required', 'exists:financial_accounts,id'],
        ]);

        return response()->json([
            'data' => $this->payroll->financeDisburse($period, (int) $validated['financial_account_id'], $request->user()),
        ]);
    }

    /**
     * Scoped Payslips listing: non-HR/manager/admin ONLY see their own payslips!
     */
    public function listPayslips(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Payroll::with(['period', 'employee.department', 'employee.position', 'details', 'deductions'])->orderByDesc('id');

        if (! $user->hasAnyRole(['hr_payroll', 'manager', 'admin'])) {
            $ownEmployeeId = $user->employee?->id;
            if (! $ownEmployeeId) {
                return response()->json(['data' => []]);
            }
            $query->where('employee_id', $ownEmployeeId);
        }

        return response()->json(['data' => $query->get()]);
    }

    /**
     * STRICT IDOR Protection: An employee can ONLY view their own payslip unless hr_payroll / manager / admin.
     */
    public function showPayslip(Request $request, Payroll $payroll): JsonResponse
    {
        $user = $request->user();
        $ownEmployeeId = $user->employee?->id;
        $isAuthorized = $user->hasAnyRole(['hr_payroll', 'manager', 'admin'])
            || ($ownEmployeeId !== null && $payroll->employee_id === $ownEmployeeId);

        if (! $isAuthorized) {
            AuditLogger::logForbidden(
                $request,
                "IDOR blocked: user #{$user->id} attempted to access payslip #{$payroll->id} belonging to employee #{$payroll->employee_id}.",
                'hr_payroll_idor',
                ['target_payroll_id' => $payroll->id, 'target_employee_id' => $payroll->employee_id]
            );

            return response()->json([
                'message' => 'Forbidden: you are only authorized to view your own payslip.',
                'error_code' => 'IDOR_FORBIDDEN',
            ], 403);
        }

        $payroll->load(['period', 'employee.department', 'employee.position', 'details', 'deductions']);
        $revealPii = $user->hasRole('hr_payroll') || ($ownEmployeeId !== null && $payroll->employee_id === $ownEmployeeId);

        return response()->json([
            'data' => [
                'id' => $payroll->id,
                'payslip_number' => $payroll->payslip_number,
                'period' => $payroll->period,
                'employee' => $payroll->employee?->toScopedArray($revealPii),
                'base_salary' => (float) $payroll->base_salary,
                'total_allowances' => (float) $payroll->total_allowances,
                'overtime_pay' => (float) $payroll->overtime_pay,
                'gross_salary' => (float) $payroll->gross_salary,
                'pph21_ter_rate' => (float) $payroll->pph21_ter_rate,
                'pph21_amount' => (float) $payroll->pph21_amount,
                'bpjs_employee_total' => (float) $payroll->bpjs_employee_total,
                'bpjs_employer_total' => (float) $payroll->bpjs_employer_total,
                'other_deductions' => (float) $payroll->other_deductions,
                'total_deductions' => (float) $payroll->total_deductions,
                'net_salary' => (float) $payroll->net_salary,
                'status' => $payroll->status,
                'details' => $payroll->details,
                'deductions' => $payroll->deductions,
            ],
        ]);
    }
}

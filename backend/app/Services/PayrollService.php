<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\EmployeeAttendance;
use App\Models\EmployeeBpjs;
use App\Models\FinancialAccount;
use App\Models\Payroll;
use App\Models\PayrollDeduction;
use App\Models\PayrollDetail;
use App\Models\PayrollPeriod;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PayrollService
{
    public function __construct(
        private readonly AccountingService $accounting,
        private readonly TaxService $tax
    ) {}

    /**
     * Compute monthly payroll for an employee with strict BPJS Employee vs Employer separation:
     * - Gross = Base Salary + Allowances + Overtime Pay
     * - Employee BPJS (Kesehatan 1% + JHT 2% + JP 1%) -> deducted from employee
     * - Employer BPJS (Kesehatan 4% + JHT 3.7% + JP 2% + JKK 0.24% + JKM 0.30%) -> COMPANY EXPENSE ONLY (NEVER deducted from employee!)
     * - PPh 21 TER -> computed from Gross + Employer BPJS Kesehatan/JKK/JKM (Indonesian tax rule) or Gross, deducted from employee
     * - Net Salary = Gross - (PPh 21 + Employee BPJS + Other Deductions)
     */
    public function calculateEmployeePayroll(Employee $employee, PayrollPeriod $period): Payroll
    {
        return DB::transaction(function () use ($employee, $period) {
            $attendances = EmployeeAttendance::where('employee_id', $employee->id)
                ->whereBetween('attendance_date', [$period->start_date, $period->end_date])
                ->get();

            $workingDays = 22;
            $presentDays = $attendances->count() > 0
                ? $attendances->whereIn('status', ['present', 'late', 'leave'])->count()
                : $workingDays;
            $overtimeHours = round((float) $attendances->sum('overtime_hours'), 2);

            $baseSalary = round((float) $employee->base_salary, 2);
            $hourlyRate = $baseSalary / 173;
            $overtimePay = round($overtimeHours * $hourlyRate * 1.5, 2);

            $components = $employee->salaryComponents()->with('component')->where('is_active', true)->get();
            $totalAllowances = 0.0;
            $otherDeductions = 0.0;

            foreach ($components as $ec) {
                if ($ec->component?->type === 'earning') {
                    $totalAllowances = round($totalAllowances + (float) $ec->amount, 2);
                } elseif ($ec->component?->type === 'deduction') {
                    $otherDeductions = round($otherDeductions + (float) $ec->amount, 2);
                }
            }

            $grossSalary = round($baseSalary + $totalAllowances + $overtimePay, 2);

            $bpjs = $employee->bpjs ?? new EmployeeBpjs([
                'kesehatan_employee_rate' => 1.0,
                'kesehatan_employer_rate' => 4.0,
                'jht_employee_rate' => 2.0,
                'jht_employer_rate' => 3.7,
                'jp_employee_rate' => 1.0,
                'jp_employer_rate' => 2.0,
                'jkk_employer_rate' => 0.24,
                'jkm_employer_rate' => 0.30,
                'kesehatan_salary_cap' => 12000000,
                'jp_salary_cap' => 10547400,
            ]);

            $kesBase = min($baseSalary + $totalAllowances, (float) $bpjs->kesehatan_salary_cap);
            $jpBase = min($baseSalary + $totalAllowances, (float) $bpjs->jp_salary_cap);
            $tkBase = $baseSalary + $totalAllowances;

            // Employee portion (deducted from employee gross)
            $bpjsKesEmp = round($kesBase * ((float) $bpjs->kesehatan_employee_rate / 100), 2);
            $bpjsJhtEmp = round($tkBase * ((float) $bpjs->jht_employee_rate / 100), 2);
            $bpjsJpEmp = round($jpBase * ((float) $bpjs->jp_employee_rate / 100), 2);
            $bpjsEmployeeTotal = round($bpjsKesEmp + $bpjsJhtEmp + $bpjsJpEmp, 2);

            // Employer portion (company expense ONLY — NEVER deducted from employee!)
            $bpjsKesEr = round($kesBase * ((float) $bpjs->kesehatan_employer_rate / 100), 2);
            $bpjsJhtEr = round($tkBase * ((float) $bpjs->jht_employer_rate / 100), 2);
            $bpjsJpEr = round($jpBase * ((float) $bpjs->jp_employer_rate / 100), 2);
            $bpjsJkkEr = round($tkBase * ((float) $bpjs->jkk_employer_rate / 100), 2);
            $bpjsJkmEr = round($tkBase * ((float) $bpjs->jkm_employer_rate / 100), 2);
            $bpjsEmployerTotal = round($bpjsKesEr + $bpjsJhtEr + $bpjsJpEr + $bpjsJkkEr + $bpjsJkmEr, 2);

            // PPh 21 TER calculated on gross + taxable employer insurance benefits (JKK, JKM, BPJS Kes Employer)
            $taxableGrossForTer = round($grossSalary + $bpjsKesEr + $bpjsJkkEr + $bpjsJkmEr, 2);
            $pph21 = $this->tax->calculatePph21Ter($taxableGrossForTer, $employee->ter_category ?? 'A');

            $totalDeductions = round($pph21['pph21_amount'] + $bpjsEmployeeTotal + $otherDeductions, 2);
            $netSalary = round($grossSalary - $totalDeductions, 2);

            $payslipNumber = sprintf('SLP-%s-%s', $period->code, $employee->employee_code);

            $payroll = Payroll::updateOrCreate(
                [
                    'payroll_period_id' => $period->id,
                    'employee_id' => $employee->id,
                ],
                [
                    'payslip_number' => $payslipNumber,
                    'working_days' => $workingDays,
                    'present_days' => $presentDays,
                    'overtime_hours' => $overtimeHours,
                    'base_salary' => $baseSalary,
                    'total_allowances' => $totalAllowances,
                    'overtime_pay' => $overtimePay,
                    'gross_salary' => $grossSalary,
                    'pph21_ter_rate' => $pph21['ter_rate_percent'],
                    'pph21_amount' => $pph21['pph21_amount'],
                    'bpjs_employee_total' => $bpjsEmployeeTotal,
                    'bpjs_employer_total' => $bpjsEmployerTotal,
                    'other_deductions' => $otherDeductions,
                    'total_deductions' => $totalDeductions,
                    'net_salary' => $netSalary,
                    'status' => 'draft',
                ]
            );

            $payroll->details()->delete();
            $payroll->deductions()->delete();

            PayrollDetail::create(['payroll_id' => $payroll->id, 'component_name' => 'Gaji Pokok', 'type' => 'earning', 'amount' => $baseSalary]);
            foreach ($components as $ec) {
                if ($ec->component?->type === 'earning') {
                    PayrollDetail::create([
                        'payroll_id' => $payroll->id,
                        'salary_component_id' => $ec->salary_component_id,
                        'component_name' => $ec->component->name,
                        'type' => 'earning',
                        'amount' => $ec->amount,
                    ]);
                }
            }
            if ($overtimePay > 0) {
                PayrollDetail::create(['payroll_id' => $payroll->id, 'component_name' => 'Upah Lembur', 'type' => 'earning', 'amount' => $overtimePay]);
            }
            PayrollDetail::create(['payroll_id' => $payroll->id, 'component_name' => 'BPJS Ditanggung Perusahaan (Beban Perusahaan)', 'type' => 'employer_contribution', 'amount' => $bpjsEmployerTotal]);

            if ($pph21['pph21_amount'] > 0) {
                PayrollDeduction::create(['payroll_id' => $payroll->id, 'code' => 'PPH21', 'name' => 'PPh 21 (TER '.$pph21['ter_category'].')', 'category' => 'pph21', 'amount' => $pph21['pph21_amount']]);
            }
            PayrollDeduction::create(['payroll_id' => $payroll->id, 'code' => 'BPJS_KES_EMP', 'name' => 'BPJS Kesehatan Karyawan (1%)', 'category' => 'bpjs_employee', 'amount' => $bpjsKesEmp]);
            PayrollDeduction::create(['payroll_id' => $payroll->id, 'code' => 'BPJS_JHT_EMP', 'name' => 'BPJS JHT Karyawan (2%)', 'category' => 'bpjs_employee', 'amount' => $bpjsJhtEmp]);
            PayrollDeduction::create(['payroll_id' => $payroll->id, 'code' => 'BPJS_JP_EMP', 'name' => 'BPJS JP Karyawan (1%)', 'category' => 'bpjs_employee', 'amount' => $bpjsJpEmp]);

            return $payroll->load('details', 'deductions', 'employee');
        });
    }

    public function runPeriodPayroll(PayrollPeriod $period): PayrollPeriod
    {
        return DB::transaction(function () use ($period) {
            if ($period->status === 'finance_paid') {
                throw ValidationException::withMessages(['status' => ['Paid payroll period cannot be recalculated.']]);
            }

            $employees = Employee::with(['bpjs', 'salaryComponents.component'])->where('is_active', true)->get();
            foreach ($employees as $employee) {
                $this->calculateEmployeePayroll($employee, $period);
            }

            $payrolls = Payroll::where('payroll_period_id', $period->id)->get();
            $period->update([
                'total_gross' => round((float) $payrolls->sum('gross_salary'), 2),
                'total_employee_deductions' => round((float) $payrolls->sum('total_deductions'), 2),
                'total_employer_bpjs' => round((float) $payrolls->sum('bpjs_employer_total'), 2),
                'total_pph21' => round((float) $payrolls->sum('pph21_amount'), 2),
                'total_net' => round((float) $payrolls->sum('net_salary'), 2),
                'status' => 'draft',
            ]);

            return $period->fresh()->load('payrolls.employee');
        });
    }

    public function hrCheck(PayrollPeriod $period, User $actor): PayrollPeriod
    {
        if ($period->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Payroll period must be in draft status for HR check.']]);
        }

        $period->update([
            'status' => 'hr_checked',
            'hr_checked_by' => $actor->id,
            'hr_checked_at' => now(),
        ]);
        $period->payrolls()->update(['status' => 'hr_checked']);

        return $period->fresh();
    }

    public function managerApprove(PayrollPeriod $period, User $actor): PayrollPeriod
    {
        if ($period->status !== 'hr_checked') {
            throw ValidationException::withMessages(['status' => ['Payroll period must be HR-checked before Manager approval.']]);
        }

        $period->update([
            'status' => 'manager_approved',
            'manager_approved_by' => $actor->id,
            'manager_approved_at' => now(),
        ]);
        $period->payrolls()->update(['status' => 'manager_approved']);

        return $period->fresh();
    }

    /**
     * Finance Disbursement:
     * DR Beban Gaji & Upah (6110) = Total Gross
     * DR Beban BPJS Perusahaan (6120) = Total Employer BPJS
     *   CR Kas/Bank = Total Net Salary
     *   CR Utang PPh 21 (2122) = Total PPh 21
     *   CR Utang BPJS (2130) = Total Employee BPJS + Total Employer BPJS
     */
    public function financeDisburse(PayrollPeriod $period, int $financialAccountId, User $actor): PayrollPeriod
    {
        if ($period->status !== 'manager_approved') {
            throw ValidationException::withMessages(['status' => ['Payroll period must be Manager-approved before Finance disbursement.']]);
        }

        return DB::transaction(function () use ($period, $financialAccountId, $actor) {
            $period = PayrollPeriod::lockForUpdate()->with('payrolls')->findOrFail($period->id);
            $account = FinancialAccount::lockForUpdate()->findOrFail($financialAccountId);

            $totalGross = round((float) $period->payrolls->sum('gross_salary'), 2);
            $totalEmployerBpjs = round((float) $period->payrolls->sum('bpjs_employer_total'), 2);
            $totalEmployeeBpjs = round((float) $period->payrolls->sum('bpjs_employee_total'), 2);
            $totalPph21 = round((float) $period->payrolls->sum('pph21_amount'), 2);
            $totalOtherDed = round((float) $period->payrolls->sum('other_deductions'), 2);
            $totalNet = round((float) $period->payrolls->sum('net_salary'), 2);

            if ((float) $account->current_balance < $totalNet) {
                throw ValidationException::withMessages(['financial_account_id' => ['Insufficient cash/bank balance for payroll disbursement.']]);
            }

            $payDate = $period->payment_date?->toDateString() ?? now()->toDateString();
            $totalBpjsPayable = round($totalEmployeeBpjs + $totalEmployerBpjs, 2);

            $lines = [
                ['coa_code' => '6110', 'debit' => $totalGross, 'credit' => 0, 'memo' => "Beban Gaji {$period->name}"],
                ['coa_code' => '6120', 'debit' => $totalEmployerBpjs, 'credit' => 0, 'memo' => "Beban BPJS Perusahaan {$period->name}"],
                ['coa_id' => $account->coa_id, 'debit' => 0, 'credit' => $totalNet, 'memo' => "Transfer Gaji Bersih via {$account->name}"],
                ['coa_code' => '2130', 'debit' => 0, 'credit' => $totalBpjsPayable, 'memo' => 'Utang BPJS (Karyawan + Perusahaan)'],
            ];
            if ($totalPph21 > 0) {
                $lines[] = ['coa_code' => '2122', 'debit' => 0, 'credit' => $totalPph21, 'memo' => 'Utang PPh 21 Karyawan'];
            }
            if ($totalOtherDed > 0) {
                $lines[] = ['coa_code' => '2140', 'debit' => 0, 'credit' => $totalOtherDed, 'memo' => 'Potongan Lain-lain Karyawan'];
            }

            $journal = $this->accounting->postJournal(
                entryDate: $payDate,
                description: "Pembayaran Payroll {$period->name}",
                lines: $lines,
                sourceModule: 'payroll',
                sourceType: PayrollPeriod::class,
                sourceId: $period->id,
                actor: $actor
            );

            $account->update(['current_balance' => round((float) $account->current_balance - $totalNet, 2)]);

            if ($totalPph21 > 0) {
                $this->tax->recordTaxTransaction(
                    taxTypeCode: 'PPH21',
                    direction: 'withholding',
                    transactionDate: $payDate,
                    baseAmount: $totalGross,
                    dppAmount: $totalGross,
                    rateApplied: $totalGross > 0 ? round(($totalPph21 / $totalGross) * 100, 4) : 0,
                    taxAmount: $totalPph21,
                    sourceType: PayrollPeriod::class,
                    sourceId: $period->id,
                    counterpartyName: "Payroll {$period->name}",
                    notes: 'Pemotongan PPh 21 TER Bulanan'
                );
            }

            $period->update([
                'status' => 'finance_paid',
                'finance_paid_by' => $actor->id,
                'finance_paid_at' => now(),
                'journal_entry_id' => $journal->id,
            ]);
            $period->payrolls()->update(['status' => 'paid', 'paid_at' => now()]);

            return $period->fresh()->load('payrolls');
        });
    }
}

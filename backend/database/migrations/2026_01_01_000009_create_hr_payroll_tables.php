<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employee_attendances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->date('attendance_date')->index();
            $table->time('check_in')->nullable();
            $table->time('check_out')->nullable();
            $table->string('status', 24)->default('present');
            $table->decimal('overtime_hours', 6, 2)->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->unique(['employee_id', 'attendance_date']);
        });

        Schema::create('employee_leaves', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->string('leave_type', 40);
            $table->date('start_date');
            $table->date('end_date');
            $table->unsignedSmallInteger('days')->default(1);
            $table->text('reason')->nullable();
            $table->string('status', 24)->default('pending');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();
        });

        Schema::create('salary_components', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique();
            $table->string('name', 120);
            $table->string('type', 32);
            $table->boolean('is_taxable')->default(true);
            $table->decimal('default_amount', 18, 2)->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('employee_salary_components', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->foreignId('salary_component_id')->constrained('salary_components')->cascadeOnDelete();
            $table->decimal('amount', 18, 2);
            $table->date('effective_from')->nullable();
            $table->date('effective_to')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('employee_bpjs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->unique()->constrained('employees')->cascadeOnDelete();
            $table->string('bpjs_kesehatan_number', 64)->nullable();
            $table->string('bpjs_ketenagakerjaan_number', 64)->nullable();
            $table->decimal('kesehatan_employee_rate', 6, 4)->default(1.0000);
            $table->decimal('kesehatan_employer_rate', 6, 4)->default(4.0000);
            $table->decimal('jht_employee_rate', 6, 4)->default(2.0000);
            $table->decimal('jht_employer_rate', 6, 4)->default(3.7000);
            $table->decimal('jp_employee_rate', 6, 4)->default(1.0000);
            $table->decimal('jp_employer_rate', 6, 4)->default(2.0000);
            $table->decimal('jkk_employer_rate', 6, 4)->default(0.2400);
            $table->decimal('jkm_employer_rate', 6, 4)->default(0.3000);
            $table->decimal('kesehatan_salary_cap', 18, 2)->default(12000000);
            $table->decimal('jp_salary_cap', 18, 2)->default(10547400);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('payroll_periods', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique();
            $table->string('name', 120);
            $table->unsignedSmallInteger('year');
            $table->unsignedTinyInteger('month');
            $table->date('start_date');
            $table->date('end_date');
            $table->date('payment_date')->nullable();
            $table->string('status', 32)->default('draft')->index();
            $table->decimal('total_gross', 18, 2)->default(0);
            $table->decimal('total_employee_deductions', 18, 2)->default(0);
            $table->decimal('total_employer_bpjs', 18, 2)->default(0);
            $table->decimal('total_pph21', 18, 2)->default(0);
            $table->decimal('total_net', 18, 2)->default(0);
            $table->foreignId('hr_checked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('hr_checked_at')->nullable();
            $table->foreignId('manager_approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('manager_approved_at')->nullable();
            $table->foreignId('finance_paid_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('finance_paid_at')->nullable();
            $table->foreignId('journal_entry_id')->nullable()->constrained('journal_entries')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('payrolls', function (Blueprint $table) {
            $table->id();
            $table->string('payslip_number', 48)->unique();
            $table->foreignId('payroll_period_id')->constrained('payroll_periods')->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('employees');
            $table->unsignedSmallInteger('working_days')->default(22);
            $table->unsignedSmallInteger('present_days')->default(22);
            $table->decimal('overtime_hours', 6, 2)->default(0);
            $table->decimal('base_salary', 18, 2)->default(0);
            $table->decimal('total_allowances', 18, 2)->default(0);
            $table->decimal('overtime_pay', 18, 2)->default(0);
            $table->decimal('gross_salary', 18, 2)->default(0);
            $table->decimal('pph21_ter_rate', 8, 4)->default(0);
            $table->decimal('pph21_amount', 18, 2)->default(0);
            $table->decimal('bpjs_employee_total', 18, 2)->default(0);
            $table->decimal('bpjs_employer_total', 18, 2)->default(0);
            $table->decimal('other_deductions', 18, 2)->default(0);
            $table->decimal('total_deductions', 18, 2)->default(0);
            $table->decimal('net_salary', 18, 2)->default(0);
            $table->string('status', 32)->default('draft')->index();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();
            $table->unique(['payroll_period_id', 'employee_id']);
        });

        Schema::create('payroll_details', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payroll_id')->constrained('payrolls')->cascadeOnDelete();
            $table->foreignId('salary_component_id')->nullable()->constrained('salary_components')->nullOnDelete();
            $table->string('component_name', 120);
            $table->string('type', 32);
            $table->decimal('amount', 18, 2);
            $table->timestamps();
        });

        Schema::create('payroll_deductions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payroll_id')->constrained('payrolls')->cascadeOnDelete();
            $table->string('code', 32);
            $table->string('name', 120);
            $table->string('category', 32);
            $table->decimal('amount', 18, 2);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payroll_deductions');
        Schema::dropIfExists('payroll_details');
        Schema::dropIfExists('payrolls');
        Schema::dropIfExists('payroll_periods');
        Schema::dropIfExists('employee_bpjs');
        Schema::dropIfExists('employee_salary_components');
        Schema::dropIfExists('salary_components');
        Schema::dropIfExists('employee_leaves');
        Schema::dropIfExists('employee_attendances');
    }
};

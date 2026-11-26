<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chart_of_accounts', function (Blueprint $table) {
            $table->id();
            $table->string('code', 24)->unique();
            $table->string('name', 160);
            $table->string('account_type', 32)->index();
            $table->string('normal_balance', 10);
            $table->foreignId('parent_id')->nullable()->constrained('chart_of_accounts')->nullOnDelete();
            $table->boolean('is_header')->default(false);
            $table->boolean('is_system')->default(false);
            $table->boolean('is_active')->default(true);
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('accounting_periods', function (Blueprint $table) {
            $table->id();
            $table->string('code', 24)->unique();
            $table->string('name', 80);
            $table->date('start_date');
            $table->date('end_date');
            $table->string('status', 20)->default('open')->index();
            $table->foreignId('closed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('journal_entries', function (Blueprint $table) {
            $table->id();
            $table->string('journal_number', 48)->unique();
            $table->foreignId('accounting_period_id')->nullable()->constrained('accounting_periods')->nullOnDelete();
            $table->date('entry_date')->index();
            $table->string('description', 255);
            $table->string('source_module', 40)->default('manual')->index();
            $table->string('source_type', 80)->nullable();
            $table->unsignedBigInteger('source_id')->nullable();
            $table->decimal('total_debit', 18, 2)->default(0);
            $table->decimal('total_credit', 18, 2)->default(0);
            $table->string('status', 24)->default('posted')->index();
            $table->unsignedBigInteger('reversed_by_journal_id')->nullable();
            $table->unsignedBigInteger('reverses_journal_id')->nullable();
            $table->boolean('is_immutable')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('posted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('posted_at')->nullable();
            $table->timestamps();
        });

        Schema::create('journal_entry_details', function (Blueprint $table) {
            $table->id();
            $table->foreignId('journal_entry_id')->constrained('journal_entries')->cascadeOnDelete();
            $table->foreignId('coa_id')->constrained('chart_of_accounts');
            $table->decimal('debit', 18, 2)->default(0);
            $table->decimal('credit', 18, 2)->default(0);
            $table->string('memo', 255)->nullable();
            $table->timestamps();
        });

        Schema::create('accounting_adjustments', function (Blueprint $table) {
            $table->id();
            $table->string('adjustment_number', 48)->unique();
            $table->foreignId('accounting_period_id')->constrained('accounting_periods');
            $table->date('adjustment_date');
            $table->string('adjustment_type', 40);
            $table->text('description');
            $table->foreignId('journal_entry_id')->nullable()->constrained('journal_entries')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('accounting_adjustments');
        Schema::dropIfExists('journal_entry_details');
        Schema::dropIfExists('journal_entries');
        Schema::dropIfExists('accounting_periods');
        Schema::dropIfExists('chart_of_accounts');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tax_types', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique();
            $table->string('name', 120);
            $table->string('category', 32);
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('tax_rates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tax_type_id')->constrained('tax_types')->cascadeOnDelete();
            $table->string('code', 48)->unique();
            $table->string('name', 160);
            $table->decimal('rate_percent', 8, 4);
            $table->unsignedInteger('dpp_ratio_numerator')->default(1);
            $table->unsignedInteger('dpp_ratio_denominator')->default(1);
            $table->decimal('effective_rate_percent', 8, 4);
            $table->date('effective_from')->index();
            $table->date('effective_to')->nullable()->index();
            $table->boolean('is_default')->default(false);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('tax_periods', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique();
            $table->foreignId('tax_type_id')->constrained('tax_types');
            $table->unsignedSmallInteger('year');
            $table->unsignedTinyInteger('month');
            $table->date('due_date');
            $table->string('status', 24)->default('open')->index();
            $table->decimal('total_output_tax', 18, 2)->default(0);
            $table->decimal('total_input_tax', 18, 2)->default(0);
            $table->decimal('net_tax_payable', 18, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('tax_transactions', function (Blueprint $table) {
            $table->id();
            $table->string('tax_number', 64)->unique();
            $table->foreignId('tax_type_id')->constrained('tax_types');
            $table->foreignId('tax_rate_id')->nullable()->constrained('tax_rates')->nullOnDelete();
            $table->foreignId('tax_period_id')->nullable()->constrained('tax_periods')->nullOnDelete();
            $table->string('direction', 24)->index();
            $table->date('transaction_date')->index();
            $table->decimal('base_amount', 18, 2);
            $table->decimal('dpp_amount', 18, 2);
            $table->decimal('tax_rate_applied', 8, 4);
            $table->decimal('tax_amount', 18, 2);
            $table->string('source_type', 80)->nullable();
            $table->unsignedBigInteger('source_id')->nullable();
            $table->string('counterparty_name', 160)->nullable();
            $table->string('counterparty_npwp', 40)->nullable();
            $table->string('status', 24)->default('recorded');
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('tax_payments', function (Blueprint $table) {
            $table->id();
            $table->string('payment_number', 48)->unique();
            $table->foreignId('tax_type_id')->constrained('tax_types');
            $table->foreignId('tax_period_id')->nullable()->constrained('tax_periods')->nullOnDelete();
            $table->foreignId('financial_account_id')->constrained('financial_accounts');
            $table->date('payment_date');
            $table->decimal('amount', 18, 2);
            $table->string('ntpn_code', 64)->nullable();
            $table->string('billing_code', 64)->nullable();
            $table->string('status', 24)->default('paid');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('journal_entry_id')->nullable()->constrained('journal_entries')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tax_payments');
        Schema::dropIfExists('tax_transactions');
        Schema::dropIfExists('tax_periods');
        Schema::dropIfExists('tax_rates');
        Schema::dropIfExists('tax_types');
    }
};

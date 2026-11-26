<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('financial_accounts', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique();
            $table->string('name', 120);
            $table->string('account_type', 24)->default('bank');
            $table->string('bank_name', 80)->nullable();
            $table->string('account_number', 64)->nullable();
            $table->foreignId('coa_id')->constrained('chart_of_accounts');
            $table->decimal('opening_balance', 18, 2)->default(0);
            $table->decimal('current_balance', 18, 2)->default(0);
            $table->string('currency', 8)->default('IDR');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('income_transactions', function (Blueprint $table) {
            $table->id();
            $table->string('reference_number', 48)->unique();
            $table->foreignId('financial_account_id')->constrained('financial_accounts');
            $table->foreignId('coa_id')->constrained('chart_of_accounts');
            $table->date('transaction_date')->index();
            $table->string('category', 80);
            $table->decimal('amount', 18, 2);
            $table->text('description')->nullable();
            $table->string('source_type', 80)->nullable();
            $table->unsignedBigInteger('source_id')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('journal_entry_id')->nullable()->constrained('journal_entries')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('expense_transactions', function (Blueprint $table) {
            $table->id();
            $table->string('reference_number', 48)->unique();
            $table->foreignId('financial_account_id')->constrained('financial_accounts');
            $table->foreignId('coa_id')->constrained('chart_of_accounts');
            $table->date('transaction_date')->index();
            $table->string('category', 80);
            $table->string('vendor_name', 160)->nullable();
            $table->decimal('amount', 18, 2);
            $table->text('description')->nullable();
            $table->string('status', 24)->default('posted');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('journal_entry_id')->nullable()->constrained('journal_entries')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('cash_bank_transactions', function (Blueprint $table) {
            $table->id();
            $table->string('reference_number', 48)->unique();
            $table->string('transaction_type', 24)->index();
            $table->foreignId('from_account_id')->nullable()->constrained('financial_accounts')->nullOnDelete();
            $table->foreignId('to_account_id')->nullable()->constrained('financial_accounts')->nullOnDelete();
            $table->date('transaction_date')->index();
            $table->decimal('amount', 18, 2);
            $table->boolean('is_internal_transfer')->default(false);
            $table->text('description')->nullable();
            $table->string('source_type', 80)->nullable();
            $table->unsignedBigInteger('source_id')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('journal_entry_id')->nullable()->constrained('journal_entries')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('accounts_receivable', function (Blueprint $table) {
            $table->id();
            $table->string('ar_number', 48)->unique();
            $table->foreignId('customer_id')->constrained('customers');
            $table->foreignId('sale_id')->constrained('sales');
            $table->date('issue_date');
            $table->date('due_date');
            $table->decimal('total_amount', 18, 2);
            $table->decimal('paid_amount', 18, 2)->default(0);
            $table->decimal('balance_amount', 18, 2);
            $table->string('status', 24)->default('open')->index();
            $table->timestamps();
        });

        Schema::create('accounts_payable', function (Blueprint $table) {
            $table->id();
            $table->string('ap_number', 48)->unique();
            $table->foreignId('supplier_id')->constrained('suppliers');
            $table->foreignId('supplier_invoice_id')->nullable()->constrained('supplier_invoices')->nullOnDelete();
            $table->foreignId('purchase_order_id')->nullable()->constrained('purchase_orders')->nullOnDelete();
            $table->date('issue_date');
            $table->date('due_date');
            $table->decimal('total_amount', 18, 2);
            $table->decimal('paid_amount', 18, 2)->default(0);
            $table->decimal('balance_amount', 18, 2);
            $table->string('status', 24)->default('open')->index();
            $table->timestamps();
        });

        Schema::create('financial_reconciliations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('financial_account_id')->constrained('financial_accounts');
            $table->date('reconciliation_date');
            $table->decimal('statement_balance', 18, 2);
            $table->decimal('book_balance', 18, 2);
            $table->decimal('difference', 18, 2)->default(0);
            $table->string('status', 24)->default('reconciled');
            $table->text('notes')->nullable();
            $table->foreignId('reconciled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('financial_reconciliations');
        Schema::dropIfExists('accounts_payable');
        Schema::dropIfExists('accounts_receivable');
        Schema::dropIfExists('cash_bank_transactions');
        Schema::dropIfExists('expense_transactions');
        Schema::dropIfExists('income_transactions');
        Schema::dropIfExists('financial_accounts');
    }
};

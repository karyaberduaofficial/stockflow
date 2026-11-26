<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique();
            $table->string('name', 120);
            $table->foreignId('parent_id')->nullable()->constrained('categories')->nullOnDelete();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('brands', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique();
            $table->string('name', 120);
            $table->string('country', 80)->default('Indonesia');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('units', function (Blueprint $table) {
            $table->id();
            $table->string('code', 20)->unique();
            $table->string('name', 60);
            $table->string('symbol', 20);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('warehouses', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique();
            $table->string('name', 120);
            $table->string('type', 40)->default('main');
            $table->text('address')->nullable();
            $table->string('city', 80)->nullable();
            $table->string('manager_name', 120)->nullable();
            $table->string('phone', 32)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('sku', 64)->unique();
            $table->string('barcode', 80)->nullable()->unique();
            $table->string('name', 180);
            $table->foreignId('category_id')->constrained('categories');
            $table->foreignId('brand_id')->nullable()->constrained('brands')->nullOnDelete();
            $table->foreignId('unit_id')->constrained('units');
            $table->text('description')->nullable();
            $table->decimal('cost_price', 18, 2)->default(0);
            $table->decimal('selling_price', 18, 2)->default(0);
            $table->integer('min_stock')->default(5);
            $table->integer('max_stock')->default(100);
            $table->integer('reorder_point')->default(10);
            $table->integer('lead_time_days')->default(7);
            $table->integer('safety_stock')->default(5);
            $table->boolean('taxable')->default(true);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('product_variants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->string('sku', 64)->unique();
            $table->string('barcode', 80)->nullable()->unique();
            $table->string('variant_name', 140);
            $table->json('attributes')->nullable();
            $table->decimal('cost_price', 18, 2)->default(0);
            $table->decimal('selling_price', 18, 2)->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('suppliers', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique();
            $table->string('name', 160);
            $table->string('contact_person', 120)->nullable();
            $table->string('email', 160)->nullable();
            $table->string('phone', 32)->nullable();
            $table->text('address')->nullable();
            $table->string('city', 80)->nullable();
            $table->string('npwp', 40)->nullable();
            $table->integer('payment_terms_days')->default(30);
            $table->decimal('rating', 4, 2)->default(4.50);
            $table->decimal('on_time_delivery_rate', 5, 2)->default(95.00);
            $table->decimal('quality_score', 5, 2)->default(95.00);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique();
            $table->string('name', 160);
            $table->string('type', 32)->default('retail');
            $table->string('email', 160)->nullable();
            $table->string('phone', 32)->nullable();
            $table->text('address')->nullable();
            $table->string('city', 80)->nullable();
            $table->string('npwp', 40)->nullable();
            $table->decimal('credit_limit', 18, 2)->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('departments', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique();
            $table->string('name', 120);
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('positions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('department_id')->constrained('departments');
            $table->string('code', 32)->unique();
            $table->string('title', 120);
            $table->decimal('base_salary_min', 18, 2)->default(0);
            $table->decimal('base_salary_max', 18, 2)->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('employees', function (Blueprint $table) {
            $table->id();
            $table->string('employee_code', 32)->unique();
            $table->foreignId('user_id')->nullable()->unique()->constrained('users')->nullOnDelete();
            $table->foreignId('department_id')->constrained('departments');
            $table->foreignId('position_id')->constrained('positions');
            $table->string('full_name', 160);
            $table->string('email', 160)->unique();
            $table->string('phone', 32)->nullable();
            $table->text('nik')->nullable();
            $table->text('npwp')->nullable();
            $table->string('bank_name', 80)->nullable();
            $table->text('bank_account_number')->nullable();
            $table->string('bank_account_holder', 160)->nullable();
            $table->string('ptkp_status', 16)->default('TK/0');
            $table->string('ter_category', 8)->default('A');
            $table->decimal('base_salary', 18, 2)->default(0);
            $table->date('join_date');
            $table->string('employment_status', 32)->default('permanent');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employees');
        Schema::dropIfExists('positions');
        Schema::dropIfExists('departments');
        Schema::dropIfExists('customers');
        Schema::dropIfExists('suppliers');
        Schema::dropIfExists('product_variants');
        Schema::dropIfExists('products');
        Schema::dropIfExists('warehouses');
        Schema::dropIfExists('units');
        Schema::dropIfExists('brands');
        Schema::dropIfExists('categories');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_stocks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products');
            $table->foreignId('product_variant_id')->nullable()->constrained('product_variants')->nullOnDelete();
            $table->foreignId('warehouse_id')->constrained('warehouses');
            $table->decimal('quantity', 18, 2)->default(0);
            $table->decimal('reserved_quantity', 18, 2)->default(0);
            $table->decimal('average_cost', 18, 4)->default(0);
            $table->decimal('total_value', 18, 2)->default(0);
            $table->timestamp('last_movement_at')->nullable();
            $table->timestamps();
            $table->unique(['product_id', 'product_variant_id', 'warehouse_id'], 'inv_prod_var_wh_unique');
        });

        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->string('reference_number', 64)->index();
            $table->foreignId('product_id')->constrained('products');
            $table->foreignId('product_variant_id')->nullable()->constrained('product_variants')->nullOnDelete();
            $table->foreignId('warehouse_id')->constrained('warehouses');
            $table->string('movement_type', 32)->index();
            $table->decimal('quantity', 18, 2);
            $table->decimal('unit_cost', 18, 4)->default(0);
            $table->decimal('total_cost', 18, 2)->default(0);
            $table->decimal('balance_before', 18, 2)->default(0);
            $table->decimal('balance_after', 18, 2)->default(0);
            $table->string('reference_type', 80)->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('moved_at')->useCurrent();
            $table->timestamps();
        });

        Schema::create('stock_adjustments', function (Blueprint $table) {
            $table->id();
            $table->string('adjustment_number', 48)->unique();
            $table->foreignId('warehouse_id')->constrained('warehouses');
            $table->date('adjustment_date');
            $table->string('reason', 120);
            $table->string('status', 24)->default('pending')->index();
            $table->text('notes')->nullable();
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->foreignId('journal_entry_id')->nullable()->constrained('journal_entries')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('stock_adjustment_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stock_adjustment_id')->constrained('stock_adjustments')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products');
            $table->foreignId('product_variant_id')->nullable()->constrained('product_variants')->nullOnDelete();
            $table->decimal('system_qty', 18, 2)->default(0);
            $table->decimal('actual_qty', 18, 2)->default(0);
            $table->decimal('variance_qty', 18, 2)->default(0);
            $table->decimal('unit_cost', 18, 4)->default(0);
            $table->decimal('variance_value', 18, 2)->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('stock_opnames', function (Blueprint $table) {
            $table->id();
            $table->string('opname_number', 48)->unique();
            $table->foreignId('warehouse_id')->constrained('warehouses');
            $table->date('opname_date');
            $table->string('status', 24)->default('draft')->index();
            $table->text('notes')->nullable();
            $table->foreignId('conducted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();
        });

        Schema::create('stock_opname_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stock_opname_id')->constrained('stock_opnames')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products');
            $table->foreignId('product_variant_id')->nullable()->constrained('product_variants')->nullOnDelete();
            $table->decimal('system_qty', 18, 2)->default(0);
            $table->decimal('counted_qty', 18, 2)->default(0);
            $table->decimal('variance_qty', 18, 2)->default(0);
            $table->decimal('unit_cost', 18, 4)->default(0);
            $table->decimal('variance_value', 18, 2)->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('warehouse_transfers', function (Blueprint $table) {
            $table->id();
            $table->string('transfer_number', 48)->unique();
            $table->foreignId('from_warehouse_id')->constrained('warehouses');
            $table->foreignId('to_warehouse_id')->constrained('warehouses');
            $table->date('transfer_date');
            $table->date('received_date')->nullable();
            $table->string('status', 24)->default('in_transit')->index();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('warehouse_transfer_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('warehouse_transfer_id')->constrained('warehouse_transfers')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products');
            $table->foreignId('product_variant_id')->nullable()->constrained('product_variants')->nullOnDelete();
            $table->decimal('quantity', 18, 2);
            $table->decimal('received_quantity', 18, 2)->default(0);
            $table->decimal('unit_cost', 18, 4)->default(0);
            $table->decimal('total_cost', 18, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('warehouse_transfer_items');
        Schema::dropIfExists('warehouse_transfers');
        Schema::dropIfExists('stock_opname_items');
        Schema::dropIfExists('stock_opnames');
        Schema::dropIfExists('stock_adjustment_items');
        Schema::dropIfExists('stock_adjustments');
        Schema::dropIfExists('stock_movements');
        Schema::dropIfExists('inventory_stocks');
    }
};

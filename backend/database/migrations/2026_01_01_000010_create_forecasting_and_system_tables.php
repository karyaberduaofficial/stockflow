<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('demand_forecasts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('warehouse_id')->nullable()->constrained('warehouses')->nullOnDelete();
            $table->string('forecast_period', 24);
            $table->unsignedTinyInteger('window_months')->default(3);
            $table->json('historical_demand')->nullable();
            $table->decimal('moving_average_demand', 18, 2)->default(0);
            $table->decimal('recommended_order_qty', 18, 2)->default(0);
            $table->timestamp('generated_at')->useCurrent();
            $table->timestamps();
        });

        Schema::create('reorder_recommendations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('warehouse_id')->constrained('warehouses')->cascadeOnDelete();
            $table->decimal('current_stock', 18, 2)->default(0);
            $table->decimal('avg_daily_demand', 18, 4)->default(0);
            $table->unsignedSmallInteger('lead_time_days')->default(7);
            $table->decimal('safety_stock', 18, 2)->default(5);
            $table->decimal('reorder_point', 18, 2)->default(0);
            $table->decimal('suggested_order_qty', 18, 2)->default(0);
            $table->string('priority', 20)->default('medium')->index();
            $table->string('status', 24)->default('open')->index();
            $table->timestamp('calculated_at')->useCurrent();
            $table->timestamps();
        });

        Schema::create('notification_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('role_target', 40)->nullable()->index();
            $table->string('channel', 32)->default('in_app');
            $table->string('title', 160);
            $table->text('message');
            $table->string('severity', 20)->default('info');
            $table->boolean('is_read')->default(false);
            $table->timestamp('read_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });

        Schema::create('system_settings', function (Blueprint $table) {
            $table->id();
            $table->string('group', 40)->index();
            $table->string('key', 80)->unique();
            $table->text('value')->nullable();
            $table->string('type', 24)->default('string');
            $table->string('description')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('system_settings');
        Schema::dropIfExists('notification_logs');
        Schema::dropIfExists('reorder_recommendations');
        Schema::dropIfExists('demand_forecasts');
    }
};

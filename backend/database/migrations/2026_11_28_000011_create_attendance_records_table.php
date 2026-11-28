<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendance_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('employee_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->string('full_name', 160);
            $table->string('employee_code', 40);
            $table->string('role_slug', 32)->index();
            $table->string('department', 100);
            $table->string('work_location', 120);
            $table->string('shift', 60);
            $table->string('attendance_type', 24)->default('check_in');
            $table->string('status', 24)->default('present');
            $table->date('attendance_date')->index();
            $table->string('attendance_time', 16);
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->decimal('accuracy_m', 8, 2)->nullable();
            $table->text('location_address');
            $table->string('captured_at', 40);
            $table->string('photo_path', 255);
            $table->string('photo_mime', 40)->default('image/jpeg');
            $table->text('notes')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_records');
    }
};

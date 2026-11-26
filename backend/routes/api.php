<?php

use App\Http\Controllers\Api\AccountingController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AnalyticsExportController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\FinanceController;
use App\Http\Controllers\Api\HrPayrollController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\MasterDataController;
use App\Http\Controllers\Api\ProcurementController;
use App\Http\Controllers\Api\SalesController;
use App\Http\Controllers\Api\TaxController;
use Illuminate\Support\Facades\Route;

// Public health check
Route::get('/healthz', [AuthController::class, 'healthz']);

// Authentication & Google OAuth2 (strictly rate-limited)
Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:auth-login');
    Route::post('/password/reset-request', [AuthController::class, 'requestPasswordReset'])->middleware('throttle:auth-login');
    Route::post('/password/reset', [AuthController::class, 'resetPassword'])->middleware('throttle:auth-login');

    Route::get('/google/redirect', [AuthController::class, 'googleRedirect'])->middleware('throttle:auth-google');
    Route::get('/google/callback', [AuthController::class, 'googleCallback'])->middleware('throttle:auth-google');
    Route::post('/google/token', [AuthController::class, 'googleTokenLogin'])->middleware('throttle:auth-google');
});

// Authenticated routes allowed EVEN for quarantined `guest_pending` (ONLY me & logout!)
Route::middleware(['auth:sanctum', 'throttle:api'])->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
});

// Authenticated + Active (STRICTLY blocks `guest_pending`, `pending_approval`, `suspended`, `inactive`!)
Route::middleware(['auth:sanctum', 'active', 'throttle:api'])->group(function () {
    // Own profile & session rotation
    Route::put('/auth/profile', [AuthController::class, 'updateProfile']);
    Route::post('/auth/rotate-token', [AuthController::class, 'rotateToken']);
    Route::post('/security/forbidden-attempt', [AuthController::class, 'logClientForbiddenAttempt']);

    // Role-aware Executive / Department Dashboard
    Route::get('/dashboard/summary', [AnalyticsExportController::class, 'dashboard']);

    // Scoped Own Payslips (IDOR-checked in controller!)
    Route::get('/payroll/payslips', [HrPayrollController::class, 'listPayslips']);
    Route::get('/payroll/payslips/{payroll}', [HrPayrollController::class, 'showPayslip']);

    // Document Export Center (RBAC checked per report inside controller!)
    Route::get('/exports/{report}/{format}', [AnalyticsExportController::class, 'export']);

    // =========================================================================
    // ADMIN-ONLY ROUTES (`/api/admin/*` — STRICTLY role:admin ONLY!)
    // =========================================================================
    Route::prefix('admin')->middleware('role:admin')->group(function () {
        Route::get('/users', [AdminController::class, 'listUsers']);
        Route::post('/users', [AdminController::class, 'createUser']);
        Route::put('/users/{user}', [AdminController::class, 'updateUser']);
        Route::post('/users/{user}/approve', [AdminController::class, 'approveUser']);
        Route::post('/users/{user}/suspend', [AdminController::class, 'suspendUser']);
        Route::get('/roles', [AdminController::class, 'listRoles']);
        Route::put('/roles/{role}/permissions', [AdminController::class, 'updateRolePermissions']);
        Route::get('/settings', [AdminController::class, 'listSettings']);
        Route::put('/settings', [AdminController::class, 'updateSettings']);
        Route::get('/activity-logs', [AdminController::class, 'activityLogs']);
    });

    // =========================================================================
    // MASTER DATA
    // =========================================================================
    Route::prefix('master')->group(function () {
        Route::get('/products', [MasterDataController::class, 'products'])->middleware('role:admin|manager|warehouse|purchasing|sales|finance');
        Route::post('/products', [MasterDataController::class, 'storeProduct'])->middleware('role:admin');
        Route::put('/products/{product}', [MasterDataController::class, 'updateProduct'])->middleware('role:admin');
        Route::get('/categories', [MasterDataController::class, 'categories'])->middleware('role:admin|manager|warehouse|purchasing|sales|finance');
        Route::post('/categories', [MasterDataController::class, 'storeCategory'])->middleware('role:admin');
        Route::get('/brands', [MasterDataController::class, 'brands'])->middleware('role:admin|manager|warehouse|purchasing|sales|finance');
        Route::get('/units', [MasterDataController::class, 'units'])->middleware('role:admin|manager|warehouse|purchasing|sales|finance');
        Route::get('/warehouses', [MasterDataController::class, 'warehouses'])->middleware('role:admin|manager|warehouse|purchasing|sales|finance');

        Route::get('/suppliers', [MasterDataController::class, 'suppliers'])->middleware('role:admin|manager|purchasing|finance');
        Route::post('/suppliers', [MasterDataController::class, 'storeSupplier'])->middleware('role:admin|purchasing');

        Route::get('/customers', [MasterDataController::class, 'customers'])->middleware('role:admin|manager|sales|finance');
        Route::post('/customers', [MasterDataController::class, 'storeCustomer'])->middleware('role:admin|sales');
    });

    // =========================================================================
    // INVENTORY & WAREHOUSE
    // =========================================================================
    Route::prefix('inventory')->group(function () {
        Route::get('/stocks', [InventoryController::class, 'stocks'])->middleware('role:admin|manager|warehouse|purchasing|sales|finance');
        Route::get('/movements', [InventoryController::class, 'movements'])->middleware('role:admin|manager|warehouse|finance');
        Route::get('/valuation', [InventoryController::class, 'valuation'])->middleware('role:admin|manager|warehouse|finance');
        Route::get('/barcode/{code}', [InventoryController::class, 'barcodeLookup'])->middleware('role:admin|manager|warehouse|purchasing|sales');

        Route::post('/stock-in', [InventoryController::class, 'stockIn'])->middleware('role:admin|warehouse');
        Route::post('/stock-out', [InventoryController::class, 'stockOut'])->middleware('role:admin|warehouse');

        Route::get('/adjustments', [InventoryController::class, 'adjustments'])->middleware('role:admin|manager|warehouse');
        Route::post('/adjustments', [InventoryController::class, 'createAdjustment'])->middleware('role:admin|warehouse');
        Route::post('/adjustments/{adjustment}/approve', [InventoryController::class, 'approveAdjustment'])->middleware('role:admin|manager');

        Route::get('/opnames', [InventoryController::class, 'opnames'])->middleware('role:admin|manager|warehouse');
        Route::post('/opnames', [InventoryController::class, 'createOpname'])->middleware('role:admin|warehouse');

        Route::get('/transfers', [InventoryController::class, 'transfers'])->middleware('role:admin|manager|warehouse');
        Route::post('/transfers', [InventoryController::class, 'createTransfer'])->middleware('role:admin|warehouse');
        Route::post('/transfers/{transfer}/receive', [InventoryController::class, 'receiveTransfer'])->middleware('role:admin|warehouse');
    });

    // =========================================================================
    // PROCUREMENT
    // =========================================================================
    Route::prefix('procurement')->group(function () {
        Route::get('/purchase-orders', [ProcurementController::class, 'purchaseOrders'])->middleware('role:admin|manager|purchasing|warehouse|finance');
        Route::post('/purchase-orders', [ProcurementController::class, 'createPurchaseOrder'])->middleware('role:admin|purchasing');
        Route::post('/purchase-orders/{purchaseOrder}/approve', [ProcurementController::class, 'approvePurchaseOrder'])->middleware('role:admin|manager');
        Route::post('/purchase-orders/{purchaseOrder}/receive', [ProcurementController::class, 'receiveGoods'])->middleware('role:admin|purchasing|warehouse');
        Route::get('/goods-receipts', [ProcurementController::class, 'goodsReceipts'])->middleware('role:admin|manager|purchasing|warehouse|finance');
        Route::get('/supplier-invoices', [ProcurementController::class, 'supplierInvoices'])->middleware('role:admin|manager|purchasing|finance');
        Route::get('/supplier-scorecards', [ProcurementController::class, 'supplierScorecards'])->middleware('role:admin|manager|purchasing');
    });

    // =========================================================================
    // SALES & POS
    // =========================================================================
    Route::prefix('sales')->group(function () {
        Route::get('/', [SalesController::class, 'index'])->middleware('role:admin|manager|sales|warehouse|finance');
        Route::get('/returns', [SalesController::class, 'returns'])->middleware('role:admin|manager|sales|finance');
        Route::get('/{sale}', [SalesController::class, 'show'])->middleware('role:admin|manager|sales|warehouse|finance');
        Route::post('/', [SalesController::class, 'store'])->middleware('role:admin|sales');
        Route::post('/{sale}/returns', [SalesController::class, 'createReturn'])->middleware('role:admin|manager|sales');
    });

    // =========================================================================
    // FINANCE
    // =========================================================================
    Route::prefix('finance')->middleware('role:admin|manager|finance')->group(function () {
        Route::get('/summary', [FinanceController::class, 'summary']);
        Route::get('/accounts', [FinanceController::class, 'accounts']);
        Route::get('/incomes', [FinanceController::class, 'incomes']);
        Route::get('/expenses', [FinanceController::class, 'expenses']);
        Route::get('/cash-bank', [FinanceController::class, 'cashBank']);
        Route::get('/accounts-receivable', [FinanceController::class, 'accountsReceivable']);
        Route::get('/accounts-payable', [FinanceController::class, 'accountsPayable']);

        Route::middleware('role:admin|finance')->group(function () {
            Route::post('/incomes', [FinanceController::class, 'storeIncome']);
            Route::post('/expenses', [FinanceController::class, 'storeExpense']);
            Route::post('/transfers', [FinanceController::class, 'transfer']);
            Route::post('/accounts-receivable/{ar}/collect', [FinanceController::class, 'collectAr']);
            Route::post('/accounts-payable/{ap}/pay', [FinanceController::class, 'payAp']);
        });
    });

    // =========================================================================
    // DOUBLE-ENTRY ACCOUNTING
    // =========================================================================
    Route::prefix('accounting')->middleware('role:admin|manager|finance')->group(function () {
        Route::get('/coa', [AccountingController::class, 'coa']);
        Route::get('/journals', [AccountingController::class, 'journals']);
        Route::get('/ledger', [AccountingController::class, 'generalLedger']);
        Route::get('/trial-balance', [AccountingController::class, 'trialBalance']);
        Route::get('/statements/income', [AccountingController::class, 'incomeStatement']);
        Route::get('/statements/balance-sheet', [AccountingController::class, 'balanceSheet']);
        Route::get('/statements/cash-flow', [AccountingController::class, 'cashFlow']);
        Route::get('/statements/equity', [AccountingController::class, 'changesInEquity']);
        Route::get('/periods', [AccountingController::class, 'periods']);

        Route::middleware('role:admin|finance')->group(function () {
            Route::post('/coa', [AccountingController::class, 'storeCoa']);
            Route::post('/journals', [AccountingController::class, 'postJournal']);
            Route::post('/journals/{journal}/reverse', [AccountingController::class, 'reverseJournal']);
            Route::post('/periods/{period}/close', [AccountingController::class, 'closePeriod']);
        });
    });

    // =========================================================================
    // INDONESIAN TAX MANAGEMENT
    // =========================================================================
    Route::prefix('tax')->group(function () {
        Route::get('/summary', [TaxController::class, 'summary'])->middleware('role:admin|manager|finance');
        Route::get('/types', [TaxController::class, 'types'])->middleware('role:admin|manager|finance|hr_payroll');
        Route::get('/rates', [TaxController::class, 'rates'])->middleware('role:admin|manager|finance|hr_payroll');
        Route::post('/rates', [TaxController::class, 'storeRate'])->middleware('role:admin');
        Route::post('/calculate/ppn', [TaxController::class, 'calculatePpn'])->middleware('role:admin|manager|finance|sales|purchasing');
        Route::post('/calculate/pph21', [TaxController::class, 'calculatePph21'])->middleware('role:admin|manager|finance|hr_payroll');
        Route::get('/transactions', [TaxController::class, 'transactions'])->middleware('role:admin|manager|finance');
        Route::get('/periods', [TaxController::class, 'periods'])->middleware('role:admin|manager|finance');
        Route::get('/payments', [TaxController::class, 'payments'])->middleware('role:admin|manager|finance');
        Route::post('/payments', [TaxController::class, 'storePayment'])->middleware('role:admin|finance');
    });

    // =========================================================================
    // HR & PAYROLL
    // =========================================================================
    Route::prefix('hr')->middleware('role:admin|manager|hr_payroll')->group(function () {
        Route::get('/departments', [HrPayrollController::class, 'departments']);
        Route::get('/positions', [HrPayrollController::class, 'positions']);
        Route::get('/employees', [HrPayrollController::class, 'employees']);
        Route::get('/employees/{employee}', [HrPayrollController::class, 'showEmployee']);
        Route::get('/attendances', [HrPayrollController::class, 'attendances']);
        Route::get('/leaves', [HrPayrollController::class, 'leaves']);

        Route::middleware('role:admin|hr_payroll')->group(function () {
            Route::post('/employees', [HrPayrollController::class, 'storeEmployee']);
            Route::post('/attendances', [HrPayrollController::class, 'storeAttendance']);
            Route::post('/leaves', [HrPayrollController::class, 'storeLeave']);
        });
    });

    Route::prefix('payroll')->group(function () {
        Route::get('/periods', [HrPayrollController::class, 'payrollPeriods'])->middleware('role:admin|manager|finance|hr_payroll');
        Route::post('/periods', [HrPayrollController::class, 'createPayrollPeriod'])->middleware('role:admin|hr_payroll');
        Route::post('/periods/{period}/run', [HrPayrollController::class, 'runPayroll'])->middleware('role:admin|hr_payroll');
        Route::post('/periods/{period}/hr-check', [HrPayrollController::class, 'hrCheck'])->middleware('role:admin|hr_payroll');
        Route::post('/periods/{period}/manager-approve', [HrPayrollController::class, 'managerApprove'])->middleware('role:admin|manager');
        Route::post('/periods/{period}/disburse', [HrPayrollController::class, 'disbursePayroll'])->middleware('role:admin|finance');
    });

    // =========================================================================
    // REPORTS & DEMAND FORECASTING
    // =========================================================================
    Route::prefix('reports')->middleware('role:admin|manager|warehouse|purchasing|finance')->group(function () {
        Route::get('/forecasts', [AnalyticsExportController::class, 'forecasts']);
        Route::post('/forecasts/generate', [AnalyticsExportController::class, 'generateForecasts'])->middleware('role:admin|manager|purchasing');
        Route::get('/reorder-recommendations', [AnalyticsExportController::class, 'reorderRecommendations']);
    });
});

<?php

namespace App\Services;

use App\Models\AccountsPayable;
use App\Models\AccountsReceivable;
use App\Models\DemandForecast;
use App\Models\Employee;
use App\Models\FinancialAccount;
use App\Models\InventoryStock;
use App\Models\PayrollPeriod;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\ReorderRecommendation;
use App\Models\Sale;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\User;

class AnalyticsService
{
    public function __construct(
        private readonly AccountingService $accounting,
        private readonly TaxService $tax
    ) {}

    /**
     * Moving Average Demand Forecast: F_t = sum(D_i) / n
     */
    public function calculateMovingAverage(array $historicalDemand, int $window = 3): float
    {
        $n = min(max(1, $window), count($historicalDemand));
        if ($n === 0) {
            return 0.0;
        }
        $slice = array_slice($historicalDemand, -$n);

        return round(array_sum($slice) / $n, 2);
    }

    /**
     * Reorder Point Formula: ROP = (AvgDailyDemand * LeadTimeDays) + SafetyStock
     */
    public function calculateReorderPoint(float $avgDailyDemand, int $leadTimeDays, float $safetyStock): float
    {
        return round(($avgDailyDemand * $leadTimeDays) + $safetyStock, 2);
    }

    public function generateForecastsAndReorders(int $windowMonths = 3): array
    {
        $products = Product::with('stocks')->where('is_active', true)->get();
        $forecasts = [];
        $reorders = [];

        foreach ($products as $product) {
            $monthlyDemand = [];
            for ($m = $windowMonths; $m >= 1; $m--) {
                $start = now()->subMonths($m)->startOfMonth();
                $end = now()->subMonths($m)->endOfMonth();
                $sold = (float) abs(StockMovement::where('product_id', $product->id)
                    ->where('movement_type', 'sale')
                    ->whereBetween('moved_at', [$start, $end])
                    ->sum('quantity'));
                $monthlyDemand[] = $sold > 0 ? $sold : max(2.0, (float) $product->min_stock);
            }

            $movingAvg = $this->calculateMovingAverage($monthlyDemand, $windowMonths);
            $avgDaily = round($movingAvg / 30, 4);
            $rop = $this->calculateReorderPoint($avgDaily, (int) $product->lead_time_days, (float) $product->safety_stock);

            $forecast = DemandForecast::create([
                'product_id' => $product->id,
                'forecast_period' => now()->addMonth()->format('Y-m'),
                'window_months' => $windowMonths,
                'historical_demand' => $monthlyDemand,
                'moving_average_demand' => $movingAvg,
                'recommended_order_qty' => max(0, round($movingAvg - (float) $product->stocks->sum('quantity'), 2)),
                'generated_at' => now(),
            ]);
            $forecasts[] = $forecast->load('product');

            foreach ($product->stocks as $stock) {
                $current = (float) $stock->quantity;
                if ($current <= $rop) {
                    $suggested = max(1, round(($rop + $product->safety_stock) - $current, 2));
                    $priority = $current <= $product->min_stock ? 'critical' : 'high';

                    $rec = ReorderRecommendation::create([
                        'product_id' => $product->id,
                        'warehouse_id' => $stock->warehouse_id,
                        'current_stock' => $current,
                        'avg_daily_demand' => $avgDaily,
                        'lead_time_days' => $product->lead_time_days,
                        'safety_stock' => $product->safety_stock,
                        'reorder_point' => $rop,
                        'suggested_order_qty' => $suggested,
                        'priority' => $priority,
                        'status' => 'open',
                        'calculated_at' => now(),
                    ]);
                    $reorders[] = $rec->load('product', 'warehouse');
                }
            }
        }

        return [
            'formula_moving_average' => 'SUM(D_i) / n',
            'formula_reorder_point' => '(AvgDailyDemand * LeadTimeDays) + SafetyStock',
            'forecasts' => $forecasts,
            'reorder_recommendations' => $reorders,
        ];
    }

    public function supplierScorecards(): array
    {
        return Supplier::where('is_active', true)->get()->map(function (Supplier $s) {
            $poCount = PurchaseOrder::where('supplier_id', $s->id)->count();
            $poVolume = (float) PurchaseOrder::where('supplier_id', $s->id)->sum('total_amount');
            $composite = round(((float) $s->on_time_delivery_rate * 0.45) + ((float) $s->quality_score * 0.45) + ((float) $s->rating * 2.0), 2);

            return [
                'supplier_id' => $s->id,
                'code' => $s->code,
                'name' => $s->name,
                'city' => $s->city,
                'rating' => (float) $s->rating,
                'on_time_delivery_rate' => (float) $s->on_time_delivery_rate,
                'quality_score' => (float) $s->quality_score,
                'composite_score' => min(100, $composite),
                'total_po_count' => $poCount,
                'total_po_volume' => round($poVolume, 2),
                'grade' => $composite >= 92 ? 'A (Preferred)' : ($composite >= 84 ? 'B (Reliable)' : 'C (Review)'),
            ];
        })->values()->all();
    }

    public function dashboardForUser(User $user): array
    {
        $role = $user->primary_role;

        $totalProducts = Product::where('is_active', true)->count();
        $inventoryValue = round((float) InventoryStock::sum('total_value'), 2);
        $lowStockCount = InventoryStock::query()
            ->join('products', 'products.id', '=', 'inventory_stocks.product_id')
            ->whereColumn('inventory_stocks.quantity', '<=', 'products.min_stock')
            ->count();

        $base = [
            'role' => $role,
            'generated_at' => now()->toIso8601String(),
        ];

        if (in_array($role, ['admin', 'manager'], true)) {
            $pl = $this->accounting->incomeStatement();
            $bs = $this->accounting->balanceSheet();
            $taxSummary = $this->tax->summary();

            return array_merge($base, [
                'scope' => 'executive',
                'kpis' => [
                    'total_products' => $totalProducts,
                    'inventory_value' => $inventoryValue,
                    'low_stock_alerts' => $lowStockCount,
                    'net_sales' => $pl['net_sales'],
                    'operating_expenses' => $pl['operating_expenses'],
                    'estimated_net_profit' => $pl['net_profit'],
                    'cash_and_bank_balance' => round((float) FinancialAccount::sum('current_balance'), 2),
                    'total_assets' => $bs['total_assets'],
                    'balance_sheet_balanced' => $bs['is_balanced'],
                    'ppn_net_payable' => $taxSummary['ppn_net_payable'],
                    'active_employees' => Employee::where('is_active', true)->count(),
                    'pending_google_approvals' => User::where('primary_role', 'guest_pending')->count(),
                ],
            ]);
        }

        if ($role === 'warehouse') {
            return array_merge($base, [
                'scope' => 'warehouse',
                'kpis' => [
                    'total_products' => $totalProducts,
                    'total_units_in_stock' => round((float) InventoryStock::sum('quantity'), 2),
                    'low_stock_alerts' => $lowStockCount,
                ],
            ]);
        }

        if ($role === 'purchasing') {
            return array_merge($base, [
                'scope' => 'procurement',
                'kpis' => [
                    'active_suppliers' => Supplier::where('is_active', true)->count(),
                    'open_purchase_orders' => PurchaseOrder::whereIn('status', ['draft', 'waiting_approval', 'approved', 'ordered'])->count(),
                    'low_stock_alerts' => $lowStockCount,
                ],
            ]);
        }

        if ($role === 'sales') {
            return array_merge($base, [
                'scope' => 'sales',
                'kpis' => [
                    'sales_count' => Sale::count(),
                    'gross_sales_total' => round((float) Sale::sum('total_amount'), 2),
                    'available_catalog_items' => $totalProducts,
                ],
            ]);
        }

        if ($role === 'finance') {
            $pl = $this->accounting->incomeStatement();

            return array_merge($base, [
                'scope' => 'finance',
                'kpis' => [
                    'cash_and_bank_balance' => round((float) FinancialAccount::sum('current_balance'), 2),
                    'accounts_receivable_open' => round((float) AccountsReceivable::whereIn('status', ['open', 'partial'])->sum('balance_amount'), 2),
                    'accounts_payable_open' => round((float) AccountsPayable::whereIn('status', ['open', 'partial'])->sum('balance_amount'), 2),
                    'net_profit' => $pl['net_profit'],
                    'ppn_net_payable' => $this->tax->summary()['ppn_net_payable'],
                ],
            ]);
        }

        // hr_payroll
        return array_merge($base, [
            'scope' => 'hr_payroll',
            'kpis' => [
                'active_employees' => Employee::where('is_active', true)->count(),
                'payroll_periods_count' => PayrollPeriod::count(),
                'latest_payroll_net' => round((float) (PayrollPeriod::latest('id')->first()?->total_net ?? 0), 2),
            ],
        ]);
    }
}

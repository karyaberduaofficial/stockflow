import React from 'react';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  DollarSign,
  PackageCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { ROLE_METADATA } from '../config/rbac';
import { MONTHLY_TREND_DATA } from '../data/mockData';
import { ExportActionBar, PageHeader, StatCard, StatusBadge } from '../components/common/UIPrimitives';
import { calculateReorderPoint, formatCompactIDR, formatIDR, getTotalProductStock } from '../utils/format';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { products, warehouses, coa, sales, purchaseOrders } = useStore();
  const navigate = useNavigate();

  const totalInventoryValue = products.reduce(
    (sum, p) => sum + getTotalProductStock(p.stockByWarehouse) * p.wacCost,
    0
  );
  const lowStockProducts = products.filter(
    (p) => getTotalProductStock(p.stockByWarehouse) <= p.minStock
  );

  const grossSales = coa.find((a) => a.code === '4101')?.balance || 0;
  const salesReturns = coa.find((a) => a.code === '4102')?.balance || 0;
  const netSales = grossSales - salesReturns;
  const cogs = coa.find((a) => a.code === '5101')?.balance || 0;
  const totalExpenses = coa
    .filter((a) => a.type === 'Expense')
    .reduce((sum, a) => sum + a.balance, 0);
  const netProfit = netSales - cogs - totalExpenses;

  const showFinancialKPIs = ['admin', 'manager', 'finance'].includes(user?.role || '');

  // Chart 1: Line — Sales vs Purchases Trend (Forest Pine & Terracotta — ZERO BLUE)
  const trendChartData = {
    labels: MONTHLY_TREND_DATA.labels,
    datasets: [
      {
        label: 'Pendapatan Penjualan',
        data: MONTHLY_TREND_DATA.sales.map((v) => v / 1_000_000),
        borderColor: '#1B4332',
        backgroundColor: 'rgba(27, 67, 50, 0.12)',
        fill: true,
        tension: 0.36,
        pointBackgroundColor: '#1B4332',
        pointBorderColor: '#FAF8F5',
        pointBorderWidth: 2,
        pointRadius: 4,
      },
      {
        label: 'Pengadaan & Pembelian',
        data: MONTHLY_TREND_DATA.purchases.map((v) => v / 1_000_000),
        borderColor: '#C2592B',
        backgroundColor: 'rgba(194, 89, 43, 0.08)',
        fill: true,
        tension: 0.36,
        pointBackgroundColor: '#C2592B',
        pointBorderColor: '#FAF8F5',
        pointBorderWidth: 2,
        pointRadius: 4,
      },
      {
        label: 'Beban Operasional',
        data: MONTHLY_TREND_DATA.expenses.map((v) => v / 1_000_000),
        borderColor: '#B47B1B',
        backgroundColor: 'transparent',
        borderDash: [5, 4],
        tension: 0.3,
        pointRadius: 3,
      },
    ],
  };

  // Chart 2: Bar — Warehouse Stock Value (WAC)
  const warehouseValues = warehouses.map((wh) =>
    products.reduce((sum, p) => sum + (p.stockByWarehouse[wh.id] || 0) * p.wacCost, 0) / 1_000_000
  );
  const warehouseBarData = {
    labels: warehouses.map((w) => w.code),
    datasets: [
      {
        label: 'Nilai Persediaan WAC (Juta Rp)',
        data: warehouseValues,
        backgroundColor: ['#1B4332', '#C2592B', '#B47B1B', '#4D7C0F'],
        borderRadius: 8,
        maxBarThickness: 44,
      },
    ],
  };

  // Chart 3: Doughnut — Category Valuation Share (NO BLUE!)
  const categoryTotals: Record<string, number> = {};
  products.forEach((p) => {
    const val = getTotalProductStock(p.stockByWarehouse) * p.wacCost;
    categoryTotals[p.categoryName] = (categoryTotals[p.categoryName] || 0) + val;
  });
  const doughnutData = {
    labels: Object.keys(categoryTotals),
    datasets: [
      {
        data: Object.values(categoryTotals).map((v) => Math.round(v / 1_000_000)),
        backgroundColor: ['#1B4332', '#C2592B', '#B47B1B', '#4D7C0F', '#7F1D4A', '#57534E'],
        borderColor: '#FFFFFF',
        borderWidth: 2,
      },
    ],
  };

  const chartOptionsCommon = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: '#57534E',
          font: { family: 'Inter', size: 11 },
          boxWidth: 12,
          padding: 14,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#78716C', font: { family: 'Inter', size: 11 } },
      },
      y: {
        grid: { color: '#F3EFE9' },
        ticks: {
          color: '#78716C',
          font: { family: 'JetBrains Mono', size: 10 },
          callback: (val: string | number) => `Rp ${val}Jt`,
        },
      },
    },
  };

  const roleMeta = user ? ROLE_METADATA[user.role] : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Workspace • ${roleMeta?.label || 'StockFlow'}`}
        title={`Selamat Datang, ${user?.name || 'Pengguna'}`}
        subtitle="Ringkasan waktu nyata persediaan multi-gudang, penjualan showroom, kas operasional, dan estimasi laba bersih PT Karya Berdua Homeware & Furniture."
        actions={
          showFinancialKPIs ? (
            <ExportActionBar report="financial" label="Ekspor Cepat" compact />
          ) : (
            <ExportActionBar report="inventory" label="Ekspor Stok" compact />
          )
        }
      />

      {/* Primary KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Total SKU Aktif"
          value={`${products.length} Produk`}
          hint={`${warehouses.length} lokasi gudang & showroom`}
          trend={{ text: '+4 SKU baru Q4', tone: 'positive' }}
          icon={<Boxes className="h-5 w-5" />}
          accent="pine"
          staggerClass="sf-stagger-1"
        />
        <StatCard
          label="Nilai Persediaan (WAC)"
          value={formatCompactIDR(totalInventoryValue)}
          hint={formatIDR(totalInventoryValue)}
          trend={{ text: 'Weighted Average Cost', tone: 'neutral' }}
          icon={<PackageCheck className="h-5 w-5" />}
          accent="olive"
          staggerClass="sf-stagger-2"
        />
        <StatCard
          label="Peringatan Stok Rendah"
          value={`${lowStockProducts.length} Item Kritis`}
          hint="Di bawah batas stok minimum"
          trend={{
            text: lowStockProducts.length > 0 ? 'Perlu Restock PO' : 'Semua Aman',
            tone: lowStockProducts.length > 0 ? 'negative' : 'positive',
          }}
          icon={<AlertTriangle className="h-5 w-5" />}
          accent="danger"
          staggerClass="sf-stagger-3"
        />
        {showFinancialKPIs && (
          <>
            <StatCard
              label="Pendapatan Bersih (Nov)"
              value={formatCompactIDR(netSales)}
              hint={`${sales.length} transaksi tercatat periode ini`}
              trend={{ text: '+8.4% vs Okt', tone: 'positive' }}
              icon={<TrendingUp className="h-5 w-5" />}
              accent="pine"
              staggerClass="sf-stagger-1"
            />
            <StatCard
              label="Total Beban Operasional"
              value={formatCompactIDR(totalExpenses)}
              hint="Gaji, BPJS pemberi kerja, sewa, logistik"
              trend={{ text: '16.8% rasio terhadap omzet', tone: 'neutral' }}
              icon={<TrendingDown className="h-5 w-5" />}
              accent="terracotta"
              staggerClass="sf-stagger-2"
            />
            <StatCard
              label="Estimasi Laba Bersih"
              value={formatCompactIDR(netProfit)}
              hint={`Margin bersih ${((netProfit / (netSales || 1)) * 100).toFixed(1)}%`}
              trend={{ text: 'Double-Entry Terverifikasi', tone: 'positive' }}
              icon={<DollarSign className="h-5 w-5" />}
              accent="ochre"
              staggerClass="sf-stagger-3"
            />
          </>
        )}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Trend Line Chart */}
        <div className="rounded-2xl border border-alabaster-sand bg-white p-5 shadow-card lg:col-span-8">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-bold text-espresso-900">
                Tren Penjualan vs Pengadaan &amp; Beban (6 Bulan)
              </h2>
              <p className="text-xs text-espresso-500">Dalam jutaan Rupiah (IDR)</p>
            </div>
            <StatusBadge label="Periode 2026" tone="pine" />
          </div>
          <div className="h-72">
            <Line data={trendChartData} options={chartOptionsCommon} />
          </div>
        </div>

        {/* Doughnut Category Share */}
        <div className="rounded-2xl border border-alabaster-sand bg-white p-5 shadow-card lg:col-span-4">
          <div className="mb-4">
            <h2 className="font-display text-base font-bold text-espresso-900">Komposisi Nilai Kategori</h2>
            <p className="text-xs text-espresso-500">Valuasi persediaan WAC per kategori (Juta Rp)</p>
          </div>
          <div className="h-72">
            <Doughnut
              data={doughnutData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                cutout: '62%',
                plugins: {
                  legend: {
                    position: 'bottom',
                    labels: { color: '#57534E', font: { family: 'Inter', size: 11 }, boxWidth: 10 },
                  },
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* Second Row: Warehouse Stock Bar + Low Stock Action Queue */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="rounded-2xl border border-alabaster-sand bg-white p-5 shadow-card lg:col-span-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-bold text-espresso-900">Distribusi Valuasi per Gudang</h2>
              <p className="text-xs text-espresso-500">Nilai stok WAC di 4 lokasi cabang</p>
            </div>
            <Wallet className="h-4 w-4 text-pine-600" />
          </div>
          <div className="h-64">
            <Bar data={warehouseBarData} options={chartOptionsCommon} />
          </div>
        </div>

        <div className="rounded-2xl border border-alabaster-sand bg-white p-5 shadow-card lg:col-span-7">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-bold text-espresso-900">
                Peringatan Stok Minimum &amp; Rekomendasi Reorder
              </h2>
              <p className="text-xs text-espresso-500">
                Rumus ROP = (Rata-rata Permintaan Harian × Lead Time) + Safety Stock
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/inventory')}
              className="inline-flex items-center gap-1 rounded-lg bg-pine-50 px-3 py-1.5 text-xs font-semibold text-pine-700 hover:bg-pine-600 hover:text-alabaster"
            >
              Buka Gudang <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-alabaster-sand bg-alabaster text-[11px] uppercase tracking-wider text-espresso-500">
                <tr>
                  <th className="px-3 py-2.5">Produk &amp; SKU</th>
                  <th className="px-3 py-2.5 text-right">Stok Total</th>
                  <th className="px-3 py-2.5 text-right">Min / ROP</th>
                  <th className="px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-alabaster-subtle">
                {products
                  .filter(
                    (p) =>
                      getTotalProductStock(p.stockByWarehouse) <=
                      calculateReorderPoint(p.avgDailyDemand, p.leadTimeDays, p.safetyStock)
                  )
                  .slice(0, 5)
                  .map((p) => {
                    const total = getTotalProductStock(p.stockByWarehouse);
                    const rop = calculateReorderPoint(p.avgDailyDemand, p.leadTimeDays, p.safetyStock);
                    const critical = total <= p.minStock;
                    return (
                      <tr key={p.id} className="hover:bg-alabaster/70">
                        <td className="px-3 py-2.5">
                          <p className="font-semibold text-espresso-900">{p.name}</p>
                          <p className="font-mono text-[11px] text-espresso-500">{p.sku} • {p.categoryName}</p>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-espresso-900 sf-tabular">
                          {total} {p.unitCode}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-espresso-600 sf-tabular">
                          {p.minStock} / {rop}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge
                            label={critical ? 'KRITIS — RESTOCK' : 'MENDEKATI ROP'}
                            tone={critical ? 'danger' : 'warning'}
                          />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-alabaster-subtle pt-3 text-xs text-espresso-500">
            <span>PO Menunggu Persetujuan: <strong className="font-mono text-espresso-900">{purchaseOrders.filter((p) => p.status === 'waiting_approval').length}</strong></span>
            <span>Transaksi Penjualan Aktif: <strong className="font-mono text-espresso-900">{sales.length}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};

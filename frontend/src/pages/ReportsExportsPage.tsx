import React, { useState } from 'react';
import { Calculator, FileSpreadsheet, TrendingUp } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { ExportActionBar, PageHeader, StatusBadge } from '../components/common/UIPrimitives';
import { ExportReportType } from '../services/exportService';
import { calculateMovingAverage, calculateReorderPoint, formatIDR, getTotalProductStock } from '../utils/format';

const EXPORT_CATALOG: { report: ExportReportType; title: string; description: string; badge: string }[] = [
  {
    report: 'inventory',
    title: 'Laporan Valuasi Persediaan (WAC) & Reorder Point',
    description: 'Saldo multi-gudang, biaya rata-rata tertimbang (WAC), formula SUM & status stok minimum.',
    badge: 'Gudang',
  },
  {
    report: 'financial',
    title: 'Laporan Keuangan Lengkap (Neraca Saldo, Laba Rugi & Neraca)',
    description: 'Verifikasi double-entry Debit = Kredit, Aset = Liabilitas + Ekuitas, berformula Excel hidup.',
    badge: 'Akuntansi',
  },
  {
    report: 'tax',
    title: 'Rekapitulasi Pajak PPN (DPP 11/12) & PPh 21 TER',
    description: 'PPN Keluaran vs PPN Masukan, jadwal jatuh tempo setor, dan catatan kepatuhan PMK 131/2024.',
    badge: 'Pajak',
  },
  {
    report: 'payroll',
    title: 'Ringkasan Penggajian & Split BPJS Karyawan/Perusahaan',
    description: 'Bruto, potongan BPJS karyawan, PPh 21 TER, Take Home Pay, serta beban BPJS pemberi kerja.',
    badge: 'HR & Payroll',
  },
  {
    report: 'invoice',
    title: 'Faktur Penjualan Resmi (Sample Terbaru)',
    description: 'Faktur ritel/B2B bermerek StockFlow lengkap dengan rincian SKU dan PPN efektif.',
    badge: 'Sales',
  },
  {
    report: 'payslip',
    title: 'Slip Gaji Digital Karyawan (Confidential Sample)',
    description: 'Slip gaji rahasia terstruktur dengan pemisahan kontribusi BPJS pemberi kerja.',
    badge: 'Payroll',
  },
];

export const ReportsExportsPage: React.FC = () => {
  const { products, sales, payrolls } = useStore();
  const [selectedProdId, setSelectedProdId] = useState(products[2]?.id || 3);
  const [customDaily, setCustomDaily] = useState(2.2);
  const [customLead, setCustomLead] = useState(7);
  const [customSafety, setCustomSafety] = useState(6);

  const selectedProduct = products.find((p) => p.id === selectedProdId) || products[0];
  const historicalMonths = [28, 32, 35, 31, 38, 41];
  const forecastNext = calculateMovingAverage(historicalMonths, 3);
  const computedRop = calculateReorderPoint(customDaily, customLead, customSafety);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Modul 10 & 11 • Analitik Peramalan & Pusat Ekspor"
        title="Demand Forecast, Kalkulator Reorder Point & Unduh Dokumen"
        subtitle="Unduh dokumen operasional siap cetak dalam format PDF, Word (.docx), dan Excel (.xlsx) berformula hidup dengan palet resmi bebas biru."
      />

      {/* Document Export Center */}
      <section className="rounded-2xl border border-alabaster-sand bg-white p-6 shadow-card">
        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pine-50 text-pine-700 border border-pine-100">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-espresso-900">Pusat Unduh Dokumen Resmi (PDF / Word / Excel)</h2>
            <p className="text-xs text-espresso-500">
              Terhubung ke endpoint <code className="font-mono">/api/exports/&#123;report&#125;/&#123;format&#125;</code> dengan generator lokal otomatis bermerek StockFlow.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {EXPORT_CATALOG.map((item) => (
            <div
              key={item.report}
              className="flex flex-col justify-between rounded-xl border border-alabaster-sand bg-alabaster/60 p-4 sf-card-interactive"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-sm font-bold text-espresso-900">{item.title}</h3>
                  <StatusBadge label={item.badge} tone="pine" />
                </div>
                <p className="mt-1 text-xs text-espresso-600">{item.description}</p>
              </div>
              <div className="mt-4 border-t border-alabaster-sand pt-3">
                <ExportActionBar
                  report={item.report}
                  selectedSale={sales[0]}
                  selectedPayslip={payrolls[0]}
                  compact
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Moving Average Forecast & Reorder Point Calculator */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="rounded-2xl border border-alabaster-sand bg-white p-5 shadow-card lg:col-span-5">
          <h3 className="flex items-center gap-2 font-display text-base font-bold text-espresso-900">
            <Calculator className="h-4 w-4 text-terracotta-600" /> Kalkulator Reorder Point (ROP) Interaktif
          </h3>
          <p className="mt-1 font-mono text-[11px] text-pine-700">
            ROP = (Rata-rata Permintaan Harian × Lead Time) + Safety Stock
          </p>

          <div className="mt-4 space-y-3 text-xs">
            <div>
              <label className="mb-1 block font-semibold text-espresso-700">Ambil Preset dari SKU</label>
              <select
                value={selectedProdId}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setSelectedProdId(id);
                  const p = products.find((x) => x.id === id);
                  if (p) {
                    setCustomDaily(p.avgDailyDemand);
                    setCustomLead(p.leadTimeDays);
                    setCustomSafety(p.safetyStock);
                  }
                }}
                className="w-full rounded-lg border border-alabaster-sand px-3 py-2"
              >
                {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="mb-1 block font-semibold">Demand/Hari</label>
                <input type="number" step="0.1" value={customDaily} onChange={(e) => setCustomDaily(Number(e.target.value))} className="w-full rounded-lg border border-alabaster-sand px-2.5 py-2 font-mono" />
              </div>
              <div>
                <label className="mb-1 block font-semibold">Lead Time (Hr)</label>
                <input type="number" value={customLead} onChange={(e) => setCustomLead(Number(e.target.value))} className="w-full rounded-lg border border-alabaster-sand px-2.5 py-2 font-mono" />
              </div>
              <div>
                <label className="mb-1 block font-semibold">Safety Stock</label>
                <input type="number" value={customSafety} onChange={(e) => setCustomSafety(Number(e.target.value))} className="w-full rounded-lg border border-alabaster-sand px-2.5 py-2 font-mono" />
              </div>
            </div>

            <div className="rounded-xl border border-pine-200 bg-pine-50 p-4">
              <p className="text-[11px] font-semibold text-pine-700">HASIL REORDER POINT &amp; MOVING AVERAGE (3-BULAN)</p>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="font-mono text-2xl font-extrabold text-pine-800">{computedRop} Unit</span>
                <span className="font-mono text-xs text-espresso-700">Forecast Bulan Depan: <strong>{forecastNext} unit</strong></span>
              </div>
              <p className="mt-1 text-[11px] text-espresso-600">
                Stok aktual {selectedProduct.sku}: <strong>{getTotalProductStock(selectedProduct.stockByWarehouse)} unit</strong> —{' '}
                {getTotalProductStock(selectedProduct.stockByWarehouse) <= computedRop ? 'Segera terbitkan PO restock!' : 'Persediaan masih di atas batas ROP.'}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-alabaster-sand bg-white p-5 shadow-card lg:col-span-7">
          <h3 className="flex items-center gap-2 font-display text-base font-bold text-espresso-900">
            <TrendingUp className="h-4 w-4 text-pine-600" /> Matriks Rekomendasi Restock &amp; Margin Produk
          </h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-alabaster-sand bg-alabaster text-[11px] uppercase text-espresso-500">
                <tr>
                  <th className="px-3 py-2.5">SKU &amp; Produk</th>
                  <th className="px-3 py-2.5 text-right">Stok</th>
                  <th className="px-3 py-2.5 text-right">ROP</th>
                  <th className="px-3 py-2.5 text-right">Margin / Unit</th>
                  <th className="px-3 py-2.5">Saran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-alabaster-subtle">
                {products.slice(0, 8).map((p) => {
                  const qty = getTotalProductStock(p.stockByWarehouse);
                  const rop = calculateReorderPoint(p.avgDailyDemand, p.leadTimeDays, p.safetyStock);
                  const margin = p.sellPrice - p.wacCost;
                  return (
                    <tr key={p.id}>
                      <td className="px-3 py-2">
                        <p className="font-semibold text-espresso-900">{p.name}</p>
                        <p className="font-mono text-[10px] text-pine-700">{p.sku}</p>
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold">{qty}</td>
                      <td className="px-3 py-2 text-right font-mono">{rop}</td>
                      <td className="px-3 py-2 text-right font-mono text-pine-700">{formatIDR(margin)}</td>
                      <td className="px-3 py-2">
                        <StatusBadge label={qty <= rop ? 'BUAT PO' : 'OPTIMAL'} tone={qty <= rop ? 'danger' : 'success'} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeftRight,
  Barcode,
  Check,
  ClipboardCheck,
  PackageMinus,
  PackagePlus,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import {
  BarcodeScannerModal,
  ExportActionBar,
  PageHeader,
  StatusBadge,
  TabBar,
} from '../components/common/UIPrimitives';
import { calculateReorderPoint, formatIDR, getTotalProductStock } from '../utils/format';

export const InventoryPage: React.FC = () => {
  const { user } = useAuth();
  const {
    products,
    warehouses,
    stockMovements,
    adjustments,
    transfers,
    recordStockMovement,
    requestAdjustment,
    decideAdjustment,
    createTransfer,
    confirmTransferReceipt,
  } = useStore();

  const [activeTab, setActiveTab] = useState('overview');
  const [scannerOpen, setScannerOpen] = useState(false);

  // Stock In/Out form
  const [movType, setMovType] = useState<'stock_in' | 'stock_out'>('stock_out');
  const [movProductId, setMovProductId] = useState(products[0]?.id || 1);
  const [movWarehouseId, setMovWarehouseId] = useState(warehouses[0]?.id || 1);
  const [movQty, setMovQty] = useState(2);
  const [movCost, setMovCost] = useState(products[0]?.wacCost || 4_850_000);
  const [movNotes, setMovNotes] = useState('');
  const [movError, setMovError] = useState<string | null>(null);

  // Adjustment / Opname form
  const [adjProductId, setAdjProductId] = useState(products[2]?.id || 3);
  const [adjWarehouseId, setAdjWarehouseId] = useState(1);
  const [adjActual, setAdjActual] = useState(5);
  const [adjReason, setAdjReason] = useState('Hasil hitung fisik Stock Opname Q4');
  const [opnameCounts, setOpnameCounts] = useState<Record<number, number>>({});

  // Transfer form
  const [trfProductId, setTrfProductId] = useState(products[0]?.id || 1);
  const [trfFromId, setTrfFromId] = useState(1);
  const [trfToId, setTrfToId] = useState(2);
  const [trfQty, setTrfQty] = useState(2);
  const [trfNotes, setTrfNotes] = useState('Distribusi stok display showroom');
  const [trfError, setTrfError] = useState<string | null>(null);

  const canMutateStock = ['admin', 'warehouse'].includes(user?.role || '');
  const canApproveAdj = ['admin', 'manager'].includes(user?.role || '');

  const handleStockMove = (e: React.FormEvent) => {
    e.preventDefault();
    setMovError(null);
    if (!user) return;
    const res = recordStockMovement(
      {
        productId: Number(movProductId),
        warehouseId: Number(movWarehouseId),
        type: movType,
        qty: Number(movQty),
        unitCost: Number(movCost),
        notes: movNotes || (movType === 'stock_in' ? 'Penerimaan gudang manual' : 'Pengeluaran gudang manual'),
      },
      user
    );
    if (!res.ok) setMovError(res.error || 'Gagal mencatat pergerakan stok.');
    else setMovNotes('');
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTrfError(null);
    if (!user) return;
    const res = createTransfer(
      {
        productId: Number(trfProductId),
        fromWarehouseId: Number(trfFromId),
        toWarehouseId: Number(trfToId),
        qty: Number(trfQty),
        notes: trfNotes,
      },
      user
    );
    if (!res.ok) setTrfError(res.error || 'Transfer gagal.');
  };

  return (
    <div>
      <PageHeader
        eyebrow="Modul 03 • Inventaris & Multi-Gudang"
        title="Kontrol Stok, WAC, Opname & Mutasi Gudang"
        subtitle="Pantau persediaan real-time di 4 gudang, validasi stok anti-negatif, konfirmasi transfer in-transit, dan ekspor valuasi WAC."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-espresso-900 px-3.5 py-2 text-xs font-bold text-alabaster hover:bg-pine-600"
            >
              <Barcode className="h-4 w-4" /> Scan Barcode / QR
            </button>
            <ExportActionBar report="inventory" compact />
          </div>
        }
      />

      <TabBar
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'overview', label: 'Stok & Valuasi WAC', count: products.length },
          { id: 'inout', label: 'Stok Masuk / Keluar' },
          { id: 'transfers', label: 'Transfer Antar Gudang', count: transfers.filter((t) => t.status === 'in_transit').length },
          { id: 'adjustments', label: 'Penyesuaian & Approval', count: adjustments.filter((a) => a.status === 'pending').length },
          { id: 'opname', label: 'Lembar Stock Opname' },
          { id: 'history', label: 'Riwayat Mutasi', count: stockMovements.length },
        ]}
      />

      {activeTab === 'overview' && (
        <div className="overflow-hidden rounded-2xl border border-alabaster-sand bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-alabaster-sand bg-alabaster text-[11px] uppercase text-espresso-500">
                <tr>
                  <th className="px-4 py-3">SKU &amp; Produk</th>
                  {warehouses.map((w) => (
                    <th key={w.id} className="px-3 py-3 text-right font-mono">{w.code}</th>
                  ))}
                  <th className="px-3 py-3 text-right">Total</th>
                  <th className="px-3 py-3 text-right">ROP</th>
                  <th className="px-4 py-3 text-right">WAC / Unit</th>
                  <th className="px-4 py-3 text-right">Valuasi Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-alabaster-subtle">
                {products.map((p) => {
                  const total = getTotalProductStock(p.stockByWarehouse);
                  const rop = calculateReorderPoint(p.avgDailyDemand, p.leadTimeDays, p.safetyStock);
                  return (
                    <tr key={p.id} className="hover:bg-alabaster/70">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-espresso-900">{p.name}</p>
                        <p className="font-mono text-[11px] text-pine-700">{p.sku} • {p.barcode}</p>
                      </td>
                      {warehouses.map((w) => (
                        <td key={w.id} className="px-3 py-3 text-right font-mono sf-tabular text-espresso-700">
                          {p.stockByWarehouse[w.id] || 0}
                        </td>
                      ))}
                      <td className="px-3 py-3 text-right font-mono font-bold sf-tabular">
                        <span className={total <= p.minStock ? 'text-semantic-danger' : 'text-espresso-900'}>
                          {total}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right font-mono sf-tabular text-espresso-500">{rop}</td>
                      <td className="px-4 py-3 text-right font-mono sf-tabular text-espresso-700">{formatIDR(p.wacCost)}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold sf-tabular text-pine-700">
                        {formatIDR(total * p.wacCost)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'inout' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="rounded-2xl border border-alabaster-sand bg-white p-6 shadow-card lg:col-span-6">
            <h3 className="font-display text-base font-bold text-espresso-900">Catat Transaksi Stok Masuk / Keluar</h3>
            <p className="mt-1 text-xs text-espresso-600">
              Sistem menerapkan proteksi <strong>Non-Negative Stock Guard</strong> — pengeluaran melebihi stok gudang akan ditolak otomatis.
            </p>

            {movError && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-semantic-danger/30 bg-semantic-dangerBg p-3 text-xs font-semibold text-semantic-danger">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{movError}</span>
              </div>
            )}

            <form onSubmit={handleStockMove} className="mt-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMovType('stock_in')}
                  className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 font-bold transition ${
                    movType === 'stock_in'
                      ? 'border-pine-600 bg-pine-600 text-alabaster'
                      : 'border-alabaster-sand bg-alabaster text-espresso-700'
                  }`}
                >
                  <PackagePlus className="h-4 w-4" /> Stok Masuk (IN)
                </button>
                <button
                  type="button"
                  onClick={() => setMovType('stock_out')}
                  className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 font-bold transition ${
                    movType === 'stock_out'
                      ? 'border-terracotta-600 bg-terracotta-600 text-alabaster'
                      : 'border-alabaster-sand bg-alabaster text-espresso-700'
                  }`}
                >
                  <PackageMinus className="h-4 w-4" /> Stok Keluar (OUT)
                </button>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-espresso-700">Produk</label>
                <select
                  value={movProductId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setMovProductId(id);
                    const p = products.find((item) => item.id === id);
                    if (p) setMovCost(p.wacCost);
                  }}
                  className="w-full rounded-lg border border-alabaster-sand px-3 py-2"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name} (Stok WH terpilih: {p.stockByWarehouse[movWarehouseId] || 0})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-espresso-700">Gudang</label>
                  <select
                    value={movWarehouseId}
                    onChange={(e) => setMovWarehouseId(Number(e.target.value))}
                    className="w-full rounded-lg border border-alabaster-sand px-3 py-2"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-espresso-700">Jumlah Unit</label>
                  <input
                    type="number"
                    min={1}
                    value={movQty}
                    onChange={(e) => setMovQty(Number(e.target.value))}
                    className="w-full rounded-lg border border-alabaster-sand px-3 py-2 font-mono"
                  />
                </div>
              </div>

              {movType === 'stock_in' && (
                <div>
                  <label className="mb-1 block font-semibold text-espresso-700">Biaya Perolehan / Unit (untuk WAC)</label>
                  <input
                    type="number"
                    min={0}
                    value={movCost}
                    onChange={(e) => setMovCost(Number(e.target.value))}
                    className="w-full rounded-lg border border-alabaster-sand px-3 py-2 font-mono"
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block font-semibold text-espresso-700">Catatan / Referensi</label>
                <input
                  type="text"
                  value={movNotes}
                  onChange={(e) => setMovNotes(e.target.value)}
                  placeholder="Contoh: Pengiriman sampel proyek interior"
                  className="w-full rounded-lg border border-alabaster-sand px-3 py-2"
                />
              </div>

              <button
                type="submit"
                disabled={!canMutateStock}
                className="w-full rounded-xl bg-pine-600 py-2.5 text-xs font-bold text-alabaster hover:bg-pine-700 disabled:opacity-50"
              >
                {canMutateStock ? 'Simpan Pergerakan Stok' : 'Mode Baca Saja (Khusus Warehouse / Admin)'}
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-alabaster-sand bg-white p-6 shadow-card lg:col-span-6">
            <h3 className="font-display text-base font-bold text-espresso-900">Ringkasan Metode Weighted Average Cost (WAC)</h3>
            <p className="mt-1 text-xs text-espresso-600">
              Setiap transaksi Stok Masuk otomatis menghitung ulang biaya rata-rata tertimbang:
            </p>
            <div className="mt-4 rounded-xl border border-pine-200 bg-pine-50/70 p-4 font-mono text-xs text-pine-800">
              WAC Baru = ((Stok Lama × WAC Lama) + (Qty Masuk × Harga Beli Baru)) ÷ Total Stok Baru
            </div>
            <div className="mt-4 space-y-2 text-xs text-espresso-700">
              <p>• <strong>Stok Keluar</strong> menggunakan biaya WAC aktif tanpa mengubah nilai rata-rata per unit.</p>
              <p>• <strong>Penolakan Stok Negatif</strong> mencegah pengeluaran barang jika saldo gudang asal &lt; qty diminta.</p>
              <p>• Seluruh pergerakan tercatat permanen pada tab <strong>Riwayat Mutasi</strong>.</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'transfers' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="rounded-2xl border border-alabaster-sand bg-white p-5 shadow-card lg:col-span-4">
            <h3 className="flex items-center gap-2 font-display text-base font-bold text-espresso-900">
              <ArrowLeftRight className="h-4 w-4 text-pine-600" /> Buat Transfer Gudang
            </h3>
            {trfError && (
              <div className="mt-3 rounded-lg bg-semantic-dangerBg p-2.5 text-xs font-semibold text-semantic-danger">
                {trfError}
              </div>
            )}
            <form onSubmit={handleTransferSubmit} className="mt-3 space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-semibold text-espresso-700">Produk</label>
                <select value={trfProductId} onChange={(e) => setTrfProductId(Number(e.target.value))} className="w-full rounded-lg border border-alabaster-sand px-3 py-2">
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block font-semibold text-espresso-700">Dari Gudang</label>
                  <select value={trfFromId} onChange={(e) => setTrfFromId(Number(e.target.value))} className="w-full rounded-lg border border-alabaster-sand px-2.5 py-2">
                    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-espresso-700">Ke Gudang</label>
                  <select value={trfToId} onChange={(e) => setTrfToId(Number(e.target.value))} className="w-full rounded-lg border border-alabaster-sand px-2.5 py-2">
                    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block font-semibold text-espresso-700">Jumlah Unit</label>
                <input type="number" min={1} value={trfQty} onChange={(e) => setTrfQty(Number(e.target.value))} className="w-full rounded-lg border border-alabaster-sand px-3 py-2 font-mono" />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-espresso-700">Catatan Pengiriman</label>
                <input value={trfNotes} onChange={(e) => setTrfNotes(e.target.value)} className="w-full rounded-lg border border-alabaster-sand px-3 py-2" />
              </div>
              <button
                type="submit"
                disabled={!canMutateStock}
                className="w-full rounded-xl bg-pine-600 py-2.5 font-bold text-alabaster hover:bg-pine-700 disabled:opacity-50"
              >
                Kirim Transfer (In-Transit)
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-alabaster-sand bg-white p-5 shadow-card lg:col-span-8">
            <h3 className="font-display text-base font-bold text-espresso-900">Daftar Transfer Multi-Gudang</h3>
            <div className="mt-4 space-y-3">
              {transfers.map((t) => (
                <div key={t.id} className="flex flex-col gap-3 rounded-xl border border-alabaster-sand bg-alabaster/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-pine-700">{t.transferNo}</span>
                      <StatusBadge
                        label={t.status === 'in_transit' ? 'IN TRANSIT' : 'DITERIMA'}
                        tone={t.status === 'in_transit' ? 'info' : 'success'}
                      />
                    </div>
                    <p className="mt-1 font-semibold text-espresso-900">{t.productName} ({t.qty} unit)</p>
                    <p className="text-espresso-600">{t.fromWarehouseName} → {t.toWarehouseName} • {t.date}</p>
                  </div>
                  {t.status === 'in_transit' && canMutateStock && user && (
                    <button
                      type="button"
                      onClick={() => confirmTransferReceipt(t.id, user)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-pine-600 px-3.5 py-2 text-xs font-bold text-alabaster hover:bg-pine-700"
                    >
                      <Check className="h-4 w-4" /> Konfirmasi Terima
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'adjustments' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="rounded-2xl border border-alabaster-sand bg-white p-5 shadow-card lg:col-span-4">
            <h3 className="font-display text-base font-bold text-espresso-900">Ajukan Penyesuaian Stok</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!user) return;
                requestAdjustment(
                  { productId: adjProductId, warehouseId: adjWarehouseId, actualQty: adjActual, reason: adjReason },
                  user
                );
              }}
              className="mt-3 space-y-3 text-xs"
            >
              <div>
                <label className="mb-1 block font-semibold">Produk</label>
                <select value={adjProductId} onChange={(e) => setAdjProductId(Number(e.target.value))} className="w-full rounded-lg border border-alabaster-sand px-3 py-2">
                  {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block font-semibold">Gudang</label>
                  <select value={adjWarehouseId} onChange={(e) => setAdjWarehouseId(Number(e.target.value))} className="w-full rounded-lg border border-alabaster-sand px-2.5 py-2">
                    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-semibold">Qty Fisik Aktual</label>
                  <input type="number" min={0} value={adjActual} onChange={(e) => setAdjActual(Number(e.target.value))} className="w-full rounded-lg border border-alabaster-sand px-3 py-2 font-mono" />
                </div>
              </div>
              <div>
                <label className="mb-1 block font-semibold">Alasan Penyesuaian</label>
                <textarea rows={2} value={adjReason} onChange={(e) => setAdjReason(e.target.value)} className="w-full rounded-lg border border-alabaster-sand px-3 py-2" />
              </div>
              <button type="submit" disabled={!canMutateStock} className="w-full rounded-xl bg-terracotta-600 py-2.5 font-bold text-alabaster hover:bg-terracotta-700 disabled:opacity-50">
                Ajukan untuk Approval
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-alabaster-sand bg-white p-5 shadow-card lg:col-span-8">
            <h3 className="font-display text-base font-bold text-espresso-900">Antrean Persetujuan Penyesuaian</h3>
            <div className="mt-4 space-y-3">
              {adjustments.map((a) => (
                <div key={a.id} className="flex flex-col gap-3 rounded-xl border border-alabaster-sand bg-alabaster/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-pine-700">{a.adjustmentNo}</span>
                      <StatusBadge
                        label={a.status.toUpperCase()}
                        tone={a.status === 'approved' ? 'success' : a.status === 'rejected' ? 'danger' : 'warning'}
                      />
                    </div>
                    <p className="mt-1 font-semibold text-espresso-900">{a.productName} ({a.warehouseName})</p>
                    <p className="font-mono text-espresso-700">
                      Sistem: {a.systemQty} → Aktual: {a.actualQty} (Selisih: {a.difference > 0 ? `+${a.difference}` : a.difference})
                    </p>
                    <p className="text-espresso-500">Alasan: {a.reason} • Oleh: {a.requestedBy}</p>
                  </div>
                  {a.status === 'pending' && canApproveAdj && user && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => decideAdjustment(a.id, 'approved', user)}
                        className="inline-flex items-center gap-1 rounded-lg bg-pine-600 px-3 py-1.5 text-xs font-bold text-alabaster hover:bg-pine-700"
                      >
                        <Check className="h-3.5 w-3.5" /> Setujui
                      </button>
                      <button
                        type="button"
                        onClick={() => decideAdjustment(a.id, 'rejected', user)}
                        className="inline-flex items-center gap-1 rounded-lg border border-semantic-danger/30 bg-semantic-dangerBg px-3 py-1.5 text-xs font-bold text-semantic-danger"
                      >
                        <X className="h-3.5 w-3.5" /> Tolak
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'opname' && (
        <div className="rounded-2xl border border-alabaster-sand bg-white p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2 font-display text-base font-bold text-espresso-900">
                <ClipboardCheck className="h-4 w-4 text-pine-600" /> Lembar Kerja Stock Opname — Gudang Utama Bekasi (WH-BKS)
              </h3>
              <p className="text-xs text-espresso-500">Masukkan jumlah hitung fisik untuk mendeteksi selisih (variance) secara otomatis.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-alabaster-sand bg-alabaster text-[11px] uppercase text-espresso-500">
                <tr>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Nama Produk</th>
                  <th className="px-4 py-3 text-right">Stok Sistem</th>
                  <th className="px-4 py-3 text-right">Hitung Fisik</th>
                  <th className="px-4 py-3 text-right">Selisih</th>
                  <th className="px-4 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-alabaster-subtle">
                {products.slice(0, 8).map((p) => {
                  const sys = p.stockByWarehouse[1] || 0;
                  const counted = opnameCounts[p.id] ?? sys;
                  const diff = counted - sys;
                  return (
                    <tr key={p.id}>
                      <td className="px-4 py-2.5 font-mono font-bold text-pine-700">{p.sku}</td>
                      <td className="px-4 py-2.5 font-medium text-espresso-900">{p.name}</td>
                      <td className="px-4 py-2.5 text-right font-mono sf-tabular">{sys}</td>
                      <td className="px-4 py-2.5 text-right">
                        <input
                          type="number"
                          min={0}
                          value={counted}
                          onChange={(e) => setOpnameCounts((prev) => ({ ...prev, [p.id]: Number(e.target.value) }))}
                          className="w-20 rounded-lg border border-alabaster-sand px-2 py-1 text-right font-mono"
                        />
                      </td>
                      <td className={`px-4 py-2.5 text-right font-mono font-bold ${diff === 0 ? 'text-semantic-success' : 'text-terracotta-600'}`}>
                        {diff > 0 ? `+${diff}` : diff}
                      </td>
                      <td className="px-4 py-2.5">
                        {diff !== 0 && canMutateStock && user ? (
                          <button
                            type="button"
                            onClick={() =>
                              requestAdjustment(
                                { productId: p.id, warehouseId: 1, actualQty: counted, reason: 'Selisih Stock Opname WH-BKS' },
                                user
                              )
                            }
                            className="rounded-lg bg-terracotta-50 px-2.5 py-1 text-[11px] font-bold text-terracotta-700 hover:bg-terracotta-600 hover:text-alabaster"
                          >
                            Ajukan Adj
                          </button>
                        ) : (
                          <span className="text-espresso-400">Sesuai</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="overflow-hidden rounded-2xl border border-alabaster-sand bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-alabaster-sand bg-alabaster text-[11px] uppercase text-espresso-500">
                <tr>
                  <th className="px-4 py-3">Tanggal &amp; Ref</th>
                  <th className="px-4 py-3">Tipe</th>
                  <th className="px-4 py-3">Produk &amp; Gudang</th>
                  <th className="px-4 py-3 text-right">Delta</th>
                  <th className="px-4 py-3">Keterangan &amp; Petugas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-alabaster-subtle">
                {stockMovements.map((m) => (
                  <tr key={m.id} className="hover:bg-alabaster/70">
                    <td className="px-4 py-3 font-mono">
                      <p className="font-bold text-espresso-900">{m.referenceNo}</p>
                      <p className="text-[10px] text-espresso-500">{m.date}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={m.type.replace('_', ' ').toUpperCase()}
                        tone={m.qtyDelta > 0 ? 'success' : 'terracotta'}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-espresso-900">{m.productName}</p>
                      <p className="text-[11px] text-espresso-500">{m.warehouseName}</p>
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-bold sf-tabular ${m.qtyDelta > 0 ? 'text-semantic-success' : 'text-semantic-danger'}`}>
                      {m.qtyDelta > 0 ? `+${m.qtyDelta}` : m.qtyDelta}
                    </td>
                    <td className="px-4 py-3 text-espresso-600">
                      <p>{m.notes}</p>
                      <p className="text-[10px] text-espresso-400">Petugas: {m.performedBy}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onSelectProduct={(p) => {
          setMovProductId(p.id);
          setMovCost(p.wacCost);
          setActiveTab('inout');
        }}
      />
    </div>
  );
};

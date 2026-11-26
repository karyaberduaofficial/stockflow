import React, { useState } from 'react';
import { Award, CheckCircle2, CreditCard, PackageCheck, Plus, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { Modal, PageHeader, StatusBadge, TabBar } from '../components/common/UIPrimitives';
import { formatIDR } from '../utils/format';
import { POStatus } from '../types';

const STATUS_BADGE_MAP: Record<POStatus, { label: string; tone: 'neutral' | 'warning' | 'pine' | 'info' | 'success' }> = {
  draft: { label: 'DRAFT', tone: 'neutral' },
  waiting_approval: { label: 'MENUNGGU APPROVAL', tone: 'warning' },
  approved: { label: 'DISETUJUI', tone: 'pine' },
  ordered: { label: 'DIPESAN KE SUPPLIER', tone: 'info' },
  partially_received: { label: 'DITERIMA SEBAGIAN', tone: 'warning' },
  received: { label: 'DITERIMA PENUH', tone: 'success' },
};

export const ProcurementPage: React.FC = () => {
  const { user } = useAuth();
  const {
    purchaseOrders,
    suppliers,
    warehouses,
    products,
    createPurchaseOrder,
    advancePOStatus,
    paySupplierInvoice,
  } = useStore();

  const [activeTab, setActiveTab] = useState('orders');
  const [modalOpen, setModalOpen] = useState(false);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || 1);
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || 1);
  const [productId, setProductId] = useState(products[2]?.id || 3);
  const [qty, setQty] = useState(10);
  const [unitPrice, setUnitPrice] = useState(products[2]?.buyPrice || 3_950_000);

  const canCreate = ['admin', 'purchasing'].includes(user?.role || '');
  const canApprove = ['admin', 'manager'].includes(user?.role || '');
  const canPay = ['admin', 'finance'].includes(user?.role || '');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    createPurchaseOrder({ supplierId, warehouseId, productId, qty, unitPrice }, user);
    setModalOpen(false);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Modul 04 • Pengadaan & Pemasok"
        title="Purchase Order, Penerimaan Barang & Scorecard Supplier"
        subtitle="Kelola siklus PO (Draft → Approval → Ordered → Goods Receipt), pelunasan faktur pemasok (AP), serta evaluasi kinerja vendor."
        actions={
          canCreate && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-pine-600 px-4 py-2.5 text-xs font-bold text-alabaster hover:bg-pine-700"
            >
              <Plus className="h-4 w-4" /> Buat Purchase Order
            </button>
          )
        }
      />

      <TabBar
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'orders', label: 'Siklus Purchase Order', count: purchaseOrders.length },
          { id: 'invoices', label: 'Faktur & Utang Pemasok (AP)', count: purchaseOrders.filter((p) => p.invoiceStatus === 'unpaid').length },
          { id: 'scorecard', label: 'Evaluasi Pemasok', count: suppliers.length },
        ]}
      />

      {activeTab === 'orders' && (
        <div className="space-y-3">
          {purchaseOrders.map((po) => {
            const st = STATUS_BADGE_MAP[po.status];
            return (
              <div key={po.id} className="rounded-2xl border border-alabaster-sand bg-white p-5 shadow-card">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-pine-700">{po.poNumber}</span>
                      <StatusBadge label={st.label} tone={st.tone} />
                      <StatusBadge
                        label={`Faktur: ${po.invoiceStatus.toUpperCase()}`}
                        tone={po.invoiceStatus === 'paid' ? 'success' : po.invoiceStatus === 'unpaid' ? 'warning' : 'neutral'}
                      />
                    </div>
                    <h3 className="mt-1 font-display text-base font-bold text-espresso-900">{po.supplierName}</h3>
                    <p className="text-xs text-espresso-500">
                      Tujuan: {po.warehouseName} • Tanggal PO: {po.date} • Estimasi Tiba: {po.expectedDate}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-[11px] text-espresso-500">Total (incl. PPN Masukan)</p>
                    <p className="font-mono text-lg font-bold text-espresso-900 sf-tabular">{formatIDR(po.totalAmount)}</p>
                  </div>
                </div>

                <div className="mt-3 rounded-xl bg-alabaster p-3 text-xs">
                  {po.items.map((it) => (
                    <div key={it.productId} className="flex items-center justify-between">
                      <span>
                        <strong className="font-mono text-pine-700">{it.sku}</strong> — {it.name}
                      </span>
                      <span className="font-mono">
                        {it.qtyOrdered} × {formatIDR(it.unitPrice)} (Diterima: {it.qtyReceived})
                      </span>
                    </div>
                  ))}
                </div>

                {user && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-alabaster-subtle pt-3">
                    <span className="text-[11px] text-espresso-500">
                      Dibuat oleh {po.createdBy} {po.approvedBy ? `• Disetujui oleh ${po.approvedBy}` : ''}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {po.status === 'waiting_approval' && canApprove && (
                        <button
                          type="button"
                          onClick={() => advancePOStatus(po.id, 'approved', user)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-pine-600 px-3 py-1.5 text-xs font-bold text-alabaster hover:bg-pine-700"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Setujui PO
                        </button>
                      )}
                      {po.status === 'approved' && canCreate && (
                        <button
                          type="button"
                          onClick={() => advancePOStatus(po.id, 'ordered', user)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-ochre-600 px-3 py-1.5 text-xs font-bold text-alabaster hover:bg-ochre-700"
                        >
                          <Send className="h-3.5 w-3.5" /> Kirim ke Supplier
                        </button>
                      )}
                      {po.status === 'ordered' && canCreate && (
                        <button
                          type="button"
                          onClick={() => advancePOStatus(po.id, 'received', user)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-terracotta-600 px-3 py-1.5 text-xs font-bold text-alabaster hover:bg-terracotta-700"
                        >
                          <PackageCheck className="h-3.5 w-3.5" /> Terima Barang (Goods Receipt + Auto Jurnal)
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'invoices' && (
        <div className="overflow-hidden rounded-2xl border border-alabaster-sand bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-alabaster-sand bg-alabaster text-[11px] uppercase text-espresso-500">
                <tr>
                  <th className="px-4 py-3">No. PO / Faktur</th>
                  <th className="px-4 py-3">Pemasok</th>
                  <th className="px-4 py-3 text-right">Subtotal</th>
                  <th className="px-4 py-3 text-right">PPN Masukan</th>
                  <th className="px-4 py-3 text-right">Total Tagihan (AP)</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-alabaster-subtle">
                {purchaseOrders.filter((p) => p.status === 'received').map((po) => (
                  <tr key={po.id}>
                    <td className="px-4 py-3 font-mono font-bold text-pine-700">{po.poNumber}</td>
                    <td className="px-4 py-3 font-medium text-espresso-900">{po.supplierName}</td>
                    <td className="px-4 py-3 text-right font-mono sf-tabular">{formatIDR(po.subtotal)}</td>
                    <td className="px-4 py-3 text-right font-mono sf-tabular">{formatIDR(po.ppnAmount)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold sf-tabular">{formatIDR(po.totalAmount)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge label={po.invoiceStatus.toUpperCase()} tone={po.invoiceStatus === 'paid' ? 'success' : 'warning'} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {po.invoiceStatus === 'unpaid' && canPay && user ? (
                        <button
                          type="button"
                          onClick={() => paySupplierInvoice(po.id, user)}
                          className="inline-flex items-center gap-1 rounded-lg bg-pine-600 px-3 py-1.5 text-xs font-bold text-alabaster hover:bg-pine-700"
                        >
                          <CreditCard className="h-3.5 w-3.5" /> Lunasi AP
                        </button>
                      ) : (
                        <span className="text-espresso-400">{po.invoiceStatus === 'paid' ? 'Lunas' : 'Khusus Finance'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'scorecard' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {suppliers.map((s) => {
            const composite = Math.round(s.onTimeRate * 0.4 + s.qualityScore * 0.4 + s.priceScore * 0.2);
            return (
              <div key={s.id} className="rounded-2xl border border-alabaster-sand bg-white p-5 shadow-card">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-display text-base font-bold text-espresso-900">{s.name}</h3>
                    <p className="text-xs text-espresso-500">{s.city} • Lead Time {s.leadTimeDays} hari</p>
                  </div>
                  <div className="flex items-center gap-1 rounded-xl bg-pine-50 px-3 py-1.5 font-mono text-sm font-bold text-pine-700">
                    <Award className="h-4 w-4 text-ochre-600" /> {composite}/100
                  </div>
                </div>
                <div className="mt-4 space-y-2.5 text-xs">
                  {[
                    { label: 'Ketepatan Waktu (On-Time)', val: s.onTimeRate, color: 'bg-pine-600' },
                    { label: 'Kualitas Produk & QC', val: s.qualityScore, color: 'bg-olive-600' },
                    { label: 'Kompetitivitas Harga', val: s.priceScore, color: 'bg-ochre-600' },
                  ].map((m) => (
                    <div key={m.label}>
                      <div className="flex justify-between">
                        <span className="text-espresso-600">{m.label}</span>
                        <span className="font-mono font-bold text-espresso-900">{m.val}%</span>
                      </div>
                      <div className="mt-1 h-2 w-full rounded-full bg-alabaster-subtle">
                        <div className={`h-full rounded-full ${m.color}`} style={{ width: `${m.val}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Buat Purchase Order Baru">
        <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
          <div>
            <label className="mb-1 block font-semibold">Pemasok (Supplier)</label>
            <select value={supplierId} onChange={(e) => setSupplierId(Number(e.target.value))} className="w-full rounded-lg border border-alabaster-sand px-3 py-2">
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.city})</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block font-semibold">Gudang Penerima</label>
            <select value={warehouseId} onChange={(e) => setWarehouseId(Number(e.target.value))} className="w-full rounded-lg border border-alabaster-sand px-3 py-2">
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block font-semibold">Produk Furnitur</label>
            <select
              value={productId}
              onChange={(e) => {
                const id = Number(e.target.value);
                setProductId(id);
                const p = products.find((x) => x.id === id);
                if (p) setUnitPrice(p.buyPrice);
              }}
              className="w-full rounded-lg border border-alabaster-sand px-3 py-2"
            >
              {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-semibold">Qty Pesan</label>
              <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="w-full rounded-lg border border-alabaster-sand px-3 py-2 font-mono" />
            </div>
            <div>
              <label className="mb-1 block font-semibold">Harga Beli Satuan (Rp)</label>
              <input type="number" min={1000} value={unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value))} className="w-full rounded-lg border border-alabaster-sand px-3 py-2 font-mono" />
            </div>
          </div>
          <div className="rounded-xl bg-alabaster p-3 font-mono text-xs">
            Estimasi Subtotal: <strong>{formatIDR(qty * unitPrice)}</strong> (+ PPN Masukan otomatis saat simpan)
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-alabaster-sand px-4 py-2 font-semibold">Batal</button>
            <button type="submit" className="rounded-lg bg-pine-600 px-4 py-2 font-bold text-alabaster hover:bg-pine-700">Ajukan PO</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

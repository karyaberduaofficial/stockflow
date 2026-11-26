import React, { useState } from 'react';
import {
  AlertCircle,
  Barcode,
  Printer,
  RotateCcw,
  ShoppingBag,
  Trash2,
  FileText,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import {
  BarcodeScannerModal,
  ExportActionBar,
  Modal,
  PageHeader,
  StatusBadge,
  TabBar,
} from '../components/common/UIPrimitives';
import { Product, SaleItem, SaleTransaction } from '../types';
import { formatIDR } from '../utils/format';

export const SalesPosPage: React.FC = () => {
  const { user } = useAuth();
  const { company, products, customers, warehouses, sales, completePosSale, processSaleReturn } = useStore();

  const [activeTab, setActiveTab] = useState('pos');
  const [customerId, setCustomerId] = useState(customers[0]?.id || 1);
  const [warehouseId, setWarehouseId] = useState(2); // Showroom Kemang default
  const [paymentMethod, setPaymentMethod] = useState<SaleTransaction['paymentMethod']>('QRIS');
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [posError, setPosError] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<SaleTransaction | null>(null);

  const canSell = ['admin', 'sales'].includes(user?.role || '');

  const addToCart = (product: Product) => {
    setPosError(null);
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) => (i.productId === product.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [
        ...prev,
        {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          qty: 1,
          unitPrice: product.sellPrice,
          wacCost: product.wacCost,
          discount: 0,
        },
      ];
    });
  };

  const subtotal = cart.reduce((s, it) => s + it.qty * it.unitPrice, 0);
  const effectivePpnRate = company.ppnDppElevenTwelfths ? 11 : 12;
  const ppnAmount = Math.round(subtotal * (effectivePpnRate / 100));
  const grandTotal = subtotal + ppnAmount;

  const handleCheckout = () => {
    setPosError(null);
    if (!user) return;
    const res = completePosSale({ customerId, warehouseId, paymentMethod, items: cart }, user);
    if (!res.ok) {
      setPosError(res.error || 'Checkout gagal.');
    } else {
      setCart([]);
      if (res.sale) setPreviewInvoice(res.sale);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Modul 05 • Penjualan & Kasir Showroom"
        title="Point of Sale (POS), Faktur Bermerek & Retur"
        subtitle="Kasir terintegrasi pemindai barcode, kalkulasi PPN 12% (DPP 11/12 = 11% efektif) otomatis, pemotongan stok WAC, dan pratinjau faktur siap cetak/ekspor."
        actions={
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-espresso-900 px-3.5 py-2 text-xs font-bold text-alabaster hover:bg-pine-600"
          >
            <Barcode className="h-4 w-4" /> Scan Barcode ke Keranjang
          </button>
        }
      />

      <TabBar
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'pos', label: 'Kasir POS Showroom' },
          { id: 'invoices', label: 'Riwayat Penjualan & Faktur', count: sales.length },
          { id: 'customers', label: 'Pelanggan & Piutang', count: customers.length },
        ]}
      />

      {activeTab === 'pos' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Catalog Grid */}
          <div className="space-y-3 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-alabaster-sand bg-white p-3 text-xs">
              <span className="font-semibold text-espresso-700">Lokasi Pengambilan Stok POS:</span>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(Number(e.target.value))}
                className="rounded-lg border border-alabaster-sand bg-alabaster px-3 py-1.5 font-semibold text-espresso-900"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {products.map((p) => {
                const whStock = p.stockByWarehouse[warehouseId] || 0;
                return (
                  <div
                    key={p.id}
                    className="flex flex-col justify-between rounded-xl border border-alabaster-sand bg-white p-4 shadow-card sf-card-interactive"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] font-bold text-pine-700">{p.sku}</span>
                        <StatusBadge
                          label={`Stok: ${whStock}`}
                          tone={whStock === 0 ? 'danger' : whStock <= 3 ? 'warning' : 'success'}
                        />
                      </div>
                      <h3 className="mt-1 font-display text-sm font-bold text-espresso-900">{p.name}</h3>
                      <p className="text-[11px] text-espresso-500">{p.categoryName} • {p.variant}</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-alabaster-subtle pt-3">
                      <span className="font-mono text-sm font-bold text-terracotta-700 sf-tabular">
                        {formatIDR(p.sellPrice)}
                      </span>
                      <button
                        type="button"
                        disabled={!canSell || whStock <= 0}
                        onClick={() => addToCart(p)}
                        className="rounded-lg bg-pine-600 px-3 py-1.5 text-xs font-bold text-alabaster hover:bg-pine-700 disabled:opacity-40"
                      >
                        + Tambah
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cashier Cart */}
          <div className="rounded-2xl border border-alabaster-sand bg-white p-5 shadow-card lg:col-span-5 lg:sticky lg:top-20 lg:self-start">
            <h3 className="flex items-center gap-2 font-display text-base font-bold text-espresso-900">
              <ShoppingBag className="h-4 w-4 text-terracotta-600" /> Keranjang Transaksi POS
            </h3>

            {posError && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-semantic-danger/30 bg-semantic-dangerBg p-3 text-xs font-semibold text-semantic-danger">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{posError}</span>
              </div>
            )}

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="mb-1 block font-semibold text-espresso-600">Pelanggan</label>
                <select value={customerId} onChange={(e) => setCustomerId(Number(e.target.value))} className="w-full rounded-lg border border-alabaster-sand px-2.5 py-2">
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-semibold text-espresso-600">Metode Bayar</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as SaleTransaction['paymentMethod'])} className="w-full rounded-lg border border-alabaster-sand px-2.5 py-2">
                  <option value="QRIS">QRIS</option>
                  <option value="Bank Transfer">Transfer Bank</option>
                  <option value="Cash">Tunai (Cash)</option>
                  <option value="Credit (AR)">Kredit / Piutang (AR)</option>
                </select>
              </div>
            </div>

            <div className="mt-4 max-h-64 space-y-2 overflow-y-auto border-y border-alabaster-sand py-3">
              {cart.length === 0 ? (
                <p className="py-6 text-center text-xs text-espresso-400">
                  Klik produk di kiri atau gunakan Scan Barcode untuk menambahkan item.
                </p>
              ) : (
                cart.map((item) => (
                  <div key={item.productId} className="flex items-center justify-between gap-2 rounded-lg bg-alabaster px-3 py-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-espresso-900">{item.name}</p>
                      <p className="font-mono text-[11px] text-espresso-500">{formatIDR(item.unitPrice)}</p>
                    </div>
                    <input
                      type="number"
                      min={1}
                      value={item.qty}
                      onChange={(e) =>
                        setCart((prev) =>
                          prev.map((c) => (c.productId === item.productId ? { ...c, qty: Math.max(1, Number(e.target.value)) } : c))
                        )
                      }
                      className="w-14 rounded border border-alabaster-sand bg-white px-2 py-1 text-center font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setCart((prev) => prev.filter((c) => c.productId !== item.productId))}
                      className="text-espresso-400 hover:text-semantic-danger"
                      aria-label="Hapus item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 space-y-1.5 text-xs">
              <div className="flex justify-between text-espresso-600">
                <span>Subtotal</span>
                <span className="font-mono sf-tabular">{formatIDR(subtotal)}</span>
              </div>
              <div className="flex justify-between text-espresso-600">
                <span>PPN Efektif ({effectivePpnRate}% — {company.ppnDppElevenTwelfths ? 'DPP 11/12' : 'Penuh'})</span>
                <span className="font-mono sf-tabular">{formatIDR(ppnAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-alabaster-sand pt-2 text-sm font-bold text-espresso-900">
                <span>TOTAL BAYAR</span>
                <span className="font-mono text-pine-700 sf-tabular">{formatIDR(grandTotal)}</span>
              </div>
            </div>

            <button
              type="button"
              disabled={!canSell || cart.length === 0}
              onClick={handleCheckout}
              className="mt-4 w-full rounded-xl bg-pine-600 py-3 text-xs font-bold text-alabaster shadow-sm hover:bg-pine-700 disabled:opacity-40"
            >
              {canSell ? 'Proses Pembayaran & Terbitkan Faktur' : 'Mode Baca Saja (Khusus Sales / Admin)'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'invoices' && (
        <div className="overflow-hidden rounded-2xl border border-alabaster-sand bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-alabaster-sand bg-alabaster text-[11px] uppercase text-espresso-500">
                <tr>
                  <th className="px-4 py-3">No. Faktur</th>
                  <th className="px-4 py-3">Pelanggan</th>
                  <th className="px-4 py-3">Pembayaran</th>
                  <th className="px-4 py-3 text-right">PPN</th>
                  <th className="px-4 py-3 text-right">Grand Total</th>
                  <th className="px-4 py-3 text-right">Aksi Faktur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-alabaster-subtle">
                {sales.map((s) => (
                  <tr key={s.id} className="hover:bg-alabaster/70">
                    <td className="px-4 py-3 font-mono">
                      <p className="font-bold text-pine-700">{s.invoiceNo}</p>
                      <p className="text-[10px] text-espresso-500">{s.date}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-espresso-900">{s.customerName}</p>
                      <p className="text-[11px] text-espresso-500">{s.warehouseName}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={s.returned ? 'DIRETUR' : `${s.paymentMethod} • ${s.paymentStatus.toUpperCase()}`}
                        tone={s.returned ? 'danger' : s.paymentStatus === 'paid' ? 'success' : 'warning'}
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-mono sf-tabular">{formatIDR(s.ppnAmount)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold sf-tabular text-espresso-900">{formatIDR(s.grandTotal)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPreviewInvoice(s)}
                          className="inline-flex items-center gap-1 rounded-lg bg-pine-50 px-2.5 py-1.5 text-[11px] font-bold text-pine-700 hover:bg-pine-600 hover:text-alabaster"
                        >
                          <FileText className="h-3.5 w-3.5" /> Faktur
                        </button>
                        {!s.returned && canSell && user && (
                          <button
                            type="button"
                            onClick={() => processSaleReturn(s.id, user)}
                            className="inline-flex items-center gap-1 rounded-lg border border-terracotta-600/30 bg-terracotta-50 px-2.5 py-1.5 text-[11px] font-bold text-terracotta-700 hover:bg-terracotta-600 hover:text-alabaster"
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> Retur
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'customers' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {customers.map((c) => (
            <div key={c.id} className="rounded-2xl border border-alabaster-sand bg-white p-5 shadow-card">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-pine-700">{c.code}</span>
                <StatusBadge label={c.segment} tone="terracotta" />
              </div>
              <h3 className="mt-1 font-display text-base font-bold text-espresso-900">{c.name}</h3>
              <p className="text-xs text-espresso-500">{c.city} • {c.phone} • {c.email}</p>
              <div className="mt-3 flex justify-between rounded-xl bg-alabaster p-3 text-xs">
                <span>Piutang Berjalan (AR):</span>
                <strong className="font-mono text-terracotta-700">{formatIDR(c.receivableBalance)}</strong>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Branded Printable Invoice Preview Modal */}
      <Modal
        open={Boolean(previewInvoice)}
        onClose={() => setPreviewInvoice(null)}
        title={`Faktur Penjualan ${previewInvoice?.invoiceNo || ''}`}
        subtitle="Pratinjau faktur resmi bermerek StockFlow siap cetak atau unduh PDF / Word / Excel."
        maxWidthClass="max-w-2xl"
      >
        {previewInvoice && (
          <div className="space-y-4">
            <div className="rounded-xl border border-alabaster-sand bg-white p-5">
              <div className="flex items-start justify-between border-b-2 border-pine-600 pb-4">
                <div>
                  <img src="/brand/stockflow-logo-full.svg" alt="StockFlow" className="h-9 w-auto" />
                  <p className="mt-2 text-xs text-espresso-600">{company.legalEntity}</p>
                  <p className="text-[11px] text-espresso-500">{company.address} • NPWP: {company.npwp}</p>
                </div>
                <div className="text-right text-xs">
                  <p className="font-mono text-sm font-bold text-pine-700">{previewInvoice.invoiceNo}</p>
                  <p className="text-espresso-600">Tanggal: {previewInvoice.date}</p>
                  <p className="text-espresso-600">Kasir: {previewInvoice.cashierName}</p>
                </div>
              </div>

              <div className="my-3 text-xs">
                <p className="text-espresso-500">Kepada Yth:</p>
                <p className="font-bold text-espresso-900">{previewInvoice.customerName}</p>
              </div>

              <table className="w-full text-left text-xs">
                <thead className="bg-pine-600 text-alabaster">
                  <tr>
                    <th className="px-3 py-2">Produk</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Harga</th>
                    <th className="px-3 py-2 text-right">Jumlah</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-alabaster-sand">
                  {previewInvoice.items.map((it) => (
                    <tr key={it.productId}>
                      <td className="px-3 py-2">{it.name} <span className="font-mono text-[10px] text-espresso-500">({it.sku})</span></td>
                      <td className="px-3 py-2 text-right font-mono">{it.qty}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatIDR(it.unitPrice)}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">{formatIDR(it.qty * it.unitPrice - it.discount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-4 ml-auto max-w-xs space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-espresso-600">Subtotal</span>
                  <span className="font-mono">{formatIDR(previewInvoice.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-espresso-600">PPN ({previewInvoice.ppnRateEffective}% efektif)</span>
                  <span className="font-mono">{formatIDR(previewInvoice.ppnAmount)}</span>
                </div>
                <div className="flex justify-between border-t border-pine-600 pt-1.5 text-sm font-bold text-pine-700">
                  <span>TOTAL TAGIHAN</span>
                  <span className="font-mono">{formatIDR(previewInvoice.grandTotal)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 no-print">
              <ExportActionBar report="invoice" selectedSale={previewInvoice} compact />
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-espresso-900 px-3.5 py-2 text-xs font-bold text-alabaster hover:bg-pine-600"
              >
                <Printer className="h-3.5 w-3.5" /> Cetak Faktur
              </button>
            </div>
          </div>
        )}
      </Modal>

      <BarcodeScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onSelectProduct={addToCart} />
    </div>
  );
};

import React, { useState } from 'react';
import {
  AlertCircle,
  Barcode,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Info,
  Loader2,
  ScanLine,
  Search,
  X,
  AlertTriangle,
} from 'lucide-react';
import { exportDocument, ExportFormatType, ExportReportType } from '../../services/exportService';
import { useStore } from '../../context/StoreContext';
import { PayrollRecord, Product, SaleTransaction } from '../../types';
import { formatIDR, getTotalProductStock } from '../../utils/format';

export const PageHeader: React.FC<{
  eyebrow?: string;
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}> = ({ eyebrow, title, subtitle, actions }) => (
  <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sf-animate-enter">
    <div>
      {eyebrow && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-pine-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-pine-700 border border-pine-100">
          {eyebrow}
        </span>
      )}
      <h1 className="mt-1.5 font-display text-2xl font-extrabold text-espresso-900 sm:text-3xl">{title}</h1>
      <p className="mt-1 text-sm text-espresso-600 max-w-2xl">{subtitle}</p>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export const StatCard: React.FC<{
  label: string;
  value: string;
  hint?: string;
  trend?: { text: string; tone: 'positive' | 'negative' | 'neutral' };
  icon: React.ReactNode;
  accent?: 'pine' | 'terracotta' | 'ochre' | 'olive' | 'burgundy' | 'danger';
  staggerClass?: string;
}> = ({ label, value, hint, trend, icon, accent = 'pine', staggerClass = '' }) => {
  const iconBgMap = {
    pine: 'bg-pine-50 text-pine-600 border-pine-100',
    terracotta: 'bg-terracotta-50 text-terracotta-600 border-terracotta-100',
    ochre: 'bg-ochre-50 text-ochre-700 border-ochre-100',
    olive: 'bg-olive-50 text-olive-600 border-olive-600/20',
    burgundy: 'bg-burgundy-50 text-burgundy-600 border-burgundy-600/20',
    danger: 'bg-semantic-dangerBg text-semantic-danger border-semantic-danger/20',
  };

  const trendClass =
    trend?.tone === 'positive'
      ? 'text-semantic-success bg-semantic-successBg'
      : trend?.tone === 'negative'
      ? 'text-semantic-danger bg-semantic-dangerBg'
      : 'text-espresso-600 bg-alabaster-subtle';

  return (
    <div
      className={`rounded-xl border border-alabaster-sand bg-white p-4 shadow-card sf-card-interactive sf-animate-enter ${staggerClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-espresso-500">{label}</p>
          <p className="mt-2 font-mono text-xl font-bold text-espresso-900 sf-tabular truncate sm:text-2xl">{value}</p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${iconBgMap[accent]}`}>
          {icon}
        </div>
      </div>
      {(trend || hint) && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-alabaster-subtle">
          {trend && (
            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${trendClass}`}>
              {trend.text}
            </span>
          )}
          {hint && <span className="text-xs text-espresso-500">{hint}</span>}
        </div>
      )}
    </div>
  );
};

export const StatusBadge: React.FC<{
  label: string;
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'pine' | 'terracotta';
}> = ({ label, tone = 'neutral' }) => {
  const styles: Record<string, string> = {
    success: 'bg-semantic-successBg text-semantic-success border-semantic-success/20',
    warning: 'bg-semantic-warningBg text-semantic-warning border-semantic-warning/25',
    danger: 'bg-semantic-dangerBg text-semantic-danger border-semantic-danger/20',
    info: 'bg-olive-50 text-olive-700 border-olive-600/20',
    pine: 'bg-pine-50 text-pine-700 border-pine-200',
    terracotta: 'bg-terracotta-50 text-terracotta-700 border-terracotta-100',
    neutral: 'bg-alabaster-subtle text-espresso-600 border-alabaster-sand',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${styles[tone]}`}>
      {label}
    </span>
  );
};

export const TabBar: React.FC<{
  tabs: { id: string; label: string; count?: number }[];
  activeTab: string;
  onChange: (id: string) => void;
}> = ({ tabs, activeTab, onChange }) => (
  <div className="mb-5 flex flex-wrap gap-1.5 rounded-xl border border-alabaster-sand bg-alabaster-subtle/70 p-1.5" role="tablist">
    {tabs.map((tab) => {
      const active = tab.id === activeTab;
      return (
        <button
          key={tab.id}
          role="tab"
          aria-selected={active}
          onClick={() => onChange(tab.id)}
          className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all sm:text-sm ${
            active
              ? 'bg-pine-600 text-alabaster shadow-sm'
              : 'text-espresso-600 hover:bg-white/80 hover:text-espresso-900'
          }`}
        >
          <span>{tab.label}</span>
          {typeof tab.count === 'number' && (
            <span
              className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] ${
                active ? 'bg-pine-700 text-alabaster' : 'bg-alabaster-sand/70 text-espresso-700'
              }`}
            >
              {tab.count}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

export const EmptyState: React.FC<{
  title: string;
  description: string;
  action?: React.ReactNode;
}> = ({ title, description, action }) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-espresso-300 bg-alabaster-subtle/50 px-6 py-12 text-center">
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-pine-50 text-pine-600 border border-pine-100">
      <Search className="h-5 w-5" />
    </div>
    <h3 className="mt-3 font-display text-base font-bold text-espresso-900">{title}</h3>
    <p className="mt-1 max-w-md text-sm text-espresso-600">{description}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const SkeletonCards: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="rounded-xl border border-alabaster-sand bg-white p-4">
        <div className="h-3 w-24 rounded sf-skeleton" />
        <div className="mt-3 h-7 w-36 rounded sf-skeleton" />
        <div className="mt-4 h-3 w-full rounded sf-skeleton" />
      </div>
    ))}
  </div>
);

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  maxWidthClass?: string;
  children: React.ReactNode;
}> = ({ open, onClose, title, subtitle, maxWidthClass = 'max-w-xl', children }) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-espresso-950/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`w-full ${maxWidthClass} max-h-[90vh] overflow-y-auto rounded-2xl border border-alabaster-sand bg-white shadow-modal sf-animate-enter`}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-alabaster-sand bg-alabaster px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-bold text-espresso-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-espresso-600">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup dialog"
            className="rounded-lg p-1.5 text-espresso-500 hover:bg-alabaster-sand/60 hover:text-espresso-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

export const ExportActionBar: React.FC<{
  report: ExportReportType;
  label?: string;
  selectedSale?: SaleTransaction;
  selectedPayslip?: PayrollRecord;
  compact?: boolean;
}> = ({ report, label, selectedSale, selectedPayslip, compact = false }) => {
  const { company, products, coa, taxTransactions, payrolls, pushToast } = useStore();
  const [busyFormat, setBusyFormat] = useState<ExportFormatType | null>(null);

  const handleDownload = async (format: ExportFormatType) => {
    setBusyFormat(format);
    try {
      const res = await exportDocument(report, format, {
        company,
        products,
        coa,
        taxTransactions,
        payrolls,
        selectedSale,
        selectedPayslip,
      });
      pushToast(
        'success',
        `Dokumen ${format.toUpperCase()} Diunduh`,
        `${res.filename} (${res.source === 'backend' ? 'Server Engine' : 'StockFlow Branded Export'})`
      );
    } catch (err) {
      pushToast('error', 'Gagal Mengekspor Dokumen', String(err));
    } finally {
      setBusyFormat(null);
    }
  };

  const btnBase = compact
    ? 'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all disabled:opacity-50'
    : 'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-all disabled:opacity-50';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {label && <span className="text-xs font-medium text-espresso-500">{label}:</span>}
      <button
        type="button"
        disabled={busyFormat !== null}
        onClick={() => handleDownload('pdf')}
        className={`${btnBase} border-terracotta-600/30 bg-terracotta-50 text-terracotta-700 hover:bg-terracotta-600 hover:text-alabaster active:scale-[0.98]`}
      >
        {busyFormat === 'pdf' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        <span>PDF</span>
      </button>
      <button
        type="button"
        disabled={busyFormat !== null}
        onClick={() => handleDownload('docx')}
        className={`${btnBase} border-ochre-600/30 bg-ochre-50 text-ochre-700 hover:bg-ochre-600 hover:text-alabaster active:scale-[0.98]`}
      >
        {busyFormat === 'docx' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
        <span>Word (.docx)</span>
      </button>
      <button
        type="button"
        disabled={busyFormat !== null}
        onClick={() => handleDownload('xlsx')}
        className={`${btnBase} border-pine-600/30 bg-pine-50 text-pine-700 hover:bg-pine-600 hover:text-alabaster active:scale-[0.98]`}
      >
        {busyFormat === 'xlsx' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
        <span>Excel (.xlsx)</span>
      </button>
    </div>
  );
};

export const BarcodeScannerModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onSelectProduct?: (product: Product) => void;
}> = ({ open, onClose, onSelectProduct }) => {
  const { products, warehouses } = useStore();
  const [query, setQuery] = useState('');
  const [simulatedScan, setSimulatedScan] = useState(false);

  const normalized = query.trim().toLowerCase();
  const matched = normalized
    ? products.find(
        (p) =>
          p.barcode.toLowerCase() === normalized ||
          p.sku.toLowerCase() === normalized ||
          p.name.toLowerCase().includes(normalized)
      )
    : null;

  const quickScanSamples = products.slice(0, 4);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pemindai Barcode & QR Inventaris"
      subtitle="Dukung USB Barcode Scanner (HID), input SKU manual, atau simulasi kamera pemindai."
      maxWidthClass="max-w-lg"
    >
      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-xl border border-pine-600/30 bg-espresso-900 p-5 text-alabaster">
          <div className="flex items-center justify-between text-xs text-espresso-300">
            <span className="inline-flex items-center gap-1.5 font-mono">
              <ScanLine className="h-4 w-4 text-terracotta-500" />
              OPTICAL SCANNER READY
            </span>
            <button
              type="button"
              onClick={() => {
                setSimulatedScan(true);
                const random = products[Math.floor(Math.random() * products.length)];
                setTimeout(() => {
                  setQuery(random.barcode);
                  setSimulatedScan(false);
                }, 400);
              }}
              className="rounded-md bg-terracotta-600 px-2.5 py-1 text-[11px] font-semibold text-alabaster hover:bg-terracotta-700"
            >
              {simulatedScan ? 'Memindai...' : 'Simulasi Scan Kamera'}
            </button>
          </div>
          <div className="my-4 flex h-20 items-center justify-center rounded-lg border border-dashed border-espresso-600 bg-espresso-950/60">
            <div className="text-center">
              <Barcode className="mx-auto h-8 w-8 text-alabaster/80" />
              <p className="mt-1 font-mono text-[11px] text-espresso-300">
                Arahkan barcode EAN-13 / QR SKU atau ketik di bawah
              </p>
            </div>
          </div>
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Scan / ketik Barcode (mis. 8994120001014) atau SKU (SF-LR-001)..."
            className="w-full rounded-lg border border-espresso-700 bg-espresso-800 px-3.5 py-2.5 font-mono text-sm text-alabaster placeholder:text-espresso-400"
          />
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold text-espresso-600">Contoh Cepat Barcode Furnitur:</p>
          <div className="flex flex-wrap gap-1.5">
            {quickScanSamples.map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => setQuery(sample.barcode)}
                className="rounded-lg border border-alabaster-sand bg-alabaster px-2.5 py-1 font-mono text-[11px] font-medium text-espresso-700 hover:border-pine-600 hover:bg-pine-50"
              >
                {sample.sku} ({sample.barcode.slice(-4)})
              </button>
            ))}
          </div>
        </div>

        {matched ? (
          <div className="rounded-xl border border-pine-200 bg-pine-50/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs font-semibold text-pine-700">
                  {matched.sku} • {matched.barcode}
                </p>
                <h4 className="mt-0.5 font-display text-base font-bold text-espresso-900">{matched.name}</h4>
                <p className="text-xs text-espresso-600">
                  {matched.categoryName} • {matched.variant}
                </p>
              </div>
              <span className="rounded-lg bg-pine-600 px-2.5 py-1 font-mono text-xs font-bold text-alabaster">
                Total: {getTotalProductStock(matched.stockByWarehouse)} {matched.unitCode}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              {warehouses.map((w) => (
                <div key={w.id} className="flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5 border border-alabaster-sand">
                  <span className="text-espresso-600 truncate">{w.code}</span>
                  <span className="font-mono font-semibold text-espresso-900">
                    {matched.stockByWarehouse[w.id] || 0} {matched.unitCode}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-pine-200/70 pt-3">
              <div className="text-xs">
                <span className="text-espresso-500">Harga Jual: </span>
                <span className="font-mono font-bold text-pine-700">{formatIDR(matched.sellPrice)}</span>
              </div>
              {onSelectProduct && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectProduct(matched);
                    onClose();
                  }}
                  className="rounded-lg bg-pine-600 px-3.5 py-1.5 text-xs font-semibold text-alabaster hover:bg-pine-700"
                >
                  Pilih Produk Ini
                </button>
              )}
            </div>
          </div>
        ) : query.trim() ? (
          <div className="rounded-xl border border-semantic-danger/25 bg-semantic-dangerBg p-3 text-xs text-semantic-danger">
            Barcode atau SKU "{query}" tidak ditemukan dalam katalog StockFlow.
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useStore();
  if (toasts.length === 0) return null;

  const iconMap = {
    success: <CheckCircle2 className="h-4 w-4 text-semantic-success shrink-0" />,
    error: <AlertCircle className="h-4 w-4 text-semantic-danger shrink-0" />,
    warning: <AlertTriangle className="h-4 w-4 text-semantic-warning shrink-0" />,
    info: <Info className="h-4 w-4 text-olive-600 shrink-0" />,
  };

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0 no-print"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-start gap-3 rounded-xl border border-alabaster-sand bg-white p-3.5 shadow-modal sf-animate-enter"
        >
          <div className="mt-0.5">{iconMap[t.type]}</div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-espresso-900">{t.title}</p>
            {t.message && <p className="mt-0.5 text-xs text-espresso-600">{t.message}</p>}
          </div>
          <button
            onClick={() => dismissToast(t.id)}
            aria-label="Tutup notifikasi"
            className="text-espresso-400 hover:text-espresso-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

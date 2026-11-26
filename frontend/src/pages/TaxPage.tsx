import React from 'react';
import { AlertTriangle, CheckCircle2, Landmark, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { ExportActionBar, PageHeader, StatCard, StatusBadge } from '../components/common/UIPrimitives';
import { formatIDR } from '../utils/format';

export const TaxPage: React.FC = () => {
  const { user } = useAuth();
  const { company, taxConfigs, taxTransactions, togglePpnElevenTwelfths, markTaxPaid } = useStore();

  const canManageTax = ['admin', 'finance'].includes(user?.role || '');

  const ppnOut = taxTransactions.filter((t) => t.direction === 'output').reduce((s, t) => s + t.taxAmount, 0);
  const ppnIn = taxTransactions.filter((t) => t.direction === 'input').reduce((s, t) => s + t.taxAmount, 0);
  const ppnNet = ppnOut - ppnIn;
  const pph21Total = taxTransactions.filter((t) => t.direction === 'withholding').reduce((s, t) => s + t.taxAmount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Modul 08 • Kepatuhan Perpajakan Indonesia"
        title="Manajemen PPN (DPP 11/12), PPh 21 TER & PPh Badan"
        subtitle="Konfigurasi tarif pajak berdasarkan tanggal berlaku (tanpa hardcode), rekonsiliasi PPN Keluaran/Masukan, dan pengingat batas setor."
        actions={<ExportActionBar report="tax" label="Rekap Pajak" compact />}
      />

      {/* Explicit Indonesian Tax Compliance Disclaimer Banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-ochre-600/30 bg-ochre-50 p-4 text-xs text-espresso-800">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-terracotta-600" />
        <div>
          <p className="font-bold text-espresso-900">Disclaimer Kepatuhan Perpajakan (PMK 131/2024 &amp; PP 58/2023)</p>
          <p className="mt-0.5 leading-relaxed">
            StockFlow menyediakan perhitungan otomatis berbasis konfigurasi tarif aktif (termasuk skema PPN 12% dengan
            DPP Nilai Lain 11/12 = 11% efektif untuk barang non-mewah serta PPh 21 TER). Pelaporan final SPT Masa/Tahunan
            tetap wajib diverifikasi oleh Konsultan Pajak / Finance Lead melalui sistem resmi DJP Coretax.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="PPN Keluaran (Output VAT)"
          value={formatIDR(ppnOut)}
          hint="Dari transaksi penjualan periode ini"
          icon={<Landmark className="h-5 w-5" />}
          accent="pine"
        />
        <StatCard
          label="PPN Masukan (Input VAT)"
          value={formatIDR(ppnIn)}
          hint="Kredit pajak dari penerimaan PO"
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="olive"
        />
        <StatCard
          label={ppnNet >= 0 ? 'PPN Kurang Bayar' : 'PPN Lebih Bayar (Kompensasi)'}
          value={formatIDR(Math.abs(ppnNet))}
          hint={`PPh 21 TER Terpotong: ${formatIDR(pph21Total)}`}
          icon={<AlertTriangle className="h-5 w-5" />}
          accent="terracotta"
        />
      </div>

      {/* Configurable Tax Rates + DPP 11/12 Switch */}
      <div className="rounded-2xl border border-alabaster-sand bg-white p-5 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-base font-bold text-espresso-900">Konfigurasi Jenis &amp; Tarif Pajak Aktif</h2>
            <p className="text-xs text-espresso-500">Perubahan tarif langsung berlaku pada transaksi POS &amp; PO baru.</p>
          </div>
          {canManageTax && user && (
            <label className="inline-flex cursor-pointer items-center gap-2.5 rounded-xl border border-pine-200 bg-pine-50 px-3.5 py-2 text-xs font-bold text-pine-800">
              <input
                type="checkbox"
                checked={company.ppnDppElevenTwelfths}
                onChange={(e) => togglePpnElevenTwelfths(e.target.checked, user)}
                className="h-4 w-4 accent-pine-600"
              />
              Aktifkan DPP Nilai Lain 11/12 (PPN Efektif 11%)
            </label>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {taxConfigs.map((tc) => (
            <div key={tc.id} className="rounded-xl border border-alabaster-sand bg-alabaster/70 p-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-pine-700">{tc.code}</span>
                <StatusBadge label={`Efektif ${tc.effectiveRate}%`} tone="pine" />
              </div>
              <p className="mt-1.5 font-display text-sm font-bold text-espresso-900">{tc.name}</p>
              <p className="mt-1 text-[11px] text-espresso-600">{tc.notes}</p>
              <p className="mt-2 font-mono text-[10px] text-espresso-500">
                Tarif Nominal: {tc.nominalRate}% • Berlaku sejak {tc.effectiveFrom}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Tax Transactions & Payment Reminders */}
      <div className="overflow-hidden rounded-2xl border border-alabaster-sand bg-white shadow-card">
        <div className="border-b border-alabaster-sand bg-alabaster px-5 py-3.5">
          <h3 className="font-display text-sm font-bold text-espresso-900">Buku Besar Transaksi Pajak &amp; Jatuh Tempo Setor</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-alabaster-sand bg-alabaster/60 text-[11px] uppercase text-espresso-500">
              <tr>
                <th className="px-4 py-3">Tanggal &amp; Ref</th>
                <th className="px-4 py-3">Jenis Pajak</th>
                <th className="px-4 py-3 text-right">DPP (Rp)</th>
                <th className="px-4 py-3 text-right">Nilai Pajak (Rp)</th>
                <th className="px-4 py-3">Jatuh Tempo</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-alabaster-subtle">
              {taxTransactions.map((t) => (
                <tr key={t.id} className="hover:bg-alabaster/60">
                  <td className="px-4 py-3 font-mono">
                    <p className="font-bold text-espresso-900">{t.referenceNo}</p>
                    <p className="text-[10px] text-espresso-500">{t.date}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-espresso-900">{t.taxName}</p>
                    <span className="font-mono text-[10px] text-espresso-500">{t.taxCode}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono sf-tabular">{formatIDR(t.taxBase)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold sf-tabular text-pine-700">{formatIDR(t.taxAmount)}</td>
                  <td className="px-4 py-3 font-mono text-terracotta-700">{t.dueDate}</td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={t.status.toUpperCase()}
                      tone={t.status === 'paid' ? 'success' : t.status === 'reported' ? 'info' : 'warning'}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {t.status !== 'paid' && canManageTax && user ? (
                      <button
                        type="button"
                        onClick={() => markTaxPaid(t.id, user)}
                        className="rounded-lg bg-pine-600 px-3 py-1.5 text-[11px] font-bold text-alabaster hover:bg-pine-700"
                      >
                        Tandai Setor
                      </button>
                    ) : (
                      <span className="text-espresso-400">{t.status === 'paid' ? 'Lunas ✓' : '—'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

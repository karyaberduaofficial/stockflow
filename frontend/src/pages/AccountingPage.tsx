import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Lock, Plus, RotateCcw, Unlock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { ExportActionBar, Modal, PageHeader, StatusBadge, TabBar } from '../components/common/UIPrimitives';
import { formatIDR } from '../utils/format';
import { JournalLine } from '../types';

export const AccountingPage: React.FC = () => {
  const { user } = useAuth();
  const { coa, journals, periods, postManualJournal, reverseJournal, togglePeriodStatus } = useStore();
  const [activeTab, setActiveTab] = useState('statements');
  const [journalModal, setJournalModal] = useState(false);

  const [jDate, setJDate] = useState('2026-11-26');
  const [jDesc, setJDesc] = useState('Penyesuaian biaya perlengkapan showroom');
  const [jLines, setJLines] = useState<JournalLine[]>([
    { accountCode: '7101', accountName: 'Beban Penyusutan & Administrasi', debit: 1_500_000, credit: 0 },
    { accountCode: '1101', accountName: 'Kas Kecil & Kasir POS', debit: 0, credit: 1_500_000 },
  ]);
  const [jError, setJError] = useState<string | null>(null);

  const canWriteAcc = ['admin', 'finance'].includes(user?.role || '');

  const totalDebitInput = jLines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const totalCreditInput = jLines.reduce((s, l) => s + Number(l.credit || 0), 0);
  const isBalancedInput = totalDebitInput > 0 && Math.abs(totalDebitInput - totalCreditInput) < 0.01;

  // Trial Balance & Financial Statement Computations
  const tbDebit = coa.filter((a) => a.normalBalance === 'debit').reduce((s, a) => s + a.balance, 0);
  const tbCredit = coa.filter((a) => a.normalBalance === 'credit').reduce((s, a) => s + a.balance, 0);

  const totalAssets = coa.filter((a) => a.type === 'Asset').reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = coa.filter((a) => a.type === 'Liability').reduce((s, a) => s + a.balance, 0);
  const baseEquity = coa.filter((a) => a.type === 'Equity').reduce((s, a) => s + a.balance, 0);
  const grossSales = coa.find((a) => a.code === '4101')?.balance || 0;
  const salesReturns = coa.find((a) => a.code === '4102')?.balance || 0;
  const cogs = coa.find((a) => a.type === 'COGS')?.balance || 0;
  const expenses = coa.filter((a) => a.type === 'Expense').reduce((s, a) => s + a.balance, 0);
  const netProfit = grossSales - salesReturns - cogs - expenses;
  const totalLiabAndEquity = totalLiabilities + baseEquity + netProfit;
  const balanceSheetDiff = totalAssets - totalLiabAndEquity;

  const handlePostJournal = (e: React.FormEvent) => {
    e.preventDefault();
    setJError(null);
    if (!user) return;
    const res = postManualJournal({ date: jDate, description: jDesc, lines: jLines }, user);
    if (!res.ok) setJError(res.error || 'Gagal memposting jurnal.');
    else setJournalModal(false);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Modul 07 • Akuntansi Double-Entry"
        title="Bagan Akun, Jurnal Umum, Neraca Saldo & Laporan Keuangan"
        subtitle="Pembukuan berpasangan (Debit = Kredit) terverifikasi otomatis, proteksi jurnal permanen (koreksi hanya via reversal), dan kunci periode akuntansi."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canWriteAcc && (
              <button
                type="button"
                onClick={() => setJournalModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-pine-600 px-3.5 py-2 text-xs font-bold text-alabaster hover:bg-pine-700"
              >
                <Plus className="h-4 w-4" /> Buat Jurnal Umum
              </button>
            )}
            <ExportActionBar report="financial" compact />
          </div>
        }
      />

      <TabBar
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'statements', label: 'Laporan Keuangan (Laba Rugi & Neraca)' },
          { id: 'journals', label: 'Jurnal Umum (Immutable)', count: journals.length },
          { id: 'trial', label: 'Neraca Saldo (Trial Balance)' },
          { id: 'coa', label: 'Bagan Akun (COA 1xxx–7xxx)', count: coa.length },
          { id: 'periods', label: 'Tutup Buku & Kunci Periode', count: periods.length },
        ]}
      />

      {activeTab === 'statements' && (
        <div className="space-y-5">
          {/* Accounting Equation Live Audit Banner */}
          <div
            className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 text-xs ${
              balanceSheetDiff === 0
                ? 'border-semantic-success/30 bg-semantic-successBg text-semantic-success'
                : 'border-semantic-danger/30 bg-semantic-dangerBg text-semantic-danger'
            }`}
          >
            <span className="flex items-center gap-2 font-bold">
              <CheckCircle2 className="h-4 w-4" />
              Verifikasi Persamaan Akuntansi (Aset = Liabilitas + Ekuitas + Laba Berjalan):
            </span>
            <span className="font-mono font-bold">
              {formatIDR(totalAssets)} = {formatIDR(totalLiabAndEquity)} (Selisih: {formatIDR(balanceSheetDiff)})
            </span>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Income Statement */}
            <div className="rounded-2xl border border-alabaster-sand bg-white p-5 shadow-card">
              <h3 className="font-display text-base font-bold text-espresso-900">Laporan Laba Rugi (Income Statement)</h3>
              <p className="text-xs text-espresso-500">Periode Berjalan November 2026</p>
              <div className="mt-4 space-y-2 text-xs">
                <div className="flex justify-between py-1">
                  <span>4101 Penjualan Furnitur &amp; Homeware</span>
                  <span className="font-mono sf-tabular">{formatIDR(grossSales)}</span>
                </div>
                <div className="flex justify-between py-1 text-terracotta-700">
                  <span>4102 Retur &amp; Diskon Penjualan</span>
                  <span className="font-mono sf-tabular">({formatIDR(salesReturns)})</span>
                </div>
                <div className="flex justify-between border-t border-alabaster-sand py-1.5 font-bold">
                  <span>Penjualan Bersih (Net Sales)</span>
                  <span className="font-mono sf-tabular">{formatIDR(grossSales - salesReturns)}</span>
                </div>
                <div className="flex justify-between py-1 text-terracotta-700">
                  <span>5101 Harga Pokok Penjualan (COGS / WAC)</span>
                  <span className="font-mono sf-tabular">({formatIDR(cogs)})</span>
                </div>
                <div className="flex justify-between border-t border-alabaster-sand py-1.5 font-bold text-pine-700">
                  <span>Laba Kotor (Gross Profit)</span>
                  <span className="font-mono sf-tabular">{formatIDR(grossSales - salesReturns - cogs)}</span>
                </div>
                {coa.filter((a) => a.type === 'Expense').map((exp) => (
                  <div key={exp.code} className="flex justify-between py-0.5 text-espresso-600">
                    <span>{exp.code} {exp.name}</span>
                    <span className="font-mono sf-tabular">({formatIDR(exp.balance)})</span>
                  </div>
                ))}
                <div className="flex justify-between border-t-2 border-pine-600 pt-2.5 text-sm font-extrabold text-pine-700">
                  <span>LABA BERSIH PERIODE BERJALAN</span>
                  <span className="font-mono sf-tabular">{formatIDR(netProfit)}</span>
                </div>
              </div>
            </div>

            {/* Balance Sheet */}
            <div className="rounded-2xl border border-alabaster-sand bg-white p-5 shadow-card">
              <h3 className="font-display text-base font-bold text-espresso-900">Neraca Keuangan (Balance Sheet)</h3>
              <p className="text-xs text-espresso-500">Posisi Keuangan Per 26 November 2026</p>
              <div className="mt-4 space-y-3 text-xs">
                <div>
                  <p className="font-bold uppercase tracking-wider text-pine-700">ASET (1xxx)</p>
                  {coa.filter((a) => a.type === 'Asset').map((a) => (
                    <div key={a.code} className="flex justify-between py-0.5 text-espresso-700">
                      <span>{a.code} {a.name}</span>
                      <span className="font-mono sf-tabular">{formatIDR(a.balance)}</span>
                    </div>
                  ))}
                  <div className="mt-1 flex justify-between border-t border-alabaster-sand pt-1 font-bold text-espresso-900">
                    <span>TOTAL ASET</span>
                    <span className="font-mono sf-tabular">{formatIDR(totalAssets)}</span>
                  </div>
                </div>

                <div>
                  <p className="font-bold uppercase tracking-wider text-terracotta-700">LIABILITAS (2xxx)</p>
                  {coa.filter((a) => a.type === 'Liability').map((a) => (
                    <div key={a.code} className="flex justify-between py-0.5 text-espresso-700">
                      <span>{a.code} {a.name}</span>
                      <span className="font-mono sf-tabular">{formatIDR(a.balance)}</span>
                    </div>
                  ))}
                  <div className="mt-1 flex justify-between border-t border-alabaster-sand pt-1 font-bold text-espresso-900">
                    <span>Total Liabilitas</span>
                    <span className="font-mono sf-tabular">{formatIDR(totalLiabilities)}</span>
                  </div>
                </div>

                <div>
                  <p className="font-bold uppercase tracking-wider text-ochre-700">EKUITAS (3xxx + Laba Berjalan)</p>
                  {coa.filter((a) => a.type === 'Equity').map((a) => (
                    <div key={a.code} className="flex justify-between py-0.5 text-espresso-700">
                      <span>{a.code} {a.name}</span>
                      <span className="font-mono sf-tabular">{formatIDR(a.balance)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-0.5 text-pine-700 font-semibold">
                    <span>3999 Laba Bersih Tahun Berjalan</span>
                    <span className="font-mono sf-tabular">{formatIDR(netProfit)}</span>
                  </div>
                  <div className="mt-1 flex justify-between border-t-2 border-pine-600 pt-2 text-sm font-extrabold text-pine-700">
                    <span>TOTAL LIABILITAS &amp; EKUITAS</span>
                    <span className="font-mono sf-tabular">{formatIDR(totalLiabAndEquity)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'journals' && (
        <div className="space-y-3">
          {journals.map((j) => {
            const sumD = j.lines.reduce((s, l) => s + l.debit, 0);
            const sumC = j.lines.reduce((s, l) => s + l.credit, 0);
            return (
              <div key={j.id} className="rounded-2xl border border-alabaster-sand bg-white p-5 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-pine-700">{j.entryNo}</span>
                      <StatusBadge label={j.sourceModule} tone="pine" />
                      <StatusBadge label={j.status.toUpperCase()} tone={j.status === 'posted' ? 'success' : 'warning'} />
                      <span className="font-mono text-[11px] text-espresso-500">Periode {j.period} • {j.date}</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-espresso-900">{j.description}</p>
                  </div>
                  {j.status === 'posted' && j.sourceModule !== 'Reversal' && canWriteAcc && user && (
                    <button
                      type="button"
                      onClick={() => reverseJournal(j.id, user)}
                      className="inline-flex items-center gap-1 rounded-lg border border-terracotta-600/30 bg-terracotta-50 px-3 py-1.5 text-xs font-bold text-terracotta-700 hover:bg-terracotta-600 hover:text-alabaster"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Buat Jurnal Pembalik
                    </button>
                  )}
                </div>
                <table className="mt-3 w-full text-left text-xs">
                  <thead className="border-b border-alabaster-sand bg-alabaster text-[11px] uppercase text-espresso-500">
                    <tr>
                      <th className="px-3 py-2">Akun COA</th>
                      <th className="px-3 py-2 text-right">Debit</th>
                      <th className="px-3 py-2 text-right">Kredit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-alabaster-subtle">
                    {j.lines.map((l, idx) => (
                      <tr key={idx}>
                        <td className={`px-3 py-1.5 ${l.credit > 0 ? 'pl-8 text-espresso-600' : 'font-medium text-espresso-900'}`}>
                          <span className="font-mono text-pine-700">{l.accountCode}</span> — {l.accountName}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono sf-tabular">{l.debit > 0 ? formatIDR(l.debit) : '—'}</td>
                        <td className="px-3 py-1.5 text-right font-mono sf-tabular">{l.credit > 0 ? formatIDR(l.credit) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-alabaster-sand bg-alabaster/70 font-bold">
                      <td className="px-3 py-2">TOTAL JURNAL (SEIMBANG)</td>
                      <td className="px-3 py-2 text-right font-mono text-pine-700">{formatIDR(sumD)}</td>
                      <td className="px-3 py-2 text-right font-mono text-pine-700">{formatIDR(sumC)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'trial' && (
        <div className="overflow-hidden rounded-2xl border border-alabaster-sand bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-alabaster-sand bg-alabaster text-[11px] uppercase text-espresso-500">
                <tr>
                  <th className="px-4 py-3">Kode</th>
                  <th className="px-4 py-3">Nama Akun</th>
                  <th className="px-4 py-3">Tipe</th>
                  <th className="px-4 py-3 text-right">Debit (Rp)</th>
                  <th className="px-4 py-3 text-right">Kredit (Rp)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-alabaster-subtle">
                {coa.map((a) => (
                  <tr key={a.code} className="hover:bg-alabaster/60">
                    <td className="px-4 py-2.5 font-mono font-bold text-pine-700">{a.code}</td>
                    <td className="px-4 py-2.5 font-medium text-espresso-900">{a.name}</td>
                    <td className="px-4 py-2.5"><StatusBadge label={a.type} tone="neutral" /></td>
                    <td className="px-4 py-2.5 text-right font-mono sf-tabular">
                      {a.normalBalance === 'debit' ? formatIDR(a.balance) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono sf-tabular">
                      {a.normalBalance === 'credit' ? formatIDR(a.balance) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-pine-600 bg-pine-50 font-bold text-pine-800">
                  <td colSpan={3} className="px-4 py-3">TOTAL NERACA SALDO (SELISIH = {formatIDR(tbDebit - tbCredit)})</td>
                  <td className="px-4 py-3 text-right font-mono sf-tabular">{formatIDR(tbDebit)}</td>
                  <td className="px-4 py-3 text-right font-mono sf-tabular">{formatIDR(tbCredit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'coa' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {coa.map((a) => (
            <div key={a.code} className="rounded-xl border border-alabaster-sand bg-white p-4 shadow-card">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-pine-700">{a.code}</span>
                <StatusBadge label={`${a.type} • ${a.normalBalance.toUpperCase()}`} tone="neutral" />
              </div>
              <p className="mt-1 font-semibold text-sm text-espresso-900">{a.name}</p>
              <p className="mt-2 font-mono text-base font-bold text-espresso-900 sf-tabular">{formatIDR(a.balance)}</p>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'periods' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {periods.map((p) => (
            <div key={p.period} className="flex items-center justify-between rounded-2xl border border-alabaster-sand bg-white p-5 shadow-card">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-pine-700">{p.period}</span>
                  <StatusBadge label={p.status === 'closed' ? 'TERKUNCI (CLOSED)' : 'TERBUKA (OPEN)'} tone={p.status === 'closed' ? 'danger' : 'success'} />
                </div>
                <p className="mt-1 font-display text-base font-bold text-espresso-900">{p.label}</p>
                {p.closedAt && <p className="text-xs text-espresso-500">Ditutup {p.closedAt} oleh {p.closedBy}</p>}
              </div>
              {canWriteAcc && user && (
                <button
                  type="button"
                  onClick={() => togglePeriodStatus(p.period, user)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold ${
                    p.status === 'open'
                      ? 'bg-espresso-900 text-alabaster hover:bg-terracotta-600'
                      : 'border border-alabaster-sand bg-alabaster text-espresso-800 hover:bg-pine-50'
                  }`}
                >
                  {p.status === 'open' ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                  {p.status === 'open' ? 'Tutup & Kunci' : 'Buka Periode'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Manual Journal Modal with Real-time Debit == Credit Validator */}
      <Modal
        open={journalModal}
        onClose={() => setJournalModal(false)}
        title="Posting Jurnal Umum Double-Entry"
        subtitle="Sistem memvalidasi kesetimbangan Debit = Kredit dan melarang posting ke periode terkunci."
        maxWidthClass="max-w-2xl"
      >
        <form onSubmit={handlePostJournal} className="space-y-4 text-xs">
          {jError && (
            <div className="flex items-start gap-2 rounded-xl bg-semantic-dangerBg p-3 font-semibold text-semantic-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{jError}</span>
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block font-semibold">Tanggal (Cek Periode)</label>
              <input type="date" value={jDate} onChange={(e) => setJDate(e.target.value)} className="w-full rounded-lg border border-alabaster-sand px-3 py-2 font-mono" />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block font-semibold">Deskripsi Jurnal</label>
              <input value={jDesc} onChange={(e) => setJDesc(e.target.value)} required className="w-full rounded-lg border border-alabaster-sand px-3 py-2" />
            </div>
          </div>

          <div className="space-y-2">
            {jLines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2">
                <select
                  value={line.accountCode}
                  onChange={(e) => {
                    const acct = coa.find((a) => a.code === e.target.value);
                    setJLines((prev) =>
                      prev.map((l, i) =>
                        i === idx ? { ...l, accountCode: e.target.value, accountName: acct?.name || '' } : l
                      )
                    );
                  }}
                  className="col-span-6 rounded-lg border border-alabaster-sand px-2.5 py-2"
                >
                  {coa.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
                </select>
                <input
                  type="number"
                  min={0}
                  placeholder="Debit"
                  value={line.debit}
                  onChange={(e) =>
                    setJLines((prev) => prev.map((l, i) => (i === idx ? { ...l, debit: Number(e.target.value) } : l)))
                  }
                  className="col-span-3 rounded-lg border border-alabaster-sand px-2.5 py-2 text-right font-mono"
                />
                <input
                  type="number"
                  min={0}
                  placeholder="Kredit"
                  value={line.credit}
                  onChange={(e) =>
                    setJLines((prev) => prev.map((l, i) => (i === idx ? { ...l, credit: Number(e.target.value) } : l)))
                  }
                  className="col-span-3 rounded-lg border border-alabaster-sand px-2.5 py-2 text-right font-mono"
                />
              </div>
            ))}
          </div>

          <div className={`flex items-center justify-between rounded-xl p-3 font-mono font-bold ${isBalancedInput ? 'bg-semantic-successBg text-semantic-success' : 'bg-semantic-dangerBg text-semantic-danger'}`}>
            <span>Debit: {formatIDR(totalDebitInput)} | Kredit: {formatIDR(totalCreditInput)}</span>
            <span>{isBalancedInput ? 'SEIMBANG ✓' : `SELISIH ${formatIDR(totalDebitInput - totalCreditInput)}`}</span>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setJournalModal(false)} className="rounded-lg border border-alabaster-sand px-4 py-2 font-semibold">Batal</button>
            <button type="submit" disabled={!isBalancedInput} className="rounded-lg bg-pine-600 px-4 py-2 font-bold text-alabaster hover:bg-pine-700 disabled:opacity-40">
              Posting Jurnal Permanen
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

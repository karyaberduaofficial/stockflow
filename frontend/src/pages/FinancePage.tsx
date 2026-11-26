import React, { useState } from 'react';
import { ArrowRightLeft, Landmark, Plus, TrendingUp, Wallet } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { ExportActionBar, PageHeader, StatCard, StatusBadge, TabBar } from '../components/common/UIPrimitives';
import { formatIDR } from '../utils/format';
import { CashLedgerEntry } from '../types';

export const FinancePage: React.FC = () => {
  const { user } = useAuth();
  const {
    financialAccounts,
    cashLedger,
    coa,
    customers,
    purchaseOrders,
    recordCashEntry,
    transferBetweenAccounts,
  } = useStore();

  const [activeTab, setActiveTab] = useState('ledger');

  // Cash entry form
  const [accountId, setAccountId] = useState(2);
  const [direction, setDirection] = useState<'in' | 'out'>('out');
  const [category, setCategory] = useState<CashLedgerEntry['category']>('Operating Expense');
  const [amount, setAmount] = useState(3_500_000);
  const [description, setDescription] = useState('Biaya pengiriman ekspedisi furnitur luar kota');

  // Transfer form
  const [fromAcct, setFromAcct] = useState(2);
  const [toAcct, setToAcct] = useState(3);
  const [trfAmount, setTrfAmount] = useState(25_000_000);
  const [trfDesc, setTrfDesc] = useState('Top-up dana rekening payroll & pajak');
  const [trfError, setTrfError] = useState<string | null>(null);

  // Interactive Waterfall simulation offsets
  const [simSalesBoostPct, setSimSalesBoostPct] = useState(0);
  const [simOpexCutPct, setSimOpexCutPct] = useState(0);

  const canWriteFinance = ['admin', 'finance'].includes(user?.role || '');

  const totalCashBank = financialAccounts.reduce((s, a) => s + a.balance, 0);
  const totalAR = customers.reduce((s, c) => s + c.receivableBalance, 0);
  const totalAP = purchaseOrders
    .filter((p) => p.status === 'received' && p.invoiceStatus === 'unpaid')
    .reduce((s, p) => s + p.totalAmount, 0);

  const baseGrossSales = coa.find((a) => a.code === '4101')?.balance || 0;
  const baseReturns = coa.find((a) => a.code === '4102')?.balance || 0;
  const baseCogs = coa.find((a) => a.code === '5101')?.balance || 0;
  const baseOpex = coa.filter((a) => a.type === 'Expense').reduce((s, a) => s + a.balance, 0);

  const simGross = Math.round(baseGrossSales * (1 + simSalesBoostPct / 100));
  const simNetSales = simGross - baseReturns;
  const simCogs = Math.round(baseCogs * (1 + simSalesBoostPct / 100));
  const simGrossProfit = simNetSales - simCogs;
  const simOpex = Math.round(baseOpex * (1 - simOpexCutPct / 100));
  const simNetProfit = simGrossProfit - simOpex;

  return (
    <div>
      <PageHeader
        eyebrow="Modul 06 • Keuangan, Kas & Bank"
        title="Arus Kas, Pemindahbukuan, AR/AP & Net Profit Waterfall"
        subtitle="Kelola kas showroom, rekening bank operasional, transfer internal bebas distorsi laba, piutang pelanggan, dan kalkulator margin bersih."
        actions={<ExportActionBar report="financial" label="Laporan Keuangan" compact />}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Saldo Kas & Bank"
          value={formatIDR(totalCashBank)}
          hint={`${financialAccounts.length} akun aktif`}
          icon={<Wallet className="h-5 w-5" />}
          accent="pine"
        />
        <StatCard
          label="Total Piutang Usaha (AR)"
          value={formatIDR(totalAR)}
          hint="Pelanggan B2B & Interior"
          icon={<TrendingUp className="h-5 w-5" />}
          accent="terracotta"
        />
        <StatCard
          label="Utang Supplier Jatuh Tempo (AP)"
          value={formatIDR(totalAP)}
          hint="Faktur PO belum dibayar"
          icon={<Landmark className="h-5 w-5" />}
          accent="ochre"
        />
      </div>

      <TabBar
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'ledger', label: 'Buku Kas & Bank', count: cashLedger.length },
          { id: 'transfer', label: 'Transfer Antar Rekening' },
          { id: 'arap', label: 'Piutang (AR) & Utang (AP)' },
          { id: 'waterfall', label: 'Kalkulator Net Profit Waterfall' },
        ]}
      />

      {activeTab === 'ledger' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-4">
            <div className="rounded-2xl border border-alabaster-sand bg-white p-5 shadow-card">
              <h3 className="font-display text-sm font-bold text-espresso-900">Saldo Akun Kas &amp; Bank</h3>
              <div className="mt-3 space-y-2.5">
                {financialAccounts.map((a) => (
                  <div key={a.id} className="rounded-xl border border-alabaster-sand bg-alabaster p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-espresso-900">{a.name}</span>
                      <span className="font-mono text-[10px] text-espresso-500">{a.code}</span>
                    </div>
                    <p className="mt-1 font-mono text-base font-bold text-pine-700 sf-tabular">{formatIDR(a.balance)}</p>
                    <p className="font-mono text-[10px] text-espresso-500">{a.accountNumberMasked}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-alabaster-sand bg-white p-5 shadow-card">
              <h3 className="flex items-center gap-1.5 font-display text-sm font-bold text-espresso-900">
                <Plus className="h-4 w-4 text-pine-600" /> Catat Pemasukan / Pengeluaran
              </h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!user) return;
                  recordCashEntry({ accountId, category, direction, amount, description }, user);
                }}
                className="mt-3 space-y-3 text-xs"
              >
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDirection('in');
                      setCategory('Other Income');
                    }}
                    className={`rounded-lg py-2 font-bold ${direction === 'in' ? 'bg-pine-600 text-alabaster' : 'bg-alabaster text-espresso-700'}`}
                  >
                    Kas Masuk
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDirection('out');
                      setCategory('Operating Expense');
                    }}
                    className={`rounded-lg py-2 font-bold ${direction === 'out' ? 'bg-terracotta-600 text-alabaster' : 'bg-alabaster text-espresso-700'}`}
                  >
                    Kas Keluar
                  </button>
                </div>
                <select value={accountId} onChange={(e) => setAccountId(Number(e.target.value))} className="w-full rounded-lg border border-alabaster-sand px-3 py-2">
                  {financialAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <input type="number" min={1000} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-full rounded-lg border border-alabaster-sand px-3 py-2 font-mono" />
                <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-lg border border-alabaster-sand px-3 py-2" />
                <button type="submit" disabled={!canWriteFinance} className="w-full rounded-xl bg-pine-600 py-2.5 font-bold text-alabaster hover:bg-pine-700 disabled:opacity-50">
                  Simpan ke Buku Kas
                </button>
              </form>
            </div>
          </div>

          <div className="rounded-2xl border border-alabaster-sand bg-white shadow-card lg:col-span-8 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-alabaster-sand bg-alabaster text-[11px] uppercase text-espresso-500">
                  <tr>
                    <th className="px-4 py-3">Tanggal &amp; Ref</th>
                    <th className="px-4 py-3">Akun &amp; Kategori</th>
                    <th className="px-4 py-3">Keterangan</th>
                    <th className="px-4 py-3 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-alabaster-subtle">
                  {cashLedger.map((entry) => (
                    <tr key={entry.id} className="hover:bg-alabaster/60">
                      <td className="px-4 py-3 font-mono">
                        <p className="font-bold text-espresso-900">{entry.referenceNo}</p>
                        <p className="text-[10px] text-espresso-500">{entry.date}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-espresso-900">{entry.accountName}</p>
                        <StatusBadge
                          label={entry.isInternalTransfer ? 'TRANSFER INTERNAL (NETRAL)' : entry.category}
                          tone={entry.isInternalTransfer ? 'info' : entry.direction === 'in' ? 'success' : 'terracotta'}
                        />
                      </td>
                      <td className="px-4 py-3 text-espresso-600">{entry.description}</td>
                      <td className={`px-4 py-3 text-right font-mono font-bold sf-tabular ${entry.direction === 'in' ? 'text-semantic-success' : 'text-semantic-danger'}`}>
                        {entry.direction === 'in' ? '+' : '-'} {formatIDR(entry.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'transfer' && (
        <div className="mx-auto max-w-xl rounded-2xl border border-alabaster-sand bg-white p-6 shadow-card">
          <h3 className="flex items-center gap-2 font-display text-base font-bold text-espresso-900">
            <ArrowRightLeft className="h-4 w-4 text-pine-600" /> Pemindahbukuan Antar Rekening (Non-Pendapatan / Non-Beban)
          </h3>
          <p className="mt-1 text-xs text-espresso-600">
            Memindahkan dana antar kas/bank perusahaan hanya mengubah komposisi aset lancar dan <strong>TIDAK</strong> dicatat sebagai Pendapatan atau Beban pada Laba Rugi.
          </p>
          {trfError && <div className="mt-3 rounded-lg bg-semantic-dangerBg p-2.5 text-xs font-semibold text-semantic-danger">{trfError}</div>}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setTrfError(null);
              if (!user) return;
              const res = transferBetweenAccounts({ fromAccountId: fromAcct, toAccountId: toAcct, amount: trfAmount, description: trfDesc }, user);
              if (!res.ok) setTrfError(res.error || 'Transfer gagal.');
            }}
            className="mt-4 space-y-3 text-xs"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-semibold">Dari Rekening</label>
                <select value={fromAcct} onChange={(e) => setFromAcct(Number(e.target.value))} className="w-full rounded-lg border border-alabaster-sand px-3 py-2">
                  {financialAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-semibold">Ke Rekening</label>
                <select value={toAcct} onChange={(e) => setToAcct(Number(e.target.value))} className="w-full rounded-lg border border-alabaster-sand px-3 py-2">
                  {financialAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block font-semibold">Nominal Transfer (Rp)</label>
              <input type="number" min={10000} value={trfAmount} onChange={(e) => setTrfAmount(Number(e.target.value))} className="w-full rounded-lg border border-alabaster-sand px-3 py-2 font-mono" />
            </div>
            <div>
              <label className="mb-1 block font-semibold">Keterangan</label>
              <input value={trfDesc} onChange={(e) => setTrfDesc(e.target.value)} className="w-full rounded-lg border border-alabaster-sand px-3 py-2" />
            </div>
            <button type="submit" disabled={!canWriteFinance} className="w-full rounded-xl bg-pine-600 py-2.5 font-bold text-alabaster hover:bg-pine-700 disabled:opacity-50">
              Eksekusi Pemindahbukuan &amp; Posting Jurnal Aset-ke-Aset
            </button>
          </form>
        </div>
      )}

      {activeTab === 'arap' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-alabaster-sand bg-white p-5 shadow-card">
            <h3 className="font-display text-base font-bold text-espresso-900">Daftar Piutang Usaha (Accounts Receivable)</h3>
            <div className="mt-3 space-y-2.5 text-xs">
              {customers.filter((c) => c.receivableBalance > 0).map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-xl bg-alabaster p-3.5">
                  <div>
                    <p className="font-bold text-espresso-900">{c.name}</p>
                    <p className="text-[11px] text-espresso-500">{c.segment} • Limit {formatIDR(c.creditLimit)}</p>
                  </div>
                  <span className="font-mono text-sm font-bold text-terracotta-700 sf-tabular">{formatIDR(c.receivableBalance)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-alabaster-sand bg-white p-5 shadow-card">
            <h3 className="font-display text-base font-bold text-espresso-900">Daftar Utang Pemasok (Accounts Payable)</h3>
            <div className="mt-3 space-y-2.5 text-xs">
              {purchaseOrders.filter((p) => p.status === 'received').map((po) => (
                <div key={po.id} className="flex items-center justify-between rounded-xl bg-alabaster p-3.5">
                  <div>
                    <p className="font-bold text-espresso-900">{po.supplierName}</p>
                    <p className="font-mono text-[11px] text-espresso-500">{po.poNumber} • {po.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-bold text-espresso-900 sf-tabular">{formatIDR(po.totalAmount)}</p>
                    <StatusBadge label={po.invoiceStatus.toUpperCase()} tone={po.invoiceStatus === 'paid' ? 'success' : 'warning'} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'waterfall' && (
        <div className="rounded-2xl border border-alabaster-sand bg-white p-6 shadow-card">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-display text-base font-bold text-espresso-900">Interactive Net Profit Waterfall Calculator</h3>
              <p className="text-xs text-espresso-600">
                Gross Sales → Net Sales → COGS (WAC) → Gross Profit → Operating Expenses → Net Profit
              </p>
            </div>
            <div className="flex flex-wrap gap-4 text-xs">
              <label className="flex flex-col">
                <span className="font-semibold text-espresso-700">Simulasi Pertumbuhan Omzet: {simSalesBoostPct}%</span>
                <input type="range" min={-20} max={30} value={simSalesBoostPct} onChange={(e) => setSimSalesBoostPct(Number(e.target.value))} className="accent-pine-600" />
              </label>
              <label className="flex flex-col">
                <span className="font-semibold text-espresso-700">Efisiensi Beban Operasional: {simOpexCutPct}%</span>
                <input type="range" min={0} max={25} value={simOpexCutPct} onChange={(e) => setSimOpexCutPct(Number(e.target.value))} className="accent-terracotta-600" />
              </label>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {[
              { label: '1. Penjualan Kotor (Gross Sales)', val: simGross, pct: 100, bar: 'bg-pine-600' },
              { label: '2. Retur & Diskon Penjualan', val: -baseReturns, pct: (baseReturns / simGross) * 100, bar: 'bg-ochre-600' },
              { label: '3. Penjualan Bersih (Net Sales)', val: simNetSales, pct: (simNetSales / simGross) * 100, bar: 'bg-pine-500' },
              { label: '4. Harga Pokok Penjualan (COGS / WAC)', val: -simCogs, pct: (simCogs / simGross) * 100, bar: 'bg-terracotta-600' },
              { label: '5. Laba Kotor (Gross Profit)', val: simGrossProfit, pct: (simGrossProfit / simGross) * 100, bar: 'bg-olive-600' },
              { label: '6. Beban Operasional (Gaji, BPJS Pemberi Kerja, Sewa)', val: -simOpex, pct: (simOpex / simGross) * 100, bar: 'bg-burgundy-600' },
              { label: '7. LABA BERSIH (NET PROFIT)', val: simNetProfit, pct: Math.max(0, (simNetProfit / simGross) * 100), bar: 'bg-pine-700' },
            ].map((row) => (
              <div key={row.label} className="rounded-xl border border-alabaster-sand bg-alabaster/60 p-3.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-espresso-900">{row.label}</span>
                  <span className="font-mono font-bold text-espresso-900 sf-tabular">
                    {formatIDR(row.val)} ({((Math.abs(row.val) / (simGross || 1)) * 100).toFixed(1)}%)
                  </span>
                </div>
                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-alabaster-subtle">
                  <div className={`h-full rounded-full ${row.bar}`} style={{ width: `${Math.min(100, Math.abs(row.pct))}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

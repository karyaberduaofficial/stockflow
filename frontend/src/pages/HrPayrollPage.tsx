import React, { useState } from 'react';
import { CheckCircle2, FileText, Lock, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import {
  ExportActionBar,
  Modal,
  PageHeader,
  StatusBadge,
  TabBar,
} from '../components/common/UIPrimitives';
import { formatIDR, maskBankAccount, maskNik, maskNpwp } from '../utils/format';
import { PayrollRecord } from '../types';

export const HrPayrollPage: React.FC = () => {
  const { user } = useAuth();
  const { employees, payrolls, advancePayrollStatus } = useStore();
  const [activeTab, setActiveTab] = useState('payroll');
  const [selectedSlip, setSelectedSlip] = useState<PayrollRecord | null>(null);

  const canUnmaskPii = user?.role === 'hr_payroll';
  const canHrCheck = ['admin', 'hr_payroll'].includes(user?.role || '');
  const canManagerApprove = ['admin', 'manager'].includes(user?.role || '');
  const canFinancePay = ['admin', 'finance'].includes(user?.role || '');

  const totalGross = payrolls.reduce((s, p) => s + p.grossSalary, 0);
  const totalEmpBpjs = payrolls.reduce((s, p) => s + p.bpjsEmployee, 0);
  const totalEmployerBpjs = payrolls.reduce((s, p) => s + p.bpjsEmployer, 0);
  const totalPph21 = payrolls.reduce((s, p) => s + p.pph21Ter, 0);
  const totalNet = payrolls.reduce((s, p) => s + p.netSalary, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Modul 09 • SDM, BPJS & Penggajian"
        title="Direktori Karyawan, Split BPJS & Alur Payroll Multi-Level"
        subtitle="Enkripsi PII (NIK/NPWP/Rekening) bagi peran non-HR, pemisahan ketat BPJS Karyawan vs Pemberi Kerja, dan alur persetujuan HR → Manager → Finance."
        actions={<ExportActionBar report="payroll" label="Rekap Payroll" compact />}
      />

      <TabBar
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'payroll', label: 'Alur Penggajian & Slip Gaji', count: payrolls.length },
          { id: 'bpjs', label: 'Visualisasi Split BPJS' },
          { id: 'directory', label: 'Direktori PII & Absensi', count: employees.length },
        ]}
      />

      {activeTab === 'payroll' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              { label: 'Total Gaji Bruto', val: totalGross, cls: 'text-espresso-900' },
              { label: 'Potongan BPJS Karyawan', val: totalEmpBpjs, cls: 'text-terracotta-700' },
              { label: 'PPh 21 (TER)', val: totalPph21, cls: 'text-ochre-700' },
              { label: 'Total Take Home Pay', val: totalNet, cls: 'text-pine-700' },
              { label: 'Beban BPJS Perusahaan', val: totalEmployerBpjs, cls: 'text-olive-700' },
            ].map((k) => (
              <div key={k.label} className="rounded-xl border border-alabaster-sand bg-white p-3.5 shadow-card">
                <p className="text-[11px] font-semibold text-espresso-500">{k.label}</p>
                <p className={`mt-1 font-mono text-base font-bold sf-tabular ${k.cls}`}>{formatIDR(k.val)}</p>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-2xl border border-alabaster-sand bg-white shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-alabaster-sand bg-alabaster text-[11px] uppercase text-espresso-500">
                  <tr>
                    <th className="px-4 py-3">Karyawan</th>
                    <th className="px-4 py-3 text-right">Bruto</th>
                    <th className="px-4 py-3 text-right">BPJS Karyawan</th>
                    <th className="px-4 py-3 text-right">PPh 21 TER</th>
                    <th className="px-4 py-3 text-right">Gaji Bersih (Net)</th>
                    <th className="px-4 py-3">Status Workflow</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-alabaster-subtle">
                  {payrolls.map((p) => (
                    <tr key={p.id} className="hover:bg-alabaster/60">
                      <td className="px-4 py-3">
                        <p className="font-bold text-espresso-900">{p.employeeName}</p>
                        <p className="font-mono text-[10px] text-espresso-500">{p.employeeNo} • {p.department}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-mono sf-tabular">{formatIDR(p.grossSalary)}</td>
                      <td className="px-4 py-3 text-right font-mono sf-tabular text-terracotta-700">-{formatIDR(p.bpjsEmployee)}</td>
                      <td className="px-4 py-3 text-right font-mono sf-tabular text-ochre-700">-{formatIDR(p.pph21Ter)}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold sf-tabular text-pine-700">{formatIDR(p.netSalary)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          label={p.status.replace('_', ' ').toUpperCase()}
                          tone={
                            p.status === 'finance_paid'
                              ? 'success'
                              : p.status === 'manager_approved'
                              ? 'pine'
                              : p.status === 'hr_checked'
                              ? 'info'
                              : 'warning'
                          }
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex flex-wrap justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedSlip(p)}
                            className="inline-flex items-center gap-1 rounded-lg bg-alabaster px-2.5 py-1.5 text-[11px] font-bold text-espresso-800 border border-alabaster-sand hover:border-pine-600"
                          >
                            <FileText className="h-3.5 w-3.5" /> Slip
                          </button>
                          {p.status === 'draft' && canHrCheck && user && (
                            <button
                              type="button"
                              onClick={() => advancePayrollStatus(p.id, 'hr_checked', user)}
                              className="rounded-lg bg-olive-600 px-2.5 py-1.5 text-[11px] font-bold text-alabaster"
                            >
                              Verifikasi HR
                            </button>
                          )}
                          {p.status === 'hr_checked' && canManagerApprove && user && (
                            <button
                              type="button"
                              onClick={() => advancePayrollStatus(p.id, 'manager_approved', user)}
                              className="rounded-lg bg-terracotta-600 px-2.5 py-1.5 text-[11px] font-bold text-alabaster"
                            >
                              Setujui Manager
                            </button>
                          )}
                          {p.status === 'manager_approved' && canFinancePay && user && (
                            <button
                              type="button"
                              onClick={() => advancePayrollStatus(p.id, 'finance_paid', user)}
                              className="rounded-lg bg-pine-600 px-2.5 py-1.5 text-[11px] font-bold text-alabaster"
                            >
                              Bayar (Finance + Jurnal)
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
        </div>
      )}

      {activeTab === 'bpjs' && (
        <div className="rounded-2xl border border-alabaster-sand bg-white p-6 shadow-card">
          <h3 className="font-display text-base font-bold text-espresso-900">
            Pemisahan Porsi BPJS Karyawan vs Pemberi Kerja (Aturan Akuntansi Payroll)
          </h3>
          <p className="mt-1 text-xs text-espresso-600">
            Porsi BPJS Pemberi Kerja (Kesehatan 4% + JKK/JKM/JHT/JP 6.24%) dicatat sebagai <strong>Beban Perusahaan (6102)</strong> dan <strong>TIDAK PERNAH</strong> memotong Take Home Pay karyawan.
          </p>
          <div className="mt-5 space-y-3">
            {payrolls.map((p) => {
              const totalBpjs = p.bpjsEmployee + p.bpjsEmployer;
              const empPct = Math.round((p.bpjsEmployee / totalBpjs) * 100);
              const compPct = 100 - empPct;
              return (
                <div key={p.id} className="rounded-xl border border-alabaster-sand bg-alabaster/60 p-4 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-espresso-900">{p.employeeName} ({p.position})</span>
                    <span className="font-mono text-espresso-700">
                      Karyawan: <strong className="text-terracotta-700">{formatIDR(p.bpjsEmployee)}</strong> | Perusahaan: <strong className="text-pine-700">{formatIDR(p.bpjsEmployer)}</strong>
                    </span>
                  </div>
                  <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full bg-alabaster-subtle">
                    <div className="bg-terracotta-600" style={{ width: `${empPct}%` }} title={`Potongan Karyawan ${empPct}%`} />
                    <div className="bg-pine-600" style={{ width: `${compPct}%` }} title={`Beban Perusahaan ${compPct}%`} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'directory' && (
        <div className="overflow-hidden rounded-2xl border border-alabaster-sand bg-white shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-alabaster-sand bg-alabaster px-4 py-3 text-xs">
            <span className="flex items-center gap-2 font-bold text-espresso-900">
              <Users className="h-4 w-4 text-pine-600" /> Direktori Karyawan, Kehadiran &amp; Proteksi PII
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 font-semibold border border-alabaster-sand">
              {canUnmaskPii ? (
                <>
                  <ShieldCheck className="h-3.5 w-3.5 text-pine-600" /> PII Terdekripsi (Otorisasi {user?.role})
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5 text-terracotta-600" /> PII Tersamar Otomatis (Peran {user?.role})
                </>
              )}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-alabaster-sand bg-alabaster/60 text-[11px] uppercase text-espresso-500">
                <tr>
                  <th className="px-4 py-3">NIP &amp; Nama</th>
                  <th className="px-4 py-3">PTKP &amp; Hadir/Cuti</th>
                  <th className="px-4 py-3">NIK</th>
                  <th className="px-4 py-3">NPWP</th>
                  <th className="px-4 py-3">Rekening Gaji</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-alabaster-subtle">
                {employees.map((e) => (
                  <tr key={e.id} className="hover:bg-alabaster/60">
                    <td className="px-4 py-3">
                      <p className="font-bold text-espresso-900">{e.name}</p>
                      <p className="font-mono text-[10px] text-pine-700">{e.employeeNo} • {e.position}</p>
                    </td>
                    <td className="px-4 py-3 font-mono">
                      <StatusBadge label={e.ptkpStatus} tone="pine" />
                      <span className="ml-2 text-espresso-600">{e.attendanceDays}h / {e.leaveDays}c</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-espresso-700">{maskNik(e.nik, canUnmaskPii)}</td>
                    <td className="px-4 py-3 font-mono text-espresso-700">{maskNpwp(e.npwp, canUnmaskPii)}</td>
                    <td className="px-4 py-3 font-mono text-espresso-700">
                      {e.bankName} {maskBankAccount(e.bankAccount, canUnmaskPii)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={Boolean(selectedSlip)}
        onClose={() => setSelectedSlip(null)}
        title={`Slip Gaji Digital — ${selectedSlip?.employeeName || ''}`}
        subtitle={`Periode ${selectedSlip?.period || ''} • Akses Terbatas (Scoped Payslip)`}
      >
        {selectedSlip && (
          <div className="space-y-4 text-xs">
            <div className="rounded-xl border border-pine-200 bg-alabaster p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-espresso-600">NIP / Jabatan</span>
                <span className="font-semibold text-espresso-900">{selectedSlip.employeeNo} • {selectedSlip.position}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-espresso-600">Gaji Bruto (Pokok + Tunjangan)</span>
                <span className="font-mono font-semibold">{formatIDR(selectedSlip.grossSalary)}</span>
              </div>
              <div className="flex justify-between text-terracotta-700">
                <span>Potongan BPJS Karyawan</span>
                <span className="font-mono">-{formatIDR(selectedSlip.bpjsEmployee)}</span>
              </div>
              <div className="flex justify-between text-ochre-700">
                <span>Pemotongan PPh 21 (TER)</span>
                <span className="font-mono">-{formatIDR(selectedSlip.pph21Ter)}</span>
              </div>
              <div className="flex justify-between border-t border-pine-600 pt-2 text-sm font-extrabold text-pine-700">
                <span>GAJI BERSIH (TAKE HOME PAY)</span>
                <span className="font-mono">{formatIDR(selectedSlip.netSalary)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-olive-50 px-3 py-2 text-[11px] text-olive-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Kontribusi BPJS Pemberi Kerja ({formatIDR(selectedSlip.bpjsEmployer)}) ditanggung penuh perusahaan.</span>
            </div>
            <ExportActionBar report="payslip" selectedPayslip={selectedSlip} label="Unduh Slip Gaji" />
          </div>
        )}
      </Modal>
    </div>
  );
};

import React, { useState } from 'react';
import { Building2, Check, ShieldAlert, ShieldCheck, UserCheck, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { RBAC_MATRIX_MODULES, ROLE_METADATA, canAccessRoute } from '../config/rbac';
import { PageHeader, StatusBadge, TabBar } from '../components/common/UIPrimitives';
import { RoleName } from '../types';

const ALL_ROLES: RoleName[] = [
  'admin',
  'manager',
  'warehouse',
  'purchasing',
  'sales',
  'finance',
  'hr_payroll',
  'guest_pending',
];

export const SettingsPage: React.FC = () => {
  const { user, syncCurrentUserFromList } = useAuth();
  const {
    users,
    company,
    activityLogs,
    approveAndAssignUserRole,
    updateUserStatus,
    updateCompany,
  } = useStore();

  const [activeTab, setActiveTab] = useState('users');
  const [pendingRoleSelection, setPendingRoleSelection] = useState<Record<number, RoleName>>({});
  const [compName, setCompName] = useState(company.legalEntity);
  const [compNpwp, setCompNpwp] = useState(company.npwp);
  const [compAddress, setCompAddress] = useState(company.address);

  const pendingUsers = users.filter((u) => u.role === 'guest_pending' || u.status === 'pending_approval');

  const handleAssignRole = (userId: number, role: RoleName) => {
    if (!user) return;
    approveAndAssignUserRole(userId, role, user);
    syncCurrentUserFromList(users);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Modul 12 • Pusat Pengaturan & Keamanan (Admin Only)"
        title="Otorisasi Pengguna, Matriks RBAC 8-Role & Audit Keamanan"
        subtitle="Kelola persetujuan akun Google baru (guest_pending), tetapkan hak akses per peran, konfigurasi entitas perusahaan, dan pantau percobaan akses 403 real-time."
      />

      <TabBar
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'users', label: 'Manajemen Pengguna & Approval Google', count: pendingUsers.length },
          { id: 'rbac', label: 'Matriks RBAC (8 Roles × 11 Modul)' },
          { id: 'audit', label: 'Log Keamanan & Aktivitas', count: activityLogs.length },
          { id: 'company', label: 'Profil Perusahaan & Sistem' },
        ]}
      />

      {activeTab === 'users' && (
        <div className="space-y-5">
          {pendingUsers.length > 0 && (
            <div className="rounded-2xl border border-terracotta-600/35 bg-terracotta-50/70 p-5">
              <h3 className="flex items-center gap-2 font-display text-base font-bold text-terracotta-800">
                <ShieldAlert className="h-5 w-5" /> Antrean Persetujuan Akun Google Baru ({pendingUsers.length})
              </h3>
              <p className="mt-1 text-xs text-espresso-700">
                Akun berikut terkarantina sebagai <code className="font-mono font-bold">guest_pending</code>. Pilih role resmi lalu klik Setujui untuk membuka akses.
              </p>
              <div className="mt-4 space-y-3">
                {pendingUsers.map((pu) => {
                  const chosen = pendingRoleSelection[pu.id] || 'warehouse';
                  return (
                    <div key={pu.id} className="flex flex-col gap-3 rounded-xl border border-alabaster-sand bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-xs">
                        <p className="font-bold text-espresso-900">{pu.name}</p>
                        <p className="font-mono text-espresso-500">{pu.email} • Terdaftar {pu.createdAt}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          aria-label={`Pilih role untuk ${pu.name}`}
                          value={chosen}
                          onChange={(e) => setPendingRoleSelection((prev) => ({ ...prev, [pu.id]: e.target.value as RoleName }))}
                          className="rounded-lg border border-alabaster-sand bg-alabaster px-3 py-2 text-xs font-semibold"
                        >
                          {ALL_ROLES.filter((r) => r !== 'guest_pending').map((r) => (
                            <option key={r} value={r}>{ROLE_METADATA[r].label}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleAssignRole(pu.id, chosen)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-pine-600 px-3.5 py-2 text-xs font-bold text-alabaster hover:bg-pine-700"
                        >
                          <UserCheck className="h-4 w-4" /> Setujui &amp; Aktifkan
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-alabaster-sand bg-white shadow-card">
            <div className="flex items-center gap-2 border-b border-alabaster-sand bg-alabaster px-4 py-3 text-xs font-bold text-espresso-900">
              <Users className="h-4 w-4 text-pine-600" /> Daftar Seluruh Pengguna StockFlow ({users.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-alabaster-sand bg-alabaster/60 text-[11px] uppercase text-espresso-500">
                  <tr>
                    <th className="px-4 py-3">Pengguna</th>
                    <th className="px-4 py-3">Autentikasi</th>
                    <th className="px-4 py-3">Role Aktif</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Kontrol Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-alabaster-subtle">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-alabaster/60">
                      <td className="px-4 py-3">
                        <p className="font-bold text-espresso-900">{u.name}</p>
                        <p className="font-mono text-[11px] text-espresso-500">{u.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          label={u.googleConnected ? 'Google OAuth2' : 'Email / Password'}
                          tone={u.googleConnected ? 'pine' : 'neutral'}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          aria-label={`Ubah role ${u.email}`}
                          value={u.role}
                          onChange={(e) => handleAssignRole(u.id, e.target.value as RoleName)}
                          className="rounded-lg border border-alabaster-sand bg-alabaster px-2.5 py-1.5 text-xs font-semibold"
                        >
                          {ALL_ROLES.map((r) => (
                            <option key={r} value={r}>{ROLE_METADATA[r].label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          label={u.status.replace('_', ' ').toUpperCase()}
                          tone={u.status === 'active' ? 'success' : u.status === 'pending_approval' ? 'warning' : 'danger'}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {u.email !== user?.email && user && (
                          <button
                            type="button"
                            onClick={() => updateUserStatus(u.id, u.status === 'suspended' ? 'active' : 'suspended', user)}
                            className="rounded-lg border border-alabaster-sand px-2.5 py-1 text-[11px] font-semibold text-espresso-700 hover:border-terracotta-600 hover:text-terracotta-700"
                          >
                            {u.status === 'suspended' ? 'Aktifkan Kembali' : 'Tangguhkan'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'rbac' && (
        <div className="overflow-hidden rounded-2xl border border-alabaster-sand bg-white shadow-card">
          <div className="border-b border-alabaster-sand bg-alabaster px-5 py-3.5 text-xs">
            <h3 className="flex items-center gap-2 font-display text-sm font-bold text-espresso-900">
              <ShieldCheck className="h-4 w-4 text-pine-600" /> Matriks Kontrol Akses Berbasis Peran (Strict 8-Role RBAC)
            </h3>
            <p className="mt-0.5 text-espresso-500">
              Setiap rute diuji oleh <code className="font-mono">ProtectedRoute</code> di frontend dan middleware Sanctum RBAC di Laravel API.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-alabaster-sand bg-alabaster/70 text-[10px] uppercase text-espresso-500">
                <tr>
                  <th className="px-4 py-3">Modul Sistem</th>
                  {ALL_ROLES.map((r) => (
                    <th key={r} className="px-2.5 py-3 text-center">{ROLE_METADATA[r].shortLabel}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-alabaster-subtle">
                {RBAC_MATRIX_MODULES.map((mod) => (
                  <tr key={mod.key} className="hover:bg-alabaster/60">
                    <td className="px-4 py-2.5 font-semibold text-espresso-900">
                      {mod.label} <span className="font-mono text-[10px] text-espresso-400">({mod.route})</span>
                    </td>
                    {ALL_ROLES.map((r) => {
                      const allowed = canAccessRoute(r, mod.route);
                      return (
                        <td key={r} className="px-2.5 py-2.5 text-center">
                          {allowed ? (
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-pine-50 text-pine-700">
                              <Check className="h-3.5 w-3.5" />
                            </span>
                          ) : (
                            <span className="font-mono text-[10px] font-semibold text-semantic-danger/70">403</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="overflow-hidden rounded-2xl border border-alabaster-sand bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-alabaster-sand bg-alabaster text-[11px] uppercase text-espresso-500">
                <tr>
                  <th className="px-4 py-3">Waktu &amp; IP</th>
                  <th className="px-4 py-3">Aktor &amp; Role</th>
                  <th className="px-4 py-3">Event &amp; Severity</th>
                  <th className="px-4 py-3">Detail Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-alabaster-subtle">
                {activityLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-alabaster/60">
                    <td className="px-4 py-3 font-mono">
                      <p className="font-bold text-espresso-900">{log.timestamp}</p>
                      <p className="text-[10px] text-espresso-500">{log.ipAddress}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-espresso-900">{log.actorName}</p>
                      <p className="font-mono text-[10px] text-espresso-500">{log.actorRole} • {log.actorEmail}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={log.action}
                        tone={log.severity === 'critical' ? 'danger' : log.severity === 'warning' ? 'warning' : 'pine'}
                      />
                      <p className="mt-1 font-mono text-[10px] text-espresso-500">{log.module} → {log.target}</p>
                    </td>
                    <td className="px-4 py-3 text-espresso-700">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'company' && (
        <div className="mx-auto max-w-2xl rounded-2xl border border-alabaster-sand bg-white p-6 shadow-card">
          <h3 className="flex items-center gap-2 font-display text-base font-bold text-espresso-900">
            <Building2 className="h-4 w-4 text-pine-600" /> Profil Entitas Perusahaan
          </h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!user) return;
              updateCompany({ legalEntity: compName, npwp: compNpwp, address: compAddress }, user);
            }}
            className="mt-4 space-y-3.5 text-xs"
          >
            <div>
              <label className="mb-1 block font-semibold">Nama Badan Usaha</label>
              <input value={compName} onChange={(e) => setCompName(e.target.value)} className="w-full rounded-lg border border-alabaster-sand px-3 py-2" />
            </div>
            <div>
              <label className="mb-1 block font-semibold">NPWP Perusahaan</label>
              <input value={compNpwp} onChange={(e) => setCompNpwp(e.target.value)} className="w-full rounded-lg border border-alabaster-sand px-3 py-2 font-mono" />
            </div>
            <div>
              <label className="mb-1 block font-semibold">Alamat Operasional</label>
              <textarea rows={2} value={compAddress} onChange={(e) => setCompAddress(e.target.value)} className="w-full rounded-lg border border-alabaster-sand px-3 py-2" />
            </div>
            <button type="submit" className="rounded-xl bg-pine-600 px-5 py-2.5 font-bold text-alabaster hover:bg-pine-700">
              Simpan Profil Perusahaan
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

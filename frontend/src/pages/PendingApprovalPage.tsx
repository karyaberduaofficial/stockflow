import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, LogOut, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const PendingApprovalPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center sf-canvas-backdrop px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-alabaster-sand bg-white p-8 shadow-modal sf-animate-enter">
        <div className="flex items-center justify-between">
          <img src="/brand/stockflow-logo-full.svg" alt="StockFlow" className="h-9 w-auto" />
          <span className="inline-flex items-center gap-1 rounded-full border border-ochre-600/30 bg-ochre-50 px-3 py-1 font-mono text-[11px] font-bold text-ochre-700">
            <Clock className="h-3.5 w-3.5" />
            guest_pending
          </span>
        </div>

        <div className="mt-6 rounded-xl border border-ochre-600/25 bg-ochre-50/70 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-terracotta-600" />
            <div>
              <h1 className="font-display text-xl font-extrabold text-espresso-900">
                Akun Google Terverifikasi — Menunggu Otorisasi Admin
              </h1>
              <p className="mt-1.5 text-sm leading-relaxed text-espresso-700">
                Identitas Google Anda telah diverifikasi, namun demi mencegah akses tidak sah terhadap data inventaris,
                akuntansi, pajak, dan penggajian, akun baru secara otomatis dikarantina hingga Administrator menetapkan
                peran resmi.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-2.5 rounded-xl border border-alabaster-sand bg-alabaster p-4 text-xs">
          <div className="flex justify-between">
            <span className="text-espresso-500">Nama Akun</span>
            <span className="font-bold text-espresso-900">{user?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-espresso-500">Email Google</span>
            <span className="font-mono font-medium text-espresso-800">{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-espresso-500">Status Keamanan</span>
            <span className="inline-flex items-center gap-1 font-semibold text-semantic-warning">
              <CheckCircle2 className="h-3.5 w-3.5" /> Terkarantina (Akses Modul: 0/12)
            </span>
          </div>
        </div>

        <p className="mt-4 text-xs text-espresso-600">
          Hubungi Administrator Sistem (<span className="font-mono">admin@stockflow.local</span>) untuk menyetujui akun
          Anda di menu <strong>Pengaturan &amp; Keamanan → Manajemen Pengguna</strong>.
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-espresso-900 px-4 py-2.5 text-xs font-bold text-alabaster transition hover:bg-pine-600"
          >
            <LogOut className="h-4 w-4" />
            Keluar &amp; Kembali ke Halaman Login
          </button>
        </div>
      </div>
    </div>
  );
};

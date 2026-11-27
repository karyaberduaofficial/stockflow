import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Lock,
  Mail,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { ROLE_METADATA } from '../config/rbac';
import { RoleName } from '../types';
import { Modal } from '../components/common/UIPrimitives';
import { StockFlowApi } from '../services/api';

export const LoginPage: React.FC = () => {
  const { loginWithEmail, loginWithGoogleDemo, isDemoAuthEnabled, apiOnline, loading } = useAuth();
  const { users, addPendingUser, pushToast } = useStore();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [googleModalOpen, setGoogleModalOpen] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('guest.baru@example.com');
  const [googleName, setGoogleName] = useState('Andi Saputra');

  const routeAfterAuth = (role: RoleName) => {
    const dest = ROLE_METADATA[role]?.defaultRoute || '/dashboard';
    navigate(dest, { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const res = await loginWithEmail(email, password, users);
    if (!res.ok || !res.user) {
      setErrorMsg(res.error || 'Autentikasi gagal.');
      return;
    }
    pushToast('success', 'Berhasil Masuk', `Selamat datang di StockFlow v2.0, ${res.user.name}`);
    routeAfterAuth(res.user.role);
  };

  const handleGoogleButton = async () => {
    if (!isDemoAuthEnabled || (apiOnline && import.meta.env.VITE_GOOGLE_CLIENT_ID)) {
      const redirectUrl = await StockFlowApi.googleRedirectUrl();
      window.location.href = redirectUrl;
      return;
    }
    setGoogleModalOpen(true);
  };

  const handleGoogleSimulate = async (targetEmail: string, targetName: string) => {
    if (!isDemoAuthEnabled) {
      setErrorMsg('Mode simulasi Google OAuth dinonaktifkan di produksi.');
      setGoogleModalOpen(false);
      return;
    }
    const res = await loginWithGoogleDemo(targetEmail, targetName, users, addPendingUser);
    setGoogleModalOpen(false);
    if (!res.ok || !res.user) {
      setErrorMsg(res.error || 'Autentikasi Google ditolak.');
      return;
    }
    if (res.user.role === 'guest_pending') {
      pushToast(
        'warning',
        'Akun Google Menunggu Persetujuan',
        'Akun baru masuk ke antrean Pending di panel Administrator.'
      );
      navigate('/pending-approval', { replace: true });
    } else {
      pushToast('success', 'Login Google Terverifikasi', `Masuk sebagai ${res.user.name} (${ROLE_METADATA[res.user.role].shortLabel}).`);
      routeAfterAuth(res.user.role);
    }
  };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Left Brand Showcase Panel — Warm Espresso + Forest Pine + Terracotta Mesh (ZERO BLUE) */}
      <section className="relative flex flex-col justify-between overflow-hidden sf-login-mesh px-8 py-10 text-alabaster lg:w-[46%] lg:px-12 lg:py-14">
        <div>
          <img src="/brand/stockflow-logo-dark.svg" alt="StockFlow Logo" className="h-11 w-auto" />
          <div className="mt-10 max-w-md sf-animate-enter">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-alabaster/20 bg-alabaster/10 px-3 py-1 text-xs font-semibold text-alabaster">
              <Sparkles className="h-3.5 w-3.5 text-ochre-500" />
              Enterprise Homeware &amp; Furniture ERP v2.0
            </span>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              StockFlow
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-espresso-300">
              Platform manajemen bisnis terintegrasi untuk operasional toko furnitur dan perlengkapan rumah tangga.
              Menghubungkan pengelolaan persediaan multi-gudang, pembelian, penjualan, keuangan, akuntansi, perpajakan,
              hingga penggajian dalam satu sistem yang akurat dan transparan.
            </p>
          </div>
        </div>

        <p className="mt-8 text-[11px] text-espresso-400">
          © 2026 PT Karya Berdua Homeware &amp; Furniture
        </p>
      </section>

      {/* Right Auth Form Panel */}
      <section className="flex flex-1 flex-col justify-center sf-canvas-backdrop px-6 py-10 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-md sf-animate-enter">
          <div className="rounded-2xl border border-alabaster-sand bg-white p-6 shadow-card sm:p-8">
            <div className="mb-6">
              <h2 className="font-display text-2xl font-extrabold text-espresso-900">Masuk ke StockFlow</h2>
              <p className="mt-1 text-sm text-espresso-600">
                Gunakan kredensial perusahaan atau autentikasi Google OAuth2 terverifikasi.
              </p>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="mb-4 flex items-start gap-2.5 rounded-xl border border-semantic-danger/25 bg-semantic-dangerBg p-3 text-xs font-medium text-semantic-danger"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Google OAuth2 Button */}
            <button
              type="button"
              onClick={handleGoogleButton}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-alabaster-sand bg-alabaster px-4 py-3 text-sm font-semibold text-espresso-900 transition hover:border-pine-600 hover:bg-pine-50 active:scale-[0.99]"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#C2592B" d="M12 10.2v3.9h5.5c-.24 1.27-.96 2.35-2.04 3.07l3.3 2.56c1.92-1.77 3.03-4.38 3.03-7.48 0-.72-.07-1.41-.19-2.05H12z" />
                <path fill="#1B4332" d="M12 22c2.75 0 5.06-.91 6.75-2.47l-3.3-2.56c-.91.61-2.08.98-3.45.98-2.65 0-4.9-1.79-5.7-4.2H2.89v2.64A10 10 0 0012 22z" />
                <path fill="#B47B1B" d="M6.3 13.75A5.97 5.97 0 015.98 12c0-.61.11-1.2.32-1.75V7.61H2.89A10 10 0 002 12c0 1.61.39 3.14 1.07 4.49l3.23-2.74z" />
                <path fill="#7F1D4A" d="M12 5.95c1.5 0 2.84.52 3.9 1.53l2.92-2.92C17.05 2.9 14.74 2 12 2A10 10 0 002.89 7.61l3.41 2.64C7.1 7.74 9.35 5.95 12 5.95z" />
              </svg>
              <span>Masuk dengan Google</span>
            </button>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-alabaster-sand" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-espresso-400">
                atau email &amp; sandi
              </span>
              <div className="h-px flex-1 bg-alabaster-sand" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="sf-email" className="mb-1.5 block text-xs font-semibold text-espresso-700">
                  Alamat Email Perusahaan
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-espresso-400" />
                  <input
                    id="sf-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@perusahaan.co.id"
                    className="w-full rounded-xl border border-alabaster-sand bg-alabaster/60 py-2.5 pl-10 pr-3.5 text-sm text-espresso-900 placeholder:text-espresso-400 focus:border-pine-600 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="sf-password" className="mb-1.5 block text-xs font-semibold text-espresso-700">
                  Kata Sandi
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-espresso-400" />
                  <input
                    id="sf-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi Anda"
                    className="w-full rounded-xl border border-alabaster-sand bg-alabaster/60 py-2.5 pl-10 pr-3.5 text-sm text-espresso-900 placeholder:text-espresso-400 focus:border-pine-600 focus:bg-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-pine-600 px-4 py-3 text-sm font-bold text-alabaster shadow-sm transition hover:bg-pine-700 active:scale-[0.99] disabled:opacity-60"
              >
                <span>{loading ? 'Memverifikasi...' : 'Masuk ke Workspace'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <p className="mt-5 text-center text-xs text-espresso-600">
              Belum memiliki akun perusahaan?{' '}
              <Link to="/register" className="font-bold text-pine-700 hover:text-pine-800 hover:underline">
                Daftar sekarang
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Google OAuth2 Interactive Identity Verification Modal (Dev Only) */}
      {isDemoAuthEnabled && (
        <Modal
          open={googleModalOpen}
          onClose={() => setGoogleModalOpen(false)}
          title="Autentikasi Google OAuth2 — StockFlow"
          subtitle="Akun Google baru yang belum diprovisi otomatis masuk ke antrean Pending di panel Administrator."
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-espresso-700">1. Masuk dengan Akun Google Terdaftar:</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => handleGoogleSimulate('admin@stockflow.local', 'Raka Pratama')}
                  className="rounded-xl border border-alabaster-sand bg-alabaster p-3 text-left hover:border-pine-600 hover:bg-pine-50"
                >
                  <p className="text-xs font-bold text-espresso-900">Raka Pratama (Admin)</p>
                  <p className="font-mono text-[11px] text-espresso-500">admin@stockflow.local</p>
                </button>
                <button
                  type="button"
                  onClick={() => handleGoogleSimulate('finance@stockflow.local', 'Ratna Dewi')}
                  className="rounded-xl border border-alabaster-sand bg-alabaster p-3 text-left hover:border-pine-600 hover:bg-pine-50"
                >
                  <p className="text-xs font-bold text-espresso-900">Ratna Dewi (Finance)</p>
                  <p className="font-mono text-[11px] text-espresso-500">finance@stockflow.local</p>
                </button>
              </div>
            </div>

            <div className="border-t border-alabaster-sand pt-4">
              <p className="text-xs font-semibold text-espresso-700">
                2. Uji Masuk Akun Google Baru (Masuk Antrean Pending di Admin):
              </p>
              <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <input
                  type="text"
                  value={googleName}
                  onChange={(e) => setGoogleName(e.target.value)}
                  placeholder="Nama Lengkap"
                  className="rounded-lg border border-alabaster-sand px-3 py-2 text-xs"
                />
                <input
                  type="email"
                  value={googleEmail}
                  onChange={(e) => setGoogleEmail(e.target.value)}
                  placeholder="demo.google@example.com"
                  className="rounded-lg border border-alabaster-sand px-3 py-2 text-xs"
                />
              </div>
              <button
                type="button"
                onClick={() => handleGoogleSimulate(googleEmail, googleName)}
                className="mt-3 w-full rounded-xl bg-terracotta-600 py-2.5 text-xs font-bold text-alabaster hover:bg-terracotta-700"
              >
                Lanjutkan dengan Akun Google Baru
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

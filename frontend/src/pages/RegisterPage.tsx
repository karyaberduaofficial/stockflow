import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { OFFICIAL_ROLES, ROLE_METADATA } from '../config/rbac';
import { RoleName } from '../types';

export const RegisterPage: React.FC = () => {
  const { registerWithCompanyEmail, loading } = useAuth();
  const { users, addRegisteredUser, pushToast } = useStore();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<RoleName>('warehouse');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (username.trim().length < 3) {
      setErrorMsg('Username minimal 3 karakter.');
      return;
    }
    if (!email.includes('@') || !email.includes('.')) {
      setErrorMsg('Masukkan alamat email perusahaan yang valid.');
      return;
    }
    if (password.length < 8) {
      setErrorMsg('Password minimal 8 karakter.');
      return;
    }
    if (password !== passwordConfirmation) {
      setErrorMsg('Konfirmasi password tidak cocok dengan password.');
      return;
    }

    const res = await registerWithCompanyEmail(
      {
        username: username.trim(),
        email: email.trim().toLowerCase(),
        role,
        password,
        passwordConfirmation,
      },
      users,
      addRegisteredUser
    );

    if (!res.ok || !res.user) {
      setErrorMsg(res.error || 'Pendaftaran akun gagal.');
      return;
    }

    pushToast(
      'success',
      'Akun Berhasil Terdaftar',
      `Selamat datang ${res.user.name} (${ROLE_METADATA[res.user.role].label}).`
    );
    navigate(ROLE_METADATA[res.user.role]?.defaultRoute || '/dashboard', { replace: true });
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

      {/* Right Register Form Panel */}
      <section className="flex flex-1 flex-col justify-center sf-canvas-backdrop px-6 py-10 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-md sf-animate-enter">
          <div className="rounded-2xl border border-alabaster-sand bg-white p-6 shadow-card sm:p-8">
            <div className="mb-6">
              <h2 className="font-display text-2xl font-extrabold text-espresso-900">Daftar Akun StockFlow</h2>
              <p className="mt-1 text-sm text-espresso-600">
                Gunakan email perusahaan Anda dan pilih peran sesuai tanggung jawab kerja.
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

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 1. Username */}
              <div>
                <label htmlFor="sf-reg-username" className="mb-1.5 block text-xs font-semibold text-espresso-700">
                  Username
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-espresso-400" />
                  <input
                    id="sf-reg-username"
                    type="text"
                    required
                    minLength={3}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="contoh: budi.santoso"
                    className="w-full rounded-xl border border-alabaster-sand bg-alabaster/60 py-2.5 pl-10 pr-3.5 text-sm text-espresso-900 placeholder:text-espresso-400 focus:border-pine-600 focus:bg-white"
                  />
                </div>
              </div>

              {/* 2. Email Perusahaan */}
              <div>
                <label htmlFor="sf-reg-email" className="mb-1.5 block text-xs font-semibold text-espresso-700">
                  Email Perusahaan
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-espresso-400" />
                  <input
                    id="sf-reg-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@perusahaan.co.id"
                    className="w-full rounded-xl border border-alabaster-sand bg-alabaster/60 py-2.5 pl-10 pr-3.5 text-sm text-espresso-900 placeholder:text-espresso-400 focus:border-pine-600 focus:bg-white"
                  />
                </div>
              </div>

              {/* 3. Pilihan Role */}
              <div>
                <label htmlFor="sf-reg-role" className="mb-1.5 block text-xs font-semibold text-espresso-700">
                  Pilihan Role
                </label>
                <div className="relative">
                  <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pine-600" />
                  <select
                    id="sf-reg-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as RoleName)}
                    className="w-full rounded-xl border border-alabaster-sand bg-alabaster/60 py-2.5 pl-10 pr-3.5 text-sm font-medium text-espresso-900 focus:border-pine-600 focus:bg-white"
                  >
                    {OFFICIAL_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_METADATA[r].shortLabel === ROLE_METADATA[r].label
                          ? ROLE_METADATA[r].label
                          : `${ROLE_METADATA[r].shortLabel} — ${ROLE_METADATA[r].label}`}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="mt-1 text-[11px] text-espresso-500">
                  {ROLE_METADATA[role]?.description}
                </p>
              </div>

              {/* 4. Password */}
              <div>
                <label htmlFor="sf-reg-password" className="mb-1.5 block text-xs font-semibold text-espresso-700">
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-espresso-400" />
                  <input
                    id="sf-reg-password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 8 karakter"
                    className="w-full rounded-xl border border-alabaster-sand bg-alabaster/60 py-2.5 pl-10 pr-3.5 text-sm text-espresso-900 placeholder:text-espresso-400 focus:border-pine-600 focus:bg-white"
                  />
                </div>
              </div>

              {/* 5. Konfirmasi Password */}
              <div>
                <label htmlFor="sf-reg-confirm" className="mb-1.5 block text-xs font-semibold text-espresso-700">
                  Konfirmasi Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-espresso-400" />
                  <input
                    id="sf-reg-confirm"
                    type="password"
                    required
                    minLength={8}
                    value={passwordConfirmation}
                    onChange={(e) => setPasswordConfirmation(e.target.value)}
                    placeholder="Ulangi password Anda"
                    className="w-full rounded-xl border border-alabaster-sand bg-alabaster/60 py-2.5 pl-10 pr-3.5 text-sm text-espresso-900 placeholder:text-espresso-400 focus:border-pine-600 focus:bg-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-pine-600 px-4 py-3 text-sm font-bold text-alabaster shadow-sm transition hover:bg-pine-700 active:scale-[0.99] disabled:opacity-60"
              >
                <span>{loading ? 'Mendaftarkan Akun...' : 'Daftar & Masuk Workspace'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <p className="mt-5 text-center text-xs text-espresso-600">
              Sudah memiliki akun perusahaan?{' '}
              <Link to="/login" className="font-bold text-pine-700 hover:text-pine-800 hover:underline">
                Masuk di sini
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

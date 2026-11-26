import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldOff, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROLE_METADATA } from '../config/rbac';
import { RoleName } from '../types';

export const ForbiddenPage: React.FC<{
  attemptedPath: string;
  requiredRoles: RoleName[];
}> = ({ attemptedPath, requiredRoles }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const currentRoleLabel = user ? ROLE_METADATA[user.role]?.label : 'Unknown';
  const fallbackRoute = user ? ROLE_METADATA[user.role]?.defaultRoute || '/dashboard' : '/login';

  return (
    <div className="mx-auto max-w-2xl py-10 sf-animate-enter">
      <div className="rounded-2xl border border-semantic-danger/25 bg-white p-8 shadow-card">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-semantic-dangerBg text-semantic-danger border border-semantic-danger/20">
            <ShieldOff className="h-7 w-7" />
          </div>
          <div>
            <span className="inline-flex items-center gap-1 rounded-full bg-semantic-dangerBg px-2.5 py-0.5 font-mono text-xs font-bold text-semantic-danger">
              HTTP 403 FORBIDDEN
            </span>
            <h1 className="mt-1 font-display text-2xl font-extrabold text-espresso-900">
              403 — Akses Ditolak (Otorisasi Tidak Mencukupi)
            </h1>
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-espresso-700">
          Peran aktif Anda (<strong className="text-espresso-900">{currentRoleLabel}</strong>) tidak diizinkan membuka
          halaman <code className="rounded bg-alabaster-subtle px-1.5 py-0.5 font-mono text-xs">{attemptedPath}</code>.
          Percobaan akses ini telah dicatat secara otomatis ke dalam <strong>Security &amp; Activity Audit Log</strong>.
        </p>

        <div className="mt-5 rounded-xl border border-alabaster-sand bg-alabaster p-4 text-xs">
          <p className="flex items-center gap-1.5 font-bold text-espresso-800">
            <Lock className="h-3.5 w-3.5 text-terracotta-600" />
            Peran yang Diizinkan untuk Modul Ini:
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {requiredRoles.map((r) => (
              <span
                key={r}
                className="rounded-md border border-pine-200 bg-pine-50 px-2.5 py-1 font-mono text-[11px] font-semibold text-pine-700"
              >
                {ROLE_METADATA[r]?.label || r}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => navigate(fallbackRoute)}
            className="inline-flex items-center gap-2 rounded-xl bg-pine-600 px-4 py-2.5 text-xs font-bold text-alabaster hover:bg-pine-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Ruang Kerja Saya
          </button>
        </div>
      </div>
    </div>
  );
};

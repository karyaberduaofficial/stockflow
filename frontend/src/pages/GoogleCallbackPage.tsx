import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, ShieldOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROLE_METADATA } from '../config/rbac';

export const GoogleCallbackPage: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { verifyBearerToken } = useAuth();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      // Never trust unauthenticated query parameters (?email=...) — always require a verified backend Bearer token!
      navigate('/login', { replace: true });
      return;
    }

    verifyBearerToken(token).then((res) => {
      if (!res.ok || !res.user) {
        setErrorMsg(res.error || 'Verifikasi token Google gagal.');
        setTimeout(() => navigate('/login', { replace: true }), 1800);
        return;
      }
      const dest = ROLE_METADATA[res.user.role]?.defaultRoute || '/pending-approval';
      navigate(dest, { replace: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center sf-canvas-backdrop p-6">
      <div className="rounded-2xl border border-alabaster-sand bg-white p-8 text-center shadow-card">
        {errorMsg ? (
          <>
            <ShieldOff className="mx-auto h-8 w-8 text-semantic-danger" />
            <h1 className="mt-4 font-display text-lg font-bold text-espresso-900">Verifikasi OAuth2 Ditolak</h1>
            <p className="mt-1 text-xs text-semantic-danger">{errorMsg}</p>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-pine-600" />
            <h1 className="mt-4 font-display text-lg font-bold text-espresso-900">Memverifikasi Token Google OAuth2...</h1>
            <p className="mt-1 text-xs text-espresso-600">Memeriksa identitas &amp; status otorisasi peran RBAC melalui server.</p>
          </>
        )}
      </div>
    </div>
  );
};

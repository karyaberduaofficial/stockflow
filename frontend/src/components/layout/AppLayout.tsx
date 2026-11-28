import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Barcode,
  BookOpen,
  Camera,
  Database,
  FileSpreadsheet,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  ShoppingCart,
  Store,
  Users,
  Wallet,
  Warehouse,
  X,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { NAV_ITEMS, ROLE_METADATA } from '../../config/rbac';
import { BarcodeScannerModal, ToastContainer } from '../common/UIPrimitives';
import { getTotalProductStock } from '../../utils/format';

const ICON_MAP = {
  LayoutDashboard,
  Database,
  Warehouse,
  ShoppingCart,
  Store,
  Wallet,
  BookOpen,
  Landmark,
  Camera,
  Users,
  FileSpreadsheet,
  ShieldCheck,
};

export const AppLayout: React.FC = () => {
  const { user, logout, apiOnline } = useAuth();
  const { products, users } = useStore();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [quickJump, setQuickJump] = useState('');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const el = document.getElementById('sf-global-search');
        el?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!user) return null;

  const roleMeta = ROLE_METADATA[user.role];
  const visibleNav = NAV_ITEMS.filter((item) => item.allowedRoles.includes(user.role));
  const groups = ['Operasional', 'Keuangan & Akuntansi', 'SDM & Analitik', 'Administrasi'] as const;

  const lowStockCount = products.filter((p) => getTotalProductStock(p.stockByWarehouse) <= p.minStock).length;
  const pendingUsersCount = users.filter((u) => u.role === 'guest_pending' || u.status === 'pending_approval').length;

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const renderNavLinks = (onClickItem?: () => void) => (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Navigasi Utama StockFlow">
      {groups.map((group) => {
        const items = visibleNav.filter((i) => i.group === group);
        if (items.length === 0) return null;
        return (
          <div key={group}>
            <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-espresso-400">
              {group}
            </p>
            <div className="space-y-0.5">
              {items.map((item) => {
                const Icon = ICON_MAP[item.iconName];
                const badgeCount =
                  item.path === '/inventory' && lowStockCount > 0
                    ? lowStockCount
                    : item.path === '/settings' && pendingUsersCount > 0
                    ? pendingUsersCount
                    : 0;

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={onClickItem}
                    className={({ isActive }) =>
                      `group flex items-center justify-between gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all ${
                        isActive
                          ? 'bg-pine-600 text-alabaster shadow-sm'
                          : 'text-espresso-300 hover:bg-espresso-800 hover:text-alabaster'
                      }`
                    }
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      <Icon className="h-4 w-4 shrink-0 opacity-90" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {badgeCount > 0 && (
                      <span className="rounded-full bg-terracotta-600 px-1.5 py-0.5 font-mono text-[10px] font-bold text-alabaster">
                        {badgeCount}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen sf-canvas-backdrop">
      {/* Desktop Espresso Charcoal Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-espresso-700 bg-espresso-900 text-alabaster lg:flex no-print">
        <div className="flex h-16 items-center gap-2.5 border-b border-espresso-700 px-4">
          <img
            src="/brand/stockflow-logo-dark.svg"
            alt="StockFlow Logo"
            className="h-9 w-auto"
          />
        </div>

        {renderNavLinks()}

        {/* Active User & Role Identity Footer */}
        <div className="border-t border-espresso-700 bg-espresso-950/60 p-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-pine-600 font-display text-xs font-bold text-alabaster">
              {user.avatarInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-alabaster">{user.name}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1">
                <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold ${roleMeta.badgeClass}`}>
                  {roleMeta.shortLabel}
                </span>
                {user.googleConnected && (
                  <span className="inline-flex items-center gap-0.5 rounded bg-espresso-800 px-1.5 py-0.5 text-[10px] font-medium text-alabaster/90 border border-espresso-700">
                    <CheckCircle2 className="h-2.5 w-2.5 text-olive-600" />
                    Google
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-espresso-700 bg-espresso-800 px-3 py-2 text-xs font-semibold text-espresso-200 transition hover:border-terracotta-600 hover:bg-terracotta-600 hover:text-alabaster"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Keluar Sesi</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden no-print">
          <div className="fixed inset-0 bg-espresso-950/70 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative z-10 flex w-72 max-w-[85vw] flex-col bg-espresso-900 text-alabaster shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-espresso-700 px-4">
              <img src="/brand/stockflow-logo-dark.svg" alt="StockFlow Logo" className="h-8 w-auto" />
              <button
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Tutup menu"
                className="rounded-lg p-1.5 text-espresso-300 hover:bg-espresso-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {renderNavLinks(() => setMobileMenuOpen(false))}
            <div className="border-t border-espresso-700 p-3.5">
              <p className="text-xs font-bold">{user.name}</p>
              <p className="text-[11px] text-espresso-400">{roleMeta.label}</p>
              <button
                onClick={handleLogout}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-terracotta-600 py-2 text-xs font-semibold text-alabaster"
              >
                <LogOut className="h-3.5 w-3.5" /> Keluar Sesi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Workspace */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Sticky Glass Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-alabaster-sand sf-glass-header px-4 sm:px-6 no-print">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Buka navigasi"
              className="rounded-lg border border-alabaster-sand bg-white p-2 text-espresso-700 hover:bg-alabaster-subtle lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="relative hidden max-w-md flex-1 sm:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-espresso-400" />
              <input
                id="sf-global-search"
                type="text"
                value={quickJump}
                onChange={(e) => setQuickJump(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && quickJump.trim()) {
                    const q = quickJump.trim().toLowerCase();
                    const foundNav = visibleNav.find((n) => n.label.toLowerCase().includes(q));
                    if (foundNav) {
                      navigate(foundNav.path);
                      setQuickJump('');
                    } else {
                      setScannerOpen(true);
                    }
                  }
                }}
                placeholder="Cari modul, SKU, atau tekan Ctrl+K..."
                className="w-full rounded-lg border border-alabaster-sand bg-white/90 py-2 pl-9 pr-14 text-xs text-espresso-900 placeholder:text-espresso-400 focus:border-pine-600"
              />
              <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-alabaster-sand bg-alabaster px-1.5 py-0.5 font-mono text-[10px] text-espresso-500">
                Ctrl+K
              </kbd>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-pine-600/30 bg-pine-50 px-3 py-1.5 text-xs font-semibold text-pine-700 transition hover:bg-pine-600 hover:text-alabaster"
            >
              <Barcode className="h-4 w-4" />
              <span className="hidden sm:inline">Scan Barcode</span>
            </button>

            <span
              className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold md:inline-flex ${
                apiOnline
                  ? 'border-semantic-success/25 bg-semantic-successBg text-semantic-success'
                  : 'border-ochre-600/25 bg-ochre-50 text-ochre-700'
              }`}
              title={apiOnline ? 'Terhubung langsung ke Laravel API' : 'Mode Interaktif Lokal (Sinkronisasi API Otomatis)'}
            >
              <span
                className={`h-2 w-2 rounded-full ${apiOnline ? 'bg-semantic-success' : 'bg-ochre-600'}`}
              />
              {apiOnline ? 'Laravel API Live' : 'Interactive Mode'}
            </span>

            {lowStockCount > 0 && (
              <button
                type="button"
                onClick={() => navigate('/inventory')}
                className="inline-flex items-center gap-1 rounded-lg border border-terracotta-600/30 bg-terracotta-50 px-2.5 py-1.5 text-xs font-semibold text-terracotta-700 hover:bg-terracotta-100"
                title="Produk di bawah batas stok minimum"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span className="font-mono">{lowStockCount}</span>
                <span className="hidden md:inline">Stok Rendah</span>
              </button>
            )}
          </div>
        </header>

        {/* Page Container */}
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      <BarcodeScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} />
      <ToastContainer />
    </div>
  );
};

import { RoleName } from '../types';

export interface RoleMetadata {
  role: RoleName;
  label: string;
  shortLabel: string;
  description: string;
  badgeClass: string;
  defaultRoute: string;
  allowedRoutes: string[];
  permissions: string[];
}

export const ROLE_METADATA: Record<RoleName, RoleMetadata> = {
  admin: {
    role: 'admin',
    label: 'Administrator',
    shortLabel: 'Admin',
    description: 'Full system governance, user approvals, RBAC matrix, tax config, and security audit logs.',
    badgeClass: 'bg-pine-600 text-alabaster',
    defaultRoute: '/dashboard',
    allowedRoutes: [
      '/dashboard',
      '/master-data',
      '/inventory',
      '/procurement',
      '/sales',
      '/finance',
      '/accounting',
      '/tax',
      '/attendance',
      '/hr-payroll',
      '/reports',
      '/settings',
    ],
    permissions: ['*'],
  },
  manager: {
    role: 'manager',
    label: 'Manager / Owner',
    shortLabel: 'Manager',
    description: 'Executive visibility across operations, financial statements, tax, payroll approvals, and exports.',
    badgeClass: 'bg-terracotta-600 text-alabaster',
    defaultRoute: '/dashboard',
    allowedRoutes: [
      '/dashboard',
      '/master-data',
      '/inventory',
      '/procurement',
      '/sales',
      '/finance',
      '/accounting',
      '/tax',
      '/attendance',
      '/hr-payroll',
      '/reports',
    ],
    permissions: [
      'dashboard.view',
      'master.read',
      'inventory.read',
      'inventory.approve',
      'procurement.read',
      'procurement.approve',
      'sales.read',
      'finance.read',
      'accounting.read',
      'tax.read',
      'hr.read',
      'payroll.approve',
      'reports.export',
    ],
  },
  warehouse: {
    role: 'warehouse',
    label: 'Warehouse Staff',
    shortLabel: 'Warehouse',
    description: 'Inventory control, stock in/out, stock opname, adjustment requests, inter-warehouse transfers, barcode scanning.',
    badgeClass: 'bg-olive-600 text-alabaster',
    defaultRoute: '/inventory',
    allowedRoutes: ['/dashboard', '/master-data', '/inventory', '/attendance', '/reports'],
    permissions: [
      'dashboard.view',
      'master.products.read',
      'inventory.read',
      'inventory.write',
      'inventory.transfer',
      'reports.inventory',
    ],
  },
  purchasing: {
    role: 'purchasing',
    label: 'Purchasing Staff',
    shortLabel: 'Purchasing',
    description: 'Supplier sourcing, Purchase Order lifecycle, Goods Receiving, and supplier scorecard evaluation.',
    badgeClass: 'bg-ochre-600 text-alabaster',
    defaultRoute: '/procurement',
    allowedRoutes: ['/dashboard', '/master-data', '/inventory', '/procurement', '/attendance', '/reports'],
    permissions: [
      'dashboard.view',
      'master.suppliers.write',
      'inventory.read',
      'procurement.read',
      'procurement.write',
      'reports.procurement',
    ],
  },
  sales: {
    role: 'sales',
    label: 'Sales & POS Cashier',
    shortLabel: 'Sales / POS',
    description: 'Retail showroom POS cashier, barcode checkout, customer orders, invoices, and sales returns.',
    badgeClass: 'bg-burgundy-600 text-alabaster',
    defaultRoute: '/sales',
    allowedRoutes: ['/dashboard', '/master-data', '/inventory', '/sales', '/attendance', '/reports'],
    permissions: [
      'dashboard.view',
      'master.customers.write',
      'inventory.read',
      'sales.read',
      'sales.write',
      'reports.sales',
    ],
  },
  finance: {
    role: 'finance',
    label: 'Finance & Accounting',
    shortLabel: 'Finance',
    description: 'Cash/bank ledger, AR/AP, double-entry journals, financial statements, tax filings, and payroll disbursement.',
    badgeClass: 'bg-pine-700 text-alabaster',
    defaultRoute: '/finance',
    allowedRoutes: [
      '/dashboard',
      '/procurement',
      '/sales',
      '/finance',
      '/accounting',
      '/tax',
      '/attendance',
      '/hr-payroll',
      '/reports',
    ],
    permissions: [
      'dashboard.view',
      'finance.read',
      'finance.write',
      'accounting.read',
      'accounting.write',
      'accounting.close',
      'tax.read',
      'tax.write',
      'payroll.disburse',
      'reports.export',
    ],
  },
  hr_payroll: {
    role: 'hr_payroll',
    label: 'HR',
    shortLabel: 'HR',
    description: 'Employee directory, attendance & leave, BPJS splits, PPh 21 TER payroll calculation, and payslips.',
    badgeClass: 'bg-espresso-700 text-alabaster',
    defaultRoute: '/hr-payroll',
    allowedRoutes: ['/dashboard', '/master-data', '/attendance', '/hr-payroll', '/tax', '/reports'],
    permissions: [
      'dashboard.view',
      'master.employees.write',
      'hr.read',
      'hr.write',
      'hr.pii.unmasked',
      'payroll.calculate',
      'tax.pph21.read',
      'reports.payroll',
    ],
  },
  guest_pending: {
    role: 'guest_pending',
    label: 'Pending (Admin Queue)',
    shortLabel: 'Pending',
    description: 'Akun menunggu persetujuan yang dikelola di dalam panel Administrator.',
    badgeClass: 'bg-ochre-100 text-ochre-700 border border-ochre-600/30',
    defaultRoute: '/pending-approval',
    allowedRoutes: ['/pending-approval'],
    permissions: [],
  },
};

export const OFFICIAL_ROLES: RoleName[] = [
  'admin',
  'manager',
  'warehouse',
  'purchasing',
  'sales',
  'finance',
  'hr_payroll',
];

export interface NavItemConfig {
  path: string;
  label: string;
  group: 'Operasional' | 'Keuangan & Akuntansi' | 'SDM & Analitik' | 'Administrasi';
  iconName:
    | 'LayoutDashboard'
    | 'Database'
    | 'Warehouse'
    | 'ShoppingCart'
    | 'Store'
    | 'Wallet'
    | 'BookOpen'
    | 'Landmark'
    | 'Camera'
    | 'Users'
    | 'FileSpreadsheet'
    | 'ShieldCheck';
  allowedRoles: RoleName[];
}

export const NAV_ITEMS: NavItemConfig[] = [
  {
    path: '/dashboard',
    label: 'Dashboard Eksekutif',
    group: 'Operasional',
    iconName: 'LayoutDashboard',
    allowedRoles: ['admin', 'manager', 'warehouse', 'purchasing', 'sales', 'finance', 'hr_payroll'],
  },
  {
    path: '/master-data',
    label: 'Master Data',
    group: 'Operasional',
    iconName: 'Database',
    allowedRoles: ['admin', 'manager', 'warehouse', 'purchasing', 'sales', 'hr_payroll'],
  },
  {
    path: '/inventory',
    label: 'Inventaris & Gudang',
    group: 'Operasional',
    iconName: 'Warehouse',
    allowedRoles: ['admin', 'manager', 'warehouse', 'purchasing', 'sales'],
  },
  {
    path: '/procurement',
    label: 'Pengadaan (PO)',
    group: 'Operasional',
    iconName: 'ShoppingCart',
    allowedRoles: ['admin', 'manager', 'purchasing', 'finance'],
  },
  {
    path: '/sales',
    label: 'Penjualan & POS',
    group: 'Operasional',
    iconName: 'Store',
    allowedRoles: ['admin', 'manager', 'sales', 'finance'],
  },
  {
    path: '/finance',
    label: 'Keuangan & Kas',
    group: 'Keuangan & Akuntansi',
    iconName: 'Wallet',
    allowedRoles: ['admin', 'manager', 'finance'],
  },
  {
    path: '/accounting',
    label: 'Akuntansi Double-Entry',
    group: 'Keuangan & Akuntansi',
    iconName: 'BookOpen',
    allowedRoles: ['admin', 'manager', 'finance'],
  },
  {
    path: '/tax',
    label: 'Manajemen Pajak',
    group: 'Keuangan & Akuntansi',
    iconName: 'Landmark',
    allowedRoles: ['admin', 'manager', 'finance', 'hr_payroll'],
  },
  {
    path: '/attendance',
    label: 'Absensi & Kehadiran',
    group: 'SDM & Analitik',
    iconName: 'Camera',
    allowedRoles: ['admin', 'manager', 'warehouse', 'purchasing', 'sales', 'finance', 'hr_payroll'],
  },
  {
    path: '/hr-payroll',
    label: 'HR',
    group: 'SDM & Analitik',
    iconName: 'Users',
    allowedRoles: ['admin', 'manager', 'finance', 'hr_payroll'],
  },
  {
    path: '/reports',
    label: 'Laporan & Ekspor',
    group: 'SDM & Analitik',
    iconName: 'FileSpreadsheet',
    allowedRoles: ['admin', 'manager', 'warehouse', 'purchasing', 'sales', 'finance', 'hr_payroll'],
  },
  {
    path: '/settings',
    label: 'Pengaturan & Keamanan',
    group: 'Administrasi',
    iconName: 'ShieldCheck',
    allowedRoles: ['admin'],
  },
];

export function canAccessRoute(role: RoleName, pathname: string): boolean {
  if (role === 'guest_pending') {
    return pathname === '/pending-approval';
  }
  const meta = ROLE_METADATA[role];
  if (!meta) return false;
  return meta.allowedRoutes.some((allowed) => pathname === allowed || pathname.startsWith(`${allowed}/`));
}

export function hasPermission(role: RoleName, permission: string): boolean {
  const meta = ROLE_METADATA[role];
  if (!meta) return false;
  if (meta.permissions.includes('*')) return true;
  return meta.permissions.includes(permission);
}

export const RBAC_MATRIX_MODULES = [
  { key: 'dashboard', label: 'Dashboard Eksekutif', route: '/dashboard' },
  { key: 'master', label: 'Master Data', route: '/master-data' },
  { key: 'inventory', label: 'Inventaris & Gudang', route: '/inventory' },
  { key: 'procurement', label: 'Pengadaan & PO', route: '/procurement' },
  { key: 'sales', label: 'Penjualan & POS', route: '/sales' },
  { key: 'finance', label: 'Keuangan & Kas/Bank', route: '/finance' },
  { key: 'accounting', label: 'Akuntansi Double-Entry', route: '/accounting' },
  { key: 'tax', label: 'Manajemen Pajak', route: '/tax' },
  { key: 'attendance', label: 'Absensi & Geo-Foto', route: '/attendance' },
  { key: 'hr', label: 'HR', route: '/hr-payroll' },
  { key: 'reports', label: 'Laporan & Ekspor', route: '/reports' },
  { key: 'settings', label: 'Pengaturan, User & Audit', route: '/settings' },
];

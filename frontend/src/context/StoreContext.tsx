import React, { createContext, useContext, useState } from 'react';
import {
  INITIAL_ACTIVITY_LOGS,
  INITIAL_ADJUSTMENTS,
  INITIAL_BRANDS,
  INITIAL_CASH_LEDGER,
  INITIAL_CATEGORIES,
  INITIAL_COA,
  INITIAL_COMPANY,
  INITIAL_CUSTOMERS,
  INITIAL_EMPLOYEES,
  INITIAL_FINANCIAL_ACCOUNTS,
  INITIAL_JOURNALS,
  INITIAL_PAYROLLS,
  INITIAL_PERIODS,
  INITIAL_PRODUCTS,
  INITIAL_PURCHASE_ORDERS,
  INITIAL_SALES,
  INITIAL_STOCK_MOVEMENTS,
  INITIAL_SUPPLIERS,
  INITIAL_TAX_CONFIGS,
  INITIAL_TAX_TRANSACTIONS,
  INITIAL_TRANSFERS,
  INITIAL_UNITS,
  INITIAL_USERS,
  INITIAL_WAREHOUSES,
} from '../data/mockData';
import {
  AccountCOA,
  AccountingPeriod,
  ActivityLog,
  Brand,
  CashLedgerEntry,
  Category,
  CompanyProfile,
  Customer,
  Employee,
  FinancialAccount,
  JournalEntry,
  JournalLine,
  PayrollRecord,
  PayrollStatus,
  POStatus,
  Product,
  PurchaseOrder,
  RoleName,
  SaleItem,
  SaleTransaction,
  StockAdjustment,
  StockMovement,
  Supplier,
  TaxConfig,
  TaxTransaction,
  ToastMessage,
  Unit,
  UserAccount,
  Warehouse,
  WarehouseTransfer,
} from '../types';
import { StockFlowApi } from '../services/api';

interface StoreContextValue {
  company: CompanyProfile;
  users: UserAccount[];
  categories: Category[];
  brands: Brand[];
  units: Unit[];
  warehouses: Warehouse[];
  suppliers: Supplier[];
  customers: Customer[];
  products: Product[];
  stockMovements: StockMovement[];
  adjustments: StockAdjustment[];
  transfers: WarehouseTransfer[];
  purchaseOrders: PurchaseOrder[];
  sales: SaleTransaction[];
  financialAccounts: FinancialAccount[];
  cashLedger: CashLedgerEntry[];
  coa: AccountCOA[];
  journals: JournalEntry[];
  periods: AccountingPeriod[];
  taxConfigs: TaxConfig[];
  taxTransactions: TaxTransaction[];
  employees: Employee[];
  payrolls: PayrollRecord[];
  activityLogs: ActivityLog[];
  toasts: ToastMessage[];
  pushToast: (type: ToastMessage['type'], title: string, message?: string) => void;
  dismissToast: (id: string) => void;
  logActivity: (entry: Omit<ActivityLog, 'id' | 'timestamp' | 'ipAddress'>) => void;
  logForbiddenAttempt: (actor: UserAccount, route: string, requiredRoles: RoleName[]) => void;

  // Domain actions
  addPendingUser: (u: UserAccount) => void;
  approveAndAssignUserRole: (userId: number, role: RoleName, actor: UserAccount) => void;
  updateUserStatus: (userId: number, status: UserAccount['status'], actor: UserAccount) => void;
  updateCompany: (patch: Partial<CompanyProfile>, actor: UserAccount) => void;

  addProduct: (p: Omit<Product, 'id'>, actor: UserAccount) => void;
  recordStockMovement: (
    payload: { productId: number; warehouseId: number; type: 'stock_in' | 'stock_out'; qty: number; unitCost: number; notes: string },
    actor: UserAccount
  ) => { ok: boolean; error?: string };
  requestAdjustment: (
    payload: { productId: number; warehouseId: number; actualQty: number; reason: string },
    actor: UserAccount
  ) => void;
  decideAdjustment: (adjustmentId: number, decision: 'approved' | 'rejected', actor: UserAccount) => void;
  createTransfer: (
    payload: { productId: number; fromWarehouseId: number; toWarehouseId: number; qty: number; notes: string },
    actor: UserAccount
  ) => { ok: boolean; error?: string };
  confirmTransferReceipt: (transferId: number, actor: UserAccount) => void;

  createPurchaseOrder: (
    payload: { supplierId: number; warehouseId: number; productId: number; qty: number; unitPrice: number },
    actor: UserAccount
  ) => void;
  advancePOStatus: (poId: number, nextStatus: POStatus, actor: UserAccount) => void;
  paySupplierInvoice: (poId: number, actor: UserAccount) => void;

  completePosSale: (
    payload: {
      customerId: number;
      warehouseId: number;
      paymentMethod: SaleTransaction['paymentMethod'];
      items: SaleItem[];
    },
    actor: UserAccount
  ) => { ok: boolean; error?: string; sale?: SaleTransaction };
  processSaleReturn: (saleId: number, actor: UserAccount) => void;

  recordCashEntry: (
    payload: {
      accountId: number;
      category: CashLedgerEntry['category'];
      direction: 'in' | 'out';
      amount: number;
      description: string;
    },
    actor: UserAccount
  ) => void;
  transferBetweenAccounts: (
    payload: { fromAccountId: number; toAccountId: number; amount: number; description: string },
    actor: UserAccount
  ) => { ok: boolean; error?: string };

  postManualJournal: (
    payload: { date: string; description: string; lines: JournalLine[] },
    actor: UserAccount
  ) => { ok: boolean; error?: string };
  reverseJournal: (journalId: number, actor: UserAccount) => { ok: boolean; error?: string };
  togglePeriodStatus: (periodCode: string, actor: UserAccount) => void;

  togglePpnElevenTwelfths: (enabled: boolean, actor: UserAccount) => void;
  markTaxPaid: (taxTxId: number, actor: UserAccount) => void;

  advancePayrollStatus: (payrollId: number, nextStatus: PayrollStatus, actor: UserAccount) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [company, setCompany] = useState<CompanyProfile>(INITIAL_COMPANY);
  const [users, setUsers] = useState<UserAccount[]>(INITIAL_USERS);
  const [categories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [brands] = useState<Brand[]>(INITIAL_BRANDS);
  const [units] = useState<Unit[]>(INITIAL_UNITS);
  const [warehouses] = useState<Warehouse[]>(INITIAL_WAREHOUSES);
  const [suppliers] = useState<Supplier[]>(INITIAL_SUPPLIERS);
  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS);
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>(INITIAL_STOCK_MOVEMENTS);
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>(INITIAL_ADJUSTMENTS);
  const [transfers, setTransfers] = useState<WarehouseTransfer[]>(INITIAL_TRANSFERS);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(INITIAL_PURCHASE_ORDERS);
  const [sales, setSales] = useState<SaleTransaction[]>(INITIAL_SALES);
  const [financialAccounts, setFinancialAccounts] = useState<FinancialAccount[]>(INITIAL_FINANCIAL_ACCOUNTS);
  const [cashLedger, setCashLedger] = useState<CashLedgerEntry[]>(INITIAL_CASH_LEDGER);
  const [coa, setCoa] = useState<AccountCOA[]>(INITIAL_COA);
  const [journals, setJournals] = useState<JournalEntry[]>(INITIAL_JOURNALS);
  const [periods, setPeriods] = useState<AccountingPeriod[]>(INITIAL_PERIODS);
  const [taxConfigs, setTaxConfigs] = useState<TaxConfig[]>(INITIAL_TAX_CONFIGS);
  const [taxTransactions, setTaxTransactions] = useState<TaxTransaction[]>(INITIAL_TAX_TRANSACTIONS);
  const [employees] = useState<Employee[]>(INITIAL_EMPLOYEES);
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>(INITIAL_PAYROLLS);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(INITIAL_ACTIVITY_LOGS);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const pushToast = (type: ToastMessage['type'], title: string, message?: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const dismissToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const logActivity = (entry: Omit<ActivityLog, 'id' | 'timestamp' | 'ipAddress'>) => {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    setActivityLogs((prev) => [
      {
        ...entry,
        id: Date.now() + Math.floor(Math.random() * 100),
        timestamp: now,
        ipAddress: '192.168.10.50',
      },
      ...prev,
    ]);
  };

  const logForbiddenAttempt = (actor: UserAccount, route: string, requiredRoles: RoleName[]) => {
    logActivity({
      actorName: actor.name,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'RBAC_FORBIDDEN_ATTEMPT',
      module: 'Security Guard',
      target: route,
      severity: 'warning',
      details: `Akses ditolak (403 Forbidden): Role "${actor.role}" mencoba mengakses ${route} (memerlukan: ${requiredRoles.join(', ')}).`,
    });
    StockFlowApi.logForbiddenAttempt({
      route,
      role: actor.role,
      reason: `Required roles: ${requiredRoles.join(', ')}`,
    });
  };

  const applyJournalToCoa = (lines: JournalLine[]) => {
    setCoa((prev) =>
      prev.map((acct) => {
        const delta = lines
          .filter((l) => l.accountCode === acct.code)
          .reduce((sum, l) => sum + (acct.normalBalance === 'debit' ? l.debit - l.credit : l.credit - l.debit), 0);
        return delta === 0 ? acct : { ...acct, balance: acct.balance + delta };
      })
    );
  };

  const addPendingUser = (u: UserAccount) => {
    setUsers((prev) => [u, ...prev]);
    logActivity({
      actorName: u.name,
      actorEmail: u.email,
      actorRole: 'guest_pending',
      action: 'GOOGLE_OAUTH_QUARANTINE',
      module: 'Auth & RBAC',
      target: '/pending-approval',
      severity: 'warning',
      details: 'Akun Google baru otomatis dikarantina sebagai guest_pending hingga disetujui Admin.',
    });
  };

  const approveAndAssignUserRole = (userId: number, role: RoleName, actor: UserAccount) => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return;
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? {
              ...u,
              role,
              status: role === 'guest_pending' ? 'pending_approval' : 'active',
              department: role === 'guest_pending' ? 'Belum Ditetapkan' : 'Operasional StockFlow',
            }
          : u
      )
    );
    logActivity({
      actorName: actor.name,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'USER_ROLE_ASSIGNED',
      module: 'Settings & RBAC',
      target: targetUser.email,
      severity: 'info',
      details: `Administrator menetapkan role "${role}" untuk akun ${targetUser.name} (${targetUser.email}).`,
    });
    pushToast('success', 'Role Pengguna Diperbarui', `${targetUser.name} kini aktif sebagai ${role}.`);
  };

  const updateUserStatus = (userId: number, status: UserAccount['status'], actor: UserAccount) => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return;
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status } : u)));
    logActivity({
      actorName: actor.name,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'USER_STATUS_CHANGED',
      module: 'Settings & RBAC',
      target: targetUser.email,
      severity: status === 'suspended' ? 'warning' : 'info',
      details: `Status akun ${targetUser.email} diubah menjadi ${status}.`,
    });
    pushToast('info', 'Status Akun Diperbarui', `${targetUser.name}: ${status}`);
  };

  const updateCompany = (patch: Partial<CompanyProfile>, actor: UserAccount) => {
    setCompany((prev) => ({ ...prev, ...patch }));
    logActivity({
      actorName: actor.name,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'COMPANY_PROFILE_UPDATED',
      module: 'Settings',
      target: 'company_profile',
      severity: 'info',
      details: 'Profil perusahaan & konfigurasi sistem diperbarui.',
    });
    pushToast('success', 'Konfigurasi Disimpan', 'Pengaturan perusahaan telah diperbarui.');
  };

  const addProduct = (p: Omit<Product, 'id'>, actor: UserAccount) => {
    const created: Product = { ...p, id: Date.now() };
    setProducts((prev) => [created, ...prev]);
    logActivity({
      actorName: actor.name,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'PRODUCT_CREATED',
      module: 'Master Data',
      target: created.sku,
      severity: 'info',
      details: `Produk baru ditambahkan: ${created.name} (${created.sku}).`,
    });
    pushToast('success', 'Produk Ditambahkan', `${created.sku} — ${created.name}`);
  };

  const recordStockMovement = (
    payload: { productId: number; warehouseId: number; type: 'stock_in' | 'stock_out'; qty: number; unitCost: number; notes: string },
    actor: UserAccount
  ): { ok: boolean; error?: string } => {
    if (payload.qty <= 0) return { ok: false, error: 'Jumlah unit harus lebih besar dari 0.' };
    const prod = products.find((p) => p.id === payload.productId);
    const wh = warehouses.find((w) => w.id === payload.warehouseId);
    if (!prod || !wh) return { ok: false, error: 'Produk atau gudang tidak valid.' };

    const currentQty = prod.stockByWarehouse[payload.warehouseId] || 0;
    if (payload.type === 'stock_out' && currentQty < payload.qty) {
      return {
        ok: false,
        error: `Stok negatif dilarang! Stok ${prod.sku} di ${wh.name} hanya ${currentQty} ${prod.unitCode}, tidak cukup untuk keluar ${payload.qty}.`,
      };
    }

    const totalBefore = Object.values(prod.stockByWarehouse).reduce((a, b) => a + b, 0);
    const newWac =
      payload.type === 'stock_in'
        ? Math.round((totalBefore * prod.wacCost + payload.qty * payload.unitCost) / (totalBefore + payload.qty))
        : prod.wacCost;

    setProducts((prev) =>
      prev.map((p) =>
        p.id === prod.id
          ? {
              ...p,
              wacCost: newWac,
              stockByWarehouse: {
                ...p.stockByWarehouse,
                [payload.warehouseId]:
                  payload.type === 'stock_in' ? currentQty + payload.qty : currentQty - payload.qty,
              },
            }
          : p
      )
    );

    const refNo = `${payload.type === 'stock_in' ? 'IN' : 'OUT'}-2026-${String(stockMovements.length + 120).padStart(4, '0')}`;
    setStockMovements((prev) => [
      {
        id: Date.now(),
        referenceNo: refNo,
        date: new Date().toISOString().slice(0, 10),
        type: payload.type,
        productId: prod.id,
        productSku: prod.sku,
        productName: prod.name,
        warehouseId: wh.id,
        warehouseName: wh.name,
        qtyDelta: payload.type === 'stock_in' ? payload.qty : -payload.qty,
        unitCost: payload.type === 'stock_in' ? payload.unitCost : prod.wacCost,
        notes: payload.notes,
        performedBy: actor.name,
      },
      ...prev,
    ]);

    logActivity({
      actorName: actor.name,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: payload.type === 'stock_in' ? 'STOCK_IN_POSTED' : 'STOCK_OUT_POSTED',
      module: 'Inventory',
      target: refNo,
      severity: 'info',
      details: `${payload.type === 'stock_in' ? '+' : '-'}${payload.qty} ${prod.sku} di ${wh.name}.`,
    });
    pushToast('success', payload.type === 'stock_in' ? 'Stok Masuk Tercatat' : 'Stok Keluar Tercatat', `${refNo} • ${prod.name}`);
    return { ok: true };
  };

  const requestAdjustment = (
    payload: { productId: number; warehouseId: number; actualQty: number; reason: string },
    actor: UserAccount
  ) => {
    const prod = products.find((p) => p.id === payload.productId);
    const wh = warehouses.find((w) => w.id === payload.warehouseId);
    if (!prod || !wh) return;
    const systemQty = prod.stockByWarehouse[payload.warehouseId] || 0;
    const adjNo = `ADJ-2026-${String(adjustments.length + 15).padStart(4, '0')}`;
    setAdjustments((prev) => [
      {
        id: Date.now(),
        adjustmentNo: adjNo,
        date: new Date().toISOString().slice(0, 10),
        productId: prod.id,
        productSku: prod.sku,
        productName: prod.name,
        warehouseId: wh.id,
        warehouseName: wh.name,
        systemQty,
        actualQty: payload.actualQty,
        difference: payload.actualQty - systemQty,
        reason: payload.reason,
        status: 'pending',
        requestedBy: actor.name,
      },
      ...prev,
    ]);
    pushToast('info', 'Pengajuan Penyesuaian Dibuat', `${adjNo} menunggu persetujuan Manager/Admin.`);
  };

  const decideAdjustment = (adjustmentId: number, decision: 'approved' | 'rejected', actor: UserAccount) => {
    const adj = adjustments.find((a) => a.id === adjustmentId);
    if (!adj || adj.status !== 'pending') return;
    setAdjustments((prev) =>
      prev.map((a) => (a.id === adjustmentId ? { ...a, status: decision, approvedBy: actor.name } : a))
    );
    if (decision === 'approved') {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === adj.productId
            ? { ...p, stockByWarehouse: { ...p.stockByWarehouse, [adj.warehouseId]: adj.actualQty } }
            : p
        )
      );
      setStockMovements((prev) => [
        {
          id: Date.now(),
          referenceNo: adj.adjustmentNo,
          date: new Date().toISOString().slice(0, 10),
          type: 'adjustment',
          productId: adj.productId,
          productSku: adj.productSku,
          productName: adj.productName,
          warehouseId: adj.warehouseId,
          warehouseName: adj.warehouseName,
          qtyDelta: adj.difference,
          unitCost: products.find((p) => p.id === adj.productId)?.wacCost || 0,
          notes: `Disetujui oleh ${actor.name}: ${adj.reason}`,
          performedBy: actor.name,
        },
        ...prev,
      ]);
    }
    pushToast(decision === 'approved' ? 'success' : 'warning', `Penyesuaian ${decision === 'approved' ? 'Disetujui' : 'Ditolak'}`, adj.adjustmentNo);
  };

  const createTransfer = (
    payload: { productId: number; fromWarehouseId: number; toWarehouseId: number; qty: number; notes: string },
    actor: UserAccount
  ): { ok: boolean; error?: string } => {
    if (payload.fromWarehouseId === payload.toWarehouseId) {
      return { ok: false, error: 'Gudang asal dan gudang tujuan harus berbeda.' };
    }
    const prod = products.find((p) => p.id === payload.productId);
    const fromWh = warehouses.find((w) => w.id === payload.fromWarehouseId);
    const toWh = warehouses.find((w) => w.id === payload.toWarehouseId);
    if (!prod || !fromWh || !toWh) return { ok: false, error: 'Data transfer tidak lengkap.' };
    const avail = prod.stockByWarehouse[fromWh.id] || 0;
    if (payload.qty <= 0 || avail < payload.qty) {
      return { ok: false, error: `Stok tidak mencukupi di ${fromWh.name} (tersedia ${avail}).` };
    }

    // Deduct immediately from source -> status in_transit
    setProducts((prev) =>
      prev.map((p) =>
        p.id === prod.id
          ? { ...p, stockByWarehouse: { ...p.stockByWarehouse, [fromWh.id]: avail - payload.qty } }
          : p
      )
    );
    const trfNo = `TRF-2026-${String(transfers.length + 30).padStart(4, '0')}`;
    setTransfers((prev) => [
      {
        id: Date.now(),
        transferNo: trfNo,
        date: new Date().toISOString().slice(0, 10),
        productId: prod.id,
        productSku: prod.sku,
        productName: prod.name,
        fromWarehouseId: fromWh.id,
        fromWarehouseName: fromWh.name,
        toWarehouseId: toWh.id,
        toWarehouseName: toWh.name,
        qty: payload.qty,
        status: 'in_transit',
        notes: payload.notes,
        createdBy: actor.name,
      },
      ...prev,
    ]);
    pushToast('info', 'Transfer Dalam Perjalanan (In-Transit)', `${trfNo} • ${payload.qty} unit ke ${toWh.name}`);
    return { ok: true };
  };

  const confirmTransferReceipt = (transferId: number, actor: UserAccount) => {
    const trf = transfers.find((t) => t.id === transferId);
    if (!trf || trf.status === 'received') return;
    setTransfers((prev) => prev.map((t) => (t.id === transferId ? { ...t, status: 'received' } : t)));
    setProducts((prev) =>
      prev.map((p) =>
        p.id === trf.productId
          ? {
              ...p,
              stockByWarehouse: {
                ...p.stockByWarehouse,
                [trf.toWarehouseId]: (p.stockByWarehouse[trf.toWarehouseId] || 0) + trf.qty,
              },
            }
          : p
      )
    );
    setStockMovements((prev) => [
      {
        id: Date.now(),
        referenceNo: trf.transferNo,
        date: new Date().toISOString().slice(0, 10),
        type: 'transfer_in',
        productId: trf.productId,
        productSku: trf.productSku,
        productName: trf.productName,
        warehouseId: trf.toWarehouseId,
        warehouseName: trf.toWarehouseName,
        qtyDelta: trf.qty,
        unitCost: products.find((p) => p.id === trf.productId)?.wacCost || 0,
        notes: `Konfirmasi terima dari ${trf.fromWarehouseName}`,
        performedBy: actor.name,
      },
      ...prev,
    ]);
    pushToast('success', 'Transfer Diterima', `${trf.transferNo} ditambahkan ke ${trf.toWarehouseName}`);
  };

  const createPurchaseOrder = (
    payload: { supplierId: number; warehouseId: number; productId: number; qty: number; unitPrice: number },
    actor: UserAccount
  ) => {
    const sup = suppliers.find((s) => s.id === payload.supplierId);
    const wh = warehouses.find((w) => w.id === payload.warehouseId);
    const prod = products.find((p) => p.id === payload.productId);
    if (!sup || !wh || !prod) return;

    const subtotal = payload.qty * payload.unitPrice;
    const effectivePpn = company.ppnDppElevenTwelfths ? 0.11 : 0.12;
    const ppnAmount = Math.round(subtotal * effectivePpn);
    const poNum = `PO-2026-${String(purchaseOrders.length + 44).padStart(4, '0')}`;

    setPurchaseOrders((prev) => [
      {
        id: Date.now(),
        poNumber: poNum,
        date: new Date().toISOString().slice(0, 10),
        expectedDate: new Date(Date.now() + sup.leadTimeDays * 86400000).toISOString().slice(0, 10),
        supplierId: sup.id,
        supplierName: sup.name,
        warehouseId: wh.id,
        warehouseName: wh.name,
        status: 'waiting_approval',
        subtotal,
        ppnAmount,
        totalAmount: subtotal + ppnAmount,
        invoiceStatus: 'unbilled',
        items: [
          { productId: prod.id, sku: prod.sku, name: prod.name, qtyOrdered: payload.qty, qtyReceived: 0, unitPrice: payload.unitPrice },
        ],
        createdBy: actor.name,
      },
      ...prev,
    ]);
    pushToast('success', 'Purchase Order Diajukan', `${poNum} dikirim untuk persetujuan Manager.`);
  };

  const advancePOStatus = (poId: number, nextStatus: POStatus, actor: UserAccount) => {
    const po = purchaseOrders.find((p) => p.id === poId);
    if (!po) return;

    setPurchaseOrders((prev) =>
      prev.map((p) =>
        p.id === poId
          ? {
              ...p,
              status: nextStatus,
              approvedBy: nextStatus === 'approved' ? actor.name : p.approvedBy,
              invoiceStatus: nextStatus === 'received' ? 'unpaid' : p.invoiceStatus,
              items:
                nextStatus === 'received'
                  ? p.items.map((it) => ({ ...it, qtyReceived: it.qtyOrdered }))
                  : p.items,
            }
          : p
      )
    );

    if (nextStatus === 'received') {
      // Auto Goods Receipt -> Update Stock + WAC + PPN Masukan + Auto Journal!
      po.items.forEach((item) => {
        recordStockMovement(
          {
            productId: item.productId,
            warehouseId: po.warehouseId,
            type: 'stock_in',
            qty: item.qtyOrdered,
            unitCost: item.unitPrice,
            notes: `Goods Receipt ${po.poNumber} (${po.supplierName})`,
          },
          actor
        );
      });

      const lines: JournalLine[] = [
        { accountCode: '1301', accountName: 'Persediaan Barang Dagang (WAC)', debit: po.subtotal, credit: 0 },
        { accountCode: '1401', accountName: 'PPN Masukan (Input VAT)', debit: po.ppnAmount, credit: 0 },
        { accountCode: '2101', accountName: 'Utang Usaha Supplier (AP)', debit: 0, credit: po.totalAmount },
      ];
      applyJournalToCoa(lines);
      setJournals((prev) => [
        {
          id: Date.now(),
          entryNo: `JV-2026-${1104 + prev.length}`,
          date: new Date().toISOString().slice(0, 10),
          period: '2026-11',
          description: `Penerimaan Barang ${po.poNumber} — ${po.supplierName}`,
          sourceModule: 'Procurement',
          status: 'posted',
          createdBy: actor.name,
          lines,
        },
        ...prev,
      ]);
      setTaxTransactions((prev) => [
        {
          id: Date.now(),
          date: new Date().toISOString().slice(0, 10),
          taxCode: 'PPN-12-DPP1112',
          taxName: 'PPN Masukan',
          direction: 'input',
          referenceNo: po.poNumber,
          taxBase: po.subtotal,
          taxAmount: po.ppnAmount,
          period: '2026-11',
          status: 'recorded',
          dueDate: '2026-12-31',
        },
        ...prev,
      ]);
    }
    pushToast('success', 'Status PO Diperbarui', `${po.poNumber} → ${nextStatus.replace('_', ' ').toUpperCase()}`);
  };

  const paySupplierInvoice = (poId: number, actor: UserAccount) => {
    const po = purchaseOrders.find((p) => p.id === poId);
    if (!po || po.invoiceStatus === 'paid') return;
    setPurchaseOrders((prev) => prev.map((p) => (p.id === poId ? { ...p, invoiceStatus: 'paid' } : p)));
    // Pay AP (NO double expense — debit AP 2101, credit Bank 1102)
    setFinancialAccounts((prev) =>
      prev.map((a) => (a.id === 2 ? { ...a, balance: a.balance - po.totalAmount } : a))
    );
    setCashLedger((prev) => [
      {
        id: Date.now(),
        date: new Date().toISOString().slice(0, 10),
        referenceNo: `PAY-${po.poNumber}`,
        accountId: 2,
        accountName: 'Bank Mandiri Operasional',
        category: 'Supplier Payment',
        direction: 'out',
        amount: po.totalAmount,
        description: `Pelunasan AP ${po.poNumber} — ${po.supplierName}`,
      },
      ...prev,
    ]);
    const lines: JournalLine[] = [
      { accountCode: '2101', accountName: 'Utang Usaha Supplier (AP)', debit: po.totalAmount, credit: 0 },
      { accountCode: '1102', accountName: 'Bank Operasional Utama', debit: 0, credit: po.totalAmount },
    ];
    applyJournalToCoa(lines);
    setJournals((prev) => [
      {
        id: Date.now(),
        entryNo: `JV-2026-${1104 + prev.length}`,
        date: new Date().toISOString().slice(0, 10),
        period: '2026-11',
        description: `Pelunasan Utang Supplier ${po.poNumber}`,
        sourceModule: 'Finance',
        status: 'posted',
        createdBy: actor.name,
        lines,
      },
      ...prev,
    ]);
    pushToast('success', 'Faktur Supplier Dilunasi', `${po.poNumber} • Jurnal AP → Bank otomatis diposting.`);
  };

  const completePosSale = (
    payload: {
      customerId: number;
      warehouseId: number;
      paymentMethod: SaleTransaction['paymentMethod'];
      items: SaleItem[];
    },
    actor: UserAccount
  ): { ok: boolean; error?: string; sale?: SaleTransaction } => {
    if (payload.items.length === 0) return { ok: false, error: 'Keranjang belanja masih kosong.' };
    const cust = customers.find((c) => c.id === payload.customerId);
    const wh = warehouses.find((w) => w.id === payload.warehouseId);
    if (!cust || !wh) return { ok: false, error: 'Pelanggan atau gudang tidak valid.' };

    // Strict Non-Negative Stock Verification
    for (const item of payload.items) {
      const prod = products.find((p) => p.id === item.productId);
      const avail = prod?.stockByWarehouse[wh.id] || 0;
      if (!prod || avail < item.qty) {
        return {
          ok: false,
          error: `Stok ${item.sku} di ${wh.name} hanya ${avail}, tidak cukup untuk transaksi ${item.qty} unit.`,
        };
      }
    }

    const subtotal = payload.items.reduce((s, it) => s + it.qty * it.unitPrice, 0);
    const discountTotal = payload.items.reduce((s, it) => s + it.discount, 0);
    const netBase = subtotal - discountTotal;
    const ppnEffectivePct = company.ppnDppElevenTwelfths ? 11 : 12;
    const ppnAmount = Math.round(netBase * (ppnEffectivePct / 100));
    const grandTotal = netBase + ppnAmount;
    const cogsTotal = payload.items.reduce((s, it) => s + it.qty * it.wacCost, 0);
    const invNo = `INV-2026-${String(414 + sales.length).padStart(4, '0')}`;

    const sale: SaleTransaction = {
      id: Date.now(),
      invoiceNo: invNo,
      date: new Date().toISOString().slice(0, 10),
      customerId: cust.id,
      customerName: cust.name,
      warehouseId: wh.id,
      warehouseName: wh.name,
      paymentMethod: payload.paymentMethod,
      paymentStatus: payload.paymentMethod === 'Credit (AR)' ? 'unpaid' : 'paid',
      subtotal,
      discountTotal,
      ppnRateEffective: ppnEffectivePct,
      ppnAmount,
      grandTotal,
      cogsTotal,
      cashierName: actor.name,
      items: payload.items,
    };

    // Deduct stock
    setProducts((prev) =>
      prev.map((p) => {
        const soldItem = payload.items.find((it) => it.productId === p.id);
        if (!soldItem) return p;
        return {
          ...p,
          stockByWarehouse: {
            ...p.stockByWarehouse,
            [wh.id]: (p.stockByWarehouse[wh.id] || 0) - soldItem.qty,
          },
        };
      })
    );

    setSales((prev) => [sale, ...prev]);

    // Update Cash/Bank or AR
    const debitAcctCode = payload.paymentMethod === 'Credit (AR)' ? '1201' : payload.paymentMethod === 'Cash' ? '1101' : '1102';
    const debitAcctName =
      debitAcctCode === '1201'
        ? 'Piutang Usaha (AR)'
        : debitAcctCode === '1101'
        ? 'Kas Kecil & Kasir POS'
        : 'Bank Operasional Utama';

    if (debitAcctCode === '1201') {
      setCustomers((prev) =>
        prev.map((c) => (c.id === cust.id ? { ...c, receivableBalance: c.receivableBalance + grandTotal } : c))
      );
    } else {
      const finId = debitAcctCode === '1101' ? 1 : 2;
      setFinancialAccounts((prev) => prev.map((a) => (a.id === finId ? { ...a, balance: a.balance + grandTotal } : a)));
      setCashLedger((prev) => [
        {
          id: Date.now(),
          date: sale.date,
          referenceNo: invNo,
          accountId: finId,
          accountName: finId === 1 ? 'Kas Kecil & Kasir Showroom' : 'Bank Mandiri Operasional',
          category: 'Sales Income',
          direction: 'in',
          amount: grandTotal,
          description: `Penjualan POS ${cust.name} (${payload.paymentMethod})`,
        },
        ...prev,
      ]);
    }

    // Auto Balanced Double-Entry Journal (Revenue + PPN Keluaran + COGS/WAC)
    const lines: JournalLine[] = [
      { accountCode: debitAcctCode, accountName: debitAcctName, debit: grandTotal, credit: 0 },
      ...(discountTotal > 0 ? [{ accountCode: '4102', accountName: 'Retur & Diskon Penjualan', debit: discountTotal, credit: 0 }] : []),
      { accountCode: '4101', accountName: 'Penjualan Furnitur & Homeware', debit: 0, credit: subtotal },
      { accountCode: '2201', accountName: 'PPN Keluaran (Output VAT)', debit: 0, credit: ppnAmount },
      { accountCode: '5101', accountName: 'Harga Pokok Penjualan (COGS)', debit: cogsTotal, credit: 0 },
      { accountCode: '1301', accountName: 'Persediaan Barang Dagang (WAC)', debit: 0, credit: cogsTotal },
    ];
    applyJournalToCoa(lines);
    setJournals((prev) => [
      {
        id: Date.now(),
        entryNo: `JV-2026-${1104 + prev.length}`,
        date: sale.date,
        period: '2026-11',
        description: `Penjualan ${invNo} & HPP Otomatis (${cust.name})`,
        sourceModule: 'Sales',
        status: 'posted',
        createdBy: actor.name,
        lines,
      },
      ...prev,
    ]);

    setTaxTransactions((prev) => [
      {
        id: Date.now(),
        date: sale.date,
        taxCode: 'PPN-12-DPP1112',
        taxName: 'PPN Keluaran',
        direction: 'output',
        referenceNo: invNo,
        taxBase: netBase,
        taxAmount: ppnAmount,
        period: '2026-11',
        status: 'recorded',
        dueDate: '2026-12-31',
      },
      ...prev,
    ]);

    pushToast('success', 'Transaksi Penjualan Berhasil', `${invNo} • Stok, PPN & Jurnal Otomatis Terposting.`);
    return { ok: true, sale };
  };

  const processSaleReturn = (saleId: number, actor: UserAccount) => {
    const sale = sales.find((s) => s.id === saleId);
    if (!sale || sale.returned) return;
    setSales((prev) => prev.map((s) => (s.id === saleId ? { ...s, returned: true } : s)));
    // Restore stock
    setProducts((prev) =>
      prev.map((p) => {
        const it = sale.items.find((i) => i.productId === p.id);
        if (!it) return p;
        return {
          ...p,
          stockByWarehouse: {
            ...p.stockByWarehouse,
            [sale.warehouseId]: (p.stockByWarehouse[sale.warehouseId] || 0) + it.qty,
          },
        };
      })
    );
    pushToast('warning', 'Retur Penjualan Diproses', `Stok dari ${sale.invoiceNo} dikembalikan ke ${sale.warehouseName}.`);
    logActivity({
      actorName: actor.name,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'SALE_RETURN_PROCESSED',
      module: 'Sales & POS',
      target: sale.invoiceNo,
      severity: 'info',
      details: `Retur penjualan ${sale.invoiceNo} diproses & stok dikembalikan.`,
    });
  };

  const recordCashEntry = (
    payload: {
      accountId: number;
      category: CashLedgerEntry['category'];
      direction: 'in' | 'out';
      amount: number;
      description: string;
    },
    actor: UserAccount
  ) => {
    const acct = financialAccounts.find((a) => a.id === payload.accountId);
    if (!acct || payload.amount <= 0) return;
    const ref = `${payload.direction === 'in' ? 'INC' : 'EXP'}-2026-${String(cashLedger.length + 90).padStart(3, '0')}`;
    setFinancialAccounts((prev) =>
      prev.map((a) =>
        a.id === acct.id
          ? { ...a, balance: payload.direction === 'in' ? a.balance + payload.amount : a.balance - payload.amount }
          : a
      )
    );
    setCashLedger((prev) => [
      {
        id: Date.now(),
        date: new Date().toISOString().slice(0, 10),
        referenceNo: ref,
        accountId: acct.id,
        accountName: acct.name,
        category: payload.category,
        direction: payload.direction,
        amount: payload.amount,
        description: payload.description,
      },
      ...prev,
    ]);
    pushToast('success', 'Transaksi Kas/Bank Dicatat', `${ref} • ${payload.description}`);
    logActivity({
      actorName: actor.name,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'CASH_LEDGER_POSTED',
      module: 'Finance',
      target: ref,
      severity: 'info',
      details: `${payload.direction.toUpperCase()} Rp ${payload.amount.toLocaleString('id-ID')} (${payload.category}).`,
    });
  };

  const transferBetweenAccounts = (
    payload: { fromAccountId: number; toAccountId: number; amount: number; description: string },
    actor: UserAccount
  ): { ok: boolean; error?: string } => {
    if (payload.fromAccountId === payload.toAccountId) {
      return { ok: false, error: 'Akun sumber dan tujuan harus berbeda.' };
    }
    const fromAcct = financialAccounts.find((a) => a.id === payload.fromAccountId);
    const toAcct = financialAccounts.find((a) => a.id === payload.toAccountId);
    if (!fromAcct || !toAcct || payload.amount <= 0) return { ok: false, error: 'Nominal transfer tidak valid.' };
    if (fromAcct.balance < payload.amount) return { ok: false, error: `Saldo ${fromAcct.name} tidak mencukupi.` };

    const ref = `TRF-CASH-${String(cashLedger.length + 20).padStart(3, '0')}`;
    const today = new Date().toISOString().slice(0, 10);

    setFinancialAccounts((prev) =>
      prev.map((a) => {
        if (a.id === fromAcct.id) return { ...a, balance: a.balance - payload.amount };
        if (a.id === toAcct.id) return { ...a, balance: a.balance + payload.amount };
        return a;
      })
    );
    setCashLedger((prev) => [
      {
        id: Date.now() + 1,
        date: today,
        referenceNo: ref,
        accountId: toAcct.id,
        accountName: toAcct.name,
        category: 'Internal Transfer',
        direction: 'in',
        amount: payload.amount,
        isInternalTransfer: true,
        description: `${payload.description} (Non-Pendapatan)`,
      },
      {
        id: Date.now(),
        date: today,
        referenceNo: ref,
        accountId: fromAcct.id,
        accountName: fromAcct.name,
        category: 'Internal Transfer',
        direction: 'out',
        amount: payload.amount,
        isInternalTransfer: true,
        description: `${payload.description} (Non-Beban)`,
      },
      ...prev,
    ]);
    // Pure asset-to-asset journal (does NOT affect Revenue/Expenses!)
    const lines: JournalLine[] = [
      { accountCode: toAcct.code, accountName: toAcct.name, debit: payload.amount, credit: 0 },
      { accountCode: fromAcct.code, accountName: fromAcct.name, debit: 0, credit: payload.amount },
    ];
    applyJournalToCoa(lines);
    setJournals((prev) => [
      {
        id: Date.now(),
        entryNo: `JV-2026-${1104 + prev.length}`,
        date: today,
        period: '2026-11',
        description: `Transfer Internal ${ref}: ${fromAcct.name} → ${toAcct.name}`,
        sourceModule: 'Finance',
        status: 'posted',
        createdBy: actor.name,
        lines,
      },
      ...prev,
    ]);
    pushToast('success', 'Pemindahbukuan Selesai', `${ref} dicatat netral (bukan pendapatan/beban).`);
    return { ok: true };
  };

  const postManualJournal = (
    payload: { date: string; description: string; lines: JournalLine[] },
    actor: UserAccount
  ): { ok: boolean; error?: string } => {
    const periodCode = payload.date.slice(0, 7);
    const targetPeriod = periods.find((p) => p.period === periodCode);
    if (targetPeriod && targetPeriod.status === 'closed') {
      return { ok: false, error: `Periode akuntansi ${targetPeriod.label} sudah DITUTUP (Locked). Tidak boleh memposting jurnal baru.` };
    }
    const validLines = payload.lines.filter((l) => l.debit > 0 || l.credit > 0);
    if (validLines.length < 2) {
      return { ok: false, error: 'Jurnal double-entry memerlukan minimal 2 baris (Debit & Kredit).' };
    }
    const totalDebit = validLines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = validLines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return {
        ok: false,
        error: `Jurnal TIDAK SEIMBANG! Total Debit (Rp ${totalDebit.toLocaleString('id-ID')}) ≠ Total Kredit (Rp ${totalCredit.toLocaleString('id-ID')}).`,
      };
    }

    const entryNo = `JV-2026-${1104 + journals.length}`;
    applyJournalToCoa(validLines);
    setJournals((prev) => [
      {
        id: Date.now(),
        entryNo,
        date: payload.date,
        period: periodCode,
        description: payload.description,
        sourceModule: 'Manual',
        status: 'posted',
        createdBy: actor.name,
        lines: validLines,
      },
      ...prev,
    ]);
    pushToast('success', 'Jurnal Umum Diposting', `${entryNo} seimbang (Rp ${totalDebit.toLocaleString('id-ID')}).`);
    return { ok: true };
  };

  const reverseJournal = (journalId: number, actor: UserAccount): { ok: boolean; error?: string } => {
    const orig = journals.find((j) => j.id === journalId);
    if (!orig) return { ok: false, error: 'Jurnal tidak ditemukan.' };
    if (orig.status === 'reversed') return { ok: false, error: 'Jurnal sudah pernah dibalik (reversed).' };
    const periodObj = periods.find((p) => p.period === orig.period);
    if (periodObj?.status === 'closed') {
      return { ok: false, error: `Periode ${periodObj.label} terkunci. Buka periode terlebih dahulu.` };
    }
    const revNo = `REV-${orig.entryNo}`;
    const reversedLines: JournalLine[] = orig.lines.map((l) => ({
      accountCode: l.accountCode,
      accountName: l.accountName,
      debit: l.credit,
      credit: l.debit,
    }));
    applyJournalToCoa(reversedLines);
    setJournals((prev) => [
      {
        id: Date.now(),
        entryNo: revNo,
        date: new Date().toISOString().slice(0, 10),
        period: orig.period,
        description: `Jurnal Pembalik (Reversal) atas ${orig.entryNo}`,
        sourceModule: 'Reversal',
        status: 'posted',
        createdBy: actor.name,
        lines: reversedLines,
      },
      ...prev.map((j) => (j.id === journalId ? { ...j, status: 'reversed' as const, reversedByEntryNo: revNo } : j)),
    ]);
    pushToast('warning', 'Jurnal Pembalik Diposting', `${revNo} dibuat (jejak audit asli tetap utuh).`);
    return { ok: true };
  };

  const togglePeriodStatus = (periodCode: string, actor: UserAccount) => {
    setPeriods((prev) =>
      prev.map((p) =>
        p.period === periodCode
          ? {
              ...p,
              status: p.status === 'open' ? 'closed' : 'open',
              closedAt: p.status === 'open' ? new Date().toISOString().slice(0, 10) : undefined,
              closedBy: p.status === 'open' ? actor.name : undefined,
            }
          : p
      )
    );
    pushToast('info', 'Status Periode Akuntansi Diubah', `Periode ${periodCode} diperbarui.`);
  };

  const togglePpnElevenTwelfths = (enabled: boolean, actor: UserAccount) => {
    setCompany((prev) => ({ ...prev, ppnDppElevenTwelfths: enabled }));
    setTaxConfigs((prev) =>
      prev.map((t) =>
        t.code === 'PPN-12-DPP1112'
          ? {
              ...t,
              dppMultiplier: enabled ? 11 / 12 : 1,
              effectiveRate: enabled ? 11 : 12,
              name: enabled
                ? 'PPN 12% Barang Non-Mewah (DPP Nilai Lain 11/12)'
                : 'PPN 12% Tarif Penuh (Tanpa DPP 11/12)',
            }
          : t
      )
    );
    logActivity({
      actorName: actor.name,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'TAX_CONFIG_UPDATED',
      module: 'Tax Management',
      target: 'PPN-12-DPP1112',
      severity: 'info',
      details: `Mode DPP 11/12 (PPN efektif ${enabled ? '11%' : '12%'}) diubah oleh ${actor.name}.`,
    });
    pushToast('success', 'Tarif PPN Diperbarui', `Tarif efektif kini ${enabled ? '11% (DPP 11/12)' : '12% penuh'}.`);
  };

  const markTaxPaid = (taxTxId: number, actor: UserAccount) => {
    setTaxTransactions((prev) => prev.map((t) => (t.id === taxTxId ? { ...t, status: 'paid' } : t)));
    pushToast('success', 'Setoran Pajak Dicatat', `NTPN / status setor diperbarui oleh ${actor.name}.`);
  };

  const advancePayrollStatus = (payrollId: number, nextStatus: PayrollStatus, actor: UserAccount) => {
    const rec = payrolls.find((p) => p.id === payrollId);
    if (!rec) return;
    setPayrolls((prev) =>
      prev.map((p) =>
        p.id === payrollId
          ? { ...p, status: nextStatus, paidAt: nextStatus === 'finance_paid' ? new Date().toISOString().slice(0, 10) : p.paidAt }
          : p
      )
    );
    if (nextStatus === 'finance_paid') {
      // Deduct from Payroll Bank Account & post balanced payroll journal
      setFinancialAccounts((prev) => prev.map((a) => (a.id === 3 ? { ...a, balance: a.balance - rec.netSalary } : a)));
      const lines: JournalLine[] = [
        { accountCode: '6101', accountName: 'Beban Gaji & Tunjangan', debit: rec.grossSalary, credit: 0 },
        { accountCode: '6102', accountName: 'Beban BPJS Pemberi Kerja', debit: rec.bpjsEmployer, credit: 0 },
        { accountCode: '1103', accountName: 'Bank Payroll & Pajak', debit: 0, credit: rec.netSalary },
        { accountCode: '2202', accountName: 'Utang PPh 21 & PPh Badan', debit: 0, credit: rec.pph21Ter },
        { accountCode: '2301', accountName: 'Utang Gaji & BPJS', debit: 0, credit: rec.bpjsEmployee + rec.bpjsEmployer },
      ];
      applyJournalToCoa(lines);
      setJournals((prev) => [
        {
          id: Date.now(),
          entryNo: `JV-2026-${1104 + prev.length}`,
          date: new Date().toISOString().slice(0, 10),
          period: rec.period,
          description: `Pencairan Gaji ${rec.employeeName} (${rec.period}) + Beban BPJS Perusahaan`,
          sourceModule: 'Payroll',
          status: 'posted',
          createdBy: actor.name,
          lines,
        },
        ...prev,
      ]);
    }
    pushToast('success', 'Alur Payroll Diperbarui', `${rec.employeeName} → ${nextStatus.replace('_', ' ').toUpperCase()}`);
  };

  return (
    <StoreContext.Provider
      value={{
        company,
        users,
        categories,
        brands,
        units,
        warehouses,
        suppliers,
        customers,
        products,
        stockMovements,
        adjustments,
        transfers,
        purchaseOrders,
        sales,
        financialAccounts,
        cashLedger,
        coa,
        journals,
        periods,
        taxConfigs,
        taxTransactions,
        employees,
        payrolls,
        activityLogs,
        toasts,
        pushToast,
        dismissToast,
        logActivity,
        logForbiddenAttempt,
        addPendingUser,
        approveAndAssignUserRole,
        updateUserStatus,
        updateCompany,
        addProduct,
        recordStockMovement,
        requestAdjustment,
        decideAdjustment,
        createTransfer,
        confirmTransferReceipt,
        createPurchaseOrder,
        advancePOStatus,
        paySupplierInvoice,
        completePosSale,
        processSaleReturn,
        recordCashEntry,
        transferBetweenAccounts,
        postManualJournal,
        reverseJournal,
        togglePeriodStatus,
        togglePpnElevenTwelfths,
        markTaxPaid,
        advancePayrollStatus,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}

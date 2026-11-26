export type RoleName =
  | 'admin'
  | 'manager'
  | 'warehouse'
  | 'purchasing'
  | 'sales'
  | 'finance'
  | 'hr_payroll'
  | 'guest_pending';

export type AccountStatus = 'active' | 'pending_approval' | 'suspended';

export interface UserAccount {
  id: number;
  name: string;
  email: string;
  role: RoleName;
  status: AccountStatus;
  authProvider: 'local' | 'google';
  googleConnected: boolean;
  avatarInitials: string;
  department: string;
  employeeId?: number;
  lastLoginAt: string;
  createdAt: string;
}

export interface Category {
  id: number;
  code: string;
  name: string;
  description: string;
  productCount: number;
}

export interface Brand {
  id: number;
  name: string;
  origin: string;
  active: boolean;
}

export interface Unit {
  id: number;
  code: string;
  name: string;
}

export interface Warehouse {
  id: number;
  code: string;
  name: string;
  city: string;
  address: string;
  managerName: string;
  capacityUnits: number;
  usedUnits: number;
}

export interface Supplier {
  id: number;
  code: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  city: string;
  leadTimeDays: number;
  onTimeRate: number;
  qualityScore: number;
  priceScore: number;
  paymentTermsDays: number;
}

export interface Customer {
  id: number;
  code: string;
  name: string;
  segment: 'Retail' | 'Interior Designer' | 'Hospitality B2B' | 'Wholesale';
  phone: string;
  email: string;
  city: string;
  creditLimit: number;
  receivableBalance: number;
}

export interface Product {
  id: number;
  sku: string;
  barcode: string;
  name: string;
  variant: string;
  categoryId: number;
  categoryName: string;
  brandName: string;
  unitCode: string;
  buyPrice: number;
  wacCost: number;
  sellPrice: number;
  minStock: number;
  safetyStock: number;
  avgDailyDemand: number;
  leadTimeDays: number;
  stockByWarehouse: Record<number, number>;
  active: boolean;
}

export interface StockMovement {
  id: number;
  referenceNo: string;
  date: string;
  type: 'stock_in' | 'stock_out' | 'adjustment' | 'transfer_out' | 'transfer_in' | 'sale' | 'return';
  productId: number;
  productSku: string;
  productName: string;
  warehouseId: number;
  warehouseName: string;
  qtyDelta: number;
  unitCost: number;
  notes: string;
  performedBy: string;
}

export interface StockAdjustment {
  id: number;
  adjustmentNo: string;
  date: string;
  productId: number;
  productSku: string;
  productName: string;
  warehouseId: number;
  warehouseName: string;
  systemQty: number;
  actualQty: number;
  difference: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedBy: string;
  approvedBy?: string;
}

export interface WarehouseTransfer {
  id: number;
  transferNo: string;
  date: string;
  productId: number;
  productSku: string;
  productName: string;
  fromWarehouseId: number;
  fromWarehouseName: string;
  toWarehouseId: number;
  toWarehouseName: string;
  qty: number;
  status: 'in_transit' | 'received';
  notes: string;
  createdBy: string;
}

export type POStatus =
  | 'draft'
  | 'waiting_approval'
  | 'approved'
  | 'ordered'
  | 'partially_received'
  | 'received';

export interface PurchaseOrderItem {
  productId: number;
  sku: string;
  name: string;
  qtyOrdered: number;
  qtyReceived: number;
  unitPrice: number;
}

export interface PurchaseOrder {
  id: number;
  poNumber: string;
  date: string;
  expectedDate: string;
  supplierId: number;
  supplierName: string;
  warehouseId: number;
  warehouseName: string;
  status: POStatus;
  subtotal: number;
  ppnAmount: number;
  totalAmount: number;
  invoiceStatus: 'unbilled' | 'unpaid' | 'paid';
  items: PurchaseOrderItem[];
  createdBy: string;
  approvedBy?: string;
}

export interface SaleItem {
  productId: number;
  sku: string;
  name: string;
  qty: number;
  unitPrice: number;
  wacCost: number;
  discount: number;
}

export interface SaleTransaction {
  id: number;
  invoiceNo: string;
  date: string;
  customerId: number;
  customerName: string;
  warehouseId: number;
  warehouseName: string;
  paymentMethod: 'Cash' | 'Bank Transfer' | 'QRIS' | 'Credit (AR)';
  paymentStatus: 'paid' | 'partial' | 'unpaid';
  subtotal: number;
  discountTotal: number;
  ppnRateEffective: number;
  ppnAmount: number;
  grandTotal: number;
  cogsTotal: number;
  cashierName: string;
  items: SaleItem[];
  returned?: boolean;
}

export interface FinancialAccount {
  id: number;
  code: string;
  name: string;
  type: 'cash' | 'bank';
  bankName?: string;
  accountNumberMasked: string;
  balance: number;
}

export interface CashLedgerEntry {
  id: number;
  date: string;
  referenceNo: string;
  accountId: number;
  accountName: string;
  category: 'Sales Income' | 'Other Income' | 'Operating Expense' | 'Supplier Payment' | 'Payroll' | 'Tax Payment' | 'Internal Transfer';
  direction: 'in' | 'out';
  amount: number;
  isInternalTransfer?: boolean;
  description: string;
}

export interface AccountCOA {
  code: string;
  name: string;
  type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'COGS' | 'Expense';
  normalBalance: 'debit' | 'credit';
  balance: number;
}

export interface JournalLine {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: number;
  entryNo: string;
  date: string;
  period: string;
  description: string;
  sourceModule: 'Sales' | 'Procurement' | 'Inventory' | 'Finance' | 'Payroll' | 'Tax' | 'Manual' | 'Reversal';
  status: 'posted' | 'reversed';
  reversedByEntryNo?: string;
  lines: JournalLine[];
  createdBy: string;
}

export interface AccountingPeriod {
  period: string;
  label: string;
  status: 'open' | 'closed';
  closedAt?: string;
  closedBy?: string;
}

export interface TaxConfig {
  id: number;
  code: string;
  name: string;
  nominalRate: number;
  dppMultiplier: number; // e.g., 11/12 for PMK 131/2024 PPN 12% non-luxury
  effectiveRate: number;
  effectiveFrom: string;
  active: boolean;
  notes: string;
}

export interface TaxTransaction {
  id: number;
  date: string;
  taxCode: string;
  taxName: string;
  direction: 'output' | 'input' | 'withholding';
  referenceNo: string;
  taxBase: number;
  taxAmount: number;
  period: string;
  status: 'recorded' | 'reported' | 'paid';
  dueDate: string;
}

export interface Employee {
  id: number;
  employeeNo: string;
  name: string;
  department: string;
  position: string;
  employmentStatus: 'Permanent' | 'Contract';
  joinDate: string;
  nik: string;
  npwp: string;
  bankName: string;
  bankAccount: string;
  ptkpStatus: 'TK/0' | 'K/0' | 'K/1' | 'K/2';
  baseSalary: number;
  fixedAllowance: number;
  transportAllowance: number;
  attendanceDays: number;
  leaveDays: number;
  bpjsKesEmployeeRate: number;
  bpjsKesEmployerRate: number;
  bpjsTkEmployeeRate: number;
  bpjsTkEmployerRate: number;
}

export type PayrollStatus = 'draft' | 'hr_checked' | 'manager_approved' | 'finance_paid';

export interface PayrollRecord {
  id: number;
  period: string;
  employeeId: number;
  employeeNo: string;
  employeeName: string;
  department: string;
  position: string;
  grossSalary: number;
  bpjsEmployee: number;
  bpjsEmployer: number;
  pph21Ter: number;
  otherDeductions: number;
  netSalary: number;
  status: PayrollStatus;
  paidAt?: string;
}

export interface ActivityLog {
  id: number;
  timestamp: string;
  actorName: string;
  actorEmail: string;
  actorRole: RoleName;
  action: string;
  module: string;
  target: string;
  severity: 'info' | 'warning' | 'critical';
  ipAddress: string;
  details: string;
}

export interface CompanyProfile {
  name: string;
  legalEntity: string;
  npwp: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  currency: 'IDR';
  fiscalYearStart: string;
  ppnDppElevenTwelfths: boolean;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
}

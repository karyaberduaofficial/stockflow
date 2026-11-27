<?php

namespace Database\Seeders;

use App\Models\AccountingPeriod;
use App\Models\Brand;
use App\Models\Category;
use App\Models\ChartOfAccount;
use App\Models\Customer;
use App\Models\Department;
use App\Models\Employee;
use App\Models\EmployeeBpjs;
use App\Models\EmployeeSalaryComponent;
use App\Models\FinancialAccount;
use App\Models\PayrollPeriod;
use App\Models\Permission;
use App\Models\Position;
use App\Models\Product;
use App\Models\Role;
use App\Models\SalaryComponent;
use App\Models\Supplier;
use App\Models\SystemSetting;
use App\Models\TaxRate;
use App\Models\TaxType;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\AccountingService;
use App\Services\InventoryService;
use App\Services\PayrollService;
use App\Services\SalesService;
use Illuminate\Database\Seeder;

class StockFlowSeeder extends Seeder
{
    public function run(): void
    {
        $demoPassword = env('SEED_DEMO_PASSWORD', 'DemoStockFlow#2026');

        // 1. Roles (8 strict canonical roles)
        $roleSpecs = [
            ['slug' => 'admin', 'name' => 'Administrator', 'description' => 'Full platform governance, user/role/security/master/tax configuration.'],
            ['slug' => 'manager', 'name' => 'Manager / Owner', 'description' => 'Executive oversight, all reports read-only, PO/Adjustment/Payroll approvals.'],
            ['slug' => 'warehouse', 'name' => 'Warehouse Staff', 'description' => 'Stock operations, stock in/out, adjustment requests, opname, transfers, barcode.'],
            ['slug' => 'purchasing', 'name' => 'Purchasing Staff', 'description' => 'Suppliers, Purchase Orders, Goods Receipts, reorder recommendations.'],
            ['slug' => 'sales', 'name' => 'Sales Staff / Cashier', 'description' => 'Catalog read, POS sales, customers, invoices, sales returns.'],
            ['slug' => 'finance', 'name' => 'Finance & Accounting Staff', 'description' => 'Finance, Cash/Bank, AR/AP, Double-Entry Accounting, Tax, Payroll Disbursement.'],
            ['slug' => 'hr_payroll', 'name' => 'HR', 'description' => 'Employees, unmasked PII, attendance, leaves, BPJS, payroll calculation & payslips.'],
            ['slug' => 'guest_pending', 'name' => 'Guest (Pending Approval)', 'description' => 'Quarantined unknown Google OAuth account with zero business access.'],
        ];

        $roles = [];
        foreach ($roleSpecs as $spec) {
            $roles[$spec['slug']] = Role::updateOrCreate(['slug' => $spec['slug']], $spec);
        }

        // 2. Granular Permissions
        $permissionSpecs = [
            ['slug' => 'admin.manage', 'module' => 'admin', 'action' => 'manage'],
            ['slug' => 'dashboard.view', 'module' => 'dashboard', 'action' => 'view'],
            ['slug' => 'master.read', 'module' => 'master', 'action' => 'read'],
            ['slug' => 'master.write', 'module' => 'master', 'action' => 'write'],
            ['slug' => 'inventory.read', 'module' => 'inventory', 'action' => 'read'],
            ['slug' => 'inventory.operate', 'module' => 'inventory', 'action' => 'operate'],
            ['slug' => 'inventory.approve', 'module' => 'inventory', 'action' => 'approve'],
            ['slug' => 'procurement.read', 'module' => 'procurement', 'action' => 'read'],
            ['slug' => 'procurement.operate', 'module' => 'procurement', 'action' => 'operate'],
            ['slug' => 'procurement.approve', 'module' => 'procurement', 'action' => 'approve'],
            ['slug' => 'sales.read', 'module' => 'sales', 'action' => 'read'],
            ['slug' => 'sales.operate', 'module' => 'sales', 'action' => 'operate'],
            ['slug' => 'finance.read', 'module' => 'finance', 'action' => 'read'],
            ['slug' => 'finance.operate', 'module' => 'finance', 'action' => 'operate'],
            ['slug' => 'accounting.read', 'module' => 'accounting', 'action' => 'read'],
            ['slug' => 'accounting.operate', 'module' => 'accounting', 'action' => 'operate'],
            ['slug' => 'tax.read', 'module' => 'tax', 'action' => 'read'],
            ['slug' => 'tax.operate', 'module' => 'tax', 'action' => 'operate'],
            ['slug' => 'tax.configure', 'module' => 'tax', 'action' => 'configure'],
            ['slug' => 'hr.read', 'module' => 'hr', 'action' => 'read'],
            ['slug' => 'hr.operate', 'module' => 'hr', 'action' => 'operate'],
            ['slug' => 'payroll.approve', 'module' => 'payroll', 'action' => 'approve'],
            ['slug' => 'payroll.disburse', 'module' => 'payroll', 'action' => 'disburse'],
            ['slug' => 'payslip.view_own', 'module' => 'payroll', 'action' => 'view_own'],
            ['slug' => 'exports.download', 'module' => 'exports', 'action' => 'download'],
        ];

        $perms = [];
        foreach ($permissionSpecs as $spec) {
            $perms[$spec['slug']] = Permission::updateOrCreate(['slug' => $spec['slug']], $spec);
        }

        $rolePermMap = [
            'admin' => array_keys($perms),
            'manager' => [
                'dashboard.view', 'master.read', 'inventory.read', 'inventory.approve',
                'procurement.read', 'procurement.approve', 'sales.read', 'finance.read',
                'accounting.read', 'tax.read', 'hr.read', 'payroll.approve', 'payslip.view_own', 'exports.download',
            ],
            'warehouse' => ['dashboard.view', 'master.read', 'inventory.read', 'inventory.operate', 'procurement.read', 'sales.read', 'payslip.view_own', 'exports.download'],
            'purchasing' => ['dashboard.view', 'master.read', 'inventory.read', 'procurement.read', 'procurement.operate', 'payslip.view_own', 'exports.download'],
            'sales' => ['dashboard.view', 'master.read', 'inventory.read', 'sales.read', 'sales.operate', 'payslip.view_own', 'exports.download'],
            'finance' => ['dashboard.view', 'master.read', 'inventory.read', 'procurement.read', 'sales.read', 'finance.read', 'finance.operate', 'accounting.read', 'accounting.operate', 'tax.read', 'tax.operate', 'payroll.disburse', 'payslip.view_own', 'exports.download'],
            'hr_payroll' => ['dashboard.view', 'hr.read', 'hr.operate', 'tax.read', 'payslip.view_own', 'exports.download'],
            'guest_pending' => [],
        ];

        foreach ($rolePermMap as $roleSlug => $permSlugs) {
            $ids = array_map(fn ($s) => $perms[$s]->id, $permSlugs);
            $roles[$roleSlug]->permissions()->sync($ids);
        }

        // 3. Demo Users for all 8 Roles (synthetic non-real domains only!)
        $userSpecs = [
            ['name' => 'Raka Pratama (Admin)', 'email' => 'admin@stockflow.local', 'role' => 'admin', 'status' => 'active'],
            ['name' => 'Dewi Lestari (Manager)', 'email' => 'manager@stockflow.local', 'role' => 'manager', 'status' => 'active'],
            ['name' => 'Budi Santoso (Warehouse)', 'email' => 'warehouse@stockflow.local', 'role' => 'warehouse', 'status' => 'active'],
            ['name' => 'Siti Rahma (Purchasing)', 'email' => 'purchasing@stockflow.local', 'role' => 'purchasing', 'status' => 'active'],
            ['name' => 'Andi Wijaya (Sales)', 'email' => 'sales@stockflow.local', 'role' => 'sales', 'status' => 'active'],
            ['name' => 'Nadia Kusuma (Finance)', 'email' => 'finance@stockflow.local', 'role' => 'finance', 'status' => 'active'],
            ['name' => 'Hendra Gunawan (HR)', 'email' => 'hr@stockflow.local', 'role' => 'hr_payroll', 'status' => 'active'],
            ['name' => 'Tamu Google (Pending)', 'email' => 'guest.pending@stockflow.local', 'role' => 'guest_pending', 'status' => 'pending_approval'],
        ];

        $users = [];
        foreach ($userSpecs as $u) {
            $user = User::where('email', $u['email'])->first() ?? new User;
            $user->forceFill([
                'name' => $u['name'],
                'email' => $u['email'],
                'password' => $demoPassword,
                'status' => $u['status'],
                'primary_role' => $u['role'],
                'email_verified_at' => now(),
            ])->save();
            $user->syncSingleRole($u['role']);
            $users[$u['role']] = $user->fresh();
        }

        // 4. Chart of Accounts (1xxx - 7xxx)
        $coaSpecs = [
            ['1110', 'Kas Kecil & Kas Showroom', 'asset', 'debit', false],
            ['1121', 'Bank Mandiri Operasional', 'asset', 'debit', false],
            ['1122', 'Bank BCA Bisnis', 'asset', 'debit', false],
            ['1130', 'Piutang Usaha (AR)', 'asset', 'debit', false],
            ['1140', 'Persediaan Barang Dagang Furnitur', 'asset', 'debit', false],
            ['1150', 'PPN Masukan (Pajak Dibayar Dimuka)', 'asset', 'debit', false],
            ['1210', 'Peralatan & Rak Gudang', 'asset', 'debit', false],
            ['2110', 'Hutang Usaha Supplier (AP)', 'liability', 'credit', false],
            ['2121', 'Utang PPN Keluaran', 'liability', 'credit', false],
            ['2122', 'Utang PPh 21 Karyawan', 'liability', 'credit', false],
            ['2123', 'Utang Pajak Lainnya', 'liability', 'credit', false],
            ['2130', 'Utang BPJS Kesehatan & Ketenagakerjaan', 'liability', 'credit', false],
            ['2140', 'Potongan & Kewajiban Karyawan Lainnya', 'liability', 'credit', false],
            ['3100', 'Modal Disetor Pemilik', 'equity', 'credit', false],
            ['3200', 'Laba Ditahan', 'equity', 'credit', false],
            ['4100', 'Penjualan Furnitur & Homeware', 'revenue', 'credit', false],
            ['4200', 'Retur & Potongan Penjualan', 'revenue', 'debit', false],
            ['5100', 'Harga Pokok Penjualan (HPP / COGS)', 'cogs', 'debit', false],
            ['6110', 'Beban Gaji & Tunjangan Karyawan', 'expense', 'debit', false],
            ['6120', 'Beban BPJS Ditanggung Perusahaan', 'expense', 'debit', false],
            ['6130', 'Beban Sewa Showroom & Gudang', 'expense', 'debit', false],
            ['6140', 'Beban Listrik, Air & Utilitas', 'expense', 'debit', false],
            ['6150', 'Beban Pengiriman & Logistik', 'expense', 'debit', false],
            ['6160', 'Beban Pemasaran & Promosi', 'expense', 'debit', false],
            ['6170', 'Beban Susut & Penyesuaian Persediaan', 'expense', 'debit', false],
            ['7100', 'Pendapatan Lain-lain', 'other_income', 'credit', false],
            ['7200', 'Beban Lain-lain & Administrasi Bank', 'other_expense', 'debit', false],
        ];

        $coas = [];
        foreach ($coaSpecs as [$code, $name, $type, $normal, $isHeader]) {
            $coas[$code] = ChartOfAccount::updateOrCreate(
                ['code' => $code],
                ['name' => $name, 'account_type' => $type, 'normal_balance' => $normal, 'is_header' => $isHeader, 'is_system' => true]
            );
        }

        // 5. Accounting Periods (2025-12 closed, 2026 open)
        AccountingPeriod::updateOrCreate(
            ['code' => '2025-12'],
            ['name' => 'Desember 2025 (Closed)', 'start_date' => '2025-12-01', 'end_date' => '2025-12-31', 'status' => 'closed', 'closed_by' => $users['admin']->id, 'closed_at' => '2026-01-05 09:00:00']
        );
        AccountingPeriod::updateOrCreate(
            ['code' => '2026-FY'],
            ['name' => 'Tahun Buku 2026', 'start_date' => '2026-01-01', 'end_date' => '2026-12-31', 'status' => 'open']
        );

        // 6. Financial Accounts
        $cashAcc = FinancialAccount::updateOrCreate(
            ['code' => 'FIN-KAS-01'],
            ['name' => 'Kas Operasional Showroom', 'account_type' => 'cash', 'coa_id' => $coas['1110']->id, 'opening_balance' => 150000000, 'current_balance' => 150000000]
        );
        $bankMandiri = FinancialAccount::updateOrCreate(
            ['code' => 'FIN-BMRI-01'],
            ['name' => 'Bank Mandiri Operasional', 'account_type' => 'bank', 'bank_name' => 'Bank Mandiri', 'account_number' => '1230009988771', 'coa_id' => $coas['1121']->id, 'opening_balance' => 850000000, 'current_balance' => 850000000]
        );
        $bankBca = FinancialAccount::updateOrCreate(
            ['code' => 'FIN-BBCA-01'],
            ['name' => 'Bank BCA Bisnis', 'account_type' => 'bank', 'bank_name' => 'Bank BCA', 'account_number' => '5410088776', 'coa_id' => $coas['1122']->id, 'opening_balance' => 500000000, 'current_balance' => 500000000]
        );

        // 7. Tax Types & Configurable Rates (PPN 12% w/ DPP 11/12 = 11% effective + PPh 21 TER + PPh Badan)
        $ppnType = TaxType::updateOrCreate(['code' => 'PPN'], ['name' => 'Pajak Pertambahan Nilai (PPN)', 'category' => 'vat', 'description' => 'PPN UU HPP & PMK 131/2024']);
        $pph21Type = TaxType::updateOrCreate(['code' => 'PPH21'], ['name' => 'PPh Pasal 21 Karyawan (TER)', 'category' => 'withholding', 'description' => 'PP 58/2023 Tarif Efektif Rata-Rata']);
        $pphBadanType = TaxType::updateOrCreate(['code' => 'PPH_BADAN'], ['name' => 'PPh Badan Tahunan', 'category' => 'corporate', 'description' => 'Pajak Penghasilan Badan']);

        TaxRate::updateOrCreate(
            ['code' => 'PPN-12-DPP-11-12'],
            [
                'tax_type_id' => $ppnType->id,
                'name' => 'PPN 12% DPP Nilai Lain 11/12 (Efektif 11%)',
                'rate_percent' => 12.0000,
                'dpp_ratio_numerator' => 11,
                'dpp_ratio_denominator' => 12,
                'effective_rate_percent' => 11.0000,
                'effective_from' => '2025-01-01',
                'is_default' => true,
                'notes' => 'Berlaku untuk barang furnitur & perlengkapan rumah tangga non-mewah (PMK 131/2024).',
            ]
        );
        TaxRate::updateOrCreate(
            ['code' => 'PPN-12-LUXURY'],
            [
                'tax_type_id' => $ppnType->id,
                'name' => 'PPN 12% Penuh (Barang Mewah)',
                'rate_percent' => 12.0000,
                'dpp_ratio_numerator' => 1,
                'dpp_ratio_denominator' => 1,
                'effective_rate_percent' => 12.0000,
                'effective_from' => '2025-01-01',
                'is_default' => false,
            ]
        );
        TaxRate::updateOrCreate(
            ['code' => 'PPH-BADAN-22'],
            [
                'tax_type_id' => $pphBadanType->id,
                'name' => 'PPh Badan Tarif Umum 22%',
                'rate_percent' => 22.0000,
                'dpp_ratio_numerator' => 1,
                'dpp_ratio_denominator' => 1,
                'effective_rate_percent' => 22.0000,
                'effective_from' => '2022-01-01',
                'is_default' => true,
            ]
        );

        // 8. Master Data: Categories, Brands, Units, Warehouses, Products, Suppliers, Customers
        $cats = [
            'living' => Category::updateOrCreate(['code' => 'CAT-LIV'], ['name' => 'Furnitur Ruang Tamu']),
            'dining' => Category::updateOrCreate(['code' => 'CAT-DIN'], ['name' => 'Furnitur Ruang Makan']),
            'bedroom' => Category::updateOrCreate(['code' => 'CAT-BED'], ['name' => 'Furnitur Kamar Tidur']),
            'kitchen' => Category::updateOrCreate(['code' => 'CAT-KIT'], ['name' => 'Peralatan Dapur & Makan']),
            'decor' => Category::updateOrCreate(['code' => 'CAT-DEC'], ['name' => 'Lampu & Dekorasi Rumah']),
            'storage' => Category::updateOrCreate(['code' => 'CAT-STR'], ['name' => 'Rak & Penyimpanan']),
        ];

        $brands = [
            'jati' => Brand::updateOrCreate(['code' => 'BRD-JTI'], ['name' => 'Karya Jati Jepara', 'country' => 'Indonesia']),
            'oak' => Brand::updateOrCreate(['code' => 'BRD-OAK'], ['name' => 'Nusantara Oak Craft', 'country' => 'Indonesia']),
            'keramik' => Brand::updateOrCreate(['code' => 'BRD-KRM'], ['name' => 'Keramik Kasongan Studio', 'country' => 'Indonesia']),
            'rotan' => Brand::updateOrCreate(['code' => 'BRD-RTN'], ['name' => 'Rotan Cirebon Artisan', 'country' => 'Indonesia']),
        ];

        $unitPcs = Unit::updateOrCreate(['code' => 'PCS'], ['name' => 'Pieces', 'symbol' => 'pcs']);
        $unitSet = Unit::updateOrCreate(['code' => 'SET'], ['name' => 'Set', 'symbol' => 'set']);
        $unitUnit = Unit::updateOrCreate(['code' => 'UNIT'], ['name' => 'Unit', 'symbol' => 'unit']);

        $whJkt = Warehouse::updateOrCreate(['code' => 'WH-JKT'], ['name' => 'Gudang Pusat Jakarta', 'type' => 'main', 'city' => 'Jakarta Selatan', 'manager_name' => 'Budi Santoso']);
        $whSby = Warehouse::updateOrCreate(['code' => 'WH-SBY'], ['name' => 'Gudang Distribusi Surabaya', 'type' => 'distribution', 'city' => 'Surabaya', 'manager_name' => 'Hadi Saputra']);
        $whBdg = Warehouse::updateOrCreate(['code' => 'WH-BDG'], ['name' => 'Showroom & Hub Bandung', 'type' => 'showroom', 'city' => 'Bandung', 'manager_name' => 'Rina Kartika']);
        $whDps = Warehouse::updateOrCreate(['code' => 'WH-DPS'], ['name' => 'Showroom & Hub Bali', 'type' => 'showroom', 'city' => 'Denpasar', 'manager_name' => 'Made Arya']);

        $productSpecs = [
            ['SKU-SF-001', '8991001000011', 'Sofa Jati Minimalis 3 Dudukan', $cats['living']->id, $brands['jati']->id, $unitUnit->id, 4200000, 6850000, 5, 40, 8, 7, 4],
            ['SKU-MJ-002', '8991001000028', 'Meja Makan Oak Solid 6 Kursi', $cats['dining']->id, $brands['oak']->id, $unitSet->id, 5500000, 8900000, 4, 30, 6, 10, 3],
            ['SKU-LM-003', '8991001000035', 'Lemari Pakaian 3 Pintu Kayu Jati', $cats['bedroom']->id, $brands['jati']->id, $unitUnit->id, 3800000, 6200000, 5, 35, 7, 7, 4],
            ['SKU-KD-004', '8991001000042', 'Set Peralatan Dapur Keramik 18pcs', $cats['kitchen']->id, $brands['keramik']->id, $unitSet->id, 480000, 895000, 15, 120, 20, 5, 10],
            ['SKU-LG-005', '8991001000059', 'Lampu Gantung Rotan Anyam Natural', $cats['decor']->id, $brands['rotan']->id, $unitPcs->id, 320000, 650000, 12, 100, 18, 5, 8],
            ['SKU-RB-006', '8991001000066', 'Rak Buku Teak 5 Susun Minimalis', $cats['storage']->id, $brands['jati']->id, $unitUnit->id, 1450000, 2490000, 6, 50, 10, 7, 5],
            ['SKU-KT-007', '8991001000073', 'Kursi Teras Rotan Cirebon Set', $cats['living']->id, $brands['rotan']->id, $unitSet->id, 1650000, 2850000, 6, 45, 9, 7, 4],
            ['SKU-NK-008', '8991001000080', 'Nakas Kayu Jati 2 Laci', $cats['bedroom']->id, $brands['jati']->id, $unitPcs->id, 680000, 1250000, 10, 80, 14, 5, 6],
        ];

        $products = [];
        foreach ($productSpecs as [$sku, $barcode, $name, $catId, $brandId, $unitId, $cost, $sell, $min, $max, $rop, $lead, $safety]) {
            $products[$sku] = Product::updateOrCreate(
                ['sku' => $sku],
                [
                    'barcode' => $barcode,
                    'name' => $name,
                    'category_id' => $catId,
                    'brand_id' => $brandId,
                    'unit_id' => $unitId,
                    'cost_price' => $cost,
                    'selling_price' => $sell,
                    'min_stock' => $min,
                    'max_stock' => $max,
                    'reorder_point' => $rop,
                    'lead_time_days' => $lead,
                    'safety_stock' => $safety,
                ]
            );
        }

        Supplier::updateOrCreate(['code' => 'SUP-JPR-01'], ['name' => 'CV Jati Makmur Jepara', 'contact_person' => 'H. Ahmad Fauzi', 'email' => 'sales@jatimakmur.local', 'city' => 'Jepara', 'npwp' => '01.234.567.8-501.000', 'payment_terms_days' => 30, 'rating' => 4.85, 'on_time_delivery_rate' => 96.5, 'quality_score' => 97.0]);
        Supplier::updateOrCreate(['code' => 'SUP-CRB-02'], ['name' => 'PT Rotan Karya Cirebon', 'contact_person' => 'Lina Marlina', 'email' => 'order@rotankarya.local', 'city' => 'Cirebon', 'npwp' => '02.345.678.9-426.000', 'payment_terms_days' => 21, 'rating' => 4.70, 'on_time_delivery_rate' => 94.0, 'quality_score' => 95.5]);
        Supplier::updateOrCreate(['code' => 'SUP-YGY-03'], ['name' => 'Studio Keramik Kasongan', 'contact_person' => 'Wahyu Nugroho', 'email' => 'info@kasonganceramic.local', 'city' => 'Yogyakarta', 'npwp' => '03.456.789.0-541.000', 'payment_terms_days' => 14, 'rating' => 4.65, 'on_time_delivery_rate' => 92.0, 'quality_score' => 96.0]);

        $customerCorp = Customer::updateOrCreate(['code' => 'CUST-001'], ['name' => 'PT Interior Hunian Sejahtera', 'type' => 'corporate', 'email' => 'procurement@hunian.local', 'city' => 'Jakarta', 'npwp' => '04.567.890.1-012.000', 'credit_limit' => 250000000]);
        Customer::updateOrCreate(['code' => 'CUST-002'], ['name' => 'Hotel Taman Asri Resort', 'type' => 'hospitality', 'email' => 'purchasing@tamanasri.local', 'city' => 'Denpasar', 'credit_limit' => 400000000]);
        Customer::updateOrCreate(['code' => 'CUST-WALKIN'], ['name' => 'Pelanggan Retail Showroom', 'type' => 'retail', 'city' => 'Jakarta', 'credit_limit' => 0]);

        // 9. Departments, Positions, Employees & BPJS
        $deptOps = Department::updateOrCreate(['code' => 'DEPT-OPS'], ['name' => 'Operasional & Gudang']);
        $deptCom = Department::updateOrCreate(['code' => 'DEPT-COM'], ['name' => 'Penjualan & Pembelian']);
        $deptFin = Department::updateOrCreate(['code' => 'DEPT-FIN'], ['name' => 'Keuangan, Akuntansi & HR']);

        $posWh = Position::updateOrCreate(['code' => 'POS-WH'], ['department_id' => $deptOps->id, 'title' => 'Staff Gudang & Logistik', 'base_salary_min' => 5500000, 'base_salary_max' => 8500000]);
        $posSales = Position::updateOrCreate(['code' => 'POS-SLS'], ['department_id' => $deptCom->id, 'title' => 'Sales Executive & Kasir', 'base_salary_min' => 5500000, 'base_salary_max' => 9000000]);
        $posFin = Position::updateOrCreate(['code' => 'POS-FIN'], ['department_id' => $deptFin->id, 'title' => 'Senior Finance & Tax Specialist', 'base_salary_min' => 8500000, 'base_salary_max' => 14000000]);
        $posMgr = Position::updateOrCreate(['code' => 'POS-MGR'], ['department_id' => $deptOps->id, 'title' => 'Operations Manager', 'base_salary_min' => 14000000, 'base_salary_max' => 22000000]);

        $compTransport = SalaryComponent::updateOrCreate(['code' => 'ALW-TRN'], ['name' => 'Tunjangan Transport & Makan', 'type' => 'earning', 'is_taxable' => true, 'default_amount' => 1000000]);
        $compPos = SalaryComponent::updateOrCreate(['code' => 'ALW-POS'], ['name' => 'Tunjangan Jabatan', 'type' => 'earning', 'is_taxable' => true, 'default_amount' => 1500000]);

        $empSpecs = [
            ['EMP-001', $users['warehouse']->id, $deptOps->id, $posWh->id, 'Budi Santoso', 'warehouse@stockflow.local', '3174010101900001', '12.345.678.9-011.000', 'Bank Mandiri', '1230001122334', 'TK/0', 'A', 6500000, 1000000],
            ['EMP-002', $users['sales']->id, $deptCom->id, $posSales->id, 'Andi Wijaya', 'sales@stockflow.local', '3174020202920002', '23.456.789.0-012.000', 'Bank BCA', '5410099887', 'K/1', 'B', 7200000, 1200000],
            ['EMP-003', $users['finance']->id, $deptFin->id, $posFin->id, 'Nadia Kusuma', 'finance@stockflow.local', '3174030303910003', '34.567.890.1-013.000', 'Bank Mandiri', '1230005566778', 'TK/0', 'A', 10500000, 1500000],
            ['EMP-004', $users['manager']->id, $deptOps->id, $posMgr->id, 'Dewi Lestari', 'manager@stockflow.local', '3174040404880004', '45.678.901.2-014.000', 'Bank BCA', '5410077665', 'K/2', 'B', 16500000, 2500000],
        ];

        foreach ($empSpecs as [$code, $uid, $deptId, $posId, $name, $email, $nik, $npwp, $bank, $accNo, $ptkp, $ter, $base, $alw]) {
            $emp = Employee::updateOrCreate(
                ['employee_code' => $code],
                [
                    'user_id' => $uid,
                    'department_id' => $deptId,
                    'position_id' => $posId,
                    'full_name' => $name,
                    'email' => $email,
                    'nik' => $nik,
                    'npwp' => $npwp,
                    'bank_name' => $bank,
                    'bank_account_number' => $accNo,
                    'bank_account_holder' => $name,
                    'ptkp_status' => $ptkp,
                    'ter_category' => $ter,
                    'base_salary' => $base,
                    'join_date' => '2024-01-15',
                    'employment_status' => 'permanent',
                ]
            );

            EmployeeBpjs::updateOrCreate(
                ['employee_id' => $emp->id],
                [
                    'bpjs_kesehatan_number' => '000199'.str_pad((string) $emp->id, 7, '0', STR_PAD_LEFT),
                    'bpjs_ketenagakerjaan_number' => '240188'.str_pad((string) $emp->id, 5, '0', STR_PAD_LEFT),
                ]
            );

            EmployeeSalaryComponent::updateOrCreate(
                ['employee_id' => $emp->id, 'salary_component_id' => $compTransport->id],
                ['amount' => $alw, 'is_active' => true]
            );
        }

        // 10. System Settings
        $settings = [
            ['company', 'company_name', 'PT Karya Berdua Homeware Nusantara'],
            ['company', 'company_npwp', '01.888.999.0-011.000'],
            ['company', 'currency', 'IDR'],
            ['inventory', 'valuation_method', 'WAC'],
            ['inventory', 'allow_negative_stock', 'false'],
            ['security', 'oauth_unknown_role', 'guest_pending'],
        ];
        foreach ($settings as [$group, $key, $value]) {
            SystemSetting::updateOrCreate(['key' => $key], ['group' => $group, 'value' => $value, 'updated_by' => $users['admin']->id]);
        }

        // 11. Balanced Opening Balances + Opening Inventory Stock + Sample Sale + Sample Payroll
        $accounting = app(AccountingService::class);
        $inventory = app(InventoryService::class);

        $openingStockValue = 0.0;
        $initialStocks = [
            [$products['SKU-SF-001'], $whJkt, 20, 4200000],
            [$products['SKU-SF-001'], $whSby, 10, 4200000],
            [$products['SKU-MJ-002'], $whJkt, 15, 5500000],
            [$products['SKU-LM-003'], $whJkt, 18, 3800000],
            [$products['SKU-KD-004'], $whBdg, 60, 480000],
            [$products['SKU-LG-005'], $whDps, 45, 320000],
            [$products['SKU-RB-006'], $whJkt, 25, 1450000],
            [$products['SKU-KT-007'], $whSby, 12, 1650000],
            [$products['SKU-NK-008'], $whJkt, 30, 680000],
        ];

        foreach ($initialStocks as [$prod, $wh, $qty, $cost]) {
            $inventory->stockIn(
                productId: $prod->id,
                warehouseId: $wh->id,
                quantity: $qty,
                unitCost: $cost,
                referenceNumber: 'OPEN-2026-001',
                movementType: 'in',
                notes: 'Saldo Awal Persediaan 2026',
                actor: $users['admin']
            );
            $openingStockValue += ($qty * $cost);
        }

        $totalOpeningEquity = 150000000 + 850000000 + 500000000 + $openingStockValue;

        $accounting->postJournal(
            entryDate: '2026-01-02',
            description: 'Saldo Awal Kas, Bank, Persediaan & Modal Disetor 2026',
            lines: [
                ['coa_code' => '1110', 'debit' => 150000000, 'credit' => 0, 'memo' => 'Saldo awal Kas'],
                ['coa_code' => '1121', 'debit' => 850000000, 'credit' => 0, 'memo' => 'Saldo awal Bank Mandiri'],
                ['coa_code' => '1122', 'debit' => 500000000, 'credit' => 0, 'memo' => 'Saldo awal Bank BCA'],
                ['coa_code' => '1140', 'debit' => $openingStockValue, 'credit' => 0, 'memo' => 'Saldo awal Persediaan Furnitur'],
                ['coa_code' => '3100', 'debit' => 0, 'credit' => $totalOpeningEquity, 'memo' => 'Modal Disetor Pemilik'],
            ],
            sourceModule: 'opening_equity',
            actor: $users['admin']
        );

        // Sample POS Sale (auto-deducts stock, calculates WAC COGS, PPN 12% DPP 11/12, posts balanced journal)
        app(SalesService::class)->createSale([
            'customer_id' => $customerCorp->id,
            'warehouse_id' => $whJkt->id,
            'sale_date' => '2026-01-15',
            'payment_method' => 'transfer',
            'items' => [
                ['product_id' => $products['SKU-SF-001']->id, 'quantity' => 2, 'unit_price' => 6850000],
                ['product_id' => $products['SKU-RB-006']->id, 'quantity' => 3, 'unit_price' => 2490000],
            ],
        ], $users['sales']);

        // Sample Payroll Period so employees have payslips ready for IDOR testing
        $period = PayrollPeriod::updateOrCreate(
            ['code' => 'PAY-2026-01'],
            [
                'name' => 'Payroll Januari 2026',
                'year' => 2026,
                'month' => 1,
                'start_date' => '2026-01-01',
                'end_date' => '2026-01-31',
                'payment_date' => '2026-01-28',
                'status' => 'draft',
            ]
        );
        app(PayrollService::class)->runPeriodPayroll($period);
    }
}

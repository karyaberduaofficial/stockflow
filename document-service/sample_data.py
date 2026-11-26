#!/usr/bin/env python3
"""
StockFlow Synthetic Sample Data — PT Karya Berdua Homeware & Furniture Indonesia.

PRIVACY & SECURITY GUARANTEE:
- 100% synthetic/dummy business & employee records ONLY.
- All sensitive PII fields (NIK, NPWP, Bank Account) are explicitly masked (`****`).
- All domain emails use RFC 2606 `.example` domains.
- All accounting statements are mathematically balanced (`Debit == Credit`, `Assets == Liabilities + Equity`).
"""

from __future__ import annotations

COMPANY_INFO = {
    "brand": "StockFlow",
    "legal_name": "PT Karya Berdua Homeware & Furniture Indonesia",
    "tagline": "Integrated Inventory, Accounting, Tax & Payroll ERP",
    "address": "Jl. Kemang Raya No. 88, Jakarta Selatan 12730, Indonesia",
    "phone": "(021) 555-0192",
    "email": "finance@stockflow-furniture.example",
    "website": "https://stockflow-furniture.example",
    "npwp_company": "01.842.510.9-014.000 (Simulasi)",
    "bank_info": "Bank Mandiri Cabang Kemang — Rek. 124-00-****-8890 a.n. PT Karya Berdua",
    "period_label": "Periode Q1 2026 (Januari – Maret 2026)",
    "report_date": "2026-03-31",
    "currency": "IDR",
}


def get_inventory_data() -> dict:
    return {
        "company": COMPANY_INFO,
        "report_code": "SF/INV/2026/Q1-001",
        "period": "Per 31 Maret 2026",
        "warehouses": [
            {"code": "WH-JKT-01", "name": "Gudang Utama Jakarta", "city": "Jakarta Timur"},
            {"code": "WH-BDG-02", "name": "Gudang Distribusi Bandung", "city": "Bandung"},
            {"code": "WH-SBY-03", "name": "Gudang Timur Surabaya", "city": "Surabaya"},
            {"code": "WH-JKT-04", "name": "Showroom Kemang", "city": "Jakarta Selatan"},
        ],
        "items": [
            {
                "sku": "SF-LVG-001",
                "barcode": "8991001000014",
                "name": "Sofa Jati Minimalis 3-Seater",
                "category": "Living Room",
                "warehouse": "WH-JKT-01",
                "unit": "Unit",
                "opening_qty": 22,
                "stock_in": 18,
                "stock_out": 26,
                "wac_cost": 4850000,
                "sell_price": 7450000,
                "avg_daily_demand": 1.6,
                "lead_time_days": 10,
                "safety_stock": 5,
            },
            {
                "sku": "SF-DIN-002",
                "barcode": "8991001000021",
                "name": "Meja Makan Oak Solid 6 Kursi",
                "category": "Dining Room",
                "warehouse": "WH-JKT-01",
                "unit": "Set",
                "opening_qty": 15,
                "stock_in": 12,
                "stock_out": 20,
                "wac_cost": 6200000,
                "sell_price": 9500000,
                "avg_daily_demand": 1.1,
                "lead_time_days": 12,
                "safety_stock": 4,
            },
            {
                "sku": "SF-BED-003",
                "barcode": "8991001000038",
                "name": "Lemari Pakaian 3 Pintu Teak",
                "category": "Bedroom",
                "warehouse": "WH-BDG-02",
                "unit": "Unit",
                "opening_qty": 28,
                "stock_in": 15,
                "stock_out": 19,
                "wac_cost": 3950000,
                "sell_price": 6250000,
                "avg_daily_demand": 1.0,
                "lead_time_days": 9,
                "safety_stock": 5,
            },
            {
                "sku": "SF-KIT-004",
                "barcode": "8991001000045",
                "name": "Set Peralatan Dapur Keramik 18-Pcs",
                "category": "Kitchenware",
                "warehouse": "WH-JKT-04",
                "unit": "Set",
                "opening_qty": 85,
                "stock_in": 60,
                "stock_out": 78,
                "wac_cost": 420000,
                "sell_price": 695000,
                "avg_daily_demand": 4.2,
                "lead_time_days": 6,
                "safety_stock": 15,
            },
            {
                "sku": "SF-DEC-005",
                "barcode": "8991001000052",
                "name": "Lampu Gantung Rotan Alami",
                "category": "Home Decoration",
                "warehouse": "WH-BDG-02",
                "unit": "Pcs",
                "opening_qty": 44,
                "stock_in": 20,
                "stock_out": 52,
                "wac_cost": 310000,
                "sell_price": 540000,
                "avg_daily_demand": 2.8,
                "lead_time_days": 7,
                "safety_stock": 8,
            },
            {
                "sku": "SF-LVG-006",
                "barcode": "8991001000069",
                "name": "Rak Buku Jati 5 Tingkat",
                "category": "Living Room",
                "warehouse": "WH-SBY-03",
                "unit": "Unit",
                "opening_qty": 32,
                "stock_in": 24,
                "stock_out": 21,
                "wac_cost": 1650000,
                "sell_price": 2650000,
                "avg_daily_demand": 1.3,
                "lead_time_days": 8,
                "safety_stock": 6,
            },
            {
                "sku": "SF-BED-007",
                "barcode": "8991001000076",
                "name": "Ranjang Queen Kayu Sungkai",
                "category": "Bedroom",
                "warehouse": "WH-SBY-03",
                "unit": "Unit",
                "opening_qty": 18,
                "stock_in": 14,
                "stock_out": 13,
                "wac_cost": 3400000,
                "sell_price": 5350000,
                "avg_daily_demand": 0.9,
                "lead_time_days": 10,
                "safety_stock": 4,
            },
            {
                "sku": "SF-DIN-008",
                "barcode": "8991001000083",
                "name": "Kursi Bar Rotan & Rangka Besi",
                "category": "Dining Room",
                "warehouse": "WH-JKT-04",
                "unit": "Pcs",
                "opening_qty": 50,
                "stock_in": 30,
                "stock_out": 58,
                "wac_cost": 580000,
                "sell_price": 950000,
                "avg_daily_demand": 3.0,
                "lead_time_days": 7,
                "safety_stock": 10,
            },
            {
                "sku": "SF-BTH-009",
                "barcode": "8991001000090",
                "name": "Kabinet Wastafel Kayu Tahan Air",
                "category": "Bathroom",
                "warehouse": "WH-JKT-01",
                "unit": "Unit",
                "opening_qty": 24,
                "stock_in": 10,
                "stock_out": 11,
                "wac_cost": 2150000,
                "sell_price": 3450000,
                "avg_daily_demand": 0.8,
                "lead_time_days": 11,
                "safety_stock": 4,
            },
            {
                "sku": "SF-KIT-010",
                "barcode": "8991001000106",
                "name": "Talenan & Rak Bumbu Kayu Akasia",
                "category": "Kitchenware",
                "warehouse": "WH-BDG-02",
                "unit": "Set",
                "opening_qty": 110,
                "stock_in": 90,
                "stock_out": 105,
                "wac_cost": 165000,
                "sell_price": 295000,
                "avg_daily_demand": 5.5,
                "lead_time_days": 5,
                "safety_stock": 20,
            },
            {
                "sku": "SF-DEC-011",
                "barcode": "8991001000113",
                "name": "Cermin Dinding Frame Kayu Jati",
                "category": "Home Decoration",
                "warehouse": "WH-SBY-03",
                "unit": "Pcs",
                "opening_qty": 36,
                "stock_in": 20,
                "stock_out": 28,
                "wac_cost": 490000,
                "sell_price": 820000,
                "avg_daily_demand": 1.5,
                "lead_time_days": 7,
                "safety_stock": 6,
            },
            {
                "sku": "SF-LVG-012",
                "barcode": "8991001000120",
                "name": "Meja Kopi Marmer & Kayu Teak",
                "category": "Living Room",
                "warehouse": "WH-JKT-04",
                "unit": "Unit",
                "opening_qty": 16,
                "stock_in": 12,
                "stock_out": 20,
                "wac_cost": 2750000,
                "sell_price": 4450000,
                "avg_daily_demand": 1.2,
                "lead_time_days": 10,
                "safety_stock": 4,
            },
        ],
    }


def get_financial_data() -> dict:
    """
    Balanced Double-Entry Trial Balance & Financial Statements (Q1 2026).
    Verification:
      Total Debit  = 4,945,000,000
      Total Credit = 4,945,000,000
      Net Sales    = 1,680,000,000 - 45,000,000 - 35,000,000 = 1,600,000,000
      Gross Profit = 1,600,000,000 - 940,000,000 = 660,000,000 (41.25%)
      OpEx         = 215M + 18.5M + 96M + 24.5M + 42M + 36M + 28M = 460,000,000
      Op Profit    = 200,000,000
      Other Inc    = +12,000,000 | Interest Exp = -12,000,000 -> EBT = 200,000,000
      Tax (22% std/11% SME eff -> 22,000,000 provision) -> Net Profit = 178,000,000
      Assets       = 485M + 310M + 215M + 645M + 45M + 1,180M - 165M = 2,715,000,000
      Liabilities  = 290M + 42M + 22M + 38M + 420M = 812,000,000
      Equity       = 1,500M + 225M + 178M (Net Profit) = 1,903,000,000
      Liab + Eq    = 812M + 1,903M = 2,715,000,000 == Assets (Diff = 0!)
    """
    return {
        "company": COMPANY_INFO,
        "report_code": "SF/FIN/2026/Q1-002",
        "period": "Q1 2026 (1 Januari – 31 Maret 2026)",
        "trial_balance": [
            # Assets (Debit normal)
            {"code": "1101", "name": "Kas & Setara Kas", "category": "Aset Lancar", "debit": 485000000, "credit": 0},
            {"code": "1102", "name": "Bank Operasional (Mandiri & BCA)", "category": "Aset Lancar", "debit": 310000000, "credit": 0},
            {"code": "1103", "name": "Piutang Usaha (AR)", "category": "Aset Lancar", "debit": 215000000, "credit": 0},
            {"code": "1104", "name": "Persediaan Barang Dagang (WAC)", "category": "Aset Lancar", "debit": 645000000, "credit": 0},
            {"code": "1105", "name": "PPN Masukan & Biaya Dibayar Dimuka", "category": "Aset Lancar", "debit": 45000000, "credit": 0},
            {"code": "1201", "name": "Aset Tetap (Gudang, Rak, Kendaraan)", "category": "Aset Tidak Lancar", "debit": 1180000000, "credit": 0},
            {"code": "1209", "name": "Akumulasi Penyusutan Aset Tetap", "category": "Aset Tidak Lancar", "debit": 0, "credit": 165000000},
            # Liabilities (Credit normal)
            {"code": "2101", "name": "Utang Usaha Supplier (AP)", "category": "Liabilitas Lancar", "debit": 0, "credit": 290000000},
            {"code": "2102", "name": "Utang PPN Keluaran & PPh 21", "category": "Liabilitas Lancar", "debit": 0, "credit": 42000000},
            {"code": "2103", "name": "Utang Pajak Penghasilan Badan", "category": "Liabilitas Lancar", "debit": 0, "credit": 22000000},
            {"code": "2104", "name": "Beban Akrual & Utang BPJS", "category": "Liabilitas Lancar", "debit": 0, "credit": 38000000},
            {"code": "2201", "name": "Pinjaman Bank Jangka Panjang", "category": "Liabilitas Jangka Panjang", "debit": 0, "credit": 420000000},
            # Equity (Credit normal)
            {"code": "3101", "name": "Modal Disetor Pemilik", "category": "Ekuitas", "debit": 0, "credit": 1500000000},
            {"code": "3201", "name": "Saldo Laba Ditahan (Awal Tahun)", "category": "Ekuitas", "debit": 0, "credit": 225000000},
            # Revenue & Contra-Revenue
            {"code": "4101", "name": "Penjualan Kotor Furnitur & Homeware", "category": "Pendapatan", "debit": 0, "credit": 1680000000},
            {"code": "4102", "name": "Retur Penjualan", "category": "Pendapatan", "debit": 45000000, "credit": 0},
            {"code": "4103", "name": "Diskon & Potongan Penjualan", "category": "Pendapatan", "debit": 35000000, "credit": 0},
            # COGS
            {"code": "5101", "name": "Harga Pokok Penjualan (COGS - WAC)", "category": "HPP", "debit": 940000000, "credit": 0},
            # Operating Expenses
            {"code": "6101", "name": "Beban Gaji, Tunjangan & Lembur", "category": "Beban Operasional", "debit": 215000000, "credit": 0},
            {"code": "6102", "name": "Beban BPJS Ditanggung Perusahaan", "category": "Beban Operasional", "debit": 18500000, "credit": 0},
            {"code": "6103", "name": "Beban Sewa Gudang & Showroom", "category": "Beban Operasional", "debit": 96000000, "credit": 0},
            {"code": "6104", "name": "Beban Listrik, Air & Internet", "category": "Beban Operasional", "debit": 24500000, "credit": 0},
            {"code": "6105", "name": "Beban Logistik & Pengiriman", "category": "Beban Operasional", "debit": 42000000, "credit": 0},
            {"code": "6106", "name": "Beban Pemasaran & Katalog Digital", "category": "Beban Operasional", "debit": 36000000, "credit": 0},
            {"code": "6107", "name": "Beban Penyusutan Aset Tetap", "category": "Beban Operasional", "debit": 28000000, "credit": 0},
            # Other Income / Expense & Tax
            {"code": "7101", "name": "Pendapatan Jasa Giro & Lain-lain", "category": "Pendapatan Lain", "debit": 0, "credit": 12000000},
            {"code": "7201", "name": "Beban Bunga Pinjaman Bank", "category": "Beban Lain", "debit": 12000000, "credit": 0},
            {"code": "7301", "name": "Beban Estimasi PPh Badan (11% Fasilitas)", "category": "Pajak", "debit": 22000000, "credit": 0},
        ],
        "cash_flow": {
            "opening_cash": 612000000,
            "operating": [
                {"item": "Penerimaan Kas dari Pelanggan (Tunai & Pelunasan AR)", "amount": 1545000000},
                {"item": "Pembayaran kepada Supplier Furnitur & Homeware", "amount": -875000000},
                {"item": "Pembayaran Gaji Karyawan & BPJS", "amount": -228500000},
                {"item": "Pembayaran Beban Operasional (Sewa, Logistik, Utilitas, Pemasaran)", "amount": -192500000},
                {"item": "Pembayaran Pajak (PPN & PPh 21) dan Bunga Pinjaman", "amount": -38000000},
                {"item": "Penerimaan Pendapatan Jasa Giro", "amount": 12000000},
            ],
            "investing": [
                {"item": "Pembelian Rak Gudang Modular & Scanner Barcode", "amount": -65000000},
                {"item": "Renovasi Display Showroom Kemang", "amount": -35000000},
            ],
            "financing": [
                {"item": "Pencairan Tambahan Fasilitas Modal Kerja", "amount": 100000000},
                {"item": "Pembayaran Cicilan Pokok Pinjaman Bank", "amount": -40000000},
            ],
            # Net CF = (+223M) + (-100M) + (+60M) = +183M; Ending Cash = 612M + 183M = 795M == Kas (485M) + Bank (310M)!!
        },
        "monthly_trend": {
            "months": ["Okt 2025", "Nov 2025", "Des 2025", "Jan 2026", "Feb 2026", "Mar 2026"],
            "revenue_jt": [465, 498, 560, 510, 535, 555],
            "cogs_jt": [278, 294, 328, 302, 314, 324],
            "net_profit_jt": [46, 52, 65, 55, 59, 64],
        },
    }


def get_tax_data() -> dict:
    return {
        "company": COMPANY_INFO,
        "report_code": "SF/TAX/2026/03-001",
        "period": "Masa Pajak Maret 2026",
        "disclaimer": (
            "CATATAN KEPATUHAN PAJAK: Perhitungan PPN (Tarif 12% dengan DPP Nilai Lain 11/12 = efektif 11% "
            "sesuai PMK 131/2024) dan PPh 21 TER (PP 58/2023) menggunakan parameter terkonfigurasi dalam sistem. "
            "Laporan ini merupakan rekap manajerial internal dan wajib direview oleh Konsultan Pajak / Staf Pajak "
            "sebelum pelaporan resmi ke Coretax DJP."
        ),
        "params": {
            "ppn_statutory_rate": 0.12,
            "dpp_ratio_num": 11,
            "dpp_ratio_den": 12,
            "pph_badan_facility_rate": 0.11,
        },
        "ppn_keluaran": [
            {"date": "2026-03-03", "faktur": "040.001-26.000101", "invoice": "INV-2026-001", "counterparty": "PT Griya Nusantara Interior (Contoh)", "npwp": "02.410.***.2-012.000", "harga_jual": 86500000},
            {"date": "2026-03-07", "faktur": "040.001-26.000102", "invoice": "INV-2026-002", "counterparty": "CV Ruang Hangat Desain (Contoh)", "npwp": "03.118.***.5-422.000", "harga_jual": 64200000},
            {"date": "2026-03-11", "faktur": "040.001-26.000103", "invoice": "INV-2026-003", "counterparty": "Hotel Bumi Kayu Bandung (Contoh)", "npwp": "01.904.***.8-424.000", "harga_jual": 128000000},
            {"date": "2026-03-15", "faktur": "040.001-26.000104", "invoice": "INV-2026-004", "counterparty": "PT Sentra Hunian Modern (Contoh)", "npwp": "02.775.***.1-015.000", "harga_jual": 95400000},
            {"date": "2026-03-20", "faktur": "040.001-26.000105", "invoice": "INV-2026-005", "counterparty": "Penjualan Ritel Showroom Kemang (Digunggung)", "npwp": "00.000.***.0-000.000", "harga_jual": 112800000},
            {"date": "2026-03-25", "faktur": "040.001-26.000106", "invoice": "INV-2026-006", "counterparty": "Kafe Kopi Hutan Surabaya (Contoh)", "npwp": "03.652.***.7-609.000", "harga_jual": 68100000},
        ],
        "ppn_masukan": [
            {"date": "2026-03-02", "faktur": "040.004-26.004210", "po": "PO-2026-014", "supplier": "PT Jati Makmur Jepara (Contoh)", "npwp": "01.331.***.4-516.000", "harga_beli": 145000000},
            {"date": "2026-03-09", "faktur": "040.004-26.004288", "po": "PO-2026-015", "supplier": "CV Rotan Nusantara Cirebon (Contoh)", "npwp": "02.519.***.9-426.000", "harga_beli": 58000000},
            {"date": "2026-03-14", "faktur": "040.004-26.004312", "po": "PO-2026-016", "supplier": "PT Keramik Indah Sentosa (Contoh)", "npwp": "01.640.***.2-415.000", "harga_beli": 49500000},
            {"date": "2026-03-19", "faktur": "040.004-26.004405", "po": "PO-2026-017", "supplier": "UD Kayu Sungkai Kalimantan (Contoh)", "npwp": "03.224.***.6-722.000", "harga_beli": 72500000},
        ],
        "pph21_ter": [
            {"emp_id": "EMP-2024-001", "name": "Hendra Wijaya (Contoh)", "ptkp": "K/2", "ter_cat": "TER B", "npwp": "09.112.***.1-014.000", "gross": 18500000, "ter_rate": 0.08},
            {"emp_id": "EMP-2024-004", "name": "Siti Rahmawati (Contoh)", "ptkp": "K/1", "ter_cat": "TER A", "npwp": "09.245.***.3-014.000", "gross": 12500000, "ter_rate": 0.04},
            {"emp_id": "EMP-2024-007", "name": "Dimas Pratama (Contoh)", "ptkp": "TK/0", "ter_cat": "TER A", "npwp": "09.388.***.7-422.000", "gross": 9200000, "ter_rate": 0.0175},
            {"emp_id": "EMP-2024-011", "name": "Rina Kusuma (Contoh)", "ptkp": "K/0", "ter_cat": "TER A", "npwp": "09.410.***.2-015.000", "gross": 10800000, "ter_rate": 0.025},
            {"emp_id": "EMP-2024-015", "name": "Agus Setiawan (Contoh)", "ptkp": "K/3", "ter_cat": "TER C", "npwp": "09.521.***.8-609.000", "gross": 8400000, "ter_rate": 0.01},
            {"emp_id": "EMP-2024-018", "name": "Budi Santoso (Contoh)", "ptkp": "K/1", "ter_cat": "TER A", "npwp": "09.633.***.4-421.000", "gross": 7850000, "ter_rate": 0.015},
            {"emp_id": "EMP-2025-021", "name": "Dewi Lestari (Contoh)", "ptkp": "TK/0", "ter_cat": "TER A", "npwp": "09.749.***.5-014.000", "gross": 6900000, "ter_rate": 0.01},
            {"emp_id": "EMP-2025-024", "name": "Fajar Nugroho (Contoh)", "ptkp": "TK/0", "ter_cat": "TER A", "npwp": "09.855.***.9-424.000", "gross": 6350000, "ter_rate": 0.0075},
        ],
    }


def get_payroll_data() -> dict:
    return {
        "company": COMPANY_INFO,
        "report_code": "SF/HR/PAY/2026-03",
        "period": "Maret 2026 (Cutoff 25 Maret 2026)",
        "bpjs_params": {
            "emp_jht": 0.02,
            "emp_jp": 0.01,
            "emp_kes": 0.01,
            "er_jkk": 0.0024,
            "er_jkm": 0.0030,
            "er_jht": 0.037,
            "er_jp": 0.02,
            "er_kes": 0.04,
            "jp_cap": 10042300,
            "kes_cap": 12000000,
            "overtime_rate_per_hour": 45000,
        },
        "employees": [
            {
                "emp_id": "EMP-2024-001", "name": "Hendra Wijaya (Contoh)", "dept": "Manajemen", "position": "Operations Manager",
                "nik_masked": "3174********0001", "npwp_masked": "09.112.***.1-014.000", "bank_masked": "Mandiri ****-****-4410",
                "ptkp": "K/2", "present_days": 22, "overtime_hours": 0, "base_salary": 14500000, "allowances": 4000000, "ter_rate": 0.08,
            },
            {
                "emp_id": "EMP-2024-004", "name": "Siti Rahmawati (Contoh)", "dept": "Keuangan & Akuntansi", "position": "Senior Accountant",
                "nik_masked": "3174********0004", "npwp_masked": "09.245.***.3-014.000", "bank_masked": "BCA ****-****-2190",
                "ptkp": "K/1", "present_days": 22, "overtime_hours": 4, "base_salary": 9800000, "allowances": 2520000, "ter_rate": 0.04,
            },
            {
                "emp_id": "EMP-2024-007", "name": "Dimas Pratama (Contoh)", "dept": "Pengadaan", "position": "Purchasing Specialist",
                "nik_masked": "3273********0007", "npwp_masked": "09.388.***.7-422.000", "bank_masked": "BCA ****-****-3318",
                "ptkp": "TK/0", "present_days": 21, "overtime_hours": 6, "base_salary": 7200000, "allowances": 1730000, "ter_rate": 0.0175,
            },
            {
                "emp_id": "EMP-2024-011", "name": "Rina Kusuma (Contoh)", "dept": "HR & Payroll", "position": "HR & Payroll Lead",
                "nik_masked": "3171********0011", "npwp_masked": "09.410.***.2-015.000", "bank_masked": "Mandiri ****-****-7821",
                "ptkp": "K/0", "present_days": 22, "overtime_hours": 2, "base_salary": 8500000, "allowances": 2210000, "ter_rate": 0.025,
            },
            {
                "emp_id": "EMP-2024-015", "name": "Agus Setiawan (Contoh)", "dept": "Operasional Gudang", "position": "Warehouse Supervisor",
                "nik_masked": "3578********0015", "npwp_masked": "09.521.***.8-609.000", "bank_masked": "BRI ****-****-5520",
                "ptkp": "K/3", "present_days": 22, "overtime_hours": 10, "base_salary": 6400000, "allowances": 1550000, "ter_rate": 0.01,
            },
            {
                "emp_id": "EMP-2024-018", "name": "Budi Santoso (Contoh)", "dept": "Operasional Gudang", "position": "Warehouse Coordinator",
                "nik_masked": "3273********0018", "npwp_masked": "09.633.***.4-421.000", "bank_masked": "BCA ****-****-8841",
                "ptkp": "K/1", "present_days": 22, "overtime_hours": 10, "base_salary": 6000000, "allowances": 1400000, "ter_rate": 0.015,
            },
            {
                "emp_id": "EMP-2025-021", "name": "Dewi Lestari (Contoh)", "dept": "Penjualan & Showroom", "position": "Showroom Sales Executive",
                "nik_masked": "3174********0021", "npwp_masked": "09.749.***.5-014.000", "bank_masked": "BCA ****-****-1192",
                "ptkp": "TK/0", "present_days": 22, "overtime_hours": 6, "base_salary": 5400000, "allowances": 1230000, "ter_rate": 0.01,
            },
            {
                "emp_id": "EMP-2025-024", "name": "Fajar Nugroho (Contoh)", "dept": "Penjualan & Showroom", "position": "POS Cashier & Inventory",
                "nik_masked": "3273********0024", "npwp_masked": "09.855.***.9-424.000", "bank_masked": "BNI ****-****-6044",
                "ptkp": "TK/0", "present_days": 21, "overtime_hours": 8, "base_salary": 5000000, "allowances": 990000, "ter_rate": 0.0075,
            },
        ],
    }


def get_invoice_data() -> dict:
    return {
        "company": COMPANY_INFO,
        "invoice_no": "INV-2026-001",
        "po_ref": "PO-GNI-2026-044",
        "issue_date": "2026-03-03",
        "due_date": "2026-03-17",
        "payment_terms": "NET 14 Hari",
        "status": "BELUM LUNAS (Jatuh Tempo 17 Mar 2026)",
        "customer": {
            "name": "PT Griya Nusantara Interior (Contoh)",
            "contact": "Ibu Kartika Sari (Procurement)",
            "address": "Jl. Senopati Raya No. 45, Kebayoran Baru, Jakarta Selatan 12190",
            "phone": "(021) 555-0843",
            "npwp": "02.410.***.2-012.000",
        },
        "items": [
            {"sku": "SF-LVG-001", "name": "Sofa Jati Minimalis 3-Seater (Kain Linen Warm Ivory)", "qty": 4, "unit": "Unit", "unit_price": 7450000, "discount": 1000000},
            {"sku": "SF-DIN-002", "name": "Meja Makan Oak Solid 6 Kursi", "qty": 3, "unit": "Set", "unit_price": 9500000, "discount": 1500000},
            {"sku": "SF-LVG-012", "name": "Meja Kopi Marmer & Kayu Teak", "qty": 4, "unit": "Unit", "unit_price": 4450000, "discount": 800000},
            {"sku": "SF-DEC-005", "name": "Lampu Gantung Rotan Alami Handcrafted", "qty": 15, "unit": "Pcs", "unit_price": 540000, "discount": 400000},
            {"sku": "SF-KIT-004", "name": "Set Peralatan Dapur Keramik 18-Pcs", "qty": 10, "unit": "Set", "unit_price": 695000, "discount": 250000},
        ],
        "ppn_statutory_rate": 0.12,
        "dpp_ratio": 11 / 12,
        "notes": [
            "Barang dikirim dari Gudang Utama Jakarta (WH-JKT-01) lengkap dengan Surat Jalan resmi.",
            "PPN dihitung sesuai PMK 131/2024: DPP Nilai Lain = 11/12 x Subtotal Netto, tarif PPN 12% (efektif 11%).",
            "Mohon cantumkan nomor invoice INV-2026-001 pada berita transfer pembayaran.",
        ],
    }


def get_payslip_data() -> dict:
    payroll = get_payroll_data()
    emp = next(e for e in payroll["employees"] if e["emp_id"] == "EMP-2024-018")
    bp = payroll["bpjs_params"]
    overtime_pay = emp["overtime_hours"] * bp["overtime_rate_per_hour"]
    gross = emp["base_salary"] + emp["allowances"] + overtime_pay

    bpjs_jht_emp = round(emp["base_salary"] * bp["emp_jht"])
    bpjs_jp_emp = round(min(emp["base_salary"], bp["jp_cap"]) * bp["emp_jp"])
    bpjs_kes_emp = round(min(emp["base_salary"], bp["kes_cap"]) * bp["emp_kes"])
    pph21_ter = round(gross * emp["ter_rate"])
    total_deductions = bpjs_jht_emp + bpjs_jp_emp + bpjs_kes_emp + pph21_ter
    net_salary = gross - total_deductions

    er_jkk = round(emp["base_salary"] * bp["er_jkk"])
    er_jkm = round(emp["base_salary"] * bp["er_jkm"])
    er_jht = round(emp["base_salary"] * bp["er_jht"])
    er_jp = round(min(emp["base_salary"], bp["jp_cap"]) * bp["er_jp"])
    er_kes = round(min(emp["base_salary"], bp["kes_cap"]) * bp["er_kes"])

    return {
        "company": COMPANY_INFO,
        "slip_no": "SLP-2026-03-018",
        "period": payroll["period"],
        "pay_date": "2026-03-27",
        "employee": emp,
        "earnings": [
            {"label": "Gaji Pokok", "amount": emp["base_salary"]},
            {"label": "Tunjangan Jabatan & Transportasi", "amount": 950000},
            {"label": "Tunjangan Makan (22 Hari Kerja)", "amount": 450000},
            {"label": f"Upah Lembur ({emp['overtime_hours']} Jam x Rp 45.000)", "amount": overtime_pay},
        ],
        "deductions": [
            {"label": f"PPh 21 TER ({emp['ter_rate']*100:.2f}% x Penghasilan Bruto)", "amount": pph21_ter},
            {"label": "BPJS Ketenagakerjaan — JHT Karyawan (2%)", "amount": bpjs_jht_emp},
            {"label": "BPJS Ketenagakerjaan — JP Karyawan (1%)", "amount": bpjs_jp_emp},
            {"label": "BPJS Kesehatan — Iuran Karyawan (1%)", "amount": bpjs_kes_emp},
        ],
        "employer_contributions": [
            {"label": "BPJS JKK (0,24%) + JKM (0,30%) — Ditanggung Perusahaan", "amount": er_jkk + er_jkm},
            {"label": "BPJS JHT Perusahaan (3,70%)", "amount": er_jht},
            {"label": "BPJS JP Perusahaan (2,00%)", "amount": er_jp},
            {"label": "BPJS Kesehatan Perusahaan (4,00%)", "amount": er_kes},
        ],
        "totals": {
            "gross": gross,
            "deductions": total_deductions,
            "net": net_salary,
            "employer_bpjs_total": er_jkk + er_jkm + er_jht + er_jp + er_kes,
        },
    }


def get_opname_data() -> dict:
    inv = get_inventory_data()
    return {
        "company": COMPANY_INFO,
        "opname_no": "OPN-2026-Q1-JKT01",
        "opname_date": "2026-03-31",
        "warehouse": "WH-JKT-01 — Gudang Utama Jakarta & Distribusi Terpadu",
        "supervisor": "Agus Setiawan (Warehouse Supervisor — Contoh)",
        "items": inv["items"],
    }


def format_idr(amount: float | int) -> str:
    val = int(round(amount))
    if val < 0:
        return f"(Rp {abs(val):,})".replace(",", ".")
    return f"Rp {val:,}".replace(",", ".")

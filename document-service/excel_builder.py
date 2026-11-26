#!/usr/bin/env python3
"""
StockFlow Enterprise Excel (.xlsx) Generator — openpyxl.

Complies with `corporate-excel-operations`, `excel-gsheets-master-formulas`, `office-file-builder`,
and StockFlow's STRICT ZERO-BLUE Brand Palette:
- Multi-layer architecture (00_Panduan, Summary/Dashboard, Parameter, Data/Calc, Audit Control)
- 100% live dynamic Excel formulas (SUM, AVERAGE, SUMIF, COUNTIF, IF, MIN, MAX, ROUND, ABS, SUMPRODUCT)
- Zero merged cells in flat tables, explicit IDR & % number formats, freeze panes, auto-filters
- Data Validation, Conditional Formatting, Named Ranges, Native Charts with zero-blue RGB fills
- Landscape A4 Fit-to-1-Page-Wide print readiness & OOXML Zero-Blue Theme Patching.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional

from openpyxl import Workbook
from openpyxl.chart import BarChart, Reference
from openpyxl.formatting.rule import CellIsRule, FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Protection, Side
from openpyxl.utils import get_column_letter
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.worksheet.datavalidation import DataValidation

from brand_theme import CHART_SERIES_HEX, PALETTE, patch_ooxml_zero_blue_theme
from sample_data import get_financial_data, get_inventory_data, get_payroll_data, get_tax_data

# =============================================================================
# SHARED STOCKFLOW ZERO-BLUE EXCEL STYLES
# =============================================================================

FMT_IDR = '"Rp" #,##0;("Rp" #,##0);"-"'
FMT_INT = '#,##0;(#,##0);"-"'
FMT_DEC = '#,##0.0'
FMT_PCT = '0.0%'
FMT_PCT2 = '0.00%'

FONT_NAME = "Calibri"

FONT_TITLE = Font(name=FONT_NAME, size=14, bold=True, color=PALETTE["primary"])
FONT_SUBTITLE = Font(name=FONT_NAME, size=10, italic=True, color=PALETTE["stone"])
FONT_SECTION = Font(name=FONT_NAME, size=11, bold=True, color=PALETTE["primary"])
FONT_HDR = Font(name=FONT_NAME, size=10, bold=True, color=PALETTE["white"])
FONT_INPUT = Font(name=FONT_NAME, size=10, color=PALETTE["accent"])           # Terracotta = Input (NO BLUE!)
FONT_FORMULA = Font(name=FONT_NAME, size=10, color=PALETTE["charcoal"])       # Espresso = Same-Sheet Formula
FONT_LINK = Font(name=FONT_NAME, size=10, color=PALETTE["success"])           # Forest Green = Cross-Sheet Link
FONT_TEXT = Font(name=FONT_NAME, size=10, color=PALETTE["charcoal"])
FONT_MUTED = Font(name=FONT_NAME, size=9.5, italic=True, color=PALETTE["stone"])
FONT_TOTAL = Font(name=FONT_NAME, size=10, bold=True, color=PALETTE["primary_dark"])
FONT_BADGE_OK = Font(name=FONT_NAME, size=10, bold=True, color=PALETTE["success"])
FONT_BADGE_WARN = Font(name=FONT_NAME, size=10, bold=True, color=PALETTE["warning"])
FONT_BADGE_ERR = Font(name=FONT_NAME, size=10, bold=True, color=PALETTE["danger"])

FILL_HDR = PatternFill("solid", fgColor=PALETTE["primary"])
FILL_SUBHDR = PatternFill("solid", fgColor=PALETTE["accent"])
FILL_ZEBRA = PatternFill("solid", fgColor=PALETTE["alabaster"])
FILL_WHITE = PatternFill("solid", fgColor=PALETTE["white"])
FILL_INPUT = PatternFill("solid", fgColor=PALETTE["gold_tint"])
FILL_TOTAL = PatternFill("solid", fgColor=PALETTE["primary_tint"])
FILL_SECTION = PatternFill("solid", fgColor=PALETTE["linen"])
FILL_OK = PatternFill("solid", fgColor=PALETTE["success_tint"])
FILL_WARN = PatternFill("solid", fgColor=PALETTE["warning_tint"])
FILL_ERR = PatternFill("solid", fgColor=PALETTE["danger_tint"])

SIDE_THIN = Side(style="thin", color=PALETTE["sand_border"])
SIDE_MED_PRIMARY = Side(style="medium", color=PALETTE["primary"])
SIDE_DOUBLE_PRIMARY = Side(style="double", color=PALETTE["primary"])

BORDER_GRID = Border(left=SIDE_THIN, right=SIDE_THIN, top=SIDE_THIN, bottom=SIDE_THIN)
BORDER_TOTAL = Border(top=SIDE_THIN, bottom=SIDE_DOUBLE_PRIMARY, left=SIDE_THIN, right=SIDE_THIN)
BORDER_HDR = Border(top=SIDE_MED_PRIMARY, bottom=SIDE_MED_PRIMARY, left=SIDE_THIN, right=SIDE_THIN)


def _setup_sheet_header(ws, title: str, subtitle: str, show_grid: bool = True) -> None:
    ws.views.sheetView[0].showGridLines = show_grid
    c1 = ws.cell(row=1, column=1, value=title)
    c1.font = FONT_TITLE
    c2 = ws.cell(row=2, column=1, value=subtitle)
    c2.font = FONT_SUBTITLE
    ws.row_dimensions[1].height = 22
    ws.row_dimensions[2].height = 17
    ws.row_dimensions[3].height = 8


def _write_table_header(ws, row: int, headers: List[str], fill: PatternFill = FILL_HDR) -> None:
    for c_idx, h in enumerate(headers, start=1):
        cell = ws.cell(row=row, column=c_idx, value=h)
        cell.font = FONT_HDR
        cell.fill = fill
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = BORDER_HDR
    ws.row_dimensions[row].height = 26


def _style_data_row(
    ws,
    row: int,
    values: List[Any],
    col_kinds: List[str],
    num_formats: List[Optional[str]],
    is_total: bool = False,
    zebra_idx: int = 0,
) -> None:
    for c_idx, val in enumerate(values, start=1):
        cell = ws.cell(row=row, column=c_idx, value=val)
        kind = col_kinds[c_idx - 1] if c_idx - 1 < len(col_kinds) else "text"
        fmt = num_formats[c_idx - 1] if c_idx - 1 < len(num_formats) else None
        is_formula = isinstance(val, str) and val.startswith("=")

        if is_total:
            cell.font = FONT_TOTAL
            cell.fill = FILL_TOTAL
            cell.border = BORDER_TOTAL
            cell.protection = Protection(locked=True)
        else:
            cell.border = BORDER_GRID
            if kind == "input" and not is_formula:
                cell.font = FONT_INPUT
                cell.fill = FILL_INPUT
                cell.protection = Protection(locked=False)
            elif is_formula:
                cell.font = FONT_LINK if "!" in val else FONT_FORMULA
                cell.fill = FILL_ZEBRA if zebra_idx % 2 == 1 else FILL_WHITE
                cell.protection = Protection(locked=True)
            else:
                cell.font = FONT_TEXT
                cell.fill = FILL_ZEBRA if zebra_idx % 2 == 1 else FILL_WHITE
                cell.protection = Protection(locked=True)

        if fmt:
            cell.number_format = fmt
            if fmt != "@":
                cell.alignment = Alignment(horizontal="right", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")
        elif kind == "center":
            cell.alignment = Alignment(horizontal="center", vertical="center")
        else:
            cell.alignment = Alignment(horizontal="left", vertical="center")
    ws.row_dimensions[row].height = 22 if is_total else 20


def _finalize_sheet(ws, freeze_cell: str = "A5", auto_filter_ref: Optional[str] = None, col_overrides: Optional[Dict[str, float]] = None, print_title_row: int = 4) -> None:
    if freeze_cell:
        ws.freeze_panes = freeze_cell
    if auto_filter_ref:
        ws.auto_filter.ref = auto_filter_ref
    if print_title_row:
        ws.print_title_rows = f"{print_title_row}:{print_title_row}"

    overrides = col_overrides or {}
    for col in ws.columns:
        letter = get_column_letter(col[0].column)
        if letter in overrides:
            ws.column_dimensions[letter].width = float(overrides[letter])
            continue
        max_len = 0
        for cell in col:
            if cell.row <= 2:
                continue
            txt = str(cell.value or "")
            if txt.startswith("="):
                max_len = max(max_len, 16)
            else:
                max_len = max(max_len, len(txt))
        ws.column_dimensions[letter].width = min(max(max_len + 4, 12), 42)

    ws.page_setup.orientation = ws.ORIENTATION_LANDSCAPE
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0


def _add_guide_sheet(wb: Workbook, doc_title: str, doc_code: str, period: str, sheets_desc: List[List[str]], source_note: str) -> None:
    ws = wb.create_sheet("00_Panduan")
    _setup_sheet_header(
        ws,
        f"STOCKFLOW — {doc_title}",
        f"PT Karya Berdua Homeware & Furniture Indonesia | Kode: {doc_code} | {period}",
        show_grid=True,
    )
    _write_table_header(ws, 4, ["Nama Sheet", "Fungsi Utama", "Aturan Operasional & Audit"])
    for idx, row_vals in enumerate(sheets_desc):
        _style_data_row(ws, 5 + idx, row_vals, ["text", "text", "text"], [None, None, None], zebra_idx=idx)

    legend_row = 5 + len(sheets_desc) + 2
    ws.cell(row=legend_row, column=1, value="Konvensi Warna StockFlow (Zero-Blue Craft Palette)").font = FONT_SECTION
    _write_table_header(ws, legend_row + 1, ["Jenis Sel", "Kode Warna StockFlow", "Keterangan Penggunaan"])
    legends = [
        ["Header Tabel", "#1B4332 (Deep Forest Pine)", "Judul kolom resmi — tidak diedit manual"],
        ["Sel Input Manual", "#C2592B teks + #FEF7E6 latar (Warm Terracotta)", "Kolom input/asumsi yang dapat diubah pengguna berwenang"],
        ["Formula Sheet Sama", "#1C1917 (Espresso Charcoal)", "Dihitung otomatis oleh formula Excel — dilarang timpa angka"],
        ["Link Antar Sheet", "#15803D (Forest Green)", "Referensi dinamis dari sheet Parameter atau Data Mentah"],
        ["Baris Total / Ringkasan", "#E8F3EC latar + Double Border (Soft Sage)", "Agregasi SUM/AVERAGE/Check otomatis"],
        ["Peringatan / Kritis", "#B45309 (Ochre) / #B91C1C (Crimson)", "Conditional Formatting otomatis untuk status Restock/Error"],
    ]
    for idx, lg in enumerate(legends):
        _style_data_row(ws, legend_row + 2 + idx, lg, ["text", "text", "text"], [None, None, None], zebra_idx=idx)

    src_row = legend_row + 2 + len(legends) + 1
    ws.cell(row=src_row, column=1, value="Sumber & Kredibilitas Data:").font = FONT_SECTION
    ws.cell(row=src_row + 1, column=1, value=source_note).font = FONT_MUTED
    ws.cell(row=src_row + 2, column=1, value="Standar Referensi: PSAK (IAI), PMK 131/2024 (PPN DPP 11/12), PP 58/2023 (PPh 21 TER), & Sistem ERP StockFlow [DATA SIMULASI].").font = FONT_MUTED

    _finalize_sheet(ws, freeze_cell="A5", col_overrides={"A": 28, "B": 44, "C": 58}, print_title_row=4)


def _apply_zero_blue_bar_chart(ws, title: str, data_ref: Reference, cats_ref: Reference, anchor: str, horizontal: bool = False) -> None:
    chart = BarChart()
    chart.type = "bar" if horizontal else "col"
    chart.grouping = "clustered"
    chart.title = title
    chart.width = 16.5
    chart.height = 10.0
    chart.add_data(data_ref, titles_from_data=True)
    chart.set_categories(cats_ref)
    chart.legend.position = "b"
    for idx, series in enumerate(chart.series):
        col_hex = CHART_SERIES_HEX[idx % len(CHART_SERIES_HEX)]
        series.graphicalProperties.solidFill = col_hex
        series.graphicalProperties.line.solidFill = col_hex
    ws.add_chart(chart, anchor)


# =============================================================================
# 1. INVENTORY VALUATION REPORT (.XLSX)
# =============================================================================

def build_inventory_xlsx(out_path: str | Path, data: Optional[dict] = None) -> Path:
    d = data or get_inventory_data()
    items = d["items"]
    warehouses = d["warehouses"]

    wb = Workbook()
    default_ws = wb.active

    _add_guide_sheet(
        wb,
        doc_title="LAPORAN VALUASI PERSEDIAAN MULTI-GUDANG (WAC & REORDER POINT)",
        doc_code=d.get("report_code", "SF/INV/2026/Q1-001"),
        period=d.get("period", "Per 31 Maret 2026"),
        sheets_desc=[
            ["01_Dashboard", "Ringkasan KPI & Valuasi per Gudang", "Read-only — seluruh metrik ditarik via SUMIF/COUNTIF dari sheet 03"],
            ["02_Parameter", "Faktor Peringatan ROP & Target Margin", "Ubah sel berlatar krem; otomatis memperbarui status seluruh SKU"],
            ["03_Inventory_Stock", "Rincian Stok, WAC, Margin & ROP per SKU", "Flat table bebas merge; kolom I, K, M, Q, R berformula hidup"],
            ["05_Audit_Control", "Panel Kontrol Integritas & Anti-Stok Negatif", "Seluruh indikator wajib berstatus OK (Selisih = 0, Negatif = 0)"],
        ],
        source_note="Sumber: Database Persediaan StockFlow ERP (Weighted Average Cost / PSAK 14) — Data Simulasi Furnitur & Homeware 2026.",
    )

    # --- 01_Dashboard ---
    ws_dash = wb.create_sheet("01_Dashboard")
    _setup_sheet_header(
        ws_dash,
        "DASHBOARD VALUASI PERSEDIAAN & KESEHATAN STOK",
        f"{d['company']['legal_name']} | {d['period']} | Metode Penilaian: Weighted Average Cost (WAC)",
        show_grid=False,
    )
    _write_table_header(ws_dash, 4, ["Kode Gudang", "Nama Gudang", "Jumlah SKU", "Total Unit", "Nilai Persediaan WAC (Rp)", "Kontribusi (%)"])
    n_items = len(items)
    last_item_row = 4 + n_items
    wh_start = 5
    for idx, wh in enumerate(warehouses):
        r = wh_start + idx
        wh_tot_row = wh_start + len(warehouses)
        vals = [
            wh["code"],
            wh["name"],
            f"=COUNTIF('03_Inventory_Stock'!$D$5:$D${last_item_row},A{r})",
            f"=SUMIF('03_Inventory_Stock'!$D$5:$D${last_item_row},A{r},'03_Inventory_Stock'!$I$5:$I${last_item_row})",
            f"=SUMIF('03_Inventory_Stock'!$D$5:$D${last_item_row},A{r},'03_Inventory_Stock'!$K$5:$K${last_item_row})",
            f"=IF($E${wh_tot_row}=0,0,E{r}/$E${wh_tot_row})",
        ]
        _style_data_row(ws_dash, r, vals, ["center", "text", "formula", "formula", "formula", "formula"], ["@", None, FMT_INT, FMT_INT, FMT_IDR, FMT_PCT], zebra_idx=idx)

    wh_tot_row = wh_start + len(warehouses)
    _style_data_row(
        ws_dash,
        wh_tot_row,
        [
            "TOTAL",
            "Seluruh Gudang & Showroom",
            f"=SUM(C{wh_start}:C{wh_tot_row - 1})",
            f"=SUM(D{wh_start}:D{wh_tot_row - 1})",
            f"=SUM(E{wh_start}:E{wh_tot_row - 1})",
            f"=SUM(F{wh_start}:F{wh_tot_row - 1})",
        ],
        ["center", "text", "formula", "formula", "formula", "formula"],
        [None, None, FMT_INT, FMT_INT, FMT_IDR, FMT_PCT],
        is_total=True,
    )

    kpi_hdr_row = wh_tot_row + 3
    ws_dash.cell(row=kpi_hdr_row - 1, column=1, value="RINGKASAN KPI EKSEKUTIF PERSEDIAAN").font = FONT_SECTION
    _write_table_header(ws_dash, kpi_hdr_row, ["Indikator KPI", "Nilai Aktual", "Keterangan / Formula"])
    tot_inv_row = last_item_row + 1
    kpis = [
        ["Total SKU Aktif", f"=COUNTA('03_Inventory_Stock'!A5:A{last_item_row})", FMT_INT, "Jumlah katalog produk furnitur & homeware"],
        ["Total Unit Tersedia", f"='03_Inventory_Stock'!I{tot_inv_row}", FMT_INT, "Akumulasi stok akhir di 4 lokasi"],
        ["Total Nilai Persediaan (WAC)", f"='03_Inventory_Stock'!K{tot_inv_row}", FMT_IDR, "Valuasi Weighted Average Cost"],
        ["Rata-rata Gross Margin", f"='03_Inventory_Stock'!M{tot_inv_row}", FMT_PCT, "Perbandingan harga jual vs biaya WAC"],
        ["SKU Status RESTOCK SEGERA", f"=COUNTIF('03_Inventory_Stock'!R5:R{last_item_row},\"RESTOCK SEGERA\")", FMT_INT, "Stok Akhir <= Reorder Point (ROP)"],
        ["SKU Status PANTAU", f"=COUNTIF('03_Inventory_Stock'!R5:R{last_item_row},\"PANTAU\")", FMT_INT, "Stok Akhir <= 125% x ROP"],
        ["SKU Status AMAN", f"=COUNTIF('03_Inventory_Stock'!R5:R{last_item_row},\"AMAN\")", FMT_INT, "Stok Akhir di atas ambang aman"],
    ]
    for idx, (lbl, formula, fmt, note) in enumerate(kpis):
        _style_data_row(ws_dash, kpi_hdr_row + 1 + idx, [lbl, formula, note], ["text", "formula", "text"], [None, fmt, None], zebra_idx=idx)

    # Native zero-blue Bar Chart on Dashboard
    _apply_zero_blue_bar_chart(
        ws_dash,
        title="Nilai Persediaan WAC per Gudang (Rp)",
        data_ref=Reference(ws_dash, min_col=5, min_row=4, max_col=5, max_row=wh_tot_row - 1),
        cats_ref=Reference(ws_dash, min_col=2, min_row=wh_start, max_col=2, max_row=wh_tot_row - 1),
        anchor="H4",
        horizontal=False,
    )
    _finalize_sheet(ws_dash, freeze_cell="A5", col_overrides={"A": 24, "B": 32, "C": 16, "D": 14, "E": 26, "F": 16})

    # --- 02_Parameter ---
    ws_param = wb.create_sheet("02_Parameter")
    _setup_sheet_header(ws_param, "PARAMETER KONTROL PERSEDIAAN & REORDER POINT", "Ubah sel input berlatar krem (Terracotta) untuk simulasi ambang stok.")
    _write_table_header(ws_param, 4, ["Nama Parameter", "Nilai", "Satuan / Penjelasan"])
    params = [
        ["Faktor Peringatan Pantau (Multiplier ROP)", 1.25, FMT_DEC, "Stok <= 1,25 x ROP masuk status PANTAU"],
        ["Target Gross Margin Minimal", 0.35, FMT_PCT, "Ambang kesehatan margin ritel furnitur & homeware"],
        ["Tarif PPN Efektif (PMK 131/2024)", 0.11, FMT_PCT, "12% x DPP Nilai Lain (11/12) = 11%"],
        ["Batas Minimum Stok (Anti-Negative Policy)", 0, FMT_INT, "Sistem menolak transaksi stok keluar jika stok < 0"],
    ]
    for idx, (nm, val, fmt, desc) in enumerate(params):
        _style_data_row(ws_param, 5 + idx, [nm, val, desc], ["text", "input", "text"], [None, fmt, None], zebra_idx=idx)
    wb.defined_names.add(DefinedName(name="SF_WARN_FACTOR", attr_text="'02_Parameter'!$B$5"))
    wb.defined_names.add(DefinedName(name="SF_TARGET_MARGIN", attr_text="'02_Parameter'!$B$6"))
    _finalize_sheet(ws_param, freeze_cell="A5", col_overrides={"A": 40, "B": 16, "C": 52})

    # --- 03_Inventory_Stock ---
    ws_inv = wb.create_sheet("03_Inventory_Stock")
    _setup_sheet_header(
        ws_inv,
        "RINCIAN STOK, VALUASI WAC & REORDER POINT PER SKU",
        "Formula aktif: Stok Akhir = Awal + Masuk - Keluar | Nilai WAC = Stok Akhir x WAC | ROP = ROUND(AvgDemand x LeadTime + SafetyStock, 0)",
    )
    inv_headers = [
        "SKU", "Nama Produk Furnitur & Homeware", "Kategori", "Gudang", "Satuan",
        "Stok Awal", "Stok Masuk", "Stok Keluar", "Stok Akhir",
        "Biaya WAC (Rp)", "Nilai Persediaan (Rp)", "Harga Jual (Rp)", "Gross Margin (%)",
        "Avg Demand/Hari", "Lead Time (Hari)", "Safety Stock", "Reorder Point (ROP)", "Status Stok",
    ]
    inv_kinds = [
        "center", "text", "text", "center", "center",
        "input", "input", "input", "formula",
        "input", "formula", "input", "formula",
        "input", "input", "input", "formula", "center",
    ]
    inv_fmts = [
        "@", None, None, "@", None,
        FMT_INT, FMT_INT, FMT_INT, FMT_INT,
        FMT_IDR, FMT_IDR, FMT_IDR, FMT_PCT,
        FMT_DEC, FMT_INT, FMT_INT, FMT_INT, None,
    ]
    _write_table_header(ws_inv, 4, inv_headers)

    for idx, it in enumerate(items):
        r = 5 + idx
        row_vals = [
            it["sku"], it["name"], it["category"], it["warehouse"], it["unit"],
            it["opening_qty"], it["stock_in"], it["stock_out"], f"=F{r}+G{r}-H{r}",
            it["wac_cost"], f"=I{r}*J{r}", it["sell_price"], f"=IF(L{r}=0,0,(L{r}-J{r})/L{r})",
            it["avg_daily_demand"], it["lead_time_days"], it["safety_stock"],
            f"=ROUND(N{r}*O{r}+P{r},0)",
            f"=IF(I{r}<=Q{r},\"RESTOCK SEGERA\",IF(I{r}<=ROUND(Q{r}*'02_Parameter'!$B$5,0),\"PANTAU\",\"AMAN\"))",
        ]
        _style_data_row(ws_inv, r, row_vals, inv_kinds, inv_fmts, zebra_idx=idx)

    # Total row
    tot_r = 5 + n_items
    _style_data_row(
        ws_inv,
        tot_r,
        [
            "TOTAL", f"{n_items} SKU Aktif", "-", "4 Gudang", "-",
            f"=SUM(F5:F{last_item_row})",
            f"=SUM(G5:G{last_item_row})",
            f"=SUM(H5:H{last_item_row})",
            f"=SUM(I5:I{last_item_row})",
            f"=IF(I{tot_r}=0,0,K{tot_r}/I{tot_r})",
            f"=SUM(K5:K{last_item_row})",
            f"=AVERAGE(L5:L{last_item_row})",
            f"=AVERAGE(M5:M{last_item_row})",
            f"=AVERAGE(N5:N{last_item_row})",
            f"=AVERAGE(O5:O{last_item_row})",
            f"=SUM(P5:P{last_item_row})",
            f"=SUM(Q5:Q{last_item_row})",
            f"=COUNTIF(R5:R{last_item_row},\"RESTOCK SEGERA\")&\" Perlu Restock\"",
        ],
        inv_kinds,
        inv_fmts,
        is_total=True,
    )

    # Data Validation for Warehouse codes & Conditional Formatting for Stock Status
    wh_list = ",".join(w["code"] for w in warehouses)
    dv_wh = DataValidation(type="list", formula1=f'"{wh_list}"', allow_blank=False)
    ws_inv.add_data_validation(dv_wh)
    dv_wh.add(f"D5:D{last_item_row}")

    ws_inv.conditional_formatting.add(
        f"R5:R{last_item_row}",
        CellIsRule(operator="equal", formula=['"RESTOCK SEGERA"'], fill=FILL_ERR, font=FONT_BADGE_ERR),
    )
    ws_inv.conditional_formatting.add(
        f"R5:R{last_item_row}",
        CellIsRule(operator="equal", formula=['"PANTAU"'], fill=FILL_WARN, font=FONT_BADGE_WARN),
    )
    ws_inv.conditional_formatting.add(
        f"R5:R{last_item_row}",
        CellIsRule(operator="equal", formula=['"AMAN"'], fill=FILL_OK, font=FONT_BADGE_OK),
    )
    _finalize_sheet(
        ws_inv,
        freeze_cell="C5",
        auto_filter_ref=f"A4:R{last_item_row}",
        col_overrides={"A": 14, "B": 36, "C": 18, "D": 13, "E": 9, "K": 22, "J": 18, "L": 18, "R": 18},
    )

    # --- 05_Audit_Control ---
    ws_aud = wb.create_sheet("05_Audit_Control")
    _setup_sheet_header(ws_aud, "AUDIT CONTROL CHECK — INTEGRITAS DATA PERSEDIAAN", "Verifikasi otomatis konsistensi antar sheet, stok non-negatif, dan keunikan SKU.")
    _write_table_header(ws_aud, 4, ["No", "Pemeriksaan Kontrol", "Nilai Selisih / Temuan", "Status Audit", "Kriteria Lulus"])
    audits = [
        [1, "Rekonsiliasi Total Nilai Persediaan (Dashboard vs Detail SKU)", f"=ABS('01_Dashboard'!E{wh_tot_row}-'03_Inventory_Stock'!K{tot_inv_row})", '=IF(C5<0.01,"OK","CEK")', "Selisih < Rp 0,01"],
        [2, "Rekonsiliasi Total Unit Persediaan (Dashboard vs Detail SKU)", f"=ABS('01_Dashboard'!D{wh_tot_row}-'03_Inventory_Stock'!I{tot_inv_row})", '=IF(C6=0,"OK","CEK")', "Selisih = 0 unit"],
        [3, "Kebijakan Anti-Stok Negatif (Zero Negative Stock)", f"=COUNTIF('03_Inventory_Stock'!I5:I{last_item_row},\"<0\")", '=IF(C7=0,"OK","CEK")', "0 SKU bersaldo negatif"],
        [4, "Keunikan Kode SKU (Zero Duplicate SKU)", f"=SUMPRODUCT(--(COUNTIF('03_Inventory_Stock'!A5:A{last_item_row},'03_Inventory_Stock'!A5:A{last_item_row})>1))", '=IF(C8=0,"OK","CEK")', "0 SKU duplikat"],
        [5, "Validasi Margin Kotor Positif (Harga Jual > WAC)", f"=COUNTIF('03_Inventory_Stock'!M5:M{last_item_row},\"<=0\")", '=IF(C9=0,"OK","CEK")', "0 SKU margin negatif/nol"],
    ]
    for idx, row_vals in enumerate(audits):
        _style_data_row(ws_aud, 5 + idx, row_vals, ["center", "text", "formula", "center", "text"], [FMT_INT, None, FMT_DEC, None, None], zebra_idx=idx)
    ws_aud.conditional_formatting.add("D5:D9", CellIsRule(operator="equal", formula=['"OK"'], fill=FILL_OK, font=FONT_BADGE_OK))
    ws_aud.conditional_formatting.add("D5:D9", CellIsRule(operator="notEqual", formula=['"OK"'], fill=FILL_ERR, font=FONT_BADGE_ERR))
    _finalize_sheet(ws_aud, freeze_cell="A5", col_overrides={"A": 8, "B": 52, "C": 22, "D": 16, "E": 28})

    wb.remove(default_ws)
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    wb.save(out)
    patch_ooxml_zero_blue_theme(out)
    return out


# =============================================================================
# 2. FINANCIAL STATEMENTS 2026 (.XLSX) — MULTI-SHEET DOUBLE-ENTRY LIVE FORMULAS
# =============================================================================

def build_financial_xlsx(out_path: str | Path, data: Optional[dict] = None) -> Path:
    d = data or get_financial_data()
    tb = d["trial_balance"]
    cf = d["cash_flow"]

    wb = Workbook()
    default_ws = wb.active

    _add_guide_sheet(
        wb,
        doc_title="LAPORAN KEUANGAN TERINTEGRASI 2026 (DOUBLE-ENTRY ACCOUNTING)",
        doc_code=d.get("report_code", "SF/FIN/2026/Q1-002"),
        period=d.get("period", "Q1 2026"),
        sheets_desc=[
            ["01_Trial_Balance", "Neraca Saldo (Chart of Accounts 1xxx–7xxx)", "Sumber tunggal seluruh laporan; Debit == Kredit otomatis dicek"],
            ["02_Income_Statement", "Laporan Laba Rugi (Income Statement)", "100% formula SUMIF dari Trial Balance + rasio margin laba"],
            ["03_Balance_Sheet", "Laporan Posisi Keuangan (Neraca)", "Menarik Laba Tahun Berjalan dari Laba Rugi; cek Aset - (Liab + Ekuitas) = 0"],
            ["04_Cash_Flow", "Laporan Arus Kas (Direct Method)", "Aktivitas Operasi, Investasi, Pendanaan & rekonsiliasi kas Neraca"],
            ["05_Audit_Control", "Audit Double-Entry & Rekonsiliasi Lintas Laporan", "Memastikan 4 invarian akuntansi bernilai 0 dan berstatus OK"],
        ],
        source_note="Sumber: Buku Besar Double-Entry StockFlow ERP (PSAK 1 Penyajian Laporan Keuangan) — Data Simulasi Q1 2026.",
    )

    # --- 01_Trial_Balance ---
    ws_tb = wb.create_sheet("01_Trial_Balance")
    _setup_sheet_header(ws_tb, "NERACA SALDO (TRIAL BALANCE)", f"{d['company']['legal_name']} | {d['period']} | Dalam Rupiah (IDR)")
    _write_table_header(ws_tb, 4, ["Kode COA", "Nama Akun", "Kategori Laporan", "Saldo Debit (Rp)", "Saldo Kredit (Rp)"])
    for idx, acc in enumerate(tb):
        r = 5 + idx
        _style_data_row(
            ws_tb,
            r,
            [acc["code"], acc["name"], acc["category"], acc["debit"], acc["credit"]],
            ["center", "text", "text", "input", "input"],
            ["@", None, None, FMT_IDR, FMT_IDR],
            zebra_idx=idx,
        )
    tb_last = 4 + len(tb)
    tb_tot = tb_last + 1
    _style_data_row(
        ws_tb,
        tb_tot,
        ["TOTAL", "Total Neraca Saldo (Debit == Kredit)", "Balance Check", f"=SUM(D5:D{tb_last})", f"=SUM(E5:E{tb_last})"],
        ["center", "text", "center", "formula", "formula"],
        [None, None, None, FMT_IDR, FMT_IDR],
        is_total=True,
    )
    tb_chk = tb_tot + 1
    _style_data_row(
        ws_tb,
        tb_chk,
        ["CHECK", "Selisih Debit - Kredit (Wajib Rp 0)", f"=IF(ABS(D{tb_chk})<0.01,\"SEIMBANG\",\"SELISIH\")", f"=D{tb_tot}-E{tb_tot}", ""],
        ["center", "text", "center", "formula", "text"],
        [None, None, None, FMT_IDR, None],
        is_total=False,
    )
    ws_tb.conditional_formatting.add(f"C{tb_chk}:C{tb_chk}", CellIsRule(operator="equal", formula=['"SEIMBANG"'], fill=FILL_OK, font=FONT_BADGE_OK))
    ws_tb.conditional_formatting.add(f"C{tb_chk}:C{tb_chk}", CellIsRule(operator="notEqual", formula=['"SEIMBANG"'], fill=FILL_ERR, font=FONT_BADGE_ERR))
    _finalize_sheet(ws_tb, freeze_cell="A5", auto_filter_ref=f"A4:E{tb_last}", col_overrides={"A": 13, "B": 44, "C": 24, "D": 22, "E": 22})

    # Helper to pull credit or debit from Trial Balance via SUMIF
    tb_code_rng = f"'01_Trial_Balance'!$A$5:$A${tb_last}"
    tb_deb_rng = f"'01_Trial_Balance'!$D$5:$D${tb_last}"
    tb_crd_rng = f"'01_Trial_Balance'!$E$5:$E${tb_last}"

    def tb_crd(code: str) -> str:
        return f"=SUMIF({tb_code_rng},\"{code}\",{tb_crd_rng})"

    def tb_deb(code: str) -> str:
        return f"=SUMIF({tb_code_rng},\"{code}\",{tb_deb_rng})"

    # --- 02_Income_Statement (Laba Rugi) ---
    ws_is = wb.create_sheet("02_Income_Statement")
    _setup_sheet_header(ws_is, "LAPORAN LABA RUGI (INCOME STATEMENT)", f"{d['company']['legal_name']} | {d['period']} | Seluruh angka terhubung dinamis ke Trial Balance")
    _write_table_header(ws_is, 4, ["Kode COA", "Komponen Laba Rugi", "Nominal Q1 2026 (Rp)", "% dari Net Sales"])

    is_rows = [
        # (row_num, coa, label, formula_c, formula_d, is_total)
        (5, "4101", "Penjualan Kotor Furnitur & Homeware", tb_crd("4101"), "=IF($C$8=0,0,C5/$C$8)", False),
        (6, "4102", "(-) Retur Penjualan", f"=-SUMIF({tb_code_rng},\"4102\",{tb_deb_rng})", "=IF($C$8=0,0,C6/$C$8)", False),
        (7, "4103", "(-) Diskon & Potongan Penjualan", f"=-SUMIF({tb_code_rng},\"4103\",{tb_deb_rng})", "=IF($C$8=0,0,C7/$C$8)", False),
        (8, "SUBTOTAL", "PENJUALAN BERSIH (NET SALES)", "=SUM(C5:C7)", "=IF($C$8=0,0,C8/$C$8)", True),
        (9, "5101", "(-) Harga Pokok Penjualan (COGS — WAC)", f"=-SUMIF({tb_code_rng},\"5101\",{tb_deb_rng})", "=IF($C$8=0,0,C9/$C$8)", False),
        (10, "SUBTOTAL", "LABA KOTOR (GROSS PROFIT)", "=C8+C9", "=IF($C$8=0,0,C10/$C$8)", True),
        (11, "6101", "Beban Gaji, Tunjangan & Lembur", tb_deb("6101"), "=IF($C$8=0,0,C11/$C$8)", False),
        (12, "6102", "Beban BPJS Ditanggung Perusahaan", tb_deb("6102"), "=IF($C$8=0,0,C12/$C$8)", False),
        (13, "6103", "Beban Sewa Gudang & Showroom", tb_deb("6103"), "=IF($C$8=0,0,C13/$C$8)", False),
        (14, "6104", "Beban Listrik, Air & Internet", tb_deb("6104"), "=IF($C$8=0,0,C14/$C$8)", False),
        (15, "6105", "Beban Logistik & Pengiriman", tb_deb("6105"), "=IF($C$8=0,0,C15/$C$8)", False),
        (16, "6106", "Beban Pemasaran & Katalog Digital", tb_deb("6106"), "=IF($C$8=0,0,C16/$C$8)", False),
        (17, "6107", "Beban Penyusutan Aset Tetap", tb_deb("6107"), "=IF($C$8=0,0,C17/$C$8)", False),
        (18, "SUBTOTAL", "TOTAL BEBAN OPERASIONAL (OPEX)", "=SUM(C11:C17)", "=IF($C$8=0,0,C18/$C$8)", True),
        (19, "SUBTOTAL", "LABA OPERASIONAL (EBIT)", "=C10-C18", "=IF($C$8=0,0,C19/$C$8)", True),
        (20, "7101", "(+) Pendapatan Jasa Giro & Lain-lain", tb_crd("7101"), "=IF($C$8=0,0,C20/$C$8)", False),
        (21, "7201", "(-) Beban Bunga Pinjaman Bank", f"=-SUMIF({tb_code_rng},\"7201\",{tb_deb_rng})", "=IF($C$8=0,0,C21/$C$8)", False),
        (22, "SUBTOTAL", "LABA SEBELUM PAJAK (EBT)", "=C19+C20+C21", "=IF($C$8=0,0,C22/$C$8)", True),
        (23, "7301", "(-) Estimasi Beban PPh Badan", f"=-SUMIF({tb_code_rng},\"7301\",{tb_deb_rng})", "=IF($C$8=0,0,C23/$C$8)", False),
        (24, "TOTAL", "LABA BERSIH PERIODE BERJALAN (NET PROFIT)", "=C22+C23", "=IF($C$8=0,0,C24/$C$8)", True),
    ]
    for r, coa, lbl, fc, fd, is_tot in is_rows:
        _style_data_row(ws_is, r, [coa, lbl, fc, fd], ["center", "text", "formula", "formula"], ["@", None, FMT_IDR, FMT_PCT], is_total=is_tot, zebra_idx=r)

    # Mini summary table for native chart (columns F-G, rows 4-8)
    _write_table_header(ws_is, 4, ["Kode COA", "Komponen Laba Rugi", "Nominal Q1 2026 (Rp)", "% dari Net Sales"])
    ws_is.cell(row=4, column=6, value="Ringkasan Profitabilitas").font = FONT_HDR
    ws_is.cell(row=4, column=6).fill = FILL_HDR
    ws_is.cell(row=4, column=7, value="Nilai (Rp)").font = FONT_HDR
    ws_is.cell(row=4, column=7).fill = FILL_HDR
    chart_rows = [
        ("Penjualan Bersih", "=C8"),
        ("Laba Kotor", "=C10"),
        ("Laba Operasional", "=C19"),
        ("Laba Bersih", "=C24"),
    ]
    for idx, (clbl, cfrm) in enumerate(chart_rows):
        rr = 5 + idx
        c_l = ws_is.cell(row=rr, column=6, value=clbl)
        c_l.font = FONT_TEXT
        c_l.border = BORDER_GRID
        c_v = ws_is.cell(row=rr, column=7, value=cfrm)
        c_v.font = FONT_FORMULA
        c_v.number_format = FMT_IDR
        c_v.border = BORDER_GRID

    _apply_zero_blue_bar_chart(
        ws_is,
        title="Waterfall Profitabilitas StockFlow Q1 2026 (Rp)",
        data_ref=Reference(ws_is, min_col=7, min_row=4, max_col=7, max_row=8),
        cats_ref=Reference(ws_is, min_col=6, min_row=5, max_col=6, max_row=8),
        anchor="F10",
    )
    _finalize_sheet(ws_is, freeze_cell="A5", col_overrides={"A": 13, "B": 44, "C": 24, "D": 18, "E": 4, "F": 24, "G": 22})

    # --- 03_Balance_Sheet (Neraca) ---
    ws_bs = wb.create_sheet("03_Balance_Sheet")
    _setup_sheet_header(ws_bs, "LAPORAN POSISI KEUANGAN (NERACA / BALANCE SHEET)", f"{d['company']['legal_name']} | Per 31 Maret 2026 | Persamaan: Aset = Liabilitas + Ekuitas")
    _write_table_header(ws_bs, 4, ["Kode COA", "Pos Neraca", "Saldo Per 31 Mar 2026 (Rp)", "Komposisi (%)"])

    bs_rows = [
        (5, "1101", "Kas & Setara Kas", tb_deb("1101"), "=IF($C$13=0,0,C5/$C$13)", False),
        (6, "1102", "Bank Operasional (Mandiri & BCA)", tb_deb("1102"), "=IF($C$13=0,0,C6/$C$13)", False),
        (7, "1103", "Piutang Usaha (AR)", tb_deb("1103"), "=IF($C$13=0,0,C7/$C$13)", False),
        (8, "1104", "Persediaan Barang Dagang (WAC)", tb_deb("1104"), "=IF($C$13=0,0,C8/$C$13)", False),
        (9, "1105", "PPN Masukan & Biaya Dibayar Dimuka", tb_deb("1105"), "=IF($C$13=0,0,C9/$C$13)", False),
        (10, "SUBTOTAL", "TOTAL ASET LANCAR", "=SUM(C5:C9)", "=IF($C$13=0,0,C10/$C$13)", True),
        (11, "1201", "Aset Tetap (Gudang, Rak, Kendaraan)", tb_deb("1201"), "=IF($C$13=0,0,C11/$C$13)", False),
        (12, "1209", "(-) Akumulasi Penyusutan Aset Tetap", f"=-SUMIF({tb_code_rng},\"1209\",{tb_crd_rng})", "=IF($C$13=0,0,C12/$C$13)", False),
        (13, "TOTAL", "TOTAL ASET (ASSETS)", "=C10+C11+C12", "=IF($C$13=0,0,C13/$C$13)", True),
        (15, "2101", "Utang Usaha Supplier (AP)", tb_crd("2101"), "=IF($C$27=0,0,C15/$C$27)", False),
        (16, "2102", "Utang PPN Keluaran & PPh 21", tb_crd("2102"), "=IF($C$27=0,0,C16/$C$27)", False),
        (17, "2103", "Utang Pajak Penghasilan Badan", tb_crd("2103"), "=IF($C$27=0,0,C17/$C$27)", False),
        (18, "2104", "Beban Akrual & Utang BPJS", tb_crd("2104"), "=IF($C$27=0,0,C18/$C$27)", False),
        (19, "SUBTOTAL", "TOTAL LIABILITAS LANCAR", "=SUM(C15:C18)", "=IF($C$27=0,0,C19/$C$27)", True),
        (20, "2201", "Pinjaman Bank Jangka Panjang", tb_crd("2201"), "=IF($C$27=0,0,C20/$C$27)", False),
        (21, "SUBTOTAL", "TOTAL LIABILITAS (LIABILITIES)", "=C19+C20", "=IF($C$27=0,0,C21/$C$27)", True),
        (23, "3101", "Modal Disetor Pemilik", tb_crd("3101"), "=IF($C$27=0,0,C23/$C$27)", False),
        (24, "3201", "Saldo Laba Ditahan (Awal Tahun)", tb_crd("3201"), "=IF($C$27=0,0,C24/$C$27)", False),
        (25, "3301", "Laba Bersih Tahun Berjalan (Link Laba Rugi)", "='02_Income_Statement'!C24", "=IF($C$27=0,0,C25/$C$27)", False),
        (26, "SUBTOTAL", "TOTAL EKUITAS (EQUITY)", "=SUM(C23:C25)", "=IF($C$27=0,0,C26/$C$27)", True),
        (27, "TOTAL", "TOTAL LIABILITAS & EKUITAS", "=C21+C26", "=IF($C$27=0,0,C27/$C$27)", True),
        (29, "CHECK", "BALANCE CHECK: Assets - (Liabilities + Equity)", "=C13-(C21+C26)", '=IF(ABS(C29)<0.01,"SEIMBANG","TIDAK SEIMBANG")', True),
    ]
    for r, coa, lbl, fc, fd, is_tot in bs_rows:
        fmt_d = None if r == 29 else FMT_PCT
        kind_d = "center" if r == 29 else "formula"
        _style_data_row(ws_bs, r, [coa, lbl, fc, fd], ["center", "text", "formula", kind_d], ["@", None, FMT_IDR, fmt_d], is_total=is_tot, zebra_idx=r)

    ws_bs.conditional_formatting.add("D29:D29", CellIsRule(operator="equal", formula=['"SEIMBANG"'], fill=FILL_OK, font=FONT_BADGE_OK))
    ws_bs.conditional_formatting.add("D29:D29", CellIsRule(operator="notEqual", formula=['"SEIMBANG"'], fill=FILL_ERR, font=FONT_BADGE_ERR))
    _finalize_sheet(ws_bs, freeze_cell="A5", col_overrides={"A": 13, "B": 46, "C": 25, "D": 20})

    # --- 04_Cash_Flow (Arus Kas) ---
    ws_cf = wb.create_sheet("04_Cash_Flow")
    _setup_sheet_header(ws_cf, "LAPORAN ARUS KAS (CASH FLOW STATEMENT)", f"{d['company']['legal_name']} | {d['period']} | Metode Langsung & Rekonsiliasi Neraca")
    _write_table_header(ws_cf, 4, ["Kategori", "Uraian Aktivitas Arus Kas", "Arus Kas Q1 2026 (Rp)"])

    r = 5
    op_start = r
    for it in cf["operating"]:
        _style_data_row(ws_cf, r, ["Operasi", it["item"], it["amount"]], ["center", "text", "input"], [None, None, FMT_IDR], zebra_idx=r)
        r += 1
    op_tot_r = r
    _style_data_row(ws_cf, op_tot_r, ["SUBTOTAL", "Arus Kas Bersih dari Aktivitas Operasi", f"=SUM(C{op_start}:C{op_tot_r - 1})"], ["center", "text", "formula"], [None, None, FMT_IDR], is_total=True)

    r = op_tot_r + 2
    inv_start = r
    for it in cf["investing"]:
        _style_data_row(ws_cf, r, ["Investasi", it["item"], it["amount"]], ["center", "text", "input"], [None, None, FMT_IDR], zebra_idx=r)
        r += 1
    inv_tot_r = r
    _style_data_row(ws_cf, inv_tot_r, ["SUBTOTAL", "Arus Kas Bersih dari Aktivitas Investasi", f"=SUM(C{inv_start}:C{inv_tot_r - 1})"], ["center", "text", "formula"], [None, None, FMT_IDR], is_total=True)

    r = inv_tot_r + 2
    fin_start = r
    for it in cf["financing"]:
        _style_data_row(ws_cf, r, ["Pendanaan", it["item"], it["amount"]], ["center", "text", "input"], [None, None, FMT_IDR], zebra_idx=r)
        r += 1
    fin_tot_r = r
    _style_data_row(ws_cf, fin_tot_r, ["SUBTOTAL", "Arus Kas Bersih dari Aktivitas Pendanaan", f"=SUM(C{fin_start}:C{fin_tot_r - 1})"], ["center", "text", "formula"], [None, None, FMT_IDR], is_total=True)

    net_cf_r = fin_tot_r + 2
    open_r = net_cf_r + 1
    end_r = open_r + 1
    bs_cash_r = end_r + 1
    diff_r = bs_cash_r + 1

    _style_data_row(ws_cf, net_cf_r, ["RINGKASAN", "Kenaikan / (Penurunan) Bersih Kas & Bank", f"=C{op_tot_r}+C{inv_tot_r}+C{fin_tot_r}"], ["center", "text", "formula"], [None, None, FMT_IDR], is_total=True)
    _style_data_row(ws_cf, open_r, ["SALDO AWAL", "Saldo Kas & Bank Awal Periode (1 Jan 2026)", cf["opening_cash"]], ["center", "text", "input"], [None, None, FMT_IDR])
    _style_data_row(ws_cf, end_r, ["SALDO AKHIR", "Saldo Kas & Bank Akhir Periode (31 Mar 2026)", f"=C{net_cf_r}+C{open_r}"], ["center", "text", "formula"], [None, None, FMT_IDR], is_total=True)
    _style_data_row(ws_cf, bs_cash_r, ["NERACA", "Saldo Kas & Bank menurut Neraca (1101 + 1102)", "='03_Balance_Sheet'!C5+'03_Balance_Sheet'!C6"], ["center", "text", "formula"], [None, None, FMT_IDR])
    _style_data_row(ws_cf, diff_r, ["CHECK", "Selisih Rekonsiliasi Arus Kas vs Neraca (Wajib 0)", f"=C{end_r}-C{bs_cash_r}"], ["center", "text", "formula"], [None, None, FMT_IDR], is_total=True)

    _finalize_sheet(ws_cf, freeze_cell="A5", col_overrides={"A": 16, "B": 56, "C": 25})

    # --- 05_Audit_Control ---
    ws_aud = wb.create_sheet("05_Audit_Control")
    _setup_sheet_header(ws_aud, "AUDIT CONTROL CHECK — INVARIAN AKUNTANSI DOUBLE-ENTRY", "Memastikan Neraca Saldo, Laba Rugi, Neraca, dan Arus Kas 100% seimbang.")
    _write_table_header(ws_aud, 4, ["No", "Invarian Akuntansi", "Nilai Pemeriksaan", "Status", "Standar Lulus"])
    fin_checks = [
        [1, "Trial Balance: Total Debit - Total Kredit", f"='01_Trial_Balance'!D{tb_chk}", '=IF(ABS(C5)<0.01,"OK","CEK")', "Selisih = Rp 0"],
        [2, "Balance Sheet: Assets - (Liabilities + Equity)", "='03_Balance_Sheet'!C29", '=IF(ABS(C6)<0.01,"OK","CEK")', "Selisih = Rp 0"],
        [3, "Cash Flow: Kas Akhir Arus Kas - Kas & Bank Neraca", f"='04_Cash_Flow'!C{diff_r}", '=IF(ABS(C7)<0.01,"OK","CEK")', "Selisih = Rp 0"],
        [4, "Net Profit Margin (Laba Bersih / Penjualan Bersih)", "='02_Income_Statement'!D24", '=IF(C8>0,"OK","CEK")', "Profitabilitas > 0%"],
    ]
    for idx, row_vals in enumerate(fin_checks):
        fmt_c = FMT_PCT if idx == 3 else FMT_IDR
        _style_data_row(ws_aud, 5 + idx, row_vals, ["center", "text", "formula", "center", "text"], [FMT_INT, None, fmt_c, None, None], zebra_idx=idx)
    ws_aud.conditional_formatting.add("D5:D8", CellIsRule(operator="equal", formula=['"OK"'], fill=FILL_OK, font=FONT_BADGE_OK))
    ws_aud.conditional_formatting.add("D5:D8", CellIsRule(operator="notEqual", formula=['"OK"'], fill=FILL_ERR, font=FONT_BADGE_ERR))
    _finalize_sheet(ws_aud, freeze_cell="A5", col_overrides={"A": 8, "B": 50, "C": 22, "D": 14, "E": 22})

    wb.remove(default_ws)
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    wb.save(out)
    patch_ooxml_zero_blue_theme(out)
    return out


# =============================================================================
# 3. TAX PPN (DPP 11/12) & PPH 21 TER RECAP (.XLSX)
# =============================================================================

def build_tax_xlsx(out_path: str | Path, data: Optional[dict] = None) -> Path:
    d = data or get_tax_data()
    params = d["params"]
    out_list = d["ppn_keluaran"]
    in_list = d["ppn_masukan"]
    pph_list = d["pph21_ter"]

    wb = Workbook()
    default_ws = wb.active

    _add_guide_sheet(
        wb,
        doc_title="REKAPITULASI PAJAK PPN (DPP 11/12) & PPH 21 TER",
        doc_code=d.get("report_code", "SF/TAX/2026/03-001"),
        period=d.get("period", "Masa Pajak Maret 2026"),
        sheets_desc=[
            ["01_Tax_Summary", "Ikhtisar PPN Kurang/Lebih Bayar & PPh 21 TER", "Seluruh angka ditarik dinamis; dilengkapi grafik ringkasan"],
            ["02_Parameter", "Tarif PPN 12%, Rasio DPP 11/12 & Efektif 11%", "Tarif tidak di-hardcode di formula; mudah disesuaikan saat regulasi berubah"],
            ["03_PPN_Keluaran", "Daftar Faktur Pajak Keluaran (Penjualan)", "DPP Nilai Lain = ROUND(Harga Jual x 11/12, 0); PPN = ROUND(DPP x 12%, 0)"],
            ["04_PPN_Masukan", "Daftar Faktur Pajak Masukan (Pembelian)", "PPN dapat dikreditkan terhadap PPN Keluaran"],
            ["05_PPh21_TER", "Rekap Pemotongan PPh 21 TER Karyawan", "NPWP disamarkan (masked); tarif mengacu kategori TER A/B/C PP 58/2023"],
            ["06_Audit_Control", "Verifikasi Tarif Efektif & Masking PII", "Validasi formula PPN 11% efektif dan keamanan data NPWP"],
        ],
        source_note=d["disclaimer"],
    )

    # --- 02_Parameter ---
    ws_p = wb.create_sheet("02_Parameter")
    _setup_sheet_header(ws_p, "PARAMETER TARIF PAJAK INDONESIA (CONFIGURABLE)", "Tarif dapat disesuaikan mengikuti PMK/UU terbaru tanpa mengubah formula transaksi.")
    _write_table_header(ws_p, 4, ["Parameter Pajak", "Nilai", "Dasar Regulasi & Keterangan"])
    p_rows = [
        ["Tarif PPN Statutori (UU HPP)", params["ppn_statutory_rate"], "input", FMT_PCT, "UU No. 7 Tahun 2021 (HPP) — efektif 1 Jan 2025"],
        ["Pembilang Rasio DPP Nilai Lain", params["dpp_ratio_num"], "input", FMT_INT, "PMK 131/2024: DPP Nilai Lain = 11/12 dari Harga Jual"],
        ["Penyebut Rasio DPP Nilai Lain", params["dpp_ratio_den"], "input", FMT_INT, "PMK 131/2024: penyebut rasio 12"],
        ["Rasio DPP Nilai Lain (11/12)", "=B6/B7", "formula", "0.0000", "Dihitung otomatis dari B6/B7 (= 0,9167)"],
        ["Tarif PPN Efektif", "=B5*B8", "formula", FMT_PCT2, "12% x (11/12) = 11,00% efektif untuk barang non-mewah"],
        ["Estimasi Tarif PPh Badan Fasilitas", params["pph_badan_facility_rate"], "input", FMT_PCT, "Pasal 31E UU PPh (fasilitas 50% x 22%)"],
    ]
    for idx, (lbl, val, knd, fmt, desc) in enumerate(p_rows):
        _style_data_row(ws_p, 5 + idx, [lbl, val, desc], ["text", knd, "text"], [None, fmt, None], zebra_idx=idx)
    wb.defined_names.add(DefinedName(name="SF_PPN_RATE", attr_text="'02_Parameter'!$B$5"))
    wb.defined_names.add(DefinedName(name="SF_DPP_RATIO", attr_text="'02_Parameter'!$B$8"))
    _finalize_sheet(ws_p, freeze_cell="A5", col_overrides={"A": 38, "B": 16, "C": 54})

    # --- 03_PPN_Keluaran ---
    ws_out = wb.create_sheet("03_PPN_Keluaran")
    _setup_sheet_header(ws_out, "REKAP PPN KELUARAN (OUTPUT VAT)", f"{d['company']['legal_name']} | {d['period']} | DPP Nilai Lain 11/12 x PPN 12%")
    _write_table_header(ws_out, 4, ["Tanggal", "No. Faktur Pajak", "No. Invoice", "Pembeli / Pelanggan", "NPWP (Masked)", "Harga Jual (Rp)", "DPP Nilai Lain 11/12 (Rp)", "PPN Keluaran 12% (Rp)", "Total Tagihan (Rp)"])
    for idx, row in enumerate(out_list):
        r = 5 + idx
        vals = [
            row["date"], row["faktur"], row["invoice"], row["counterparty"], row["npwp"],
            row["harga_jual"],
            f"=ROUND(F{r}*'02_Parameter'!$B$8,0)",
            f"=ROUND(G{r}*'02_Parameter'!$B$5,0)",
            f"=F{r}+H{r}",
        ]
        _style_data_row(ws_out, r, vals, ["center", "center", "center", "text", "center", "input", "formula", "formula", "formula"], ["@", "@", "@", None, "@", FMT_IDR, FMT_IDR, FMT_IDR, FMT_IDR], zebra_idx=idx)
    out_last = 4 + len(out_list)
    out_tot = out_last + 1
    _style_data_row(
        ws_out,
        out_tot,
        ["TOTAL", f"{len(out_list)} Faktur", "-", "Total PPN Keluaran", "-", f"=SUM(F5:F{out_last})", f"=SUM(G5:G{out_last})", f"=SUM(H5:H{out_last})", f"=SUM(I5:I{out_last})"],
        ["center", "center", "center", "text", "center", "formula", "formula", "formula", "formula"],
        [None, None, None, None, None, FMT_IDR, FMT_IDR, FMT_IDR, FMT_IDR],
        is_total=True,
    )
    _finalize_sheet(ws_out, freeze_cell="A5", auto_filter_ref=f"A4:I{out_last}", col_overrides={"A": 13, "B": 22, "C": 16, "D": 38, "E": 23, "F": 20, "G": 22, "H": 22, "I": 22})

    # --- 04_PPN_Masukan ---
    ws_in = wb.create_sheet("04_PPN_Masukan")
    _setup_sheet_header(ws_in, "REKAP PPN MASUKAN (INPUT VAT — DAPAT DIKREDITKAN)", f"{d['company']['legal_name']} | {d['period']}")
    _write_table_header(ws_in, 4, ["Tanggal", "No. Faktur Masukan", "No. PO", "Supplier / PKP Penjual", "NPWP (Masked)", "Harga Beli (Rp)", "DPP Nilai Lain 11/12 (Rp)", "PPN Masukan 12% (Rp)", "Total Pembelian (Rp)"])
    for idx, row in enumerate(in_list):
        r = 5 + idx
        vals = [
            row["date"], row["faktur"], row["po"], row["supplier"], row["npwp"],
            row["harga_beli"],
            f"=ROUND(F{r}*'02_Parameter'!$B$8,0)",
            f"=ROUND(G{r}*'02_Parameter'!$B$5,0)",
            f"=F{r}+H{r}",
        ]
        _style_data_row(ws_in, r, vals, ["center", "center", "center", "text", "center", "input", "formula", "formula", "formula"], ["@", "@", "@", None, "@", FMT_IDR, FMT_IDR, FMT_IDR, FMT_IDR], zebra_idx=idx)
    in_last = 4 + len(in_list)
    in_tot = in_last + 1
    _style_data_row(
        ws_in,
        in_tot,
        ["TOTAL", f"{len(in_list)} Faktur", "-", "Total PPN Masukan", "-", f"=SUM(F5:F{in_last})", f"=SUM(G5:G{in_last})", f"=SUM(H5:H{in_last})", f"=SUM(I5:I{in_last})"],
        ["center", "center", "center", "text", "center", "formula", "formula", "formula", "formula"],
        [None, None, None, None, None, FMT_IDR, FMT_IDR, FMT_IDR, FMT_IDR],
        is_total=True,
    )
    _finalize_sheet(ws_in, freeze_cell="A5", auto_filter_ref=f"A4:I{in_last}", col_overrides={"A": 13, "B": 22, "C": 14, "D": 36, "E": 23, "F": 20, "G": 22, "H": 22, "I": 22})

    # --- 05_PPh21_TER ---
    ws_pph = wb.create_sheet("05_PPh21_TER")
    _setup_sheet_header(ws_pph, "REKAP PEMOTONGAN PPH 21 TER (PP 58/2023)", f"{d['company']['legal_name']} | {d['period']} | Identitas NPWP disamarkan (masked)")
    _write_table_header(ws_pph, 4, ["ID Karyawan", "Nama Karyawan (Contoh)", "Status PTKP", "Kategori TER", "NPWP (Masked)", "Penghasilan Bruto (Rp)", "Tarif TER (%)", "PPh 21 Dipotong (Rp)"])
    for idx, emp in enumerate(pph_list):
        r = 5 + idx
        vals = [
            emp["emp_id"], emp["name"], emp["ptkp"], emp["ter_cat"], emp["npwp"],
            emp["gross"], emp["ter_rate"], f"=ROUND(F{r}*G{r},0)",
        ]
        _style_data_row(ws_pph, r, vals, ["center", "text", "center", "center", "center", "input", "input", "formula"], ["@", None, "@", "@", "@", FMT_IDR, FMT_PCT2, FMT_IDR], zebra_idx=idx)
    pph_last = 4 + len(pph_list)
    pph_tot = pph_last + 1
    _style_data_row(
        ws_pph,
        pph_tot,
        ["TOTAL", f"{len(pph_list)} Karyawan", "-", "-", "-", f"=SUM(F5:F{pph_last})", f"=IF(F{pph_tot}=0,0,H{pph_tot}/F{pph_tot})", f"=SUM(H5:H{pph_last})"],
        ["center", "text", "center", "center", "center", "formula", "formula", "formula"],
        [None, None, None, None, None, FMT_IDR, FMT_PCT2, FMT_IDR],
        is_total=True,
    )
    dv_ter = DataValidation(type="list", formula1='"TER A,TER B,TER C"', allow_blank=False)
    ws_pph.add_data_validation(dv_ter)
    dv_ter.add(f"D5:D{pph_last}")
    _finalize_sheet(ws_pph, freeze_cell="A5", auto_filter_ref=f"A4:H{pph_last}", col_overrides={"A": 15, "B": 28, "C": 12, "D": 14, "E": 23, "F": 22, "G": 15, "H": 22})

    # --- 01_Tax_Summary (place right after 00_Panduan; index 2 before removing default_ws) ---
    ws_sum = wb.create_sheet("01_Tax_Summary", 2)
    _setup_sheet_header(ws_sum, "IKHTISAR KEWAJIBAN PAJAK BULANAN (PPN & PPH 21)", f"{d['company']['legal_name']} | {d['period']}", show_grid=False)
    _write_table_header(ws_sum, 4, ["Komponen Pajak", "Nominal (Rp)", "Keterangan / Status"])
    sum_rows = [
        ("Total PPN Keluaran (Output VAT)", f"='03_PPN_Keluaran'!H{out_tot}", "12% x DPP Nilai Lain (11/12)", False),
        ("Total PPN Masukan (Input VAT)", f"='04_PPN_Masukan'!H{in_tot}", "Kredit pajak faktur masukan", False),
        ("PPN Kurang / (Lebih) Bayar", "=B5-B6", '=IF(B7>0,"KURANG BAYAR — SETOR KE KAS NEGARA",IF(B7<0,"LEBIH BAYAR — KOMPENSASI","NIHIL"))', True),
        ("Total Pemotongan PPh 21 TER", f"='05_PPh21_TER'!H{pph_tot}", "Disetor maks tanggal 10 bulan berikutnya", False),
        ("TOTAL KEWAJIBAN SETORAN PAJAK BULAN INI", "=MAX(0,B7)+B8", "Total PPN Kurang Bayar + PPh 21 TER", True),
    ]
    for idx, (lbl, frm, note, is_tot) in enumerate(sum_rows):
        _style_data_row(ws_sum, 5 + idx, [lbl, frm, note], ["text", "formula", "text"], [None, FMT_IDR, None], is_total=is_tot, zebra_idx=idx)

    ws_sum.cell(row=12, column=1, value="DISCLAIMER KEPATUHAN PAJAK:").font = FONT_SECTION
    ws_sum.cell(row=13, column=1, value=d["disclaimer"]).font = FONT_MUTED

    _apply_zero_blue_bar_chart(
        ws_sum,
        title="Ringkasan PPN & PPh 21 Masa Pajak Maret 2026 (Rp)",
        data_ref=Reference(ws_sum, min_col=2, min_row=4, max_col=2, max_row=8),
        cats_ref=Reference(ws_sum, min_col=1, min_row=5, max_col=1, max_row=8),
        anchor="E4",
    )
    _finalize_sheet(ws_sum, freeze_cell="A5", col_overrides={"A": 40, "B": 24, "C": 44})

    # --- 06_Audit_Control ---
    ws_aud = wb.create_sheet("06_Audit_Control")
    _setup_sheet_header(ws_aud, "AUDIT CONTROL CHECK — KEPATUHAN FORMULA PAJAK", "Memastikan rasio DPP 11/12, tarif efektif 11%, dan masking NPWP terpenuhi.")
    _write_table_header(ws_aud, 4, ["No", "Pemeriksaan Pajak", "Nilai Hasil", "Status", "Standar"])
    t_checks = [
        [1, "Verifikasi Tarif PPN Efektif (12% x 11/12)", "='02_Parameter'!B9", '=IF(ABS(C5-0.11)<0.0001,"OK","CEK")', "Tepat 11,00%"],
        [2, "Rasio Efektif Aktual PPN Keluaran vs Harga Jual", f"=IF('03_PPN_Keluaran'!F{out_tot}=0,0,'03_PPN_Keluaran'!H{out_tot}/'03_PPN_Keluaran'!F{out_tot})", '=IF(ABS(C6-0.11)<0.001,"OK","CEK")', "Mendekati 11,00%"],
        [3, "Masking NPWP Karyawan pada Sheet PPh 21 (***)", f"=COUNTIF('05_PPh21_TER'!E5:E{pph_last},\"*~***\")", f"=IF(C7={len(pph_list)},\"OK\",\"CEK\")", f"Seluruh {len(pph_list)} NPWP disamarkan"],
    ]
    for idx, row_vals in enumerate(t_checks):
        fmt_c = FMT_INT if idx == 2 else FMT_PCT2
        _style_data_row(ws_aud, 5 + idx, row_vals, ["center", "text", "formula", "center", "text"], [FMT_INT, None, fmt_c, None, None], zebra_idx=idx)
    ws_aud.conditional_formatting.add("D5:D7", CellIsRule(operator="equal", formula=['"OK"'], fill=FILL_OK, font=FONT_BADGE_OK))
    ws_aud.conditional_formatting.add("D5:D7", CellIsRule(operator="notEqual", formula=['"OK"'], fill=FILL_ERR, font=FONT_BADGE_ERR))
    _finalize_sheet(ws_aud, freeze_cell="A5", col_overrides={"A": 8, "B": 48, "C": 18, "D": 14, "E": 28})

    wb.remove(default_ws)
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    wb.save(out)
    patch_ooxml_zero_blue_theme(out)
    return out


# =============================================================================
# 4. PAYROLL SUMMARY 2026 (.XLSX) — EMPLOYEE VS EMPLOYER BPJS + MASKED PII
# =============================================================================

def build_payroll_xlsx(out_path: str | Path, data: Optional[dict] = None) -> Path:
    d = data or get_payroll_data()
    bp = d["bpjs_params"]
    emps = d["employees"]

    wb = Workbook()
    default_ws = wb.active

    _add_guide_sheet(
        wb,
        doc_title="REKAPITULASI PAYROLL, BPJS & PPH 21 KARYAWAN 2026 (CONFIDENTIAL)",
        doc_code=d.get("report_code", "SF/HR/PAY/2026-03"),
        period=d.get("period", "Maret 2026"),
        sheets_desc=[
            ["01_Payroll_Summary", "Ringkasan Biaya Payroll per Departemen & Total Beban Perusahaan", "Memisahkan tegas Take Home Pay (THP) dan BPJS Perusahaan"],
            ["02_Parameter_BPJS", "Tarif BPJS Karyawan vs Perusahaan, Plafon JP/Kes & Tarif Lembur", "Seluruh persentase BPJS & batas upah (cap) ditarik dinamis"],
            ["03_Payroll_Detail", "Kalkulasi Gross -> Potongan (PPh 21 + BPJS Karyawan) -> Net THP", "NIK & Nomor Rekening disamarkan (`****`); BPJS Perusahaan TIDAK dipotong di sini"],
            ["04_Employer_BPJS", "Kalkulasi BPJS Ditanggung Perusahaan (Beban Akun 6102)", "JKK 0,24%, JKM 0,30%, JHT 3,7%, JP 2% (capped), Kes 4% (capped)"],
            ["05_Audit_Control", "Audit Gross-Deductions=Net & Validasi Masking PII", "Menjamin 0 kesalahan rumus dan 100% masking NIK/Rekening"],
        ],
        source_note="Sumber: Modul HR & Payroll StockFlow ERP (PP 58/2023 PPh 21 TER, Perpres 64/2020 BPJS Kesehatan, PP 45/2015 BPJS TK) — Data Simulasi & Masked PII.",
    )

    # --- 02_Parameter_BPJS ---
    ws_bp = wb.create_sheet("02_Parameter_BPJS")
    _setup_sheet_header(ws_bp, "PARAMETER TARIF BPJS KARYAWAN VS PERUSAHAAN & LEMBUR", "Pemisahan tegas: Iuran Karyawan memotong THP; Iuran Perusahaan masuk Beban Perusahaan (COA 6102).")
    _write_table_header(ws_bp, 4, ["Komponen Parameter", "Nilai", "Kategori & Dasar Aturan"])
    bp_rows = [
        ["BPJS Ketenagakerjaan — JHT Karyawan", bp["emp_jht"], FMT_PCT2, "Potongan Karyawan (2,00%)"],
        ["BPJS Ketenagakerjaan — JP Karyawan", bp["emp_jp"], FMT_PCT2, "Potongan Karyawan (1,00% maks plafon JP)"],
        ["BPJS Kesehatan — Iuran Karyawan", bp["emp_kes"], FMT_PCT2, "Potongan Karyawan (1,00% maks plafon Kes)"],
        ["BPJS Ketenagakerjaan — JKK Perusahaan", bp["er_jkk"], FMT_PCT2, "Beban Perusahaan (0,24% tingkat risiko rendah)"],
        ["BPJS Ketenagakerjaan — JKM Perusahaan", bp["er_jkm"], FMT_PCT2, "Beban Perusahaan (0,30%)"],
        ["BPJS Ketenagakerjaan — JHT Perusahaan", bp["er_jht"], FMT_PCT2, "Beban Perusahaan (3,70%)"],
        ["BPJS Ketenagakerjaan — JP Perusahaan", bp["er_jp"], FMT_PCT2, "Beban Perusahaan (2,00% maks plafon JP)"],
        ["BPJS Kesehatan — Iuran Perusahaan", bp["er_kes"], FMT_PCT2, "Beban Perusahaan (4,00% maks plafon Kes)"],
        ["Plafon Upah Jaminan Pensiun (JP Cap)", bp["jp_cap"], FMT_IDR, "Batas atas perhitungan JP BPJS TK"],
        ["Plafon Upah BPJS Kesehatan (Kes Cap)", bp["kes_cap"], FMT_IDR, "Batas atas perhitungan BPJS Kesehatan"],
        ["Tarif Lembur Rata-rata per Jam", bp["overtime_rate_per_hour"], FMT_IDR, "Komponen lembur operasional"],
    ]
    for idx, (lbl, val, fmt, desc) in enumerate(bp_rows):
        _style_data_row(ws_bp, 5 + idx, [lbl, val, desc], ["text", "input", "text"], [None, fmt, None], zebra_idx=idx)
    _finalize_sheet(ws_bp, freeze_cell="A5", col_overrides={"A": 42, "B": 18, "C": 46})

    # --- 03_Payroll_Detail ---
    ws_det = wb.create_sheet("03_Payroll_Detail")
    _setup_sheet_header(ws_det, "RINCIAN PAYROLL KARYAWAN (GROSS, POTONGAN KARYAWAN & NET THP)", f"{d['company']['legal_name']} | {d['period']} | PII Disamarkan (Masked)")
    det_headers = [
        "ID Karyawan", "Nama Karyawan (Contoh)", "Departemen", "NIK (Masked)", "Rekening (Masked)",
        "Hadir", "Lembur (Jam)", "Gaji Pokok (Rp)", "Tunjangan Tetap (Rp)", "Upah Lembur (Rp)",
        "Gaji Bruto / Gross (Rp)", "Tarif TER (%)", "PPh 21 TER (Rp)",
        "BPJS JHT Kary (Rp)", "BPJS JP Kary (Rp)", "BPJS Kes Kary (Rp)",
        "Total Potongan (Rp)", "Gaji Bersih / Net THP (Rp)",
    ]
    det_kinds = [
        "center", "text", "text", "center", "center",
        "input", "input", "input", "input", "formula",
        "formula", "input", "formula",
        "formula", "formula", "formula",
        "formula", "formula",
    ]
    det_fmts = [
        "@", None, None, "@", "@",
        FMT_INT, FMT_INT, FMT_IDR, FMT_IDR, FMT_IDR,
        FMT_IDR, FMT_PCT2, FMT_IDR,
        FMT_IDR, FMT_IDR, FMT_IDR,
        FMT_IDR, FMT_IDR,
    ]
    _write_table_header(ws_det, 4, det_headers)

    for idx, e in enumerate(emps):
        r = 5 + idx
        vals = [
            e["emp_id"], e["name"], e["dept"], e["nik_masked"], e["bank_masked"],
            e["present_days"], e["overtime_hours"], e["base_salary"], e["allowances"],
            f"=G{r}*'02_Parameter_BPJS'!$B$15",
            f"=H{r}+I{r}+J{r}",
            e["ter_rate"],
            f"=ROUND(K{r}*L{r},0)",
            f"=ROUND(H{r}*'02_Parameter_BPJS'!$B$5,0)",
            f"=ROUND(MIN(H{r},'02_Parameter_BPJS'!$B$13)*'02_Parameter_BPJS'!$B$6,0)",
            f"=ROUND(MIN(H{r},'02_Parameter_BPJS'!$B$14)*'02_Parameter_BPJS'!$B$7,0)",
            f"=SUM(M{r}:P{r})",
            f"=K{r}-Q{r}",
        ]
        _style_data_row(ws_det, r, vals, det_kinds, det_fmts, zebra_idx=idx)

    det_last = 4 + len(emps)
    det_tot = det_last + 1
    _style_data_row(
        ws_det,
        det_tot,
        [
            "TOTAL", f"{len(emps)} Karyawan", "-", "-", "-",
            f"=AVERAGE(F5:F{det_last})", f"=SUM(G5:G{det_last})",
            f"=SUM(H5:H{det_last})", f"=SUM(I5:I{det_last})", f"=SUM(J5:J{det_last})",
            f"=SUM(K5:K{det_last})", f"=IF(K{det_tot}=0,0,M{det_tot}/K{det_tot})", f"=SUM(M5:M{det_last})",
            f"=SUM(N5:N{det_last})", f"=SUM(O5:O{det_last})", f"=SUM(P5:P{det_last})",
            f"=SUM(Q5:Q{det_last})", f"=SUM(R5:R{det_last})",
        ],
        det_kinds,
        det_fmts,
        is_total=True,
    )
    _finalize_sheet(ws_det, freeze_cell="C5", auto_filter_ref=f"A4:R{det_last}", col_overrides={"A": 15, "B": 26, "C": 22, "D": 19, "E": 24, "K": 22, "Q": 20, "R": 24})

    # --- 04_Employer_BPJS ---
    ws_er = wb.create_sheet("04_Employer_BPJS")
    _setup_sheet_header(ws_er, "BPJS DITANGGUNG PERUSAHAAN (BEBAN OPERASIONAL — TIDAK MEMOTONG GAJI KARYAWAN)", f"{d['company']['legal_name']} | {d['period']} | Dicatat ke Akun COA 6102")
    er_headers = [
        "ID Karyawan", "Nama Karyawan (Contoh)", "Departemen", "Gaji Pokok (Rp)",
        "JKK 0,24% (Rp)", "JKM 0,30% (Rp)", "JHT 3,70% (Rp)", "JP 2,00% (Rp)", "Kes 4,00% (Rp)",
        "Total BPJS Perusahaan (Rp)", "Total Beban Perusahaan (Gross + BPJS Er)",
    ]
    er_kinds = ["center", "text", "text", "formula", "formula", "formula", "formula", "formula", "formula", "formula", "formula"]
    er_fmts = ["@", None, None, FMT_IDR, FMT_IDR, FMT_IDR, FMT_IDR, FMT_IDR, FMT_IDR, FMT_IDR, FMT_IDR]
    _write_table_header(ws_er, 4, er_headers)
    for idx in range(len(emps)):
        r = 5 + idx
        vals = [
            f"='03_Payroll_Detail'!A{r}",
            f"='03_Payroll_Detail'!B{r}",
            f"='03_Payroll_Detail'!C{r}",
            f"='03_Payroll_Detail'!H{r}",
            f"=ROUND(D{r}*'02_Parameter_BPJS'!$B$8,0)",
            f"=ROUND(D{r}*'02_Parameter_BPJS'!$B$9,0)",
            f"=ROUND(D{r}*'02_Parameter_BPJS'!$B$10,0)",
            f"=ROUND(MIN(D{r},'02_Parameter_BPJS'!$B$13)*'02_Parameter_BPJS'!$B$11,0)",
            f"=ROUND(MIN(D{r},'02_Parameter_BPJS'!$B$14)*'02_Parameter_BPJS'!$B$12,0)",
            f"=SUM(E{r}:I{r})",
            f"='03_Payroll_Detail'!K{r}+J{r}",
        ]
        _style_data_row(ws_er, r, vals, er_kinds, er_fmts, zebra_idx=idx)
    er_last = 4 + len(emps)
    er_tot = er_last + 1
    _style_data_row(
        ws_er,
        er_tot,
        [
            "TOTAL", f"{len(emps)} Karyawan", "-",
            f"=SUM(D5:D{er_last})", f"=SUM(E5:E{er_last})", f"=SUM(F5:F{er_last})",
            f"=SUM(G5:G{er_last})", f"=SUM(H5:H{er_last})", f"=SUM(I5:I{er_last})",
            f"=SUM(J5:J{er_last})", f"=SUM(K5:K{er_last})",
        ],
        er_kinds,
        er_fmts,
        is_total=True,
    )
    _finalize_sheet(ws_er, freeze_cell="C5", auto_filter_ref=f"A4:K{er_last}", col_overrides={"A": 15, "B": 26, "C": 22, "J": 24, "K": 30})

    # --- 01_Payroll_Summary (place right after 00_Panduan; index 2 before removing default_ws) ---
    ws_ps = wb.create_sheet("01_Payroll_Summary", 2)
    _setup_sheet_header(ws_ps, "RINGKASAN PAYROLL PER DEPARTEMEN & TOTAL BIAYA SDM", f"{d['company']['legal_name']} | {d['period']}", show_grid=False)
    _write_table_header(ws_ps, 4, ["Departemen", "Headcount", "Total Gross (Rp)", "Potongan Karyawan (Rp)", "Net THP Transfer (Rp)", "BPJS Perusahaan (Rp)", "Total Cost Perusahaan (Rp)"])
    depts = list(dict.fromkeys(e["dept"] for e in emps))
    for idx, dept in enumerate(depts):
        r = 5 + idx
        vals = [
            dept,
            f"=COUNTIF('03_Payroll_Detail'!$C$5:$C${det_last},A{r})",
            f"=SUMIF('03_Payroll_Detail'!$C$5:$C${det_last},A{r},'03_Payroll_Detail'!$K$5:$K${det_last})",
            f"=SUMIF('03_Payroll_Detail'!$C$5:$C${det_last},A{r},'03_Payroll_Detail'!$Q$5:$Q${det_last})",
            f"=SUMIF('03_Payroll_Detail'!$C$5:$C${det_last},A{r},'03_Payroll_Detail'!$R$5:$R${det_last})",
            f"=SUMIF('04_Employer_BPJS'!$C$5:$C${er_last},A{r},'04_Employer_BPJS'!$J$5:$J${er_last})",
            f"=C{r}+F{r}",
        ]
        _style_data_row(ws_ps, r, vals, ["text", "formula", "formula", "formula", "formula", "formula", "formula"], [None, FMT_INT, FMT_IDR, FMT_IDR, FMT_IDR, FMT_IDR, FMT_IDR], zebra_idx=idx)
    ps_last = 4 + len(depts)
    ps_tot = ps_last + 1
    _style_data_row(
        ws_ps,
        ps_tot,
        [
            "TOTAL PERUSAHAAN",
            f"=SUM(B5:B{ps_last})", f"=SUM(C5:C{ps_last})", f"=SUM(D5:D{ps_last})",
            f"=SUM(E5:E{ps_last})", f"=SUM(F5:F{ps_last})", f"=SUM(G5:G{ps_last})",
        ],
        ["text", "formula", "formula", "formula", "formula", "formula", "formula"],
        [None, FMT_INT, FMT_IDR, FMT_IDR, FMT_IDR, FMT_IDR, FMT_IDR],
        is_total=True,
    )
    _apply_zero_blue_bar_chart(
        ws_ps,
        title="Distribusi Biaya Payroll (Net THP vs BPJS Perusahaan) per Departemen",
        data_ref=Reference(ws_ps, min_col=5, min_row=4, max_col=6, max_row=ps_last),
        cats_ref=Reference(ws_ps, min_col=1, min_row=5, max_col=1, max_row=ps_last),
        anchor="A14",
    )
    _finalize_sheet(ws_ps, freeze_cell="A5", col_overrides={"A": 26, "B": 12, "C": 22, "D": 22, "E": 22, "F": 22, "G": 26})

    # --- 05_Audit_Control ---
    ws_aud = wb.create_sheet("05_Audit_Control")
    _setup_sheet_header(ws_aud, "AUDIT CONTROL CHECK — AKURASI PAYROLL & PRIVASI PII", "Verifikasi Gross - Potongan = Net THP, pemisahan BPJS Perusahaan, dan masking PII.")
    _write_table_header(ws_aud, 4, ["No", "Pemeriksaan Kontrol Payroll", "Nilai Pemeriksaan", "Status", "Kriteria Lulus"])
    p_checks = [
        [1, "Persamaan Payroll: Total Gross - Total Potongan - Total Net THP", f"=ABS('03_Payroll_Detail'!K{det_tot}-'03_Payroll_Detail'!Q{det_tot}-'03_Payroll_Detail'!R{det_tot})", '=IF(C5<0.01,"OK","CEK")', "Selisih = Rp 0"],
        [2, "Rekonsiliasi Summary vs Detail (Total Cost = Gross + BPJS Er)", f"=ABS('01_Payroll_Summary'!G{ps_tot}-'04_Employer_BPJS'!K{er_tot})", '=IF(C6<0.01,"OK","CEK")', "Selisih = Rp 0"],
        [3, "Masking NIK Karyawan (Mengandung Tanda ****)", f"=COUNTIF('03_Payroll_Detail'!D5:D{det_last},\"*~*****\")", f"=IF(C7={len(emps)},\"OK\",\"CEK\")", f"Seluruh {len(emps)} NIK disamarkan"],
        [4, "Masking Nomor Rekening Bank (Mengandung Tanda ****)", f"=COUNTIF('03_Payroll_Detail'!E5:E{det_last},\"*~*****\")", f"=IF(C8={len(emps)},\"OK\",\"CEK\")", f"Seluruh {len(emps)} Rekening disamarkan"],
    ]
    for idx, row_vals in enumerate(p_checks):
        fmt_c = FMT_INT if idx >= 2 else FMT_IDR
        _style_data_row(ws_aud, 5 + idx, row_vals, ["center", "text", "formula", "center", "text"], [FMT_INT, None, fmt_c, None, None], zebra_idx=idx)
    ws_aud.conditional_formatting.add("D5:D8", CellIsRule(operator="equal", formula=['"OK"'], fill=FILL_OK, font=FONT_BADGE_OK))
    ws_aud.conditional_formatting.add("D5:D8", CellIsRule(operator="notEqual", formula=['"OK"'], fill=FILL_ERR, font=FONT_BADGE_ERR))
    _finalize_sheet(ws_aud, freeze_cell="A5", col_overrides={"A": 8, "B": 56, "C": 20, "D": 14, "E": 30})

    wb.remove(default_ws)
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    wb.save(out)
    patch_ooxml_zero_blue_theme(out)
    return out

#!/usr/bin/env python3
"""
StockFlow Executive Business Review PowerPoint (.pptx) Generator — python-pptx.

Complies with `corporate-powerpoint-deck`, `office-file-builder`, and StockFlow's STRICT ZERO-BLUE Palette:
- Widescreen 16:9 (13.333 x 7.5 in), safe margins >= 0.6 in, generous whitespace >= 25%
- Pyramid Principle (SCR) Executive Summary, Action Titles on every content slide, <= 80 words/slide
- Native PowerPoint Charts with explicit Zero-Blue RGB series fills (#1B4332, #C2592B, #B47B1B, #4D7C0F, #7F1D4A)
- Native Process Diagram shapes, KPI Metric Cards, Two-Column Action Plan, References slide, & Speaker Notes
- Post-processed via `patch_ooxml_zero_blue_theme()` for 100% Zero-Blue XML compliance.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, List, Optional, Sequence

from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.dml.color import RGBColor
from pptx.enum.chart import XL_CHART_TYPE, XL_LEGEND_POSITION
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt

from brand_theme import CHART_SERIES_HEX, PALETTE, patch_ooxml_zero_blue_theme, resolve_logo_path
from sample_data import format_idr, get_financial_data, get_inventory_data, get_payroll_data, get_tax_data

C_PRIMARY = RGBColor.from_string(PALETTE["primary"])
C_PRIMARY_DARK = RGBColor.from_string(PALETTE["primary_dark"])
C_PRIMARY_TINT = RGBColor.from_string(PALETTE["primary_tint"])
C_ACCENT = RGBColor.from_string(PALETTE["accent"])
C_GOLD = RGBColor.from_string(PALETTE["gold"])
C_OLIVE = RGBColor.from_string(PALETTE["olive"])
C_CHARCOAL = RGBColor.from_string(PALETTE["charcoal"])
C_STONE = RGBColor.from_string(PALETTE["stone"])
C_STONE_LIGHT = RGBColor.from_string(PALETTE["stone_light"])
C_ALABASTER = RGBColor.from_string(PALETTE["alabaster"])
C_SAND = RGBColor.from_string(PALETTE["sand_border"])
C_SAND_STRONG = RGBColor.from_string(PALETTE["sand_strong"])
C_SUCCESS = RGBColor.from_string(PALETTE["success"])
C_WHITE = RGBColor(0xFF, 0xFF, 0xFF)

FONT = "Calibri"


def _add_slide_chrome(slide, idx: int, total: int, kicker: str, action_title: str, source: str) -> None:
    # Warm Alabaster subtle canvas background
    bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(7.5))
    bg.fill.solid()
    bg.fill.fore_color.rgb = C_WHITE
    bg.line.fill.background()

    # Top thin Forest Pine + Terracotta accent bar
    top_bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(0.10))
    top_bar.fill.solid()
    top_bar.fill.fore_color.rgb = C_PRIMARY
    top_bar.line.fill.background()

    acc_bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0.10), Inches(2.4), Inches(0.05))
    acc_bar.fill.solid()
    acc_bar.fill.fore_color.rgb = C_ACCENT
    acc_bar.line.fill.background()

    # Kicker
    tk = slide.shapes.add_textbox(Inches(0.6), Inches(0.28), Inches(11.8), Inches(0.28))
    rk = tk.text_frame.paragraphs[0].add_run()
    rk.text = kicker.upper()
    rk.font.name = FONT
    rk.font.size = Pt(10)
    rk.font.bold = True
    rk.font.color.rgb = C_ACCENT

    # Action Title
    tt = slide.shapes.add_textbox(Inches(0.6), Inches(0.54), Inches(12.1), Inches(0.84))
    tft = tt.text_frame
    tft.word_wrap = True
    rt = tft.paragraphs[0].add_run()
    rt.text = action_title
    rt.font.name = FONT
    rt.font.size = Pt(20)
    rt.font.bold = True
    rt.font.color.rgb = C_PRIMARY

    # Divider line
    div = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.6), Inches(1.42), Inches(12.133), Inches(0.02))
    div.fill.solid()
    div.fill.fore_color.rgb = C_SAND_STRONG
    div.line.fill.background()

    # Footer
    tf_src = slide.shapes.add_textbox(Inches(0.6), Inches(6.96), Inches(10.6), Inches(0.32)).text_frame
    rs = tf_src.paragraphs[0].add_run()
    rs.text = source
    rs.font.name = FONT
    rs.font.size = Pt(9)
    rs.font.color.rgb = C_STONE_LIGHT

    tf_num = slide.shapes.add_textbox(Inches(11.5), Inches(6.96), Inches(1.23), Inches(0.32)).text_frame
    p_num = tf_num.paragraphs[0]
    p_num.alignment = PP_ALIGN.RIGHT
    rn = p_num.add_run()
    rn.text = f"{idx} / {total}"
    rn.font.name = FONT
    rn.font.size = Pt(9)
    rn.font.bold = True
    rn.font.color.rgb = C_PRIMARY


def _add_kpi_cards(slide, top_in: float, kpis: Sequence[dict]) -> None:
    n = len(kpis)
    gap = 0.25
    card_w = (12.133 - gap * (n - 1)) / n
    for i, kpi in enumerate(kpis):
        left = 0.6 + i * (card_w + gap)
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(left), Inches(top_in), Inches(card_w), Inches(1.52))
        card.fill.solid()
        card.fill.fore_color.rgb = C_ALABASTER
        card.line.color.rgb = C_SAND_STRONG

        # Top stripe inside card
        stripe = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(left), Inches(top_in), Inches(card_w), Inches(0.08))
        stripe.fill.solid()
        stripe.fill.fore_color.rgb = C_PRIMARY if i % 2 == 0 else C_ACCENT
        stripe.line.fill.background()

        tb = slide.shapes.add_textbox(Inches(left + 0.16), Inches(top_in + 0.16), Inches(card_w - 0.32), Inches(1.26))
        tf = tb.text_frame
        tf.word_wrap = True
        rl = tf.paragraphs[0].add_run()
        rl.text = kpi["label"]
        rl.font.name = FONT
        rl.font.size = Pt(10.5)
        rl.font.color.rgb = C_STONE

        pv = tf.add_paragraph()
        pv.space_before = Pt(4)
        rv = pv.add_run()
        rv.text = kpi["value"]
        rv.font.name = FONT
        rv.font.size = Pt(23)
        rv.font.bold = True
        rv.font.color.rgb = C_PRIMARY

        if kpi.get("delta"):
            pd = tf.add_paragraph()
            pd.space_before = Pt(2)
            rd = pd.add_run()
            rd.text = kpi["delta"]
            rd.font.name = FONT
            rd.font.size = Pt(10)
            rd.font.bold = True
            rd.font.color.rgb = C_SUCCESS if str(kpi["delta"]).startswith("+") or "OK" in str(kpi["delta"]) else C_ACCENT


def _add_bullets(slide, left: float, top: float, width: float, height: float, bullets: Sequence[str], font_size: int = 13) -> None:
    tb = slide.shapes.add_textbox(Inches(left), Inches(top), Inches(width), Inches(height))
    tf = tb.text_frame
    tf.word_wrap = True
    for i, b in enumerate(bullets):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.space_after = Pt(9)
        p.line_spacing = 1.18
        r = p.add_run()
        r.text = f"▪  {b}"
        r.font.name = FONT
        r.font.size = Pt(font_size)
        r.font.color.rgb = C_CHARCOAL


def _add_native_chart(slide, ctype: XL_CHART_TYPE, left: float, top: float, width: float, height: float, categories: Sequence[str], series_list: Sequence[dict]) -> None:
    cdata = CategoryChartData()
    cdata.categories = list(categories)
    for s in series_list:
        cdata.add_series(s["name"], s["values"])
    shape = slide.shapes.add_chart(ctype, Inches(left), Inches(top), Inches(width), Inches(height), cdata)
    chart = shape.chart
    chart.has_legend = len(series_list) > 1
    if chart.has_legend:
        chart.legend.position = XL_LEGEND_POSITION.BOTTOM
        chart.legend.font.size = Pt(10)
        chart.legend.font.color.rgb = C_CHARCOAL

    for idx, ser in enumerate(chart.series):
        rgb = RGBColor.from_string(CHART_SERIES_HEX[idx % len(CHART_SERIES_HEX)])
        if ctype == XL_CHART_TYPE.LINE_MARKERS:
            ser.format.line.color.rgb = rgb
            ser.format.line.width = Pt(2.5)
        else:
            ser.format.fill.solid()
            ser.format.fill.fore_color.rgb = rgb
            ser.format.line.color.rgb = rgb

    try:
        plot = chart.plots[0]
        plot.has_data_labels = True
        plot.data_labels.font.size = Pt(9)
        plot.data_labels.font.color.rgb = C_CHARCOAL
    except Exception:
        pass


def build_executive_pptx(out_path: str | Path, data: Optional[dict] = None, logo_path: Optional[str] = None) -> Path:
    fin = (data or {}).get("financial") or get_financial_data()
    inv = (data or {}).get("inventory") or get_inventory_data()
    tax = (data or {}).get("tax") or get_tax_data()
    pay = (data or {}).get("payroll") or get_payroll_data()
    comp = fin["company"]
    logo = resolve_logo_path(logo_path)

    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank = prs.slide_layouts[6]
    total_slides = 10

    # --- SLIDE 1: COVER ---
    s1 = prs.slides.add_slide(blank)
    bg = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(7.5))
    bg.fill.solid()
    bg.fill.fore_color.rgb = C_PRIMARY
    bg.line.fill.background()

    # Warm Alabaster right architectural panel
    panel = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(9.1), Inches(0), Inches(4.233), Inches(7.5))
    panel.fill.solid()
    panel.fill.fore_color.rgb = C_ALABASTER
    panel.line.fill.background()

    bar = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(2.0), Inches(1.5), Inches(0.09))
    bar.fill.solid()
    bar.fill.fore_color.rgb = C_ACCENT
    bar.line.fill.background()

    if logo.exists():
        from PIL import Image as PILImage
        with PILImage.open(logo) as im:
            iw, ih = im.size
        target_w = 3.2
        target_h = target_w * (ih / max(iw, 1))
        if target_h > 2.0:
            target_h = 2.0
            target_w = target_h * (iw / max(ih, 1))
        s1.shapes.add_picture(str(logo), Inches(9.6), Inches(2.6), width=Inches(target_w), height=Inches(target_h))

    tb1 = s1.shapes.add_textbox(Inches(0.8), Inches(2.3), Inches(7.9), Inches(2.8))
    tf1 = tb1.text_frame
    tf1.word_wrap = True
    r1 = tf1.paragraphs[0].add_run()
    r1.text = "StockFlow Executive Business Review — Q1 2026"
    r1.font.name = FONT
    r1.font.size = Pt(34)
    r1.font.bold = True
    r1.font.color.rgb = C_WHITE

    p1s = tf1.add_paragraph()
    p1s.space_before = Pt(14)
    r1s = p1s.add_run()
    r1s.text = "Evaluasi Kinerja Keuangan Double-Entry, Valuasi Persediaan Multi-Gudang, Kepatuhan Pajak & Tata Kelola SDM"
    r1s.font.name = FONT
    r1s.font.size = Pt(16)
    r1s.font.color.rgb = C_PRIMARY_TINT

    tbm = s1.shapes.add_textbox(Inches(0.8), Inches(6.2), Inches(7.8), Inches(0.7))
    rm = tbm.text_frame.paragraphs[0].add_run()
    rm.text = f"{comp['legal_name']}  |  {fin['period']}  |  RAHASIA DIREKSI"
    rm.font.name = FONT
    rm.font.size = Pt(11)
    rm.font.color.rgb = C_SAND
    s1.notes_slide.notes_text_frame.text = "Selamat pagi Bapak/Ibu Direksi. Hari ini kita meninjau kinerja terpadu Q1 2026 PT Karya Berdua melalui sistem ERP StockFlow v2.0."

    # --- SLIDE 2: EXECUTIVE SUMMARY (SCR + KPI CARDS) ---
    s2 = prs.slides.add_slide(blank)
    _add_slide_chrome(
        s2, 2, total_slides,
        "Executive Summary",
        "Pendapatan Q1 2026 tembus Rp 1,60 M (+6,7%) dengan Neraca seimbang & kas kuat",
        "Sumber: Buku Besar Double-Entry & Valuasi WAC StockFlow ERP (Q1 2026).",
    )
    _add_kpi_cards(s2, 1.62, [
        {"label": "Penjualan Bersih", "value": "Rp 1,60 M", "delta": "+6,7% vs Target"},
        {"label": "Gross Margin", "value": "41,3%", "delta": "+3,3 pp"},
        {"label": "Laba Bersih", "value": "Rp 178 Jt", "delta": "11,1% Margin"},
        {"label": "Kas & Bank", "value": "Rp 795 Jt", "delta": "+Rp 183 Jt OK"},
    ])
    _add_bullets(s2, 0.6, 3.48, 12.1, 3.0, [
        "Situasi: Penjualan furnitur kayu jati & homeware melampaui target di 4 gudang.",
        "Risiko: 4 SKU unggulan menyentuh batas Reorder Point (lead time 10–12 hari).",
        "Keputusan: Setujui PO restock 4 SKU kritis dan jaga disiplin penagihan AR.",
    ], font_size=14)
    s2.notes_slide.notes_text_frame.text = "Slide ini menerapkan Pyramid Principle (SCR). Direksi langsung melihat kinerja finansial melampaui target (+6,7%) dengan Neraca 100% seimbang, namun membutuhkan persetujuan cepat untuk restock 4 SKU strategis."

    # --- SLIDE 3: FINANCIAL TREND (NATIVE COLUMN CHART) ---
    s3 = prs.slides.add_slide(blank)
    _add_slide_chrome(
        s3, 3, total_slides,
        "Profitabilitas 6 Bulan",
        "Pendapatan tumbuh stabil dari Rp 465 Jt ke Rp 555 Jt/bulan sementara rasio HPP terjaga di 58,8%",
        "Sumber: Laporan Laba Rugi Bulanan StockFlow ERP (Okt 2025 – Mar 2026).",
    )
    mt = fin["monthly_trend"]
    _add_native_chart(
        s3, XL_CHART_TYPE.COLUMN_CLUSTERED, 0.6, 1.65, 7.6, 5.0,
        mt["months"],
        [
            {"name": "Pendapatan (Rp Jt)", "values": mt["revenue_jt"]},
            {"name": "HPP / COGS (Rp Jt)", "values": mt["cogs_jt"]},
            {"name": "Laba Bersih (Rp Jt)", "values": mt["net_profit_jt"]},
        ],
    )
    _add_bullets(s3, 8.45, 1.75, 4.3, 4.8, [
        "Puncak penjualan Des 2025 (Rp 560 Jt) berhasil dipertahankan pasca-libur pada Mar 2026 (Rp 555 Jt).",
        "Pengendalian biaya berbasis Weighted Average Cost (WAC) menjaga stabilitas margin kotor di 41,3%.",
        "Laba bersih bulanan meningkat 39% dalam 6 bulan terakhir (Rp 46 Jt ke Rp 64 Jt).",
    ], font_size=13)
    s3.notes_slide.notes_text_frame.text = "Soroti konsistensi margin pasca-musim ramai Desember. Kenaikan laba bersih melampaui pertumbuhan omzet karena efisiensi OPEX."

    # --- SLIDE 4: INVENTORY VALUATION BY WAREHOUSE (NATIVE BAR CHART) ---
    s4 = prs.slides.add_slide(blank)
    _add_slide_chrome(
        s4, 4, total_slides,
        "Valuasi Persediaan Multi-Gudang",
        "Gudang Utama Jakarta memegang 41% nilai stok WAC; distribusi antar gudang optimal menjaga SLA kirim",
        "Sumber: Laporan Valuasi Persediaan Multi-Gudang StockFlow ERP (Per 31 Mar 2026).",
    )
    wh_vals = {}
    for it in inv["items"]:
        end_q = it["opening_qty"] + it["stock_in"] - it["stock_out"]
        wh_vals[it["warehouse"]] = wh_vals.get(it["warehouse"], 0) + end_q * it["wac_cost"]
    wh_names = [w["name"] for w in inv["warehouses"]]
    wh_jt = [round(wh_vals.get(w["code"], 0) / 1_000_000, 1) for w in inv["warehouses"]]
    _add_native_chart(
        s4, XL_CHART_TYPE.BAR_CLUSTERED, 0.6, 1.65, 7.6, 5.0,
        wh_names,
        [{"name": "Nilai Persediaan WAC (Rp Juta)", "values": wh_jt}],
    )
    _add_bullets(s4, 8.45, 1.75, 4.3, 4.8, [
        "Penilaian stok 100% mengikuti metode WAC (PSAK 14) dengan kebijakan ketat anti-stok negatif.",
        "Transfer antar gudang tercatat real-time melalui status In-Transit hingga konfirmasi penerimaan.",
        "Barcode & QR stock opname mempercepat audit fisik 4 gudang dalam 1 hari kerja.",
    ], font_size=13)
    s4.notes_slide.notes_text_frame.text = "Valuasi tersebar proporsional sesuai volume pengiriman wilayah Jabodetabek, Jawa Barat, dan Jawa Timur."

    # --- SLIDE 5: REORDER RISK TABLE ---
    s5 = prs.slides.add_slide(blank)
    _add_slide_chrome(
        s5, 5, total_slides,
        "Peringatan Reorder Point (ROP)",
        "Empat SKU unggulan menyentuh ambang ROP dan membutuhkan penerbitan Purchase Order minggu ini",
        "Sumber: Modul Forecasting & Reorder Recommendation StockFlow ERP (Mar 2026).",
    )
    risk_rows = []
    for it in inv["items"]:
        end_q = it["opening_qty"] + it["stock_in"] - it["stock_out"]
        rop = round(it["avg_daily_demand"] * it["lead_time_days"] + it["safety_stock"])
        if end_q <= round(rop * 1.25):
            st = "RESTOCK SEGERA" if end_q <= rop else "PANTAU"
            risk_rows.append([it["sku"], it["name"], it["warehouse"], str(end_q), str(rop), f"{it['lead_time_days']} hr", st])
    risk_rows = risk_rows[:6]
    headers = ["SKU", "Produk", "Gudang", "Stok Akhir", "ROP", "Lead Time", "Status"]
    tbl_s = s5.shapes.add_table(1 + len(risk_rows), len(headers), Inches(0.6), Inches(1.65), Inches(12.133), Inches(0.54 * (1 + len(risk_rows))))
    tbl = tbl_s.table
    for ci, h in enumerate(headers):
        cell = tbl.cell(0, ci)
        cell.fill.solid()
        cell.fill.fore_color.rgb = C_PRIMARY
        r = cell.text_frame.paragraphs[0].add_run()
        r.text = h
        r.font.name = FONT
        r.font.size = Pt(11)
        r.font.bold = True
        r.font.color.rgb = C_WHITE
    for ri, rvals in enumerate(risk_rows):
        for ci, val in enumerate(rvals):
            cell = tbl.cell(ri + 1, ci)
            cell.fill.solid()
            cell.fill.fore_color.rgb = C_ALABASTER if ri % 2 == 1 else C_WHITE
            r = cell.text_frame.paragraphs[0].add_run()
            r.text = val
            r.font.name = FONT
            r.font.size = Pt(10.5)
            r.font.bold = (ci == 6)
            r.font.color.rgb = C_ACCENT if (ci == 6 and "RESTOCK" in val) else C_CHARCOAL
    s5.notes_slide.notes_text_frame.text = "Fokuskan persetujuan PO segera pada Sofa Jati Minimalis, Meja Makan Oak Solid, Lampu Gantung Rotan, dan Meja Kopi Marmer."

    # --- SLIDE 6: BALANCE SHEET & LIQUIDITY ---
    s6 = prs.slides.add_slide(blank)
    _add_slide_chrome(
        s6, 6, total_slides,
        "Kesehatan Neraca & Arus Kas",
        "Struktur permodalan sehat dengan Ekuitas 70,1% dan Arus Kas Operasi positif Rp 223 Juta",
        "Sumber: Neraca & Laporan Arus Kas StockFlow ERP (Per 31 Mar 2026).",
    )
    _add_native_chart(
        s6, XL_CHART_TYPE.COLUMN_CLUSTERED, 0.6, 1.65, 7.2, 5.0,
        ["Total Aset", "Liabilitas", "Ekuitas", "Kas & Bank"],
        [{"name": "Posisi Per 31 Mar 2026 (Rp Juta)", "values": [2715, 812, 1903, 795]}],
    )
    _add_bullets(s6, 8.1, 1.75, 4.6, 4.8, [
        "Current Ratio mencapai 4,3x (Aset Lancar Rp 1,70 M vs Liabilitas Lancar Rp 392 Jt).",
        "Debt-to-Equity Ratio (DER) terjaga sangat aman di 0,43x.",
        "Arus kas operasi (+Rp 223 Jt) sepenuhnya membiayai CAPEX rak gudang & showroom (-Rp 100 Jt).",
        "Persamaan Aset = Liabilitas + Ekuitas terverifikasi selisih Rp 0 di sistem Double-Entry.",
    ], font_size=13)
    s6.notes_slide.notes_text_frame.text = "Rasio likuiditas dan solvabilitas sangat kuat, memberikan ruang aman bagi ekspansi persediaan Q2."

    # --- SLIDE 7: TAX & PAYROLL COMPLIANCE ---
    s7 = prs.slides.add_slide(blank)
    _add_slide_chrome(
        s7, 7, total_slides,
        "Kepatuhan Pajak & Payroll",
        "PPN DPP 11/12, PPh 21 TER, dan pemisahan BPJS Perusahaan berjalan otomatis",
        "Sumber: Modul Pajak & Payroll StockFlow ERP (PMK 131/2024 & PP 58/2023).",
    )
    _add_kpi_cards(s7, 1.65, [
        {"label": "PPN Keluaran", "value": "Rp 61,1 Jt", "delta": "DPP 11/12"},
        {"label": "PPN Masukan", "value": "Rp 35,8 Jt", "delta": "Kredit OK"},
        {"label": "PPN Kurang Bayar", "value": "Rp 25,3 Jt", "delta": "Siap Setor"},
        {"label": "PPh 21 TER", "value": "Rp 2,68 Jt", "delta": "PII Masked"},
    ])
    _add_bullets(s7, 0.6, 3.55, 12.1, 3.0, [
        "Tarif PPN & TER terkonfigurasi per tanggal efektif tanpa ubah kode sistem.",
        "BPJS Perusahaan tercatat sebagai beban (COA 6102), tidak memotong gaji karyawan.",
        "NIK, NPWP, dan nomor rekening terenkripsi serta tersamar pada seluruh laporan.",
    ], font_size=13.5)
    s7.notes_slide.notes_text_frame.text = "Tekankan kepatuhan regulasi Indonesia terbaru (PMK 131/2024 PPN 12% x DPP 11/12 & PP 58/2023 PPh 21 TER) serta perlindungan privasi data karyawan."

    # --- SLIDE 8: GOVERNANCE & ARCHITECTURE DIAGRAM (NATIVE SHAPES) ---
    s8 = prs.slides.add_slide(blank)
    _add_slide_chrome(
        s8, 8, total_slides,
        "Arsitektur & Tata Kelola Keamanan",
        "Kontrol 8-Role RBAC, Google OAuth Quarantine, dan Jurnal Immutable melindungi integritas aset",
        "Sumber: Arsitektur Keamanan & Kontrol Internal StockFlow v2.0 (2026).",
    )
    nodes = [
        ("1. Auth & OAuth2", "Login terenkripsi, Google OAuth2, akun baru otomatis karantina guest_pending"),
        ("2. 8-Role RBAC", "Pemisahan hak akses ketat Admin, Manager, Gudang, Sales, Finance & HR"),
        ("3. Transaksi Atomic", "DB Transaction + lockForUpdate mencegah stok negatif & duplikasi jurnal"),
        ("4. Audit & Ekspor", "Audit log 403/perubahan data & ekspor resmi PDF, Word, Excel otomatis"),
    ]
    n = len(nodes)
    arrow_w = 0.34
    gap = 0.08
    box_w = (12.133 - (n - 1) * (arrow_w + 2 * gap)) / n
    box_h = 3.2
    y0 = 2.25
    hdr_colors = [C_PRIMARY, C_ACCENT, C_GOLD, C_OLIVE]
    for i, (nt, ns) in enumerate(nodes):
        x0 = 0.6 + i * (box_w + arrow_w + 2 * gap)
        card = s8.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x0), Inches(y0), Inches(box_w), Inches(box_h))
        card.fill.solid()
        card.fill.fore_color.rgb = C_ALABASTER
        card.line.color.rgb = hdr_colors[i]

        hdr = s8.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x0), Inches(y0), Inches(box_w), Inches(0.68))
        hdr.fill.solid()
        hdr.fill.fore_color.rgb = hdr_colors[i]
        hdr.line.fill.background()
        p_h = hdr.text_frame.paragraphs[0]
        p_h.alignment = PP_ALIGN.CENTER
        rh = p_h.add_run()
        rh.text = nt
        rh.font.name = FONT
        rh.font.size = Pt(12.5)
        rh.font.bold = True
        rh.font.color.rgb = C_WHITE

        tb = s8.shapes.add_textbox(Inches(x0 + 0.14), Inches(y0 + 0.86), Inches(box_w - 0.28), Inches(box_h - 1.0))
        tf = tb.text_frame
        tf.word_wrap = True
        pb = tf.paragraphs[0]
        pb.alignment = PP_ALIGN.CENTER
        rb = pb.add_run()
        rb.text = ns
        rb.font.name = FONT
        rb.font.size = Pt(11.5)
        rb.font.color.rgb = C_CHARCOAL

        if i < n - 1:
            arr = s8.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, Inches(x0 + box_w + gap), Inches(y0 + box_h / 2 - 0.18), Inches(arrow_w), Inches(0.36))
            arr.fill.solid()
            arr.fill.fore_color.rgb = C_PRIMARY
            arr.line.fill.background()
    s8.notes_slide.notes_text_frame.text = "Arsitektur keamanan berlapis memastikan pengguna Google baru tidak pernah memperoleh akses bisnis tanpa otorisasi Admin."

    # --- SLIDE 9: 90-DAY STRATEGIC ACTION PLAN (TWO-COLUMN) ---
    s9 = prs.slides.add_slide(blank)
    _add_slide_chrome(
        s9, 9, total_slides,
        "Rencana Aksi Q2 2026",
        "Prioritas 90 hari berfokus pada restock SKU unggulan dan disiplin tutup buku",
        "Sumber: Rencana Kerja Operasional & Keuangan Q2 2026 PT Karya Berdua.",
    )
    cols = [
        ("Operasional & Stok (0–45 Hari)", C_PRIMARY, [
            "Terbitkan PO restock 4 SKU kritis minggu ini.",
            "Pangkas lead time supplier Jepara dari 12 ke 8 hari.",
            "Jalankan Stock Opname Q2 berbasis barcode terpadu.",
        ]),
        ("Keuangan, Pajak & SDM (45–90 Hari)", C_ACCENT, [
            "Jaga rasio penagihan AR > 95% (NET 14 Hari).",
            "Kunci periode tutup buku bulanan maksimal H+5.",
            "Otomasi slip gaji digital RBAC & rekap Coretax.",
        ]),
    ]
    for ci, (ctitle, ccol, cbullets) in enumerate(cols):
        cx = 0.6 + ci * 6.25
        card = s9.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(cx), Inches(1.75), Inches(5.88), Inches(4.85))
        card.fill.solid()
        card.fill.fore_color.rgb = C_ALABASTER
        card.line.color.rgb = C_SAND_STRONG

        chdr = s9.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(cx), Inches(1.75), Inches(5.88), Inches(0.56))
        chdr.fill.solid()
        chdr.fill.fore_color.rgb = ccol
        chdr.line.fill.background()
        rh = chdr.text_frame.paragraphs[0].add_run()
        rh.text = f"  {ctitle}"
        rh.font.name = FONT
        rh.font.size = Pt(13)
        rh.font.bold = True
        rh.font.color.rgb = C_WHITE

        _add_bullets(s9, cx + 0.18, 2.5, 5.52, 3.9, cbullets, font_size=13.5)
    s9.notes_slide.notes_text_frame.text = "Minta persetujuan Direksi atas 6 inisiatif prioritas Q2 ini beserta PIC di masing-masing divisi."

    # --- SLIDE 10: REFERENCES & GOVERNANCE ---
    s10 = prs.slides.add_slide(blank)
    _add_slide_chrome(
        s10, 10, total_slides,
        "Referensi Resmi",
        "Pelaporan mengacu penuh pada PSAK, regulasi pajak RI, dan data StockFlow",
        "StockFlow Executive Business Review — Zero-Blue Craft Brand Standard.",
    )
    refs = [
        "IAI (2024). PSAK 1 (Laporan Keuangan) & PSAK 14 (Persediaan WAC).",
        "Kemenkeu RI (2024). PMK 131/2024 tentang PPN & DPP Nilai Lain 11/12.",
        "Pemerintah RI (2023). PP 58/2023 tentang Tarif Efektif PPh 21 (TER).",
        "Perpres 64/2020 (BPJS Kesehatan) & PP 45/2015 (BPJS Ketenagakerjaan).",
        "StockFlow ERP v2.0 (2026). Dataset Simulasi Q1 PT Karya Berdua.",
    ]
    tb_ref = s10.shapes.add_textbox(Inches(0.6), Inches(1.75), Inches(12.1), Inches(4.8))
    tf_r = tb_ref.text_frame
    tf_r.word_wrap = True
    for i, entry in enumerate(refs):
        pr = tf_r.paragraphs[0] if i == 0 else tf_r.add_paragraph()
        pr.space_after = Pt(10)
        pr.line_spacing = 1.2
        rr = pr.add_run()
        rr.text = f"[{i + 1}]  {entry}"
        rr.font.name = FONT
        rr.font.size = Pt(12)
        rr.font.color.rgb = C_CHARCOAL
    s10.notes_slide.notes_text_frame.text = "Slide penutup mencantumkan dasar hukum & standar akuntansi resmi tanpa satu pun sumber berita internet."

    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    prs.save(out)
    patch_ooxml_zero_blue_theme(out)
    return out

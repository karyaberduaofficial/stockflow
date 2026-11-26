#!/usr/bin/env python3
"""
StockFlow Enterprise PDF (.pdf) Generator — ReportLab (100% Pure Python, Cross-Platform).

STRICT ZERO-BLUE COLOR POLICY:
Every fill, stroke, banner, table header, chart, and typography token uses ONLY
StockFlow's Furniture & Homeware Financial Craft palette (#1B4332, #C2592B, #FAF8F5, #E8F3EC, #1C1917, #57534E).
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Any, List, Optional, Sequence

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    Image as RLImage,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from brand_theme import PALETTE, render_chart_png, resolve_logo_path
from sample_data import (
    format_idr,
    get_financial_data,
    get_inventory_data,
    get_invoice_data,
    get_opname_data,
    get_payroll_data,
    get_payslip_data,
    get_tax_data,
)

# =============================================================================
# ZERO-BLUE REPORTLAB COLOR TOKENS
# =============================================================================

C_PRIMARY = colors.HexColor(f"#{PALETTE['primary']}")
C_PRIMARY_DARK = colors.HexColor(f"#{PALETTE['primary_dark']}")
C_PRIMARY_TINT = colors.HexColor(f"#{PALETTE['primary_tint']}")
C_ACCENT = colors.HexColor(f"#{PALETTE['accent']}")
C_ACCENT_TINT = colors.HexColor(f"#{PALETTE['accent_tint']}")
C_GOLD = colors.HexColor(f"#{PALETTE['gold']}")
C_GOLD_TINT = colors.HexColor(f"#{PALETTE['gold_tint']}")
C_CHARCOAL = colors.HexColor(f"#{PALETTE['charcoal']}")
C_STONE = colors.HexColor(f"#{PALETTE['stone']}")
C_STONE_LIGHT = colors.HexColor(f"#{PALETTE['stone_light']}")
C_ALABASTER = colors.HexColor(f"#{PALETTE['alabaster']}")
C_SAND = colors.HexColor(f"#{PALETTE['sand_border']}")
C_SAND_STRONG = colors.HexColor(f"#{PALETTE['sand_strong']}")
C_WHITE = colors.HexColor("#FFFFFF")
C_SUCCESS = colors.HexColor(f"#{PALETTE['success']}")
C_WARNING = colors.HexColor(f"#{PALETTE['warning']}")
C_DANGER = colors.HexColor(f"#{PALETTE['danger']}")
C_DANGER_TINT = colors.HexColor(f"#{PALETTE['danger_tint']}")


def _build_styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("SFTitle", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=16, leading=20, textColor=C_PRIMARY),
        "title_white": ParagraphStyle("SFTitleW", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=14, leading=18, textColor=C_WHITE, alignment=TA_RIGHT),
        "badge_gold": ParagraphStyle("SFBadgeG", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=C_GOLD_TINT, alignment=TA_RIGHT),
        "h1": ParagraphStyle("SFH1", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=12, leading=16, textColor=C_PRIMARY, spaceBefore=10, spaceAfter=4),
        "h2": ParagraphStyle("SFH2", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=10.5, leading=14, textColor=C_PRIMARY, spaceBefore=8, spaceAfter=3),
        "body": ParagraphStyle("SFBody", parent=base["Normal"], fontName="Helvetica", fontSize=9, leading=13, textColor=C_CHARCOAL, spaceAfter=4),
        "body_right": ParagraphStyle("SFBodyR", parent=base["Normal"], fontName="Helvetica", fontSize=9, leading=13, textColor=C_CHARCOAL, alignment=TA_RIGHT),
        "body_bold": ParagraphStyle("SFBodyB", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=9, leading=13, textColor=C_CHARCOAL),
        "muted": ParagraphStyle("SFMuted", parent=base["Normal"], fontName="Helvetica-Oblique", fontSize=8, leading=11, textColor=C_STONE),
        "caption": ParagraphStyle("SFCap", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=8.5, leading=11, textColor=C_PRIMARY, spaceBefore=5, spaceAfter=2),
        "cell": ParagraphStyle("SFCell", parent=base["Normal"], fontName="Helvetica", fontSize=8.2, leading=10.5, textColor=C_CHARCOAL),
        "cell_right": ParagraphStyle("SFCellR", parent=base["Normal"], fontName="Helvetica", fontSize=8.2, leading=10.5, textColor=C_CHARCOAL, alignment=TA_RIGHT),
        "cell_center": ParagraphStyle("SFCellC", parent=base["Normal"], fontName="Helvetica", fontSize=8.2, leading=10.5, textColor=C_CHARCOAL, alignment=TA_CENTER),
        "cell_bold": ParagraphStyle("SFCellB", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=8.2, leading=10.5, textColor=C_PRIMARY_DARK),
        "cell_bold_right": ParagraphStyle("SFCellBR", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=8.2, leading=10.5, textColor=C_PRIMARY_DARK, alignment=TA_RIGHT),
        "hdr": ParagraphStyle("SFHdr", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=8.2, leading=10.5, textColor=C_WHITE),
        "hdr_right": ParagraphStyle("SFHdrR", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=8.2, leading=10.5, textColor=C_WHITE, alignment=TA_RIGHT),
        "hdr_center": ParagraphStyle("SFHdrC", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=8.2, leading=10.5, textColor=C_WHITE, alignment=TA_CENTER),
    }


def _make_numbered_canvas(header_label: str, classification: str, footer_left: str):
    class StockFlowCanvas(canvas.Canvas):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self._saved_page_states = []

        def showPage(self):
            self._saved_page_states.append(dict(self.__dict__))
            self._startPage()

        def save(self):
            total = len(self._saved_page_states)
            for state in self._saved_page_states:
                self.__dict__.update(state)
                self._draw_chrome(total)
                super().showPage()
            super().save()

        def _draw_chrome(self, total_pages: int):
            w, h = A4
            self.saveState()
            # Top Forest Pine thin brand stripe + Terracotta micro-bar
            self.setFillColor(C_PRIMARY)
            self.rect(0, h - 5 * mm, w, 5 * mm, stroke=0, fill=1)
            self.setFillColor(C_ACCENT)
            self.rect(0, h - 6.2 * mm, 52 * mm, 1.2 * mm, stroke=0, fill=1)

            # Running header
            self.setFont("Helvetica", 7.5)
            self.setFillColor(C_STONE_LIGHT)
            self.drawString(18 * mm, h - 12 * mm, header_label)
            self.drawRightString(w - 18 * mm, h - 12 * mm, classification)
            self.setStrokeColor(C_SAND)
            self.setLineWidth(0.5)
            self.line(18 * mm, h - 13.8 * mm, w - 18 * mm, h - 13.8 * mm)

            # Running footer
            self.line(18 * mm, 14.5 * mm, w - 18 * mm, 14.5 * mm)
            self.drawString(18 * mm, 10.5 * mm, footer_left)
            self.drawRightString(w - 18 * mm, 10.5 * mm, f"Halaman {self._pageNumber} dari {total_pages}")
            self.restoreState()

    return StockFlowCanvas


def _make_banner_table(styles, title: str, subtitle: str, badge: str, logo_path: Path) -> Table:
    left_flow: List[Any] = []
    if logo_path.exists():
        from PIL import Image as PILImage
        with PILImage.open(logo_path) as im:
            iw, ih = im.size
        target_w = 4.2 * cm
        target_h = target_w * (ih / max(iw, 1))
        if target_h > 1.6 * cm:
            target_h = 1.6 * cm
            target_w = target_h * (iw / max(ih, 1))
        left_flow.append(RLImage(str(logo_path), width=target_w, height=target_h))
        left_flow.append(Spacer(1, 3))
    left_flow.append(Paragraph(subtitle.replace("\n", "<br/>"), styles["muted"]))

    right_flow = [
        Paragraph(badge.upper(), styles["badge_gold"]),
        Spacer(1, 2),
        Paragraph(title.replace("\n", "<br/>"), styles["title_white"]),
    ]

    tbl = Table([[left_flow, right_flow]], colWidths=[11.0 * cm, 6.4 * cm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), C_ALABASTER),
        ("BACKGROUND", (1, 0), (1, 0), C_PRIMARY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
        ("LINEABOVE", (0, 0), (-1, 0), 2.0, C_PRIMARY),
        ("LINEBELOW", (0, 0), (-1, 0), 1.5, C_ACCENT),
    ]))
    return tbl


def _make_callout_box(styles, title: str, body: str, bg=C_PRIMARY_TINT, border=C_PRIMARY) -> Table:
    content = Paragraph(
        f'<font color="#{border.hexval()[2:]}"><b>{title}</b></font><br/>{body}',
        styles["body"],
    )
    tbl = Table([[content]], colWidths=[17.4 * cm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("LINEBEFORE", (0, 0), (0, -1), 3.5, border),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return tbl


def _make_data_table(
    styles,
    headers: Sequence[str],
    rows: Sequence[Sequence[str]],
    col_widths: Sequence[float],
    right_cols: set,
    center_cols: Optional[set] = None,
    bold_last_row: bool = False,
    header_color=C_PRIMARY,
) -> Table:
    center_cols = center_cols or set()
    data_grid: List[List[Any]] = []
    hdr_row = []
    for idx, h in enumerate(headers):
        st = styles["hdr_right"] if idx in right_cols else (styles["hdr_center"] if idx in center_cols else styles["hdr"])
        hdr_row.append(Paragraph(str(h), st))
    data_grid.append(hdr_row)

    for r_i, row in enumerate(rows):
        is_last_bold = bold_last_row and (r_i == len(rows) - 1)
        p_row = []
        for c_i, val in enumerate(row):
            if is_last_bold:
                st = styles["cell_bold_right"] if c_i in right_cols else styles["cell_bold"]
            elif c_i in right_cols:
                st = styles["cell_right"]
            elif c_i in center_cols:
                st = styles["cell_center"]
            else:
                st = styles["cell"]
            p_row.append(Paragraph(str(val), st))
        data_grid.append(p_row)

    tbl = Table(data_grid, colWidths=list(col_widths), repeatRows=1)
    ts = [
        ("BACKGROUND", (0, 0), (-1, 0), header_color),
        ("LINEBELOW", (0, 0), (-1, 0), 1.2, C_ACCENT),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("GRID", (0, 1), (-1, -1), 0.35, C_SAND),
    ]
    for r_i in range(len(rows)):
        row_idx = r_i + 1
        if bold_last_row and r_i == len(rows) - 1:
            ts.append(("BACKGROUND", (0, row_idx), (-1, row_idx), C_PRIMARY_TINT))
            ts.append(("LINEABOVE", (0, row_idx), (-1, row_idx), 0.9, C_PRIMARY))
            ts.append(("LINEBELOW", (0, row_idx), (-1, row_idx), 1.4, C_PRIMARY))
        elif r_i % 2 == 1:
            ts.append(("BACKGROUND", (0, row_idx), (-1, row_idx), C_ALABASTER))
        else:
            ts.append(("BACKGROUND", (0, row_idx), (-1, row_idx), C_WHITE))

    tbl.setStyle(TableStyle(ts))
    return tbl


def _make_signature_table(styles, signers: Sequence[dict]) -> Table:
    w = 17.4 * cm / max(len(signers), 1)
    hdr = [Paragraph(s["role"], styles["hdr_center"]) for s in signers]
    sp_row = [Paragraph("<br/><br/><br/>( ...................................... )", styles["cell_center"]) for _ in signers]
    meta_row = [
        Paragraph(f"<b>{s['name']}</b><br/>{s['title']}<br/><font color='#{PALETTE['stone']}'>Tgl: {s.get('date', '31 Mar 2026')}</font>", styles["cell_center"])
        for s in signers
    ]
    tbl = Table([hdr, sp_row, meta_row], colWidths=[w] * len(signers))
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), C_PRIMARY),
        ("BACKGROUND", (0, 1), (-1, 1), C_WHITE),
        ("BACKGROUND", (0, 2), (-1, 2), C_ALABASTER),
        ("GRID", (0, 0), (-1, -1), 0.4, C_SAND),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return tbl


def _create_doc(out_path: str | Path, title: str):
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    return SimpleDocTemplate(
        str(out),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=title,
        author="StockFlow Document Engine",
    )


# =============================================================================
# 1. SALES INVOICE (.PDF)
# =============================================================================

def build_invoice_pdf(out_path: str | Path, data: Optional[dict] = None, logo_path: Optional[str] = None) -> Path:
    d = data or get_invoice_data()
    comp = d["company"]
    cust = d["customer"]
    logo = resolve_logo_path(logo_path)
    styles = _build_styles()
    doc = _create_doc(out_path, f"StockFlow Sales Invoice {d['invoice_no']}")

    story: List[Any] = [
        _make_banner_table(
            styles,
            title=f"INVOICE\n{d['invoice_no']}",
            subtitle=f"<b>{comp['legal_name']}</b>\n{comp['address']}\nTelp: {comp['phone']} | {comp['email']} | NPWP: {comp['npwp_company']}",
            badge="Faktur Penjualan Resmi",
            logo_path=logo,
        ),
        Spacer(1, 10),
        _make_data_table(
            styles,
            headers=["Kepada Pelanggan (Bill To)", "Informasi Faktur & Pembayaran"],
            rows=[
                [f"<b>{cust['name']}</b><br/>UP: {cust['contact']}<br/>{cust['address']}<br/>Telp: {cust['phone']} | NPWP: {cust['npwp']}",
                 f"<b>No. Invoice:</b> {d['invoice_no']}<br/><b>Ref. PO:</b> {d['po_ref']}<br/><b>Tgl Terbit:</b> {d['issue_date']}<br/><b>Jatuh Tempo:</b> {d['due_date']} ({d['payment_terms']})"],
            ],
            col_widths=[9.6 * cm, 7.8 * cm],
            right_cols=set(),
        ),
        Spacer(1, 10),
        Paragraph("Rincian Item Penjualan Furnitur & Homeware", styles["h2"]),
    ]

    item_rows = []
    gross_sub = 0
    tot_disc = 0
    for idx, it in enumerate(d["items"], start=1):
        lg = it["qty"] * it["unit_price"]
        ln = lg - it.get("discount", 0)
        gross_sub += lg
        tot_disc += it.get("discount", 0)
        item_rows.append([str(idx), it["sku"], it["name"], f"{it['qty']} {it['unit']}", format_idr(it["unit_price"]), format_idr(it.get("discount", 0)), format_idr(ln)])

    net_sub = gross_sub - tot_disc
    dpp_lain = round(net_sub * d["dpp_ratio"])
    ppn_amt = round(dpp_lain * d["ppn_statutory_rate"])
    grand = net_sub + ppn_amt

    story.append(
        _make_data_table(
            styles,
            headers=["No", "SKU", "Deskripsi Barang", "Qty", "Harga Satuan", "Diskon", "Subtotal Netto"],
            rows=item_rows,
            col_widths=[0.9 * cm, 2.3 * cm, 5.7 * cm, 1.5 * cm, 2.3 * cm, 2.1 * cm, 2.6 * cm],
            right_cols={3, 4, 5, 6},
            center_cols={0, 1},
        )
    )
    story.append(Spacer(1, 8))
    story.append(
        _make_data_table(
            styles,
            headers=["Ringkasan Perhitungan Faktur & PPN (PMK 131/2024)", "Nominal (IDR)"],
            rows=[
                ["Subtotal Harga Kotor", format_idr(gross_sub)],
                ["Total Diskon Penjualan", f"- {format_idr(tot_disc)}"],
                ["Subtotal Netto (Harga Jual)", format_idr(net_sub)],
                ["DPP Nilai Lain (11/12 x Subtotal Netto)", format_idr(dpp_lain)],
                ["PPN 12% atas DPP Nilai Lain (Tarif Efektif 11%)", format_idr(ppn_amt)],
                ["GRAND TOTAL TAGIHAN", format_idr(grand)],
            ],
            col_widths=[12.4 * cm, 5.0 * cm],
            right_cols={1},
            bold_last_row=True,
        )
    )
    story.append(Spacer(1, 8))
    story.append(
        _make_callout_box(
            styles,
            title="Instruksi Pembayaran & Ketentuan",
            body=f"<b>Rekening Resmi:</b> {comp['bank_info']}<br/>" + "<br/>".join(f"• {n}" for n in d["notes"]),
            bg=C_ACCENT_TINT,
            border=C_ACCENT,
        )
    )
    story.append(Spacer(1, 10))
    story.append(
        _make_signature_table(
            styles,
            [
                {"role": "Sales / Penjualan", "name": "Dewi Lestari (Contoh)", "title": "Showroom Sales Executive", "date": d["issue_date"]},
                {"role": "Verifikasi Finance", "name": "Siti Rahmawati (Contoh)", "title": "Senior Accountant", "date": d["issue_date"]},
                {"role": "Penerima / Pelanggan", "name": cust["contact"], "title": cust["name"], "date": "................."},
            ],
        )
    )

    doc.build(story, canvasmaker=_make_numbered_canvas(f"STOCKFLOW INVOICE — {d['invoice_no']}", "DOKUMEN KOMERSIAL", f"{comp['brand']} | {comp['legal_name']}"))
    return Path(out_path)


# =============================================================================
# 2. FINANCIAL REPORT 2026 (.PDF)
# =============================================================================

def build_financial_pdf(out_path: str | Path, data: Optional[dict] = None, logo_path: Optional[str] = None) -> Path:
    d = data or get_financial_data()
    comp = d["company"]
    logo = resolve_logo_path(logo_path)
    styles = _build_styles()
    doc = _create_doc(out_path, f"StockFlow Financial Report {d['period']}")

    story: List[Any] = [
        _make_banner_table(
            styles,
            title="LAPORAN KEUANGAN\nQ1 2026",
            subtitle=f"<b>{comp['legal_name']}</b>\nPeriode: {d['period']} | Kode: {d['report_code']}",
            badge="Laporan Eksekutif PSAK",
            logo_path=logo,
        ),
        Spacer(1, 8),
        _make_callout_box(
            styles,
            title="Ringkasan Eksekutif (BLUF)",
            body=(
                "Penjualan Bersih Q1 2026 mencapai <b>Rp 1.600.000.000</b> dengan Gross Margin <b>41,3%</b> (Rp 660 Jt) "
                "dan Laba Bersih <b>Rp 178.000.000</b> (Net Margin 11,1%). Neraca terverifikasi seimbang "
                "(Total Aset = Liabilitas + Ekuitas = <b>Rp 2.715.000.000</b>) dan saldo Kas & Bank akhir Rp 795.000.000."
            ),
            bg=C_PRIMARY_TINT,
            border=C_PRIMARY,
        ),
        Spacer(1, 6),
        Paragraph("1. Laporan Laba Rugi (Income Statement — Q1 2026)", styles["h1"]),
        _make_data_table(
            styles,
            headers=["Kode", "Komponen Laba Rugi", "Nominal Q1 2026 (Rp)", "% Net Sales"],
            rows=[
                ["4101", "Penjualan Kotor Furnitur & Homeware", "Rp 1.680.000.000", "105,0%"],
                ["4102-03", "(-) Retur & Diskon Penjualan", "(Rp 80.000.000)", "(5,0%)"],
                ["SUBTOTAL", "Penjualan Bersih (Net Sales)", "Rp 1.600.000.000", "100,0%"],
                ["5101", "(-) Harga Pokok Penjualan (COGS — WAC)", "(Rp 940.000.000)", "(58,8%)"],
                ["SUBTOTAL", "Laba Kotor (Gross Profit)", "Rp 660.000.000", "41,3%"],
                ["6101-07", "(-) Total Beban Operasional (Gaji, BPJS Er, Sewa, Logistik, Penyusutan)", "(Rp 460.000.000)", "(28,8%)"],
                ["SUBTOTAL", "Laba Operasional (EBIT)", "Rp 200.000.000", "12,5%"],
                ["7101/7201", "Pendapatan Jasa Giro (+Rp 12 Jt) & Beban Bunga (-Rp 12 Jt)", "Rp 0", "0,0%"],
                ["7301", "(-) Estimasi Beban PPh Badan (11% Fasilitas)", "(Rp 22.000.000)", "(1,4%)"],
                ["TOTAL", "LABA BERSIH PERIODE BERJALAN (NET PROFIT)", "Rp 178.000.000", "11,1%"],
            ],
            col_widths=[2.0 * cm, 9.2 * cm, 3.8 * cm, 2.4 * cm],
            right_cols={2, 3},
            center_cols={0},
            bold_last_row=True,
        ),
        Spacer(1, 6),
    ]

    tmp_files = []
    try:
        fd, chart_png = tempfile.mkstemp(prefix="sf_pdf_chart_", suffix=".png")
        os.close(fd)
        tmp_files.append(chart_png)
        mt = d["monthly_trend"]
        render_chart_png(
            {
                "title": "Tren Pendapatan, HPP & Laba Bersih (Okt 2025 – Mar 2026)",
                "subtitle": "Dalam Jutaan Rupiah (IDR)",
                "chartType": "column",
                "categories": mt["months"],
                "unitPrefix": "Rp ",
                "unitSuffix": " Jt",
                "series": [
                    {"name": "Pendapatan", "values": mt["revenue_jt"]},
                    {"name": "HPP (COGS)", "values": mt["cogs_jt"]},
                    {"name": "Laba Bersih", "values": mt["net_profit_jt"]},
                ],
            },
            chart_png,
        )
        story.append(RLImage(chart_png, width=16.6 * cm, height=9.3 * cm))
        story.append(Paragraph("Gambar 1. Grafik Tren Kinerja Keuangan 6 Bulan Terakhir — Sumber: StockFlow ERP (2026).", styles["muted"]))
        story.append(Spacer(1, 8))

        story.append(Paragraph("2. Laporan Posisi Keuangan (Neraca per 31 Maret 2026)", styles["h1"]))
        story.append(
            _make_data_table(
                styles,
                headers=["Kode", "Pos Neraca", "Saldo Akhir (Rp)", "Komposisi"],
                rows=[
                    ["1101-02", "Kas & Bank Operasional", "Rp 795.000.000", "29,3%"],
                    ["1103", "Piutang Usaha (AR)", "Rp 215.000.000", "7,9%"],
                    ["1104", "Persediaan Barang Dagang (WAC)", "Rp 645.000.000", "23,8%"],
                    ["1105", "PPN Masukan & Biaya Dibayar Dimuka", "Rp 45.000.000", "1,7%"],
                    ["1201-09", "Aset Tetap Netto (setelah Akumulasi Penyusutan)", "Rp 1.015.000.000", "37,4%"],
                    ["ASET", "TOTAL ASET", "Rp 2.715.000.000", "100,0%"],
                    ["2101-04", "Liabilitas Lancar (AP, Utang Pajak, Akrual BPJS)", "Rp 392.000.000", "14,4%"],
                    ["2201", "Pinjaman Bank Jangka Panjang", "Rp 420.000.000", "15,5%"],
                    ["3101-3301", "Ekuitas (Modal Rp 1,5 M + Laba Ditahan Rp 225 Jt + Laba Q1 Rp 178 Jt)", "Rp 1.903.000.000", "70,1%"],
                    ["CHECK", "TOTAL LIABILITAS & EKUITAS (SELISIH = Rp 0 — SEIMBANG)", "Rp 2.715.000.000", "100,0%"],
                ],
                col_widths=[2.0 * cm, 9.2 * cm, 3.8 * cm, 2.4 * cm],
                right_cols={2, 3},
                center_cols={0},
                bold_last_row=True,
            )
        )
        story.append(Spacer(1, 8))

        story.append(Paragraph("3. Ringkasan Laporan Arus Kas (Direct Method — Q1 2026)", styles["h1"]))
        story.append(
            _make_data_table(
                styles,
                headers=["Aktivitas Arus Kas", "Nominal (Rp)"],
                rows=[
                    ["Arus Kas Bersih dari Aktivitas Operasi", "Rp 223.000.000"],
                    ["Arus Kas Bersih dari Aktivitas Investasi (Rak Gudang & Showroom)", "(Rp 100.000.000)"],
                    ["Arus Kas Bersih dari Aktivitas Pendanaan (Modal Kerja Netto)", "Rp 60.000.000"],
                    ["Kenaikan Bersih Kas & Bank Q1 2026", "Rp 183.000.000"],
                    ["Saldo Kas & Bank Awal Periode (1 Januari 2026)", "Rp 612.000.000"],
                    ["SALDO KAS & BANK AKHIR (TEREKONSILIASI DENGAN NERACA)", "Rp 795.000.000"],
                ],
                col_widths=[12.4 * cm, 5.0 * cm],
                right_cols={1},
                bold_last_row=True,
            )
        )
        story.append(Spacer(1, 10))
        story.append(
            _make_signature_table(
                styles,
                [
                    {"role": "Disusun Oleh", "name": "Siti Rahmawati (Contoh)", "title": "Senior Accountant", "date": "31 Mar 2026"},
                    {"role": "Diperiksa Oleh", "name": "Hendra Wijaya (Contoh)", "title": "Operations Manager", "date": "31 Mar 2026"},
                    {"role": "Disetujui Oleh", "name": "Direksi PT Karya Berdua", "title": "Managing Director", "date": "31 Mar 2026"},
                ],
            )
        )

        doc.build(story, canvasmaker=_make_numbered_canvas(f"STOCKFLOW FINANCIAL REPORT — {d['report_code']}", "RAHASIA MANAJEMEN", f"{comp['brand']} | {comp['legal_name']}"))
    finally:
        for tf in tmp_files:
            try:
                os.remove(tf)
            except OSError:
                pass
    return Path(out_path)


# =============================================================================
# 3. INVENTORY STOCK OPNAME WORKSHEET (.PDF)
# =============================================================================

def build_opname_pdf(out_path: str | Path, data: Optional[dict] = None, logo_path: Optional[str] = None) -> Path:
    d = data or get_opname_data()
    comp = d["company"]
    logo = resolve_logo_path(logo_path)
    styles = _build_styles()
    doc = _create_doc(out_path, f"StockFlow Stock Opname Sheet {d['opname_no']}")

    story: List[Any] = [
        _make_banner_table(
            styles,
            title=f"STOCK OPNAME\n{d['opname_no']}",
            subtitle=f"<b>{comp['legal_name']}</b>\nLokasi: {d['warehouse']}\nTanggal Hitung: {d['opname_date']} | Supervisor: {d['supervisor']}",
            badge="Formulir Audit Fisik Gudang",
            logo_path=logo,
        ),
        Spacer(1, 8),
        _make_callout_box(
            styles,
            title="Instruksi Pelaksanaan Stock Opname (Blind/Verified Count)",
            body=(
                "1) Petugas wajib memindai barcode/SKU fisik di rak gudang dan mencatat jumlah aktual pada kolom 'Stok Fisik'. "
                "2) Selisih (Fisik - Sistem) wajib diberi keterangan kondisi barang (Baik / Rusak / Display). "
                "3) Penyesuaian stok di sistem memerlukan persetujuan Warehouse Supervisor & Operations Manager."
            ),
            bg=C_GOLD_TINT,
            border=C_GOLD,
        ),
        Spacer(1, 6),
        Paragraph("Lembar Perhitungan Fisik Persediaan Furnitur & Homeware", styles["h2"]),
    ]

    op_rows = []
    tot_sys = 0
    for idx, it in enumerate(d["items"], start=1):
        sys_qty = it["opening_qty"] + it["stock_in"] - it["stock_out"]
        tot_sys += sys_qty
        op_rows.append([
            str(idx),
            f"{it['sku']}<br/><font color='#{PALETTE['stone']}' size='7'>{it['barcode']}</font>",
            it["name"],
            it["warehouse"],
            f"{sys_qty} {it['unit']}",
            "________",
            "________",
            "[ ] Baik  [ ] Rusak",
        ])
    op_rows.append(["TOTAL", f"{len(d['items'])} SKU", "Total Kuantitas Seluruh Item", "-", str(tot_sys), "________", "________", "Diverifikasi"])

    story.append(
        _make_data_table(
            styles,
            headers=["No", "SKU / Barcode", "Nama Produk", "Gudang", "Stok Sistem", "Stok Fisik", "Selisih", "Kondisi / Catatan"],
            rows=op_rows,
            col_widths=[0.8 * cm, 2.5 * cm, 4.9 * cm, 1.8 * cm, 1.8 * cm, 1.6 * cm, 1.5 * cm, 2.5 * cm],
            right_cols={4},
            center_cols={0, 3, 5, 6},
            bold_last_row=True,
        )
    )
    story.append(Spacer(1, 10))
    story.append(
        _make_signature_table(
            styles,
            [
                {"role": "Petugas Hitung (Counter)", "name": "Budi Santoso (Contoh)", "title": "Warehouse Coordinator", "date": d["opname_date"]},
                {"role": "Supervisor Gudang", "name": "Agus Setiawan (Contoh)", "title": "Warehouse Supervisor", "date": d["opname_date"]},
                {"role": "Verifikator Keuangan", "name": "Siti Rahmawati (Contoh)", "title": "Senior Accountant", "date": d["opname_date"]},
            ],
        )
    )

    doc.build(story, canvasmaker=_make_numbered_canvas(f"STOCKFLOW STOCK OPNAME — {d['opname_no']}", "INTERNAL OPERASIONAL", f"{comp['brand']} | Audit Fisik Persediaan"))
    return Path(out_path)


# =============================================================================
# 4. CONFIDENTIAL EMPLOYEE PAYSLIP (.PDF)
# =============================================================================

def build_payslip_pdf(out_path: str | Path, data: Optional[dict] = None, logo_path: Optional[str] = None) -> Path:
    d = data or get_payslip_data()
    comp = d["company"]
    emp = d["employee"]
    tot = d["totals"]
    logo = resolve_logo_path(logo_path)
    styles = _build_styles()
    doc = _create_doc(out_path, f"StockFlow Employee Payslip {d['slip_no']}")

    story: List[Any] = [
        _make_banner_table(
            styles,
            title=f"SLIP GAJI\n{d['slip_no']}",
            subtitle=f"<b>{comp['legal_name']}</b>\nPeriode: {d['period']} | Tanggal Bayar: {d['pay_date']}",
            badge="Pribadi & Rahasia",
            logo_path=logo,
        ),
        Spacer(1, 8),
        _make_data_table(
            styles,
            headers=["Identitas Karyawan (Masked PII)", "Jabatan, Kehadiran & Rekening"],
            rows=[
                [f"<b>ID Karyawan:</b> {emp['emp_id']}<br/><b>Nama:</b> {emp['name']}<br/><b>NIK:</b> {emp['nik_masked']}<br/><b>NPWP:</b> {emp['npwp_masked']}",
                 f"<b>Departemen:</b> {emp['dept']}<br/><b>Jabatan:</b> {emp['position']}<br/><b>PTKP / TER:</b> {emp['ptkp']} ({emp['ter_rate']*100:.2f}%) | <b>Hadir:</b> {emp['present_days']} Hr<br/><b>Rekening:</b> {emp['bank_masked']}"],
            ],
            col_widths=[8.7 * cm, 8.7 * cm],
            right_cols=set(),
        ),
        Spacer(1, 8),
        Paragraph("A. Rincian Penghasilan (Earnings)", styles["h2"]),
        _make_data_table(
            styles,
            headers=["Komponen Penghasilan", "Nominal (IDR)"],
            rows=[[e["label"], format_idr(e["amount"])] for e in d["earnings"]] + [["TOTAL PENGHASILAN BRUTO (GROSS)", format_idr(tot["gross"])]],
            col_widths=[12.4 * cm, 5.0 * cm],
            right_cols={1},
            bold_last_row=True,
        ),
        Spacer(1, 8),
        Paragraph("B. Rincian Potongan Wajib Karyawan (Deductions)", styles["h2"]),
        _make_data_table(
            styles,
            headers=["Komponen Potongan Karyawan (PPh 21 TER & BPJS Karyawan)", "Nominal (IDR)"],
            rows=[[x["label"], format_idr(x["amount"])] for x in d["deductions"]] + [["TOTAL POTONGAN KARYAWAN", format_idr(tot["deductions"])]],
            col_widths=[12.4 * cm, 5.0 * cm],
            right_cols={1},
            bold_last_row=True,
            header_color=C_ACCENT,
        ),
        Spacer(1, 8),
        _make_callout_box(
            styles,
            title=f"GAJI BERSIH DITERIMA (TAKE HOME PAY):  {format_idr(tot['net'])}",
            body=f"Ditransfer ke rekening <b>{emp['bank_masked']}</b> pada tanggal {d['pay_date']}. (Gross {format_idr(tot['gross'])} - Potongan {format_idr(tot['deductions'])}).",
            bg=C_PRIMARY_TINT,
            border=C_PRIMARY,
        ),
        Spacer(1, 8),
        Paragraph("C. Informasi Benefit BPJS Ditanggung Perusahaan (Tidak Memotong THP)", styles["h2"]),
        _make_data_table(
            styles,
            headers=["Iuran BPJS Ditanggung Perusahaan (Beban Akun 6102)", "Nilai Manfaat (IDR)"],
            rows=[[x["label"], format_idr(x["amount"])] for x in d["employer_contributions"]] + [["TOTAL BENEFIT BPJS PERUSAHAAN", format_idr(tot["employer_bpjs_total"])]],
            col_widths=[12.4 * cm, 5.0 * cm],
            right_cols={1},
            bold_last_row=True,
        ),
        Spacer(1, 4),
        Paragraph("Catatan Privasi: Slip gaji ini dihasilkan secara otomatis oleh modul HR & Payroll StockFlow (IDOR-Protected; hanya dapat diakses pemilik slip, HR Payroll, Manager, atau Admin).", styles["muted"]),
        Spacer(1, 8),
        _make_signature_table(
            styles,
            [
                {"role": "HR & Payroll", "name": "Rina Kusuma (Contoh)", "title": "HR & Payroll Lead", "date": d["pay_date"]},
                {"role": "Finance Approval", "name": "Siti Rahmawati (Contoh)", "title": "Senior Accountant", "date": d["pay_date"]},
                {"role": "Karyawan", "name": emp["name"], "title": emp["position"], "date": d["pay_date"]},
            ],
        ),
    ]

    doc.build(story, canvasmaker=_make_numbered_canvas(f"SLIP GAJI — {d['slip_no']}", "PRIBADI & RAHASIA", f"{comp['brand']} HR & Payroll — Dokumen Rahasia"))
    return Path(out_path)


# =============================================================================
# ADDITIONAL CLI PDF SUPPORT (TAX & PAYROLL SUMMARY)
# =============================================================================

def build_tax_pdf(out_path: str | Path, data: Optional[dict] = None, logo_path: Optional[str] = None) -> Path:
    d = data or get_tax_data()
    comp = d["company"]
    logo = resolve_logo_path(logo_path)
    styles = _build_styles()
    doc = _create_doc(out_path, f"StockFlow Tax Recap {d['period']}")

    out_rows = []
    tot_out = 0
    for r in d["ppn_keluaran"]:
        dpp = round(r["harga_jual"] * 11 / 12)
        ppn = round(dpp * 0.12)
        tot_out += ppn
        out_rows.append([r["date"], r["faktur"], r["counterparty"], format_idr(r["harga_jual"]), format_idr(dpp), format_idr(ppn)])
    out_rows.append(["TOTAL", "-", "Total PPN Keluaran", "-", "-", format_idr(tot_out)])

    in_rows = []
    tot_in = 0
    for r in d["ppn_masukan"]:
        dpp = round(r["harga_beli"] * 11 / 12)
        ppn = round(dpp * 0.12)
        tot_in += ppn
        in_rows.append([r["date"], r["faktur"], r["supplier"], format_idr(r["harga_beli"]), format_idr(dpp), format_idr(ppn)])
    in_rows.append(["TOTAL", "-", "Total PPN Masukan", "-", "-", format_idr(tot_in)])

    story = [
        _make_banner_table(styles, f"REKAP PAJAK\n{d['period']}", f"<b>{comp['legal_name']}</b>\nPPN (DPP 11/12 x 12%) & PPh 21 TER", "Kepatuhan Pajak", logo),
        Spacer(1, 8),
        _make_callout_box(styles, "Disclaimer Kepatuhan Pajak", d["disclaimer"], C_GOLD_TINT, C_GOLD),
        Spacer(1, 6),
        Paragraph("1. PPN Keluaran (Output VAT)", styles["h2"]),
        _make_data_table(styles, ["Tgl", "No. Faktur", "Pelanggan", "Harga Jual", "DPP 11/12", "PPN 12%"], out_rows, [2.0 * cm, 3.1 * cm, 4.9 * cm, 2.5 * cm, 2.5 * cm, 2.4 * cm], {3, 4, 5}, bold_last_row=True),
        Spacer(1, 8),
        Paragraph("2. PPN Masukan (Input VAT)", styles["h2"]),
        _make_data_table(styles, ["Tgl", "No. Faktur", "Supplier", "Harga Beli", "DPP 11/12", "PPN 12%"], in_rows, [2.0 * cm, 3.1 * cm, 4.9 * cm, 2.5 * cm, 2.5 * cm, 2.4 * cm], {3, 4, 5}, bold_last_row=True),
        Spacer(1, 8),
        _make_callout_box(styles, f"PPN Kurang Bayar Masa Pajak: {format_idr(tot_out - tot_in)}", f"PPN Keluaran ({format_idr(tot_out)}) - PPN Masukan ({format_idr(tot_in)}).", C_PRIMARY_TINT, C_PRIMARY),
    ]
    doc.build(story, canvasmaker=_make_numbered_canvas(f"STOCKFLOW TAX RECAP — {d['report_code']}", "RAHASIA PAJAK", f"{comp['brand']} | {comp['legal_name']}"))
    return Path(out_path)


def build_payroll_pdf(out_path: str | Path, data: Optional[dict] = None, logo_path: Optional[str] = None) -> Path:
    d = data or get_payroll_data()
    comp = d["company"]
    bp = d["bpjs_params"]
    logo = resolve_logo_path(logo_path)
    styles = _build_styles()
    doc = _create_doc(out_path, f"StockFlow Payroll Summary {d['period']}")

    rows = []
    tot_gross = tot_ded = tot_net = tot_er = 0
    for e in d["employees"]:
        gross = e["base_salary"] + e["allowances"] + e["overtime_hours"] * bp["overtime_rate_per_hour"]
        pph = round(gross * e["ter_rate"])
        bpjs_emp = round(e["base_salary"] * bp["emp_jht"]) + round(min(e["base_salary"], bp["jp_cap"]) * bp["emp_jp"]) + round(min(e["base_salary"], bp["kes_cap"]) * bp["emp_kes"])
        bpjs_er = round(e["base_salary"] * (bp["er_jkk"] + bp["er_jkm"] + bp["er_jht"])) + round(min(e["base_salary"], bp["jp_cap"]) * bp["er_jp"]) + round(min(e["base_salary"], bp["kes_cap"]) * bp["er_kes"])
        net = gross - pph - bpjs_emp
        tot_gross += gross
        tot_ded += pph + bpjs_emp
        tot_net += net
        tot_er += bpjs_er
        rows.append([e["emp_id"], e["name"], e["dept"], e["bank_masked"], format_idr(gross), format_idr(pph + bpjs_emp), format_idr(net), format_idr(bpjs_er)])
    rows.append(["TOTAL", f"{len(d['employees'])} Karyawan", "-", "-", format_idr(tot_gross), format_idr(tot_ded), format_idr(tot_net), format_idr(tot_er)])

    story = [
        _make_banner_table(styles, f"REKAP PAYROLL\n{d['period']}", f"<b>{comp['legal_name']}</b>\nConfidential HR Summary — Masked PII", "Rahasia HR", logo),
        Spacer(1, 8),
        _make_data_table(styles, ["ID", "Nama (Contoh)", "Departemen", "Rekening (Masked)", "Gross", "Potongan", "Net THP", "BPJS Prsh"], rows, [1.8 * cm, 2.8 * cm, 2.5 * cm, 2.7 * cm, 2.0 * cm, 1.8 * cm, 2.0 * cm, 1.8 * cm], {4, 5, 6, 7}, bold_last_row=True),
    ]
    doc.build(story, canvasmaker=_make_numbered_canvas(f"STOCKFLOW PAYROLL — {d['report_code']}", "CONFIDENTIAL HR", f"{comp['brand']} | {comp['legal_name']}"))
    return Path(out_path)

#!/usr/bin/env python3
"""
StockFlow Enterprise Word (.docx) Generator — python-docx.

Complies with `corporate-word-admin`, `word-gdocs-master-formatting`, `office-file-builder`,
and StockFlow's STRICT ZERO-BLUE Brand Palette:
- Explicit A4 (21.0 x 29.7 cm), 2.5 cm corporate margins, Calibri clean typography
- Branded header with StockFlow logo & classification; dynamic `Halaman X dari Y` footer
- Built-in Heading 1-3 with `keep_with_next`, Line Spacing 1.15, Widow/Orphan control
- Tables with caption ABOVE, `w:tblHeader` repeat header, `w:cantSplit`, Forest Pine `#1B4332` header,
  Warm Alabaster `#FAF8F5` zebra striping, right-aligned IDR numbers, italicized Source BELOW
- 300 DPI Zero-Blue Charts & Diagrams, Document Control Block, Signature Blocks, & OOXML Theme Patching.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Any, List, Optional, Sequence, Set

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn
from docx.shared import Cm, Pt, RGBColor

from brand_theme import (
    PALETTE,
    patch_ooxml_zero_blue_theme,
    render_chart_png,
    render_diagram_png,
    resolve_logo_path,
)
from sample_data import (
    format_idr,
    get_financial_data,
    get_inventory_data,
    get_invoice_data,
    get_payroll_data,
    get_payslip_data,
    get_tax_data,
)

# =============================================================================
# SHARED ZERO-BLUE PYTHON-DOCX HELPERS
# =============================================================================

RGB_PRIMARY = RGBColor.from_string(PALETTE["primary"])
RGB_ACCENT = RGBColor.from_string(PALETTE["accent"])
RGB_CHARCOAL = RGBColor.from_string(PALETTE["charcoal"])
RGB_STONE = RGBColor.from_string(PALETTE["stone"])
RGB_STONE_LIGHT = RGBColor.from_string(PALETTE["stone_light"])
RGB_SUCCESS = RGBColor.from_string(PALETTE["success"])
RGB_DANGER = RGBColor.from_string(PALETTE["danger"])
RGB_WHITE = RGBColor(0xFF, 0xFF, 0xFF)


def _set_cell_shading(cell, hex_color: str) -> None:
    clean = hex_color.lstrip("#")
    shading = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{clean}"/>')
    cell._tc.get_or_add_tcPr().append(shading)


def _set_cell_margins(cell, top: int = 85, bottom: int = 85, left: int = 120, right: int = 120) -> None:
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement("w:tcMar")
    for side, val in [("top", top), ("bottom", bottom), ("left", left), ("right", right)]:
        node = OxmlElement(f"w:{side}")
        node.set(qn("w:w"), str(val))
        node.set(qn("w:type"), "dxa")
        tcMar.append(node)
    tcPr.append(tcMar)


def _set_cell_borders(cell, top=None, bottom=None, left=None, right=None) -> None:
    tcPr = cell._tc.get_or_add_tcPr()
    tcBorders = OxmlElement("w:tcBorders")
    for side, cfg in [("top", top), ("bottom", bottom), ("left", left), ("right", right)]:
        if cfg is None:
            continue
        el = OxmlElement(f"w:{side}")
        if cfg == "none":
            el.set(qn("w:val"), "none")
        else:
            el.set(qn("w:val"), cfg.get("val", "single"))
            el.set(qn("w:sz"), str(cfg.get("sz", 4)))
            el.set(qn("w:space"), "0")
            el.set(qn("w:color"), cfg.get("color", PALETTE["sand_border"]).lstrip("#"))
        tcBorders.append(el)
    tcPr.append(tcBorders)


def _prevent_row_split(row) -> None:
    trPr = row._tr.get_or_add_trPr()
    trPr.append(OxmlElement("w:cantSplit"))


def _repeat_header(row) -> None:
    trPr = row._tr.get_or_add_trPr()
    trPr.append(OxmlElement("w:tblHeader"))


def _add_xml_field(run, field_name: str) -> None:
    fld1 = OxmlElement("w:fldChar")
    fld1.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = f" {field_name} "
    fld2 = OxmlElement("w:fldChar")
    fld2.set(qn("w:fldCharType"), "separate")
    fld3 = OxmlElement("w:fldChar")
    fld3.set(qn("w:fldCharType"), "end")
    run._r.append(fld1)
    run._r.append(instr)
    run._r.append(fld2)
    run._r.append(fld3)


def _init_corporate_doc(
    header_title: str,
    classification: str = "INTERNAL",
    footer_left: str = "StockFlow — PT Karya Berdua Indonesia",
    different_first_page: bool = False,
) -> Document:
    doc = Document()
    sec = doc.sections[0]
    sec.page_width = Cm(21.0)
    sec.page_height = Cm(29.7)
    sec.top_margin = Cm(2.3)
    sec.bottom_margin = Cm(2.3)
    sec.left_margin = Cm(2.3)
    sec.right_margin = Cm(2.3)
    sec.different_first_page_header_footer = different_first_page

    normal = doc.styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = RGB_CHARCOAL
    normal.paragraph_format.line_spacing = 1.15
    normal.paragraph_format.space_before = Pt(0)
    normal.paragraph_format.space_after = Pt(5)
    normal.paragraph_format.widow_control = True

    for lvl, sz in [(1, 15), (2, 12.5), (3, 11)]:
        h = doc.styles[f"Heading {lvl}"]
        h.font.name = "Calibri"
        h.font.size = Pt(sz)
        h.font.bold = True
        h.font.color.rgb = RGB_PRIMARY
        h.paragraph_format.keep_with_next = True
        h.paragraph_format.space_before = Pt(12 if lvl == 1 else 9)
        h.paragraph_format.space_after = Pt(4)

    # Header
    hp = sec.header.paragraphs[0]
    hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    hr = hp.add_run(f"{header_title}   |   {classification}")
    hr.font.size = Pt(8.5)
    hr.font.color.rgb = RGB_STONE_LIGHT

    # Footer with dynamic PAGE / NUMPAGES
    fp = sec.footer.paragraphs[0]
    fp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r_pre = fp.add_run(f"{footer_left}   |   Halaman ")
    r_pre.font.size = Pt(8.5)
    r_pre.font.color.rgb = RGB_STONE_LIGHT
    r_pg = fp.add_run()
    r_pg.font.size = Pt(8.5)
    r_pg.font.color.rgb = RGB_STONE_LIGHT
    _add_xml_field(r_pg, "PAGE")
    r_mid = fp.add_run(" dari ")
    r_mid.font.size = Pt(8.5)
    r_mid.font.color.rgb = RGB_STONE_LIGHT
    r_num = fp.add_run()
    r_num.font.size = Pt(8.5)
    r_num.font.color.rgb = RGB_STONE_LIGHT
    _add_xml_field(r_num, "NUMPAGES")

    return doc


def _add_brand_banner(doc: Document, title: str, subtitle: str, badge: str, logo_path: Path) -> None:
    tbl = doc.add_table(rows=1, cols=2)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl.autofit = False
    _prevent_row_split(tbl.rows[0])

    c0, c1 = tbl.rows[0].cells[0], tbl.rows[0].cells[1]
    c0.width = Cm(10.6)
    c1.width = Cm(5.8)
    _set_cell_shading(c0, PALETTE["alabaster"])
    _set_cell_shading(c1, PALETTE["primary"])
    _set_cell_margins(c0, 120, 120, 150, 120)
    _set_cell_margins(c1, 120, 120, 140, 140)
    _set_cell_borders(
        c0,
        top={"val": "single", "sz": 18, "color": PALETTE["primary"]},
        bottom={"val": "single", "sz": 12, "color": PALETTE["accent"]},
        left="none",
        right="none",
    )
    _set_cell_borders(
        c1,
        top={"val": "single", "sz": 18, "color": PALETTE["primary"]},
        bottom={"val": "single", "sz": 12, "color": PALETTE["accent"]},
        left="none",
        right="none",
    )

    p0 = c0.paragraphs[0]
    p0.paragraph_format.space_after = Pt(2)
    if logo_path.exists():
        p0.add_run().add_picture(str(logo_path), width=Cm(4.2))
    p_sub = c0.add_paragraph()
    p_sub.paragraph_format.space_before = Pt(3)
    p_sub.paragraph_format.space_after = Pt(0)
    rs = p_sub.add_run(subtitle)
    rs.font.size = Pt(8.5)
    rs.font.color.rgb = RGB_STONE

    p1 = c1.paragraphs[0]
    p1.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p1.paragraph_format.space_after = Pt(3)
    rb = p1.add_run(badge.upper())
    rb.bold = True
    rb.font.size = Pt(8.5)
    rb.font.color.rgb = RGBColor.from_string(PALETTE["gold_tint"])

    p1t = c1.add_paragraph()
    p1t.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p1t.paragraph_format.space_after = Pt(0)
    rt = p1t.add_run(title)
    rt.bold = True
    rt.font.size = Pt(14)
    rt.font.color.rgb = RGB_WHITE

    sp = doc.add_paragraph()
    sp.paragraph_format.space_after = Pt(4)


def _add_callout(doc: Document, title: str, text: str, fill_hex: str = PALETTE["primary_tint"], accent_hex: str = PALETTE["primary"]) -> None:
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = tbl.cell(0, 0)
    cell.width = Cm(16.4)
    _set_cell_shading(cell, fill_hex)
    _set_cell_margins(cell, 100, 100, 160, 130)
    _set_cell_borders(
        cell,
        top="none",
        bottom="none",
        right="none",
        left={"val": "single", "sz": 24, "color": accent_hex},
    )
    _prevent_row_split(tbl.rows[0])
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(0)
    rt = p.add_run(f"{title}\n")
    rt.bold = True
    rt.font.size = Pt(9.5)
    rt.font.color.rgb = RGBColor.from_string(accent_hex)
    rb = p.add_run(text)
    rb.font.size = Pt(9.5)
    rb.font.color.rgb = RGB_CHARCOAL

    sp = doc.add_paragraph()
    sp.paragraph_format.space_after = Pt(4)


def _add_styled_table(
    doc: Document,
    headers: Sequence[str],
    rows: Sequence[Sequence[Any]],
    right_cols: Set[int],
    col_widths_cm: Optional[Sequence[float]] = None,
    caption: Optional[str] = None,
    source: Optional[str] = None,
    bold_last_row: bool = False,
    header_hex: str = PALETTE["primary"],
) -> None:
    if caption:
        pc = doc.add_paragraph()
        pc.paragraph_format.keep_with_next = True
        pc.paragraph_format.space_before = Pt(6)
        pc.paragraph_format.space_after = Pt(3)
        rc = pc.add_run(caption)
        rc.bold = True
        rc.font.size = Pt(9.5)
        rc.font.color.rgb = RGB_PRIMARY

    tbl = doc.add_table(rows=1 + len(rows), cols=len(headers))
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl.autofit = False
    widths = col_widths_cm or [16.4 / max(len(headers), 1)] * len(headers)

    hdr = tbl.rows[0]
    _repeat_header(hdr)
    _prevent_row_split(hdr)
    for c_i, h_txt in enumerate(headers):
        cell = hdr.cells[c_i]
        cell.width = Cm(widths[c_i])
        _set_cell_shading(cell, header_hex)
        _set_cell_margins(cell, 80, 80, 95, 95)
        _set_cell_borders(
            cell,
            top={"val": "single", "sz": 8, "color": header_hex},
            bottom={"val": "single", "sz": 8, "color": PALETTE["accent"]},
            left="none",
            right="none",
        )
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.line_spacing = 1.0
        p.alignment = WD_ALIGN_PARAGRAPH.RIGHT if c_i in right_cols else WD_ALIGN_PARAGRAPH.LEFT
        r = p.add_run(str(h_txt))
        r.bold = True
        r.font.size = Pt(9)
        r.font.color.rgb = RGB_WHITE

    for r_i, r_vals in enumerate(rows):
        row = tbl.rows[r_i + 1]
        _prevent_row_split(row)
        is_last = r_i == len(rows) - 1
        is_bold_row = bold_last_row and is_last
        bg = PALETTE["primary_tint"] if is_bold_row else (PALETTE["alabaster"] if r_i % 2 == 1 else PALETTE["white"])
        for c_i in range(len(headers)):
            cell = row.cells[c_i]
            cell.width = Cm(widths[c_i])
            _set_cell_shading(cell, bg)
            _set_cell_margins(cell, 68, 68, 95, 95)
            _set_cell_borders(
                cell,
                top={"val": "single", "sz": 6, "color": PALETTE["primary"]} if is_bold_row else "none",
                bottom={"val": "double", "sz": 8, "color": PALETTE["primary"]} if is_bold_row else {"val": "single", "sz": 4, "color": PALETTE["sand_border"]},
                left="none",
                right="none",
            )
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.0
            p.alignment = WD_ALIGN_PARAGRAPH.RIGHT if c_i in right_cols else WD_ALIGN_PARAGRAPH.LEFT
            val = r_vals[c_i] if c_i < len(r_vals) else ""
            r = p.add_run(str(val))
            r.font.size = Pt(9)
            r.bold = is_bold_row
            r.font.color.rgb = RGB_PRIMARY if is_bold_row else RGB_CHARCOAL

    if source:
        ps = doc.add_paragraph()
        ps.paragraph_format.space_before = Pt(2)
        ps.paragraph_format.space_after = Pt(6)
        ps.paragraph_format.line_spacing = 1.0
        rs = ps.add_run(source)
        rs.italic = True
        rs.font.size = Pt(8.5)
        rs.font.color.rgb = RGB_STONE
    else:
        sp = doc.add_paragraph()
        sp.paragraph_format.space_after = Pt(3)


def _add_figure(doc: Document, img_path: Path, width_cm: float, caption: str, source: str) -> None:
    p_img = doc.add_paragraph()
    p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_img.paragraph_format.space_before = Pt(6)
    p_img.paragraph_format.space_after = Pt(2)
    p_img.paragraph_format.keep_with_next = True
    p_img.add_run().add_picture(str(img_path), width=Cm(width_cm))

    pc = doc.add_paragraph()
    pc.alignment = WD_ALIGN_PARAGRAPH.CENTER
    pc.paragraph_format.space_before = Pt(2)
    pc.paragraph_format.space_after = Pt(1)
    pc.paragraph_format.keep_with_next = True
    rc = pc.add_run(caption)
    rc.bold = True
    rc.font.size = Pt(9)
    rc.font.color.rgb = RGB_PRIMARY

    ps = doc.add_paragraph()
    ps.alignment = WD_ALIGN_PARAGRAPH.CENTER
    ps.paragraph_format.space_after = Pt(7)
    rs = ps.add_run(source)
    rs.italic = True
    rs.font.size = Pt(8.5)
    rs.font.color.rgb = RGB_STONE


def _add_signature_block(doc: Document, signers: Sequence[dict]) -> None:
    doc.add_heading("Lembar Pengesahan & Otorisasi", level=2)
    headers = [s["role"] for s in signers]
    rows = [
        ["\n\n\n( .................................... )" for _ in signers],
        [f"{s['name']}\n{s['title']}\nTanggal: {s.get('date', '31 Maret 2026')}" for s in signers],
    ]
    tbl = doc.add_table(rows=3, cols=len(signers))
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl.autofit = False
    w = 16.4 / max(len(signers), 1)
    _repeat_header(tbl.rows[0])
    for r_i, row in enumerate(tbl.rows):
        _prevent_row_split(row)
        for c_i in range(len(signers)):
            cell = row.cells[c_i]
            cell.width = Cm(w)
            _set_cell_margins(cell, 70, 70, 80, 80)
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_after = Pt(0)
            if r_i == 0:
                _set_cell_shading(cell, PALETTE["primary"])
                r = p.add_run(headers[c_i])
                r.bold = True
                r.font.size = Pt(9)
                r.font.color.rgb = RGB_WHITE
            else:
                _set_cell_shading(cell, PALETTE["alabaster"] if r_i == 2 else PALETTE["white"])
                _set_cell_borders(
                    cell,
                    top="none",
                    bottom={"val": "single", "sz": 4, "color": PALETTE["sand_border"]},
                    left={"val": "single", "sz": 4, "color": PALETTE["sand_border"]},
                    right={"val": "single", "sz": 4, "color": PALETTE["sand_border"]},
                )
                r = p.add_run(rows[r_i - 1][c_i])
                r.font.size = Pt(9)
                r.bold = (r_i == 2)
                r.font.color.rgb = RGB_CHARCOAL


# =============================================================================
# 1. SALES INVOICE (.DOCX)
# =============================================================================

def build_invoice_docx(out_path: str | Path, data: Optional[dict] = None, logo_path: Optional[str] = None) -> Path:
    d = data or get_invoice_data()
    comp = d["company"]
    cust = d["customer"]
    logo = resolve_logo_path(logo_path)

    doc = _init_corporate_doc(
        header_title=f"FAKTUR PENJUALAN — {d['invoice_no']}",
        classification="DOKUMEN KOMERSIAL RESMI",
        footer_left=f"{comp['brand']} | {comp['legal_name']}",
    )
    _add_brand_banner(
        doc,
        title=f"INVOICE\n{d['invoice_no']}",
        subtitle=f"{comp['legal_name']}\n{comp['address']} | Telp: {comp['phone']} | {comp['email']}",
        badge="Faktur Penjualan Furnitur",
        logo_path=logo,
    )

    # Metadata & Customer Info (2-col repeating-header-compliant summary)
    doc.add_heading("Informasi Pelanggan & Transaksi", level=2)
    _add_styled_table(
        doc,
        headers=["Kepada Pelanggan (Bill To)", "Detail Faktur & Pembayaran"],
        rows=[
            [f"Nama Perusahaan: {cust['name']}", f"Nomor Invoice: {d['invoice_no']}"],
            [f"UP / Kontak: {cust['contact']}", f"Referensi PO: {d['po_ref']}"],
            [f"Alamat: {cust['address']}", f"Tanggal Terbit: {d['issue_date']}"],
            [f"Telepon: {cust['phone']} | NPWP: {cust['npwp']}", f"Jatuh Tempo: {d['due_date']} ({d['payment_terms']})"],
        ],
        right_cols=set(),
        col_widths_cm=[8.8, 7.6],
    )

    # Line items calculation
    doc.add_heading("Rincian Produk Furnitur & Homeware", level=2)
    item_rows = []
    gross_subtotal = 0
    total_disc = 0
    for idx, it in enumerate(d["items"], start=1):
        line_gross = it["qty"] * it["unit_price"]
        line_net = line_gross - it.get("discount", 0)
        gross_subtotal += line_gross
        total_disc += it.get("discount", 0)
        item_rows.append([
            str(idx),
            it["sku"],
            it["name"],
            f"{it['qty']} {it['unit']}",
            format_idr(it["unit_price"]),
            format_idr(it.get("discount", 0)),
            format_idr(line_net),
        ])

    net_subtotal = gross_subtotal - total_disc
    dpp_lain = round(net_subtotal * d["dpp_ratio"])
    ppn_amount = round(dpp_lain * d["ppn_statutory_rate"])
    grand_total = net_subtotal + ppn_amount

    _add_styled_table(
        doc,
        headers=["No", "SKU", "Deskripsi Barang", "Qty", "Harga Satuan", "Diskon", "Subtotal Netto"],
        rows=item_rows,
        right_cols={3, 4, 5, 6},
        col_widths_cm=[0.9, 2.2, 5.2, 1.5, 2.2, 2.0, 2.4],
        caption=f"Tabel 1. Rincian Item Penjualan — {d['invoice_no']}",
        source="Sumber: Sistem POS & Penjualan StockFlow ERP (Harga dalam Rupiah IDR).",
    )

    # PPN & Grand Total breakdown
    doc.add_heading("Ringkasan Pembayaran & Perhitungan PPN (PMK 131/2024)", level=2)
    _add_styled_table(
        doc,
        headers=["Komponen Perhitungan", "Nominal (IDR)"],
        rows=[
            ["Subtotal Harga Kotor", format_idr(gross_subtotal)],
            ["Total Diskon Penjualan", f"- {format_idr(total_disc)}"],
            ["Subtotal Netto (Harga Jual)", format_idr(net_subtotal)],
            ["Dasar Pengenaan Pajak (DPP Nilai Lain 11/12)", format_idr(dpp_lain)],
            ["PPN 12% atas DPP Nilai Lain (Tarif Efektif 11%)", format_idr(ppn_amount)],
            ["GRAND TOTAL YANG HARUS DIBAYAR", format_idr(grand_total)],
        ],
        right_cols={1},
        col_widths_cm=[11.4, 5.0],
        bold_last_row=True,
    )

    _add_callout(
        doc,
        title="Instruksi Pembayaran & Catatan Pengiriman",
        text=f"Transfer ke: {comp['bank_info']}\n" + "\n".join(f"• {n}" for n in d["notes"]),
        fill_hex=PALETTE["accent_tint"],
        accent_hex=PALETTE["accent"],
    )

    _add_signature_block(
        doc,
        [
            {"role": "Diterbitkan Oleh (Sales)", "name": "Dewi Lestari (Contoh)", "title": "Showroom Sales Executive", "date": d["issue_date"]},
            {"role": "Disetujui Oleh (Finance)", "name": "Siti Rahmawati (Contoh)", "title": "Senior Accountant", "date": d["issue_date"]},
            {"role": "Diterima Oleh (Pelanggan)", "name": cust["contact"], "title": cust["name"], "date": "...................."},
        ],
    )

    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    doc.save(out)
    patch_ooxml_zero_blue_theme(out)
    return out


# =============================================================================
# 2. MANAGEMENT FINANCIAL REPORT (.DOCX)
# =============================================================================

def build_financial_docx(out_path: str | Path, data: Optional[dict] = None, logo_path: Optional[str] = None) -> Path:
    d = data or get_financial_data()
    inv = get_inventory_data()
    comp = d["company"]
    logo = resolve_logo_path(logo_path)

    doc = _init_corporate_doc(
        header_title=f"LAPORAN KEUANGAN & OPERASIONAL MANAJEMEN — {d['report_code']}",
        classification="RAHASIA MANAJEMEN",
        footer_left=f"{comp['brand']} | {comp['legal_name']}",
        different_first_page=True,
    )

    # Cover Page
    p_logo = doc.add_paragraph()
    p_logo.paragraph_format.space_before = Pt(32)
    if logo.exists():
        p_logo.add_run().add_picture(str(logo), width=Cm(5.8))

    p_kicker = doc.add_paragraph()
    p_kicker.paragraph_format.space_before = Pt(30)
    rk = p_kicker.add_run("LAPORAN EKSEKUTIF MANAJEMEN & KEUANGAN")
    rk.bold = True
    rk.font.size = Pt(10.5)
    rk.font.color.rgb = RGB_ACCENT

    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_before = Pt(6)
    rt = p_title.add_run("Laporan Kinerja Operasional, Persediaan & Keuangan Q1 2026")
    rt.bold = True
    rt.font.size = Pt(22)
    rt.font.color.rgb = RGB_PRIMARY

    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.space_after = Pt(24)
    rs = p_sub.add_run(f"{comp['legal_name']}\nPeriode Pelaporan: {d['period']} | Metode: Double-Entry PSAK & WAC")
    rs.font.size = Pt(11.5)
    rs.font.color.rgb = RGB_STONE

    # Document Control Block
    _add_styled_table(
        doc,
        headers=["Atribut Kontrol Dokumen", "Keterangan Resmi"],
        rows=[
            ["Nomor Dokumen", d["report_code"]],
            ["Versi & Status", "v2.0 — Final Review Direksi"],
            ["Klasifikasi Keamanan", "Rahasia Internal Manajemen (RBAC: Admin, Manager, Finance)"],
            ["Periode Akuntansi", d["period"]],
            ["Entitas Pelapor", f"{comp['legal_name']} (NPWP: {comp['npwp_company']})"],
            ["Disusun & Diverifikasi", "Divisi Keuangan & Akuntansi — StockFlow ERP v2.0"],
        ],
        right_cols=set(),
        col_widths_cm=[5.4, 11.0],
    )
    doc.add_page_break()

    # Section 1: BLUF Executive Summary
    doc.add_heading("1. Ringkasan Eksekutif (BLUF)", level=1)
    _add_callout(
        doc,
        title="Kesimpulan Utama Kinerja Q1 2026",
        text=(
            "PT Karya Berdua mencatat Penjualan Bersih sebesar Rp 1.600.000.000 pada Q1 2026 dengan Laba Kotor "
            "Rp 660.000.000 (Gross Margin 41,3%) dan Laba Bersih Rp 178.000.000 (Net Margin 11,1%). "
            "Seluruh buku besar Double-Entry terverifikasi seimbang sempurna (Total Aset = Liabilitas + Ekuitas = Rp 2.715.000.000) "
            "dengan posisi Kas & Bank akhir Rp 795.000.000 (+Rp 183.000.000 YoQ)."
        ),
        fill_hex=PALETTE["primary_tint"],
        accent_hex=PALETTE["primary"],
    )

    _add_styled_table(
        doc,
        headers=["Indikator Kinerja Utama (KPI)", "Realisasi Q1 2026", "Target / Benchmark", "Status"],
        rows=[
            ["Penjualan Bersih (Net Sales)", "Rp 1.600.000.000", "Rp 1.500.000.000", "MELAMPAUI (+6,7%)"],
            ["Laba Kotor & Gross Margin", "Rp 660.000.000 (41,3%)", ">= 38,0%", "OPTIMAL"],
            ["Laba Bersih (Net Profit)", "Rp 178.000.000 (11,1%)", ">= 10,0%", "OPTIMAL"],
            ["Saldo Kas & Bank Akhir", "Rp 795.000.000", ">= Rp 650.000.000", "LIKUIDITAS KUAT"],
            ["Balance Sheet Invariant", "Rp 0 (Aset = Liab + Ekuitas)", "Selisih = Rp 0", "TERAUDIT OK"],
        ],
        right_cols={1},
        col_widths_cm=[5.2, 4.4, 3.6, 3.2],
        caption="Tabel 1.1 Ikhtisar Scorecard Kinerja Keuangan Q1 2026",
        source="Sumber: Sistem Akuntansi Double-Entry StockFlow ERP (Data Simulasi Q1 2026).",
    )

    # Section 2: Income Statement & 300 DPI Chart
    doc.add_heading("2. Analisis Laporan Laba Rugi & Tren Profitabilitas", level=1)
    doc.add_paragraph(
        "Pertumbuhan pendapatan ritel furnitur dan homeware selama kuartal pertama 2026 didorong oleh permintaan kategori "
        "Living Room dan Dining Room berbahan kayu jati dan oak solid. Pengendalian biaya pengadaan menggunakan metode "
        "Weighted Average Cost (WAC) menjaga HPP tetap stabil pada 58,8% dari penjualan bersih."
    )

    _add_styled_table(
        doc,
        headers=["Komponen Laporan Laba Rugi", "Nominal Q1 2026 (Rp)", "% Net Sales"],
        rows=[
            ["Penjualan Kotor Furnitur & Homeware", "Rp 1.680.000.000", "105,0%"],
            ["(-) Retur & Diskon Penjualan", "(Rp 80.000.000)", "(5,0%)"],
            ["Penjualan Bersih (Net Sales)", "Rp 1.600.000.000", "100,0%"],
            ["(-) Harga Pokok Penjualan (COGS — WAC)", "(Rp 940.000.000)", "(58,8%)"],
            ["Laba Kotor (Gross Profit)", "Rp 660.000.000", "41,3%"],
            ["(-) Beban Operasional (Gaji, BPJS Er, Sewa, Logistik, dll.)", "(Rp 460.000.000)", "(28,8%)"],
            ["Laba Operasional (EBIT)", "Rp 200.000.000", "12,5%"],
            ["Pendapatan Jasa Giro (+Rp 12 Jt) & Beban Bunga (-Rp 12 Jt)", "Rp 0", "0,0%"],
            ["(-) Estimasi Beban PPh Badan (Fasilitas 11%)", "(Rp 22.000.000)", "(1,4%)"],
            ["LABA BERSIH PERIODE BERJALAN (NET PROFIT)", "Rp 178.000.000", "11,1%"],
        ],
        right_cols={1, 2},
        col_widths_cm=[9.2, 4.4, 2.8],
        caption="Tabel 2.1 Ringkasan Laporan Laba Rugi Q1 2026",
        source="Sumber: Trial Balance & Buku Besar StockFlow ERP (PSAK 1).",
        bold_last_row=True,
    )

    tmp_files = []
    try:
        fd1, chart_png = tempfile.mkstemp(prefix="sf_fin_chart_", suffix=".png")
        os.close(fd1)
        tmp_files.append(chart_png)
        mt = d["monthly_trend"]
        render_chart_png(
            {
                "title": "Tren Pendapatan, HPP & Laba Bersih (Okt 2025 – Mar 2026)",
                "subtitle": "Dalam Jutaan Rupiah (IDR) — PT Karya Berdua Homeware & Furniture",
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
        _add_figure(
            doc,
            Path(chart_png),
            width_cm=15.4,
            caption="Gambar 2.1 Tren Pendapatan, HPP, dan Laba Bersih 6 Bulan Terakhir (300 DPI)",
            source="Sumber: Diolah dari Modul Penjualan & Akuntansi StockFlow ERP (2026).",
        )

        # Section 3: Balance Sheet & Cash Flow Governance
        doc.add_heading("3. Posisi Keuangan (Neraca), Arus Kas & Tata Kelola Risiko", level=1)
        _add_styled_table(
            doc,
            headers=["Kelompok Posisi Keuangan (Per 31 Mar 2026)", "Saldo Akhir (Rp)", "Komposisi"],
            rows=[
                ["Aset Lancar (Kas, Bank, Piutang, Persediaan, PPN Masukan)", "Rp 1.700.000.000", "62,6%"],
                ["Aset Tidak Lancar Netto (Gudang, Rak, Kendaraan - Akum. Susut)", "Rp 1.015.000.000", "37,4%"],
                ["TOTAL ASET", "Rp 2.715.000.000", "100,0%"],
                ["Liabilitas Lancar (AP Supplier, Utang Pajak, Akrual BPJS)", "Rp 392.000.000", "14,4%"],
                ["Liabilitas Jangka Panjang (Pinjaman Bank)", "Rp 420.000.000", "15,5%"],
                ["Ekuitas (Modal Disetor + Laba Ditahan + Laba Q1 2026)", "Rp 1.903.000.000", "70,1%"],
                ["TOTAL LIABILITAS & EKUITAS (SELISIH = Rp 0)", "Rp 2.715.000.000", "100,0%"],
            ],
            right_cols={1, 2},
            col_widths_cm=[9.4, 4.4, 2.6],
            caption="Tabel 3.1 Ringkasan Neraca (Balance Sheet) per 31 Maret 2026",
            source="Sumber: Buku Besar Terintegrasi StockFlow ERP (PSAK 1).",
            bold_last_row=True,
        )

        fd2, diag_png = tempfile.mkstemp(prefix="sf_fin_diag_", suffix=".png")
        os.close(fd2)
        tmp_files.append(diag_png)
        render_diagram_png(
            {
                "title": "Alur Integrasi Otomatis Transaksi ke Laporan Keuangan StockFlow",
                "nodes": [
                    {"title": "1. Operasional", "subtitle": "POS Sales, PO, Goods Receipt & Stock Transfer"},
                    {"title": "2. Valuasi & Pajak", "subtitle": "WAC Costing, PPN DPP 11/12 & PPh 21 TER"},
                    {"title": "3. Jurnal Otomatis", "subtitle": "Double-Entry Ledger (Debit == Kredit, Immutable)"},
                    {"title": "4. Laporan & Audit", "subtitle": "Laba Rugi, Neraca, Arus Kas & RBAC Audit Trail"},
                ],
            },
            diag_png,
        )
        _add_figure(
            doc,
            Path(diag_png),
            width_cm=15.6,
            caption="Gambar 3.1 Arsitektur Aliran Data Transaksi ke Pelaporan Keuangan StockFlow",
            source="Sumber: Dokumentasi Arsitektur Sistem StockFlow v2.0 (2026).",
        )

        # Section 4: Recommendations & References
        doc.add_heading("4. Rekomendasi Aksi Manajemen Q2 2026", level=1)
        recs = [
            "Segera terbitkan Purchase Order (PO) untuk SKU yang menyentuh Reorder Point (Sofa Jati Minimalis, Meja Makan Oak Solid, Lampu Gantung Rotan, dan Meja Kopi Marmer) guna mencegah kehilangan penjualan.",
            "Pertahankan rasio kas operasional di atas Rp 750 Juta dengan penagihan Piutang Usaha (AR) berdisiplin NET 14 Hari.",
            "Lakukan rekonsiliasi faktur pajak PPN Keluaran/Masukan (DPP 11/12) dan bukti potong PPh 21 TER sebelum tanggal 10 setiap bulan.",
        ]
        for rec in recs:
            p = doc.add_paragraph(rec, style="List Bullet")
            p.paragraph_format.space_after = Pt(4)

        doc.add_heading("5. Referensi & Dasar Standar Pelaporan", level=1)
        refs = [
            "Ikatan Akuntan Indonesia (IAI). (2024). Pernyataan Standar Akuntansi Keuangan (PSAK) 1: Penyajian Laporan Keuangan & PSAK 14: Persediaan.",
            "Kementerian Keuangan Republik Indonesia. (2024). Peraturan Menteri Keuangan Nomor 131 Tahun 2024 tentang Perlakuan PPN (DPP Nilai Lain 11/12).",
            "Pemerintah Republik Indonesia. (2023). Peraturan Pemerintah Nomor 58 Tahun 2023 tentang Tarif Pemotongan PPh Pasal 21 (TER).",
            "StockFlow ERP Internal Ledger. (2026). Dataset Simulasi Operasional & Keuangan Q1 2026 PT Karya Berdua Homeware & Furniture Indonesia.",
        ]
        for ref in refs:
            p = doc.add_paragraph(ref)
            p.paragraph_format.line_spacing = 1.0
            p.paragraph_format.left_indent = Cm(1.0)
            p.paragraph_format.first_line_indent = Cm(-1.0)
            p.paragraph_format.space_after = Pt(4)

        _add_signature_block(
            doc,
            [
                {"role": "Disusun Oleh", "name": "Siti Rahmawati (Contoh)", "title": "Senior Accountant", "date": "31 Maret 2026"},
                {"role": "Diperiksa Oleh", "name": "Hendra Wijaya (Contoh)", "title": "Operations Manager", "date": "31 Maret 2026"},
                {"role": "Disetujui Oleh", "name": "Direksi PT Karya Berdua", "title": "Managing Director", "date": "31 Maret 2026"},
            ],
        )

        out = Path(out_path)
        out.parent.mkdir(parents=True, exist_ok=True)
        doc.save(out)
    finally:
        for tf in tmp_files:
            try:
                os.remove(tf)
            except OSError:
                pass

    patch_ooxml_zero_blue_theme(out)
    return out


# =============================================================================
# 3. CONFIDENTIAL EMPLOYEE PAYSLIP (.DOCX)
# =============================================================================

def build_payslip_docx(out_path: str | Path, data: Optional[dict] = None, logo_path: Optional[str] = None) -> Path:
    d = data or get_payslip_data()
    comp = d["company"]
    emp = d["employee"]
    tot = d["totals"]
    logo = resolve_logo_path(logo_path)

    doc = _init_corporate_doc(
        header_title=f"SLIP GAJI KARYAWAN — {d['slip_no']}",
        classification="PRIBADI & RAHASIA (CONFIDENTIAL)",
        footer_left="Dokumen Rahasia HR & Payroll — Hanya untuk Karyawan Bersangkutan",
    )
    _add_brand_banner(
        doc,
        title=f"SLIP GAJI\n{d['slip_no']}",
        subtitle=f"{comp['legal_name']}\nPeriode Penggajian: {d['period']} | Tanggal Bayar: {d['pay_date']}",
        badge="Pribadi & Rahasia",
        logo_path=logo,
    )

    doc.add_heading("Identitas Karyawan & Kehadiran (Data PII Disamarkan)", level=2)
    _add_styled_table(
        doc,
        headers=["Data Karyawan", "Status Kepegawaian & Pembayaran"],
        rows=[
            [f"ID Karyawan: {emp['emp_id']}", f"Departemen: {emp['dept']}"],
            [f"Nama Lengkap: {emp['name']}", f"Jabatan: {emp['position']}"],
            [f"NIK (Masked): {emp['nik_masked']}", f"Status PTKP: {emp['ptkp']} (TER {emp['ter_rate']*100:.2f}%)"],
            [f"NPWP (Masked): {emp['npwp_masked']}", f"Rekening Tujuan: {emp['bank_masked']}"],
            [f"Kehadiran Efektif: {emp['present_days']} Hari Kerja", f"Total Lembur Disetujui: {emp['overtime_hours']} Jam"],
        ],
        right_cols=set(),
        col_widths_cm=[8.2, 8.2],
    )

    doc.add_heading("Rincian Penghasilan (Earnings)", level=2)
    earn_rows = [[e["label"], format_idr(e["amount"])] for e in d["earnings"]]
    earn_rows.append(["TOTAL PENGHASILAN BRUTO (GROSS SALARY)", format_idr(tot["gross"])])
    _add_styled_table(
        doc,
        headers=["Komponen Penghasilan", "Nominal (IDR)"],
        rows=earn_rows,
        right_cols={1},
        col_widths_cm=[11.4, 5.0],
        bold_last_row=True,
    )

    doc.add_heading("Rincian Potongan Karyawan (Employee Deductions)", level=2)
    ded_rows = [[x["label"], format_idr(x["amount"])] for x in d["deductions"]]
    ded_rows.append(["TOTAL POTONGAN KARYAWAN", format_idr(tot["deductions"])])
    _add_styled_table(
        doc,
        headers=["Komponen Potongan Wajib Karyawan", "Nominal (IDR)"],
        rows=ded_rows,
        right_cols={1},
        col_widths_cm=[11.4, 5.0],
        bold_last_row=True,
        header_hex=PALETTE["accent"],
    )

    _add_callout(
        doc,
        title=f"GAJI BERSIH DITERIMA (TAKE HOME PAY):  {format_idr(tot['net'])}",
        text=(
            f"Ditransfer ke rekening {emp['bank_masked']} pada tanggal {d['pay_date']}. "
            "Formula: Gross Salary - Total Potongan Karyawan (PPh 21 TER + BPJS Karyawan)."
        ),
        fill_hex=PALETTE["primary_tint"],
        accent_hex=PALETTE["primary"],
    )

    doc.add_heading("Informasi Benefit BPJS Ditanggung Perusahaan (Tidak Memotong Gaji)", level=2)
    er_rows = [[x["label"], format_idr(x["amount"])] for x in d["employer_contributions"]]
    er_rows.append(["TOTAL IURAN BPJS DITANGGUNG PERUSAHAAN", format_idr(tot["employer_bpjs_total"])])
    _add_styled_table(
        doc,
        headers=["Manfaat BPJS Ditanggung Perusahaan", "Nilai Manfaat (IDR)"],
        rows=er_rows,
        right_cols={1},
        col_widths_cm=[11.4, 5.0],
        bold_last_row=True,
        source="Catatan: Iuran BPJS Perusahaan merupakan beban perusahaan (COA 6102) dan TIDAK memotong Take Home Pay karyawan.",
    )

    _add_signature_block(
        doc,
        [
            {"role": "Diproses Oleh (HR & Payroll)", "name": "Rina Kusuma (Contoh)", "title": "HR & Payroll Lead", "date": d["pay_date"]},
            {"role": "Disetujui Oleh (Finance)", "name": "Siti Rahmawati (Contoh)", "title": "Senior Accountant", "date": d["pay_date"]},
            {"role": "Diterima Oleh (Karyawan)", "name": emp["name"], "title": emp["position"], "date": d["pay_date"]},
        ],
    )

    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    doc.save(out)
    patch_ooxml_zero_blue_theme(out)
    return out


# =============================================================================
# ADDITIONAL CLI DOCX SUPPORT (INVENTORY, TAX, PAYROLL SUMMARY)
# =============================================================================

def build_generic_report_docx(report: str, out_path: str | Path, data: Optional[dict] = None, logo_path: Optional[str] = None) -> Path:
    logo = resolve_logo_path(logo_path)
    if report == "inventory":
        d = data or get_inventory_data()
        doc = _init_corporate_doc("LAPORAN VALUASI PERSEDIAAN", "INTERNAL")
        _add_brand_banner(doc, "VALUASI STOK\nMULTI-GUDANG", f"{d['company']['legal_name']} | {d['period']}", "Laporan Persediaan", logo)
        doc.add_heading("Daftar Valuasi Persediaan (WAC & ROP)", level=2)
        rows = []
        tot_val = 0
        for it in d["items"]:
            end_q = it["opening_qty"] + it["stock_in"] - it["stock_out"]
            val = end_q * it["wac_cost"]
            rop = round(it["avg_daily_demand"] * it["lead_time_days"] + it["safety_stock"])
            tot_val += val
            st = "RESTOCK" if end_q <= rop else ("PANTAU" if end_q <= round(rop * 1.25) else "AMAN")
            rows.append([it["sku"], it["name"], it["warehouse"], str(end_q), format_idr(it["wac_cost"]), format_idr(val), str(rop), st])
        rows.append(["TOTAL", f"{len(d['items'])} SKU", "-", "-", "-", format_idr(tot_val), "-", "-"])
        _add_styled_table(doc, ["SKU", "Produk", "Gudang", "Stok", "WAC", "Nilai WAC", "ROP", "Status"], rows, {3, 4, 5, 6}, bold_last_row=True)
    elif report == "tax":
        d = data or get_tax_data()
        doc = _init_corporate_doc("REKAP PAJAK PPN & PPH 21", "RAHASIA PAJAK")
        _add_brand_banner(doc, "REKAP PAJAK\nPPN & PPH 21", f"{d['company']['legal_name']} | {d['period']}", "Kepatuhan Pajak", logo)
        doc.add_heading("PPN Keluaran (DPP Nilai Lain 11/12 x 12%)", level=2)
        rows = []
        tot_ppn = 0
        for r in d["ppn_keluaran"]:
            dpp = round(r["harga_jual"] * 11 / 12)
            ppn = round(dpp * 0.12)
            tot_ppn += ppn
            rows.append([r["date"], r["faktur"], r["counterparty"], format_idr(r["harga_jual"]), format_idr(dpp), format_idr(ppn)])
        rows.append(["TOTAL", "-", "Total PPN Keluaran", "-", "-", format_idr(tot_ppn)])
        _add_styled_table(doc, ["Tanggal", "No. Faktur", "Pelanggan", "Harga Jual", "DPP 11/12", "PPN 12%"], rows, {3, 4, 5}, bold_last_row=True)
        _add_callout(doc, "Disclaimer Kepatuhan", d["disclaimer"], PALETTE["warning_tint"], PALETTE["warning"])
    else:  # payroll summary
        d = data or get_payroll_data()
        doc = _init_corporate_doc("REKAPITULASI PAYROLL", "CONFIDENTIAL HR")
        _add_brand_banner(doc, "REKAP PAYROLL\nKARYAWAN", f"{d['company']['legal_name']} | {d['period']}", "Rahasia HR", logo)
        doc.add_heading("Ringkasan Payroll & Masked PII", level=2)
        bp = d["bpjs_params"]
        rows = []
        tot_net = 0
        for e in d["employees"]:
            gross = e["base_salary"] + e["allowances"] + e["overtime_hours"] * bp["overtime_rate_per_hour"]
            pph = round(gross * e["ter_rate"])
            bpjs_emp = round(e["base_salary"] * bp["emp_jht"]) + round(min(e["base_salary"], bp["jp_cap"]) * bp["emp_jp"]) + round(min(e["base_salary"], bp["kes_cap"]) * bp["emp_kes"])
            net = gross - pph - bpjs_emp
            tot_net += net
            rows.append([e["emp_id"], e["name"], e["dept"], e["bank_masked"], format_idr(gross), format_idr(pph + bpjs_emp), format_idr(net)])
        rows.append(["TOTAL", f"{len(d['employees'])} Karyawan", "-", "-", "-", "-", format_idr(tot_net)])
        _add_styled_table(doc, ["ID", "Nama", "Dept", "Rekening (Masked)", "Gross", "Potongan", "Net THP"], rows, {4, 5, 6}, bold_last_row=True)

    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    doc.save(out)
    patch_ooxml_zero_blue_theme(out)
    return out

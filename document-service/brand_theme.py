#!/usr/bin/env python3
"""
StockFlow Brand Theme, Zero-Blue OOXML Patcher, Logo Resolver, and 300 DPI Visual Renderer.

STRICT ZERO-BLUE COLOR POLICY:
All StockFlow documents (PDF, Word .docx, Excel .xlsx, PowerPoint .pptx) strictly use the
Furniture & Homeware Financial Craft palette — ZERO blue, sky, cyan, indigo, or blue-slate.
"""

from __future__ import annotations

import math
import os
import re
import textwrap
import zipfile
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# =============================================================================
# LOCKED STOCKFLOW ZERO-BLUE BRAND PALETTE
# =============================================================================

PALETTE: Dict[str, str] = {
    "primary": "1B4332",          # Deep Forest Pine (Headers, Banners, Primary Titles)
    "primary_dark": "133124",     # Forest Pine Dark Accent
    "primary_tint": "E8F3EC",     # Soft Sage (Total rows, Callout fills)
    "accent": "C2592B",           # Warm Terracotta / Teak (Highlights, Secondary Accents, Input Text)
    "accent_dark": "A3461F",      # Burnt Terracotta
    "accent_tint": "FDF0E9",      # Warm Terracotta Tint
    "gold": "B47B1B",             # Harvest Ochre (Tertiary Accent)
    "gold_tint": "FEF7E6",        # Warm Cream (Editable Input Cell Fill / Warning Tint)
    "charcoal": "1C1917",         # Warm Espresso Charcoal (Dark Anchor, Body Text)
    "charcoal_soft": "292524",    # Soft Espresso
    "stone": "57534E",            # Muted Stone (Subtitles, Captions, Secondary Text)
    "stone_light": "78716C",      # Light Stone (Footers, Metadata)
    "alabaster": "FAF8F5",        # Warm Alabaster (Zebra Table Striping, Canvas)
    "linen": "F3EFE9",            # Warm Linen (Secondary Shading)
    "sand_border": "E5DED5",      # Warm Sand (Light Table Borders)
    "sand_strong": "D6CEC4",      # Warm Sand Strong (Dividers, Card Outlines)
    "white": "FFFFFF",            # Pure White
    "success": "15803D",          # Semantic Green (Balanced, Optimal, Cross-Sheet Links)
    "success_tint": "E8F3EC",     # Semantic Green Tint
    "warning": "B45309",          # Semantic Ochre (Monitor, Pending)
    "warning_tint": "FEF7E6",     # Semantic Ochre Tint
    "danger": "B91C1C",           # Semantic Crimson (Low Stock, Negative Variance, Alert)
    "danger_tint": "FDECEC",      # Semantic Crimson Tint
    "olive": "4D7C0F",            # Olive-Sage (Chart Series 4 / In-Transit — NO BLUE!)
    "burgundy": "7F1D4A",         # Deep Burgundy (Chart Series 5 — NO BLUE!)
    "umber": "78350F",            # Warm Umber (Chart Series 6)
}

CHART_SERIES_HEX: List[str] = [
    PALETTE["primary"],    # #1B4332 Deep Forest Pine
    PALETTE["accent"],     # #C2592B Warm Terracotta
    PALETTE["gold"],       # #B47B1B Harvest Ochre
    PALETTE["olive"],      # #4D7C0F Olive-Sage
    PALETTE["burgundy"],   # #7F1D4A Deep Burgundy
    PALETTE["stone"],      # #57534E Muted Stone
]

SERVICE_DIR = Path(__file__).resolve().parent
WORKSPACE_ROOT = SERVICE_DIR.parent
BRAND_ASSETS_DIR = WORKSPACE_ROOT / "brand-assets"
FALLBACK_LOGO_PATH = SERVICE_DIR / "assets" / "stockflow_brand_mark.png"


def hex_to_rgb(hex_color: str, fallback: Tuple[int, int, int] = (27, 67, 50)) -> Tuple[int, int, int]:
    clean = str(hex_color or "").strip().lstrip("#")
    if len(clean) == 6:
        try:
            return (int(clean[0:2], 16), int(clean[2:4], 16), int(clean[4:6], 16))
        except ValueError:
            pass
    return fallback


def is_blue_hex(hex_color: str) -> bool:
    """Return True if a 6-char RGB hex color has a noticeable blue dominance or blue-slate hue."""
    clean = str(hex_color or "").strip().lstrip("#").upper()
    if len(clean) != 6 or not re.fullmatch(r"[0-9A-F]{6}", clean):
        return False
    r, g, b = int(clean[0:2], 16), int(clean[2:4], 16), int(clean[4:6], 16)
    # Any color where Blue clearly exceeds both Red and Green (catches navy, blue, sky, cyan, indigo, blue-slate)
    if b > r + 10 and b > g + 8:
        return True
    # Cyan / teal-blue check where both G and B are well above R and B >= G
    if b > r + 18 and g > r + 15 and b >= g:
        return True
    return False


# =============================================================================
# LOGO RESOLVER & ZERO-BLUE GEOMETRIC FALLBACK MARK
# =============================================================================

def _generate_fallback_logo_png(target_path: Path) -> Path:
    """Render a crisp 300 DPI geometric minimalist StockFlow mark (strictly Zero-Blue)."""
    from PIL import Image, ImageDraw

    target_path.parent.mkdir(parents=True, exist_ok=True)
    w, h = 640, 180
    img = Image.new("RGBA", (w, h), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)

    pine = hex_to_rgb(PALETTE["primary"])
    terracotta = hex_to_rgb(PALETTE["accent"])
    charcoal = hex_to_rgb(PALETTE["charcoal"])
    stone = hex_to_rgb(PALETTE["stone"])
    alabaster = hex_to_rgb(PALETTE["alabaster"])

    # Geometric icon container (rounded Forest Pine square)
    draw.rounded_rectangle([14, 18, 158, 162], radius=24, fill=pine)
    # Stacked timber/furniture modules + flowing ledger arrow inside
    draw.rounded_rectangle([38, 42, 98, 66], radius=6, fill=alabaster)
    draw.rounded_rectangle([38, 78, 118, 102], radius=6, fill=terracotta)
    draw.rounded_rectangle([38, 114, 92, 138], radius=6, fill=alabaster)
    # Flow chevron/arrow pointing right-up
    draw.polygon([(112, 42), (138, 54), (112, 66)], fill=terracotta)
    draw.polygon([(106, 114), (138, 126), (106, 138)], fill=alabaster)

    # Wordmark typography
    f_brand = _load_pil_font(56, bold=True)
    f_sub = _load_pil_font(20, bold=False)
    draw.text((182, 34), "Stock", fill=pine, font=f_brand)
    sw, _ = _text_size(draw, "Stock", f_brand)
    draw.text((182 + sw, 34), "Flow", fill=terracotta, font=f_brand)
    draw.text((184, 106), "FURNITURE & HOMEWARE ERP", fill=stone, font=f_sub)
    draw.line([(184, 136), (590, 136)], fill=hex_to_rgb(PALETTE["sand_strong"]), width=2)
    draw.text((184, 142), "PT Karya Berdua Indonesia", fill=charcoal, font=_load_pil_font(17, bold=False))

    img.save(target_path, format="PNG", dpi=(300, 300))
    return target_path


def resolve_logo_path(explicit_path: Optional[str] = None, prefer_full: bool = True) -> Path:
    """
    Locate the official StockFlow PNG logo produced by @brand-architect inside `brand-assets/`.
    Falls back cleanly to our built-in zero-blue geometric mark PNG if brand-assets PNGs aren't ready yet.
    """
    if explicit_path:
        p = Path(explicit_path)
        if p.exists() and p.suffix.lower() == ".png":
            return p

    if BRAND_ASSETS_DIR.exists():
        # Priority order for crisp print/document PNGs from brand-assets
        preferred_patterns = (
            [
                "**/stockflow-logo-full*512*.png",
                "**/stockflow-logo-full*1024*.png",
                "**/stockflow-logo-full*.png",
                "**/logo-full*.png",
                "**/lockup*light*.png",
                "**/stockflow-lockup*.png",
                "**/print*300*.png",
                "**/stockflow-mark*512*.png",
                "**/stockflow-mark*192*.png",
                "**/stockflow-mark*.png",
                "**/*logo*512*.png",
                "**/*512*.png",
                "**/*.png",
            ]
            if prefer_full
            else [
                "**/stockflow-mark*512*.png",
                "**/stockflow-mark*192*.png",
                "**/stockflow-mark*.png",
                "**/stockflow-logo-full*.png",
                "**/*.png",
            ]
        )
        for pat in preferred_patterns:
            matches = sorted(
                [m for m in BRAND_ASSETS_DIR.glob(pat) if m.is_file() and "dark" not in m.name.lower() and "social" not in m.name.lower() and "banner" not in m.name.lower()]
            )
            if matches:
                # Verify it is a valid readable PNG with zero blue dominance
                try:
                    from PIL import Image
                    with Image.open(matches[0]) as im:
                        im.verify()
                    return matches[0]
                except Exception:
                    continue

    if not FALLBACK_LOGO_PATH.exists():
        _generate_fallback_logo_png(FALLBACK_LOGO_PATH)
    return FALLBACK_LOGO_PATH


# =============================================================================
# ZERO-BLUE OOXML THEME PATCHER (FOR .DOCX, .XLSX, .PPTX)
# =============================================================================

STOCKFLOW_THEME_XML = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="StockFlow Zero-Blue Craft">
  <a:themeElements>
    <a:clrScheme name="StockFlowZeroBlue">
      <a:dk1><a:srgbClr val="{PALETTE['charcoal']}"/></a:dk1>
      <a:lt1><a:srgbClr val="{PALETTE['white']}"/></a:lt1>
      <a:dk2><a:srgbClr val="{PALETTE['primary']}"/></a:dk2>
      <a:lt2><a:srgbClr val="{PALETTE['alabaster']}"/></a:lt2>
      <a:accent1><a:srgbClr val="{PALETTE['primary']}"/></a:accent1>
      <a:accent2><a:srgbClr val="{PALETTE['accent']}"/></a:accent2>
      <a:accent3><a:srgbClr val="{PALETTE['gold']}"/></a:accent3>
      <a:accent4><a:srgbClr val="{PALETTE['olive']}"/></a:accent4>
      <a:accent5><a:srgbClr val="{PALETTE['burgundy']}"/></a:accent5>
      <a:accent6><a:srgbClr val="{PALETTE['stone']}"/></a:accent6>
      <a:hlink><a:srgbClr val="{PALETTE['primary']}"/></a:hlink>
      <a:folHlink><a:srgbClr val="{PALETTE['accent']}"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="StockFlowTypography">
      <a:majorFont>
        <a:latin typeface="Calibri"/>
        <a:ea typeface=""/>
        <a:cs typeface=""/>
      </a:majorFont>
      <a:minorFont>
        <a:latin typeface="Calibri"/>
        <a:ea typeface=""/>
        <a:cs typeface=""/>
      </a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="StockFlowFormat">
      <a:fillStyleLst>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
      </a:fillStyleLst>
      <a:lnStyleLst>
        <a:ln w="9525" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
        <a:ln w="19050" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
        <a:ln w="28575" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
      </a:lnStyleLst>
      <a:effectStyleLst>
        <a:effectStyle><a:effectLst/></a:effectStyle>
        <a:effectStyle><a:effectLst/></a:effectStyle>
        <a:effectStyle><a:effectLst/></a:effectStyle>
      </a:effectStyleLst>
      <a:bgFillStyleLst>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
      </a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
  <a:objectDefaults/>
  <a:extraClrSchemeLst/>
</a:theme>
"""

# Known default Office XML blue hex codes that python-docx / python-pptx / openpyxl embed in default templates
_DEFAULT_OFFICE_BLUE_MAP = {
    "2F5496": PALETTE["primary"],
    "1F4D78": PALETTE["primary"],
    "1F4E79": PALETTE["primary"],
    "1F3763": PALETTE["primary"],
    "2E74B5": PALETTE["primary"],
    "365F91": PALETTE["primary"],
    "4F81BD": PALETTE["primary"],
    "4472C4": PALETTE["primary"],
    "5B9BD5": PALETTE["accent"],
    "244061": PALETTE["primary"],
    "17365D": PALETTE["primary"],
    "0563C1": PALETTE["primary"],
    "0000FF": PALETTE["accent"],
    "4BACC6": PALETTE["olive"],
    "8064A2": PALETTE["burgundy"],
    "954F72": PALETTE["burgundy"],
    "1E3A5F": PALETTE["primary"],
    "0EA5E9": PALETTE["accent"],
    "3B82F6": PALETTE["primary"],
    "0F172A": PALETTE["charcoal"],
    "1E293B": PALETTE["charcoal"],
    "334155": PALETTE["stone"],
    "475569": PALETTE["stone"],
    "64748B": PALETTE["stone_light"],
    "94A3B8": PALETTE["sand_strong"],
    "CBD5E1": PALETTE["sand_border"],
    "E2E8F0": PALETTE["linen"],
    "F1F5F9": PALETTE["alabaster"],
    "F8FAFC": PALETTE["alabaster"],
    "EFF6FF": PALETTE["primary_tint"],
    "D9E1F2": PALETTE["primary_tint"],
    "B4C6E7": PALETTE["sand_border"],
    "8EA9DB": PALETTE["gold"],
    "0070C0": PALETTE["primary"],
    "002060": PALETTE["primary"],
    "00B0F0": PALETTE["accent"],
    "548DD4": PALETTE["primary"],
    "8DB3E2": PALETTE["primary_tint"],
    "C6D9F1": PALETTE["alabaster"],
    "DBE5F1": PALETTE["alabaster"],
    "B8CCE4": PALETTE["sand_border"],
    "95B3D7": PALETTE["sand_strong"],
    "376092": PALETTE["primary"],
    "254061": PALETTE["primary"],
    "10253F": PALETTE["charcoal"],
}

_COLOR_ATTR_RE = re.compile(
    r'((?:val|color|rgb|fgColor|bgColor|fill)=")([0-9A-Fa-f]{6}|FF[0-9A-Fa-f]{6})(")'
)


def _sanitize_xml_colors(xml_text: str) -> str:
    """Replace any default Microsoft Office blue hex codes in OOXML styles/themes with StockFlow Zero-Blue tokens."""
    def repl(match: re.Match) -> str:
        prefix, raw_hex, suffix = match.group(1), match.group(2), match.group(3)
        upper = raw_hex.upper()
        alpha = ""
        hex6 = upper
        if len(upper) == 8 and upper.startswith("FF"):
            alpha = "FF"
            hex6 = upper[2:]
        if hex6 in _DEFAULT_OFFICE_BLUE_MAP:
            return f"{prefix}{alpha}{_DEFAULT_OFFICE_BLUE_MAP[hex6]}{suffix}"
        if is_blue_hex(hex6):
            # Map dark/mid blue to Forest Pine, light blue tint to Soft Sage
            r, g, b = hex_to_rgb(hex6)
            lum = 0.299 * r + 0.587 * g + 0.114 * b
            mapped = PALETTE["primary_tint"] if lum > 190 else PALETTE["primary"]
            return f"{prefix}{alpha}{mapped}{suffix}"
        return match.group(0)

    return _COLOR_ATTR_RE.sub(repl, xml_text)


def patch_ooxml_zero_blue_theme(filepath: Path | str) -> None:
    """
    Post-process a saved .docx, .xlsx, or .pptx archive in-place:
    1. Replace any `*/theme/theme1.xml` with StockFlow's custom Zero-Blue Office Theme.
    2. Sanitize any residual default template blue color values inside XML style/chart parts.
    """
    path = Path(filepath)
    tmp_path = path.with_suffix(path.suffix + ".tmp_zb")
    with zipfile.ZipFile(path, "r") as zin, zipfile.ZipFile(tmp_path, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            lower = item.filename.lower()
            if lower.endswith("theme/theme1.xml"):
                data = STOCKFLOW_THEME_XML.encode("utf-8")
            elif lower.endswith(".xml"):
                try:
                    txt = data.decode("utf-8")
                    patched = _sanitize_xml_colors(txt)
                    data = patched.encode("utf-8")
                except UnicodeDecodeError:
                    pass
            zout.writestr(item, data)
    os.replace(tmp_path, path)


# =============================================================================
# 300 DPI ZERO-BLUE CHART & DIAGRAM RENDERER (PILLOW)
# =============================================================================

def _load_pil_font(size: int, bold: bool = False):
    from PIL import ImageFont

    candidates = (
        [
            "C:/Windows/Fonts/calibrib.ttf",
            "C:/Windows/Fonts/arialbd.ttf",
            "C:/Windows/Fonts/segoeuib.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        ]
        if bold
        else [
            "C:/Windows/Fonts/calibri.ttf",
            "C:/Windows/Fonts/arial.ttf",
            "C:/Windows/Fonts/segoeui.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        ]
    )
    for fp in candidates:
        if os.path.exists(fp):
            try:
                return ImageFont.truetype(fp, size)
            except Exception:
                pass
    return ImageFont.load_default()


def _text_size(draw, text: str, font) -> Tuple[int, int]:
    bbox = draw.textbbox((0, 0), str(text), font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def render_chart_png(chart_spec: dict, out_png: str | Path) -> Path:
    """Render a crisp 300 DPI StockFlow Zero-Blue chart (column, bar, or line) for Word/PDF embedding."""
    from PIL import Image, ImageDraw

    out_path = Path(out_png)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    W, H = 1600, 900
    bg_col = hex_to_rgb(PALETTE["white"])
    alabaster = hex_to_rgb(PALETTE["alabaster"])
    border_col = hex_to_rgb(PALETTE["sand_border"])
    axis_col = hex_to_rgb(PALETTE["stone_light"])
    primary = hex_to_rgb(PALETTE["primary"])
    charcoal = hex_to_rgb(PALETTE["charcoal"])
    stone = hex_to_rgb(PALETTE["stone"])
    series_colors = [hex_to_rgb(c) for c in CHART_SERIES_HEX]

    img = Image.new("RGB", (W, H), bg_col)
    draw = ImageDraw.Draw(img)

    f_title = _load_pil_font(34, bold=True)
    f_sub = _load_pil_font(20, bold=False)
    f_lbl = _load_pil_font(22, bold=False)
    f_val = _load_pil_font(20, bold=True)
    f_leg = _load_pil_font(22, bold=True)

    # Outer card border & subtle top Forest Pine accent bar
    draw.rectangle([4, 4, W - 5, H - 5], outline=border_col, width=2)
    draw.rectangle([4, 4, W - 5, 14], fill=primary)

    title = str(chart_spec.get("title", "Grafik Kinerja StockFlow"))
    subtitle = str(chart_spec.get("subtitle", ""))
    tw, _ = _text_size(draw, title, f_title)
    draw.text(((W - tw) // 2, 28), title, fill=primary, font=f_title)
    if subtitle:
        sw, _ = _text_size(draw, subtitle, f_sub)
        draw.text(((W - sw) // 2, 70), subtitle, fill=stone, font=f_sub)

    categories = [str(c) for c in chart_spec.get("categories", [])]
    series_list = chart_spec.get("series", [])
    ctype = str(chart_spec.get("chartType", chart_spec.get("type", "column"))).lower()
    unit_prefix = str(chart_spec.get("unitPrefix", ""))
    unit_suffix = str(chart_spec.get("unitSuffix", ""))

    if not categories or not series_list:
        draw.text((120, 420), "Data grafik tidak tersedia.", fill=stone, font=f_lbl)
        img.save(out_path, dpi=(300, 300))
        return out_path

    all_vals = [float(v) for s in series_list for v in s.get("values", [])]
    max_val = max(all_vals) if all_vals else 1.0
    min_val = min(0.0, min(all_vals)) if all_vals else 0.0
    if max_val == min_val:
        max_val = min_val + 1.0

    span = max_val - min_val
    step_raw = span / 5.0
    mag = 10 ** math.floor(math.log10(max(step_raw, 1e-9)))
    step = math.ceil(step_raw / mag) * mag
    top_val = math.ceil(max_val / step) * step
    bot_val = math.floor(min_val / step) * step if min_val < 0 else 0.0
    val_range = max(top_val - bot_val, 1e-9)

    leg_y = 102 if subtitle else 82
    if len(series_list) > 1 or series_list[0].get("name"):
        leg_items = []
        total_leg_w = 0
        for i, s in enumerate(series_list):
            nm = str(s.get("name", f"Seri {i + 1}"))
            lw, _ = _text_size(draw, nm, f_leg)
            leg_items.append((nm, series_colors[i % len(series_colors)], lw))
            total_leg_w += 26 + 10 + lw + 36
        cur_x = max(60, (W - total_leg_w) // 2)
        for nm, col, lw in leg_items:
            draw.rounded_rectangle([cur_x, leg_y + 3, cur_x + 24, leg_y + 23], radius=4, fill=col)
            draw.text((cur_x + 34, leg_y), nm, fill=charcoal, font=f_leg)
            cur_x += 34 + lw + 36

    left_m = 250 if ctype == "bar" else 150
    right_m = 90
    top_m = 152
    bot_m = 115
    plot_w = W - left_m - right_m
    plot_h = H - top_m - bot_m

    # Warm alabaster plot canvas
    draw.rectangle([left_m, top_m, left_m + plot_w, top_m + plot_h], fill=alabaster)

    def fmt_num(v: float) -> str:
        if abs(v) >= 1000:
            s_v = f"{v:,.0f}"
        elif abs(v - round(v)) < 1e-6:
            s_v = f"{int(round(v))}"
        else:
            s_v = f"{v:.1f}"
        return f"{unit_prefix}{s_v}{unit_suffix}"

    if ctype == "bar":
        n_ticks = 5
        for i in range(n_ticks + 1):
            tv = bot_val + (val_range * i / n_ticks)
            x = int(left_m + (tv - bot_val) / val_range * plot_w)
            draw.line([(x, top_m), (x, top_m + plot_h)], fill=border_col, width=2)
            lbl = fmt_num(tv)
            lw, _ = _text_size(draw, lbl, f_lbl)
            draw.text((x - lw // 2, top_m + plot_h + 14), lbl, fill=stone, font=f_lbl)
        draw.line([(left_m, top_m), (left_m, top_m + plot_h)], fill=axis_col, width=3)

        n_cat = len(categories)
        n_ser = len(series_list)
        cat_h = plot_h / max(n_cat, 1)
        group_pad = cat_h * 0.18
        bar_h = max(14, (cat_h - 2 * group_pad) / max(n_ser, 1) - 4)
        for ci, cat in enumerate(categories):
            cy_top = top_m + ci * cat_h + group_pad
            cat_short = cat if len(cat) <= 22 else cat[:20] + ".."
            cw, ch = _text_size(draw, cat_short, f_lbl)
            draw.text((left_m - cw - 16, int(top_m + ci * cat_h + (cat_h - ch) / 2)), cat_short, fill=charcoal, font=f_lbl)
            for si, ser in enumerate(series_list):
                vals = ser.get("values", [])
                v = float(vals[ci]) if ci < len(vals) else 0.0
                x0 = left_m
                x1 = int(left_m + max(0.0, (v - bot_val) / val_range) * plot_w)
                y0 = int(cy_top + si * (bar_h + 4))
                y1 = int(y0 + bar_h)
                col = series_colors[si % len(series_colors)]
                draw.rounded_rectangle([x0, y0, max(x0 + 4, x1), y1], radius=5, fill=col)
                vlbl = fmt_num(v)
                _, vh = _text_size(draw, vlbl, f_val)
                draw.text((max(x0 + 4, x1) + 10, int(y0 + (bar_h - vh) / 2)), vlbl, fill=col, font=f_val)
    else:
        n_ticks = 5
        for i in range(n_ticks + 1):
            tv = bot_val + (val_range * i / n_ticks)
            y = int(top_m + plot_h - (tv - bot_val) / val_range * plot_h)
            draw.line([(left_m, y), (left_m + plot_w, y)], fill=border_col, width=2)
            lbl = fmt_num(tv)
            lw, lh = _text_size(draw, lbl, f_lbl)
            draw.text((left_m - lw - 16, y - lh // 2), lbl, fill=stone, font=f_lbl)
        axis_y = int(top_m + plot_h - (0.0 - bot_val) / val_range * plot_h)
        draw.line([(left_m, axis_y), (left_m + plot_w, axis_y)], fill=axis_col, width=3)

        n_cat = len(categories)
        n_ser = len(series_list)
        cat_w = plot_w / max(n_cat, 1)

        for ci, cat in enumerate(categories):
            cx = int(left_m + (ci + 0.5) * cat_w)
            cat_short = cat if len(cat) <= 16 else cat[:14] + ".."
            cw, _ = _text_size(draw, cat_short, f_lbl)
            draw.text((cx - cw // 2, top_m + plot_h + 18), cat_short, fill=charcoal, font=f_lbl)

        if ctype == "line":
            for si, ser in enumerate(series_list):
                col = series_colors[si % len(series_colors)]
                vals = ser.get("values", [])
                pts = []
                for ci in range(n_cat):
                    v = float(vals[ci]) if ci < len(vals) else 0.0
                    px = int(left_m + (ci + 0.5) * cat_w)
                    py = int(top_m + plot_h - (v - bot_val) / val_range * plot_h)
                    pts.append((px, py, v))
                if len(pts) >= 2:
                    draw.line([(p[0], p[1]) for p in pts], fill=col, width=5)
                for px, py, v in pts:
                    r = 9
                    draw.ellipse([px - r, py - r, px + r, py + r], fill=col, outline=bg_col, width=3)
                    vlbl = fmt_num(v)
                    vw, vh = _text_size(draw, vlbl, f_val)
                    draw.text((px - vw // 2, py - vh - 14), vlbl, fill=col, font=f_val)
        else:
            group_pad = cat_w * 0.16
            bar_w = max(14, (cat_w - 2 * group_pad) / max(n_ser, 1) - 6)
            for ci in range(n_cat):
                gx = left_m + ci * cat_w + group_pad
                for si, ser in enumerate(series_list):
                    vals = ser.get("values", [])
                    v = float(vals[ci]) if ci < len(vals) else 0.0
                    col = series_colors[si % len(series_colors)]
                    x0 = int(gx + si * (bar_w + 6))
                    x1 = int(x0 + bar_w)
                    vy = int(top_m + plot_h - (v - bot_val) / val_range * plot_h)
                    y0, y1 = min(vy, axis_y), max(vy, axis_y)
                    draw.rounded_rectangle([x0, y0, x1, max(y0 + 3, y1)], radius=5, fill=col)
                    vlbl = fmt_num(v)
                    vw, vh = _text_size(draw, vlbl, f_val)
                    draw.text((int((x0 + x1) / 2 - vw / 2), y0 - vh - 8), vlbl, fill=col, font=f_val)

    img.save(out_path, dpi=(300, 300))
    return out_path


def render_diagram_png(diagram_spec: dict, out_png: str | Path) -> Path:
    """Render a crisp 300 DPI StockFlow Zero-Blue horizontal or vertical process diagram."""
    from PIL import Image, ImageDraw

    out_path = Path(out_png)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    nodes = diagram_spec.get("nodes", [])
    title = str(diagram_spec.get("title", "Alur Proses StockFlow"))
    primary = hex_to_rgb(PALETTE["primary"])
    accent = hex_to_rgb(PALETTE["accent"])
    gold = hex_to_rgb(PALETTE["gold"])
    alabaster = hex_to_rgb(PALETTE["alabaster"])
    border_col = hex_to_rgb(PALETTE["sand_border"])
    charcoal = hex_to_rgb(PALETTE["charcoal"])
    white = (255, 255, 255)

    n = max(len(nodes), 1)
    W, H = 1680, 500
    img = Image.new("RGB", (W, H), white)
    draw = ImageDraw.Draw(img)
    draw.rectangle([4, 4, W - 5, H - 5], outline=border_col, width=2)
    draw.rectangle([4, 4, W - 5, 14], fill=primary)

    f_title = _load_pil_font(32, bold=True)
    f_node_t = _load_pil_font(23 if n <= 4 else 19, bold=True)
    f_node_s = _load_pil_font(19 if n <= 4 else 16, bold=False)

    tw, _ = _text_size(draw, title, f_title)
    draw.text(((W - tw) // 2, 30), title, fill=primary, font=f_title)

    margin_x = 58
    arrow_gap = 56
    box_w = int((W - 2 * margin_x - (n - 1) * arrow_gap) / n)
    box_h = 280
    y0 = 138
    y1 = y0 + box_h

    node_palette = [primary, accent, gold, hex_to_rgb(PALETTE["olive"])]
    for idx, node in enumerate(nodes):
        x0 = margin_x + idx * (box_w + arrow_gap)
        x1 = x0 + box_w
        hdr_col = node_palette[idx % len(node_palette)]
        draw.rounded_rectangle([x0, y0, x1, y1], radius=16, fill=alabaster, outline=hdr_col, width=3)
        draw.rounded_rectangle([x0, y0, x1, y0 + 64], radius=14, fill=hdr_col)
        draw.rectangle([x0, y0 + 44, x1, y0 + 64], fill=hdr_col)

        nt = textwrap.shorten(str(node.get("title", f"Tahap {idx + 1}")), width=26, placeholder="...")
        nw, nh = _text_size(draw, nt, f_node_t)
        draw.text((x0 + (box_w - nw) // 2, y0 + (64 - nh) // 2), nt, fill=white, font=f_node_t)

        ns = str(node.get("subtitle", ""))
        if ns:
            wrap_chars = max(14, int(box_w / 12.2))
            wrapped = textwrap.fill(ns, width=wrap_chars)
            bbox = draw.multiline_textbbox((0, 0), wrapped, font=f_node_s, spacing=6)
            sw, sh = bbox[2] - bbox[0], bbox[3] - bbox[1]
            draw.multiline_text(
                (x0 + max(14, (box_w - sw) // 2), y0 + 76 + max(8, (box_h - 86 - sh) // 2)),
                wrapped,
                fill=charcoal,
                font=f_node_s,
                align="center",
                spacing=6,
            )

        if idx < len(nodes) - 1:
            cy = (y0 + y1) // 2
            ax0 = x1 + 6
            ax1 = x1 + arrow_gap - 16
            draw.line([(ax0, cy), (ax1, cy)], fill=primary, width=5)
            draw.polygon([(ax1 - 2, cy - 12), (ax1 - 2, cy + 12), (ax1 + 14, cy)], fill=primary)

    img.save(out_path, dpi=(300, 300))
    return out_path

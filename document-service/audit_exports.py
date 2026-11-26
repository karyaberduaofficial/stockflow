#!/usr/bin/env python3
"""
StockFlow Document Quality, Pro-Office-Suite, Zero-Blue, Formula & PII Auditor.

Audits every generated .xlsx, .docx, .pptx, and .pdf deliverable across 5 gates:
1. Magic Bytes & Archive/PDF Structural Validity
2. Pro-Office-Suite Engine Audit (`office_engine.py audit` -> READY status)
3. Excel Formula Integrity + Live Excel Desktop COM Recalculation Check (on temp copy)
4. STRICT ZERO-BLUE COLOR AUDIT across every OOXML XML part AND rendered PDF RGB pixels
5. Zero Real PII & Secret Hygiene Verification (no unmasked 16-digit NIK, no personal emails, no tokens).
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path
from typing import Any, Dict, List

SERVICE_DIR = Path(__file__).resolve().parent
if str(SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(SERVICE_DIR))

from brand_theme import WORKSPACE_ROOT, is_blue_hex

_PRO_OFFICE_ROOT = Path(
    os.environ.get(
        "PRO_OFFICE_SUITE_DIR",
        str(Path.home() / "struktur skill pengerjaan dokumen word, power point, dan excel profesional"),
    )
)
PRO_OFFICE_ENGINE_PATH = _PRO_OFFICE_ROOT / "scripts" / "office_engine.py"
COM_BRIDGE_PATH = _PRO_OFFICE_ROOT / "scripts" / "office_com_bridge.ps1"

_HEX_ATTR_RE = re.compile(
    r'(?:val|color|rgb|fgColor|bgColor|fill)="(?:FF)?([0-9A-Fa-f]{6})"'
)
_UNMASKED_NIK_RE = re.compile(r"\b(?:1[1-9]|21|3[1-6]|5[1-3]|6[1-5]|7[1-6]|8[1-2]|9[1-4])\d{14}\b")
_PERSONAL_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@(?:gmail|yahoo|outlook|hotmail|icloud)\.com", re.IGNORECASE)
_SECRET_RE = re.compile(r"(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|BEGIN (?:RSA |EC )?PRIVATE KEY)")


def _load_pro_office_engine():
    if not PRO_OFFICE_ENGINE_PATH.exists():
        return None
    spec = importlib.util.spec_from_file_location("pro_office_engine", str(PRO_OFFICE_ENGINE_PATH))
    mod = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(mod)
    return mod


def _check_magic_bytes(path: Path) -> Dict[str, Any]:
    raw = path.read_bytes()[:8]
    ext = path.suffix.lower()
    if ext == ".pdf":
        ok = raw.startswith(b"%PDF-")
        return {"valid": ok, "magic": raw[:5].decode("ascii", errors="replace")}
    if ext in (".docx", ".xlsx", ".pptx"):
        ok = raw.startswith(b"PK\x03\x04") and zipfile.is_zipfile(path)
        root_map = {".docx": "word/document.xml", ".xlsx": "xl/workbook.xml", ".pptx": "ppt/presentation.xml"}
        has_root = False
        if ok:
            with zipfile.ZipFile(path, "r") as zf:
                has_root = root_map[ext] in zf.namelist()
        return {"valid": ok and has_root, "magic": "PK\\x03\\x04", "has_ooxml_root": has_root}
    return {"valid": False, "magic": "unknown"}


def _audit_ooxml_zero_blue(path: Path) -> Dict[str, Any]:
    blue_findings: List[Dict[str, str]] = []
    with zipfile.ZipFile(path, "r") as zf:
        for name in zf.namelist():
            if not name.lower().endswith(".xml"):
                continue
            txt = zf.read(name).decode("utf-8", errors="ignore")
            for m in _HEX_ATTR_RE.finditer(txt):
                hx = m.group(1).upper()
                if is_blue_hex(hx):
                    blue_findings.append({"part": name, "hex": f"#{hx}"})
    # Deduplicate by (part, hex)
    unique = []
    seen = set()
    for item in blue_findings:
        key = (item["part"], item["hex"])
        if key not in seen:
            seen.add(key)
            unique.append(item)
    return {"zero_blue_pass": len(unique) == 0, "blue_hits": unique[:20]}


def _audit_pdf_deep(path: Path) -> Dict[str, Any]:
    import pymupdf as fitz

    doc = fitz.open(str(path))
    pages = len(doc)
    blue_pixel_pages = []
    extracted_text = []
    for p_idx in range(pages):
        page = doc[p_idx]
        extracted_text.append(page.get_text("text"))
        pix = page.get_pixmap(dpi=72, alpha=False)
        samples = pix.samples  # RGB bytes
        blue_px = 0
        for i in range(0, len(samples), 3):
            r, g, b = samples[i], samples[i + 1], samples[i + 2]
            if b > r + 15 and b > g + 12:
                blue_px += 1
        if blue_px > 0:
            blue_pixel_pages.append({"page": p_idx + 1, "blue_pixels": blue_px})
    doc.close()
    return {
        "page_count": pages,
        "zero_blue_pass": len(blue_pixel_pages) == 0,
        "blue_pixel_pages": blue_pixel_pages,
        "text": "\n".join(extracted_text),
    }


def _extract_ooxml_text(path: Path) -> str:
    ext = path.suffix.lower()
    chunks: List[str] = []
    if ext == ".docx":
        from docx import Document
        doc = Document(str(path))
        chunks.extend(p.text for p in doc.paragraphs)
        for tbl in doc.tables:
            for row in tbl.rows:
                chunks.extend(c.text for c in row.cells)
    elif ext == ".xlsx":
        from openpyxl import load_workbook
        wb = load_workbook(str(path), data_only=False)
        for name in wb.sheetnames:
            ws = wb[name]
            for row in ws.iter_rows(values_only=True):
                chunks.extend(str(v) for v in row if v is not None)
    elif ext == ".pptx":
        from pptx import Presentation
        prs = Presentation(str(path))
        for s in prs.slides:
            for sh in s.shapes:
                if sh.has_text_frame:
                    chunks.append(sh.text_frame.text)
                if sh.has_table:
                    for row in sh.table.rows:
                        chunks.extend(c.text for c in row.cells)
    return "\n".join(chunks)


def _check_pii_and_secrets(text: str) -> Dict[str, Any]:
    niks = _UNMASKED_NIK_RE.findall(text)
    emails = _PERSONAL_EMAIL_RE.findall(text)
    secrets = _SECRET_RE.findall(text)
    return {
        "pii_secret_pass": len(niks) == 0 and len(emails) == 0 and len(secrets) == 0,
        "unmasked_niks": niks[:5],
        "personal_emails": emails[:5],
        "secrets_found": secrets[:5],
    }


def _evaluate_xlsx_with_excel_com(path: Path) -> Dict[str, Any]:
    """
    Copy .xlsx to a temp folder, run Excel Desktop COM full recalculation via pro-office-suite's
    `office_com_bridge.ps1 -Action recalc-xlsx`, and inspect cached evaluated values for errors & audit OK checks.
    Leaves the original Zero-Blue .xlsx untouched!
    """
    if not COM_BRIDGE_PATH.exists():
        return {"skipped": True, "reason": "office_com_bridge.ps1 not found"}

    err_tokens = {"#REF!", "#NAME?", "#VALUE!", "#DIV/0!", "#N/A", "#NUM!", "#NULL!"}
    with tempfile.TemporaryDirectory(prefix="sf_xlsx_eval_") as tmpdir:
        tmp_copy = Path(tmpdir) / path.name
        shutil.copy2(path, tmp_copy)
        res = subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                str(COM_BRIDGE_PATH),
                "-Action",
                "recalc-xlsx",
                "-InputFile",
                str(tmp_copy),
            ],
            capture_output=True,
            text=True,
            timeout=45,
        )
        if res.returncode != 0:
            return {"skipped": True, "reason": (res.stderr or res.stdout).strip()[:200]}

        from openpyxl import load_workbook
        wb_val = load_workbook(str(tmp_copy), data_only=True)
        eval_errors = []
        audit_sheet_results = []
        for sname in wb_val.sheetnames:
            ws = wb_val[sname]
            for row in ws.iter_rows():
                for cell in row:
                    v = cell.value
                    if isinstance(v, str) and any(tok in v for tok in err_tokens):
                        eval_errors.append({"sheet": sname, "cell": cell.coordinate, "value": v})
            if "audit" in sname.lower():
                for r in range(5, ws.max_row + 1):
                    chk = ws.cell(row=r, column=2).value
                    val = ws.cell(row=r, column=3).value
                    st = ws.cell(row=r, column=4).value
                    if chk:
                        audit_sheet_results.append({"check": chk, "value": val, "status": st})

        all_audit_ok = all(item.get("status") == "OK" for item in audit_sheet_results) if audit_sheet_results else True
        return {
            "evaluated_via_excel_com": True,
            "formula_eval_pass": len(eval_errors) == 0 and all_audit_ok,
            "eval_errors": eval_errors,
            "audit_control_checks": audit_sheet_results,
        }


def _validate_xlsx_formulas_pure_python(path: Path) -> Dict[str, Any]:
    """
    Pure-Python deterministic formula validator for .xlsx workbooks:
    - Verifies balanced parentheses in every formula
    - Verifies every cross-sheet reference ('SheetName'!Cell) points to an actual sheet in the workbook
    - Verifies zero Excel error literals (#REF!, #NAME?, #DIV/0!, #VALUE!, #N/A, #NUM!, #NULL!)
    - Counts formula families (SUM, SUMIF, COUNTIF, AVERAGE, IF, ROUND, ABS, MIN, MAX, SUMPRODUCT).
    """
    from openpyxl import load_workbook

    err_tokens = {"#REF!", "#NAME?", "#VALUE!", "#DIV/0!", "#N/A", "#NUM!", "#NULL!"}
    sheet_ref_re = re.compile(r"'([^']+)'!")
    func_re = re.compile(r"\b([A-Z][A-Z0-9_.]+)\(")

    wb = load_workbook(str(path), data_only=False)
    sheet_set = set(wb.sheetnames)
    syntax_issues: List[Dict[str, str]] = []
    funcs_used: Dict[str, int] = {}
    formula_count = 0

    for sname in wb.sheetnames:
        ws = wb[sname]
        for row in ws.iter_rows():
            for cell in row:
                v = cell.value
                if not isinstance(v, str):
                    continue
                if any(tok in v for tok in err_tokens):
                    syntax_issues.append({"sheet": sname, "cell": cell.coordinate, "issue": f"Error token in cell: {v}"})
                if v.startswith("="):
                    formula_count += 1
                    if v.count("(") != v.count(")"):
                        syntax_issues.append({"sheet": sname, "cell": cell.coordinate, "issue": f"Unbalanced parentheses: {v}"})
                    for ref_sheet in sheet_ref_re.findall(v):
                        if ref_sheet not in sheet_set:
                            syntax_issues.append({"sheet": sname, "cell": cell.coordinate, "issue": f"Missing target sheet '{ref_sheet}'"})
                    for fn in func_re.findall(v.upper()):
                        funcs_used[fn] = funcs_used.get(fn, 0) + 1

    return {
        "formula_syntax_pass": formula_count > 0 and len(syntax_issues) == 0,
        "formula_count": formula_count,
        "functions_used": funcs_used,
        "syntax_issues": syntax_issues[:20],
    }


def audit_file(path: Path, run_com_eval: bool = False) -> Dict[str, Any]:
    ext = path.suffix.lower()
    magic = _check_magic_bytes(path)
    engine = _load_pro_office_engine()
    rel_posix = (
        path.resolve().relative_to(WORKSPACE_ROOT).as_posix()
        if path.resolve().is_relative_to(WORKSPACE_ROOT)
        else path.name
    )

    result: Dict[str, Any] = {
        "file": rel_posix,
        "format": ext.lstrip("."),
        "size_bytes": path.stat().st_size,
        "magic_check": magic,
    }

    if ext == ".pdf":
        pdf_res = _audit_pdf_deep(path)
        text = pdf_res.pop("text", "")
        result["pdf_audit"] = pdf_res
        result["zero_blue"] = {"zero_blue_pass": pdf_res["zero_blue_pass"], "details": pdf_res["blue_pixel_pages"]}
        result["pii_hygiene"] = _check_pii_and_secrets(text)
        passed = magic["valid"] and pdf_res["page_count"] >= 1 and pdf_res["zero_blue_pass"] and result["pii_hygiene"]["pii_secret_pass"]
        result["status"] = "PASS" if passed else "FAIL"
        return result

    # OOXML (.docx, .xlsx, .pptx)
    office_audit = None
    if engine:
        if ext == ".docx":
            office_audit = engine.audit_docx(str(path))
        elif ext == ".xlsx":
            office_audit = engine.audit_xlsx(str(path))
        elif ext == ".pptx":
            office_audit = engine.audit_pptx(str(path))
        if isinstance(office_audit, dict) and "file" in office_audit:
            office_audit["file"] = rel_posix

    zb = _audit_ooxml_zero_blue(path)
    text = _extract_ooxml_text(path)
    pii = _check_pii_and_secrets(text)

    result["pro_office_audit"] = office_audit
    result["zero_blue"] = zb
    result["pii_hygiene"] = pii

    formula_ok = True
    if ext == ".xlsx":
        f_val = _validate_xlsx_formulas_pure_python(path)
        result["excel_formula_validation"] = f_val
        formula_ok = f_val["formula_syntax_pass"]
        if run_com_eval:
            com_eval = _evaluate_xlsx_with_excel_com(path)
            result["excel_live_eval"] = com_eval
            if com_eval.get("evaluated_via_excel_com"):
                formula_ok = formula_ok and bool(com_eval.get("formula_eval_pass"))

    office_ok = (office_audit is None) or (office_audit.get("status") == "READY")
    passed = magic["valid"] and office_ok and zb["zero_blue_pass"] and pii["pii_secret_pass"] and formula_ok
    result["status"] = "PASS" if passed else "FAIL"
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="StockFlow Document Export Suite Auditor")
    parser.add_argument("--exports-dir", default=str(WORKSPACE_ROOT / "exports"))
    parser.add_argument("--report-out", default=str(WORKSPACE_ROOT / "exports" / "AUDIT_REPORT.json"))
    parser.add_argument("--com-eval", action="store_true", help="Also run Windows Excel Desktop COM formula evaluation")
    args = parser.parse_args()

    exp_dir = Path(args.exports_dir)
    files = sorted(
        p for p in exp_dir.rglob("*")
        if p.is_file() and p.suffix.lower() in {".xlsx", ".docx", ".pdf", ".pptx"}
    )

    reports = [audit_file(p, run_com_eval=args.com_eval) for p in files]
    passed = sum(1 for r in reports if r["status"] == "PASS")
    failed = len(reports) - passed

    summary = {
        "overall_status": "ALL_PASSED" if (len(reports) > 0 and failed == 0) else "FAILED",
        "total_files": len(reports),
        "passed": passed,
        "failed": failed,
        "zero_blue_all_passed": all(r["zero_blue"]["zero_blue_pass"] for r in reports),
        "pii_hygiene_all_passed": all(r["pii_hygiene"]["pii_secret_pass"] for r in reports),
        "results": reports,
    }

    out_json = Path(args.report_out)
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    return 0 if failed == 0 and len(reports) > 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())

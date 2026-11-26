#!/usr/bin/env python3
"""
StockFlow Document Export CLI Entrypoint.

Usage:
  python document-service/generate_export.py \
      --report <inventory|financial|tax|payroll|invoice|payslip|opname|executive_review> \
      --format <pdf|docx|xlsx|pptx> \
      [--input <json_path_or_->] \
      --output <output_path> \
      [--logo <png_path>] \
      [--audit]

  python document-service/generate_export.py --build-all [--logo <png_path>]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

SERVICE_DIR = Path(__file__).resolve().parent
if str(SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(SERVICE_DIR))

from brand_theme import WORKSPACE_ROOT, resolve_logo_path
from excel_builder import (
    build_financial_xlsx,
    build_inventory_xlsx,
    build_payroll_xlsx,
    build_tax_xlsx,
)
from pdf_builder import (
    build_financial_pdf,
    build_invoice_pdf,
    build_opname_pdf,
    build_payroll_pdf,
    build_payslip_pdf,
    build_tax_pdf,
)
from pptx_builder import build_executive_pptx
from word_builder import (
    build_financial_docx,
    build_generic_report_docx,
    build_invoice_docx,
    build_payslip_docx,
)

MIME_TYPES: Dict[str, str] = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}

ALLOWED_REPORTS = {
    "inventory",
    "financial",
    "tax",
    "payroll",
    "invoice",
    "payslip",
    "opname",
    "executive_review",
}

ALLOWED_FORMATS = {"pdf", "docx", "xlsx", "pptx"}

DEFAULT_EXPORT_CATALOG = [
    # Excel (.xlsx)
    ("inventory", "xlsx", "exports/excel/StockFlow_Inventory_Valuation_Report.xlsx"),
    ("financial", "xlsx", "exports/excel/StockFlow_Financial_Statements_2026.xlsx"),
    ("tax", "xlsx", "exports/excel/StockFlow_Tax_PPN_PPh21_Recap.xlsx"),
    ("payroll", "xlsx", "exports/excel/StockFlow_Payroll_Summary_2026.xlsx"),
    # Word (.docx)
    ("invoice", "docx", "exports/word/StockFlow_Sales_Invoice_INV-2026-001.docx"),
    ("financial", "docx", "exports/word/StockFlow_Management_Financial_Report.docx"),
    ("payslip", "docx", "exports/word/StockFlow_Employee_Payslip_Sample.docx"),
    # PDF (.pdf)
    ("invoice", "pdf", "exports/pdf/StockFlow_Sales_Invoice_INV-2026-001.pdf"),
    ("financial", "pdf", "exports/pdf/StockFlow_Financial_Report_2026.pdf"),
    ("opname", "pdf", "exports/pdf/StockFlow_Inventory_Stock_Opname_Sheet.pdf"),
    ("payslip", "pdf", "exports/pdf/StockFlow_Employee_Payslip_Sample.pdf"),
    # PowerPoint (.pptx)
    ("executive_review", "pptx", "exports/powerpoint/StockFlow_Executive_Business_Review.pptx"),
]


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def generate_document(
    report: str,
    fmt: str,
    output_path: str | Path,
    payload: Optional[Dict[str, Any]] = None,
    logo_path: Optional[str] = None,
) -> Dict[str, Any]:
    rep = str(report).strip().lower()
    ext = str(fmt).strip().lower().lstrip(".")

    if rep not in ALLOWED_REPORTS:
        raise ValueError(f"Unsupported report '{report}'. Allowed: {sorted(ALLOWED_REPORTS)}")
    if ext not in ALLOWED_FORMATS:
        raise ValueError(f"Unsupported format '{fmt}'. Allowed: {sorted(ALLOWED_FORMATS)}")

    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    resolved_logo = resolve_logo_path(logo_path)

    if ext == "xlsx":
        if rep in ("inventory", "opname"):
            build_inventory_xlsx(out, payload)
        elif rep == "financial":
            build_financial_xlsx(out, payload)
        elif rep == "tax":
            build_tax_xlsx(out, payload)
        elif rep == "payroll":
            build_payroll_xlsx(out, payload)
        else:
            raise ValueError(f"Report '{rep}' does not support format 'xlsx'.")
    elif ext == "docx":
        if rep == "invoice":
            build_invoice_docx(out, payload, str(resolved_logo))
        elif rep == "financial":
            build_financial_docx(out, payload, str(resolved_logo))
        elif rep == "payslip":
            build_payslip_docx(out, payload, str(resolved_logo))
        elif rep in ("inventory", "opname"):
            build_generic_report_docx("inventory", out, payload, str(resolved_logo))
        elif rep == "tax":
            build_generic_report_docx("tax", out, payload, str(resolved_logo))
        elif rep == "payroll":
            build_generic_report_docx("payroll", out, payload, str(resolved_logo))
        else:
            raise ValueError(f"Report '{rep}' does not support format 'docx'.")
    elif ext == "pdf":
        if rep == "invoice":
            build_invoice_pdf(out, payload, str(resolved_logo))
        elif rep == "financial":
            build_financial_pdf(out, payload, str(resolved_logo))
        elif rep in ("opname", "inventory"):
            build_opname_pdf(out, payload, str(resolved_logo))
        elif rep == "payslip":
            build_payslip_pdf(out, payload, str(resolved_logo))
        elif rep == "tax":
            build_tax_pdf(out, payload, str(resolved_logo))
        elif rep == "payroll":
            build_payroll_pdf(out, payload, str(resolved_logo))
        else:
            raise ValueError(f"Report '{rep}' does not support format 'pdf'.")
    elif ext == "pptx":
        if rep in ("executive_review", "financial"):
            build_executive_pptx(out, payload, str(resolved_logo))
        else:
            raise ValueError(f"Report '{rep}' does not support format 'pptx'.")

    return {
        "status": "ok",
        "report": rep,
        "format": ext,
        "mime_type": MIME_TYPES[ext],
        "output": str(out.resolve()),
        "size_bytes": out.stat().st_size,
        "sha256": _sha256_file(out),
        "logo_used": str(resolved_logo.resolve()),
    }


def _load_input_json(input_arg: Optional[str]) -> Optional[Dict[str, Any]]:
    if not input_arg:
        return None
    if input_arg == "-":
        raw = sys.stdin.read().strip()
        return json.loads(raw) if raw else None
    p = Path(input_arg)
    if not p.exists():
        raise FileNotFoundError(f"Input JSON file not found: {p}")
    return json.loads(p.read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description="StockFlow Production Document Export CLI (Zero-Blue Craft Suite)")
    parser.add_argument("--report", choices=sorted(ALLOWED_REPORTS), help="Report type to generate")
    parser.add_argument("--format", choices=sorted(ALLOWED_FORMATS), help="Target output format")
    parser.add_argument("--input", help="Optional path to JSON payload (or '-' for stdin); defaults to synthetic sample data")
    parser.add_argument("--output", help="Target file output path")
    parser.add_argument("--logo", help="Optional explicit path to StockFlow PNG logo")
    parser.add_argument("--build-all", action="store_true", help="Generate all 12 sample exports under exports/{excel,word,pdf,powerpoint}/")
    parser.add_argument("--audit", action="store_true", help="Run structural & zero-blue audit immediately after generation")
    args = parser.parse_args()

    if args.build_all:
        results = []
        for rep, fmt, rel_out in DEFAULT_EXPORT_CATALOG:
            target = WORKSPACE_ROOT / rel_out
            res = generate_document(rep, fmt, target, payload=None, logo_path=args.logo)
            results.append(res)
        summary = {"status": "ok", "count": len(results), "files": results}
        if args.audit:
            from audit_exports import audit_file
            for item in results:
                item["audit"] = audit_file(Path(item["output"]))
        print(json.dumps(summary, indent=2, ensure_ascii=False))
        return 0

    if not args.report or not args.format or not args.output:
        parser.error("Provide --report, --format, and --output (or pass --build-all).")

    payload = _load_input_json(args.input)
    res = generate_document(args.report, args.format, args.output, payload=payload, logo_path=args.logo)
    if args.audit:
        from audit_exports import audit_file
        res["audit"] = audit_file(Path(res["output"]))
    print(json.dumps(res, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

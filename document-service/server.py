#!/usr/bin/env python3
"""
StockFlow Document Export HTTP Micro-Bridge (Optional Local Companion for Laravel/Frontend).

Zero third-party web framework dependencies (uses Python stdlib `http.server`).
Endpoints:
  GET  /health   -> Service readiness & active logo path
  GET  /manifest -> Machine-readable export catalog & schema manifest
  POST /export   -> JSON {"report": "...", "format": "...", "data": {...}} -> Streams binary file
"""

from __future__ import annotations

import argparse
import json
import os
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from brand_theme import resolve_logo_path
from generate_export import ALLOWED_FORMATS, ALLOWED_REPORTS, MIME_TYPES, SERVICE_DIR, generate_document

MANIFEST_PATH = SERVICE_DIR / "export-manifest.json"


class ExportHandler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, payload: dict) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self) -> None:
        if self.path == "/health":
            self._send_json(
                200,
                {
                    "status": "ok",
                    "service": "stockflow-document-service",
                    "zero_blue_enforced": True,
                    "logo_path": str(resolve_logo_path()),
                    "reports": sorted(ALLOWED_REPORTS),
                    "formats": sorted(ALLOWED_FORMATS),
                },
            )
            return
        if self.path == "/manifest":
            if MANIFEST_PATH.exists():
                raw = MANIFEST_PATH.read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(raw)))
                self.send_header("X-Content-Type-Options", "nosniff")
                self.end_headers()
                self.wfile.write(raw)
                return
            self._send_json(404, {"error": "Manifest not found"})
            return
        self._send_json(404, {"error": "Endpoint not found"})

    def do_POST(self) -> None:
        if self.path != "/export":
            self._send_json(404, {"error": "Endpoint not found"})
            return
        try:
            content_len = int(self.headers.get("Content-Length", "0"))
            if content_len > 5 * 1024 * 1024:
                self._send_json(413, {"error": "Payload exceeds 5 MB limit"})
                return
            body = self.rfile.read(content_len) if content_len > 0 else b"{}"
            req = json.loads(body.decode("utf-8"))
            report = str(req.get("report", "")).strip().lower()
            fmt = str(req.get("format", "")).strip().lower()
            data = req.get("data")
            filename = f"StockFlow_{report}.{fmt}"

            if report not in ALLOWED_REPORTS or fmt not in ALLOWED_FORMATS:
                self._send_json(422, {"error": "Invalid report or format"})
                return

            with tempfile.TemporaryDirectory(prefix="sf_export_") as tmpdir:
                out_file = Path(tmpdir) / filename
                generate_document(report, fmt, out_file, payload=data)
                blob = out_file.read_bytes()

            self.send_response(200)
            self.send_header("Content-Type", MIME_TYPES[fmt])
            self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
            self.send_header("Content-Length", str(len(blob)))
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(blob)
        except ValueError as exc:
            self._send_json(422, {"error": str(exc)})
        except Exception as exc:
            self._send_json(500, {"error": f"Document export failed: {exc}"})

    def log_message(self, fmt: str, *args) -> None:
        return


def main() -> None:
    parser = argparse.ArgumentParser(description="StockFlow Document Export HTTP Micro-Bridge")
    parser.add_argument("--host", default=os.environ.get("DOC_SERVICE_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("DOC_SERVICE_PORT", "8095")))
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), ExportHandler)
    print(f"StockFlow Document Service listening on http://{args.host}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

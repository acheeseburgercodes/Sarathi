from __future__ import annotations

import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(Path(__file__).resolve().parent) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parent))

from saarthi.config import load_dotenv  # noqa: E402
from saarthi.orchestrator import run_saarthi  # noqa: E402
from saarthi.storage import LocalStore  # noqa: E402

load_dotenv(ROOT)
STORE = LocalStore(ROOT / "data" / "saarthi.db")
MAX_BODY_BYTES = 64 * 1024


class Handler(BaseHTTPRequestHandler):
    server_version = "SaarthiBackend/1.0"

    def _json(self, status: int, payload: Any) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/health":
            self._json(200, {
                "status": "ok", "service": "saarthi-python", "version": "1.0",
                "ai_configured": bool(os.getenv("OPENAI_API_KEY")),
                "supabase_configured": bool(os.getenv("SUPABASE_URL") and (os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY"))),
            })
            return
        if self.path == "/api/latest":
            latest = STORE.latest_run()
            self._json(200 if latest else 404, latest or {"message": "No Saarthi run has been saved yet."})
            return
        self._json(404, {"message": "Route not found."})

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/api/run":
            self._json(404, {"message": "Route not found."})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY_BYTES:
                self._json(413, {"message": "Request body is empty or too large."})
                return
            raw = json.loads(self.rfile.read(length).decode("utf-8"))
            query = str(raw.get("query") or "").strip()[:2000]
            if not query:
                self._json(400, {"message": "A query is required."})
                return
            profile = str(raw.get("profile") or "standard")
            if profile not in ("remote", "standard", "deep"):
                self._json(400, {"message": "Profile must be remote, standard, or deep."})
                return
            run = run_saarthi(
                query=query, profile=profile,
                location=str(raw.get("location") or "Chennai, Tamil Nadu, India")[:200],
                latitude=float(raw.get("latitude", 13.0827)), longitude=float(raw.get("longitude", 80.2707)),
                offline=bool(raw.get("offline", False)), use_ai=not bool(raw.get("no_ai", False)), root=ROOT,
            )
            self._json(200, run)
        except (TypeError, ValueError, json.JSONDecodeError) as error:
            self._json(400, {"message": f"Invalid request: {error}"})
        except Exception as error:
            self._json(500, {"message": f"Saarthi could not complete the run: {error}"})

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"[backend] {self.address_string()} {fmt % args}", flush=True)


def main() -> None:
    host = "127.0.0.1"
    port = int(os.getenv("SARATHI_BACKEND_PORT", "8765"))
    print(f"Saarthi Python backend listening on http://{host}:{port}", flush=True)
    ThreadingHTTPServer((host, port), Handler).serve_forever()


if __name__ == "__main__":
    main()

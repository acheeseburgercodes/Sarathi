from __future__ import annotations

import hashlib
import json
import os
import urllib.parse
import urllib.request
from typing import Any, Callable, Optional


Transport = Callable[[str, bytes, dict[str, str], int], None]


def _default_transport(url: str, body: bytes, headers: dict[str, str], timeout: int) -> None:
    request = urllib.request.Request(url, data=body, method="POST", headers=headers)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        if response.status not in (200, 201, 204):
            raise RuntimeError(f"Supabase Data API returned HTTP {response.status}")
        response.read()


class SupabaseClient:
    """Small server-only PostgREST writer; no third-party package required."""

    def __init__(self, url: str = "", secret_key: str = "", timeout: int = 15, transport: Optional[Transport] = None):
        self.url = url.rstrip("/")
        self.secret_key = secret_key
        self.timeout = timeout
        self.transport = transport or _default_transport
        if self.url:
            parsed = urllib.parse.urlparse(self.url)
            if parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password or parsed.query or parsed.fragment:
                raise ValueError("SUPABASE_URL must be a clean HTTPS project URL")

    @classmethod
    def from_env(cls) -> "SupabaseClient":
        key = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        return cls(os.getenv("SUPABASE_URL", ""), key)

    @property
    def configured(self) -> bool:
        return bool(self.url and self.secret_key)

    def _headers(self, prefer: str) -> dict[str, str]:
        headers = {"apikey": self.secret_key, "Content-Type": "application/json", "Prefer": prefer, "User-Agent": "Saarthi-Backend/1.0"}
        if self.secret_key.startswith("eyJ"):
            headers["Authorization"] = f"Bearer {self.secret_key}"
        return headers

    def upsert(self, table: str, rows: list[dict[str, Any]], on_conflict: str) -> None:
        if not self.configured:
            raise RuntimeError("Supabase is not configured")
        query = urllib.parse.urlencode({"on_conflict": on_conflict})
        url = f"{self.url}/rest/v1/{table}?{query}"
        body = json.dumps(rows, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.transport(url, body, self._headers("resolution=merge-duplicates,return=minimal"), self.timeout)

    def sync_run(self, run: dict[str, Any]) -> None:
        run_id = run["run_id"]
        generated_at = run["generated_at"]
        run_row = {
            "run_id": run_id, "generated_at": generated_at, "profile": run["profile"], "connectivity": run["connectivity"],
            "location": run["context"]["location"], "query": run["context"]["query"], "ai_status": run["central"]["status"],
            "source_health": run["source_health"], "token_usage": run["token_usage"], "central": run["central"], "payload": run,
        }
        source_rows = []
        agent_rows = []
        for agent in run["agents"]:
            evidence = agent.get("evidence")
            if evidence:
                encoded = json.dumps(evidence, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
                source_rows.append({
                    "source_id": agent["id"], "run_id": run_id, "status": agent["source_status"], "source_name": agent.get("source"),
                    "authority": evidence.get("authority"), "retrieved_at": evidence.get("retrieved_at"), "updated_at": generated_at,
                    "content_sha256": hashlib.sha256(encoded).hexdigest(), "data": evidence,
                })
            agent_rows.append({
                "run_id": run_id, "agent_id": agent["id"], "agent_name": agent["name"], "status": agent["status"],
                "model": agent.get("model"), "source_status": agent["source_status"], "report": agent["report"], "error": agent.get("error"), "created_at": generated_at,
            })
        self.upsert("saarthi_runs", [run_row], "run_id")
        if source_rows:
            self.upsert("saarthi_source_snapshots", source_rows, "source_id")
        self.upsert("saarthi_agent_outputs", agent_rows, "run_id,agent_id")


def sync_with_outbox(run: dict[str, Any], client: SupabaseClient, store: Any) -> dict[str, Any]:
    if not client.configured:
        return {"status": "disabled", "synced": False, "flushed_runs": 0, "pending_runs": store.pending_sync_count(), "error": "SUPABASE_URL and SUPABASE_SECRET_KEY are not configured"}
    flushed = 0
    for pending in store.pending_sync(limit=20):
        try:
            client.sync_run(pending["payload"])
            store.mark_sync_complete(pending["id"])
            flushed += 1
        except Exception as error:
            store.mark_sync_failed(pending["id"], str(error))
            break
    try:
        client.sync_run(run)
        return {"status": "synced", "synced": True, "flushed_runs": flushed, "pending_runs": store.pending_sync_count(), "error": None}
    except Exception as error:
        store.queue_sync(run, str(error))
        return {"status": "queued", "synced": False, "flushed_runs": flushed, "pending_runs": store.pending_sync_count(), "error": str(error)}

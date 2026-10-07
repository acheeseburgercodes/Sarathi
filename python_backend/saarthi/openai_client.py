from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from threading import Lock
from typing import Any, Optional

from .token_budget import TokenBudget, conservative_token_estimate


class OpenAIQuotaError(RuntimeError):
    """A billing/rate-limit response that should open the run-wide circuit."""


_QUOTA_CODES = {"credit_balance_exhausted", "insufficient_quota", "billing_hard_limit_reached", "rate_limit_exceeded"}


def _response_text(payload: dict[str, Any]) -> str:
    if isinstance(payload.get("output_text"), str):
        return payload["output_text"].strip()
    parts = []
    for output in payload.get("output") or []:
        for content in output.get("content") or []:
            if content.get("type") == "output_text" and isinstance(content.get("text"), str):
                parts.append(content["text"])
    return "\n".join(parts).strip()


class OpenAIResponsesClient:
    def __init__(self, api_key: Optional[str] = None, exact_count: Optional[bool] = None, timeout: int = 30):
        self.api_key = api_key if api_key is not None else os.getenv("OPENAI_API_KEY", "")
        self.exact_count = exact_count if exact_count is not None else os.getenv("SARATHI_EXACT_TOKEN_COUNT", "1") != "0"
        self.timeout = timeout
        self._disabled_reason: Optional[str] = None
        self._state_lock = Lock()

    @property
    def available(self) -> bool:
        return bool(self.api_key) and self._disabled_reason is None

    @property
    def fallback_reason(self) -> Optional[str]:
        return self._disabled_reason

    def _open_circuit(self, reason: str) -> None:
        with self._state_lock:
            self._disabled_reason = reason

    def _post(self, endpoint: str, payload: dict[str, Any]) -> dict[str, Any]:
        request = urllib.request.Request(
            f"https://api.openai.com/v1/{endpoint}", data=json.dumps(payload).encode("utf-8"), method="POST",
            headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json", "User-Agent": "Saarthi-Python/1.0"},
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            detail = ""
            code = None
            try:
                body = json.loads(error.read().decode("utf-8"))
                provider_error = body.get("error") or {}
                code = provider_error.get("code")
                message = provider_error.get("message")
                detail = f" ({code}: {str(message)[:300]})" if code and message else f" ({str(message)[:300]})" if message else ""
            except Exception:
                pass
            message = f"OpenAI API returned HTTP {error.code}{detail}"
            if error.code == 429 or code in _QUOTA_CODES:
                self._open_circuit(message)
                raise OpenAIQuotaError(message) from error
            raise RuntimeError(message) from error

    def count_input(self, model: str, input_items: list[dict[str, str]]) -> tuple[int, bool]:
        serialized = json.dumps(input_items, ensure_ascii=False)
        if not self.available or not self.exact_count:
            return conservative_token_estimate(serialized), False
        try:
            payload = self._post("responses/input_tokens", {"model": model, "input": input_items})
            count = payload.get("input_tokens")
            if not isinstance(count, int):
                raise RuntimeError("Token count was absent")
            return count, True
        except Exception:
            return conservative_token_estimate(serialized), False

    def run(self, *, agent: str, model: str, instructions: str, input_data: Any, max_output_tokens: int, budget: TokenBudget) -> dict[str, Any]:
        if not self.available:
            reason = self._disabled_reason or "OPENAI_API_KEY is not configured"
            status = "credit-fallback" if self._disabled_reason else "unavailable"
            return {"status": status, "text": None, "model": None, "error": reason, "token_count_exact": False, "metrics": None}
        started = time.monotonic()
        input_items = [{"role": "developer", "content": instructions}, {"role": "user", "content": json.dumps(input_data, ensure_ascii=False)}]
        input_tokens, exact = self.count_input(model, input_items)
        if not self.available:
            return {"status": "credit-fallback", "text": None, "model": model, "error": self._disabled_reason, "token_count_exact": exact, "metrics": None}
        reservation = budget.reserve(agent, input_tokens, max_output_tokens)
        try:
            payload = self._post("responses", {"model": model, "input": input_items, "max_output_tokens": max_output_tokens, "store": False})
            usage = payload.get("usage") or {}
            budget.commit(reservation, usage.get("input_tokens"), usage.get("output_tokens"))
            input_details = usage.get("input_tokens_details") or {}
            output_details = usage.get("output_tokens_details") or {}
            metrics = {
                "latency_ms": round((time.monotonic() - started) * 1000),
                "input_tokens": reservation.input_tokens,
                "output_tokens": reservation.output_tokens,
                "total_tokens": (reservation.input_tokens or 0) + (reservation.output_tokens or 0),
                "cached_input_tokens": input_details.get("cached_tokens"),
                "reasoning_tokens": output_details.get("reasoning_tokens"),
                "input_count_exact": exact,
            }
            text = _response_text(payload)
            if not text:
                raise RuntimeError("The model returned no text output")
            return {"status": "completed", "text": text, "model": model, "error": None, "token_count_exact": exact, "metrics": metrics}
        except Exception as error:
            quota_failure = isinstance(error, OpenAIQuotaError)
            budget.commit(reservation, 0 if quota_failure else None, 0)
            metrics = {
                "latency_ms": round((time.monotonic() - started) * 1000),
                "input_tokens": reservation.input_tokens,
                "output_tokens": reservation.output_tokens,
                "total_tokens": (reservation.input_tokens or 0) + (reservation.output_tokens or 0),
                "cached_input_tokens": None,
                "reasoning_tokens": None,
                "input_count_exact": exact,
            }
            return {"status": "credit-fallback" if quota_failure else "failed", "text": None, "model": model, "error": str(error), "token_count_exact": exact, "metrics": metrics}

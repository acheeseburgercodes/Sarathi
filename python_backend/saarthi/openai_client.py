from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any, Optional

from .token_budget import TokenBudget, conservative_token_estimate


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

    @property
    def available(self) -> bool:
        return bool(self.api_key)

    def _post(self, endpoint: str, payload: dict[str, Any]) -> dict[str, Any]:
        request = urllib.request.Request(
            f"https://api.openai.com/v1/{endpoint}", data=json.dumps(payload).encode("utf-8"), method="POST",
            headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json", "User-Agent": "Saarthi-Python/1.0"},
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            raise RuntimeError(f"OpenAI API returned HTTP {error.code}") from error

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
            return {"status": "unavailable", "text": None, "model": None, "error": "OPENAI_API_KEY is not configured", "token_count_exact": False}
        input_items = [{"role": "developer", "content": instructions}, {"role": "user", "content": json.dumps(input_data, ensure_ascii=False)}]
        input_tokens, exact = self.count_input(model, input_items)
        reservation = budget.reserve(agent, input_tokens, max_output_tokens)
        try:
            payload = self._post("responses", {"model": model, "input": input_items, "max_output_tokens": max_output_tokens, "store": False})
            usage = payload.get("usage") or {}
            budget.commit(reservation, usage.get("input_tokens"), usage.get("output_tokens"))
            text = _response_text(payload)
            if not text:
                raise RuntimeError("The model returned no text output")
            return {"status": "completed", "text": text, "model": model, "error": None, "token_count_exact": exact}
        except Exception as error:
            budget.commit(reservation)
            return {"status": "failed", "text": None, "model": model, "error": str(error), "token_count_exact": exact}

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class TokenLimits:
    max_model_calls: int
    max_input_tokens: int
    max_output_tokens: int
    max_total_tokens: int
    max_input_tokens_per_call: int
    central_input_reserve: int


PROFILES = {
    "remote": TokenLimits(2, 6_000, 1_500, 7_500, 4_000, 2_000),
    "standard": TokenLimits(6, 30_000, 8_000, 38_000, 8_000, 6_000),
    "deep": TokenLimits(7, 60_000, 12_000, 72_000, 16_000, 12_000),
}


def load_dotenv(root: Path) -> None:
    """Load simple KEY=VALUE files without overriding the parent environment."""
    for filename in (".env", ".env.local"):
        path = root / filename
        if not path.exists():
            continue
        for raw_line in path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key:
                os.environ.setdefault(key, value)


def limits_for(profile: str) -> TokenLimits:
    if profile not in PROFILES:
        raise ValueError(f"Unknown profile: {profile}")
    base = PROFILES[profile]

    def value(name: str, fallback: int) -> int:
        raw = os.getenv(name)
        if not raw:
            return fallback
        parsed = int(raw)
        if parsed <= 0:
            raise ValueError(f"{name} must be greater than zero")
        return parsed

    return TokenLimits(
        value("SARATHI_MAX_MODEL_CALLS", base.max_model_calls),
        value("SARATHI_MAX_INPUT_TOKENS", base.max_input_tokens),
        value("SARATHI_MAX_OUTPUT_TOKENS", base.max_output_tokens),
        value("SARATHI_MAX_TOTAL_TOKENS", base.max_total_tokens),
        value("SARATHI_MAX_INPUT_TOKENS_PER_CALL", base.max_input_tokens_per_call),
        value("SARATHI_CENTRAL_INPUT_RESERVE", base.central_input_reserve),
    )

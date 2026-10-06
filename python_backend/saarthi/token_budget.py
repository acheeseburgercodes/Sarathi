from __future__ import annotations

from dataclasses import asdict, dataclass
from threading import Lock
from typing import Any, Dict, Optional

from .config import TokenLimits


class BudgetExceeded(RuntimeError):
    pass


def conservative_token_estimate(value: str) -> int:
    return max(1, (len(value) + 2) // 3)


@dataclass
class Reservation:
    agent: str
    planned_input_tokens: int
    max_output_tokens: int
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None


class TokenBudget:
    """Thread-safe shared run budget with pre-call reservation."""

    def __init__(self, limits: TokenLimits):
        self.limits = limits
        self._lock = Lock()
        self._calls = 0
        self._input = 0
        self._output = 0
        self._reserved_output = 0
        self._entries: list[Reservation] = []

    def reserve(self, agent: str, input_tokens: int, max_output_tokens: int) -> Reservation:
        incoming = max(0, int(input_tokens))
        outgoing = max(1, int(max_output_tokens))
        with self._lock:
            if incoming > self.limits.max_input_tokens_per_call:
                raise BudgetExceeded(f"{agent}: per-call input limit exceeded")
            if self._calls + 1 > self.limits.max_model_calls:
                raise BudgetExceeded(f"{agent}: model-call limit exceeded")
            specialist_ceiling = self.limits.max_input_tokens - self.limits.central_input_reserve
            if agent != "central" and self._input + incoming > specialist_ceiling:
                raise BudgetExceeded(f"{agent}: central-agent input reserve protected")
            if self._input + incoming > self.limits.max_input_tokens:
                raise BudgetExceeded(f"{agent}: run input limit exceeded")
            if self._output + self._reserved_output + outgoing > self.limits.max_output_tokens:
                raise BudgetExceeded(f"{agent}: run output limit exceeded")
            projected = self._input + incoming + self._output + self._reserved_output + outgoing
            if projected > self.limits.max_total_tokens:
                raise BudgetExceeded(f"{agent}: total token limit exceeded")
            reservation = Reservation(agent, incoming, outgoing)
            self._calls += 1
            self._input += incoming
            self._reserved_output += outgoing
            self._entries.append(reservation)
            return reservation

    def commit(self, reservation: Reservation, input_tokens: Optional[int] = None, output_tokens: Optional[int] = None) -> None:
        with self._lock:
            if reservation.output_tokens is not None:
                return
            actual_input = max(0, int(input_tokens if input_tokens is not None else reservation.planned_input_tokens))
            actual_output = max(0, min(reservation.max_output_tokens, int(output_tokens or 0)))
            self._input += actual_input - reservation.planned_input_tokens
            self._reserved_output -= reservation.max_output_tokens
            self._output += actual_output
            reservation.input_tokens = actual_input
            reservation.output_tokens = actual_output

    def snapshot(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "model_calls": self._calls,
                "input_tokens": self._input,
                "output_tokens": self._output,
                "reserved_output_tokens": self._reserved_output,
                "total_tokens": self._input + self._output,
                "limits": asdict(self.limits),
                "by_agent": [asdict(entry) for entry in self._entries],
            }

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "python_backend"))

from saarthi.agents import route_agents  # noqa: E402
from saarthi.config import PROFILES, TokenLimits  # noqa: E402
from saarthi.openai_client import OpenAIResponsesClient  # noqa: E402
from saarthi.orchestrator import run_saarthi  # noqa: E402
from saarthi.storage import LocalStore  # noqa: E402
from saarthi.token_budget import BudgetExceeded, TokenBudget  # noqa: E402


class TokenBudgetTests(unittest.TestCase):
    def test_reserves_then_releases_unused_output(self):
        budget = TokenBudget(TokenLimits(2, 1000, 500, 1500, 700, 200))
        reservation = budget.reserve("weather", 300, 400)
        budget.commit(reservation, 280, 75)
        snapshot = budget.snapshot()
        self.assertEqual(snapshot["model_calls"], 1)
        self.assertEqual(snapshot["total_tokens"], 355)
        self.assertEqual(snapshot["reserved_output_tokens"], 0)

    def test_blocks_projected_total_before_call(self):
        budget = TokenBudget(TokenLimits(1, 100, 100, 150, 100, 20))
        with self.assertRaises(BudgetExceeded):
            budget.reserve("central", 80, 80)

    def test_specialists_cannot_consume_central_input_reserve(self):
        budget = TokenBudget(TokenLimits(3, 1000, 500, 1500, 900, 300))
        with self.assertRaisesRegex(BudgetExceeded, "central-agent input reserve"):
            budget.reserve("news", 701, 100)
        central = budget.reserve("central", 900, 100)
        budget.commit(central, 900, 25)
        self.assertEqual(budget.snapshot()["model_calls"], 1)


class RoutingTests(unittest.TestCase):
    def test_remote_profile_selects_one_relevant_specialist(self):
        self.assertEqual(route_agents("weather and earthquake briefing", "remote"), ["weather"])


class CacheTests(unittest.TestCase):
    def test_offline_source_cache_round_trip(self):
        with tempfile.TemporaryDirectory() as directory:
            store = LocalStore(Path(directory) / "saarthi.db")
            store.cache_source("weather", {"source": "test", "value": 7})
            cached = store.cached_source("weather")
            self.assertEqual(cached["payload"], {"source": "test", "value": 7})


class OrchestrationTests(unittest.TestCase):
    @staticmethod
    def sources():
        return {
            "weather": {"status": "available", "data": {"source": "Open-Meteo", "current": {}, "hourly": []}, "cache_age_seconds": 0, "error": None},
            "news": {"status": "available", "data": {"source": "News", "articles": []}, "cache_age_seconds": 0, "error": None},
            "seismic": {"status": "available", "data": {"source": "USGS", "events": []}, "cache_age_seconds": 0, "error": None},
            "events": {"status": "available", "data": {"source": "EONET", "events": []}, "cache_age_seconds": 0, "error": None},
        }

    def test_specialists_report_to_central_without_network(self):
        with tempfile.TemporaryDirectory() as directory, patch("saarthi.orchestrator.collect_sources", return_value=self.sources()):
            run = run_saarthi(query="complete briefing", root=Path(directory), use_ai=False, client=OpenAIResponsesClient(api_key=""))
        self.assertEqual(len(run["agents"]), 4)
        self.assertEqual(run["central"]["status"], "evidence-only")
        self.assertEqual(run["token_usage"]["model_calls"], 0)
        self.assertEqual(run["token_usage"]["limits"]["max_model_calls"], PROFILES["standard"].max_model_calls)

    def test_remote_profile_runs_one_specialist_and_central_model(self):
        class FakeClient:
            available = True

            def __init__(self):
                self.calls = []

            def run(self, *, agent, model, instructions, input_data, max_output_tokens, budget):
                self.calls.append(agent)
                reservation = budget.reserve(agent, 100, max_output_tokens)
                budget.commit(reservation, 100, 25)
                return {"status": "completed", "text": f"{agent} output", "model": model, "error": None}

        client = FakeClient()
        with tempfile.TemporaryDirectory() as directory, patch("saarthi.orchestrator.collect_sources", return_value=self.sources()):
            run = run_saarthi(query="weather and earthquake briefing", profile="remote", root=Path(directory), client=client)
        self.assertEqual(client.calls, ["weather", "central"])
        self.assertEqual(run["token_usage"]["model_calls"], 2)
        self.assertEqual(run["central"]["report"], "central output")


if __name__ == "__main__":
    unittest.main()

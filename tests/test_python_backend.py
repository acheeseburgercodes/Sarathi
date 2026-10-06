from __future__ import annotations

import sys
import tempfile
import unittest
import json
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "python_backend"))

from saarthi.agents import route_agents  # noqa: E402
from saarthi.config import PROFILES, TokenLimits  # noqa: E402
from saarthi.openai_client import OpenAIResponsesClient  # noqa: E402
from saarthi.orchestrator import run_saarthi  # noqa: E402
from saarthi.sources import climate_source  # noqa: E402
from saarthi.storage import LocalStore  # noqa: E402
from saarthi.supabase import SupabaseClient  # noqa: E402
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

    def test_climate_queries_select_climate_specialist(self):
        self.assertEqual(route_agents("compare the climate baseline", "standard"), ["climate"])


class ClimateSourceTests(unittest.TestCase):
    def test_nasa_power_needs_no_key_and_reports_optional_supplement(self):
        payload = {
            "properties": {"parameter": {"T2M": {"ANN": 27.95}, "PRECTOTCORR": {"ANN": 3.43}}},
            "header": {"range": "test climatology"}, "parameters": {},
        }
        with patch.dict("os.environ", {"OPENWEATHER_API_KEY": ""}, clear=False), patch("saarthi.sources._json", return_value=payload) as request:
            result = climate_source({"latitude": 13.0827, "longitude": 80.2707})
        self.assertEqual(result["source"], "NASA POWER")
        self.assertEqual(result["parameters"]["T2M"]["ANN"], 27.95)
        self.assertEqual(result["live_supplement"]["status"], "not-configured")
        self.assertNotIn("appid", request.call_args.args[0])


class CacheTests(unittest.TestCase):
    def test_offline_source_cache_round_trip(self):
        with tempfile.TemporaryDirectory() as directory:
            store = LocalStore(Path(directory) / "saarthi.db")
            store.cache_source("weather", {"source": "test", "value": 7})
            cached = store.cached_source("weather")
            self.assertEqual(cached["payload"], {"source": "test", "value": 7})

    def test_failed_sync_outbox_round_trip(self):
        with tempfile.TemporaryDirectory() as directory:
            store = LocalStore(Path(directory) / "saarthi.db")
            run = {"run_id": "run-1", "generated_at": "2026-10-06T00:00:00Z"}
            store.queue_sync(run, "offline")
            self.assertEqual(store.pending_sync_count(), 1)
            pending = store.pending_sync()[0]
            self.assertEqual(pending["payload"], run)
            store.mark_sync_complete(pending["id"])
            self.assertEqual(store.pending_sync_count(), 0)


class SupabaseTests(unittest.TestCase):
    @staticmethod
    def run_payload():
        return {
            "run_id": "11111111-1111-1111-1111-111111111111", "generated_at": "2026-10-06T00:00:00+00:00", "profile": "remote", "connectivity": "online-with-cache-fallback",
            "context": {"location": "Chennai", "query": "brief"}, "central": {"status": "completed", "report": "report"}, "source_health": {}, "token_usage": {},
            "agents": [{"id": "weather", "name": "Weather", "status": "completed", "model": "model", "source_status": "available", "source": "Open-Meteo", "report": "weather", "error": None, "evidence": {"source": "Open-Meteo", "authority": "Open-Meteo", "retrieved_at": "2026-10-06T00:00:00+00:00"}}],
        }

    def test_new_secret_key_uses_apikey_header_and_upserts_all_tables(self):
        calls = []

        def transport(url, body, headers, timeout):
            calls.append((url, headers, json.loads(body)))

        client = SupabaseClient("https://example.supabase.co", "sb_secret_test", transport=transport)
        client.sync_run(self.run_payload())
        self.assertEqual(len(calls), 3)
        self.assertTrue(all(call[1]["apikey"] == "sb_secret_test" for call in calls))
        self.assertTrue(all("Authorization" not in call[1] for call in calls))
        self.assertIn("saarthi_source_snapshots", calls[1][0])


class OrchestrationTests(unittest.TestCase):
    @staticmethod
    def sources():
        return {
            "weather": {"status": "available", "data": {"source": "Open-Meteo", "current": {}, "hourly": []}, "cache_age_seconds": 0, "error": None},
            "climate": {"status": "available", "data": {"source": "NASA POWER", "climatology_period": "20-year", "parameters": {}, "live_supplement": {"status": "not-configured"}}, "cache_age_seconds": 0, "error": None},
            "news": {"status": "available", "data": {"source": "News", "articles": []}, "cache_age_seconds": 0, "error": None},
            "seismic": {"status": "available", "data": {"source": "USGS", "events": []}, "cache_age_seconds": 0, "error": None},
            "events": {"status": "available", "data": {"source": "EONET", "events": []}, "cache_age_seconds": 0, "error": None},
        }

    def test_specialists_report_to_central_without_network(self):
        with tempfile.TemporaryDirectory() as directory, patch("saarthi.orchestrator.collect_sources", return_value=self.sources()):
            run = run_saarthi(query="complete briefing", root=Path(directory), use_ai=False, client=OpenAIResponsesClient(api_key=""))
        self.assertEqual(len(run["agents"]), 5)
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

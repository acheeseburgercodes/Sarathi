from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(Path(__file__).resolve().parent) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from saarthi.config import load_dotenv  # noqa: E402
from saarthi.orchestrator import run_saarthi, save_run_file  # noqa: E402


def parser() -> argparse.ArgumentParser:
    command = argparse.ArgumentParser(description="Saarthi multi-agent disaster intelligence backend")
    command.add_argument("query", nargs="*", help="Task for the central agent")
    command.add_argument("--profile", choices=("remote", "standard", "deep"), default="standard")
    command.add_argument("--location", default="Chennai, Tamil Nadu, India")
    command.add_argument("--lat", type=float, default=13.0827)
    command.add_argument("--lon", type=float, default=80.2707)
    command.add_argument("--offline", action="store_true", help="Use only locally cached source data")
    command.add_argument("--no-ai", action="store_true", help="Extract evidence without model calls")
    command.add_argument("--json", action="store_true", help="Print the complete frontend-compatible JSON")
    command.add_argument("--save", metavar="PATH", help="Save JSON to a specific path")
    command.add_argument("--no-save", action="store_true", help="Do not write a run JSON file")
    return command


def print_terminal(run: dict) -> None:
    line = "=" * 78
    print(f"\n{line}\nSAARTHI CENTRAL · {run['context']['location']}\n{run['generated_at']} · {run['profile'].upper()} PROFILE\n{line}")
    print(run["central"]["report"])
    print(f"\n{line}\nAGENT EXECUTION")
    for agent in run["agents"]:
        model = f" · {agent['model']}" if agent["model"] else ""
        print(f"  {agent['name']:<31} {agent['status']}{model}")
    print("\nSOURCE HEALTH")
    for name, source in run["source_health"].items():
        age = f" · cache {source['cache_age_seconds']}s" if source["status"] == "cached" else ""
        print(f"  {name:<12} {source['status']}{age}")
    usage = run["token_usage"]
    limits = usage["limits"]
    print("\nTOKEN LEDGER")
    print(f"  Calls  {usage['model_calls']}/{limits['max_model_calls']}")
    print(f"  Input  {usage['input_tokens']}/{limits['max_input_tokens']}")
    print(f"  Output {usage['output_tokens']}/{limits['max_output_tokens']}")
    print(f"  Total  {usage['total_tokens']}/{limits['max_total_tokens']}")
    if run["ai"]["requested"] and not run["ai"]["available"]:
        print("\nAI STATUS: OPENAI_API_KEY is not configured. Evidence extraction completed without generated claims.")
    print(line)


def main() -> int:
    load_dotenv(ROOT)
    args = parser().parse_args()
    query = " ".join(args.query).strip()
    if not query:
        try:
            query = input("What should Saarthi investigate? ").strip()
        except EOFError:
            query = ""
    if not query:
        print("A query is required.", file=sys.stderr)
        return 2
    run = run_saarthi(query=query, profile=args.profile, location=args.location, latitude=args.lat, longitude=args.lon, offline=args.offline, use_ai=not args.no_ai, root=ROOT)
    if args.json:
        print(json.dumps(run, ensure_ascii=False, indent=2))
    else:
        print_terminal(run)
    if not args.no_save:
        path = save_run_file(run, ROOT, args.save)
        if not args.json:
            print(f"Saved frontend-compatible run: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

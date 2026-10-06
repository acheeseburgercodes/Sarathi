from __future__ import annotations

import argparse
import json
import sys
import time
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
    command.add_argument("--watch", action="store_true", help="Continuously refresh sources and synchronize Supabase")
    command.add_argument("--interval", type=int, default=300, help="Watch refresh interval in seconds; minimum 30")
    command.add_argument("--ai-every", type=int, default=0, help="In watch mode, rerun AI every N refreshes; 0 means first refresh only")
    command.add_argument("--max-runs", type=int, default=0, help=argparse.SUPPRESS)
    return command


def print_terminal(run: dict) -> None:
    line = "=" * 78
    print(f"\n{line}\nSAARTHI CENTRAL · {run['context']['location']}\n{run['generated_at']} · {run['profile'].upper()} PROFILE\n{line}")
    print(run["central"]["report"])
    print(f"\n{line}\nAGENT EXECUTION")
    for agent in run["agents"]:
        model = f" · {agent['model']}" if agent["model"] else ""
        print(f"  {agent['name']:<31} {agent['status']}{model}")
    model_runs = [(agent["name"], agent.get("model"), agent.get("status"), agent.get("metrics"), agent.get("error")) for agent in run["agents"] if agent.get("metrics")]
    if run["central"].get("metrics"):
        model_runs.append(("Saarthi Central", run["central"].get("model"), run["central"].get("status"), run["central"]["metrics"], run["central"].get("error")))
    print("\nMODEL METRICS")
    if not model_runs:
        print("  No model calls executed.")
    for name, model, status, metrics, error in model_runs:
        cached = f" · cached input {metrics['cached_input_tokens']}" if metrics.get("cached_input_tokens") is not None else ""
        reasoning = f" · reasoning {metrics['reasoning_tokens']}" if metrics.get("reasoning_tokens") is not None else ""
        exact = "exact" if metrics.get("input_count_exact") else "estimated"
        print(f"  {name} · {model or 'unknown model'} · {status}")
        print(f"    {metrics['latency_ms']} ms · input {metrics['input_tokens']} · output {metrics['output_tokens']} · total {metrics['total_tokens']} · {exact}{cached}{reasoning}")
        if error:
            print(f"    error: {error}")
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
    sync = run["supabase"]
    print(f"\nSUPABASE: {sync['status']} · pending outbox {sync['pending_runs']}")
    if sync.get("error"):
        print(f"  {sync['error']}")
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
    if args.watch and args.save:
        print("--save cannot be combined with --watch; watch mode creates unique run files automatically.", file=sys.stderr)
        return 2
    interval = max(30, args.interval)
    iteration = 0
    try:
        while True:
            iteration += 1
            use_ai = not args.no_ai and (iteration == 1 or (args.ai_every > 0 and iteration % args.ai_every == 0))
            run = run_saarthi(query=query, profile=args.profile, location=args.location, latitude=args.lat, longitude=args.lon, offline=args.offline, use_ai=use_ai, root=ROOT)
            if args.json:
                print(json.dumps(run, ensure_ascii=False, separators=(",", ":")) if args.watch else json.dumps(run, ensure_ascii=False, indent=2), flush=True)
            else:
                print_terminal(run)
            if not args.no_save:
                path = save_run_file(run, ROOT, args.save)
                if not args.json:
                    print(f"Saved frontend-compatible run: {path}")
            if not args.watch or (args.max_runs > 0 and iteration >= args.max_runs):
                break
            if not args.json:
                print(f"Next live refresh in {interval} seconds. Press Ctrl+C to stop.", flush=True)
            time.sleep(interval)
    except KeyboardInterrupt:
        if not args.json:
            print("\nSaarthi live refresh stopped.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

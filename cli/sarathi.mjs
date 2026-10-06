#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { loadEnvFile, stdin, stdout } from "node:process";
import { runSarathiCli } from "../backend/orchestrator.mjs";

function parseArgs(argv) {
  const options = { json: false, useAi: true };
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === "--json") options.json = true;
    else if (value === "--no-ai") options.useAi = false;
    else if (value === "--help" || value === "-h") options.help = true;
    else if (value.startsWith("--")) { const key = value.slice(2); options[key] = argv[++i]; }
    else positional.push(value);
  }
  options.query = options.query || positional.join(" ");
  if (options.lat !== undefined) options.latitude = Number(options.lat);
  if (options.lon !== undefined) options.longitude = Number(options.lon);
  return options;
}

function help() {
  return `SARATHI multi-agent disaster intelligence CLI

Usage:
  npm run sarathi -- --query "Create a flood briefing" [options]
  npm run sarathi -- "Summarize disaster news and weather"

Options:
  --location <name>  Human-readable location (default: Chennai)
  --lat <number>     Weather latitude
  --lon <number>     Weather longitude
  --json             Print the complete machine-readable run
  --no-ai            Retrieve real API data without model calls
  --save <path>      Save the complete JSON run to a file
  --help             Show this help

AI environment:
  OPENAI_API_KEY and optional OPENAI_MODEL
  SARATHI_{WEATHER,NEWS,SEISMIC,EVENTS,CENTRAL}_MODEL for per-agent or fine-tuned model IDs
  SARATHI_MAX_MODEL_CALLS, SARATHI_MAX_INPUT_TOKENS, SARATHI_MAX_OUTPUT_TOKENS,
  SARATHI_MAX_TOTAL_TOKENS, SARATHI_MAX_INPUT_TOKENS_PER_CALL
  SARATHI_EXACT_TOKEN_COUNT=0 disables preflight counting and uses a conservative estimate.`;
}

function printHuman(result) {
  const line = "─".repeat(72);
  console.log(`\nSARATHI · ${result.context.location}`);
  console.log(`${result.generatedAt} · run ${result.runId}`);
  console.log(line);
  console.log(result.central.report);
  console.log(line);
  console.log("AGENT STATUS");
  for (const agent of result.specialists) console.log(`  ${agent.name.padEnd(30)} ${agent.status}${agent.model ? ` · ${agent.model}` : ""}`);
  const usage = result.tokenUsage;
  console.log("\nTOKEN LEDGER");
  console.log(`  Calls ${usage.modelCalls}/${usage.limits.maxModelCalls} · Input ${usage.inputTokens}/${usage.limits.maxInputTokens} · Output ${usage.outputTokens}/${usage.limits.maxOutputTokens} · Total ${usage.totalTokens}/${usage.limits.maxTotalTokens}`);
  if (!result.ai.available && result.ai.requested) console.log("\nAI synthesis unavailable: set OPENAI_API_KEY. Live source extraction completed without generated claims.");
}

async function main() {
  for (const path of [".env", ".env.local"]) {
    try { loadEnvFile(path); } catch (error) { if (error?.code !== "ENOENT") throw error; }
  }
  const options = parseArgs(process.argv.slice(2));
  if (options.help) { console.log(help()); return; }
  if (!options.query) {
    if (!stdin.isTTY) { console.error("A query is required. Use --query or pipe an interactive terminal."); process.exitCode = 2; return; }
    const rl = createInterface({ input: stdin, output: stdout });
    options.query = await rl.question("What should Sarathi investigate? ");
    rl.close();
  }
  if (!Number.isFinite(options.latitude ?? 13.0827) || !Number.isFinite(options.longitude ?? 80.2707)) throw new Error("--lat and --lon must be valid numbers.");
  const result = await runSarathiCli(options);
  if (options.json) console.log(JSON.stringify(result, null, 2)); else printHuman(result);
  if (options.save) {
    const path = resolve(options.save); await mkdir(dirname(path), { recursive: true }); await writeFile(path, JSON.stringify(result, null, 2) + "\n", "utf8");
    if (!options.json) console.log(`\nSaved ${path}`);
  }
}

main().catch(error => { console.error(`Sarathi failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });

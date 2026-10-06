import { AGENTS, runSpecialist } from "./agents.mjs";
import { OpenAIResponsesClient } from "./openai-client.mjs";
import { collectSources } from "./sources.mjs";
import { TokenBudget, tokenLimits } from "./token-budget.mjs";

const CENTRAL_RULES = `You are Sarathi Central, the coordinating disaster-intelligence agent. Merge the specialist reports into a concise situation report. Use only supplied evidence and specialist outputs. Preserve citations and clearly label source outages and uncertainty. Never create warnings, risk scores, casualty estimates, routes, shelters, or response instructions without a cited official source. News reporting is not official verification. Weather forecasts are model data, not alerts. Do not expose chain-of-thought.`;

function fallbackReport({ query, location, specialists }) {
  return [
    `SARATHI situation report for ${location}`,
    `Task: ${query}`,
    "",
    ...specialists.map(agent => `${agent.name} [${agent.status}]\n${agent.report}`),
    "",
    "Central AI synthesis is unavailable or disabled. The sections above report only source retrieval status and extracted evidence counts.",
  ].join("\n");
}

export async function runSarathiCli(options = {}) {
  const startedAt = Date.now();
  const context = {
    query: options.query || "Create a current disaster intelligence briefing.",
    location: options.location || "Chennai, Tamil Nadu, India",
    latitude: Number.isFinite(options.latitude) ? options.latitude : 13.0827,
    longitude: Number.isFinite(options.longitude) ? options.longitude : 80.2707,
  };
  const limits = options.limits || tokenLimits(options.env || process.env);
  const budget = new TokenBudget(limits);
  const client = options.client || new OpenAIResponsesClient({ apiKey: options.apiKey, fetchImpl: options.modelFetch || fetch });
  const defaultModel = options.model || process.env.OPENAI_MODEL || "gpt-5-mini";
  const useAi = options.useAi !== false;
  const sources = options.sources || await collectSources(context, options.fetchImpl || fetch);
  const specialists = await Promise.all(AGENTS.map(agent => runSpecialist(agent, sources[agent.id], { ...context, defaultModel, client, budget, useAi })));

  let central = { status: "evidence-only", model: null, error: null, report: fallbackReport({ ...context, specialists }) };
  if (useAi && client.available) {
    const model = process.env.SARATHI_CENTRAL_MODEL || defaultModel;
    const input = JSON.stringify({ task: context.query, location: context.location, coordinates: { latitude: context.latitude, longitude: context.longitude }, specialistReports: specialists.map(({ id, name, sourceStatus, source, status, report, error }) => ({ id, name, sourceStatus, source, status, report, error })) });
    try {
      const result = await client.run({ agent: "central", model, instructions: CENTRAL_RULES, input, maxOutputTokens: 2_400, budget });
      central = { status: result.status, model: result.model, error: result.error, report: result.text || central.report };
    } catch (error) {
      central = { ...central, status: "budget-blocked", error: error instanceof Error ? error.message : "Central synthesis was blocked." };
    }
  }

  return {
    runId: crypto.randomUUID(),
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    context,
    ai: { requested: useAi, available: client.available, defaultModel },
    central,
    specialists,
    sourceHealth: Object.fromEntries(Object.entries(sources).map(([id, value]) => [id, { status: value.status, error: value.error }])),
    tokenUsage: budget.snapshot(),
  };
}

const COMMON_RULES = `Use only the supplied source payload. Never invent an incident, measurement, warning, casualty count, location, shelter, route, risk score, probability, confidence, or official action. Separate observations from interpretation. Cite source item IDs in square brackets. If evidence is missing, say unavailable. Do not expose chain-of-thought.`;

export const AGENTS = Object.freeze([
  { id: "weather", name: "Weather Intelligence Agent", modelEnv: "SARATHI_WEATHER_MODEL", maxOutputTokens: 1_000, instructions: `${COMMON_RULES} Analyze current conditions and the next 48 hours. Highlight unusual precipitation or wind only when the payload supports it. Weather model data is not an official warning.` },
  { id: "news", name: "News Management Agent", modelEnv: "SARATHI_NEWS_MODEL", maxOutputTokens: 1_000, instructions: `${COMMON_RULES} Deduplicate and rank disaster-response reporting by relevance and recency. Attribute every claim to the named publisher. News reports are not official alerts and must not be presented as verified incidents.` },
  { id: "seismic", name: "Seismic Intelligence Agent", modelEnv: "SARATHI_SEISMIC_MODEL", maxOutputTokens: 1_000, instructions: `${COMMON_RULES} Summarize significant earthquakes from the USGS payload. Preserve magnitude, time, and location wording. Do not infer local impact from magnitude alone.` },
  { id: "events", name: "Natural Events Agent", modelEnv: "SARATHI_EVENTS_MODEL", maxOutputTokens: 1_000, instructions: `${COMMON_RULES} Summarize open NASA EONET events by category and recency. Treat the feed as global event tracking, not a local warning service.` },
]);

function evidenceOnly(agent, source) {
  if (source.status !== "available") return `${agent.name}: source unavailable (${source.error}).`;
  const data = source.data;
  if (agent.id === "weather") {
    const current = data.current;
    return `${agent.name}: ${data.source} current observation — temperature ${current.temperature_2m ?? "unavailable"} °C, precipitation ${current.precipitation ?? "unavailable"} mm, wind ${current.wind_speed_10m ?? "unavailable"} km/h. ${data.hourly.length} hourly forecast records were extracted. [weather-current]`;
  }
  if (agent.id === "news") {
    const lines = data.articles.slice(0, 5).map(item => `[${item.id}] ${item.title} — ${item.source}${item.publishedAt ? ` (${item.publishedAt})` : ""}`);
    return `${agent.name}: ${data.source} returned ${data.articles.length} current records.${lines.length ? `\n${lines.join("\n")}` : " No matching records were returned."}`;
  }
  if (agent.id === "seismic") {
    const lines = data.events.slice(0, 5).map(item => `[${item.id}] ${item.title}${item.magnitude == null ? "" : ` · magnitude ${item.magnitude}`}${item.occurredAt ? ` · ${item.occurredAt}` : ""}`);
    return `${agent.name}: ${data.source} returned ${data.events.length} significant events from the last week.${lines.length ? `\n${lines.join("\n")}` : " The successful feed was empty."}`;
  }
  const lines = data.events.slice(0, 5).map(item => `[${item.id}] ${item.title}${item.category ? ` · ${item.category}` : ""}${item.observedAt ? ` · ${item.observedAt}` : ""}`);
  return `${agent.name}: ${data.source} returned ${data.events.length} open events.${lines.length ? `\n${lines.join("\n")}` : " The successful feed was empty."}`;
}

export async function runSpecialist(agent, source, { query, location, defaultModel, client, budget, useAi }) {
  const base = { id: agent.id, name: agent.name, sourceStatus: source.status, source: source.data?.source ?? null, evidence: source.data, model: null, status: source.status === "available" ? "evidence-only" : "unavailable", report: evidenceOnly(agent, source), error: source.error };
  if (!useAi || !client.available || source.status !== "available") return base;
  const model = process.env[agent.modelEnv] || defaultModel;
  try {
    const result = await client.run({ agent: agent.id, model, instructions: agent.instructions, input: JSON.stringify({ task: query, location, evidence: source.data }), maxOutputTokens: agent.maxOutputTokens, budget });
    return { ...base, model: result.model, status: result.status, report: result.text || base.report, error: result.error };
  } catch (error) {
    return { ...base, model, status: "budget-blocked", error: error instanceof Error ? error.message : "Agent execution was blocked by the token budget." };
  }
}

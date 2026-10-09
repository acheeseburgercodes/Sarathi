import { getLiveSituation } from "./live-data";
import { AI_LIMITS, TokenManager, selectedAgents } from "./ai-policy";

type Situation = Awaited<ReturnType<typeof getLiveSituation>>;
type AgentName = "Orchestrator" | "Weather" | "Seismic" | "Natural events" | "Knowledge" | "Verification" | "Explanation";
type Evidence = {
  id: string;
  agent: AgentName;
  source: string;
  authority: string;
  observedAt: string | null;
  summary: string;
  data?: Record<string, unknown>;
  url?: string | null;
};

type KnowledgeItem = {
  id: string;
  hazards: string[];
  title: string;
  authority: string;
  summary: string;
  url: string;
};

const KNOWLEDGE: KnowledgeItem[] = [
  {
    id: "ndma-sachet",
    hazards: ["alert", "warning", "safety", "flood", "earthquake", "cyclone", "fire", "evacuation"],
    title: "SACHET National Disaster Alert Portal",
    authority: "National Disaster Management Authority, Government of India",
    summary: "Official national portal for authorized disaster alerts and hazard-specific public guidance. Follow its current instructions when they differ from general information.",
    url: "https://sachet.ndma.gov.in/",
  },
  {
    id: "imd-cyclone-warnings",
    hazards: ["cyclone", "storm", "coast", "wind", "rain"],
    title: "IMD cyclone warnings",
    authority: "India Meteorological Department",
    summary: "Official cyclone bulletins contain the current system location and intensity, forecast movement, likely adverse weather, expected impacts and recommended action.",
    url: "https://mausam.imd.gov.in/imd_latest/contents/cyclone.php",
  },
];

function weatherAgent(situation: Situation): Evidence[] {
  const weather = situation.weather;
  if (!weather) return [];
  return [{
    id: "weather-current",
    agent: "Weather",
    source: "Open-Meteo",
    authority: "Open-Meteo weather API",
    observedAt: situation.fetchedAt,
    summary: `Open-Meteo returned current and hourly model data for ${situation.location.name}.`,
    data: {
      temperatureC: weather.temperature,
      currentPrecipitationMm: weather.precipitationNow,
      modelledPrecipitationPrevious24hMm: weather.rain24h,
      forecastPrecipitationNext24hMm: weather.rainNext24h,
      peakForecastProbabilityPercent: weather.maxRainProbability,
      windSpeedKmh: weather.windSpeed,
    },
    url: "https://open-meteo.com/en/docs",
  }];
}

function seismicAgent(situation: Situation): Evidence[] {
  return situation.earthquakes.slice(0, 5).map((event: { time: string | null; title: string; magnitude: number | null; coordinates: number[] | null; link: string | null }, index: number) => ({
    id: `seismic-${index}`,
    agent: "Seismic" as const,
    source: "USGS",
    authority: "United States Geological Survey",
    observedAt: event.time,
    summary: event.title,
    data: { magnitude: event.magnitude, coordinates: event.coordinates },
    url: event.link,
  }));
}

function naturalEventsAgent(situation: Situation): Evidence[] {
  return situation.events.slice(0, 5).map((event: { date: string | null; title: string; category: string; coordinates: number[] | null; link: string | null }, index: number) => ({
    id: `event-${index}`,
    agent: "Natural events" as const,
    source: "NASA EONET",
    authority: "NASA Earth Observatory Natural Event Tracker",
    observedAt: event.date,
    summary: `${event.title} — ${event.category}`,
    data: { coordinates: event.coordinates },
    url: event.link,
  }));
}

function knowledgeAgent(query: string): Evidence[] {
  const q = query.toLowerCase();
  const matches = KNOWLEDGE.filter(item => item.hazards.some(term => q.includes(term)));
  return (matches.length ? matches : KNOWLEDGE.slice(0, 1)).map(item => ({
    id: item.id,
    agent: "Knowledge" as const,
    source: item.title,
    authority: item.authority,
    observedAt: null,
    summary: item.summary,
    url: item.url,
  }));
}

function fallbackAnswer(query: string, evidence: Evidence[], missing: string[]) {
  if (!evidence.length) return "No connected source returned evidence for this request. Sarathi will not invent an answer.";
  const weather = evidence.find(item => item.agent === "Weather")?.data;
  if (weather) {
    const temperature = weather.temperatureC == null ? "an unavailable temperature" : `${weather.temperatureC}°C`;
    const rain = weather.currentPrecipitationMm == null ? "current rainfall is unavailable" : `current precipitation is ${weather.currentPrecipitationMm} mm`;
    const wind = weather.windSpeedKmh == null ? "wind speed is unavailable" : `wind is ${weather.windSpeedKmh} km/h`;
    return `According to the latest Open-Meteo reading, the temperature is ${temperature}, ${rain}, and ${wind}. This is modelled weather data rather than an official warning.`;
  }
  const findings = evidence.slice(0, 4).map(item => `According to ${item.source}, ${item.summary.replace(/[.]+$/, "")}.`);
  const limitation = missing.length ? " Some supporting services are currently unavailable, so check the relevant local authority before making an urgent safety decision." : "";
  return `${findings.join(" ")}${limitation}`;
}

function humanizeAnswer(value: string) {
  return value
    .replace(/\s*\[[^\]\r\n]{1,120}\]\s*/g, " ")
    .replace(/\b(?:EVIDENCE_JSON|SOURCE_VALIDATED|UNAVAILABLE)\b:?/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

function extractOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const result = payload as { output_text?: unknown; output?: Array<{ content?: Array<{ type?: string; text?: unknown }> }> };
  if (typeof result.output_text === "string") return result.output_text;
  return (result.output || []).flatMap(item => item.content || []).filter(item => item.type === "output_text" && typeof item.text === "string").map(item => item.text as string).join("\n");
}

function extractGeminiText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const result = payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> };
  return (result.candidates || [])
    .flatMap(candidate => candidate.content?.parts || [])
    .filter(part => typeof part.text === "string")
    .map(part => part.text as string)
    .join("\n");
}

async function synthesize(query: string, evidence: Evidence[], verification: object, budget: TokenManager) {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const openAiApiKey = process.env.OPENAI_API_KEY;
  const usingGemini = Boolean(geminiApiKey);
  const model = usingGemini ? process.env.GEMINI_MODEL || "gemini-3.5-flash-lite" : process.env.OPENAI_MODEL || "gpt-5-mini";
  if (!geminiApiKey && !openAiApiKey) return { status: "unavailable" as const, model: null, answer: null, error: "No AI provider API key is configured." };

  const evidenceJson = JSON.stringify({ query, evidence: evidence.slice(0, AI_LIMITS.maxEvidenceItems), verification });
  const instructions = [
    "You are Sarathi, a disaster-intelligence synthesis agent.",
    "Use only the supplied evidence. Never invent measurements, incidents, alerts, shelters, routes, risk scores or confidence values.",
    "Clearly distinguish current API data from official guidance. State missing capabilities explicitly.",
    "For urgent safety decisions, direct the user to the relevant official authority. Keep the answer concise.",
    "Write like a calm, helpful human. Attribute facts naturally with phrases such as 'According to Open-Meteo'. Do not use bracketed citations, JSON, agent labels, status codes, or system-style headings. Do not expose chain-of-thought.",
  ].join(" ");
  const input = `${instructions}\n\nEVIDENCE_JSON\n${evidenceJson}`;
  budget.reserveInput(input);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_LIMITS.maxExecutionMs);
  try {
    if (usingGemini) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        signal: controller.signal,
        headers: { "x-goog-api-key": geminiApiKey as string, "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: instructions }] },
          contents: [{ role: "user", parts: [{ text: `EVIDENCE_JSON\n${evidenceJson}` }] }],
          generationConfig: { maxOutputTokens: AI_LIMITS.maxOutputTokens, temperature: 0.2 },
        }),
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => null) as { error?: { message?: string; status?: string } } | null;
        const detail = failure?.error?.message || failure?.error?.status;
        throw new Error(`Gemini synthesis failed with HTTP ${response.status}${detail ? `: ${detail}` : "."}`);
      }
      const payload = await response.json() as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } };
      budget.record(payload.usageMetadata?.promptTokenCount || 0, payload.usageMetadata?.candidatesTokenCount || 0);
      const answer = extractGeminiText(payload);
      if (!answer) throw new Error("Gemini returned no text output.");
      return { status: "available" as const, model, answer: humanizeAnswer(answer), error: null };
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${openAiApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, input, max_output_tokens: AI_LIMITS.maxOutputTokens, store: false, reasoning: { effort: "minimal" } }),
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => null) as { error?: { code?: string; type?: string } } | null;
      const code = failure?.error?.code || failure?.error?.type;
      if (response.status === 429 && (code === "credit_balance_exhausted" || code === "insufficient_quota")) {
        throw new Error("AI synthesis is unavailable because the configured OpenAI project has no API credits remaining.");
      }
      if (response.status === 429) {
        throw new Error("AI synthesis is temporarily rate-limited. Please try again shortly.");
      }
      throw new Error(`AI synthesis request failed with HTTP ${response.status}.`);
    }
    const payload = await response.json() as { usage?: { input_tokens?: number; output_tokens?: number } };
    budget.record(payload.usage?.input_tokens || 0, payload.usage?.output_tokens || 0);
    const answer = extractOutputText(payload);
    if (!answer) throw new Error("The model returned no text output.");
    return { status: "available" as const, model, answer: humanizeAnswer(answer), error: null };
  } catch (error) {
    return { status: "error" as const, model, answer: null, error: error instanceof Error ? error.message : "AI synthesis failed." };
  } finally { clearTimeout(timer); }
}

export async function runSarathi(query: string) {
  const startedAt = Date.now();
  const cleanQuery = query.trim().slice(0, 1000);
  const budget = new TokenManager();
  const selected = selectedAgents(cleanQuery);
  const situation = await getLiveSituation();

  const jobs = selected.map(agent => {
    if (agent === "Weather") return Promise.resolve(weatherAgent(situation));
    if (agent === "Seismic") return Promise.resolve(seismicAgent(situation));
    if (agent === "Natural events") return Promise.resolve(naturalEventsAgent(situation));
    return Promise.resolve(knowledgeAgent(cleanQuery));
  });
  const evidence = (await Promise.all(jobs)).flat().slice(0, AI_LIMITS.maxEvidenceItems);
  const requiredSources = selected.filter(agent => agent !== "Knowledge");
  const unavailableSources = situation.sources.filter(source => source.status !== "live").map(source => source.name);
  const verification = {
    status: evidence.length ? "SOURCE_VALIDATED" : "UNAVAILABLE",
    meaning: "Payload structure and source availability were checked; this does not replace official incident verification.",
    evidenceItems: evidence.length,
    requiredAgents: requiredSources,
    unavailableSources,
  };
  const modelResult = await synthesize(cleanQuery, evidence, verification, budget);
  const missing = [
    ...unavailableSources,
    "official local warning feed",
    "verified shelter and route data",
    "population and infrastructure exposure data",
  ];
  const answer = humanizeAnswer(modelResult.answer || fallbackAnswer(cleanQuery, evidence, missing));
  return {
    runId: crypto.randomUUID(),
    answer,
    fetchedAt: situation.fetchedAt,
    ai: { status: modelResult.status, model: modelResult.model, error: modelResult.error },
    selectedAgents: ["Orchestrator", ...selected, "Verification", "Explanation"],
    verification,
    evidence: evidence.map((item, index) => ({ ...item, citation: index + 1 })),
    usage: budget.snapshot(),
    durationMs: Date.now() - startedAt,
  };
}

export function getAiRuntimeStatus() {
  return { configured: Boolean(process.env.OPENAI_API_KEY), model: process.env.OPENAI_MODEL || "gpt-5-mini", limits: AI_LIMITS, knowledgeDocuments: KNOWLEDGE.length };
}

export { AI_LIMITS } from "./ai-policy";

export const AI_LIMITS = Object.freeze({
  maxLlmCalls: 1,
  maxInputTokens: 3500,
  maxOutputTokens: 600,
  maxTotalTokens: 4100,
  maxAgentIterations: 4,
  maxEvidenceItems: 12,
  maxExecutionMs: 12000,
});

export type SpecialistAgent = "Weather" | "Seismic" | "Natural events" | "Knowledge";

export class TokenManager {
  private llmCalls = 0;
  private estimatedInputTokens = 0;
  private inputTokens = 0;
  private outputTokens = 0;
  private readonly startedAt = Date.now();

  reserveInput(text: string) {
    const estimate = Math.ceil(text.length / 3);
    if (this.llmCalls >= AI_LIMITS.maxLlmCalls) throw new Error("LLM call limit reached.");
    if (estimate > AI_LIMITS.maxInputTokens) throw new Error("Input token limit reached.");
    if (Date.now() - this.startedAt > AI_LIMITS.maxExecutionMs) throw new Error("Execution time limit reached.");
    this.llmCalls += 1;
    this.estimatedInputTokens = estimate;
  }

  record(inputTokens: number, outputTokens: number) {
    this.inputTokens = Math.max(0, inputTokens || 0);
    this.outputTokens = Math.min(AI_LIMITS.maxOutputTokens, Math.max(0, outputTokens || 0));
  }

  snapshot() {
    const observedInput = this.inputTokens || this.estimatedInputTokens;
    return {
      llmCalls: this.llmCalls,
      inputTokens: observedInput,
      outputTokens: this.outputTokens,
      totalTokens: observedInput + this.outputTokens,
      limits: AI_LIMITS,
    };
  }
}

export function selectedAgents(query: string): SpecialistAgent[] {
  const q = query.toLowerCase();
  const selected = new Set<SpecialistAgent>();
  if (/weather|rain|wind|temperature|forecast|condition|chennai|flood|cyclone|storm/.test(q)) selected.add("Weather");
  if (/earthquake|seismic|quake/.test(q)) selected.add("Seismic");
  if (/hazard|wildfire|fire|volcano|natural event|global/.test(q)) selected.add("Natural events");
  if (/what should|safety|safe|evacuat|shelter|hospital|warning|alert|cyclone|flood|earthquake/.test(q)) selected.add("Knowledge");
  if (!selected.size) ["Weather", "Seismic", "Natural events"].forEach(name => selected.add(name as SpecialistAgent));
  return [...selected].slice(0, AI_LIMITS.maxAgentIterations);
}

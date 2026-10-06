import { conservativeTokenEstimate } from "./token-budget.mjs";

function extractText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text.trim();
  return (payload?.output ?? []).flatMap(item => item.content ?? [])
    .filter(item => item.type === "output_text" && typeof item.text === "string")
    .map(item => item.text).join("\n").trim();
}

export class OpenAIResponsesClient {
  constructor({ apiKey = process.env.OPENAI_API_KEY, fetchImpl = fetch, exactTokenCount = process.env.SARATHI_EXACT_TOKEN_COUNT !== "0", timeoutMs = 30_000 } = {}) {
    this.apiKey = apiKey;
    this.fetch = fetchImpl;
    this.exactTokenCount = exactTokenCount;
    this.timeoutMs = timeoutMs;
  }

  get available() { return Boolean(this.apiKey); }

  async countInput(model, input) {
    if (!this.available || !this.exactTokenCount) return { tokens: conservativeTokenEstimate(input), exact: false };
    try {
      const response = await this.fetch("https://api.openai.com/v1/responses/input_tokens", {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, input }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (!Number.isFinite(payload.input_tokens)) throw new Error("Missing input_tokens");
      return { tokens: payload.input_tokens, exact: true };
    } catch {
      return { tokens: conservativeTokenEstimate(input), exact: false };
    }
  }

  async run({ agent, model, instructions, input, maxOutputTokens, budget }) {
    if (!this.available) return { status: "unavailable", text: null, model: null, error: "OPENAI_API_KEY is not configured." };
    const fullInput = [{ role: "developer", content: instructions }, { role: "user", content: input }];
    const serialized = JSON.stringify(fullInput);
    const counted = await this.countInput(model, serialized);
    const reservation = budget.reserve(agent, counted.tokens, maxOutputTokens);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        signal: controller.signal,
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, input: fullInput, max_output_tokens: maxOutputTokens, store: false }),
      });
      if (!response.ok) throw new Error(`OpenAI Responses API returned HTTP ${response.status}.`);
      const payload = await response.json();
      budget.commit(reservation, { inputTokens: payload.usage?.input_tokens, outputTokens: payload.usage?.output_tokens });
      const text = extractText(payload);
      if (!text) throw new Error("The model returned no text output.");
      return { status: "completed", text, model, tokenCountExact: counted.exact, error: null };
    } catch (error) {
      budget.commit(reservation);
      return { status: "failed", text: null, model, tokenCountExact: counted.exact, error: error instanceof Error ? error.message : "Model call failed." };
    } finally { clearTimeout(timer); }
  }
}

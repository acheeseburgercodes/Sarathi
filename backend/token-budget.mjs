function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function tokenLimits(env = process.env) {
  const maxInputTokens = positiveInteger(env.SARATHI_MAX_INPUT_TOKENS, 30_000);
  const maxOutputTokens = positiveInteger(env.SARATHI_MAX_OUTPUT_TOKENS, 8_000);
  return Object.freeze({
    maxModelCalls: positiveInteger(env.SARATHI_MAX_MODEL_CALLS, 5),
    maxInputTokens,
    maxOutputTokens,
    maxTotalTokens: positiveInteger(env.SARATHI_MAX_TOTAL_TOKENS, maxInputTokens + maxOutputTokens),
    maxInputTokensPerCall: positiveInteger(env.SARATHI_MAX_INPUT_TOKENS_PER_CALL, 8_000),
  });
}

export function conservativeTokenEstimate(text) {
  return Math.ceil(String(text).length / 3);
}

export class TokenBudget {
  #limits;
  #calls = 0;
  #input = 0;
  #output = 0;
  #reservedOutput = 0;
  #entries = [];

  constructor(limits = tokenLimits()) { this.#limits = limits; }

  reserve(agent, inputTokens, maxOutputTokens) {
    const input = Math.max(0, Math.ceil(inputTokens));
    const output = Math.max(1, Math.ceil(maxOutputTokens));
    if (input > this.#limits.maxInputTokensPerCall) throw new Error(`${agent}: per-call input token limit exceeded.`);
    if (this.#calls + 1 > this.#limits.maxModelCalls) throw new Error(`${agent}: model call limit exceeded.`);
    if (this.#input + input > this.#limits.maxInputTokens) throw new Error(`${agent}: run input token limit exceeded.`);
    if (this.#output + this.#reservedOutput + output > this.#limits.maxOutputTokens) throw new Error(`${agent}: run output token limit exceeded.`);
    if (this.#input + input + this.#output + this.#reservedOutput + output > this.#limits.maxTotalTokens) throw new Error(`${agent}: total token limit exceeded.`);
    const entry = { agent, plannedInputTokens: input, maxOutputTokens: output, inputTokens: null, outputTokens: null };
    this.#calls += 1;
    this.#input += input;
    this.#reservedOutput += output;
    this.#entries.push(entry);
    return entry;
  }

  commit(entry, usage = {}) {
    if (entry.outputTokens !== null) return;
    const actualInput = Math.max(0, Math.ceil(usage.inputTokens ?? entry.plannedInputTokens));
    const actualOutput = Math.max(0, Math.min(entry.maxOutputTokens, Math.ceil(usage.outputTokens ?? 0)));
    this.#input += actualInput - entry.plannedInputTokens;
    this.#reservedOutput -= entry.maxOutputTokens;
    this.#output += actualOutput;
    entry.inputTokens = actualInput;
    entry.outputTokens = actualOutput;
  }

  snapshot() {
    return {
      modelCalls: this.#calls,
      inputTokens: this.#input,
      outputTokens: this.#output,
      reservedOutputTokens: this.#reservedOutput,
      totalTokens: this.#input + this.#output,
      limits: this.#limits,
      byAgent: this.#entries.map(entry => ({ ...entry })),
    };
  }
}

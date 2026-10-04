import test from "node:test";
import assert from "node:assert/strict";
import { AI_LIMITS, TokenManager, selectedAgents } from "../lib/ai-policy.ts";

test("routes only relevant specialists within the iteration budget", () => {
  const agents = selectedAgents("What should people do during a cyclone warning?");
  assert.deepEqual(agents, ["Weather", "Knowledge"]);
  assert.ok(agents.length <= AI_LIMITS.maxAgentIterations);
});

test("rejects an oversized model input before a request is made", () => {
  const budget = new TokenManager();
  assert.throws(() => budget.reserveInput("x".repeat(AI_LIMITS.maxInputTokens * 3 + 1)), /Input token limit/);
  assert.equal(budget.snapshot().llmCalls, 0);
});

test("allows only one model call per user request", () => {
  const budget = new TokenManager();
  budget.reserveInput("bounded input");
  assert.throws(() => budget.reserveInput("second call"), /LLM call limit/);
  assert.equal(budget.snapshot().llmCalls, 1);
});

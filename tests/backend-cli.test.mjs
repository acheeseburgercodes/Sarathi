import test from "node:test";
import assert from "node:assert/strict";
import { parseNewsRss } from "../backend/sources.mjs";
import { TokenBudget } from "../backend/token-budget.mjs";
import { runSarathiCli } from "../backend/orchestrator.mjs";

test("news RSS extraction preserves publisher attribution", () => {
  const xml = `<rss><channel><item><title>Flood response expands</title><link>https://example.test/a</link><pubDate>Mon, 05 Oct 2026 10:00:00 GMT</pubDate><source url="https://example.test">Example News</source></item></channel></rss>`;
  assert.deepEqual(parseNewsRss(xml), [{ id: "news-1", title: "Flood response expands", publishedAt: "Mon, 05 Oct 2026 10:00:00 GMT", source: "Example News", url: "https://example.test/a" }]);
});

test("token ledger releases unused output while retaining actual usage", () => {
  const budget = new TokenBudget({ maxModelCalls: 2, maxInputTokens: 1000, maxOutputTokens: 500, maxTotalTokens: 1500, maxInputTokensPerCall: 700 });
  const reservation = budget.reserve("weather", 300, 400);
  budget.commit(reservation, { inputTokens: 280, outputTokens: 75 });
  assert.deepEqual(budget.snapshot(), {
    modelCalls: 1, inputTokens: 280, outputTokens: 75, reservedOutputTokens: 0, totalTokens: 355,
    limits: { maxModelCalls: 2, maxInputTokens: 1000, maxOutputTokens: 500, maxTotalTokens: 1500, maxInputTokensPerCall: 700 },
    byAgent: [{ agent: "weather", plannedInputTokens: 300, maxOutputTokens: 400, inputTokens: 280, outputTokens: 75 }],
  });
});

test("token ledger blocks calls that could exceed the total budget", () => {
  const budget = new TokenBudget({ maxModelCalls: 1, maxInputTokens: 100, maxOutputTokens: 100, maxTotalTokens: 150, maxInputTokensPerCall: 100 });
  assert.throws(() => budget.reserve("central", 80, 80), /total token limit/);
});

test("four specialists report to the central agent within one shared budget", async () => {
  const calls = [];
  const client = {
    available: true,
    async run({ agent, model, maxOutputTokens, budget }) {
      calls.push(agent);
      const reservation = budget.reserve(agent, 50, maxOutputTokens);
      budget.commit(reservation, { inputTokens: 50, outputTokens: 20 });
      return { status: "completed", text: `${agent} report`, model, error: null };
    },
  };
  const sources = {
    weather: { status: "available", error: null, data: { source: "weather", current: {}, hourly: [] } },
    news: { status: "available", error: null, data: { source: "news", articles: [] } },
    seismic: { status: "available", error: null, data: { source: "seismic", events: [] } },
    events: { status: "available", error: null, data: { source: "events", events: [] } },
  };
  const result = await runSarathiCli({ query: "brief me", sources, client, aiStrategy: "full" });
  assert.deepEqual(calls.sort(), ["central", "events", "news", "seismic", "weather"]);
  assert.equal(result.central.report, "central report");
  assert.equal(result.tokenUsage.modelCalls, 5);
  assert.equal(result.tokenUsage.totalTokens, 350);
});

test("central-only strategy makes one model call", async () => {
  const calls = [];
  const client = {
    available: true,
    disabledReason: null,
    async run({ agent, model, maxOutputTokens, budget }) {
      calls.push(agent);
      const reservation = budget.reserve(agent, 50, maxOutputTokens);
      budget.commit(reservation, { inputTokens: 50, outputTokens: 20 });
      return { status: "completed", text: "central report", model, error: null };
    },
  };
  const sources = {
    weather: { status: "available", error: null, data: { source: "weather", current: {}, hourly: [] } },
    news: { status: "available", error: null, data: { source: "news", articles: [] } },
    seismic: { status: "available", error: null, data: { source: "seismic", events: [] } },
    events: { status: "available", error: null, data: { source: "events", events: [] } },
  };
  const result = await runSarathiCli({ query: "brief me", sources, client, aiStrategy: "central-only" });
  assert.deepEqual(calls, ["central"]);
  assert.equal(result.tokenUsage.modelCalls, 1);
  assert.equal(result.ai.specialistMode, "local-evidence");
});

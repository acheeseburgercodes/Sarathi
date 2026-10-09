import { runSarathi } from "@/lib/sarathi-ai";

type PythonRun = {
  run_id: string; generated_at: string; duration_ms: number;
  agents: Array<{ id: string; name: string; source?: string | null; source_status: string; report: string; evidence?: { authority?: string; source_url?: string } | null }>;
  central: { status: string; ai_status?: string; model?: string | null; error?: string | null; report: string };
  token_usage: { model_calls: number; input_tokens: number; output_tokens: number; total_tokens: number; limits: { max_model_calls: number; max_input_tokens: number; max_output_tokens: number; max_total_tokens: number } };
};

function asFrontendAnswer(run: PythonRun) {
  const aiStatus = run.central.ai_status === "completed" ? "available" : run.central.ai_status === "failed" || run.central.ai_status === "budget-blocked" ? "error" : "unavailable";
  return {
    answer: run.central.report, fetchedAt: run.generated_at, runId: run.run_id,
    ai: { status: aiStatus, model: run.central.model ?? null, error: run.central.error ?? null },
    selectedAgents: run.agents.map(agent => agent.name),
    verification: { status: "source_bound", meaning: "The response is restricted to the listed live or cached source evidence.", evidenceItems: run.agents.length, unavailableSources: run.agents.filter(agent => agent.source_status === "unavailable").map(agent => agent.source || agent.name) },
    evidence: run.agents.map((agent, index) => ({ citation: index + 1, source: agent.source || agent.name, authority: agent.evidence?.authority || "Provider authority unavailable", summary: agent.report, url: agent.evidence?.source_url || null })),
    usage: { llmCalls: run.token_usage.model_calls, inputTokens: run.token_usage.input_tokens, outputTokens: run.token_usage.output_tokens, totalTokens: run.token_usage.total_tokens, limits: { maxLlmCalls: run.token_usage.limits.max_model_calls, maxInputTokens: run.token_usage.limits.max_input_tokens, maxOutputTokens: run.token_usage.limits.max_output_tokens, maxTotalTokens: run.token_usage.limits.max_total_tokens } },
    durationMs: run.duration_ms, backend: "python",
  };
}

export async function POST(request: Request) {
  const raw: unknown = await request.json().catch(() => ({}));
  const body = raw && typeof raw === "object" ? raw as { query?: unknown; profile?: unknown } : {};
  const query = typeof body.query === "string" ? body.query.trim().slice(0, 2000) : "";
  if (!query) return Response.json({ message: "Enter a question." }, { status: 400 });
  const backend = process.env.SARATHI_BACKEND_URL?.trim();
  if (!backend) {
    const result = await runSarathi(query);
    return Response.json(
      { ...result, backend: "typescript" },
      { headers: { "Cache-Control": "no-store", "X-Sarathi-Backend": "typescript" } },
    );
  }

  try {
    const response = await fetch(`${backend}/api/run`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ query, profile: typeof body.profile === "string" ? body.profile : "standard" }), cache: "no-store" });
    const result = await response.json() as PythonRun | { message?: string };
    if (!response.ok || !("run_id" in result)) throw new Error("message" in result ? result.message : `Python backend returned HTTP ${response.status}`);
    return Response.json(asFrontendAnswer(result), { headers: { "Cache-Control": "no-store", "X-Sarathi-Backend": "python" } });
  } catch (error) {
    const fallback = await runSarathi(query);
    return Response.json({ ...fallback, backend: "typescript-fallback", backendError: error instanceof Error ? error.message : "Python backend unavailable" }, { headers: { "Cache-Control": "no-store", "X-Sarathi-Backend": "typescript-fallback" } });
  }
}

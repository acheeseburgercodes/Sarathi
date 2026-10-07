export async function GET() {
  const backend = process.env.SARATHI_BACKEND_URL || "http://127.0.0.1:8765";
  try {
    const response = await fetch(`${backend}/health`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return Response.json(await response.json(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable", service: "saarthi-python" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

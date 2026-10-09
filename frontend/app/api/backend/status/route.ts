export async function GET() {
  const backend = process.env.SARATHI_BACKEND_URL?.trim();
  if (!backend) {
    return Response.json(
      { status: "available", service: "sarathi-typescript", runtime: "vercel" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const response = await fetch(`${backend}/health`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return Response.json(await response.json(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable", service: "saarthi-python" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

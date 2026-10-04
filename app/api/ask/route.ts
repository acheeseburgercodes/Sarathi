import { runSarathi } from "@/lib/sarathi-ai";
export async function POST(request: Request) {
  const raw: unknown = await request.json().catch(() => ({}));
  const body = raw && typeof raw === "object" ? raw as { query?: unknown } : {};
  const query = typeof body.query === "string" ? body.query.trim().slice(0, 2000) : "";
  if (!query) return Response.json({ message: "Enter a question." }, { status: 400 });
  return Response.json(await runSarathi(query), { headers: { "Cache-Control": "no-store" } });
}

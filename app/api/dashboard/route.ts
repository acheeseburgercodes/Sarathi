import { buildDashboard } from "@/lib/sarathi-engine";
export async function GET(){return Response.json(await buildDashboard(),{headers:{"Cache-Control":"public, max-age=30"}})}

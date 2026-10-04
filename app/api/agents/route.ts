import { getLiveDashboard } from "@/lib/live-data";
export async function GET(){const data=await getLiveDashboard();return Response.json({status:data.status,agents:data.agents,orchestrator:"selective-parallel",fetchedAt:data.fetchedAt,message:data.message})}

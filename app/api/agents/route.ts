import { getLiveDashboard } from "@/lib/live-data";
export async function GET(){const data=await getLiveDashboard();return Response.json({status:data.status,agents:data.agents,retrievalMode:"parallel-api-requests",fetchedAt:data.fetchedAt,message:data.message})}

import { getLiveSituation } from "@/lib/live-data";
export async function GET(){const data=await getLiveSituation();return Response.json({status:data.status,sources:data.sources,fetchedAt:data.fetchedAt,message:data.message})}

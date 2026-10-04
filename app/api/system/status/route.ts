import { getLiveSituation } from "@/lib/live-data";
export async function GET(){const data=await getLiveSituation();return Response.json({status:data.status==="available"?"operational":"degraded",checkedAt:data.fetchedAt,services:data.sources.map(x=>({name:x.name,authority:x.authority,status:x.status,message:x.message??null}))})}

import { getLiveSituation } from "@/lib/live-data";
import { getAiRuntimeStatus } from "@/lib/sarathi-ai";
export async function GET(){const data=await getLiveSituation();return Response.json({status:data.sources.every(s=>s.status==="live")?"operational":"degraded",checkedAt:data.fetchedAt,services:data.sources.map(x=>({name:x.name,authority:x.authority,status:x.status,message:x.message??null})),ai:getAiRuntimeStatus()})}

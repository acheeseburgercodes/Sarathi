import { getLiveSituation } from "@/lib/live-data";
export async function GET(){const data=await getLiveSituation();return Response.json({status:data.status,fetchedAt:data.fetchedAt,items:[...data.events,...data.earthquakes],sources:data.sources,message:data.message},{headers:{"Cache-Control":"public, max-age=120"}})}

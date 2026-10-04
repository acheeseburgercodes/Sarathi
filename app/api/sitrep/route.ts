import { sitreps,incident } from "@/lib/sarathi-data";
export async function GET(){return Response.json({reports:sitreps,currentIncident:incident.incidentId,mode:"exercise"})}

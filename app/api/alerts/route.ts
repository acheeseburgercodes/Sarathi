import { incident,warnings } from "@/lib/sarathi-data";
export async function GET(){return Response.json({alerts:warnings.filter(x=>x.score>=80),approvalRequired:true,riskScore:incident.risk.score,mode:"exercise"})}

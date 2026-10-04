import { warnings } from "@/lib/sarathi-data";
export async function GET(){return Response.json({warnings,thresholds:{high:80,critical:90},mode:"exercise"})}

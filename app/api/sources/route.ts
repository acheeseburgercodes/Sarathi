import { sources } from "@/lib/sarathi-data";
export async function GET(){return Response.json({...sources,mode:"exercise"})}

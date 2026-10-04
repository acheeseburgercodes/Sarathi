import { agents } from "@/lib/sarathi-data";
export async function GET(){return Response.json({agents,orchestrator:"selective-parallel",mode:"exercise"})}

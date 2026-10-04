import { intelligence } from "@/lib/sarathi-data";
export async function GET(){return Response.json({items:intelligence,mode:"exercise"},{headers:{"Cache-Control":"public, max-age=120"}})}

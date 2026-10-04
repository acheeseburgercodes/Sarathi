import { getLiveDashboard } from "./live-data";

export function selectAgents(query:string) {
  const q=query.toLowerCase();
  const selected = new Set<string>(["verification","rag"]);
  if (/flood|rain|weather|storm/.test(q)) ["weather","news","geospatial","risk"].forEach((x)=>selected.add(x));
  if (/shelter|hospital|road|near/.test(q)) selected.add("geospatial");
  if (/earthquake|seismic/.test(q)) selected.add("earthquake");
  if (/fire|thermal|wildfire/.test(q)) selected.add("fire");
  if (/report|summary|sitrep/.test(q)) selected.add("sitrep");
  return [...selected];
}

export async function buildDashboard() { return getLiveDashboard(); }

import { incident, intelligence, agents, warnings } from "./sarathi-data";

export interface Provider<T> { readonly name: string; fetch(): Promise<T>; }

export class MockWeatherProvider implements Provider<typeof incident.weather> {
  readonly name = "MockWeatherProvider";
  async fetch() { return incident.weather; }
}

export class MockIntelligenceProvider implements Provider<typeof intelligence> {
  readonly name = "MockIntelligenceProvider";
  async fetch() { return intelligence; }
}

export function calculateFloodRisk(input: { rainfall24h:number; forecastRainfall:number; exposure:number; corroboratedReports:number }) {
  const rainfall = Math.min(input.rainfall24h / 180, 1) * 35;
  const forecast = Math.min(input.forecastRainfall / 220, 1) * 25;
  const exposure = Math.min(input.exposure / 200000, 1) * 25;
  const reports = Math.min(input.corroboratedReports / 8, 1) * 15;
  return Math.round(rainfall + forecast + exposure + reports);
}

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

export async function buildDashboard() {
  const [weather, stream] = await Promise.all([new MockWeatherProvider().fetch(), new MockIntelligenceProvider().fetch()]);
  return { incident:{...incident,weather}, intelligence:stream, warnings, agents, generatedAt:new Date().toISOString(), mode:"exercise" };
}

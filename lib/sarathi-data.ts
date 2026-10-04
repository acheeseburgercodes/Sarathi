export type Severity = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
export type Verification = "VERIFIED" | "CORROBORATED" | "UNVERIFIED" | "CONFLICTING";

export interface IncidentState {
  incidentId: string;
  eventType: "flood";
  location: { name: string; lat: number; lon: number };
  severity: Severity;
  risk: { score: number; trend: "increasing" | "stable" | "decreasing" };
  weather: { rainfall24h: number; forecastRainfall: number; windKph: number };
  exposure: { people: number; areaKm2: number; shelters: number };
  verification: { status: Verification; confidence: number };
  updatedAt: string;
}

export const incident: IncidentState = {
  incidentId: "INC-CHN-1042",
  eventType: "flood",
  location: { name: "Chennai", lat: 13.0827, lon: 80.2707 },
  severity: "HIGH",
  risk: { score: 82, trend: "increasing" },
  weather: { rainfall24h: 142, forecastRainfall: 180, windKph: 31 },
  exposure: { people: 180000, areaKm2: 12.4, shelters: 12 },
  verification: { status: "VERIFIED", confidence: 87 },
  updatedAt: "09:42",
};

export const intelligence = [
  { time: "09:42", type: "WEATHER", title: "Heavy rainfall detected", location: "Chennai", value: "142 mm / 24h", severity: "HIGH", status: "VERIFIED" },
  { time: "09:41", type: "NEWS", title: "Four independent reports corroborate flooding", location: "Tondiarpet", value: "4 reports", severity: "HIGH", status: "CORROBORATED" },
  { time: "09:40", type: "GEO", title: "Twelve accessible shelters identified", location: "North Chennai", value: "12 shelters", severity: "MODERATE", status: "VERIFIED" },
  { time: "09:39", type: "RISK", title: "Regional risk increased", location: "Chennai", value: "64 → 82", severity: "HIGH", status: "VERIFIED" },
  { time: "09:36", type: "PUBLIC", title: "Waterlogging near Basin Bridge", location: "Pulianthope", value: "8 reports", severity: "MODERATE", status: "UNVERIFIED" },
] as const;

export const warnings = [
  { id: "warn-01", title: "Severe flooding", place: "Tondiarpet, Chennai", severity: "HIGH", time: "09:12", score: 82 },
  { id: "warn-02", title: "Heavy rainfall", place: "North Chennai", severity: "MODERATE", time: "08:54", score: 68 },
  { id: "warn-03", title: "Coastal surge risk", place: "Ennore", severity: "MODERATE", time: "08:20", score: 61 },
  { id: "warn-04", title: "Waterlogging", place: "Anna Nagar", severity: "LOW", time: "07:18", score: 34 },
  { id: "warn-05", title: "River level rise", place: "Adyar", severity: "MODERATE", time: "06:45", score: 57 },
] as const;

export const agents = [
  { slug:"weather", name:"Weather Agent", kind:"Deterministic", status:"LIVE", value:"142 mm", metric:"Rainfall / 24h", confidence:91, sources:2, updated:"12s ago" },
  { slug:"news", name:"News Intelligence", kind:"Retrieval", status:"LIVE", value:"18", metric:"Relevant reports", confidence:76, sources:7, updated:"32s ago" },
  { slug:"geospatial", name:"Geospatial Agent", kind:"Deterministic", status:"LIVE", value:"24", metric:"Spatial events", confidence:88, sources:3, updated:"18s ago" },
  { slug:"risk", name:"Risk Engine", kind:"Deterministic", status:"LIVE", value:"82", metric:"Risk score", confidence:87, sources:8, updated:"8s ago" },
  { slug:"verification", name:"Verification Agent", kind:"Reasoning", status:"LIVE", value:"87%", metric:"Agreement", confidence:87, sources:9, updated:"21s ago" },
  { slug:"rag", name:"Knowledge Agent", kind:"Retrieval", status:"LIVE", value:"6", metric:"Guidance matches", confidence:93, sources:4, updated:"28s ago" },
  { slug:"response", name:"Response Planner", kind:"Reasoning", status:"ONLINE", value:"6", metric:"Recommended actions", confidence:79, sources:5, updated:"1m ago" },
  { slug:"sitrep", name:"SITREP Generator", kind:"Reasoning", status:"ONLINE", value:"#1042", metric:"Current report", confidence:89, sources:11, updated:"2m ago" },
] as const;

export const sources = {
  live: [
    { name:"Open-Meteo", type:"Weather", status:"LIVE", latency:"182 ms" },
    { name:"USGS", type:"Seismic", status:"LIVE", latency:"241 ms" },
    { name:"NASA FIRMS", type:"Thermal", status:"LIVE", latency:"1.2 s" },
    { name:"GDELT", type:"News", status:"LIVE", latency:"680 ms" },
    { name:"OpenStreetMap", type:"Geospatial", status:"LIVE", latency:"420 ms" },
  ],
  knowledge: [
    { name:"NDMA Flood Guidelines", authority:"NDMA", year:2025, chunks:184 },
    { name:"Tamil Nadu Flood SOP", authority:"TN SDMA", year:2025, chunks:96 },
    { name:"Urban Flooding Manual", authority:"MoHUA", year:2024, chunks:132 },
    { name:"Historical SITREPs", authority:"Control Room", year:2026, chunks:418 },
  ],
};

export const sitreps = [
  { id:"1042", time:"09:30", date:"4 Oct 2026", status:"HIGH" },
  { id:"1041", time:"08:00", date:"4 Oct 2026", status:"HIGH" },
  { id:"1040", time:"06:00", date:"4 Oct 2026", status:"MODERATE" },
  { id:"1039", time:"04:00", date:"4 Oct 2026", status:"MODERATE" },
];

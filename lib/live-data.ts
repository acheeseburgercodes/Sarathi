/* eslint-disable @typescript-eslint/no-explicit-any */
const CHENNAI = { name: "Chennai, Tamil Nadu", latitude: 13.0827, longitude: 80.2707 };

type SourceState = { name: string; authority: string; status: "live" | "unavailable"; fetchedAt?: string; message?: string };

async function readJson<T>(url: string, timeout = 8000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json", "User-Agent": "Sarathi-Disaster-Intelligence/1.0" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json() as T;
  } finally { clearTimeout(timer); }
}

function scoreRisk(rain24h: number, rainNext24h: number, probability: number, wind: number) {
  return Math.min(100, Math.round(Math.min(rain24h / 100, 1) * 35 + Math.min(rainNext24h / 120, 1) * 30 + probability * .25 + Math.min(wind / 60, 1) * 10));
}

export async function getLiveSituation() {
  const fetchedAt = new Date().toISOString();
  const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
  weatherUrl.search = new URLSearchParams({
    latitude: String(CHENNAI.latitude), longitude: String(CHENNAI.longitude), timezone: "Asia/Kolkata",
    current: "temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m",
    hourly: "precipitation_probability,precipitation", past_days: "1", forecast_days: "2"
  }).toString();
  const eonetUrl = "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=20";
  const usgsUrl = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson";

  const [weatherResult, eonetResult, usgsResult] = await Promise.allSettled([
    readJson<any>(weatherUrl.toString()), readJson<any>(eonetUrl), readJson<any>(usgsUrl)
  ]);

  const sources: SourceState[] = [
    { name: "Open-Meteo", authority: "Open-Meteo", status: weatherResult.status === "fulfilled" ? "live" : "unavailable", fetchedAt: weatherResult.status === "fulfilled" ? fetchedAt : undefined, message: weatherResult.status === "rejected" ? "Weather feed did not respond." : undefined },
    { name: "EONET", authority: "NASA", status: eonetResult.status === "fulfilled" ? "live" : "unavailable", fetchedAt: eonetResult.status === "fulfilled" ? fetchedAt : undefined, message: eonetResult.status === "rejected" ? "Natural event feed did not respond." : undefined },
    { name: "Earthquake feed", authority: "USGS", status: usgsResult.status === "fulfilled" ? "live" : "unavailable", fetchedAt: usgsResult.status === "fulfilled" ? fetchedAt : undefined, message: usgsResult.status === "rejected" ? "Seismic feed did not respond." : undefined },
  ];

  const weather = weatherResult.status === "fulfilled" ? weatherResult.value : null;
  const hourlyTimes: string[] = weather?.hourly?.time ?? [];
  const hourlyRain: number[] = weather?.hourly?.precipitation ?? [];
  const hourlyProbability: number[] = weather?.hourly?.precipitation_probability ?? [];
  const now = Date.now();
  const last24 = hourlyTimes.map((time, index) => ({ time, value: Number(hourlyRain[index] ?? 0) })).filter(x => { const t = Date.parse(x.time); return t <= now && t >= now - 86400000; });
  const next24 = hourlyTimes.map((time, index) => ({ time, value: Number(hourlyRain[index] ?? 0), probability: Number(hourlyProbability[index] ?? 0) })).filter(x => { const t = Date.parse(x.time); return t > now && t <= now + 86400000; });
  const rain24h = Number(last24.reduce((sum, x) => sum + x.value, 0).toFixed(1));
  const rainNext24h = Number(next24.reduce((sum, x) => sum + x.value, 0).toFixed(1));
  const maxProbability = next24.length ? Math.max(...next24.map(x => x.probability)) : 0;
  const wind = Number(weather?.current?.wind_speed_10m ?? 0);
  const riskScore = weather ? scoreRisk(rain24h, rainNext24h, maxProbability, wind) : null;
  const severity = riskScore === null ? "UNKNOWN" : riskScore >= 80 ? "CRITICAL" : riskScore >= 60 ? "HIGH" : riskScore >= 35 ? "MODERATE" : "LOW";

  const eonetEvents = eonetResult.status === "fulfilled" ? (eonetResult.value.events ?? []).map((event: any) => ({
    id: event.id, title: event.title, category: event.categories?.[0]?.title ?? "Natural event", date: event.geometry?.at(-1)?.date ?? null,
    coordinates: event.geometry?.at(-1)?.coordinates ?? null, source: "NASA EONET", link: event.sources?.[0]?.url ?? null
  })) : [];
  const earthquakes = usgsResult.status === "fulfilled" ? (usgsResult.value.features ?? []).map((feature: any) => ({
    id: feature.id, title: feature.properties?.title, magnitude: feature.properties?.mag, time: feature.properties?.time ? new Date(feature.properties.time).toISOString() : null,
    coordinates: feature.geometry?.coordinates ?? null, source: "USGS", link: feature.properties?.url ?? null
  })) : [];

  return {
    status: weather || eonetEvents.length || earthquakes.length ? "available" : "unavailable",
    fetchedAt, location: CHENNAI,
    weather: weather ? { temperature: weather.current?.temperature_2m ?? null, humidity: weather.current?.relative_humidity_2m ?? null, precipitationNow: weather.current?.precipitation ?? null, rainNow: weather.current?.rain ?? null, windSpeed: wind, weatherCode: weather.current?.weather_code ?? null, rain24h, rainNext24h, maxRainProbability: maxProbability, hourly: next24.slice(0, 12) } : null,
    risk: riskScore === null ? null : { score: riskScore, severity, basis: "Calculated from live precipitation, forecast probability and wind data." },
    events: eonetEvents, earthquakes, sources,
    message: weather || eonetEvents.length || earthquakes.length ? null : "Live data is temporarily unavailable. Sarathi will retry automatically; no simulated values are being shown."
  };
}

export async function getLiveDashboard() {
  const situation = await getLiveSituation();
  const agents = [
    { slug: "weather", name: "Weather Agent", source: "Open-Meteo", status: situation.weather ? "LIVE" : "UNAVAILABLE", value: situation.weather ? `${situation.weather.rain24h} mm` : null, metric: "Rainfall / 24h" },
    { slug: "risk", name: "Risk Engine", source: "Derived live weather", status: situation.risk ? "LIVE" : "UNAVAILABLE", value: situation.risk?.score ?? null, metric: "Weather risk score" },
    { slug: "events", name: "Natural Events Agent", source: "NASA EONET", status: situation.sources[1].status === "live" ? "LIVE" : "UNAVAILABLE", value: situation.events.length, metric: "Open global events" },
    { slug: "seismic", name: "Seismic Agent", source: "USGS", status: situation.sources[2].status === "live" ? "LIVE" : "UNAVAILABLE", value: situation.earthquakes.length, metric: "Significant events / 7d" },
  ];
  return { ...situation, agents };
}

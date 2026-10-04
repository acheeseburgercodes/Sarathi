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

export async function getLiveSituation() {
  const fetchedAt = new Date().toISOString();
  const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
  weatherUrl.search = new URLSearchParams({
    latitude: String(CHENNAI.latitude), longitude: String(CHENNAI.longitude), timezone: "UTC",
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

  const rawWeather = weatherResult.status === "fulfilled" ? weatherResult.value : null;
  const weather = rawWeather && Number.isFinite(rawWeather.current?.temperature_2m) && Number.isFinite(rawWeather.current?.wind_speed_10m) && Array.isArray(rawWeather.hourly?.time) && rawWeather.hourly.time.length > 24 && rawWeather.hourly?.precipitation?.every((n: unknown) => typeof n === "number" && Number.isFinite(n)) && rawWeather.hourly?.precipitation_probability?.every((n: unknown) => typeof n === "number" && Number.isFinite(n)) ? rawWeather : null;
  if (!weather) { sources[0].status = "unavailable"; sources[0].message = "Weather data is unavailable or incomplete."; }
  const hourlyTimes: string[] = weather?.hourly?.time ?? [];
  const hourlyRain: number[] = weather?.hourly?.precipitation ?? [];
  const hourlyProbability: number[] = weather?.hourly?.precipitation_probability ?? [];
  const now = Date.now();
  const last24 = hourlyTimes.map((time, index) => ({ time: time + "Z", value: Number(hourlyRain[index]) })).filter(x => { const t = Date.parse(x.time); return t <= now && t > now - 86400000; });
  const next24 = hourlyTimes.map((time, index) => ({ time: time + "Z", value: Number(hourlyRain[index]), probability: Number(hourlyProbability[index]) })).filter(x => { const t = Date.parse(x.time); return t > now && t <= now + 86400000; });
  const rain24h = Number(last24.reduce((sum, x) => sum + x.value, 0).toFixed(1));
  const rainNext24h = Number(next24.reduce((sum, x) => sum + x.value, 0).toFixed(1));
  const maxProbability = next24.length ? Math.max(...next24.map(x => x.probability)) : 0;
  const wind = Number(weather?.current?.wind_speed_10m ?? 0);
  const eonetValid = eonetResult.status === "fulfilled" && Array.isArray(eonetResult.value.events);
  const usgsValid = usgsResult.status === "fulfilled" && Array.isArray(usgsResult.value.features);
  if (!eonetValid) { sources[1].status = "unavailable"; sources[1].message = "Natural event data is unavailable or malformed."; }
  if (!usgsValid) { sources[2].status = "unavailable"; sources[2].message = "Seismic data is unavailable or malformed."; }
  const eonetEvents = eonetValid && eonetResult.status === "fulfilled" ? eonetResult.value.events.filter((event: any) => typeof event.id === "string" && typeof event.title === "string").map((event: any) => ({
    id: event.id, title: event.title, category: event.categories?.[0]?.title ?? "Natural event", date: event.geometry?.at(-1)?.date ?? null,
    coordinates: event.geometry?.at(-1)?.coordinates ?? null, source: "NASA EONET", link: event.sources?.[0]?.url ?? null
  })) : [];
  const earthquakes = usgsValid && usgsResult.status === "fulfilled" ? usgsResult.value.features.filter((feature: any) => typeof feature.id === "string" && typeof feature.properties?.title === "string").map((feature: any) => ({
    id: feature.id, title: feature.properties?.title, magnitude: feature.properties?.mag, time: feature.properties?.time ? new Date(feature.properties.time).toISOString() : null,
    coordinates: feature.geometry?.coordinates ?? null, source: "USGS", link: feature.properties?.url ?? null
  })) : [];

  return {
    status: sources.some(s => s.status === "live") ? "available" : "unavailable",
    fetchedAt, location: CHENNAI,
    weather: weather ? { temperature: weather.current?.temperature_2m ?? null, humidity: weather.current?.relative_humidity_2m ?? null, precipitationNow: weather.current?.precipitation ?? null, rainNow: weather.current?.rain ?? null, windSpeed: wind, weatherCode: weather.current?.weather_code ?? null, rain24h, rainNext24h, maxRainProbability: maxProbability, hourly: next24.slice(0, 12) } : null,
    risk: null,
    events: eonetEvents, earthquakes, sources,
    message: sources.some(s => s.status === "live") ? null : "Live data is temporarily unavailable. Retry to request a fresh snapshot."
  };
}

export async function getLiveDashboard() {
  const situation = await getLiveSituation();
  const agents = [
    { slug: "weather", name: "Weather Agent", source: "Open-Meteo", status: situation.weather ? "LIVE" : "UNAVAILABLE", value: situation.weather ? `${situation.weather.rain24h} mm` : null, metric: "Rainfall / 24h" },
    { slug: "risk", name: "Risk Engine", source: "No verified risk provider connected", status: "UNAVAILABLE", value: null, metric: "Risk assessment unavailable" },
    { slug: "events", name: "Natural Events Agent", source: "NASA EONET", status: situation.sources[1].status === "live" ? "LIVE" : "UNAVAILABLE", value: situation.sources[1].status === "live" ? situation.events.length : null, metric: "Open global events (up to 20)" },
    { slug: "seismic", name: "Seismic Agent", source: "USGS", status: situation.sources[2].status === "live" ? "LIVE" : "UNAVAILABLE", value: situation.sources[2].status === "live" ? situation.earthquakes.length : null, metric: "Significant events / 7d" },
  ];
  return { ...situation, agents };
}

const USER_AGENT = "Sarathi-Disaster-Intelligence-CLI/1.0";

async function request(url, { fetchImpl = fetch, format = "json", timeoutMs = 12_000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal, headers: { Accept: format === "json" ? "application/json" : "application/xml,text/xml", "User-Agent": USER_AGENT } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return format === "json" ? response.json() : response.text();
  } finally { clearTimeout(timer); }
}

function decodeXml(value = "") {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

function xmlTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return decodeXml(match?.[1] ?? "");
}

export function parseNewsRss(xml, limit = 10) {
  return [...String(xml).matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, limit).map((match, index) => {
    const block = match[1];
    const sourceMatch = block.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
    return {
      id: `news-${index + 1}`,
      title: xmlTag(block, "title"),
      publishedAt: xmlTag(block, "pubDate") || null,
      source: decodeXml(sourceMatch?.[1] ?? "Google News"),
      url: xmlTag(block, "link") || null,
    };
  }).filter(item => item.title);
}

export async function fetchWeather({ latitude, longitude, fetchImpl = fetch }) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: String(latitude), longitude: String(longitude), timezone: "UTC", forecast_days: "3",
    current: "temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m",
    hourly: "temperature_2m,precipitation_probability,precipitation,wind_speed_10m",
  }).toString();
  const raw = await request(url, { fetchImpl });
  if (!raw?.current || !Array.isArray(raw?.hourly?.time)) throw new Error("Open-Meteo returned an incomplete payload.");
  return {
    source: "Open-Meteo", authority: "Open-Meteo", retrievedAt: new Date().toISOString(), url: "https://open-meteo.com/en/docs",
    current: raw.current,
    hourly: raw.hourly.time.slice(0, 48).map((time, i) => ({ time, temperatureC: raw.hourly.temperature_2m?.[i] ?? null, precipitationMm: raw.hourly.precipitation?.[i] ?? null, precipitationProbabilityPercent: raw.hourly.precipitation_probability?.[i] ?? null, windSpeedKmh: raw.hourly.wind_speed_10m?.[i] ?? null })),
  };
}

export async function fetchNews({ query, location, fetchImpl = fetch }) {
  const terms = `${query || "disaster response OR flood OR cyclone OR earthquake"} ${location || ""} when:2d`.trim();
  const url = new URL("https://news.google.com/rss/search");
  url.search = new URLSearchParams({ q: terms, hl: "en-IN", gl: "IN", ceid: "IN:en" }).toString();
  const xml = await request(url, { fetchImpl, format: "text" });
  return { source: "Google News RSS", authority: "Publishers indexed by Google News", retrievedAt: new Date().toISOString(), url: url.toString(), articles: parseNewsRss(xml, 12) };
}

export async function fetchEarthquakes({ fetchImpl = fetch }) {
  const url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson";
  const raw = await request(url, { fetchImpl });
  if (!Array.isArray(raw?.features)) throw new Error("USGS returned an incomplete payload.");
  return { source: "USGS", authority: "United States Geological Survey", retrievedAt: new Date().toISOString(), url, events: raw.features.slice(0, 12).map(item => ({ id: item.id, title: item.properties?.title ?? null, magnitude: item.properties?.mag ?? null, occurredAt: item.properties?.time ? new Date(item.properties.time).toISOString() : null, coordinates: item.geometry?.coordinates ?? null, url: item.properties?.url ?? null })) };
}

export async function fetchNaturalEvents({ fetchImpl = fetch }) {
  const url = "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=12";
  const raw = await request(url, { fetchImpl });
  if (!Array.isArray(raw?.events)) throw new Error("NASA EONET returned an incomplete payload.");
  return { source: "NASA EONET", authority: "NASA Earth Observatory Natural Event Tracker", retrievedAt: new Date().toISOString(), url: "https://eonet.gsfc.nasa.gov/docs/v3", events: raw.events.map(item => ({ id: item.id, title: item.title, category: item.categories?.[0]?.title ?? null, observedAt: item.geometry?.at(-1)?.date ?? null, coordinates: item.geometry?.at(-1)?.coordinates ?? null, url: item.sources?.[0]?.url ?? null })) };
}

export async function collectSources(context, fetchImpl = fetch) {
  const definitions = [
    ["weather", () => fetchWeather({ ...context, fetchImpl })],
    ["news", () => fetchNews({ ...context, fetchImpl })],
    ["seismic", () => fetchEarthquakes({ fetchImpl })],
    ["events", () => fetchNaturalEvents({ fetchImpl })],
  ];
  const settled = await Promise.allSettled(definitions.map(([, run]) => run()));
  return Object.fromEntries(definitions.map(([id], index) => settled[index].status === "fulfilled"
    ? [id, { status: "available", data: settled[index].value, error: null }]
    : [id, { status: "unavailable", data: null, error: settled[index].reason instanceof Error ? settled[index].reason.message : "Source request failed." }]));
}

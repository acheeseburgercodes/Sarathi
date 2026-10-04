import { getLiveSituation } from "@/lib/live-data";
export async function POST(request: Request) {
  const raw: unknown = await request.json().catch(() => ({}));
  const body = raw && typeof raw === "object" ? raw as { query?: unknown } : {};
  const query = typeof body.query === "string" ? body.query.trim().slice(0, 2000) : "";
  if (!query) return Response.json({ message: "Enter a question." }, { status: 400 });
  const data = await getLiveSituation();
  let answer: string;
  let selectedAgents: string[];
  let sourceName: string;
  if (/earthquake|seismic|quake/i.test(query)) {
    selectedAgents = ["Seismic"]; sourceName = "Earthquake feed";
    answer = data.sources[2].status !== "live" ? "The USGS feed is currently unavailable. I cannot assess recent earthquakes." : data.earthquakes.length ? "Significant earthquakes reported by USGS in the past week:\n" + data.earthquakes.map((e: { title: string }) => `• ${e.title}`).join("\n") : "USGS returned no significant earthquakes in the past week. This feed does not include all smaller earthquakes.";
  } else if (/hazard|wildfire|natural event|global|volcano/i.test(query)) {
    selectedAgents = ["Natural events"]; sourceName = "EONET";
    answer = data.sources[1].status !== "live" ? "NASA EONET is currently unavailable. Try again later." : data.events.length ? "Open natural events returned by NASA EONET (global, up to 20 events):\n" + data.events.slice(0, 8).map((e: { title: string }) => `• ${e.title}`).join("\n") : "NASA EONET returned no open events for this request.";
  } else if (/shelter|route|safe|evacuat|hospital|flooding|flooded/i.test(query)) {
    selectedAgents = []; sourceName = "";
    answer = "I do not have verified shelter, road closure, evacuation or flood extent data. I cannot establish safe routes or confirm local flooding from weather data alone. Check your local disaster management authority for official instructions.";
  } else if (/weather|rain|wind|temperature|forecast|condition|chennai|risk/i.test(query)) {
    selectedAgents = ["Weather"]; sourceName = "Open-Meteo";
    const w = data.weather;
    answer = w ? `Chennai weather from Open-Meteo:\n• Temperature: ${w.temperature}°C\n• Precipitation over the past 24 hours: ${w.rain24h} mm\n• Forecast precipitation over the next 24 hours: ${w.rainNext24h} mm\n• Peak forecast probability: ${w.maxRainProbability}%\n• Wind: ${w.windSpeed} km/h\n\nThese are weather model estimates, not an official disaster advisory.` : "Open-Meteo is unavailable or returned incomplete data. Current local conditions cannot be assessed.";
  } else { selectedAgents = []; sourceName = ""; answer = "I can retrieve Chennai weather and rainfall forecasts, significant earthquakes, or global natural events. Ask about one of those connected sources."; }
  return Response.json({ answer, selectedAgents, sources: data.sources.filter(s => s.name === sourceName && s.status === "live"), fetchedAt: data.fetchedAt });
}

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type OpenMeteoPoint = {
  current?: { time?: string; temperature_2m?: number; precipitation?: number; wind_speed_10m?: number };
};

const finite = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;

export async function GET(request: NextRequest) {
  const latitude = Number(request.nextUrl.searchParams.get("lat"));
  const longitude = Number(request.nextUrl.searchParams.get("lon"));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 85 || Math.abs(longitude) > 180) {
    return NextResponse.json({ status: "unavailable", message: "Valid device coordinates are required." }, { status: 400 });
  }

  const size = 7;
  const latitudeStep = 0.12;
  const longitudeStep = Math.min(0.45, latitudeStep / Math.max(0.3, Math.cos(latitude * Math.PI / 180)));
  const requested: { latitude: number; longitude: number }[] = [];
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      requested.push({
        latitude: Math.max(-85, Math.min(85, latitude + (row - 3) * latitudeStep)),
        longitude: ((((longitude + (column - 3) * longitudeStep) + 180) % 360) + 360) % 360 - 180,
      });
    }
  }

  const params = new URLSearchParams({
    latitude: requested.map(point => point.latitude.toFixed(4)).join(","),
    longitude: requested.map(point => point.longitude.toFixed(4)).join(","),
    current: "temperature_2m,precipitation,wind_speed_10m",
    forecast_days: "1",
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`Open-Meteo returned HTTP ${response.status}.`);
    const payload = await response.json() as OpenMeteoPoint[] | OpenMeteoPoint;
    const points = Array.isArray(payload) ? payload : [payload];
    const cells = requested.map((point, index) => ({
      latitude: point.latitude,
      longitude: point.longitude,
      temperature: finite(points[index]?.current?.temperature_2m),
      precipitation: finite(points[index]?.current?.precipitation),
      wind: finite(points[index]?.current?.wind_speed_10m),
    }));
    if (!cells.some(cell => cell.temperature != null || cell.precipitation != null || cell.wind != null)) {
      throw new Error("Open-Meteo returned no usable grid values.");
    }
    return NextResponse.json({
      status: "available",
      source: "Open-Meteo",
      generatedAt: new Date().toISOString(),
      observedAt: points.find(point => point.current?.time)?.current?.time ?? null,
      center: { latitude, longitude },
      cellSize: { latitude: latitudeStep, longitude: longitudeStep },
      units: { temperature: "°C", precipitation: "mm", wind: "km/h" },
      cells,
    }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (error) {
    return NextResponse.json({ status: "unavailable", source: "Open-Meteo", message: error instanceof Error ? error.message : "The weather grid is unavailable." }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getLiveSituation } from "@/lib/live-data";

export const dynamic = "force-dynamic";

const distanceKm = (latitude: number, longitude: number, coordinates?: number[] | null) => {
  if (!coordinates || !Number.isFinite(coordinates[0]) || !Number.isFinite(coordinates[1])) return null;
  const toRadians = (value: number) => value * Math.PI / 180;
  const [eventLongitude, eventLatitude] = coordinates;
  const latitudeDelta = toRadians(eventLatitude - latitude);
  const longitudeDelta = toRadians(eventLongitude - longitude);
  const value = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(toRadians(latitude)) * Math.cos(toRadians(eventLatitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

export async function GET(request: NextRequest) {
  const scope = request.nextUrl.searchParams.get("scope") === "global" ? "global" : "local";
  const latitudeParam = request.nextUrl.searchParams.get("lat");
  const longitudeParam = request.nextUrl.searchParams.get("lon");
  const latitude = Number(latitudeParam);
  const longitude = Number(longitudeParam);
  const radiusKm = Math.max(25, Math.min(1000, Number(request.nextUrl.searchParams.get("radiusKm")) || 300));
  if (scope === "local" && (latitudeParam == null || longitudeParam == null || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180)) {
    return NextResponse.json({ status: "location_required", scope, alerts: [], message: "Device location is required for local alerts." }, { status: 400 });
  }
  const data = await getLiveSituation();
  const candidates = [...data.events, ...data.earthquakes].map(event => {
    const distance = scope === "local" ? distanceKm(latitude, longitude, event.coordinates) : null;
    return { ...event, distanceKm: distance == null ? null : Math.round(distance) };
  });
  const alerts = scope === "local" ? candidates.filter(event => event.distanceKm != null && event.distanceKm <= radiusKm) : candidates;
  return NextResponse.json({
    status: "available", scope, radiusKm: scope === "local" ? radiusKm : null,
    center: scope === "local" ? { latitude, longitude } : null,
    alerts, count: alerts.length, fetchedAt: data.fetchedAt,
    sources: data.sources.filter(source => source.name === "EONET" || source.name === "Earthquake feed"),
    message: alerts.length ? null : scope === "local" ? `No NASA EONET or USGS events were reported within ${radiusKm} km of this location.` : "The connected global feeds returned no events.",
    officialAlertFeedConnected: false,
  }, { headers: { "Cache-Control": "private, max-age=60" } });
}

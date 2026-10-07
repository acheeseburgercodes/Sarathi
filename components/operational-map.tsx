"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup, TileLayer } from "leaflet";
import { LocateFixed, Minus, Navigation, Plus } from "lucide-react";

export type MapPoint = { id: string; title: string; coordinates?: number[] | null; source?: string; category?: string };
export type HeatMetric = "precipitation" | "temperature" | "wind";
type HeatGrid = { status: "available"; source: string; generatedAt: string; observedAt: string | null; cellSize: { latitude: number; longitude: number }; units: Record<HeatMetric, string>; cells: ({ latitude: number; longitude: number } & Record<HeatMetric, number | null>)[] };
const heatLabels: Record<HeatMetric, string> = { precipitation: "Precipitation", temperature: "Temperature", wind: "Wind speed" };
const heatPalette = ["#2b0710", "#7e1018", "#d52b1e", "#ff6c17", "#ffc61a", "#fff39a"];
function heatColor(value: number, minimum: number, maximum: number) {
  const ratio = maximum === minimum ? .5 : Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)));
  return heatPalette[Math.min(heatPalette.length - 1, Math.floor(ratio * heatPalette.length))];
}
export function OperationalMap({ points = [], selected, global = false, followDevice = false, heatMetric = null, onSelect }: { points?: MapPoint[]; selected?: MapPoint | null; global?: boolean; followDevice?: boolean; heatMetric?: HeatMetric | null; onSelect?: (point: MapPoint) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const markers = useRef<LayerGroup | null>(null);
  const baseLayer = useRef<TileLayer | null>(null);
  const selectRef = useRef(onSelect);
  useEffect(() => { selectRef.current = onSelect; }, [onSelect]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [style, setStyle] = useState<"dark"|"street"|"satellite">("dark");
  const [location, setLocation] = useState<[number, number] | null>(null);
  const [locationState, setLocationState] = useState<"idle"|"locating"|"found"|"unavailable">(followDevice ? "locating" : "idle");
  const [heatGrid, setHeatGrid] = useState<HeatGrid | null>(null);
  const [heatState, setHeatState] = useState<"idle"|"loading"|"available"|"unavailable">(heatMetric ? "loading" : "idle");
  const locateDevice = () => {
    if (!navigator.geolocation) { setLocationState("unavailable"); return; }
    setLocationState("locating");
    navigator.geolocation.getCurrentPosition(
      position => {
        const next: [number, number] = [position.coords.latitude, position.coords.longitude];
        setLocation(next); setLocationState("found"); map.current?.flyTo(next, 12, { duration: .9 });
      },
      () => setLocationState("unavailable"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 },
    );
  };
  const focusDeviceArea = () => {
    if (heatGrid?.cells.length) {
      const halfLatitude = heatGrid.cellSize.latitude / 2;
      const halfLongitude = heatGrid.cellSize.longitude / 2;
      const bounds: [[number, number], [number, number]] = [
        [Math.min(...heatGrid.cells.map(cell => cell.latitude)) - halfLatitude, Math.min(...heatGrid.cells.map(cell => cell.longitude)) - halfLongitude],
        [Math.max(...heatGrid.cells.map(cell => cell.latitude)) + halfLatitude, Math.max(...heatGrid.cells.map(cell => cell.longitude)) + halfLongitude],
      ];
      map.current?.fitBounds(bounds, { padding: [22, 22], maxZoom: 10 });
    } else if (location) map.current?.flyTo(location, 12);
    else locateDevice();
  };
  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    import("leaflet").then(L => {
      if (disposed || !container.current) return;
      const instance = L.map(container.current, { zoomControl: false, scrollWheelZoom: false, attributionControl: true }).setView(global ? [20, 35] : [13.075, 80.24], global ? 2 : 11);
      map.current = instance;
      markers.current = L.layerGroup().addTo(instance);
      observer = new ResizeObserver(() => instance.invalidateSize());
      observer.observe(container.current);
      setReady(true);
    }).catch(() => { if (!disposed) setFailed(true); });
    return () => { disposed = true; observer?.disconnect(); map.current?.remove(); map.current = null; };
  }, [global]);
  useEffect(() => {
    if (!followDevice || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      position => {
        const next: [number, number] = [position.coords.latitude, position.coords.longitude];
        setLocation(next); setLocationState("found"); map.current?.flyTo(next, 12, { duration: .9 });
      },
      () => setLocationState("unavailable"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 },
    );
  }, [followDevice]);
  useEffect(() => {
    if (!ready || !map.current) return;
    let disposed = false;
    import("leaflet").then(L => {
      if (disposed || !map.current) return;
      baseLayer.current?.remove();
      let loaded = 0;
      const satellite = style === "satellite";
      const layer = L.tileLayer(
        satellite ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" : "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        { maxZoom: satellite ? 18 : 19, attribution: satellite ? 'Tiles © <a href="https://www.esri.com/" target="_blank" rel="noreferrer">Esri</a> · Earthstar Geographics' : '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors' }
      ).addTo(map.current);
      layer.on("tileload", () => { loaded++; if (!disposed) setFailed(false); });
      layer.on("tileerror", () => { if (!loaded && !disposed) setFailed(true); });
      layer.bringToBack();
      baseLayer.current = layer;
    }).catch(() => { if (!disposed) setFailed(true); });
    return () => { disposed = true; };
  }, [ready, style]);
  useEffect(() => {
    if (!ready) return;
    import("leaflet").then(L => {
      if (!map.current || !markers.current) return;
      markers.current.clearLayers();
      if (heatMetric && heatGrid) {
        const values = heatGrid.cells.map(cell => cell[heatMetric]).filter((value): value is number => value != null && Number.isFinite(value));
        const minimum = values.length ? Math.min(...values) : 0;
        const maximum = values.length ? Math.max(...values) : 0;
        const halfLatitude = heatGrid.cellSize.latitude / 2;
        const halfLongitude = heatGrid.cellSize.longitude / 2;
        for (const cell of heatGrid.cells) {
          const value = cell[heatMetric];
          if (value == null || !Number.isFinite(value)) continue;
          const rectangle = L.rectangle(
            [[cell.latitude - halfLatitude, cell.longitude - halfLongitude], [cell.latitude + halfLatitude, cell.longitude + halfLongitude]],
            { color: "#ffffff18", weight: 1, fillColor: heatColor(value, minimum, maximum), fillOpacity: heatMetric === "precipitation" && value === 0 ? .32 : .68, interactive: true },
          ).addTo(markers.current);
          const label = document.createElement("span");
          label.textContent = `${heatLabels[heatMetric]}: ${value} ${heatGrid.units[heatMetric]} · Open-Meteo`;
          rectangle.bindTooltip(label);
        }
      }
      if (location) {
        const deviceMarker = L.circleMarker(location, { radius: 9, color: "#ffffff", weight: 3, fillColor: "#39dca4", fillOpacity: 1 }).addTo(markers.current);
        deviceMarker.bindTooltip("Your device location", { permanent: false });
        L.circle(location, { radius: 75, color: "#39dca4", weight: 1, fillColor: "#39dca4", fillOpacity: .12 }).addTo(markers.current);
      }
      for (const point of points) {
        const c = point.coordinates;
        if (!c || !Number.isFinite(c[0]) || !Number.isFinite(c[1]) || Math.abs(c[1]) > 90) continue;
        const color = point.source === "USGS" ? "#ffb656" : "#59c8ff";
        const marker = L.circleMarker([c[1], c[0]], { radius: selected?.id === point.id ? 10 : 6, color, weight: 2, fillColor: color, fillOpacity: .7 }).addTo(markers.current);
        const label = document.createElement("span"); label.textContent = point.title;
        marker.bindTooltip(label).on("click", () => selectRef.current?.(point));
      }
    });
  }, [points, selected, ready, location, heatGrid, heatMetric]);
  useEffect(() => {
    const c = selected?.coordinates;
    if (ready && c && Number.isFinite(c[0]) && Number.isFinite(c[1])) map.current?.flyTo([c[1], c[0]], 8, { duration: .7 });
  }, [selected, ready]);
  useEffect(() => {
    if (ready && followDevice && location) map.current?.flyTo(location, 12, { duration: .9 });
  }, [ready, followDevice, location]);
  useEffect(() => {
    if (!heatMetric || !location) return;
    const controller = new AbortController();
    queueMicrotask(() => setHeatState("loading"));
    fetch(`/api/heatmap?lat=${location[0].toFixed(5)}&lon=${location[1].toFixed(5)}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("Weather grid unavailable");
        return response.json() as Promise<HeatGrid>;
      })
      .then(data => {
        if (data.status !== "available" || !Array.isArray(data.cells) || !data.cells.length) throw new Error("Weather grid unavailable");
        setHeatGrid(data); setHeatState("available");
      })
      .catch(error => { if (error?.name !== "AbortError") { setHeatGrid(null); setHeatState("unavailable"); } });
    return () => controller.abort();
  }, [heatMetric, location]);
  useEffect(() => {
    if (!ready || !heatGrid?.cells.length) return;
    const halfLatitude = heatGrid.cellSize.latitude / 2;
    const halfLongitude = heatGrid.cellSize.longitude / 2;
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...heatGrid.cells.map(cell => cell.latitude)) - halfLatitude, Math.min(...heatGrid.cells.map(cell => cell.longitude)) - halfLongitude],
      [Math.max(...heatGrid.cells.map(cell => cell.latitude)) + halfLatitude, Math.max(...heatGrid.cells.map(cell => cell.longitude)) + halfLongitude],
    ];
    map.current?.fitBounds(bounds, { padding: [22, 22], maxZoom: 10 });
  }, [ready, heatGrid]);
  const heatValues = heatMetric && heatGrid ? heatGrid.cells.map(cell => cell[heatMetric]).filter((value): value is number => value != null && Number.isFinite(value)) : [];
  const heatMinimum = heatValues.length ? Math.min(...heatValues) : null;
  const heatMaximum = heatValues.length ? Math.max(...heatValues) : null;
  return <div className={`real-map map-${style}`}>
    <div ref={container} className="map-canvas" aria-label={global ? "Interactive global hazard map" : "Interactive Chennai street map"}/>
    <div className="map-style-switch" aria-label="Map appearance"><button aria-pressed={style === "dark"} onClick={() => setStyle("dark")}>Dark</button><button aria-pressed={style === "street"} onClick={() => setStyle("street")}>Street</button><button aria-pressed={style === "satellite"} onClick={() => setStyle("satellite")}>Satellite</button></div>
    <div className="map-tools"><button aria-label="Zoom in" onClick={() => map.current?.zoomIn()}><Plus/></button><button aria-label="Zoom out" onClick={() => map.current?.zoomOut()}><Minus/></button><button aria-label={followDevice ? "Center on device weather area" : "Recenter map"} onClick={() => followDevice ? focusDeviceArea() : map.current?.setView(global ? [20, 35] : [13.075, 80.24], global ? 2 : 11)}><LocateFixed/></button></div>
    {followDevice && <button className={`device-location ${locationState}`} onClick={locateDevice}><Navigation/>{locationState === "locating" ? "Finding device…" : locationState === "found" ? "Device location" : "Allow device location"}</button>}
    {heatMetric && <div className={`heat-legend ${heatState}`} role="status"><div><b>{heatLabels[heatMetric]}</b><span>{!location ? locationState === "unavailable" ? "Location unavailable · use the location button" : "Waiting for device location…" : heatState === "loading" ? "Loading live grid…" : heatState === "unavailable" ? "Weather grid unavailable" : `Open-Meteo · ${heatGrid?.cells.length ?? 0} cells`}</span></div>{heatMinimum != null && heatMaximum != null && <><div className="heat-scale">{heatPalette.map(color => <i style={{ background: color }} key={color}/>)}</div><small>{heatMinimum}–{heatMaximum} {heatGrid?.units[heatMetric]}</small></>}</div>}
    {failed && <div className="map-error" role="status">Map tiles are unavailable. <button onClick={() => window.location.reload()}>Retry</button></div>}
  </div>;
}

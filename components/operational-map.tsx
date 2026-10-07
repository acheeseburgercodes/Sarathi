"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup, TileLayer } from "leaflet";
import { LocateFixed, Minus, Navigation, Plus } from "lucide-react";

export type MapPoint = { id: string; title: string; coordinates?: number[] | null; source?: string; category?: string };
export function OperationalMap({ points = [], selected, global = false, followDevice = false, onSelect }: { points?: MapPoint[]; selected?: MapPoint | null; global?: boolean; followDevice?: boolean; onSelect?: (point: MapPoint) => void }) {
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
  }, [points, selected, ready, location]);
  useEffect(() => {
    const c = selected?.coordinates;
    if (ready && c && Number.isFinite(c[0]) && Number.isFinite(c[1])) map.current?.flyTo([c[1], c[0]], 8, { duration: .7 });
  }, [selected, ready]);
  useEffect(() => {
    if (ready && followDevice && location) map.current?.flyTo(location, 12, { duration: .9 });
  }, [ready, followDevice, location]);
  return <div className={`real-map map-${style}`}>
    <div ref={container} className="map-canvas" aria-label={global ? "Interactive global hazard map" : "Interactive Chennai street map"}/>
    <div className="map-style-switch" aria-label="Map appearance"><button aria-pressed={style === "dark"} onClick={() => setStyle("dark")}>Dark</button><button aria-pressed={style === "street"} onClick={() => setStyle("street")}>Street</button><button aria-pressed={style === "satellite"} onClick={() => setStyle("satellite")}>Satellite</button></div>
    <div className="map-tools"><button aria-label="Zoom in" onClick={() => map.current?.zoomIn()}><Plus/></button><button aria-label="Zoom out" onClick={() => map.current?.zoomOut()}><Minus/></button><button aria-label={followDevice ? "Center on device location" : "Recenter map"} onClick={() => followDevice ? (location ? map.current?.flyTo(location, 12) : locateDevice()) : map.current?.setView(global ? [20, 35] : [13.075, 80.24], global ? 2 : 11)}><LocateFixed/></button></div>
    {followDevice && <button className={`device-location ${locationState}`} onClick={locateDevice}><Navigation/>{locationState === "locating" ? "Finding device…" : locationState === "found" ? "Device location" : "Allow device location"}</button>}
    {failed && <div className="map-error" role="status">Map tiles are unavailable. <button onClick={() => window.location.reload()}>Retry</button></div>}
  </div>;
}

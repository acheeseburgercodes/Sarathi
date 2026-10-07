"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup, TileLayer } from "leaflet";
import { LocateFixed, Minus, Plus } from "lucide-react";

export type MapPoint = { id: string; title: string; coordinates?: number[] | null; source?: string; category?: string };
export function OperationalMap({ points = [], selected, global = false, onSelect }: { points?: MapPoint[]; selected?: MapPoint | null; global?: boolean; onSelect?: (point: MapPoint) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const markers = useRef<LayerGroup | null>(null);
  const baseLayer = useRef<TileLayer | null>(null);
  const selectRef = useRef(onSelect);
  useEffect(() => { selectRef.current = onSelect; }, [onSelect]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [style, setStyle] = useState<"dark"|"street"|"satellite">("dark");
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
      for (const point of points) {
        const c = point.coordinates;
        if (!c || !Number.isFinite(c[0]) || !Number.isFinite(c[1]) || Math.abs(c[1]) > 90) continue;
        const color = point.source === "USGS" ? "#ffb656" : "#59c8ff";
        const marker = L.circleMarker([c[1], c[0]], { radius: selected?.id === point.id ? 10 : 6, color, weight: 2, fillColor: color, fillOpacity: .7 }).addTo(markers.current);
        const label = document.createElement("span"); label.textContent = point.title;
        marker.bindTooltip(label).on("click", () => selectRef.current?.(point));
      }
    });
  }, [points, selected, ready]);
  useEffect(() => {
    const c = selected?.coordinates;
    if (ready && c && Number.isFinite(c[0]) && Number.isFinite(c[1])) map.current?.flyTo([c[1], c[0]], 8, { duration: .7 });
  }, [selected, ready]);
  return <div className={`real-map map-${style}`}>
    <div ref={container} className="map-canvas" aria-label={global ? "Interactive global hazard map" : "Interactive Chennai street map"}/>
    <div className="map-style-switch" aria-label="Map appearance"><button aria-pressed={style === "dark"} onClick={() => setStyle("dark")}>Dark</button><button aria-pressed={style === "street"} onClick={() => setStyle("street")}>Street</button><button aria-pressed={style === "satellite"} onClick={() => setStyle("satellite")}>Satellite</button></div>
    <div className="map-tools"><button aria-label="Zoom in" onClick={() => map.current?.zoomIn()}><Plus/></button><button aria-label="Zoom out" onClick={() => map.current?.zoomOut()}><Minus/></button><button aria-label="Recenter map" onClick={() => map.current?.setView(global ? [20, 35] : [13.075, 80.24], global ? 2 : 11)}><LocateFixed/></button></div>
    {failed && <div className="map-error" role="status">Map tiles are unavailable. <button onClick={() => window.location.reload()}>Retry</button></div>}
  </div>;
}

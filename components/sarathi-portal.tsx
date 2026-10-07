"use client";
/* Full document links avoid the deployed vinext client-router failure. */
/* eslint-disable @next/next/no-html-link-for-pages */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowDown, ArrowUpRight, Braces, ChevronRight, CloudRain, Cpu, Database, Download, FileText, GitBranch, Globe2, KeyRound, Layers, LocateFixed, LogIn, LogOut, MapPin, Menu, Network, RefreshCw, Search, Send, ShieldCheck, UserRound, Waves, Wind, X, Zap } from "lucide-react";
import { OperationalMap, type HeatMetric, type MapPoint } from "./operational-map";
import type { getLiveDashboard } from "@/lib/live-data";
import { useAuth } from "./auth-provider";
import { ContainerScroll } from "./container-scroll";

type Snapshot = Awaited<ReturnType<typeof getLiveDashboard>>;
type EventItem = MapPoint & { date?: string; time?: string; link?: string; magnitude?: number };
export type SarathiView = "home"|"about"|"command"|"intelligence"|"warnings"|"agents"|"agent"|"sitrep"|"sitrep-detail"|"alerts"|"ask"|"sources"|"system"|"event"|"login"|"signup"|"profile"|"admin";
const navigation = [["Home", "/", "home"], ["Command", "/command", "command"], ["Intelligence", "/intelligence", "intelligence"], ["Warnings", "/warnings", "warnings"], ["Agents", "/agents", "agents"], ["SITREP", "/sitrep", "sitrep"], ["Ask", "/ask", "ask"], ["About", "/about", "about"]];
const fmt = (value: number | null | undefined, unit = "") => value == null ? "Unavailable" : `${value}${unit}`;
const time = (value?: string) => value ? new Date(value).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "—";
const safeLink = (url?: string) => url && /^https?:\/\//.test(url) ? url : undefined;

function useSnapshot() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      if (!response.ok) throw new Error("The intelligence service did not respond.");
      const snapshot: Snapshot = await response.json();
      setData(snapshot);
      if (snapshot.status === "unavailable") setError(snapshot.message || "Sources are unavailable.");
    } catch { setData(null); setError("Unable to reach live sources. Retry when your connection is available."); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => {
    // The initial request intentionally shares the manual refresh state machine.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);
  return { data, busy, error, refresh };
}
type Live = ReturnType<typeof useSnapshot>;

export function SarathiApp({ view, detail }: { view: SarathiView; detail?: string }) {
  const live = useSnapshot();
  const auth = useAuth();
  const [menu, setMenu] = useState(false);
  const active = view === "agent" ? "agents" : view === "sitrep-detail" ? "sitrep" : view === "event" ? "intelligence" : view === "alerts" ? "warnings" : view;
  const connected = live.data?.sources.filter(s => s.status === "live").length;
  return <div className="portal">
    <header className="portal-header">
      <a className="brand" href="/" aria-label="Sarathi home"><Zap/><span><b>SARATHI</b><small>Command Center</small></span></a>
      <nav className={menu ? "portal-nav expanded" : "portal-nav"} aria-label="Main navigation">{navigation.map(([label, href, name]) => <a key={href} href={href} aria-current={active === name ? "page" : undefined}>{label}</a>)}</nav>
      <a href="/system" className="connection-status"><span>Status</span><i className={live.busy ? "pending" : connected ? "online" : "offline"}/></a>
      <a href={auth.user ? "/profile" : "/login"} className="profile-control" aria-label={auth.user ? "Open profile" : "Sign in"}>{auth.user ? <><span className="profile-avatar">{(auth.profile?.full_name || auth.user.email || "U").charAt(0).toUpperCase()}</span><span className="profile-label"><b>{auth.profile?.full_name || "Profile"}</b><small>{auth.profile?.role || "user"}</small></span></> : <><LogIn/><span>Sign in</span></>}</a>
      <button className="menu-toggle" aria-expanded={menu} aria-label="Toggle navigation" onClick={() => setMenu(!menu)}>{menu ? <X/> : <Menu/>}</button>
    </header>
    <div className={view === "home" ? "home-shell" : "workspace"}>
      {view === "home" && <Home live={live}/>}
      {view === "about" && <About/>}
      {view === "login" && <Login/>}
      {view === "signup" && <AccountAccess mode="signup"/>}
      {view === "command" && <Command live={live}/>}
      {(view === "intelligence" || view === "event") && <Intelligence live={live} detail={detail}/>}
      {(view === "warnings" || view === "alerts") && <Warnings live={live} alerts={view === "alerts"}/>}
      {(view === "agents" || view === "agent") && <Agents live={live} detail={detail}/>}
      {(view === "sitrep" || view === "sitrep-detail") && <Sitrep live={live}/>}
      {view === "ask" && <Ask/>}
      {(view === "sources" || view === "system") && <Sources live={live} system={view === "system"}/>}
      {view === "profile" && <Profile/>}
      {view === "admin" && <Admin live={live}/>}
    </div>
    <footer className="portal-footer"><span>SARATHI <i/> Disaster intelligence</span><div><a href="/about">About</a><a href="/sources">Sources</a><a href="/system">System</a><a href="/alerts">Alert review</a><a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">Report map issue</a></div></footer>
  </div>;
}

function Heading({ number, title, subtitle, live }: { number: string; title: string; subtitle: string; live?: Live }) {
  return <div className="view-heading"><div><span>{number}</span><section><h1>{title}</h1><p>{subtitle}</p></section></div>{live && <button className="button subtle" onClick={live.refresh} disabled={live.busy}><RefreshCw className={live.busy ? "spinning" : ""}/>{live.busy ? "Updating" : "Refresh"}</button>}</div>;
}
function State({ live }: { live: Live }) {
  if (!live.error && !live.busy) return null;
  return <div role="status" className={`notice ${live.error ? "failure" : ""}`}><Activity/><span>{live.error || "Connecting to weather, natural event and seismic sources…"}</span>{live.error && <button onClick={live.refresh}>Retry</button>}</div>;
}
function Pill({ children, tone = "blue" }: { children: React.ReactNode; tone?: string }) { return <span className={`pill ${tone}`}>{children}</span>; }
function Metric({ label, value, unit, hint }: { label: string; value: React.ReactNode; unit?: string; hint?: string }) { return <div className="stat"><span>{label}</span><strong>{value}<small>{unit}</small></strong>{hint && <p>{hint}</p>}</div>; }
function SourcesLine({ live }: { live: Live }) { return <div className="source-line">{live.data?.sources.map(s => <span key={s.name}><i className={s.status === "live" ? "online" : "offline"}/>{s.name}<small>{s.status === "live" ? "Connected" : "Unavailable"}</small></span>)}<time>{live.data ? `${time(live.data.fetchedAt)} IST` : "Awaiting sources"}</time></div>; }
function useScrollReveal() {
  useEffect(() => {
    const nodes = document.querySelectorAll("[data-reveal]");
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add("in-view"); observer.unobserve(entry.target); } }), { threshold: .12 });
    nodes.forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, []);
}
function ScrollMapHero({ live }: { live: Live }) {
  return <ContainerScroll status={live.busy ? "CONNECTING" : live.data ? "ONLINE" : "UNAVAILABLE"} titleComponent={<><p className="eyebrow"><span/> DISASTER INTELLIGENCE · EARLY WARNING · PUBLIC SAFETY</p><h1>Monitor threats.<br/><em>Coordinate the response.</em></h1><p>Scroll into a live operational view, then explore current weather and hazard intelligence directly on the map.</p></>} footer={<><p>Investigate live conditions, inspect source evidence, prepare a SITREP, and coordinate the next response step.</p><a className="button primary" href="/command">Open live command <ArrowUpRight/></a></>}>
    <OperationalMap/><div className="tablet-map-caption"><span className="eyebrow">REGIONAL OPERATIONS</span><h2>Chennai, India</h2><p><MapPin/>13.0827° N · 80.2707° E</p></div><div className="tablet-weather"><div><CloudRain/><Pill tone={live.data?.weather ? "green" : "muted"}>{live.busy ? "CONNECTING" : live.data?.weather ? "LIVE" : "UNAVAILABLE"}</Pill></div><span>Rainfall · last 24h</span><strong>{live.data?.weather?.rain24h ?? "—"}<small>mm</small></strong><p>{live.data?.weather ? `Open-Meteo · ${time(live.data.fetchedAt)} IST` : "Waiting for current weather data"}</p></div><div className="tablet-map-label">INTERACTIVE MAP <i/> Drag · zoom · change layers</div>
  </ContainerScroll>;
}
function Home({ live }: { live: Live }) {
  useScrollReveal();
  return <>
    <ScrollMapHero live={live}/>
    <SourcesLine live={live}/><State live={live}/>
    <a className="discover" href="#platform">Explore the platform <ArrowDown/></a>
    <section id="platform" className="about-section" data-reveal data-slide="left"><span className="eyebrow">01 / OPERATIONAL WORKFLOW</span><h2>Move from a signal<br/>to a decision.</h2><p>Sarathi organizes the response loop around one shared incident picture: detect a signal, investigate it on the map, check the evidence, assess risk, and turn the result into a report or reviewed alert.</p></section>
    <div className="feature-grid" data-reveal data-slide="right">{[["01", "Monitor the command map", "See current Chennai weather and source health on a real, explorable street map.", "/command", Activity], ["02", "Investigate live events", "Filter natural events and significant earthquakes, select one, and inspect its source.", "/intelligence", Globe2], ["03", "Review early signals", "Compare precipitation and wind indicators before preparing an operational alert.", "/warnings", Waves], ["04", "Inspect specialist evidence", "Open each data specialist to see its latest output, freshness, and provider status.", "/agents", Network], ["05", "Produce a SITREP", "Refresh the evidence snapshot, generate a situation report, and download it for review.", "/sitrep", FileText], ["06", "Ask a safety question", "Ask about current weather, earthquakes, and natural events with source-linked answers.", "/ask", Send]].map(([n, title, copy, href, Icon]) => { const I = Icon as typeof Activity; return <a href={href as string} key={title as string}><header><span>{n as string}</span><I/></header><h3>{title as string}</h3><p>{copy as string}</p><ArrowUpRight/></a>; })}</div>
    <section className="agent-illustration" data-reveal data-slide="left" aria-label="Illustration of the Saarthi multi-agent network"><div className="network-copy"><span className="eyebrow">02 / MULTI-AGENT NETWORK</span><h2>One coordinator.<br/>Only the agents you need.</h2><p>The router activates relevant specialists, preserves their source evidence, and passes compact findings to Saarthi Central.</p></div><div className="network-canvas"><div className="network-ring ring-one"/><div className="network-ring ring-two"/><div className="central-node"><Zap/><b>SARATHI</b><small>CENTRAL</small></div><div className="agent-node node-weather"><CloudRain/><span>Weather</span></div><div className="agent-node node-climate"><Globe2/><span>Climate</span></div><div className="agent-node node-news"><Search/><span>News</span></div><div className="agent-node node-events"><Waves/><span>Events</span></div><div className="agent-node node-seismic"><Activity/><span>Seismic</span></div></div></section>
    <section className="about-section team-section" data-reveal data-slide="right"><span className="eyebrow">03 / ONE SARATHI</span><h2>Specialist evidence.<br/>One bounded AI run.</h2><div className="flow-strip"><span>User question</span><ChevronRight/><b>Selective orchestrator</b><ChevronRight/><span>Parallel specialists</span><ChevronRight/><span>Verification + answer</span></div><p>The coordinator routes each question only to relevant live-data and official-guidance agents. Their source-attributed evidence is verified, placed in a shared incident state, and sent through one capped explanation-model call. Every run exposes its route, citations, limitations, runtime and token use.</p><a href="/ask" className="button subtle">Run the AI system</a></section>
  </>;
}

function Command({ live }: { live: Live }) {
  const w = live.data?.weather;
  const [tab, setTab] = useState("weather");
  return <><Heading number="01" title="Command" subtitle="Real-time overview of the situation" live={live}/><State live={live}/>
    <div className="command-stage"><OperationalMap/><div className="command-overlay"><div className="situation-title"><h2>Situation, {time(live.data?.fetchedAt)}</h2><span>Chennai · Tamil Nadu</span></div><div className="floating-stats"><article className="surface risk-card"><header>Current precipitation <a href="/warnings" aria-label="Inspect weather data"><ArrowUpRight/></a></header><strong>{w?.precipitationNow ?? "—"}<small>mm</small></strong><p>{w ? "Open-Meteo current field" : "Weather unavailable"}</p><small>No official warning feed connected</small></article><article className="surface intelligence-card"><header>Intelligence <a href="/intelligence" aria-label="Explore intelligence"><ArrowUpRight/></a></header><strong>{live.data ? live.data.events.length + live.data.earthquakes.length : "—"}</strong><p>Global feed events</p><small>NASA EONET · USGS</small></article><article className="surface weather-card"><header>Weather source <Pill tone={w ? "green" : "muted"}>{w ? "CONNECTED" : "UNAVAILABLE"}</Pill></header><div><strong>{w?.rain24h ?? "—"}<small>mm</small></strong><section><b>{fmt(w?.temperature, "°C")}</b><small>Temperature</small></section></div><p>Modelled precipitation / last 24h</p><small>Open-Meteo API data</small></article></div></div><div className="region-chip"><MapPin/><span>Chennai monitoring region</span></div></div>
    <SourcesLine live={live}/><div className="bottom-grid"><section className="surface forecast-panel"><header><h3>Regional outlook</h3><div className="segmented"><button aria-pressed={tab === "weather"} onClick={() => setTab("weather")}>Rainfall</button><button aria-pressed={tab === "wind"} onClick={() => setTab("wind")}>Wind</button></div></header>{w ? tab === "weather" ? <RainChart hours={w.hourly}/> : <div className="wind-reading"><Wind/><strong>{w.windSpeed}<small>km/h</small></strong><p>Current modelled wind speed</p></div> : <Empty title="Weather unavailable" copy="The weather source has not supplied usable data."/>}</section><section className="surface quick-panel"><h3>Operational workspace</h3>{[["Intelligence", "Inspect global events", "/intelligence"], ["Situation report", "Build from a fresh snapshot", "/sitrep"], ["Ask Sarathi", "Query the connected sources", "/ask"]].map(([title, subtitle, href]) => <a href={href} key={href}><div><b>{title}</b><small>{subtitle}</small></div><ChevronRight/></a>)}</section></div>
  </>;
}

function Intelligence({ live, detail }: { live: Live; detail?: string }) {
  const [filter, setFilter] = useState("all"); const [search, setSearch] = useState(""); const [chosen, setChosen] = useState<string | null>(detail || null);
  const [heatMetric, setHeatMetric] = useState<HeatMetric>("precipitation");
  const all = useMemo<EventItem[]>(() => [...(live.data?.events || []), ...(live.data?.earthquakes || [])], [live.data]);
  const events = all.filter(e => (filter === "all" || (filter === "seismic" ? e.source === "USGS" : e.source !== "USGS")) && e.title.toLowerCase().includes(search.toLowerCase()));
  const selected = events.find(e => e.id === chosen) || null;
  return <><Heading number="02" title="Intelligence" subtitle="Geospatial analysis and multi-source data" live={live}/><State live={live}/><div className="intelligence-workspace"><aside className="surface layer-sidebar"><p className="eyebrow">LAYERS</p>{[["all", "All events", all.length], ["natural", "Natural hazards", all.filter(e => e.source !== "USGS").length], ["seismic", "Earthquakes", all.filter(e => e.source === "USGS").length]].map(([id, label, count]) => <button key={id} className={filter === id ? "selected" : ""} onClick={() => { setFilter(String(id)); setChosen(null); }}><i className={id === "seismic" ? "amber-dot" : "blue-dot"}/>{label}<small>{count}</small></button>)}<div className="heat-layer-controls"><span>LIVE WEATHER GRID</span>{(["precipitation", "temperature", "wind"] as HeatMetric[]).map(metric => <button key={metric} aria-pressed={heatMetric === metric} onClick={() => setHeatMetric(metric)}>{metric === "precipitation" ? "Rain" : metric === "temperature" ? "Temp" : "Wind"}</button>)}</div><div className="layer-note"><Layers/><p>Hazard markers retain source coordinates. The heat grid contains current Open-Meteo model values sampled around this device.</p><span>Location-focused</span></div></aside><div className="intelligence-map"><OperationalMap global followDevice heatMetric={heatMetric} points={events} selected={selected} onSelect={e => setChosen(e.id)}/><label className="map-search"><Search/><input aria-label="Search events" placeholder="Search events…" value={search} onChange={e => setSearch(e.target.value)}/></label></div><aside className="surface event-inspector">{selected ? <><Pill>{selected.source}</Pill><h2>{selected.title}</h2><dl><dt>Category</dt><dd>{selected.category || "Earthquake"}</dd><dt>Reported</dt><dd>{selected.date || selected.time ? new Date(selected.date || selected.time || "").toLocaleDateString("en-IN") : "Not supplied"}</dd><dt>Coordinates</dt><dd>{selected.coordinates?.slice(0, 2).map(n => n.toFixed(3)).join(", ") || "Not supplied"}</dd>{selected.magnitude != null && <><dt>Magnitude</dt><dd>{selected.magnitude}</dd></>}</dl>{safeLink(selected.link) && <a className="button subtle" href={selected.link} target="_blank" rel="noreferrer">Open original source <ArrowUpRight/></a>}<button className="button ghost" onClick={() => setChosen(null)}>Clear selection</button></> : <><MapPin/><h2>Location-focused weather heat map</h2><p>Allow device location, then switch between live precipitation, temperature and wind grids. Every colored cell comes from the current Open-Meteo response.</p><span className="inspector-count">{events.length}<small>source events in this view</small></span></>}</aside></div><section className="event-stream"><header><h3>Latest intelligence</h3><span>{events.length} results</span></header>{events.length ? events.map(e => <button className={chosen === e.id ? "selected" : ""} key={e.id} onClick={() => setChosen(e.id)}><i className={e.source === "USGS" ? "amber-dot" : "blue-dot"}/><div><b>{e.title}</b><small>{e.category || "Earthquake"} · {e.source}</small></div><time>{time(e.date || e.time)}</time><ChevronRight/></button>) : <Empty title={search ? "No matching events" : "No events available"} copy={search ? "Try another search or layer." : "Check source health for feed availability."}/>}</section></>;
}

function RainChart({ hours }: { hours: { time: string; value: number; probability: number }[] }) {
  const max = Math.max(.5, ...hours.map(h => h.value));
  return <div className="rain-chart"><div className="chart-caption"><span>Forecast precipitation / mm</span><span>Next {hours.length} hours</span></div><div className="chart-bars">{hours.map(h => <div key={h.time} title={`${time(h.time)} · ${h.value} mm · ${h.probability}% probability`}><span>{h.value}</span><i style={{ height: `${Math.max(2, h.value / max * 110)}px` }}/><small>{time(h.time)}</small></div>)}</div></div>;
}
type AlertScope = "local" | "global";
type ScopedAlert = EventItem & { distanceKm?: number | null };
type AlertResponse = { status: string; scope: AlertScope; radiusKm?: number | null; alerts?: ScopedAlert[]; message?: string | null; fetchedAt?: string; officialAlertFeedConnected?: boolean };

function Warnings({ live, alerts }: { live: Live; alerts: boolean }) {
  const [tab, setTab] = useState("Forecast"); const [filter, setFilter] = useState("all"); const [signal, setSignal] = useState("rain");
  const [scope, setScope] = useState<AlertScope>("local");
  const [device, setDevice] = useState<[number, number] | null>(null);
  const [locationState, setLocationState] = useState<"locating" | "found" | "unavailable">("locating");
  const [alertEvents, setAlertEvents] = useState<ScopedAlert[]>([]);
  const [alertMessage, setAlertMessage] = useState("");
  const [alertBusy, setAlertBusy] = useState(alerts);
  const [selectedAlert, setSelectedAlert] = useState<string | null>(null);
  const loadAlerts = useCallback(async (nextScope: AlertScope, location: [number, number] | null) => {
    if (nextScope === "local" && !location) return;
    setAlertBusy(true); setAlertMessage("");
    const query = new URLSearchParams({ scope: nextScope });
    if (location) { query.set("lat", String(location[0])); query.set("lon", String(location[1])); query.set("radiusKm", "300"); }
    try {
      const response = await fetch(`/api/alerts?${query}`, { cache: "no-store" });
      const data = await response.json() as AlertResponse;
      if (!response.ok) throw new Error(data.message || "Alert sources could not be loaded.");
      setAlertEvents(data.alerts || []); setAlertMessage(data.message || ""); setSelectedAlert(null);
    } catch (error) { setAlertEvents([]); setAlertMessage(error instanceof Error ? error.message : "Alert sources could not be loaded."); }
    finally { setAlertBusy(false); }
  }, []);
  useEffect(() => {
    if (!alerts) return;
    if (scope === "global") {
      // Scope changes trigger the same asynchronous loader as manual refreshes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadAlerts("global", null); return;
    }
    if (!navigator.geolocation) { queueMicrotask(() => { setLocationState("unavailable"); setAlertBusy(false); setAlertMessage("Device location is unavailable. Switch to Global to inspect worldwide events."); }); return; }
    navigator.geolocation.getCurrentPosition(position => {
      const next: [number, number] = [position.coords.latitude, position.coords.longitude];
      setDevice(next); setLocationState("found"); void loadAlerts("local", next);
    }, () => { setLocationState("unavailable"); setAlertBusy(false); setAlertEvents([]); setAlertMessage("Location permission is required for local alerts. Allow location or switch to Global."); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 });
  }, [alerts, scope, loadAlerts]);
  const requestLocation = () => {
    setLocationState("locating"); setAlertBusy(true);
    navigator.geolocation?.getCurrentPosition(position => {
      const next: [number, number] = [position.coords.latitude, position.coords.longitude];
      setDevice(next); setLocationState("found"); void loadAlerts("local", next);
    }, () => { setLocationState("unavailable"); setAlertBusy(false); setAlertMessage("Location permission was not granted. Switch to Global to inspect worldwide events."); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  };
  const w = live.data?.weather;
  const signals = w ? [{ id: "rain", title: "Forecast precipitation", value: `${w.rainNext24h} mm`, sub: "Next 24 hours", Icon: CloudRain }, { id: "wind", title: "Current wind", value: `${w.windSpeed} km/h`, sub: "Chennai model estimate", Icon: Wind }, { id: "probability", title: "Peak rain probability", value: `${w.maxRainProbability}%`, sub: "Next 24 hours", Icon: Waves }] : [];
  const selected = signals.find(s => s.id === signal) || signals[0];
  const chosenAlert = alertEvents.find(event => event.id === selectedAlert) || null;
  if (alerts) return <><Heading number="03" title="Alerts" subtitle="Location-filtered NASA EONET and USGS event intelligence" live={live}/><State live={live}/><div className="alert-scope-bar surface"><div><MapPin/><span><b>{scope === "local" ? "Local alerts" : "Global alerts"}</b><small>{scope === "local" ? locationState === "found" && device ? `Within 300 km · ${device[0].toFixed(2)}, ${device[1].toFixed(2)}` : "Waiting for device location" : "Worldwide source events"}</small></span></div><div className="scope-toggle" aria-label="Alert area"><button aria-pressed={scope === "local"} onClick={() => setScope("local")}><LocateFixed/> Local</button><button aria-pressed={scope === "global"} onClick={() => setScope("global")}><Globe2/> Global</button></div></div><div className="warning-layout"><aside className="surface signal-list alert-event-list">{alertBusy ? <div className="alert-loading"><div className="auth-spinner"/><span>Checking {scope} sources…</span></div> : alertEvents.length ? alertEvents.map(event => <button className={selectedAlert === event.id ? "selected" : ""} key={event.id} onClick={() => setSelectedAlert(event.id)}><i className={event.source === "USGS" ? "amber-dot" : "blue-dot"}/><div><b>{event.title}</b><small>{event.category || "Earthquake"} · {event.source}</small></div>{scope === "local" && <strong>{event.distanceKm} km</strong>}<ChevronRight/></button>) : <Empty title={scope === "local" ? "No local source events" : "No global source events"} copy={alertMessage || "The connected sources returned no events."}/>}<p className="signal-note">Local view uses source coordinates within 300 km of the device. These are NASA/USGS source events, not government-issued emergency alerts.</p></aside><section className="surface warning-detail">{chosenAlert ? <><header><div><h2>{chosenAlert.title}</h2><p>{chosenAlert.category || "Earthquake"} · {chosenAlert.source}</p></div><Pill tone={chosenAlert.source === "USGS" ? "amber" : "blue"}>{scope === "local" && chosenAlert.distanceKm != null ? `${chosenAlert.distanceKm} KM` : "SOURCE EVENT"}</Pill></header><div className="detail-map"><OperationalMap points={alertEvents} selected={chosenAlert} global={scope === "global"} followDevice={scope === "local"} onSelect={event => setSelectedAlert(event.id)}/></div><dl className="alert-facts"><dt>Observed</dt><dd>{chosenAlert.date || chosenAlert.time ? new Date(chosenAlert.date || chosenAlert.time || "").toLocaleString("en-IN") : "Not supplied"}</dd><dt>Coordinates</dt><dd>{chosenAlert.coordinates?.slice(0, 2).map(value => value.toFixed(3)).join(", ") || "Not supplied"}</dd><dt>Distance</dt><dd>{chosenAlert.distanceKm != null ? `${chosenAlert.distanceKm} km from device` : "Global view"}</dd></dl>{safeLink(chosenAlert.link) && <a className="button subtle" href={chosenAlert.link} target="_blank" rel="noreferrer">Open original source <ArrowUpRight/></a>}</> : <><header><div><h2>{scope === "local" ? "Local alert area" : "Global alert overview"}</h2><p>{scope === "local" ? "Device-centered 300 km radius" : "NASA EONET and significant USGS events"}</p></div><Pill tone={alertEvents.length ? "blue" : "muted"}>{alertEvents.length} EVENTS</Pill></header><div className="detail-map"><OperationalMap points={alertEvents} global={scope === "global"} followDevice={scope === "local"} onSelect={event => setSelectedAlert(event.id)}/></div>{alertMessage && <div className="local-alert-message"><ShieldCheck/><p>{alertMessage}</p>{scope === "local" && locationState === "unavailable" && <button className="button subtle" onClick={requestLocation}>Retry location</button>}</div>}<div className="review-box"><ShieldCheck/><div><b>No official emergency alert feed connected</b><p>Sarathi reports only the source events returned by NASA EONET and USGS. Follow local authorities for actionable warnings.</p></div><a className="button subtle" href="/sources">Inspect sources</a></div></>}</section></div></>;
  return <><Heading number="03" title="Warnings" subtitle="API-sourced weather signals and forecast outlook" live={live}/><State live={live}/><div className="warning-toolbar"><div className="segmented"><button aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All signals <b>{signals.length}</b></button><button aria-pressed={filter === "rain"} onClick={() => { setFilter("rain"); setSignal("rain"); }}>Rainfall</button><button aria-pressed={filter === "wind"} onClick={() => { setFilter("wind"); setSignal("wind"); }}>Wind</button></div><a href="/alerts">Alert status<ChevronRight/></a></div><div className="warning-layout"><aside className="surface signal-list">{signals.filter(s => filter === "all" || (filter === "rain" ? s.id !== "wind" : s.id === "wind")).map(s => <button className={signal === s.id ? "selected" : ""} key={s.id} onClick={() => setSignal(s.id)}><s.Icon/><div><b>{s.title}</b><small>{s.sub}</small></div><strong>{s.value}</strong></button>)}{!w && <Empty title="Weather unavailable" copy="No weather values are shown until the provider returns usable data."/>}<p className="signal-note">Every value above comes from Open-Meteo. No official warning feed is connected, so Sarathi does not assign a warning severity.</p></aside><section className="surface warning-detail"><header><div><h2>{selected?.title || "Awaiting weather source"}</h2><p>Chennai, Tamil Nadu</p></div><Pill>{selected?.value || "UNAVAILABLE"}</Pill></header><div className="detail-map"><OperationalMap/></div><div className="detail-tabs">{["Forecast", "Data", "Sources"].map(t => <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>{t}</button>)}</div>{tab === "Forecast" ? w ? <RainChart hours={w.hourly}/> : <Empty title="Forecast unavailable" copy="Retry the weather provider."/> : tab === "Data" ? <div className="assessment">{w ? <><Metric label="Current precipitation" value={w.precipitationNow ?? "Unavailable"} unit={w.precipitationNow == null ? "" : "mm"}/><p>Current precipitation, forecast rainfall, wind and probability are displayed exactly from the connected weather response or totals calculated from its hourly series. No risk score is inferred.</p></> : <Empty title="Weather unavailable" copy="No measurements are available."/>}</div> : <div className="provenance"><a href="https://open-meteo.com/en/docs" target="_blank" rel="noreferrer">Open-Meteo forecast documentation <ArrowUpRight/></a><p>Retrieved {time(live.data?.fetchedAt)} IST. No official alert, exposure, flood extent or river-level feed is connected.</p></div>}</section></div></>;
}

function Agents({ live, detail }: { live: Live; detail?: string }) {
  const [filter, setFilter] = useState("all");
  const agents = live.data?.agents || [];
  const chosen = agents.find(a => a.slug === detail);
  return <><Heading number="04" title={chosen?.name || "Intelligence Agents"} subtitle="Selective specialist routing, shared evidence and bounded synthesis" live={live}/><State live={live}/>{detail ? chosen ? <><a href="/agents" className="back-link">All agents</a><section className="surface agent-output"><header><h2>{chosen.name}</h2><Pill tone={chosen.status === "LIVE" ? "green" : "muted"}>{chosen.status === "LIVE" ? "CONNECTED" : "UNAVAILABLE"}</Pill></header><Metric label={chosen.metric} value={chosen.status === "LIVE" ? chosen.value : "Unavailable"}/><dl><dt>Provider</dt><dd>{chosen.source}</dd><dt>Retrieved</dt><dd>{chosen.status === "LIVE" ? time(live.data?.fetchedAt) + " IST" : "Not retrieved"}</dd></dl><h3>Output provenance</h3><p>{chosen.status === "LIVE" ? "This specialist writes a structured evidence item from the named provider into the shared incident state. A failed or incomplete response leaves the capability unavailable." : "No verified provider output is connected for this capability, so Sarathi shows no value."}</p><a href="/sources" className="button subtle">Inspect source health</a></section></> : !live.busy && <Empty title="Capability not found" copy="Open the agents page to select a connected capability."/> : <><div className="coordinator surface"><Network/><div><h2>Sarathi coordinator</h2><p>Question → selective routing → parallel evidence → verification → one bounded explanation call</p></div><Pill>MAX 4 SPECIALISTS</Pill></div><div className="ai-pipeline surface"><span><b>01</b>Orchestrator<small>Keyword and intent routing</small></span><ChevronRight/><span><b>02</b>Specialists<small>Real APIs + official guidance</small></span><ChevronRight/><span><b>03</b>Verification<small>Source and payload checks</small></span><ChevronRight/><span><b>04</b>Explanation<small>1 call · 600 output tokens</small></span></div><div className="agent-toolbar"><span>Live-data specialists</span><select aria-label="Filter agents" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All agents</option><option value="live">Connected only</option><option value="unavailable">Unavailable only</option></select></div><div className="agents-grid">{agents.filter(a => filter === "all" || (filter === "live" ? a.status === "LIVE" : a.status !== "LIVE")).map(a => <a href={`/agents/${a.slug}`} className="surface specialist" key={a.slug}><header><h3>{a.name}</h3><Pill tone={a.status === "LIVE" ? "green" : "muted"}>{a.status === "LIVE" ? "CONNECTED" : "UNAVAILABLE"}</Pill></header><strong>{a.status === "LIVE" ? a.value : "—"}</strong><p>{a.metric}</p><footer><span>{a.source}<small>{a.status === "LIVE" ? `Last retrieved ${time(live.data?.fetchedAt)} IST` : "No source data"}</small></span><ArrowUpRight/></footer></a>)}</div>{!live.busy && !agents.length && <Empty title="No agent output" copy="Retry the source connections to inspect current outputs."/>}<div className="capability-note"><ShieldCheck/><p>Each Ask run shows the agents selected, evidence used, verification result and token budget. Risk scoring, shelter routing and alert delivery remain unavailable until verified providers are connected.</p><a href="/ask">Run a multi-agent query <ArrowUpRight/></a></div></>}</>;
}

function Sitrep({ live }: { live: Live }) {
  const [report, setReport] = useState<Snapshot | null>(null); const [generated, setGenerated] = useState(false);
  const current = report || live.data;
  async function generate() { await live.refresh(); setGenerated(true); setReport(null); }
  function download() {
    if (!current) return;
    const w = current.weather;
    const text = `SARATHI SOURCE SNAPSHOT\nChennai, Tamil Nadu\nRetrieved: ${current.fetchedAt}\n\nWEATHER\n${w ? `Temperature: ${w.temperature} C\nModelled precipitation last 24h: ${w.rain24h} mm\nForecast precipitation next 24h: ${w.rainNext24h} mm\nWind: ${w.windSpeed} km/h` : "Weather unavailable."}\n\nSOURCES\n${current.sources.map(s => `${s.name}: ${s.status}`).join("\n")}\n\nLIMITATIONS\nNo verified risk assessment, official warning, exposure estimate, flood extent or shelter feed is connected.`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" })); const a = document.createElement("a"); a.href = url; a.download = `sarathi-sitrep-${new Date().toISOString().slice(0, 10)}.txt`; a.click(); URL.revokeObjectURL(url); setReport(current);
  }
  return <><Heading number="05" title="Situation Report" subtitle="Source-attributed situational awareness"/><div className="report-actions"><span role="status">{generated ? "Report refreshed from the latest available snapshot." : "Current operational snapshot"}</span><button className="button subtle" disabled={!current || live.busy} onClick={download}><Download/> Download report</button><button className="button primary" disabled={live.busy} onClick={generate}><RefreshCw className={live.busy ? "spinning" : ""}/>{live.busy ? "Generating…" : "Generate new"}</button></div><State live={live}/><div className="report-layout"><aside className="surface report-index"><FileText/><b>Current SITREP</b><strong>{time(current?.fetchedAt)}</strong><small>Chennai · India</small><a href="#summary">Executive summary</a><a href="#outlook">Weather outlook</a><a href="#evidence">Source evidence</a></aside><article className="surface report-document"><header><span className="eyebrow">SITUATION REPORT</span><Pill>{current ? "SOURCE SNAPSHOT" : "AWAITING DATA"}</Pill></header><h2>Chennai</h2><p className="report-date">{current ? new Date(current.fetchedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST" : "Waiting for providers"}</p><section id="summary"><h3>Executive summary</h3><p>{current?.weather ? `Open-Meteo reports ${current.weather.temperature}°C and ${current.weather.windSpeed} km/h wind for Chennai. Modelled precipitation totals ${current.weather.rain24h} mm over the past 24 hours. The next 24-hour forecast totals ${current.weather.rainNext24h} mm with a peak precipitation probability of ${current.weather.maxRainProbability}%.` : "Weather information is unavailable. This report cannot assess local conditions until the provider responds."}</p><div className="report-stats"><Metric label="Precipitation / 24h" value={current?.weather?.rain24h ?? "—"} unit="mm"/><Metric label="Forecast / 24h" value={current?.weather?.rainNext24h ?? "—"} unit="mm"/><Metric label="Connected sources" value={current?.sources.filter(s => s.status === "live").length ?? "—"}/></div></section><section id="outlook"><h3>Weather outlook</h3>{current?.weather ? <RainChart hours={current.weather.hourly}/> : <p>Forecast unavailable.</p>}</section><section id="evidence"><h3>Source evidence</h3>{current?.sources.map(s => <div className="evidence-row" key={s.name}><span>{s.name}</span><Pill tone={s.status === "live" ? "green" : "muted"}>{s.status}</Pill></div>)}<p className="report-limits">No local flood extent, population exposure or verified shelter data is connected. This report does not establish an emergency or replace an official advisory.</p></section></article></div></>;
}

type Answer = {
  answer?: string | null;
  message?: string;
  fetchedAt?: string;
  runId?: string;
  ai?: { status: "available" | "unavailable" | "error"; model: string | null; error?: string | null };
  selectedAgents?: string[];
  verification?: { status: string; meaning: string; evidenceItems: number; unavailableSources: string[] };
  evidence?: { citation: number; source: string; authority: string; summary: string; url?: string | null }[];
  usage?: { llmCalls: number; inputTokens: number; outputTokens: number; totalTokens: number; limits: { maxLlmCalls: number; maxInputTokens: number; maxOutputTokens: number; maxTotalTokens: number } };
  durationMs?: number;
  backend?: "python" | "typescript-fallback";
  backendError?: string;
};
function Ask() {
  const [query, setQuery] = useState(""); const [busy, setBusy] = useState(false); const [answer, setAnswer] = useState<Answer | null>(null);
  async function submit(text: string) { if (busy || !text.trim()) return; setQuery(text); setBusy(true); setAnswer(null); try { const response = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: text }) }); setAnswer(await response.json()); } catch { setAnswer({ message: "The assistant service is unavailable. Please try again." }); } finally { setBusy(false); } }
  const aiTone = answer?.ai?.status === "available" ? "green" : answer?.ai?.status === "error" ? "amber" : "muted";
  return <><Heading number="06" title="Ask" subtitle="Bounded multi-agent synthesis over live, source-attributed evidence"/><div className="assistant"><div className="assistant-mark"><Zap/></div><h2>Ask SARATHI</h2><p>The Python orchestrator selects relevant specialists, verifies their evidence, and enforces one shared token budget.</p><form onSubmit={e => { e.preventDefault(); void submit(query); }}><input aria-label="Ask Sarathi" value={query} onChange={e => setQuery(e.target.value)} placeholder="Ask about the current situation…"/><button disabled={busy || !query.trim()} aria-label="Send question">{busy ? <RefreshCw className="spinning"/> : <Send/>}</button></form><div className="suggestions">{["What is the weather in Chennai?", "What rainfall is forecast?", "Show recent earthquakes", "What should I do during a flood warning?"].map(q => <button key={q} disabled={busy} onClick={() => submit(q)}>{q}</button>)}</div><div aria-live="polite">{busy && <p className="answer-loading">Routing specialists and retrieving current evidence…</p>}{answer && <article className="surface answer"><header><Zap/><b>SARATHI</b>{answer.backend && <Pill tone={answer.backend === "python" ? "green" : "amber"}>{answer.backend === "python" ? "PYTHON CORE" : "LOCAL FALLBACK"}</Pill>}{answer.ai && <Pill tone={aiTone}>{answer.ai.status === "available" ? `AI · ${answer.ai.model}` : answer.ai.status === "error" ? "AI ERROR" : "AI UNAVAILABLE"}</Pill>}<span>{time(answer.fetchedAt)}</span></header><p>{answer.answer || answer.message}</p>{answer.selectedAgents?.length ? <section className="agent-trace"><h3>Agent run</h3><div className="routing-tags">{answer.selectedAgents.map(agent => <Pill key={agent}>{agent}</Pill>)}</div></section> : null}{answer.evidence?.length ? <section className="evidence-list"><h3>Evidence used</h3>{answer.evidence.map(item => <div key={`${item.citation}-${item.source}`}><b>[{item.citation}] {safeLink(item.url || undefined) ? <a href={item.url || undefined} target="_blank" rel="noreferrer">{item.source}</a> : item.source}</b><span>{item.authority}</span><p>{item.summary}</p></div>)}</section> : null}{answer.verification && <p className="verification"><ShieldCheck/><span><b>{answer.verification.status.replaceAll("_", " ")}</b>{answer.verification.meaning}</span></p>}{answer.usage && <div className="run-metrics"><span>Calls <b>{answer.usage.llmCalls}/{answer.usage.limits.maxLlmCalls}</b></span><span>Input <b>{answer.usage.inputTokens}/{answer.usage.limits.maxInputTokens}</b></span><span>Output <b>{answer.usage.outputTokens}/{answer.usage.limits.maxOutputTokens}</b></span><span>Total <b>{answer.usage.totalTokens}/{answer.usage.limits.maxTotalTokens}</b></span><span>Runtime <b>{answer.durationMs ?? 0} ms</b></span></div>}{answer.ai?.error && <p className="ai-limitation">{answer.ai.error} Live evidence remains visible; no generated claim was substituted.</p>}{answer.backendError && <p className="ai-limitation">Python backend unavailable: {answer.backendError}</p>}</article>}</div></div></>;
}

function About() {
  useScrollReveal();
  return <div className="about-page">
    <section className="about-hero" data-reveal data-slide="left"><span className="eyebrow">ABOUT SARATHI</span><h1>Intelligence that helps people<br/><em>act before a crisis escalates.</em></h1><p>Sarathi is a multi-agent disaster intelligence workspace for situation awareness, early warning review and clear public-safety answers. It joins current public data with specialist agents while keeping every claim tied to evidence.</p><div><a className="button primary" href="/command">Open command center <ArrowUpRight/></a><a className="button subtle" href="/ask">Ask Sarathi</a></div></section>
    <section className="about-principles" data-reveal data-slide="right"><article><span>01</span><ShieldCheck/><h2>Evidence first</h2><p>Measurements appear only after a provider returns usable data. Missing sources remain visibly unavailable, and generated answers retain citations and limits.</p></article><article><span>02</span><Network/><h2>Specialists together</h2><p>Weather, climate, seismic, news and event agents work within their own scopes, then submit compact findings to one coordinating agent.</p></article><article><span>03</span><UserRound/><h2>Human controlled</h2><p>Sarathi prepares intelligence for review. It does not invent official alerts, evacuation routes, shelter capacity or emergency declarations.</p></article></section>
    <section className="about-architecture" data-reveal data-slide="left"><div><span className="eyebrow">HOW IT WORKS</span><h2>One question.<br/>A traceable agent run.</h2><p>The router reads the task, selects only relevant specialists and retrieves their current sources in parallel. A verification gate checks the shared evidence before a bounded central synthesis. The result exposes agents, sources, limitations, runtime and token use.</p></div><div className="architecture-stack"><span>01 · REQUEST ROUTER</span><span>02 · LIVE DATA ADAPTERS</span><span>03 · SPECIALIST AGENTS</span><span>04 · EVIDENCE GATE</span><strong>05 · SARATHI CENTRAL</strong></div></section>
    <section className="about-values" data-reveal data-slide="right"><span className="eyebrow">DESIGNED FOR REAL CONDITIONS</span><h2>Useful online. Explicit when offline.</h2><p>The backend can run from the terminal, cache recent source responses, operate in a no-AI evidence mode, and cap model calls and tokens by profile. This keeps the platform usable when bandwidth, provider access or AI credits are limited.</p><div><a href="/sources">Inspect data sources <ChevronRight/></a><a href="/agents">See the agent team <ChevronRight/></a><a href="/system">Check system health <ChevronRight/></a></div></section>
  </div>;
}

type TurnstileApi = { render: (element: HTMLElement, options: Record<string, unknown>) => string; remove: (id: string) => void };

function Captcha({ onToken }: { onToken: (token: string) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
  useEffect(() => {
    if (!siteKey || !host.current) return;
    let widget = "";
    let cancelled = false;
    const render = () => {
      const api = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
      if (!api || !host.current || cancelled || host.current.childElementCount) return;
      widget = api.render(host.current, {
        sitekey: siteKey, theme: "dark", size: "flexible",
        callback: (token: string) => onToken(token),
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
      });
    };
    const existing = document.querySelector<HTMLScriptElement>('script[data-sarathi-turnstile]');
    if (existing) { if ((window as unknown as { turnstile?: TurnstileApi }).turnstile) render(); else existing.addEventListener("load", render, { once: true }); }
    else {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true; script.defer = true; script.dataset.sarathiTurnstile = "true";
      script.addEventListener("load", render, { once: true }); document.head.appendChild(script);
    }
    return () => { cancelled = true; const api = (window as unknown as { turnstile?: TurnstileApi }).turnstile; if (api && widget) api.remove(widget); };
  }, [siteKey, onToken]);
  if (!siteKey) return <div className="captcha-missing"><KeyRound/><span>CAPTCHA is not configured. Add the public Turnstile site key to enable account access.</span></div>;
  return <div className="captcha-box"><div ref={host}/></div>;
}

function Login() { return <AccountAccess mode="login"/>; }

function AccountAccess({ mode }: { mode: "login" | "signup" }) {
  const auth = useAuth();
  const [access, setAccess] = useState<"user" | "admin">("user");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaAttempt, setCaptchaAttempt] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const captchaConfigured = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const onCaptcha = useCallback((token: string) => setCaptchaToken(token), []);
  const displayName = auth.profile?.full_name || auth.user?.user_metadata?.full_name || auth.user?.email;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setMessage("");
    if (!captchaToken) { setMessage("Complete the CAPTCHA before continuing."); return; }
    if (mode === "signup" && password !== confirmation) { setMessage("Passwords do not match."); return; }
    if (mode === "signup" && password.length < 8) { setMessage("Use at least 8 characters for the password."); return; }
    setSubmitting(true);
    const result = mode === "login"
      ? await auth.signInWithPassword(email, password, captchaToken, access === "admin" ? "/admin" : "/profile")
      : await auth.signUpWithPassword(name, email, password, captchaToken);
    setSubmitting(false);
    if (!result.ok) { setMessage(result.error || "Account request failed."); setCaptchaToken(""); setCaptchaAttempt(value => value + 1); }
    else if (mode === "signup" && "confirmationRequired" in result && result.confirmationRequired) setMessage("Account created. Check your email to confirm it, then sign in.");
  };
  return <div className="login-page"><section className="login-intro"><a href="/" className="login-brand"><Zap/><b>SARATHI</b></a><span className="eyebrow">SECURE OPERATIONS ACCESS</span><h1>{mode === "login" ? <>Return to the<br/><em>response workspace.</em></> : <>Create your<br/><em>Sarathi account.</em></>}</h1><p>Email/password authentication is handled by Supabase. CAPTCHA blocks automated abuse, while server-controlled roles protect model-call and workflow records.</p><div className="login-trust"><span><ShieldCheck/> CAPTCHA protected</span><span><Database/> Supabase identity</span><span><KeyRound/> Server-controlled roles</span></div></section><section className="surface login-panel"><header><span>{mode === "login" ? "SIGN IN" : "CREATE ACCOUNT"}</span><Pill tone="green">SECURE</Pill></header>{auth.loading ? <div className="login-loading"><div className="auth-spinner"/><p>Checking your account…</p></div> : auth.user ? <div className="login-existing"><div className="large-avatar">{(displayName || "U").charAt(0).toUpperCase()}</div><h2>Welcome{displayName ? `, ${displayName}` : ""}</h2><p>{auth.user.email}</p><Pill tone={auth.profile?.role === "admin" ? "amber" : "blue"}>{(auth.profile?.role || "user").toUpperCase()}</Pill><a className="button primary" href={auth.profile?.role === "admin" ? "/admin" : "/profile"}>Continue to workspace <ChevronRight/></a><button className="button ghost" onClick={() => void auth.signOut()}><LogOut/> Use another account</button></div> : <><div className="auth-switch"><a className={mode === "login" ? "active" : ""} href="/login">Sign in</a><a className={mode === "signup" ? "active" : ""} href="/signup">Sign up</a></div><h2>{mode === "login" ? "Access your workspace" : "Create a user account"}</h2><p className="login-copy">{mode === "login" ? "Choose where you are heading. Admin access is allowed only for accounts assigned the admin role in Supabase." : "New accounts start with the user role. An existing administrator can promote a trusted account outside the browser."}</p>{mode === "login" && <div className="access-picker"><button type="button" aria-pressed={access === "user"} onClick={() => setAccess("user")}><UserRound/><span><b>User</b><small>Profile and public-safety workspace</small></span></button><button type="button" aria-pressed={access === "admin"} onClick={() => setAccess("admin")}><ShieldCheck/><span><b>Administrator</b><small>Model calls and full workflows</small></span></button></div>}<form className="auth-form" onSubmit={submit}>{mode === "signup" && <label>Full name<input name="name" autoComplete="name" required maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder="Your name"/></label>}<label>Email address<input type="email" name="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com"/></label><label>Password<input type="password" name="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters"/></label>{mode === "signup" && <label>Confirm password<input type="password" name="confirmation" autoComplete="new-password" required minLength={8} value={confirmation} onChange={event => setConfirmation(event.target.value)} placeholder="Repeat your password"/></label>}<Captcha key={captchaAttempt} onToken={onCaptcha}/><button className="button primary auth-submit" disabled={submitting || !auth.configured || !captchaConfigured || !captchaToken}>{submitting ? "Verifying…" : mode === "login" ? "Sign in securely" : "Create account"}<ChevronRight/></button></form>{!auth.configured && <div className="account-warning"><KeyRound/><span>Account access needs the public Supabase URL and publishable key.</span></div>}{(message || auth.error) && <p className={message.startsWith("Account created") ? "form-success" : "form-error"}>{message || auth.error}</p>}</>}</section></div>;
}

function Profile() {
  const auth = useAuth();
  if (auth.loading) return <div className="account-state"><div className="auth-spinner"/><p>Loading your Sarathi profile…</p></div>;
  if (!auth.user) return <div className="account-shell signed-out"><div className="account-mark"><UserRound/></div><span className="eyebrow">SARATHI ACCOUNT</span><h1>Your operations profile</h1><p>Use the secure login page to create an email/password Sarathi profile.</p><a className="button primary" href="/login">Open login <LogIn/></a></div>;
  const displayName = auth.profile?.full_name || auth.user.user_metadata?.full_name || auth.user.email || "Sarathi user";
  return <><Heading number="09" title="Profile" subtitle="Identity and role for this Sarathi workspace"/><div className="profile-layout"><section className="surface profile-card"><div className="large-avatar">{displayName.charAt(0).toUpperCase()}</div><h2>{displayName}</h2><p>{auth.user.email}</p><Pill tone={auth.profile?.role === "admin" ? "amber" : "blue"}>{(auth.profile?.role || "user").toUpperCase()}</Pill><dl><dt>Authentication</dt><dd>Email/password via Supabase</dd><dt>Profile storage</dt><dd>{auth.profile ? "Connected" : "Migration required"}</dd><dt>Account ID</dt><dd>{auth.user.id.slice(0, 8)}…</dd></dl>{auth.profile?.role === "admin" && <a href="/admin" className="button subtle"><ShieldCheck/> Open admin profile</a>}<button className="button ghost" onClick={() => void auth.signOut()}><LogOut/> Sign out</button></section><ProfileEditor key={`${auth.user.id}-${auth.profile?.full_name || ""}`} auth={auth}/></div></>;
}

function ProfileEditor({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const [name, setName] = useState(auth.profile?.full_name || "");
  const [saved, setSaved] = useState(false);
  return <section className="surface profile-editor"><span className="eyebrow">PERSONAL DETAILS</span><h2>Profile information</h2><p>Your verified email identifies the account. You can change the display name shown inside Sarathi.</p><form onSubmit={async e => { e.preventDefault(); setSaved(await auth.updateName(name)); }}><label>Display name<input value={name} maxLength={100} onChange={e => { setName(e.target.value); setSaved(false); }}/></label><label>Email<input value={auth.user?.email || ""} disabled/></label><button className="button primary" disabled={!auth.profile || !name.trim()}>Save profile</button>{saved && <span className="save-success">Profile saved.</span>}</form>{auth.error && <p className="form-error">{auth.error}</p>}<p className="profile-security"><ShieldCheck/> Roles are controlled in Supabase. A user cannot promote their own account.</p></section>;
}

type RunMetrics = { latency_ms?: number; input_tokens?: number; output_tokens?: number; total_tokens?: number; cached_input_tokens?: number | null; reasoning_tokens?: number | null; input_count_exact?: boolean };
type RunAgent = { id?: string; name?: string; status?: string; ai_status?: string; selected_for_ai?: boolean; source?: string; source_status?: string; model?: string | null; metrics?: RunMetrics | null; report?: string; error?: string | null };
type RunPayload = { run_id?: string; generated_at?: string; duration_ms?: number; profile?: string; connectivity?: string; context?: { query?: string; location?: string }; ai?: { requested?: boolean; available?: boolean; default_model?: string }; source_health?: Record<string, { status?: string; error?: string | null }>; agents?: RunAgent[]; central?: RunAgent; token_usage?: { model_calls?: number; input_tokens?: number; output_tokens?: number; total_tokens?: number; limits?: Record<string, number>; by_agent?: Array<Record<string, unknown>> }; supabase?: { status?: string; synced?: boolean; pending_runs?: number; error?: string | null } };
type StoredRun = { run_id: string; generated_at: string; profile?: string; connectivity?: string; location?: string; query?: string; ai_status?: string; payload?: RunPayload };

function Admin({ live }: { live: Live }) {
  const auth = useAuth();
  if (auth.loading) return <div className="account-state"><div className="auth-spinner"/><p>Verifying admin role…</p></div>;
  if (!auth.user) return <div className="account-shell signed-out"><div className="account-mark"><ShieldCheck/></div><span className="eyebrow">ADMIN PROFILE</span><h1>Administrator access</h1><p>Sign in with an email/password account that has been assigned the admin role in Supabase.</p><a className="button primary" href="/login">Open admin login <LogIn/></a></div>;
  if (auth.profile?.role !== "admin") return <div className="account-shell denied"><div className="account-mark"><KeyRound/></div><span className="eyebrow">ACCESS CONTROL</span><h1>Admin role required</h1><p>{auth.user.email} is signed in as a user. An existing administrator must assign the admin role from a trusted Supabase service context.</p><a className="button subtle" href="/profile">Return to profile</a></div>;
  return <AdminDashboard live={live}/>;
}

function AdminDashboard({ live }: { live: Live }) {
  const auth = useAuth();
  const [runs, setRuns] = useState<StoredRun[]>([]);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setBusy(true); setError("");
    const token = await auth.getAccessToken();
    if (!token) { setError("The admin session is unavailable. Sign in again."); setBusy(false); return; }
    try {
      const response = await fetch("/api/admin/runs?limit=25", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const data = await response.json() as { runs?: StoredRun[]; message?: string };
      if (!response.ok) throw new Error(data.message || "Recorded workflows could not be loaded.");
      setRuns(data.runs || []); setSelected(0);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Recorded workflows could not be loaded."); }
    finally { setBusy(false); }
  }, [auth]);
  useEffect(() => {
    // The first authenticated load shares the manual refresh path.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  const run = runs[selected];
  const payload = run?.payload || {};
  const calls: RunAgent[] = run ? [...(payload.agents || []), { ...(payload.central || {}), id: "central", name: "Sarathi Central" }] : [];
  const actualCalls = calls.filter(call => call.metrics || call.model);
  const totalTokens = runs.reduce((sum, item) => sum + Number(item.payload?.token_usage?.total_tokens || 0), 0);
  const liveSources = live.data?.sources.filter(source => source.status === "live").length ?? 0;
  const download = () => {
    if (!run) return;
    const blob = new Blob([JSON.stringify(run.payload || run, null, 2)], { type: "application/json" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `sarathi-${run.run_id}.json`; link.click(); URL.revokeObjectURL(link.href);
  };
  return <><Heading number="10" title="Admin operations" subtitle="Recorded model calls, token use and end-to-end agent workflows"/><div className="admin-banner"><ShieldCheck/><div><b>Administrator verified</b><p>{auth.profile?.full_name || auth.user?.email} · Server-verified Supabase role</p></div><button className="button subtle" onClick={() => void load()} disabled={busy}><RefreshCw className={busy ? "spinning" : ""}/> Refresh records</button></div><div className="admin-summary"><article className="surface"><Database/><span>Recorded runs</span><strong>{busy ? "—" : runs.length}</strong></article><article className="surface"><Cpu/><span>Model calls</span><strong>{runs.reduce((sum, item) => sum + Number(item.payload?.token_usage?.model_calls || 0), 0)}</strong></article><article className="surface"><Braces/><span>Total tokens</span><strong>{totalTokens.toLocaleString()}</strong></article><article className="surface"><Activity/><span>Live sources now</span><strong>{live.busy ? "—" : liveSources}</strong></article></div>{error && <div className="notice failure"><Database/><span>{error}</span><button onClick={() => void load()}>Retry</button></div>}{busy ? <div className="admin-empty"><div className="auth-spinner"/><p>Loading recorded workflows…</p></div> : !runs.length && !error ? <div className="admin-empty"><Database/><h2>No recorded workflows</h2><p>Run the backend and complete the Supabase storage migrations. Sarathi will show real run records here; it does not create sample calls.</p></div> : run && <div className="admin-console"><aside className="surface run-list"><header><span>RUN HISTORY</span><small>{runs.length} loaded</small></header>{runs.map((item, index) => <button key={item.run_id} aria-pressed={selected === index} onClick={() => setSelected(index)}><i/><span><b>{item.query || item.payload?.context?.query || "Untitled run"}</b><small>{new Date(item.generated_at).toLocaleString("en-IN")}</small></span><em>{item.ai_status || item.payload?.central?.status || "recorded"}</em></button>)}</aside><main className="admin-detail"><section className="surface run-header"><div><span className="eyebrow">SELECTED WORKFLOW</span><h2>{run.query || payload.context?.query || "Untitled run"}</h2><p>{payload.context?.location || run.location || "Location unavailable"} · {run.run_id}</p></div><button className="button subtle" onClick={download}><Download/> JSON</button><dl><dt>Started</dt><dd>{new Date(run.generated_at).toLocaleString("en-IN")}</dd><dt>Runtime</dt><dd>{payload.duration_ms != null ? `${payload.duration_ms.toLocaleString()} ms` : "Unavailable"}</dd><dt>Profile</dt><dd>{payload.profile || run.profile || "—"}</dd><dt>Connectivity</dt><dd>{payload.connectivity || run.connectivity || "—"}</dd></dl></section><section className="surface workflow-view"><header><div><GitBranch/><span><b>Execution workflow</b><small>Recorded stage outputs and status; private model reasoning is not stored.</small></span></div></header><div className="workflow-track">{[["01","Request accepted",payload.context?.query || run.query],["02","Router selected agents",`${(payload.agents || []).filter(agent => agent.selected_for_ai).length} selected for AI`],["03","Sources collected",Object.entries(payload.source_health || {}).map(([key,value]) => `${key}: ${value.status || "unknown"}`).join(" · ") || "No source health recorded"],["04","Specialists executed",`${payload.agents?.length || 0} agents recorded`],["05","Central synthesis",payload.central?.status || "not recorded"],["06","Storage checkpoint",payload.supabase?.status || "recorded in Supabase"]].map(([step,title,copy]) => <article key={step}><span>{step}</span><div><b>{title}</b><p>{copy}</p></div></article>)}</div></section><section className="model-calls"><header><div><Cpu/><span><b>Model and agent calls</b><small>{actualCalls.length} model stages · {Number(payload.token_usage?.total_tokens || 0).toLocaleString()} total tokens</small></span></div></header><div className="call-grid">{calls.map(call => <article className="surface call-card" key={call.id || call.name}><header><span><b>{call.name || call.id || "Agent"}</b><small>{call.source || (call.id === "central" ? "Coordinator" : "Source unavailable")}</small></span><Pill tone={call.status === "failed" ? "red" : call.status === "completed" ? "green" : "muted"}>{call.status || call.ai_status || "not run"}</Pill></header><dl><dt>Model</dt><dd>{call.model || "No model call"}</dd><dt>Latency</dt><dd>{call.metrics?.latency_ms != null ? `${call.metrics.latency_ms} ms` : "—"}</dd><dt>Input</dt><dd>{call.metrics?.input_tokens?.toLocaleString() || "—"}</dd><dt>Output</dt><dd>{call.metrics?.output_tokens?.toLocaleString() || "—"}</dd><dt>Total</dt><dd>{call.metrics?.total_tokens?.toLocaleString() || "—"}</dd><dt>Count</dt><dd>{call.metrics ? call.metrics.input_count_exact ? "Exact" : "Estimated" : "—"}</dd></dl>{call.error && <p className="call-error">{call.error}</p>}<details><summary>Recorded output</summary><pre>{call.report || "No report stored for this stage."}</pre></details></article>)}</div></section></main></div>}<section className="surface admin-note"><KeyRound/><div><h2>Roles and secrets stay server-side</h2><p>New signups receive the user role. Promote administrators only through a trusted Supabase service context. The browser receives public configuration and a short-lived user session; workflow access is checked again by the admin API.</p></div></section></>;
}

function Sources({ live, system }: { live: Live; system: boolean }) { return <><Heading number={system ? "08" : "07"} title={system ? "System health" : "Sources"} subtitle="Current connection status and source provenance" live={live}/><State live={live}/><div className="sources-grid">{live.data?.sources.map(s => <article className="surface provider" key={s.name}><header><Activity/><Pill tone={s.status === "live" ? "green" : "muted"}>{s.status}</Pill></header><h2>{s.name}</h2><p>{s.authority}</p><dl><dt>Retrieved</dt><dd>{s.status === "live" ? time(s.fetchedAt) + " IST" : "Unavailable"}</dd></dl>{s.message && <p>{s.message}</p>}<a href={s.name === "Open-Meteo" ? "https://open-meteo.com/en/docs" : s.name === "EONET" ? "https://eonet.gsfc.nasa.gov/docs/v3" : "https://earthquake.usgs.gov/earthquakes/feed/"} target="_blank" rel="noreferrer">Source documentation <ArrowUpRight/></a></article>)}</div><div className="capability-note"><ShieldCheck/><p>Only successful provider responses produce measurements. Empty successful event feeds and unavailable feeds are shown separately.</p></div></>; }
function Empty({ title, copy }: { title: string; copy: string }) { return <div className="empty"><Activity/><h3>{title}</h3><p>{copy}</p></div>; }

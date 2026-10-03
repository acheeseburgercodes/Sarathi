"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowUpRight, BellRing, Bot, Check, ChevronRight,
  CircleDot, Clock3, CloudRain, FileText, HeartPulse, MapPin, MessageCircle,
  Radio, RefreshCw, Route, Satellite, Send, ShieldCheck, Sparkles, Users, Waves, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

type PipelineState = "complete" | "active" | "queued";
const agents: Array<{ id:string; name:string; role:string; icon:typeof Bot; state:PipelineState; note:string }> = [
  { id:"01", name:"Drishti", role:"Signal scout", icon:Satellite, state:"complete", note:"17 sources ingested" },
  { id:"02", name:"Satya", role:"Evidence verifier", icon:ShieldCheck, state:"complete", note:"Confidence: 91%" },
  { id:"03", name:"Nirikshak", role:"Impact analyst", icon:Activity, state:"active", note:"3 zones modelled" },
  { id:"04", name:"Vaani", role:"SITREP writer", icon:FileText, state:"queued", note:"Awaiting impact brief" },
  { id:"05", name:"Rakshak", role:"Alert composer", icon:BellRing, state:"queued", note:"Human approval required" },
];
const feed = [
  { time:"08:42", source:"IMD radar", text:"Rain band intensifying over the Mandovi basin", level:"verified" },
  { time:"08:39", source:"River gauge G-14", text:"Water level +0.41 m in 30 minutes", level:"verified" },
  { time:"08:35", source:"Field team 3", text:"Waterlogging reported near Ribandar causeway", level:"corroborating" },
  { time:"08:31", source:"Public signal", text:"12 clustered reports from low-lying wards", level:"unverified" },
];
const areas = [
  { name:"Ribandar", color:"#f75f4b", x:72, y:44 },
  { name:"Panaji East", color:"#f4a23a", x:47, y:54 },
  { name:"Merces", color:"#d8b83d", x:61, y:72 },
];
const publicReplies: Record<string,string> = {
  evacuation:"Move toward the Campal indoor stadium shelter via the DB Road corridor. Avoid the Ribandar causeway. Carry medicines, identity documents, water, and a phone charger.",
  shelter:"The nearest open shelter in this exercise is Campal indoor stadium, 2.1 km away. It has medical support, drinking water, and accessible entry.",
  help:"If there is immediate danger, call 112. Share your landmark, the number of people with you, and whether anyone needs medical or mobility support.",
};

export default function Home() {
  const [activeView,setActiveView] = useState("Command overview");
  const [assistantOpen,setAssistantOpen] = useState(false);
  const [alertStatus,setAlertStatus] = useState<"draft"|"approved">("draft");
  const [reply,setReply] = useState("Ask a question or choose a quick action below.");
  const [query,setQuery] = useState("");
  const [lastRefresh,setLastRefresh] = useState("08:44:12");
  const activeAgent = useMemo(() => agents.find((agent) => agent.state === "active"), []);

  function askAssistant(prompt:string) {
    const normalized = prompt.toLowerCase();
    const key = normalized.includes("evac") ? "evacuation" : normalized.includes("shelter") ? "shelter" : "help";
    setReply(publicReplies[key]); setQuery("");
  }

  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool?: (tool:unknown, options?:unknown) => void|Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name:"open_public_assistant", title:"Open public crisis assistant",
      description:"Open Sarathi's public guidance panel and show help for evacuation, shelter, or emergency assistance.",
      inputSchema:{ type:"object", properties:{ topic:{ type:"string", enum:["evacuation","shelter","help"] } }, required:["topic"], additionalProperties:false },
      annotations:{ readOnlyHint:false, untrustedContentHint:false },
      execute(input:unknown) {
        const topic=(input as {topic?:string})?.topic;
        if (!topic || !(topic in publicReplies)) throw new Error("Choose evacuation, shelter, or help.");
        setAssistantOpen(true); setReply(publicReplies[topic]);
        return { opened:true, topic, guidance:publicReplies[topic] };
      },
    }, {signal:lifecycle.signal})).catch(() => undefined);
    return () => lifecycle.abort();
  },[]);

  return <main className="min-h-screen bg-[#07110f] text-[#eef5ee]">
    <div className="exercise-strip">EXERCISE MODE · SIMULATED INCIDENT DATA · DO NOT DISTRIBUTE AS A REAL ALERT</div>
    <header className="topbar">
      <div className="brand-block"><div className="brand-mark" aria-hidden="true"><span>S</span></div><div><p className="brand-name">SARATHI</p><p className="brand-sub">Crisis intelligence network</p></div></div>
      <div className="incident-title"><span className="live-pulse"/><div><p>INC-2026-104 · MONSOON FLOOD</p><strong>North Goa operational area</strong></div></div>
      <div className="top-actions"><button className="sync-button" onClick={() => setLastRefresh(new Date().toLocaleTimeString("en-IN",{hour12:false}))}><RefreshCw size={15}/> Synced {lastRefresh}</button><Button className="public-button" onClick={() => setAssistantOpen(true)}><MessageCircle/> Public assistant</Button></div>
    </header>
    <div className="app-shell">
      <aside className="rail" aria-label="Primary navigation">
        {[{label:"Command overview",icon:CircleDot},{label:"Intelligence",icon:Satellite},{label:"SITREPs",icon:FileText},{label:"Alerts",icon:BellRing},{label:"Resources",icon:Users}].map((item) => { const Icon=item.icon; return <button key={item.label} className={activeView===item.label?"rail-item active":"rail-item"} onClick={() => setActiveView(item.label)}><Icon/><span>{item.label}</span></button>; })}
        <div className="rail-foot"><ShieldCheck/><span>Audit trail<br/><strong>Protected</strong></span></div>
      </aside>
      <section className="workspace">
        <div className="workspace-heading"><div><p className="eyebrow">UNIFIED OPERATING PICTURE</p><h1>{activeView}</h1></div><div className="incident-clock"><Clock3 size={17}/><span>Incident active</span><strong>03h 18m</strong></div></div>
        <div className="kpi-grid">
          <Metric icon={AlertTriangle} label="Threat level" value="SEVERE" meta="Escalated 12 min ago" tone="danger"/>
          <Metric icon={Users} label="People at risk" value="15,170" meta="Across 3 priority zones" tone="amber"/>
          <Metric icon={Route} label="Open shelters" value="6 / 8" meta="1,840 spaces available" tone="teal"/>
          <Metric icon={HeartPulse} label="Response readiness" value="82%" meta="14 teams deployed" tone="blue"/>
        </div>
        <div className="dashboard-grid">
          <section className="panel map-panel">
            <PanelTitle eyebrow="RISK PICTURE" title="Flood impact forecast" aside={<span className="model-chip"><CloudRain size={14}/> Nowcast · 90 min</span>}/>
            <div className="map-canvas">
              <svg viewBox="0 0 800 390" role="img" aria-label="Schematic risk map of affected areas in North Goa">
                <defs><pattern id="grid" width="38" height="38" patternUnits="userSpaceOnUse"><path d="M 38 0 L 0 0 0 38" fill="none" stroke="#23403a" strokeWidth="1"/></pattern><filter id="glow"><feGaussianBlur stdDeviation="9" result="blur"/></filter></defs>
                <rect width="800" height="390" fill="url(#grid)"/><path d="M-20 275 C110 205 185 310 310 225 S540 175 830 80" fill="none" stroke="#235e68" strokeWidth="28" opacity=".65"/><path d="M-20 275 C110 205 185 310 310 225 S540 175 830 80" fill="none" stroke="#55b5c1" strokeWidth="3" opacity=".8"/><path d="M80 80 L210 64 320 118 445 75 585 120 700 225 650 333 490 340 355 298 205 330 92 245Z" fill="#0b1c19" stroke="#38534d" strokeWidth="2"/>
                {areas.map((area) => <g key={area.name} transform={`translate(${area.x*8}, ${area.y*3.9})`}><circle r="40" fill={area.color} opacity=".13" filter="url(#glow)"/><circle r="18" fill={area.color} opacity=".18"/><circle r="6" fill={area.color} stroke="#fff" strokeWidth="2"/></g>)}
                <path d="M369 242 L490 210 L576 172" fill="none" stroke="#f5d478" strokeWidth="2" strokeDasharray="7 7"/>
              </svg>
              <div className="map-label label-a"><strong>Ribandar</strong><span>Severe · 4,820 exposed</span></div><div className="map-label label-b"><strong>Panaji East</strong><span>High · 7,240 exposed</span></div><div className="map-label label-c"><strong>Merces</strong><span>Watch · 3,110 exposed</span></div>
              <div className="map-legend"><span><i className="severe"/>Severe</span><span><i className="high"/>High</span><span><i className="watch"/>Watch</span></div>
            </div>
            <div className="forecast-row"><Waves size={18}/><p><strong>Projected peak:</strong> Mandovi gauge at 5.7 m between 10:15–10:45 IST</p><span>91% confidence</span></div>
          </section>
          <section className="panel signal-panel">
            <PanelTitle eyebrow="LIVE INTELLIGENCE" title="Signal stream" aside={<span className="count-chip">17 sources</span>}/>
            <div className="feed-list">{feed.map((item) => <article className="feed-item" key={item.time+item.source}><div className={`feed-dot ${item.level}`}/><div><div className="feed-meta"><span>{item.time}</span><strong>{item.source}</strong></div><p>{item.text}</p><small>{item.level}</small></div></article>)}</div>
            <button className="text-link">Open intelligence ledger <ArrowUpRight size={14}/></button>
          </section>
          <section className="panel agent-panel">
            <PanelTitle eyebrow="AGENT ORCHESTRATION" title="Response cell" aside={<span className="working-chip"><Sparkles size={13}/> {activeAgent?.name} working</span>}/>
            <div className="agent-flow">{agents.map((agent,index) => { const Icon=agent.icon; return <div className="agent-step" key={agent.id}><div className={`agent-icon ${agent.state}`}><Icon/></div><div className="agent-copy"><span>AGENT {agent.id}</span><strong>{agent.name}</strong><p>{agent.role}</p><small>{agent.note}</small></div>{agent.state==="complete"?<Check className="agent-state complete"/>:agent.state==="active"?<span className="agent-spinner"/>:<Clock3 className="agent-state"/>}{index<agents.length-1&&<ChevronRight className="handoff-arrow"/>}</div>; })}</div>
            <div className="handoff-note"><Bot size={18}/><div><strong>Coordinator decision</strong><p>Impact brief will pass to Vaani after road-closure confidence exceeds 85%.</p></div><span>2m ago</span></div>
          </section>
          <section className="panel sitrep-panel">
            <PanelTitle eyebrow="SITUATION REPORT" title="SITREP 04 · Draft" aside={<span className="draft-chip">Auto-updating</span>}/>
            <div className="sitrep-body"><p className="sitrep-lead">Rapid water-level rise is likely to cause severe urban flooding in Ribandar and eastern Panaji within 90 minutes.</p><div className="sitrep-list"><p><span>01</span>Move two rescue boats to Ribandar jetty.</p><p><span>02</span>Open the Altinho relief route; avoid the causeway.</p><p><span>03</span>Prepare ward-level evacuation messaging.</p></div><div className="confidence"><div><span>Evidence confidence</span><strong>91%</strong></div><Progress value={91} className="confidence-bar"/></div></div>
            <div className="panel-actions"><Button variant="outline">Review sources</Button><Button className="light-button">Open full SITREP <ArrowUpRight/></Button></div>
          </section>
          <section className={`panel alert-panel ${alertStatus}`}>
            <PanelTitle eyebrow="EARLY WARNING" title={alertStatus==="approved"?"Alert approved":"Alert awaiting approval"} aside={<BellRing size={18}/>}/>
            <div className="alert-preview"><span className="alert-kicker">SEVERE FLOOD WARNING</span><p>Move away from low-lying areas near the Mandovi. Follow official routes to the nearest open shelter.</p><div><span>3 zones</span><span>4 languages</span><span>SMS · Cell broadcast</span></div></div>
            <div className="alert-guard"><ShieldCheck size={18}/><p><strong>Human-in-the-loop safeguard</strong><br/>Rakshak can draft, translate, and target. An authorized officer must release.</p></div>
            <Button disabled={alertStatus==="approved"} onClick={() => setAlertStatus("approved")} className="approve-button">{alertStatus==="approved"?<><Check/> Approved for release</>:<><ShieldCheck/> Review & approve alert</>}</Button>
          </section>
        </div>
      </section>
    </div>
    {assistantOpen&&<div className="assistant-backdrop" onMouseDown={() => setAssistantOpen(false)}><aside className="assistant-drawer" onMouseDown={(event) => event.stopPropagation()} aria-label="Sarathi public crisis assistant">
      <div className="assistant-head"><div className="assistant-avatar"><MessageCircle/></div><div><p>SARATHI SAHAYAK</p><h2>Public crisis assistant</h2></div><button aria-label="Close assistant" onClick={() => setAssistantOpen(false)}><X/></button></div>
      <div className="assistant-context"><MapPin size={16}/><span>Guidance for North Goa exercise area</span><strong>Verified 08:42</strong></div>
      <div className="chat-area"><div className="assistant-message"><div className="mini-avatar">S</div><p>{reply}</p></div><div className="quick-actions"><button onClick={() => askAssistant("evacuation")}>Evacuation route</button><button onClick={() => askAssistant("nearest shelter")}>Nearest shelter</button><button onClick={() => askAssistant("help")}>I need help</button></div></div>
      <form className="assistant-form" onSubmit={(event) => {event.preventDefault();if(query.trim())askAssistant(query);}}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ask about safety, shelters, or routes…" aria-label="Ask the crisis assistant"/><Button size="icon" aria-label="Send question"><Send/></Button></form>
      <p className="emergency-note"><Radio size={14}/> In immediate danger? Call emergency services: <strong>112</strong></p>
    </aside></div>}
  </main>;
}

function Metric({icon:Icon,label,value,meta,tone}:{icon:typeof Activity;label:string;value:string;meta:string;tone:string}) {
  return <article className={`metric-card ${tone}`}><div className="metric-icon"><Icon/></div><div><p>{label}</p><strong>{value}</strong><span>{meta}</span></div></article>;
}
function PanelTitle({eyebrow,title,aside}:{eyebrow:string;title:string;aside:React.ReactNode}) {
  return <div className="panel-title"><div><p>{eyebrow}</p><h2>{title}</h2></div>{aside}</div>;
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { Activity, ArrowUpRight, Check, ChevronDown, Database, FileText, Gauge, MapPin, Menu, Network, Search, Send, ShieldCheck, Sparkles, X, Zap } from "lucide-react";
import { agents, incident, intelligence, sitreps, sources, warnings } from "@/lib/sarathi-data";

export type SarathiView = "command"|"intelligence"|"warnings"|"agents"|"agent"|"sitrep"|"sitrep-detail"|"alerts"|"ask"|"sources"|"system"|"event";
const nav = [["Command","/"],["Intelligence","/intelligence"],["Warnings","/warnings"],["Agents","/agents"],["SITREP","/sitrep"],["Alerts","/alerts"],["Ask","/ask"]] as const;

export function SarathiApp({view,detail}:{view:SarathiView;detail?:string}) {
  const pathname=usePathname(); const [menuOpen,setMenuOpen]=useState(false);
  return <main className="sarathi-root">
    <div className="exercise-ribbon">EXERCISE MODE · SIMULATED CHENNAI FLOOD SCENARIO</div>
    <header className="global-nav">
      <Link href="/" className="wordmark"><span className="wordmark-glyph"><Zap/></span><span><b>SARATHI</b><small>Command Center</small></span></Link>
      <nav className={menuOpen?"nav-links open":"nav-links"} aria-label="Primary navigation">{nav.map(([label,href])=><Link key={href} href={href} className={pathname===href||(href!=="/"&&pathname.startsWith(href))?"active":""}>{label}</Link>)}</nav>
      <div className="system-live"><span className="live-dot"/> LIVE <i/> 09:42 <i/> <Gauge/> 99.98%</div>
      <button className="mobile-menu" aria-label="Toggle navigation" onClick={()=>setMenuOpen(!menuOpen)}>{menuOpen?<X/>:<Menu/>}</button>
    </header>
    <div className="route-frame">
      {view==="command"&&<CommandCenter/>}{view==="intelligence"&&<IntelligenceScreen/>}{view==="warnings"&&<WarningsScreen alerts={false}/>}
      {view==="alerts"&&<WarningsScreen alerts/>}{view==="agents"&&<AgentNetwork/>}{view==="agent"&&<AgentDetail slug={detail}/>}
      {view==="sitrep"&&<SitrepScreen/>}{view==="sitrep-detail"&&<SitrepScreen selected={detail}/>}
      {view==="ask"&&<AskSarathi/>}{view==="sources"&&<SourcesScreen/>}{view==="system"&&<SystemScreen/>}{view==="event"&&<EventReplay/>}
    </div>
    <footer className="utility-nav"><Link href="/sources"><Database/> Sources</Link><Link href="/system"><Activity/> System</Link><span>Incident {incident.incidentId}</span></footer>
  </main>;
}

function PageHeading({index,title,subtitle,action}:{index:string;title:string;subtitle:string;action?:React.ReactNode}) {
  return <div className="page-heading"><div className="heading-index">{index}</div><div><h1>{title}</h1><p>{subtitle}</p></div>{action&&<div className="heading-action">{action}</div>}</div>;
}

function CommandCenter() {
  const [filter,setFilter]=useState("All events");
  return <div className="page command-page"><PageHeading index="01" title="Command" subtitle="Real-time overview of the situation"/>
    <section className="command-map"><MapScene/><div className="map-title"><span>Situation,</span> 9:42 am<small>Chennai · Tamil Nadu</small></div>
      <article className="float-panel threat-panel"><PanelMenu/><p>Current threat</p><div className="big-risk">82 <Badge tone="red">HIGH</Badge></div><h3>Flood risk</h3><div className="trend-up">↑ Increasing</div><small>Updated 09:41 am</small></article>
      <article className="float-panel intel-panel"><p>Intelligence</p><strong className="big-number">24</strong><span>Live events</span><div className="source-dots"><b>Weather <i/></b><b>News <i/></b><b>Geospatial <i/></b><b>Risk <i/></b></div></article>
      <article className="float-panel weather-panel"><p>Weather Agent <LiveStatus/></p><strong className="big-number blue">142<em> mm</em></strong><span>Rainfall / 24h</span><b className="confidence">91% <small>Confidence</small></b></article>
      <article className="float-panel risk-panel"><PanelMenu/><p>Risk assessment</p><strong className="big-number red">82<em> /100</em></strong><div className="trend-up">↑ Increasing</div></article>
      <div className="map-filter"><button>{filter}<ChevronDown/></button>{["All events","Weather","Flood","Fire","Earthquake"].map(item=><button key={item} className={filter===item?"selected":""} onClick={()=>setFilter(item)}>{item}</button>)}</div>
      <div className="map-zoom"><button>+</button><button>−</button><button><MapPin/></button></div>
      <div className="event-callout"><span className="hazard-dot red"/><div><b>Flood risk</b><small>Tondiarpet · 12.4 km²</small></div><ArrowUpRight/></div>
      <div className="command-timeline"><span>06:00</span><i/><span>09:00</span><i className="active"/><span>12:00</span><i/><span>18:00</span><b><span className="live-dot"/> Live</b></div>
    </section>
  </div>;
}

function IntelligenceScreen() {
  const [selected,setSelected]=useState(0);
  return <div className="page"><PageHeading index="02" title="Intelligence" subtitle="Geospatial analysis and multi-source data"/>
    <section className="intel-workspace">
      <aside className="layer-panel"><h3>Layers</h3>{["Live events","Flood risk","Rainfall","Weather (Wind)","Satellite","Infrastructure","Population","Admin boundaries"].map((x,i)=><button key={x} className={i<4?"enabled":""}><span className={"layer-dot l"+i}/>{x}</button>)}</aside>
      <div className="intel-map"><MapScene/><div className="search-map"><Search/> Search location…</div><button className="layer-select">All layers <ChevronDown/></button><div className="severe-marker"><span/>Severe flooding<small>Tondiarpet, Chennai</small></div></div>
      <aside className="intel-detail"><div className="mini-satellite"><MapScene compact/></div><Badge tone="red">HIGH</Badge><dl><dt>Time</dt><dd>09:12 am</dd><dt>Affected area</dt><dd>12.4 km²</dd><dt>Est. population</dt><dd>~180,000</dd><dt>Sources</dt><dd>Satellite, Weather, News</dd><dt>Confidence</dt><dd>87%</dd></dl><Link href="/events/demo" className="outline-link">View details <ArrowUpRight/></Link></aside>
      <div className="intel-timeline"><b>Timeline</b><span>6 am</span><i/><span>9 am</span><i className="current"/><span>12 pm</span><i/><span>3 pm</span><i className="warning"/><span>6 pm</span><LiveStatus/></div>
    </section>
    <div className="stream-section"><h2>Chronological intelligence</h2>{intelligence.map((item,i)=><button key={item.time} className={selected===i?"stream-row active":"stream-row"} onClick={()=>setSelected(i)}><time>{item.time}</time><span className="stream-type">{item.type}</span><div><b>{item.title}</b><small>{item.location}</small></div><strong>{item.value}</strong><Badge tone={item.status==="UNVERIFIED"?"amber":"green"}>{item.status}</Badge><span className="row-actions">View · Explain · Sources</span></button>)}</div>
  </div>;
}

function WarningsScreen({alerts}:{alerts:boolean}) {
  const [selected,setSelected]=useState(0); const item=warnings[selected];
  return <div className="page"><PageHeading index={alerts?"06":"03"} title={alerts?"Alert Center":"Warnings"} subtitle={alerts?"Threshold-triggered public safety alerts":"Early warnings and risk alerts"} action={<button className="quiet-select">All types <ChevronDown/></button>}/>
    <div className="warning-tabs"><button className="active">{alerts?"Awaiting approval":"Active"} <b>{alerts?1:12}</b></button><button>Predicted <b>8</b></button><button>Resolved <b>26</b></button></div>
    <section className="warnings-layout"><div className="warning-list">{warnings.map((w,i)=><button key={w.id} className={i===selected?"active":""} onClick={()=>setSelected(i)}><span className={"hazard-dot "+(w.severity==="HIGH"?"red":w.severity==="LOW"?"green":"amber")}/><div><b>{w.title}</b><small>{w.place}</small></div><Badge tone={w.severity==="HIGH"?"red":w.severity==="LOW"?"green":"amber"}>{w.severity}</Badge><time>{w.time}</time></button>)}</div>
      <article className="warning-detail"><header><div><h2>{item.title}</h2><p>{item.place}</p></div><Badge tone={item.severity==="HIGH"?"red":"amber"}>{item.severity}</Badge></header><div className="warning-map"><MapScene compact/><div className="danger-ring"/></div><div className="warning-metrics"><Metric label="Impact radius" value="12.4 km²"/><Metric label="Est. population" value="~180,000"/><Metric label="Confidence" value="87%"/></div><div className="detail-tabs"><b>Forecast</b><span>Impact</span><span>Actions</span><span>Sources</span></div><RiskChart/>{alerts&&<div className="approval-strip"><ShieldCheck/><p><b>Human approval required</b><br/>Drafted in Tamil, English, Telugu and Hindi.</p><button>Review alert</button></div>}</article>
    </section>
  </div>;
}

function AgentNetwork() {
  const [active,setActive]=useState<string|null>(null);
  return <div className="page"><PageHeading index="04" title="Agents" subtitle="Multi-agent intelligence system" action={<button className="quiet-select">All agents <ChevronDown/></button>}/>
    <div className="network-status"><div><span className="live-dot"/> 8 services responding</div><p>SARATHI activates only the capabilities required by each incident.</p><Link href="/events/demo">Replay demo event <ArrowUpRight/></Link></div>
    <section className="agent-network"><div className="orchestrator-node"><span>S</span><div><small>CENTRAL LAYER</small><b>Sarathi Orchestrator</b><p>Routing 6 relevant capabilities in parallel</p></div><LiveStatus/></div><div className="network-lines"/>
      <div className="agent-grid">{agents.map(agent=><Link href={"/agents/"+agent.slug} key={agent.slug} className={active===agent.slug?"agent-card active":"agent-card"} onMouseEnter={()=>setActive(agent.slug)} onMouseLeave={()=>setActive(null)}><header><small>{agent.kind}</small><LiveStatus label={agent.status}/></header><h3>{agent.name}</h3><div><strong>{agent.value}</strong><span>{agent.metric}</span></div><footer><span>{agent.updated}</span><b>{agent.confidence}% confidence</b></footer></Link>)}</div>
      <div className="incident-state-node"><Network/><div><small>SHARED STRUCTURE</small><b>Incident State</b><p>Compact, typed and source-attributed</p></div><span>11 updates</span></div>
    </section>
  </div>;
}

function AgentDetail({slug="weather"}:{slug?:string}) {
  const agent=agents.find(a=>a.slug===slug)??agents[0]; const [explain,setExplain]=useState(false);
  return <div className="page detail-page"><PageHeading index="04" title={agent.name} subtitle={agent.kind+" service · "+agent.updated} action={<LiveStatus label={agent.status}/>}/>
    <section className="agent-hero"><div><p>CHENNAI</p><strong>{agent.value}</strong><span>{agent.metric}</span></div><div><Metric label="Confidence" value={String(agent.confidence)+"%"}/><Metric label="Data sources" value={String(agent.sources)}/><Metric label="Status" value={agent.status}/></div></section>
    <section className="evidence-layout"><article><h2>Latest output</h2><p>Observed conditions exceed the regional flood-watch threshold. The structured result was forwarded to the risk and verification services.</p><div className="raw-output"><span>rainfall_24h</span><b>142 mm</b><span>forecast_24h</span><b>180 mm</b><span>quality</span><b>verified</b></div><button className="primary-action" onClick={()=>setExplain(true)}>Explain this result</button></article><article><h2>Sources</h2><SourceRow name="Open-Meteo" meta="12 seconds ago · live"/><SourceRow name="India Meteorological Department" meta="2 minutes ago · official"/><SourceRow name="NDMA Flood Guidelines" meta="Knowledge · 2025"/></article></section>
    {explain&&<div className="explain-backdrop" onClick={()=>setExplain(false)}><aside className="explain-drawer" onClick={e=>e.stopPropagation()}><button onClick={()=>setExplain(false)}><X/></button><p className="kicker">SARATHI EXPLAINS</p><h2>Why does this matter?</h2><p>Chennai has received 142 mm of rainfall in the last 24 hours and another 180 mm is forecast. Together with verified waterlogging reports and low-lying terrain, this raises the probability of severe localized flooding.</p><h3>Based on</h3><SourceRow name="Live weather data" meta="Open-Meteo · IMD"/><SourceRow name="Flood-response guidance" meta="NDMA · TN SDMA"/></aside></div>}
  </div>;
}

function SitrepScreen({selected="1042"}:{selected?:string}) {
  const active=sitreps.find(x=>x.id===selected)??sitreps[0];
  return <div className="page"><PageHeading index="05" title="Situation Report" subtitle="AI-generated situational awareness reports" action={<button className="primary-outline">Generate new</button>}/>
    <section className="sitrep-layout"><aside>{sitreps.map(s=><Link key={s.id} href={"/sitrep/"+s.id} className={s.id===active.id?"active":""}><small>SITREP</small><b>{s.time}</b><span>{s.date}</span></Link>)}</aside><article className="sitrep-document"><header><div><p>SITREP — Chennai</p><h2>{active.time}, {active.date}</h2></div><Badge tone="red">{active.status}</Badge></header><h3>Executive summary</h3><p>Heavy rainfall over the past 24 hours has led to severe flooding in parts of North Chennai, particularly Tondiarpet and surrounding areas. Water levels are rising and expected to peak in the next 2–4 hours. Multiple low-lying areas are at risk.</p><div className="sitrep-metrics"><Metric label="Active events" value="24"/><Metric label="Critical areas" value="3"/><Metric label="People affected" value="~180K"/><Metric label="Risk score" value="82"/></div><h3>Affected areas</h3><div className="sitrep-map"><MapScene compact/><ul><li><i className="red"/>Severe flooding <small>Tondiarpet</small></li><li><i className="green"/>Waterlogging <small>Anna Nagar</small></li><li><i className="amber"/>High risk <small>North Chennai</small></li></ul></div><h3>Recommended actions</h3><ol><li>Move rescue boats and medical teams to Basin Bridge staging.</li><li>Open twelve verified shelters and publish accessible routes.</li><li>Prepare ward-level warning messages for officer approval.</li></ol></article></section>
  </div>;
}

function AskSarathi() {
  const [query,setQuery]=useState(""); const [answer,setAnswer]=useState<string|null>(null);
  const selectedAgents=useMemo(()=>["Weather","News","Geospatial","Risk","Knowledge"].filter(a=>query.toLowerCase().includes("flood")||query.toLowerCase().includes("chennai")||a==="Knowledge"),[query]);
  function submit(q:string){setQuery(q);setAnswer("Chennai is experiencing verified severe flooding in parts of the north. Avoid Tondiarpet low-lying roads, use official shelter routes, and follow Greater Chennai Corporation instructions. Current risk score: 82 / HIGH.");}
  return <div className="page ask-page"><PageHeading index="07" title="Ask" subtitle="Natural language intelligence interface"/><section className="ask-surface"><p className="kicker">SARATHI</p><h1>What do you need to know?</h1><p>Answers combine current verified data with authoritative safety guidance.</p><form onSubmit={e=>{e.preventDefault();if(query.trim())submit(query)}}><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ask about an emergency…"/><button aria-label="Send"><Send/></button></form><div className="suggestions">{["Is Chennai flooding right now?","Find shelters near Tondiarpet","What changed in the last 30 minutes?","What should I do during a flood?"].map(q=><button key={q} onClick={()=>submit(q)}>{q}</button>)}</div>{answer&&<div className="answer-panel"><span className="answer-mark">S</span><div><p>{answer}</p><div className="routing-trace"><small>RELEVANT CAPABILITIES</small>{selectedAgents.map(x=><span key={x}><Check/> {x}</span>)}</div><SourceRow name="Live data" meta="Weather · News · Geospatial · Risk"/><SourceRow name="Knowledge" meta="NDMA Flood Guidelines · TN Flood SOP"/></div></div>}</section></div>;
}

function SourcesScreen(){return <div className="page"><PageHeading index="08" title="Sources" subtitle="Live data and institutional knowledge"/><div className="sources-layout"><section><h2>Live sources</h2>{sources.live.map(s=><div className="source-health" key={s.name}><span className="live-dot"/><div><b>{s.name}</b><small>{s.type}</small></div><strong>{s.status}</strong><time>{s.latency}</time></div>)}</section><section><h2>Knowledge base</h2>{sources.knowledge.map(s=><div className="knowledge-row" key={s.name}><FileText/><div><b>{s.name}</b><small>{s.authority} · {s.year}</small></div><span>{s.chunks} chunks</span></div>)}</section><section className="rag-stats"><Metric label="Documents" value="68"/><Metric label="Indexed chunks" value="830"/><Metric label="Last indexed" value="8m"/><Metric label="Retrieval latency" value="84ms"/></section></div></div>}
function SystemScreen(){const rows=[["API gateway","Operational","124 ms"],["Incident database","Operational","18 ms"],["RAG retrieval","Operational","84 ms"],["LLM reasoning","Operational","1.8 s"],["Agent registry","Operational","14 / 14"],["Event stream","Operational","0.02% errors"]];return <div className="page"><PageHeading index="09" title="System" subtitle="Platform health and resource governance"/><div className="system-grid"><section><h2>Service health</h2>{rows.map(r=><div className="health-row" key={r[0]}><span className="live-dot"/><b>{r[0]}</b><em>{r[1]}</em><strong>{r[2]}</strong></div>)}</section><section><h2>Token manager</h2><Metric label="LLM calls" value="6 / 8"/><Metric label="Input tokens" value="8,420"/><Metric label="Output tokens" value="2,180"/><Metric label="Cache hit rate" value="68%"/><div className="budget-bar"><i style={{width:"64%"}}/></div><p>Execution remains within the incident budget. Agent iterations capped at 5.</p></section></div></div>}
function EventReplay(){const [step,setStep]=useState(0);const sequence=["Weather detects 142 mm rainfall","News corroborates flooding","Geo identifies shelters","Public reports enter verification","Risk increases 64 → 82","Guidance retrieved","HIGH alert drafted","SITREP #1042 generated"];return <div className="page"><PageHeading index="10" title="Demo event" subtitle="Replay the Chennai flood intelligence progression" action={<button className="primary-outline" onClick={()=>setStep(0)}>Reset</button>}/><section className="replay-stage"><MapScene/><div className="replay-panel"><p className="kicker">ORCHESTRATED RESPONSE</p><h2>Chennai flood event</h2>{sequence.map((s,i)=><div key={s} className={i<step?"done":i===step?"active":""}><span>{i<step?<Check/>:i+1}</span><p>{s}</p></div>)}<button className="primary-action" onClick={()=>setStep(v=>Math.min(sequence.length,v+1))}>{step===sequence.length?"Replay complete":"Advance event"}</button></div></section></div>}

function MapScene({compact=false}:{compact?:boolean}) { return <svg className={compact?"map-scene compact":"map-scene"} viewBox="0 0 1000 620" preserveAspectRatio="xMidYMid slice" aria-label="Dark schematic map of the Chennai operational area"><defs><pattern id="streetGrid" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M0 20L44 4M8 44L44 29M12 0L0 31" stroke="#23313a" strokeWidth="1" fill="none"/></pattern><radialGradient id="sea" cx="0" cy=".5" r="1"><stop offset="0" stopColor="#0b2740"/><stop offset="1" stopColor="#06121b"/></radialGradient><filter id="blur"><feGaussianBlur stdDeviation="18"/></filter></defs><rect width="1000" height="620" fill="#0b1014"/><rect width="720" height="620" fill="url(#streetGrid)" opacity=".85"/><path d="M720-20C650 110 760 210 700 330S750 490 670 650H1050V-20Z" fill="url(#sea)"/><path d="M720-20C650 110 760 210 700 330S750 490 670 650" fill="none" stroke="#168aca" strokeWidth="3" opacity=".7"/><g stroke="#2c404a" fill="none" opacity=".8"><path d="M80 570Q260 350 710 170" strokeWidth="7"/><path d="M30 390Q280 300 680 80" strokeWidth="4"/><path d="M120 80Q380 260 690 500" strokeWidth="5"/><path d="M320 0Q410 270 280 620" strokeWidth="3"/></g><path d="M250 420C330 340 400 370 450 290S565 230 640 125" stroke="#ff4f62" strokeWidth="55" opacity=".14" filter="url(#blur)" fill="none"/><path d="M250 420C330 340 400 370 450 290S565 230 640 125" stroke="#d74856" strokeWidth="2" fill="none"/>{[[330,365,"#ff5365"],[410,305,"#ff5365"],[475,270,"#ff5365"],[564,194,"#ff5365"],[235,250,"#ffab45"],[175,430,"#36d69e"],[528,420,"#ffad43"],[610,110,"#ff5365"]].map(([x,y,c],i)=><g key={i}><circle cx={x} cy={y} r="22" fill={c as string} opacity=".12"/><circle cx={x} cy={y} r="7" fill={c as string}/></g>)}<g fill="#c8d5dc" fontSize="18"><text x="455" y="360" fontSize="30">Chennai</text><text x="548" y="145">Ennore</text><text x="310" y="455">Ambattur</text><text x="190" y="345">Avadi</text><text x="415" y="500">T. Nagar</text><text x="725" y="430" fill="#3a8fbd" fontSize="13" letterSpacing="4">BAY OF BENGAL</text></g></svg> }
function RiskChart(){return <svg className="risk-chart" viewBox="0 0 500 150" preserveAspectRatio="none"><defs><linearGradient id="riskFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ef4d5e" stopOpacity=".34"/><stop offset="1" stopColor="#ef4d5e" stopOpacity="0"/></linearGradient></defs><g stroke="#273038"><line x1="0" y1="30" x2="500" y2="30"/><line x1="0" y1="75" x2="500" y2="75"/><line x1="0" y1="120" x2="500" y2="120"/></g><path d="M0 118C70 112 110 92 160 88S230 82 270 54 350 61 390 35 445 18 500 20V150H0Z" fill="url(#riskFill)"/><path d="M0 118C70 112 110 92 160 88S230 82 270 54 350 61 390 35 445 18 500 20" fill="none" stroke="#ef4d5e" strokeWidth="2"/><circle cx="330" cy="58" r="5" fill="#ff5667"/><line x1="330" y1="0" x2="330" y2="150" stroke="#ff5667" strokeDasharray="3 5"/></svg>}
function Badge({children,tone}:{children:React.ReactNode;tone:"red"|"amber"|"green"}){return <span className={"badge "+tone}>{children}</span>}
function LiveStatus({label="LIVE"}:{label?:string}){return <span className="live-status"><i/>{label}</span>}
function PanelMenu(){return <button className="panel-menu">•••</button>}
function Metric({label,value}:{label:string;value:string}){return <div className="metric"><strong>{value}</strong><span>{label}</span></div>}
function SourceRow({name,meta}:{name:string;meta:string}){return <div className="source-row"><span className="live-dot"/><div><b>{name}</b><small>{meta}</small></div><ArrowUpRight/></div>}

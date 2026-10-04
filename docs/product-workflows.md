# Sarathi product workflows

Sarathi should feel like one disaster-intelligence system. Specialist agents operate behind the interface and contribute to a shared `IncidentState`; users should not have to operate a collection of chatbots.

## Primary operating loop

1. **Detect** — ingest live weather, earthquake, fire, news, geospatial and public-report signals.
2. **Open an incident** — group related signals by hazard, place and time into one durable record.
3. **Investigate** — show the map, chronological intelligence, infrastructure exposure and raw source evidence.
4. **Verify** — score freshness, authority, cross-source agreement, conflicts and anomalies. Public reports begin as unverified.
5. **Assess risk** — calculate a deterministic score and trend from measured factors. An LLM may explain the result but never invent it.
6. **Decide** — create recommended actions from the verified incident state and authoritative response guidance.
7. **Publish** — generate a versioned SITREP, prepare a reviewed alert, or answer a public-safety question with citations.
8. **Update** — stream changed agent outputs into the relevant panels and recalculate downstream products without refreshing the whole page.

## Useful workflows to build

| Workflow | What the user does | Sarathi output |
| --- | --- | --- |
| Incident command | Selects a map region or signal | One incident panel with timeline, risk, evidence, affected infrastructure and actions |
| Early warning | Watches thresholds and rapid changes | Lead-time window, trigger, severity, trend, evidence and approval status |
| Evidence verification | Opens a disputed signal | `VERIFIED`, `CORROBORATED`, `UNVERIFIED` or `CONFLICTING`, with the reasons and sources |
| Public reporting | Submits a location and description | Classified, geolocated report queued for corroboration; never treated as fact automatically |
| Response planning | Chooses an incident and operational objective | Shelter, hospital, route and resource recommendations grounded in verified geospatial data |
| SITREP production | Reviews the current incident state | Saved report version with situation, assessment, actions and cited evidence; exportable to PDF |
| Alert operations | Reviews an automatically triggered draft | Approve, reject, revise and deliver an alert; delivery status and audit trail remain visible |
| Ask Sarathi | Asks a current-state or safety question | Selective agent routing, concise answer, separate live-data and knowledge citations |
| Agent activity | Opens the optional trace | Which specialists ran, duration, source, confidence and handoff metadata without chain-of-thought |
| System operations | Checks platform health | API, database, retrieval, model, cache, latency, error and token-budget status |

## Specialist team

The logical team from the original brief remains the target: Orchestrator, Weather, Earthquake, Fire/Thermal, News, Geospatial, Public Report, Risk, RAG Knowledge, Verification, Response Planning, SITREP, Alert Generator and Explanation. The orchestrator selects only the relevant specialists, runs independent work in parallel, merges structured results into `IncidentState`, then invokes verification and risk before producing user-facing outputs.

## Delivery priorities

### 1. Complete one end-to-end incident

Persist incidents, events, source evidence, agent runs, risk assessments, SITREP versions and alert drafts. Make a selected Chennai weather signal flow through verification, deterministic risk, explanation and SITREP generation.

### 2. Add missing live providers

Connect fire/thermal, news and geospatial infrastructure providers behind typed adapters. Keep provider keys server-side and show an explicit unavailable state when a source cannot be reached.

### 3. Add authoritative knowledge

Ingest NDMA, IMD, state SOPs and historical SITREPs into a cited retrieval layer. Use live sources for current facts and the knowledge base for procedures and recommended actions.

### 4. Add public reports and response planning

Accept reports with location and description, preserve them as unverified evidence, cross-reference live feeds, and add verified shelters, hospitals and emergency infrastructure to the map.

### 5. Add reviewed alert delivery and realtime updates

Create deterministic alert triggers, an operator approval queue, delivery adapters, Server-Sent Events, audit history and system/token observability.

## Current release boundary

The deployed release currently provides real Open-Meteo weather, NASA EONET natural events and USGS earthquake data, real OpenStreetMap maps, source-aware warnings, specialist status, a generated text SITREP and a source-linked public assistant. Persistent incidents, the full agent orchestrator, verification, RAG, public reports, response planning, official alert delivery and realtime event streaming are planned work and must not be represented as already operational.

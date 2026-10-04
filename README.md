# Sarathi

Sarathi is a multi-agent crisis intelligence platform for safety and disaster response. A central coordinator routes evidence through specialist agents, records every handoff, produces a situation report, and prepares a targeted early-warning alert for human approval.

The current release is an interactive exercise environment. Its incident data and public guidance are simulated and clearly labelled so they cannot be confused with an operational alert.

## Agent team

1. **Drishti** ingests sensor, field-team, official, and public signals.
2. **Satya** verifies claims, identifies conflicts, and attaches confidence.
3. **Nirikshak** models people, places, infrastructure, and likely impact.
4. **Vaani** turns the verified impact brief into a concise SITREP.
5. **Rakshak** drafts, translates, and targets early-warning messages.
6. The central coordinator manages handoffs and requires an authorized officer before release.

## Product surfaces

- Map-first command center and event replay
- Chronological intelligence stream with data, explanation, and source affordances
- Deterministic warnings and human-approved alerts
- Selective parallel agent orchestration with inspectable service details
- Editorial SITREPs, source transparency, RAG status, and system health
- Minimal public assistant that shows the capabilities and sources used
- Typed server routes for dashboard, intelligence, warnings, agents, reports, alerts, sources, system status, and questions

## Routes

The product includes the command, intelligence, warnings, agents, agent detail,
SITREP, SITREP detail, alerts, Ask, sources, system, and demo-event routes.

The browser uses only Sarathi server routes. Provider interfaces, deterministic
risk calculation, selective agent routing, and mock providers live in the
Sarathi engine module; production providers can implement the same interfaces.

## Run locally

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. Build the deployable worker with:

```bash
npm run build
```

Copy .env.example to .env.local when adding real providers. Never put provider
credentials in browser code.

## Safety model

Sarathi separates observation, verification, analysis, communication, and release. Unverified public signals stay visibly marked, confidence accompanies forecasts, exercise data is labelled, and outward alerts cannot be sent without a human decision.

## Status

This repository contains a polished working prototype for the InnoVax AI for Safety and Disaster Response track. Production integrations for live sensor feeds, CAP alert distribution, identity, durable incident storage, and agency-specific approval policy are the next deployment stage.

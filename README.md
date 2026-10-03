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

- Unified risk map and operational metrics
- Live intelligence and source-verification stream
- Executable agent handoff pipeline
- Auto-updating SITREP with evidence confidence
- Human-approved early-warning workflow
- Public crisis assistant for evacuation, shelter, and emergency guidance
- Responsive desktop and mobile layouts
- WebMCP tool for opening the public assistant with a chosen topic

## Run locally

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. Build the deployable worker with:

```bash
npm run build
```

## Safety model

Sarathi separates observation, verification, analysis, communication, and release. Unverified public signals stay visibly marked, confidence accompanies forecasts, exercise data is labelled, and outward alerts cannot be sent without a human decision.

## Status

This repository contains a polished working prototype for the InnoVax AI for Safety and Disaster Response track. Production integrations for live sensor feeds, CAP alert distribution, identity, durable incident storage, and agency-specific approval policy are the next deployment stage.

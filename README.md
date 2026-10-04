# Sarathi

Disaster intelligence workspace with an interactive OpenStreetMap basemap, live public feeds, source inspection, situation reports and a bounded multi-agent AI workflow.

## Run

```sh
npm install
npm run dev
```

The development server uses http://127.0.0.1:5173. Build with `npm run build`. Run the production Worker locally with `npm run start`.

## Connected data

- Open-Meteo: Chennai weather model estimates and precipitation forecasts.
- NASA EONET: up to 20 open global natural events.
- USGS: significant earthquakes over the past week.
- OpenStreetMap: street-map raster tiles rendered with Leaflet, attribution visible on every map. Browser caching is preserved; no prefetch or offline tile downloading is implemented.

No credentials are required by the current integrations. Provider failures and malformed responses remain unavailable; zero is displayed only for a valid zero-valued reading or successful empty feed.

## Multi-agent AI

The Ask workflow uses a central orchestrator to select the relevant weather, seismic, natural-event and official-guidance specialists. Specialists run in parallel, write source-attributed evidence into one shared incident state, and pass it through a verification gate before the explanation agent produces an answer. The model is instructed to use only that evidence and never invent measurements, incidents, alerts, shelters, routes, risk scores or confidence values.

The explanation agent uses the OpenAI Responses API when `OPENAI_API_KEY` is configured server-side. Without it, the same live evidence and agent trace remain available and the interface explicitly labels AI synthesis unavailable. `OPENAI_MODEL` defaults to `gpt-5-mini`.

Each request is limited to one model call, 3,500 estimated input tokens, 600 output tokens, 4,100 total tokens, four selected specialists, twelve evidence items and a 12-second model timeout. The interface displays the observed token use for every run.

## Working interactions

Document navigation links, responsive navigation, map pan/zoom/recenter, dark/street basemap appearance, event search and source filters, event selection and map focus, source links, rainfall/wind views, warning detail tabs, agent filters/detail, report regeneration and text download, and routed multi-agent Ask responses with evidence and token accounting.

The report is a current source snapshot, not a persisted incident history. The warnings view shows raw Open-Meteo fields and totals calculated from its hourly series; it does not infer a risk score or severity. Alert delivery is unavailable because no official alert provider is connected. No verified shelter routing, exposure data or risk provider is connected.

## Checks

```sh
npx tsc --noEmit
node --test tests/live-data.test.mjs tests/sarathi-ai.test.mjs
npx eslint components/sarathi-portal.tsx components/operational-map.tsx app/api/ask/route.ts app/api/system/status/route.ts lib/sarathi-ai.ts
npm run build
```

Tests cover complete provider failure, partial outages, successful empty feeds, malformed responses, and UTC precipitation windows. Test fixtures are never imported into the application.

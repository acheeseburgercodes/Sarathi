# Sarathi

Disaster intelligence workspace with an interactive OpenStreetMap basemap, live public feeds, source inspection, situation reports and a source-specific question interface.

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

## Working interactions

Document navigation links, responsive navigation, map pan/zoom/recenter, dark/street basemap appearance, event search and source filters, event selection and map focus, source links, rainfall/wind views, warning detail tabs, agent filters/detail, report regeneration and text download, and source-specific Ask responses.

The report is a current source snapshot, not a persisted incident history. The warnings view shows raw Open-Meteo fields and totals calculated from its hourly series; it does not infer a risk score or severity. Alert delivery is unavailable because no official alert provider is connected. No verified shelter routing, exposure data, risk provider, RAG or LLM service is connected.

## Checks

```sh
npx tsc --noEmit
node --test tests/live-data.test.mjs
npx eslint components/sarathi-portal.tsx components/operational-map.tsx app/api/ask/route.ts
npm run build
```

Tests cover complete provider failure, partial outages, successful empty feeds, malformed responses, and UTC precipitation windows. Test fixtures are never imported into the application.

# Sarathi

Disaster intelligence workspace with an interactive OpenStreetMap basemap, live public feeds, source inspection, situation reports and a bounded multi-agent AI workflow.

## Run

```sh
npm install
npm run dev
```

The development server uses http://127.0.0.1:5173. Build with `npm run build`. Run the production Worker locally with `npm run start`.

## CLI backend

The backend can run independently of the web interface:

```powershell
Copy-Item .env.example .env
npm run sarathi -- --query "Create a disaster intelligence briefing for Chennai"
npm run sarathi -- --query "Summarize weather and disaster news" --json
npm run sarathi -- --query "Extract current evidence" --no-ai --save outputs/run.json
```

Each run retrieves real data in parallel from Open-Meteo, Google News RSS, USGS and NASA EONET. Weather, news-management, seismic and natural-event agents analyze their own evidence, then report to Sarathi Central for synthesis. Without `OPENAI_API_KEY`, extraction still runs and the CLI produces an evidence-only report with an explicit AI-unavailable status.

Agents use separate Responses API calls and role-specific instructions. Set `SARATHI_WEATHER_MODEL`, `SARATHI_NEWS_MODEL`, `SARATHI_SEISMIC_MODEL`, `SARATHI_EVENTS_MODEL` or `SARATHI_CENTRAL_MODEL` to use different model or fine-tuned model IDs. The default model comes from `OPENAI_MODEL` and falls back to `gpt-5-mini`.

The default run budget allows five model calls, 30,000 input tokens, 8,000 output tokens and 38,000 total tokens. Each request is preflight-counted with the Responses input-token endpoint when available and reserved in a shared ledger before execution. Every result includes per-agent and total usage. Limits can be changed through the `SARATHI_MAX_*` variables documented in `.env.example`.

## Python backend

The dependency-free Python implementation is the primary terminal backend. On Windows, double-click `run.bat` or run it from a terminal:

```powershell
.\run.bat "Create a current disaster briefing for Chennai"
.\run.bat --profile remote "Summarize flood conditions"
.\run.bat --offline --no-ai "Build a report from cached evidence"
.\run.bat --json --no-save "Return the frontend response contract"
```

`run.bat` detects the Python launcher, loads `.env` and `.env.local`, runs all source adapters and agents, prints the central report, source health and token ledger, and saves a complete JSON run under `outputs/runs`. No pip installation is required; Python 3.10 or newer is sufficient.

The Python backend supports three budgets:

| Profile | Model calls | Input | Output | Total |
| --- | ---: | ---: | ---: | ---: |
| `remote` | 2 | 6,000 | 1,500 | 7,500 |
| `standard` | 5 | 30,000 | 8,000 | 38,000 |
| `deep` | 7 | 60,000 | 12,000 | 72,000 |

Source responses are cached in `data/saarthi.db`. Live failures can fall back to recent cache entries, while `--offline` prevents network access and uses cached evidence only. Every run is persisted to SQLite for later frontend consumption.

The budget protects an input allocation for the central agent before specialists run: 2,000 tokens in remote mode, 6,000 in standard mode and 12,000 in deep mode. This prevents parallel specialists from consuming the entire context budget before final synthesis.

### Supabase live storage

Run `supabase/migrations/001_saarthi_storage.sql` in the Supabase SQL Editor, then configure `SUPABASE_URL` and the backend-only `SUPABASE_SECRET_KEY` in `.env`. The backend writes every run, the latest source snapshots, and each agent output through Supabase's Data API. Failed writes enter the local SQLite outbox and retry later.

```powershell
.\run.bat --watch --interval 300 --ai-every 12 "Maintain the Chennai situation picture"
```

Each refresh updates the Realtime-enabled source snapshot rows immediately. Upstream data freshness still depends on the source APIs and the configured polling interval. See `supabase/README.md` for keys, security rules and the future frontend subscription.

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
npm run test:backend
npx eslint components/sarathi-portal.tsx components/operational-map.tsx app/api/ask/route.ts app/api/system/status/route.ts lib/sarathi-ai.ts
npm run build
```

Tests cover complete provider failure, partial outages, successful empty feeds, malformed responses, and UTC precipitation windows. Test fixtures are never imported into the application.

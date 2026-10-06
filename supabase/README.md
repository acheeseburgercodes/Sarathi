# Supabase setup for Saarthi

1. Create a Supabase project.
2. Open **SQL Editor**, paste `migrations/001_saarthi_storage.sql`, and run it once.
3. Open **Settings → API Keys** and **Connect** in the Supabase dashboard.
4. Copy `.env.example` to `.env` and set:

```dotenv
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

The Python backend uses only `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. Keep the secret key on the backend. Never put it in frontend code, Git, screenshots, chat, URLs, or logs.

The future frontend should use the project URL and publishable key. Anonymous visitors can read only `saarthi_source_snapshots`, which contains public provider data. Full runs and agent reports require a Supabase-authenticated user. The migration grants no browser writes.

Use the secret key only on a controlled backend machine or server. Do not distribute it with field-device copies of the CLI. Distributed clients should use the publishable key plus Supabase Auth or call an authenticated central service.

## Live ingestion

Run one refresh:

```powershell
.\run.bat "Create a current disaster briefing for Chennai"
```

Run continuously every five minutes:

```powershell
.\run.bat --watch --interval 300 --ai-every 12 "Maintain the Chennai situation picture"
```

The first cycle runs AI. `--ai-every 12` runs AI every twelfth refresh—once per hour at a five-minute interval—while every cycle still refreshes and synchronizes source evidence. Use `--no-ai` for ingestion-only operation.

Failed Supabase writes enter the SQLite outbox and retry during the next connected run. Source collection also falls back to recent SQLite cache entries when an upstream provider fails.

## Future frontend subscription

Subscribe to changes in `saarthi_source_snapshots`, then query the changed row using the publishable key. The SQL migration adds all three Saarthi tables to the `supabase_realtime` publication.

```ts
supabase
  .channel("saarthi-live")
  .on("postgres_changes", {
    event: "*",
    schema: "public",
    table: "saarthi_source_snapshots",
  }, payload => console.log(payload))
  .subscribe()
```

“Realtime” here means database subscribers receive each successful refresh immediately. Freshness remains bounded by the polling interval and by each upstream provider's own publication cadence.

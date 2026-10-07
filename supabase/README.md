# Supabase setup for Saarthi

1. Create a Supabase project.
2. Open **SQL Editor**, run `migrations/001_saarthi_storage.sql`, then `migrations/002_auth_profiles.sql` once.
3. Open **Settings → API Keys** and **Connect** in the Supabase dashboard.
4. Copy `.env.example` to `.env` and set:

```dotenv
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

The Python backend uses only `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. Keep the secret key on the backend. Never put it in frontend code, Git, screenshots, chat, URLs, or logs.

The frontend uses the project URL and publishable key. Anonymous visitors can read only `saarthi_source_snapshots`, which contains public provider data. Authenticated users can read their own profile and update only their display name or avatar. The browser cannot assign roles.

## Google authentication

1. In Google Cloud, configure the Google Auth Platform branding, audience and the `openid`, `userinfo.email`, and `userinfo.profile` scopes.
2. Create an OAuth client with application type **Web application**.
3. Add `http://127.0.0.1:5173` as an authorized JavaScript origin.
4. Copy the callback URL from **Supabase → Authentication → Providers → Google** into Google Cloud's authorized redirect URIs. It normally has the form `https://PROJECT_REF.supabase.co/auth/v1/callback`.
5. Put the Google client ID and secret in the Supabase Google provider screen. Do not put the Google secret in this repository.
6. In **Supabase → Authentication → URL Configuration**, set the local Site URL and allow `http://127.0.0.1:5173/auth/callback` as a redirect URL. Add the production origin and `/auth/callback` URL before deployment.

Every Google account starts with the `user` role. Assign an administrator only in the SQL Editor or another service-role context:

```sql
update public.profiles set role = 'admin', updated_at = now()
where email = 'trusted-admin@example.com';
```

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

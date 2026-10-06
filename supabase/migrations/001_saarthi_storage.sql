-- Saarthi public-data storage and Realtime schema.
-- Run this once in the Supabase SQL Editor.

create table if not exists public.saarthi_runs (
  run_id uuid primary key,
  generated_at timestamptz not null,
  profile text not null check (profile in ('remote', 'standard', 'deep')),
  connectivity text not null,
  location text not null,
  query text not null,
  ai_status text not null,
  source_health jsonb not null default '{}'::jsonb,
  token_usage jsonb not null default '{}'::jsonb,
  central jsonb not null default '{}'::jsonb,
  payload jsonb not null
);

create index if not exists saarthi_runs_generated_at_idx on public.saarthi_runs (generated_at desc);

create table if not exists public.saarthi_source_snapshots (
  source_id text primary key,
  run_id uuid not null references public.saarthi_runs(run_id) on delete cascade,
  status text not null,
  source_name text,
  authority text,
  retrieved_at timestamptz,
  updated_at timestamptz not null,
  content_sha256 text not null,
  data jsonb not null
);

create index if not exists saarthi_source_snapshots_updated_idx on public.saarthi_source_snapshots (updated_at desc);

create table if not exists public.saarthi_agent_outputs (
  run_id uuid not null references public.saarthi_runs(run_id) on delete cascade,
  agent_id text not null,
  agent_name text not null,
  status text not null,
  model text,
  source_status text not null,
  report text not null,
  error text,
  created_at timestamptz not null,
  primary key (run_id, agent_id)
);

create index if not exists saarthi_agent_outputs_created_idx on public.saarthi_agent_outputs (created_at desc);

alter table public.saarthi_runs enable row level security;
alter table public.saarthi_source_snapshots enable row level security;
alter table public.saarthi_agent_outputs enable row level security;

-- Latest source snapshots contain only public provider data and may be read anonymously.
-- Full runs include operator queries and are restricted to authenticated users.
drop policy if exists "authenticated read saarthi runs" on public.saarthi_runs;
drop policy if exists "public read saarthi runs" on public.saarthi_runs;
create policy "authenticated read saarthi runs" on public.saarthi_runs for select to authenticated using (true);
drop policy if exists "public read saarthi source snapshots" on public.saarthi_source_snapshots;
create policy "public read saarthi source snapshots" on public.saarthi_source_snapshots for select to anon, authenticated using (true);
drop policy if exists "authenticated read saarthi agent outputs" on public.saarthi_agent_outputs;
drop policy if exists "public read saarthi agent outputs" on public.saarthi_agent_outputs;
create policy "authenticated read saarthi agent outputs" on public.saarthi_agent_outputs for select to authenticated using (true);

grant select on public.saarthi_runs, public.saarthi_source_snapshots, public.saarthi_agent_outputs to anon, authenticated;
grant all on public.saarthi_runs, public.saarthi_source_snapshots, public.saarthi_agent_outputs to service_role;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='saarthi_runs') then
    alter publication supabase_realtime add table public.saarthi_runs;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='saarthi_source_snapshots') then
    alter publication supabase_realtime add table public.saarthi_source_snapshots;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='saarthi_agent_outputs') then
    alter publication supabase_realtime add table public.saarthi_agent_outputs;
  end if;
end $$;

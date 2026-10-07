-- Restrict complete model runs and agent outputs to Sarathi administrators.
-- Run after 001_saarthi_storage.sql and 002_auth_profiles.sql.

drop policy if exists "authenticated read saarthi runs" on public.saarthi_runs;
drop policy if exists "admin read saarthi runs" on public.saarthi_runs;
create policy "admin read saarthi runs"
on public.saarthi_runs for select
to authenticated
using (public.is_sarathi_admin());

drop policy if exists "authenticated read saarthi agent outputs" on public.saarthi_agent_outputs;
drop policy if exists "admin read saarthi agent outputs" on public.saarthi_agent_outputs;
create policy "admin read saarthi agent outputs"
on public.saarthi_agent_outputs for select
to authenticated
using (public.is_sarathi_admin());

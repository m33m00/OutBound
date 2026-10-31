-- Keep-alive for the Free plan (Supabase pauses Free projects after 7 days of low database activity).
-- A tiny function the GitHub Action `.github/workflows/supabase-keepalive.yml` calls twice a week with the anon key,
-- so the project sees a real database request. Returns the server time and touches no table.
-- Not needed once the project is on Pro. Apply by pasting into the Supabase SQL editor (or `supabase db push`).
create or replace function public.keepalive()
returns timestamptz
language sql
stable
security invoker
set search_path = ''
as $$ select now() $$;

revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon;

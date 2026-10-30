-- Schedule DB (backlog 25). One row per flight leg, filled by the sync-schedules Edge Function from daily AeroDataBox
-- pulls and read by live-schedules for the app's search. The app never reads this table directly.
-- NOT APPLIED yet. Apply with `supabase db push` after John approves.
create table if not exists public.flight_schedules (
  -- airline + number + origin-local date + origin, e.g. WN311-2026-10-30-DAL (same rule as the engine's Flight.id)
  id text primary key,
  airline text not null check (airline ~ '^[A-Z0-9]{2}$'),
  flight_number text not null,
  origin text not null check (origin ~ '^[A-Z]{3}$'),
  destination text not null check (destination ~ '^[A-Z]{3}$'),
  depart_utc timestamptz not null,
  arrive_utc timestamptz not null check (arrive_utc > depart_utc),
  local_date date not null,
  pulled_at timestamptz not null default now()
);

-- live-schedules: departures from one airport in a time window.
create index if not exists flight_schedules_origin_depart_idx on public.flight_schedules (origin, depart_utc);
-- sync-schedules: replace one airport-day, prune old days.
create index if not exists flight_schedules_origin_date_idx on public.flight_schedules (origin, local_date);

-- RLS on with no policies: anon and authenticated roles see nothing; the service role bypasses RLS.
alter table public.flight_schedules enable row level security;

-- From 2026-10-30 Supabase no longer auto-grants Data API access to new public tables. Only the Edge Functions
-- (service role) touch this table, so only the service role gets a grant.
grant select, insert, update, delete on public.flight_schedules to service_role;

-- Paid-API usage log (backlog 8). One row per upstream call; the Edge Function sums a month to enforce
-- the $30/mo cap (alert at $24). Written and read only with the service role; the app never touches it.
-- NOT APPLIED yet. Apply with `supabase db push` after John approves.
create table if not exists public.api_usage (
  id bigint generated always as identity primary key,
  provider text not null,
  endpoint text not null,
  units integer not null check (units >= 0),
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  ts timestamptz not null default now()
);

create index if not exists api_usage_provider_month_idx on public.api_usage (provider, month);

-- RLS on with no policies: anon and authenticated roles see nothing; the service role bypasses RLS.
alter table public.api_usage enable row level security;

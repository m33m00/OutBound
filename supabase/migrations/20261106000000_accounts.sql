-- Accounts (App Store round 2, 2026-11-06). John: "Accounts should only be made with airline
-- address emails". Supabase Auth makes the accounts; this migration enforces who may have one, on
-- the server, so a changed app or a direct API call can't get around it:
--   * allowed_email_domains: airline employee email domains (a subdomain of a listed domain counts).
--   * allowed_emails: single addresses let in by hand, for the Apple App Review account and testers.
--   * a trigger on auth.users refuses any new account, or any email change, outside those lists.
--   * delete_my_account(): the in-app Delete Account button (Apple guideline 5.1.1(v)).
-- Neither list is readable through the API (row level security on, no policies). Add or remove a
-- domain in the Supabase dashboard (Table Editor) or SQL editor; it takes effect at once.

create table if not exists public.allowed_email_domains (
  domain text primary key check (domain = lower(domain) and domain !~ '^@' and domain like '%.%'),
  airline text not null,
  added_at timestamptz not null default now()
);

create table if not exists public.allowed_emails (
  email text primary key check (email = lower(email) and email like '%@%.%'),
  note text not null,
  added_at timestamptz not null default now()
);

alter table public.allowed_email_domains enable row level security;
alter table public.allowed_emails enable row level security;

-- Starter list: the airlines OutBound shows today and the regional airlines they own. Employee
-- email domains aren't published, so John should check these against people he knows at each.
insert into public.allowed_email_domains (domain, airline) values
  ('wnco.com', 'Southwest Airlines'),
  ('aa.com', 'American Airlines'),
  ('envoyair.com', 'Envoy Air (American)'),
  ('piedmont-airlines.com', 'Piedmont Airlines (American)'),
  ('psaairlines.com', 'PSA Airlines (American)'),
  ('delta.com', 'Delta Air Lines'),
  ('endeavorair.com', 'Endeavor Air (Delta)'),
  ('united.com', 'United Airlines'),
  ('alaskaair.com', 'Alaska Airlines'),
  ('horizonair.com', 'Horizon Air (Alaska)'),
  ('hawaiianair.com', 'Hawaiian Airlines'),
  ('jetblue.com', 'JetBlue'),
  ('flyfrontier.com', 'Frontier Airlines'),
  ('spirit.com', 'Spirit Airlines')
on conflict (domain) do nothing;

-- True when an address may hold an account. Callable before sign up so the app can say so kindly;
-- the trigger below is what actually enforces it.
create or replace function public.email_is_allowed(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with e as (select lower(trim(p_email)) as email, lower(split_part(trim(p_email), '@', 2)) as domain)
  select exists (select 1 from public.allowed_emails a, e where a.email = e.email)
      or exists (
        select 1 from public.allowed_email_domains d, e
        where e.domain = d.domain or e.domain like '%.' || d.domain
      )
  from e;
$$;

revoke all on function public.email_is_allowed(text) from public;
grant execute on function public.email_is_allowed(text) to anon, authenticated;

create or replace function public.enforce_airline_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null or not public.email_is_allowed(new.email) then
    raise exception 'OUTBOUND_EMAIL_NOT_ALLOWED: sign up with your airline work email'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_airline_email on auth.users;
create trigger enforce_airline_email
  before insert or update of email on auth.users
  for each row execute function public.enforce_airline_email();

-- Deletes the signed-in person's account for good. Anything else a person owns (load reports,
-- requests, once they live on the server) must reference auth.users(id) with on delete cascade,
-- so it goes with the account, as Apple requires.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Round 138: aircraft type per flight leg. sync-schedules fills it from AeroDataBox's aircraft.model
-- ("Boeing 737-800"); live-schedules returns it and the app shows the short name ("737-800").
-- Apply with `supabase db push` before deploying the updated live-schedules / sync-schedules functions.
alter table public.flight_schedules add column if not exists aircraft text;

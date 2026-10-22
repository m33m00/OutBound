# Flight status cost note (2026-10-21)

Source: aerodatabox.com/pricing. All figures are estimates; the unit cost per call is unverified until read from the plan page at signup.

- Decision: no app spend cap for now (Q-049). Usage logging (`api_usage`) stays.
- AeroDataBox flat plans below Mega have no overage, so the subscribed plan bounds spend.
- Shared cache, live status only for flights within 6h of departure: about $7.50-15/mo for 5-50 users.
- Every listed row shared through the cache: about $15-37.50/mo for 5-50 users.
- Each flight's status is fetched once per cache window into the shared server cache (TTL rule in DECISIONS.md).
- Revisit when real usage shows in `api_usage`.

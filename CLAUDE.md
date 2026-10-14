# OutBound

An iOS/Android app for airline employees who fly standby (nonrev): find routes home or out, see seat availability, and check real-time flight status, airport delays and weather. Personal/friends project, iPhone first.

- Builder: John, building with Claude Code on a Mac. Explain steps plainly; prefer small, reviewable changes.
- Stack: Expo (latest SDK) + TypeScript + Expo Router; Supabase later for reports, auth and Edge Functions.
- Run on iPhone: `npx expo start`, scan the QR code with Expo Go.
- All product rules: `design/DECISIONS.md`. Work queue: `design/BACKLOG.md`. Questions for John: `design/QUESTIONS.md`.

## Agent team

This project uses five subagents in `.claude/agents/`. Rules for the main session:

- **Source of truth:** `design/DECISIONS.md`. If any other doc, the prototype or a comment disagrees, DECISIONS.md wins. Only John changes decisions.
- **Work loop for every task:**
  1. `spec-keeper` pre-flight check on the task (GO / GO WITH NOTES / BLOCKED).
  2. The owning build agent does the work: `globe-porter` (map/globe) or `live-ops` (flight status, FAA delays, weather, radar).
  3. `qa-runner` verifies (typecheck, tests, iOS bundle). Failures go back to the owner, max 2 retries, then stop and report.
  4. `design-critic` reviews any UI or map change.
  5. Commit on a branch named after the backlog item. Summarize for John in 5 lines or fewer.
- **One backlog item per session** from the top of `design/BACKLOG.md` unless John names one.
- **Ask, don't guess:** product questions go to `design/QUESTIONS.md` in the lettered format. Keep working on parts that don't depend on the answer.
- **Never:** put API keys in app code or git; scrape airline sites; use airline logos; call paid APIs in bulk or in tests; delete or skip tests.
- **Ownership:** globe-porter → `src/map/`; live-ops → `src/live/` and `supabase/functions/live-*`; spec-keeper → `design/`. Other folders change only when the task says so.
- **Reference prototype:** `reference/globe-prototype-v9.1.html` (large; Grep it, don't read it whole).

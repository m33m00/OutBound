# OutBound

An iOS/Android app for airline employees who fly standby (nonrev): find routes home or out, see seat availability, and check real-time flight status, airport delays and weather. Personal/friends project, iPhone first.

Two people build it now: John (owner) and a friend, each working with their own Claude. Read this whole file before you change anything. Expo-specific rules are in `AGENTS.md` (imported at the end).

## Working together (read first)

1. **Start from the latest main, every time.** `git fetch origin main && git checkout -b <your-branch> origin/main`. If you're continuing your own branch, `git pull origin main` into it before you start.
2. **One branch per person per piece of work.** Never push to someone else's branch. Branch names start with `claude/` (or your own prefix) and say what the work is.
3. **Open a PR for every change. John merges.** Don't merge your own PR, don't push to `main` directly, and don't approve PRs on John's behalf.
4. **Keep PRs small and merge often.** One screen or one idea per PR, so main stays current for whoever works next. A PR that sits for days will conflict.
5. **Don't leave work unmerged at the end of a session.** Push it and open the PR, and tell John it's waiting on him to merge. Work that only lives on your machine or branch is invisible to the other person.
6. **Check open PRs before you touch a screen.** `gh pr list` (or the GitHub PR page). If the other person has an open PR on a file or screen, work on something else, or ask John to merge theirs first.
7. **Before you push:** `npx tsc --noEmit`, `npx jest`, and `npx expo export --platform ios` must all pass. Never skip, delete or weaken a test to get green; rewrite a test only when John asked for the behavior it checks to change.
8. **Write down decisions.** New rules John gives go in `design/DECISIONS.md` (newest dated rule wins). Finished work gets a row in `design/BACKLOG.md`.

### Seeing your work on a phone

Every push to `main` or any other branch publishes to Expo Go through the "Publish to Expo Go" GitHub Action (EAS Update, Expo account `outboundapp`). In Expo Go: sign in, Projects > outbound, pick the branch with your branch's name, tap the newest update. You need to be a member of the Expo organization (John invites).

## Stack

- Expo SDK 58, React Native, TypeScript, Expo Router (`src/app/`). Expo Go only: no native code that Expo Go doesn't bundle, no Reanimated (use React Native's `Animated`), and always respect Reduce Motion.
- Tests: Jest (`jest-expo`). Prettier: `npx prettier --single-quote --print-width 130 --bracket-same-line --write <files>`.
- Supabase: Edge Functions in `supabase/functions/` (FAA status, weather, radar, flight status, schedules are live). Still pending: `live-drive-time` needs Apple Maps keys (John's Apple Developer step); aircraft type needs a new schedule column pushed to Supabase; accounts (airline-email sign up/login) are built but stay off until App Store submit time.
- Secrets live only in GitHub repository secrets (`EXPO_TOKEN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `LOGO_DEV_KEY`). Never put a key in code or git.
- Don't add a package John didn't ask for. If one is needed, ask him first.
- Never call `Appearance.setColorScheme` with light or dark; it broke the map and launch animation once.

## John's design rules

Full history in `design/DECISIONS.md`; these are the ones that come up most.

**Look**

- Lead with what matters now. Keep header rows uncrowded. Pills and containers over long rows of text.
- Text: read text black, secondary text gray. **Blue (boarding blue) only for tappable things**, plus the current route dot and the picked card outline. **Amber means "you"** (your airports, your stuff).
- Buttons must look like buttons, not tappable words. One filled main button style, one light tint for secondary.
- Consistent formats and font sizes everywhere. Cards can be taller and text bigger if it helps.
- Subtle animations are fine; keep sway toned down.
- **No middle dots (·) anywhere.** No "~" on estimates. Don't use the word "open".
- No "follow the rules for sharing loads" footer.

**Times and status**

- New time big; old time small and struck through, only in the header.
- Time colors by lateness: green early, neutral on time, then yellow, orange, red as it gets later.
- Durations always `5h 0m` style.
- Departed and Arrived pills are sky cyan. On a results ticket they sit at the top, right of the times (the new time when it moved). In the opened route, each leg keeps its own pill over its route line.
- Boarding time = departure minus 40 min domestic, minus 50 min international or widebody.

**Availability**

- Just color and seat numbers. **No chance words**: no Likely, Long shot, Easy, Maybe, Unavailable. Let the user decide.
- Each leg of the route line is colored by its seats, with that leg's numbers (like 40/2) and tiny seat and person icons above it. Stop codes under the dots. Unreported seats show `-`, not 0.

**Routes and map**

- **Route lines stay straight.** Curved and flowing lines were tried and rejected.
- Map: no key or legend, no dotted lines, no direction arrows. Plain straight lines in seat colors.
- Route line spans the full card width, an even share per leg for 0 to 3 stops. Canceled leg: red line with an X and a small red Canceled pill. At risk pill sits on the connecting stop. Late pills only on opened route or flight details, not on result tickets; Diverted stays on tickets.
- Stops line under the times: `2 stops | 11h 30m | 35m connection at MIA`.
- Each flight leg is its own tappable box.

**Results and saving**

- Result tickets: clear borders, airline logo only (round badge; tap or hold for flight number and aircraft). Canceled nonstop: red border, light red tint, struck time. No red border just for a full flight.
- Saving lives on result tickets: bookmark top right, or swipe left to tear and save (Undo bar after). The route card has no Save.
- Departure and arrival can't be the same area (Dallas = DAL + DFW).
- Requests tab (was Feed): oldest first, red count badge on the tab. Requests and saved routes clear 24 hours after landing.

**Settled "no"s** (don't bring these back)

- Art on boarding passes: scrapped.
- Curved route lines: rejected.
- Airport message board: not until accounts are switched on (needs report, block and rules for posts).

**Hard rules**

- No scraping airline websites or employee portals.
- Airline logos come only from Logo.dev with the publishable key from `LOGO_DEV_KEY`; keep the Logo.dev credit in Settings.
- Membership is a demo only: no real payments.

## Agent team

`.claude/agents/` has five specialists (spec-keeper, globe-porter, live-ops, qa-runner, design-critic). Use them when they help: spec-keeper checks a task against `design/DECISIONS.md`, qa-runner runs the checks, design-critic reviews UI changes. `design/DECISIONS.md` is the source of truth and only John changes its rules. Product questions for John go in `design/QUESTIONS.md`. The large reference prototype is `reference/globe-prototype-v9.1.html` (Grep it, don't read it whole).

@AGENTS.md

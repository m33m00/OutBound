# OutBound

Standby (nonrev) travel app for airline employees. See `CLAUDE.md` for how the project is run and `design/DECISIONS.md` for product rules.

## Run it

```bash
npm install
npx expo start      # scan the QR code with Expo Go on iPhone
```

## Checks

```bash
npm run typecheck   # TypeScript
npm test            # unit tests (jest-expo)
```

## Layout

- `src/app/` — screens (Expo Router; every file is a route)
- `src/theme/` — Ice Mix colors, fonts, type, spacing
- `src/engine/` — itinerary search engine
- `src/map/` — globe (owned by globe-porter)
- `src/live/` — flight status, delays, weather (owned by live-ops)

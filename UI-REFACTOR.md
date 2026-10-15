# UI refactor — preview 0.4.0

Basis: commit `abc7ad1` (v0.3.3). This is a reviewable UI change, **not** a public production deployment.

## Scope

- Replaced hand-built inputs, autocomplete, accordions and drawers with Mantine 7 components.
- Split the MapLibre view, station picker, itinerary results and application shell into components.
- Moved request handling to TanStack Query with abort signals, language-aware keys, fixed data refresh intervals, error and empty states.
- Kept **existing** GTFS IDs, API paths, map layers, date rules and routing engine.
- Mobile: map remains primary; station picker / route results open inside a keyboard-accessible drawer.
- Retained all map uncertainty labels (projected rail geometry != verified driven track).
- Added regression tests for API URLs, error handling and selected station IDs, and GitHub CI for frontend build and backend tests.

## Install/test on a clean local checkout

```powershell
cd frontend
npm install
npm test
npm run build
cd ..
docker compose up -d --build
```

Then test manually at http://localhost:5173 on mobile and desktop: station search in all four languages; typing / clicking map stations; swap; VIA transfer; date/time; route selection; toggles; empty and network-error states; keyboard navigation; mobile drawer. Import existing data first as in README.

After a successful npm install, **commit `frontend/package-lock.json`** and change CI from `npm install` to `npm ci` before merging. This work environment could not contact the npm registry, so a lockfile or actual npm build could not be produced or verified here.

## Known release blockers (do not deploy publicly yet)

- GTFS 2M+ connection scans and map geometry still load per request; rate limits, caching and performance/load testing required.
- Current Vite/Uvicorn Docker setup is development-only.
- Map tiles / glyphs use external demo/public servers; use a supported production tile provider.
- Neither live GTFS imports nor browser rendering were verified in this environment.
- The visible UI uses Dutch prose; station labels support nl/fr/en/de. Full i18n is separate work.

## Ponytail full

Only the UI and API-state management changed; no extra server, authentication, subscription engine, Next.js migration or custom design-framework scaffolding. Existing Date rules, map layers and routing code remain in place.

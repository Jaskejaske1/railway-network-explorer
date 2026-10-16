# Atlas Rail — frontendarchitectuur (v0.4.0)

## Besluit

De React/Mantine/Vite-frontend is vervangen door **SvelteKit 2, Svelte 5, TypeScript,
Skeleton UI 4, Tailwind 4, MapLibre GL JS en @lucide/svelte**. FastAPI en PostGIS
zijn behouden en blijven eigenaar van GTFS, routeberekening en Infrabel-data.

Atlas toont in de huidige implementatie uitsluitend **huidige en toekomstige geplande treinverbindingen**.
Realtime wordt pas toegevoegd zodra een geldige feed is aangesloten; geen
historisch archief, automatische opname of fictieve realtimeposities.

## Verantwoordelijkheden

- `src/routes/+page.svelte`: UI-state en plannerinteracties, geen kaart- of SQL-logica.
- `src/lib/components/RailMap.svelte`: kaartlevenscyclus, bronnen, overlays,
  2D/3D, expliciete foutstatus en lokale basiskaartfallback.
- `src/lib/components/StationSearch.svelte`: herbruikbare, afbreekbare
  stationssuggesties uit bestaande API.
- `src/lib/components/ConnectionList.svelte`: geplande ritten en haltes.
- `src/lib/components/LayerPanel.svelte`: zichtbaarheid, basemap, perspectief.
- `src/lib/api.ts`: getypeerde API-contracten.
- `src/routes/api/[...path]/+server.ts`: allowlisted same-origin serverproxy.
- `src/lib/geo.ts`: pure presentatietransformaties met tests.
- `backend/`: bestaande data-imports, router en PostGIS.

## Basiskaartstrategie

OpenFreeMap Liberty/Bright/Positron via HTTPS; geen API-key in de client.
Kaartinitialisatie begint met een lokale MapLibre-stijl die geen extern verzoek
vereist. Een vastlopende of falende externe kaartstijl valt terug op die lokale
stijl; eigen GeoJSON-sporen blijven zichtbaar. **Een lege grijze kaart mag niet
stilzwijgend als werkend worden gerapporteerd.**

Infrabel-segmenten zijn vereenvoudigde geometrieën. Geschatte reisgeometrie
blijft apart gemarkeerd en wordt niet als exacte rijweg gepresenteerd.
3D werkt met beschikbare OSM-gebouwhoogtes, zonder fotorealismeclaim.

## Verificatie en grenzen

```powershell
docker compose up -d --build
docker compose exec web npm run check
docker compose exec web npm test
docker compose exec web npm run build
docker compose exec api python -m pytest -q
```

Browsertests worden uitgevoerd met Playwright (GitHub Actions). De tests
controleren een echte WebGL-kaart, aanwezigheid van Infrabel- en
reisbronnen en de plannerinteractie. Kaarttegels komen van een externe
provider; productie heeft een aparte beschikbaarheidsafweging nodig.
Deze mijlpaal omvat **geen realtime**, volledige vier-talige UI, satelliet,
route-arrive-by of landelijke treinindex.

## Lokale API

SvelteKit luistert op http://localhost:5173. De API is in Docker bereikbaar
via `API_ORIGIN=http://api:8000` (uitsluitend server-side); geen CORS-config
of publieke API-sleutel nodig. Directe FastAPI-documentatie: /docs op :8000.

## Implementatiestatus en grenzen van tests (16 oktober 2026)

De frontend is naar SvelteKit omgezet. GitHub Actions op commit `b64ae41`
bevestigde typecontrole, unit-tests, productiebuild, backendtests en
**vijf Playwright-browsertests** ([run](https://github.com/Jaskejaske1/railway-network-explorer/actions/runs/38885369674)).
De browsertests testen daadwerkelijke MapLibre-eigenschappen maar gebruiken
**gecontroleerde API-antwoorden en kaartstijlfixtures**. Ze bewijzen dus niet
dat alle echte data, publieke externe kaarttegels of de gebruikerservaring
aan de ontwerpspecificatie voldoen.

De gebruiker heeft de huidige localhost-interface expliciet **visueel
afgekeurd**. Geen verdere codewerkzaamheden zonder nieuwe instructie;
de huidige opdracht is documentatie consolideren.

De huidige componenten (`AtlasHeader`, `StationSearch`, `LayerPanel`)
gebruiken Skeleton-componenten, maar er resteert veel project-specifieke CSS;
'frameworks first' is een **kwaliteitsregel**, niet automatisch al bereikt.

Zie [INDEX.md](INDEX.md), [PRODUCT_BLUEPRINT.md](PRODUCT_BLUEPRINT.md),
[CURRENT_STATE.md](CURRENT_STATE.md) en [DELIVERY_ROADMAP.md](DELIVERY_ROADMAP.md).

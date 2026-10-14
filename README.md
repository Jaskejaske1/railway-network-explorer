# Railway Network Explorer — Belgische spoorweginfrastructuur

Een lokaal werkende eerste versie van een **interactieve spoorwegkaart** met zoekbare stations,
meerdere infrastructuurpaden en een optioneel tussenstation. De echte gegevens worden bij
import opgehaald van **Infrabel Open Data**. **Geen NMBS-dienstregeling, gegarandeerde treinverbindingen,
realtime-informatie of abonnementscontrole**.

## Snel starten (Docker Desktop + Docker Compose)

```bash
# 1. Pak de ZIP uit en open een terminal in deze map.
cp .env.example .env
# Wijzig DB_PASSWORD in .env voor gebruik buiten een volledig lokale ontwikkelomgeving.

# 2. Start PostgreSQL/PostGIS, de FastAPI-backend en de React/MapLibre-frontend.
docker compose up -d --build

# 3. Importeer de twee officiële Infrabel-datasets.
docker compose exec api python -m app.importer

# 4. Open de webapp in je browser.
# http://localhost:5173
# API-documentatie: http://localhost:8000/docs
```

Op Windows met PowerShell: `Copy-Item .env.example .env` in plaats van `cp`.
De poorten zijn standaard **alleen op 127.0.0.1** gepubliceerd. Bij wijzigingen in
PostgreSQL-credentials na eerste initialisatie moet ook de bestaande volume-inhoud worden
geactualiseerd; `docker compose down -v` verwijdert ALLE lokale databasegegevens.

De initiële import vraagt toegang tot `opendata.infrabel.be`. Valt de download uit, dan
wordt er **geen gedeeltelijke database** geschreven. Je kunt hetzelfde importcommando later
herhalen. Updates zijn expliciet en niet automatisch.

## Wat kan versie 0.1.2?

- De geografische geometrie van de na normalisatie overblijvende unieke
  `station_to_station`-fragmenten als overlay op OpenStreetMap-tegels tonen.
  Bronrecords kunnen dubbel voorkomen; bij de eerste gemelde import werden
  1.385 bronrecords tot 745 unieke segmenten verwerkt.
- Officiële operationele punten opzoeken via Nederlandstalige, Franstalige of operationele naam.
- Met een klik op stations op de kaart vertrek, bestemming of een verplicht tussenstation selecteren.
- De drie kortste *simpele* paden volgens geschatte Infrabel-kilometers vergelijken.
- Via een station reizen (ook wanneer dit een langere corridor oplevert).
- Lijnfragmenten inspecteren door erop te klikken; schakelaars verbergen nu ook de actieve route en gemarkeerde vertrek-/aankomstpunten.
- Leuven → Sint-Katelijne-Waver met de ingebouwde voorbeeldknop opzoeken.

**Beperkingen:** Infrabel `station_to_station` kiest bij meerdere fysieke lijnen tussen dezelfde
stations zelf de kortste; meerdere sporen tussen hetzelfde stationpaar ontbreken dus mogelijk.
Een berekend pad betekent *alleen* dat de infrastructuurgraaf aansluit. **Een via-station is geen overstapstation.** Een trein kan dit traject
misschien niet rijden; sommige routes vereisen overstappen, dienstregelingen, toegankelijkheid,
restrictions of specifieke rijrichting. Het `via`-pad kan bij een onhandig tussenstation een station
herhalen (de UI meldt dat). Infrabel-afstanden zijn schattingen en zijn **geen NMBS-tariefkilometers**.

Niet elke operationele locatie is een reizigersstation. Zoekresultaten zijn beperkt tot punten
met ten minste één lijnfragment uit de geselecteerde reizigersnetwerkdataset, maar dat is nog geen
sluitend bewijs voor een bediend station op een bepaalde datum. In toekomstige versies: GTFS.

## Databronnen

1. `operationele-punten-van-het-netwerk`: station-ID (`ptcarid`), officiële of commerciële
   namen, classificatie en ligging (`geo_point_2d`).
2. `station_to_station`: `stationfrom_id`, `stationto_id`, `length` (km) en `geo_shape`
   (GeoJSON LineString).

Infrabel Open Data biedt beide onder **CC0** aan. Bronvermelding aan Infrabel behouden,
ook al is CC0 formeel permissief. De basemap-tegels komen van **OpenStreetMap**; respecteer
hun tile-usagebeleid. Voor een publieke of drukbezochte implementatie: gebruik een geschikte
hosted tile service of host je eigen tiles.

Bronpagina's:
- https://opendata.infrabel.be/explore/dataset/operationele-punten-van-het-netwerk/
- https://opendata.infrabel.be/explore/dataset/station_to_station/
- https://opendata.infrabel.be/api/explore/v2.1/catalog/datasets/station_to_station/records?limit=1
- https://operations.osmfoundation.org/policies/tiles/

## Data-import en idempotentie

De importer gebruikt Opendatasoft Explore API v2.1, met `limit=100` en `offset`-paginering.
Beide datasets worden volledig opgehaald, genormaliseerd, gevalideerd en in één transactie
vervangen. Bij ontbrekende operationele punt-ID's worden de namen/coördinaten tijdelijk uit
het lijnfragment afgeleid. Coördinaten van die fallback zijn minder betrouwbaar.

```bash
# Herimporteren
 docker compose exec api python -m app.importer

# Oude importlog bekijken
 docker compose exec db psql -U railway -d railway -c \
   'SELECT id, imported_at, station_count, segment_count, source_name FROM import_runs ORDER BY id DESC LIMIT 5;'

# Alle services stoppen (data blijft bewaard)
 docker compose down
```

**Oplossing voor oudere projectarchieven (PostgreSQL foreign-key fout):** als je importer
`cannot truncate a table referenced in a foreign key constraint` meldt, vervang dan in
`backend/app/importer.py` de twee afzonderlijke `TRUNCATE`-aanroepen door:

```python
cur.execute("TRUNCATE TABLE rail_segments, stations")
```

In deze versie is die correctie al toegepast. De importer draait in één transactie, dus
bij een mislukte import wordt de vorige gegevensset behouden. Dankzij de `backend/app`
Docker bind mount is na deze Python-codewijziging **geen herbouw van de containers nodig**;
voer het importcommando gewoon opnieuw uit.

Ook lokale JSON kan worden geïmporteerd via `--stations-json` en `--segments-json`.
Deze bestanden moeten binnen de API-container beschikbaar zijn en kunnen een JSON-array
of een Opendatasoft API-envelope met `{ "results": [...] }` bevatten.

## Belangrijk: infrastructuur versus dienstregeling

De API toont `mode: "infrastructure_only"`, `scheduled_service: false` en
`transfer_stations: null` om duidelijk te maken dat dit **geen NMBS-reisplanner** is.
Bijvoorbeeld Leuven → Weerde via Mechelen is in deze versie alleen een pad
langs Mechelen: je krijgt **niet** te zien op welke trein je moet overstappen.
Om echte reizen via Bordet, Mechelen of Brussels Airport te tonen, moet er een
aparte GTFS-ingestie komen met een mapping van Infrabel-PTCAR naar GTFS-stop-ID,
ritten (`trips`), stopvolgordes en tijden (`stop_times`), en een tijdbewuste planner.

## GitHub publiceren vanuit je bestaande lokale projectmap

Maak eerst op GitHub een **lege** repository `railway-network-explorer` (geen README,
.gitignore of licentie laten genereren). Voer daarna in PowerShell vanuit je
projectmap uit:

```powershell
git init -b main
git add .
git commit -m "Initial Railway Network Explorer MVP"
git remote add origin https://github.com/Jaskejaske1/railway-network-explorer.git
git push -u origin main
```

Controleer vóór het pushen `git status` en `git diff --cached --stat`;
`.env`, `node_modules`, `__pycache__`, `.pytest_cache` en build-output
vallen onder `.gitignore`. Heb je lokaal al Git-geschiedenis of een remote,
gebruik dan eerst `git status` en `git remote -v` en voeg geen dubbele remote toe.

## API

- `GET /api/health` — API-status.
- `GET /api/meta` — aantallen en herkomst van de laatste import.
- `GET /api/network` — GeoJSON FeatureCollection met lijnfragmenten.
- `GET /api/stations/geojson` — stationpunten.
- `GET /api/stations?search=Leuven&limit=15` — zoek stations.
- `GET /api/routes?from_id=...&to_id=...&alternatives=3` — infrastructuurpaden.
- `GET /api/routes?from_id=...&to_id=...&via_id=...` — corridor via een station.

De primaire sleutels zijn **Infrabel PTCAR-ID's** (tekst), niet NMBS/GTFS-stop-ID's.
Voor integratie met NMBS/GTFS is later een expliciete `station_identifier_mapping` nodig.

## Datamodel en routing

Zie [`docs/data-model.md`](docs/data-model.md) voor het relationele model, de bronvelden,
geometrie en de grenzen van routing. Kern: PostgreSQL 16 + PostGIS 3.4, FastAPI,
NetworkX en React + MapLibre GL JS.

## Tests

```bash
# Geen productiegegevens nodig
 docker compose exec api pytest -q /app/tests

# Frontend: uitgevoerd in de webcontainer (devdependencies aanwezig)
 docker compose exec web node --test src/*.test.js
```

Je kunt de pure Python-tests ook lokaal draaien met een virtuele Python-omgeving:

```bash
cd backend
python -m pip install -r requirements.txt
python -m pytest -q
```

## Ontwikkelmodus

`docker compose up -d --build` start de Vite-devserver en Uvicorn met auto-reload.
Code uit `frontend/src` en `backend/app` is als read-only bind mount gekoppeld; lokale
wijzigingen worden opgepikt. Deze Docker-configuratie is **niet geschikt als productieconfiguratie**
(devservers, development database credentials en externe kaarttegels).

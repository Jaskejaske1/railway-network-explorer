# Railway Network Explorer — v0.3.3

Interactieve webapplicatie die één zoek- en reisplanner combineert met de Infrabel-infrastructuurkaart en NMBS GTFS-dienstregeling. Treinreizen bestaan uit daadwerkelijke geplande GTFS-ritten en overstappen; de achtergronduitlijning van sporen komt uit Infrabel. In v0.3.3 worden treinreizen waar mogelijk langs Infrabel-station-naar-station-segmenten geprojecteerd (een **benadering**, niet de geverifieerde rijweg van de trein). Ontbrekende koppelingen blijven zichtbaar als **gestippelde rechte lijnen**.

## Wat werkt in deze versie?

- Eén geïntegreerde kaart en reisplanner, **zonder tabbladen**.
- Vertrek- en aankomststations zoeken in **Nederlands, Frans, Duits en Engels**; de geselecteerde weergavetaal verandert het label op de kaart en in routebeschrijvingen. De overige UI-tekst is nog Nederlands.
- De vier stationsnaamvarianten worden uit de [iRail Stations API](https://docs.irail.be/) gehaald, via het **canonieke NMBS-stationnummer** aan GTFS gekoppeld en gecontroleerd op nabijheid. Ontbrekende namen blijven op de oorspronkelijke GTFS-naam staan. Dit is geen automatische vertaling.
- Infrabel-spoorfragmenten, GTFS-stations en geplande ritten samen op de kaart.
- Routeoverzicht met geplande treinritten en overstapstations, volgens GTFS Static.
- Geen realtime data, garantie van abonnementsdekking of exacte spoorgeometrie van ritten.

**Bronnen:** Infrabel Open Data (operationele punten, `station_to_station`), NMBS GTFS Static via Belgian Mobility, stationsnaamvertalingen uit iRail, kaart © OpenStreetMap-bijdragers. Houd bij publicatie rekening met hun licenties en gebruiksvoorwaarden.

## Update vanaf v0.3.1

Zie [LOCAL-UPDATE.md](LOCAL-UPDATE.md) voor exacte Windows/PowerShell-instructies. De kern:

```powershell
docker compose up -d --build
docker compose exec api python -m app.gtfs_translations
curl 'http://localhost:8000/api/gtfs/translations/meta'
curl 'http://localhost:8000/api/gtfs/stations?search=Leuven&lang=nl'
```

Geen `down -v` en **geen herimport van de grote GTFS-feed** nodig. De taalimport schrijft uitsluitend naar een nieuwe afgeleide tabel.

## Eerste installatie

```powershell
Copy-Item .env.example .env
docker compose up -d --build
docker compose exec api python -m app.importer
docker compose exec api python -m app.gtfs_importer --url
docker compose exec api python -m app.gtfs_translations
```

`/api/meta`, `/api/gtfs/meta` en `/api/gtfs/translations/meta` tonen de actuele importstatus. De data zitten in het Docker-volume `postgres_data`, niet in Git.

## API-overzicht

- `GET /api/gtfs/stations?search=Leuven&lang=fr` — zoekt in alle taalvarianten, toont de Franse naam.
- `GET /api/gtfs/stations/geojson?lang=de` — GTFS-stations voor de kaart met Duitse namen indien beschikbaar.
- `GET /api/gtfs/translations/meta` — telling van gekoppelde namen per taal en Leuven-voorbeeld.
- `GET /api/gtfs/labels/meta` — compatibele oude diagnose-URL (nu zelfde informatie als hierboven).
- `GET /api/gtfs/routes?from_id=...&to_id=...&date=2026-10-15&time=08:00&lang=nl` — geplande reizen in de gekozen stationsnaamtaal.
- `GET /api/network` — Infrabel-infrastructuur als GeoJSON.
- `GET /api/routes?from_id=...&to_id=...` — onderzoeks-API voor fysieke infrastructuurpaden, **geen reisadvies**.

API-documentatie: http://localhost:8000/docs. Dezelfde `gs:nmbssncb:S...` GTFS-stop-ID's worden gebruikt voor stations zoeken, aanklikken en treinreisrouting, ongeacht taal.

## Tests

```powershell
docker compose exec api pytest -q /app/tests
docker compose exec web npm test
```

De ontwikkelconfiguratie gebruikt Uvicorn/Vite met hot reload; niet rechtstreeks als publieke productie-server inzetten. Bij fouten: `docker compose logs api --tail 100`.


## v0.3.3 — Infrabel-lijngeometrie, toekomstige datums en overstappen

- Eén geïntegreerde planner; GTFS bepaalt welke **treinen** bestaan. Infrabel wordt uitsluitend
  gebruikt om het traject **bij benadering** te tekenen langs bekende spoorsegmenten.
  De afzonderlijke GTFS-haltes zijn via meertalige officiële namen + coördinaten conservatief
  gekoppeld aan Infrabel-operationele punten. Geen automatische claim van de exacte rijweg,
  geen wisselmodellering en **geen geldigheid van abonnementen**.
- Ontbrekende segmenten zijn zichtbaar als **gestippelde** rechte lijnen; de reiskaart vermeldt
  hoeveel delen niet konden worden gekoppeld. De Infrabel-netwerkgeometrie blijft onafhankelijk.
- Reisdatum begint op vandaag in **Europe/Brussels**; vertrektijd begint op het eerstvolgende
  afgeronde tijdstip. Past-date verzoeken, en vertrektijden in het verleden op dezelfde dag,
  worden ook server-side geweigerd. De GTFS-einddatum blijft de bovengrens.
- Extra optioneel station `OVERSTAPPEN IN`, bv. **Bordet**: zoekt uitsluitend GTFS-reizen die
  daar daadwerkelijk van `trip_id` veranderen (met minimaal 3 minuten overstaptijd).
  **Geen gevonden reis** betekent niet automatisch dat de officiële NMBS-reisplanner ongelijk heeft:
  onze zoekhorizon (6 uur) en beperkte routerstrategie kunnen alternatieven missen.
- Deze release gebruikt bestaande PostgreSQL/PostGIS, Infrabel- en GTFS-data;
  **niet opnieuw importeren**, **geen `docker compose down -v`**.

### Lokaal upgraden (PowerShell)

```powershell
cd D:\source\repos\railway-network-explorer
# Download de ZIP naar D:\Downloads, en pak uit over de bestaande projectmap:
Expand-Archive -Path "D:\Downloads\railway-network-explorer-v0.3.3.zip" -DestinationPath "D:\source\repos" -Force
docker compose up -d --build

docker compose exec api pytest -q /app/tests
docker compose exec web npm test
```

Test in de browser met een toekomstige datum en **Leuven → Weerde**. Kies daarna bij
`OVERSTAPPEN IN` expliciet **Bordet** om die specifieke mogelijkheid te onderzoeken.
Controleer of de blauwe route op de donkere sporen ligt en of ontbrekende stukken gestippeld zijn.
Push naar GitHub alleen na een geslaagde browsertest.

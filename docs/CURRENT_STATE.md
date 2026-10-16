# Atlas — actuele technische en visuele status

**Vastlegging:** 16 oktober 2026  
**Gebaseerd op:** repository `Jaskejaske1/railway-network-explorer`, commit `b64ae41631a5cb18edc84cb53ba802c2a3fcf36f`; lokale Docker-log en screenshots gedeeld op 16 oktober.  
**Status:** software draait, kaart is zichtbaar, **productinterface NIET visueel geaccepteerd**.

## 1. Wat is daadwerkelijk bevestigd?

| Onderdeel | Waarneming / bewijs | Wat het niet bewijst |
|---|---|---|
| Git | `git pull --ff-only origin main` van `0de998d` naar `b64ae41` succesvol | Niet dat elke gewijzigde UX klopt |
| Docker | `docker compose up -d --build web` geslaagd; `db` healthy, API/web running | Geen visuele goedkeuring of bewezen realtime |
| Backend | Laatste lokale `python -m pytest -q`: **36 tests geslaagd** | Niet dat elke GTFS-reis in productie correct is |
| Frontend CI | Svelte-typecheck, unit-tests en Vite-productiebuild geslaagd | Niet dat de stijl voldoet aan de conceptbeelden |
| Browser CI | **5/5** Chromium-/Playwright-tests groen voor `b64ae41` ([run](https://github.com/Jaskejaske1/railway-network-explorer/actions/runs/38885369674)) | Ze gebruiken gecontroleerde API-/basemapfixtures en zijn geen visuele acceptatietests |
| Werkelijke kaart | Laatste gebruikersscreenshot toont **OpenFreeMap-basemap met Belgische Infrabel-overlay** | Geen bevestiging van correcte echte satelliet/3D of rijke UX |
| GTFS en infrastructuur | Gebruikersscreenshot vermeldt **745 Infrabel-segmenten**, geplande NMBS GTFS-ritten en geen realtime | 745 grove segmenten zijn niet exact de volledige fysieke spoornetstructuur |

De CI-test voor de kaart controleert dat MapLibre geladen is, bronnen/lagen zichtbaar of verborgen kunnen worden, basemaps wisselen en de camera in 2D/3D van pitch verandert. De externe vectorbasemap wordt in tests bewust met een voorspelbare stijl beantwoord; **een groene test is geen bewijs van correcte externe tilelevering bij de gebruiker**.

## 2. Expliciete visuele afwijzing

De gebruiker zegt bij de recente localhost-screenshot: **"hiervoor was het letterlijk beter"** en wil **eerst uitsluitend alle ideeën netjes documenteren**.

Wat zichtbaar is op het screenshot:
- Een echte geografische kaart van België met steden, wegen, groen, water en een spooroverlay; dus **niet langer het vroegere grijze lege kaartvlak**.
- Een witte header met Atlas Rail-naam, eenvoudige zoekinvoer en taalkeuze.
- Een wit linkerpaneel met gewone rechthoekige tekstvelden, datum/tijd en een disabled/ongeactiveerde zoekknop; weinig visuele verfijning en veel lege ruimte.
- Veel stationsmarkers en spoorlijnen op landsniveau; weinig progressieve reductie van kaartdetails.
- Kleine kaartlegendetekst en kaartbedieningsiconen; het eerder goedgekeurde 'Cartographic Studio × Railway Wayfinding'-concept is niet zichtbaar gerealiseerd.

**Dit zijn waarnemingen en gebruikersfeedback, geen goedkeuring van toekomstige stijlwijzigingen.** De rechterhelft van het oorspronkelijke conceptbeeld met kantelende/3D-gebouwen is **niet** op het actuele screenshot aangetoond; de huidige MapLibre-knop verandert in tests de pitch, wat iets anders is dan visueel afgewerkt 3D.

## 3. Implementatie versus productbesluit

| Onderdeel | Huidige status | Beslissing / gewenste richting |
|---|---|---|
| Technische basis | SvelteKit 2 / Svelte 5 / TypeScript, Skeleton 4, Tailwind 4, MapLibre 6, FastAPI/PostGIS | Behouden tenzij expliciete nieuwe beslissing |
| Header | Skeleton AppBar aanwezig, Ctrl+K in browser getest | Visueel nog niet geaccepteerd |
| Stationszoeker | Skeleton Combobox, toetsenbord/muis en wisselen getest | Zoekrelevantie met echte data nog afzonderlijk verifiëren (`leu` → Leuven) |
| Laagmenu | Skeleton Popover, Switch en Slider; visibility/opacity/style/camera getest | Volwaardige per-categorie UX en presentatie nog beoordelen |
| Linkerpaneel | Vast links paneel, beperkte CSS-resize / aan-uit | Contextueel, betrouwbaar resizable, mobile Drawer, state/history |
| Kaartgeografie | OpenFreeMap Liberty/Bright/Positron; attributie; lokale fallback | Geografisch rijk, leesbare spoorlay-out, providerrobuust |
| Infrabel-geometrie | Ca. 745 grove netwerksegmenten zichtbaar | Verrijken alleen via gevalideerde datasets, geen exacte spoorclaims |
| Planner | Geplande GTFS + enkele overstappen | Betere scoring, echte arrive-by, pass-through-via later |
| Realtime | **Niet geïmplementeerd** | Realtime-first voor toekomstige publieke lancering, nette fallback |
| Stationsborden/treinzoeker | **Niet als volwaardige feature geïmplementeerd** | Pas bij betrouwbare API/feed |
| Geschatte treinposities | **Niet geïmplementeerd** | Optioneel, uitdrukkelijk als schatting |
| Historische opname/replay | **Niet geïmplementeerd** | **Expliciet uitgesloten** |
| Volledige taalondersteuning | Stationslabels/keuze deels beschikbaar; NL UI overheerst | UI en namen volledig NL/FR/DE/EN |
| Satelliet/hybride | **Niet geïmplementeerd** | Later, afhankelijk van wettelijke/toegangskosten |
| 3D | Kaartperspectief via MapLibre, extrusiecode aanwezig | Werkelijk visueel valideren waar hoogtegegevens bestaan |
| Deep links/history | **Niet volledig geïmplementeerd** | Later routerintegratie, zonder geïmproviseerde glue |
| SaaS/selfhosting | Geen productrelease | Strategisch open; nu localhost en gratis persoonlijk |
| Uitsluitend docs | **Huidige opdracht** | Niet aan applicatiecode werken tot nieuwe instructie |

## 4. Waarom de tests tot nu toe niet volstaan

- Unit-tests laten zien dat geïsoleerde domeinfuncties consistent werken, niet dat een gebruiker een goede app ziet.
- Playwright gebruikt de meeste huidige productdata als **mocks** en laat onafhankelijke externe-tilevoorwaarden buiten scope; nuttig voor regressie, ontoereikend voor releaseacceptatie.
- Een foto van een draaiende kaart toont **werkelijke rendering** maar valideert geen reisdetails, API-freshness, interactiegedrag of data-integriteit.
- Aantoonbaar werkend en visueel goed zijn **verschillende acceptatiepoorten**. De huidige interface passeert de tweede uitdrukkelijk niet.

## 5. Huidige grote risico's — nog geen nieuwe taken

1. **Productdesign**: UI oogt te veel als ruwe formulier-/kaartintegratie; voldoet niet aan de goedgekeurde visuele standaard.
2. **Datagetrouwheid**: Infrabel-segmenten en gerenderde ritprojectie zijn grof; teken geen exacte spoor- of GPS-claim.
3. **Realtime ontbreekt**: product heet live-first als visie, maar toont op dit moment enkel geplande GTFS.
4. **Providerafhankelijkheid**: basemap vereist externe OpenFreeMap-toegang, fallback biedt slechts beperkte context. Satelliet/3D niet beloven als uitgewerkte functie.
5. **Frontendrealiteit**: hoewel Skeleton-componenten zijn toegevoegd, blijven de samenhang, vormgeving, responsiviteit en echte gebruikstesten open punten.
6. **Bronlicenties**: NMBS-feedlicentie, toekomstige commerciële rechten en kaartproviderterms vóór publieke publicatie verifiëren.
7. **Documentconflicten**: oude README- en v0.1-data-modelvoorstellen mogen niet als actuele functies worden gelezen.

## 6. Afgesproken pauzestand

**Tot een nieuwe expliciete opdracht komt: geen wijzigingen aan `frontend/`, `backend/`, `docker-compose.yml`, database, datasets of CI-tests.** Alleen documentatie structureren en definitieve vs ingetrokken productkeuzes bewaren.

Een volgende bouwopdracht moet altijd bij het **laatst door de gebruiker goedgekeurde document en daadwerkelijke broncode** beginnen; niet rechtstreeks afleiden uit een conceptafbeelding of uit een eerder groen CI-resultaat.

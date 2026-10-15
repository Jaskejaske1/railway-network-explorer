# Project Atlas — productbeslissingen en scope

> **Status: BESLIST / leidend besluitregister**
> **Vastgelegd:** 16 oktober 2026
> **Huidige referentie:** `Jaskejaske1/railway-network-explorer`, commit `98abeb7` (v0.3.4, UI Increment 01).
> **Project Atlas** is uitsluitend een **tijdelijke ontwikkelnaam**, geen definitieve branding. De bestaande repositorynaam hoeft niet te veranderen.
> **Doel van dit document:** voorkom scope creep. Bij tegenstrijdigheden geldt de meest recente expliciete beslissing, met name de scopegrens in §1. Oudere ontwerpvoorstellen zijn niet automatisch opnieuw geldig.

## 1. De harde grens — NIET onderhandelbaar zonder nieuw expliciet besluit

**Atlas is een LIVE platform voor de huidige situatie en treinverbindingen in de nabije toekomst. Het is GEEN historisch archief.**

Wat **wel** binnen scope valt:

- Huidige NMBS-treindienst: geplande ritten in de beschikbare actuele GTFS-dienstregeling en actuele realtime-updates waar de gegevensbron dit ondersteunt.
- Nabije toekomstige verbindingen, met correcte dienstregelingsdatums, automatische overstappen, vertragingen en annuleringen waar bekend.
- Actuele Belgische spoorweginfrastructuur verkennen en combineren met de geografische kaart.
- Stations, spoorsegmenten, individuele ritten en bruikbare bronmetadata onderzoeken.
- Kortstondige, functionele caching en de **actieve** dienstregeling in PostgreSQL/PostGIS; geldige backups voor herstel.
- Stabiel blijven bij tijdelijk ontbreken van realtimegegevens: expliciet terugvallen op geplande tijden, zonder verouderde realtime-informatie als live te presenteren.

Wat **niet** binnen scope valt:

- Zelf realtime-treinupdates op lange termijn loggen, opnemen of archiveren.
- Historische ritgeschiedenis, permanente feed-snapshots, event sourcing of een eigen historisch datawarehouse.
- Historische treinbewegingen reconstrueren of afspelen; geen tijdmachine of replay.
- Oude infrastructuursituaties reconstrueren of een historische infrastructuurkaart bouwen.
- Een 24/7-datacollector uitsluitend voor toekomstige historische analyses.
- Analytics over historisch treinverkeer, punctualiteit per maand/jaar of historische trenddashboards.

**Operationele persistentie is geen historisch archief:** we bewaren uitsluitend wat nodig is om huidige en toekomstige ritten goed te tonen, gecontroleerd te updaten en na een storing te herstellen. Het bestaan van backups is geen toestemming om oude ritdata als onderzoeksarchief te behouden. Geen nieuwe tabellen/processen voor tijdreeksen zonder een nieuwe expliciete scopebeslissing.

### Definitie van 'realtime-first'

- *Realtime-first* betekent: gebruik actuele meldingen boven geplande gegevens, **wanneer ze betrouwbaar beschikbaar zijn**.
- Realtime feeds worden kort gecachet en krijgen een expliciete freshness-grens; na die grens vervallen ze als actuele bron.
- Zonder werkende realtime feed blijft de geplande GTFS-dienstregeling bruikbaar, met zichtbare status **Gepland / actuele info niet beschikbaar**.
- Treinen op de kaart zijn een **optionele, goed vindbare laag**. Posities mogen *geschat* worden als de gegevens voldoende betrouwbaar zijn. Een schatting wordt nooit als GPS-gemeten voorgesteld. Bij onvoldoende zekerheid geen marker.
- Geen eis om zelfstandig continu data te registreren wanneer de applicatie niet draait.

## 2. Productidentiteit en scope

- De reisplanner en de infrastructuurverkenner zijn **gelijkwaardige onderdelen van één interface**; geen gescheiden hoofdmodi.
- De unieke meerwaarde is de **synergie tussen dienstregeling/realtime treinverkeer en Infrabel-infrastructuur op een geografische kaart**.
- Doelgroep: publiek én technische/spoorweggeïnteresseerde gebruikers. Standaard eenvoudig, **technische diepgang op aanvraag** (*progressive disclosure*), geen afzonderlijke beginner-/expertmodus.
- Intern de werknaam **Project Atlas**. Een breder toekomstig platform is denkbaar; spoorwegen zijn nu de enige concrete domeinscope. Andere Belgische OV-netwerken **niet nu implementeren**.
- Geen brandingtraject, commercieel betaalsysteem of definitieve bedrijfsnaam nu. Cartografische identiteit gewenst; een generiek verbonden-lijntjes-logo is afgewezen. Logo/monogram later.
- **Eerst persoonlijk, lokaal en gratis** ontwikkelen. Commerciële SaaS en/of een self-hosted communityversie zijn **latere strategische opties**, geen huidige deliverables.
- Publieke lancering is niet toegestaan voordat bronlicenties, privacy, veiligheid, infrastructuur en belastbaarheid zijn gecontroleerd. Publieke GitHub-code geeft niet automatisch rechten om brondata te distribueren.

## 3. UX- en UI-contract

### Algemene principes

1. **Map-first:** de kaart domineert. CARTO Voyager als visuele geografische uitgangsbasis, niet een kale grijstintenkaart. Context (wegen, wijken, water, groen, relevante publieke locaties) helpt de gebruiker zich oriënteren.
2. **Cartographic Studio als vormtaal**, gecombineerd met **Railway Wayfinding** voor leesbaarheid en informatiestroom. Sober maar niet kleurloos. Kleur communiceert betekenis, consistent in kaart en UI.
3. Één coherente Mantine-theme met tokens, typografie, spacing en Tabler SVG-iconen. **Geen Unicode-/ASCII-pijlen of browserafhankelijke symbolen als bedieningsiconen; geen geïmproviseerde browser-embeddings of decoratieve dashboard-badges.**
4. **Libraries eerst:** gebruik de bestaande Mantine-, MapLibre- en TanStack-oplossingen, en een volwassen router/i18n-library waar nodig. Geen eigen 'lijm': eventbus, drag-handlers, router, dropdown, overlay of dubbele state-opslag zolang standaardframeworks dit oplossen. Custom code uitsluitend voor productspecifieke domeinlogica.
5. Goede labels, subtitels, contextuele acties, natuurlijke navigatiestromen, toegankelijkheid, duidelijke laad-/fout-/lege statussen en mobiele bediening.
6. Nieuwe informatieverzoeken mogen bestaande selectie en resultaten niet onbedoeld wissen. Zware routeberekeningen starten **expliciet** met een zoekactie; in de zoekvelden mogen suggesties automatisch komen.
7. Geen demo-knoppen, ruwe databank-ID's, `WGS84`-labels, permanente statusbubbels of technische ontwikkelaarstekst in de hoofdinterface.

### Layout en interacties

- **Echte horizontale header over de hele applicatie**, geen losse zwevende 'headerbubbels'. Links productidentiteit, centraal een **zichtbaar universeel zoekveld**, rechts alleen functionele acties zoals taal en help. Zoekactie ook via `Ctrl+K`.
- **Contextueel linkerpaneel**: compacte reisplanner bovenaan; onderaan afhankelijk van actie reisresultaten, stationsinformatie, spoordetails of treinritdetails. Standaard circa **400 px**; **resizable én inklapbaar**, lokale breedtevoorkeur. Op mobiel een toegankelijke Drawer, niet een zelfgemaakte swipe-sheet.
- **Planner eerst open; na zoeken ingeklapt** tot een trajectsamenvatting met *Wijzigen*. De huidige reiscriteria en resultaten blijven bewaard tijdens inspectie.
- **Compacte resultaten** als goed vergelijkbare rijen. Uitgebreide ritdetails **vervangen tijdelijk de resultatenlijst**, met terugnavigatie. Geen panelen in panelen of overmatig cards-in-cards.
- Navigatie van detailweergaven werkt via **zowel eigen terugknop als browsergeschiedenis**, en geselecteerde objecten zijn via **deep links** te delen. Normaal zoomen/pannen vervuilt de geschiedenis niet.
- Universeel zoeken ondersteunt stations, spoorlijnen en treinritten **voor zover daadwerkelijk beschikbaar**. Het is afzonderlijk van de planner met eigen Van/Naar-velden.
- **Compacte kaartpopup** bij stations-/segmentklik; *Meer informatie* opent uitgebreide details in het paneel. Eigen reisplanning blijft bewaard.
- Klik op een trein: volledige ritdetails links, bijbehorende route op de kaart. Klik op een andere trein tijdens reisplanning: tijdelijke kaartfocus; *Terug naar mijn reis* herstelt de voorgaande reisfocus.
- De kaart verspringt niet tijdens updates, selecties of openen van details. Gericht kaartkader op expliciete gebruikersactie, behoudens duidelijke eerste zoekfocus.
- **Reisroutes:** geselecteerde route blauw, alternatieven gedempt grijs, spoorinfrastructuur neutraal; gedeelde corridor geen verwarrende dubbelgetekende parallelle lijnen. Onzekere projectie zichtbaar als benadering, niet als gegarandeerde werkelijk gevolgde spoorligging.
- **Reisadvies**: uitlegbare aanbevelingen op basis van actuele verwachte aankomst, reistijd, aantal overstappen en aansluitingrisico. Sortering op alternatieve criteria mogelijk.
- **Vertrek vanaf** én **Aankomst uiterlijk**; laatste vereist echte routerondersteuning, geen UI-schijnfunctie.
- **Overstappen berekent het algoritme automatisch.** De enige gewenste optionele routerestrictie in de gewone UI is **Reizen via** (station aandoen, zonder verplicht daar te wisselen). Het bestaande veld *Verplicht overstappen in* verdwijnt uit de gewone gebruikersinterface.
- Realtime-updates actualiseren gekozen reizen en waarschuwen voor gemiste aansluitingen, maar **herordenen resultaten of herberekenen de hele route niet automatisch**. Gebruiker kan opnieuw zoeken.
- Stationdetail combineert **live vertrektijden/aankomsten** en infrastructuur; verdiepte ritinformatie is op aanvraag bereikbaar.
- Meertaligheid: automatische browserdetectie NL/FR/DE/EN, fallback NL, handmatige keuze lokaal onthouden. **Volledige UI** vertalen en alle officiële stationnamen doorzoekbaar houden.
- Onboarding later: korte overslaanbare kennismaking en subtiele contextuele hints. **Geen werkpakket dat de productkern vertraagt.**

### Cartografie en lagen

- **Standaardkaart toont heel België**, zonder automatische geolocatieprompt.
- **Progressieve detaillering op zoomniveau:** landelijke spoorcorridors en knooppunten, bij inzoomen kleinere spoorlijnen, stations, labels en betrouwbare infrastructuurdetails.
- **Voyager-achtige rijke kaart** met wegen, buurten, water, groen en relevante publieke locaties, niet overvol met commerciële POI's.
- Subtiele geografische spoorlijnen **blijven onder** de herkenbare Infrabel-overlay zichtbaar, zodat verschillen kunnen worden onderzocht. Kaartlagen hebben ieder hun eigen submenu; infrastructuuroverlay heeft zichtbaarheid én transparantie-instelling.
- Thematische infrastructuurkaarten zijn **optioneel** (bv. elektrificatie, ETCS, verkeerscategorie), alleen voor daadwerkelijk beschikbare betrouwbare geografische gegevens; een tijdlang kan dit later worden gebouwd. Eén thematische inkleuring tegelijk met eigen legenda.
- Basiskaartkeuze: Voyager standaard; **satelliet en hybride** gewenst wanneer een legale, betaalbare bron beschikbaar is.
- **3D gebouwen** gewenst als optionele kaartweergave; standaard 2D en directe echte 2D/3D-knop op de kaart. Gebouwhoogtes/tilt alleen bij voldoende onderliggende data. Geen fotorealistische 3D-eis.
- Live/geschatte treinposities in optionele goed vindbare laag; niet voortdurend zichtbaar op alle zoomniveaus.
- Bronvermelding van kaart- en databronnen waar vereist blijft zichtbaar/bereikbaar; technische bronmetadata geïntegreerd in objectdetails, met eventueel een verdiepende bronweergave.

### Semantische kleuren (goedgekeurde ontwerprichting, toegankelijkheid testen)

| Betekenis | Richtkleur | Gebruik |
|---|---|---|
| Actieve selectie en primaire actie | Blauw `#1769E0` | Actieve treinreis, focus, primaire knop |
| Bevestigde normale status | Groen `#21845B` | Werkelijke status, geen fictieve 'online'-badge |
| Vertraging en waarschuwing | Oranje `#C67A16` | Risico, vertraging, overstapwaarschuwing |
| Fout en afschaffing | Rood `#C83F45` | Fouttoestand, geannuleerde rit |
| Secundair/inactief | Neutraal `#788697` | Alternatieve routes, achtergrondinformatie |

Nooit uitsluitend op kleur vertrouwen; labels, iconen, patronen en contrast blijven nodig. De eerdere UI-specificatie `railway-explorer-uiux-spec-v1.md` is **een ouder voorstel** en is niet leidend waar deze latere besluiten afwijken (o.a. echte header, realtime-first, automatische overstappen, keuze Voyager/hybride, bredere context).

## 4. Data, backend en betrouwbaarheid

- **Huidige stack behouden waar passend:** React + Vite, Mantine en MapLibre; FastAPI; PostgreSQL/PostGIS; Docker Compose; TanStack Query voor API-state. Geen technologie vervangen zonder probleem dat ermee opgelost wordt.
- Bronrollen gescheiden: **NMBS/Belgian Mobility** voor dienstregeling en actuele meldingen, **Infrabel** voor spoorweginfrastructuur en verrijkingsvelden, **iRail** voor stationsnamen voor zover toegestaan/beschikbaar, kaartprovider voor geografische oriëntatie.
- Het huidige Infrabel-graafpad is **slechts een geometrische benadering** van het afgelegde spoor. Geen onbewezen claims over exacte sporen, wissels, perrons of posities.
- Aanvullende huidige Infrabel-attributen (lijnnummer, elektrificatie, aantal sporen, verkeer, ETCS, mogelijk snelheid) importeren **alleen als bron/licentie en ruimtelijke koppeling zijn gevalideerd**. Geen afgeleide eigenschappen als feit voorstellen als niveau/match niet klopt.
- **Robuuste operationele opslag:** relationele tabellen en PostGIS met constraints, bronidentiteit, actuele importmetadata en gecontroleerde staging/validatie/activering. Een mislukte import tast de actieve data niet aan.
- **Geen permanente geschiedenistabellen voor de treinfeeds.** Vervang/activeer actuele datasets gecontroleerd; gebruik korte caches voor realtime. Data-freshness, bereik van de huidige GTFS-feed, verschillen in service-datum en rit-ID expliciet behandelen.
- Querylimieten, pooling, timeouts, correct gebruik van indexes, gecontroleerde importjobs, foutafhandeling, gezondheidschecks, backups en herstelprocedures zijn onderdeel van robuustheid voordat de website publiek wordt.
- **Bronlicenties staan los van programmeerkwaliteit en GDPR.** Controleer vooral NMBS-gebruiksvoorwaarden voor publicatie, commerciële toegang, retentie of verdere distributie. Geen veronderstelling dat bewerkte/afgeleide data automatisch vrij te verkopen is.
- **Privacy-first:** geen accounts, geen advertentietracking; zo weinig mogelijk persoonsgegevens/logging. Eventuele privacyvriendelijke bezoekersanalytics zijn later mogelijk met passende rechtsgrond/toestemming. Uitgebreide productanalytics is **geen huidig werkpakket**.

## 5. Levering, releases en huidige prioriteit

- **Eerst localhost en uitsluitend persoonlijk gebruik**; installatie en tests via Docker Compose op Windows. Geen Oracle-, Nginx-, domein-, betaal- of SaaS-uitrol nu.
- We behouden de huidige PostgreSQL-data/volumes. **Nooit destructieve volume-reset** als normale update-instructie; `docker compose down -v` is niet toegestaan zonder afzonderlijk expliciet doel.
- Kleine, functionele **verticale increments** met UI en backend die samen correct werken, maar geen ongecontroleerde wijziging van alles tegelijk.
- Elke code-increment wordt aangeleverd als **volledige ZIP én `.patch`**, met basiscommit, changelog, toepassings-/rollbackcommando's en concrete tests. **De gebruiker past toe, test, commit en pusht. De assistent pusht niet.**
- Volg de **Ponytail-skill**: kleinste volledige oplossing, bestaande frameworks/componenten, geen zelfgebouwde integratielijm, tests voor nieuwe betekenisvolle logica en uitleg van bekende beperkingen.
- **Actieve prioriteit:** professionele lichte map-first UI-refactor van de huidige applicatie, gecombineerd met noodzakelijke API-/datamodelverbeteringen. Daarna live ritupdates en betrouwbare infrastructuurdata. Geen productiehosting totdat persoonlijke versie kwalitatief goed is.
- Huidige bevestigde Git-basis bij vastlegging: `98abeb7` op `main`; Increment 01 (Mantine-stationszoeker) gecommit en gepusht door gebruiker. De nieuwe besluitdocumentatie is **geen nieuwe feature-release**.

## 6. Vraag- en beslisregister

Dit register bewaart de expliciet gemaakte keuzes. **Vervallen** betekent dat een latere uitspraak de eerdere keuze heeft ingetrokken; die mag niet alsnog als backlogitem terugkeren.

| Vraag | Onderwerp | Vastgelegde keuze / huidige interpretatie |
|---|---|---|
| 1 | Hoofdidentiteit | **C:** reisplanner en infrastructuurverkenner gelijkwaardig, één synergetische app. |
| 2 | Startkaart | **B:** progressieve detailniveaus. |
| 3 | Linkerpaneel | **B:** contextueel paneel met planner bovenaan. |
| 4 | Stationsklik | **B:** compacte kaartpopup, details op aanvraag; reis bewaren. |
| 5 | Plannerbreedte/zichtbaarheid | **B:** formulier na zoeken samenvouwen. |
| 6 | Alternatieve reizen op kaart | **B:** actieve route blauw, alternatieven grijs. |
| 7 | Spoorsegment klikken | **A:** popup en echte brondata in details; geen lege decoratie. |
| 8 | Infrastructuurdiepgang | **B:** verrijkte gegevens, alleen betrouwbaar beschikbaar; robuuste opslag. |
| 9 | Technische kaartlagen | **B:** optionele thematische lagen. |
| 10 | Actuele data | **Realtime-first**; actuele en nabije toekomstige verbindingen, niet alleen static. |
| 11 | Realtime weggevallen | **A:** automatisch terugvallen op duidelijk gelabelde geplande dienstregeling. |
| 12 | Treinen op kaart | **B:** optionele, wel goed vindbare feature mits bronkwaliteit. |
| 13 | Posities schatten | **A:** toegestaan, expliciet *geschat*, geen GPS-claim. |
| 14 | Realtime resultaatupdates | **A:** bijwerken zonder hersorteren/verplaatsen; risicowaarschuwing. |
| 15 | Stationsdetail | **B:** live vertrek/aankomst en infrastructuur samen, verdiepbare realtimegegevens. |
| 16 | Trein selecteren | **A:** volledige ritdetails en traject op kaart. |
| 17 | Andere trein onderzoeken | **A:** tijdelijk focussen, eigen reis intact. |
| 18 | Initieel kaartkader | **A:** heel België, geen verplichte locatie. |
| 19 | Infrastructuur zoeken | **B:** universele zoekfunctie. |
| 20 | Plek universele zoekfunctie | **B:** header, `Ctrl+K`. |
| 21 | Delen | **B:** deep links naar reis/station/spoor/trein/kaartcontext. |
| 22 | Doelgroepen | **C:** voor breed publiek én experts, detail op aanvraag. |
| 23 | Taal | **A:** browserdetectie NL/FR/DE/EN, override, lokale voorkeur. |
| 24 | Sorteren reisadviezen | **B:** uitlegbare aanbevolen reizen, overige sorteeropties. |
| 25 | Vertrek- of aankomstmoment | **B:** vertrekken vanaf of aankomen uiterlijk. |
| 26 | Overstappen/via | **Herzien:** overstappen altijd automatisch; optioneel *Reizen via*, geen verplichte wissel. |
| 27 | Reisresultaten | **C:** compacte rij + uitgebreide detailweergave; echte iconen, geen Unicode-pijltjes. |
| 28 | Detailnavigatie | **A:** detail vervangt tijdelijk resultatenlijst. |
| 29 | Navigatiegeschiedenis | **A:** browser- én paneelterug; details deelbaar, kaartstate bewaren. |
| 30 | Onboarding | **C:** introductie + hints; uitgesteld, niet afleidend. |
| 31 | Cartografische stijl | **B richting A:** geografisch rijk en herkenbaar. |
| 32 | Geografische context | **B:** relevante POI's, geen commerciële overbelasting; Voyager. |
| 33 | Basiskaartsporen vs Infrabel | **B:** beide zichtbaar, visueel te vergelijken. |
| 34 | Laaginstellingen | **B:** per categorie apart menu, zichtbaarheid en transparantie. |
| 35 | Basiskaarttypen | **B uitgebreid:** Voyager, satelliet, hybride; 3D gewenst indien praktisch. |
| 36 | 3D-activatie | **B:** expliciet; standaard 2D. |
| 37 | 3D-knop | **A:** directe 2D/3D-control op de kaart. |
| 38 | Applicatieheader | **A gewijzigd:** echte horizontale header, geen zwevende bubbels. |
| 39 | Globaal zoeken | **A:** zichtbaar geïntegreerd zoekveld in header. |
| 40 | Visuele identiteit | **B + A:** Cartographic Studio met Railway Wayfinding. |
| 41 | Informatiedichtheid | **B:** gebalanceerd en adaptief. |
| 42 | Linkerpaneelbreedte | **B:** resizable én inklapbaar. |
| 43 | Beeldmerk | **A of C overwogen:** geen simpele verbonden lijn, branding nu parkeren. |
| 44 | Productstructuur | **B:** mogelijke paraplu; Railway Explorer als merk niet passend, werknaam Project Atlas. |
| 45 | Abstracte merkidentiteit | **C:** eigen abstract merk, **uitgesteld**. |
| 46 | Historische tijdlijn | **B destijds, nu VERVALLEN** wegens definitieve live-only-scope. |
| 47 | Bronnen tonen | **B:** bron/actualiteit in objectdetails. |
| 48 | Bezoekersanalytics | **B eventueel C:** privacyvriendelijk; uitgebreide analytics **uitgesteld**. |
| 49 | Ritgeschiedenis opslaan | **B destijds, nu VERVALLEN**; geen opname of archief. |
| 50 | Historische netwerkweergave | **B destijds, nu VERVALLEN**; geen replay of tijdmachine. |
| 51 | Frontend/backend aanpak | **B:** complementaire verticale increments, geen losstaande megaprojecten. |
| 52 | Omgeving | **C nader ingeperkt:** nu localhost; self-hosting/hosting later, niet eerste doel. |
| 53 | Commercialisering | **Open:** mogelijk SaaS later, nu privé en gratis; geen licentie/model vastgelegd. |
| 54 | Continue opname/server | **Afgewezen:** geen 24/7-datacollector of historische registratie. |

## 7. Wijzigingsprocedure voor dit besluitregister

1. Alleen een **expliciete nieuwe gebruikersbeslissing** kan de live-only-scope of een andere harde productkeuze wijzigen.
2. Een latere losse suggestie van de assistent is **geen goedkeuring** en geen backlogitem.
3. Maak bij wijzigingen een kleine, gerichte update van dit bestand, met datum, wat is vervangen en waarom.
4. Vermeld in iedere relevante volgende increment expliciet: **geen historisch archief; alleen heden en nabije toekomst**.
5. Ontwerpvragen zijn nu voldoende uitgewerkt om te ontwikkelen. Stel alleen een nieuwe vraag als er een reële product- of implementatiebeslissing ontbreekt.

---

**Samenvatting in één zin:** Project Atlas is een lokale, gratis, later eventueel publiceerbare **realtime-first kaartapplicatie voor actuele Belgische spoorweginfrastructuur en huidige/nabije toekomstige treinverbindingen**, met een professionele, toegankelijke UI en **zonder historische dataregistratie of archieffuncties**.

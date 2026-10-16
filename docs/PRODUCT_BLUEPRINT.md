# Atlas — product- en UX-blauwdruk

**Datum:** 16 oktober 2026  
**Type:** gewenste productervaring, **geen implementatieverslag**.  
**Leidend:** [PRODUCT_DECISIONS.md](PRODUCT_DECISIONS.md). Bij conflict wint het recentste expliciete productbesluit.

## 1. Wat bouwen we eigenlijk?

**Een kaartgericht platform om de actuele Belgische spoorweginfrastructuur te ontdekken én de huidige of nabije toekomstige NMBS-treinverbindingen te begrijpen en te plannen.** Het ene versterkt het andere: spoorwegen zijn niet enkel achtergronddecor bij een reisadvies, en de reisplanner is geen losse module naast een GIS-kaart.

- **Eén interface, twee gelijkwaardige perspectieven:** reiziger en spoorweg-/infrastructuurgeïnteresseerde.
- **Progressive disclosure:** standaard snel en begrijpelijk; op aanvraag technische kaartlagen, metadata, complete stopvolgorde en onzekerheden.
- **Live-first, niet recording-first:** actuele stand en nabije toekomst; géén opslag of onderzoek van historische treinbewegingen.
- **Persoonlijke eerste versie:** gratis op localhost; latere publieke of commerciële varianten zijn strategische mogelijkheden, geen huidig werk.
- **Voorlopige namen:** *Project Atlas* voor initiatief, *Atlas Rail* voor spoorapp. Merk, logo, domein en uitbreidingen naar ander OV uitgesteld.

## 2. Wat is nadrukkelijk niet de bedoeling?

Geen realtimefeed permanent opnemen, geen tijdmachine, geen rit-/vertragingenarchief, geen oude netwerktoestanden reconstrueren en geen 24/7 collector voor analyses. Geen live-GPS claim wanneer posities slechts worden geschat. Geen niet-bestaande informatie presenteren alsof die uit officiële databronnen komt.

Evenmin: een overdadig dashboard met fictieve badges, technische debugtekst in de primaire UI, een namaak-interface met dode knoppen, of een eigen componentenframework terwijl een goed onderhouden library dit al kan.

## 3. Kernscenario's

### A. Een reis plannen

1. Bij openen zie je België in zijn geografische context en een compact, maar direct bruikbaar plannergedeelte.
2. Typen van `leu` toont **Leuven hoog in de relevante suggesties**, niet willekeurige deelmatches boven belangrijke prefixmatches. Suggesties zijn toetsenbordtoegankelijk en naamvarianten werken onafhankelijk van de ingestelde UI-taal.
3. Kies vertrek, aankomst, dienstregelingsdatum en **Vertrek vanaf**; optioneel later **Aankomst uiterlijk** met een écht achterwaarts zoekalgoritme.
4. **Zoek reizen** start de berekening; het wijzigen van een veld doet dat niet voortdurend opnieuw.
5. Reizen tonen tijden, duur, automatische overstappen, begrijpelijke status, eventuele realtimevertragingen en risico op gemiste aansluitingen. Alternatieven zijn vergelijkbaar; aanbevelingslogica is uitlegbaar.
6. Na zoeken klapt de planner in tot een aanpasbare trajectsamenvatting met **Wijzigen**. De geselecteerde reis wordt helder blauw op de kaart aangegeven, alternatieven gedempt grijs.
7. Een uitgeklapte reis toont treinbenamingen, haltes, overstappen en een expliciete waarschuwing waar geometrie slechts een benadering is. Gedetailleerde weergave vervangt de resultaten in het linkerpaneel; met **Terug** kom je terug zonder verlies van context.

**Overstappen berekent de router.** Een optionele toekomstige instelling **Reizen via [station]** betekent passeren; géén verplicht uitstappen of van `trip_id` wisselen. De oude verplichte-overstapfunctie is **geen gewenste UI-feature**.

### B. Een station onderzoeken

Klik op de kaart: kleine popup met naam en een zinvolle actie. Open daarna stationsdetails in het linker contextpaneel: huidige vertrekkende/aankomende treinen (realtime waar betrouwbaar), perroninformatie indien onderbouwd, bron-/actualiteitsinformatie, infrastructuurrelaties en acties **Vertrek hier** of **Aankomst hier**. Reeds gezochte reis blijft behouden.

### C. Spoorinfrastructuur inspecteren

Klik op een echt Infrabel-segment: toon bruikbare gegevens in een popup en het detailpaneel. Lijnnummers, aantal sporen, elektrificatie, ETCS, verkeerscategorie en snelheden alleen wanneer de bronvelden, dekking en ruimtelijke mapping gevalideerd zijn. Als data ontbreekt: **onbekend**, geen aannames. Onderliggende basemapsporen en de Infrabel-overlay mogen onafhankelijk worden vergeleken.

### D. Een specifieke trein volgen (later, na betrouwbare feed)

Zoek/selecteer treinrit en bekijk de geplande en actuele stopvolgorde. Markeer het traject op de kaart. Een kaartpositie wordt alleen weergegeven wanneer de beschikbare ritupdates en routegegevens een voldoende betrouwbare **schatting** toelaten; label het als **geschat**, niet als live-GPS. Focus op een andere rit mag de oorspronkelijke reis niet wissen.

### E. Kaart ontdekken

Aanvankelijk heel België; geen automatische locatieprompt. Bij uitzoomen alleen belangrijke corridors en grote knooppunten; bij inzoomen meer stations, lokale infra, labels en technische details. Bronvermelding is zichtbaar en geen verborgen ontwikkelaarinformatie.

## 4. Visueel contract: Cartographic Studio × Railway Wayfinding

**Het goedgekeurde conceptbeeld is een visuele ambitie, geen screenshot van werkende software.** De feitelijke localhost-interface is op 16 oktober expliciet als **slechter dan eerdere versies / niet visueel geaccepteerd** beoordeeld.

- **Vaste, horizontale, sobere witte header**, volledige breedte; identiteitsblok links, zichtbare universele zoekfunctie in het midden, alleen echte taal-/informatieacties rechts. `Ctrl+K` activeert zoeken.
- **Linker contextpaneel** ca. 400 px standaard: planner en contextdetails; aanpasbare breedte, inklapbaar, plaats lokaal onthouden. Op mobiel een echte toegankelijke Drawer.
- **Kaart vult de rest**, geen decoratieve zwevende dashboards. Veel ruimte voor geografische oriëntatie; correcte focus, herhaalbare kaartactie, voorspelbare navigatie.
- **Rijke lichte cartografie:** straten, wijken, gebouwfootprints, wegen, water, groen, relevante publieke POI's en herkenbare spoorinfrastructuur. Het oog moet een echte regio herkennen, niet enkel een netwerkgraaf op een lege achtergrond. Voyager-achtig is de richting; externe provider is niet het productontwerp.
- **Eigen Infrabel-overlay** herkenbaar over subtiel aanwezige basemapsporen. Blauwe actieve route, gedempte alternatieven, duidelijke begin-/eindpunten en zoomafhankelijke detaillering. Geen dubbel getekende corridors die twee parallelle sporen suggereren als daar maar één is.
- **Kaartinstellingen georganiseerd per type**: basiskaart; Infrabel-infrastructuur; treinverkeer/reis; thematische technische kaartlagen. Zichtbaarheid en relevante transparantie met duidelijke legenda.
- **2D standaard**; directe 2D/3D-knop met werkelijke MapLibre pitch, en 3D-gebouwextrusies alléén waar hoogtegegevens aanwezig zijn. Dit is **geen fotorealistische Google-3D**. Satelliet en hybride zijn optionele latere kaartbronnen afhankelijk van rechten/kosten.
- **Informatiedichtheid adaptief:** primaire tijden en bestemmingen groot genoeg om te scannen, technische detailvelden compact maar leesbaar. Geen willekeurige kleur-, grootte- of spacingvarianten.
- **Interactiestatussen integraal:** laden, lege zoekresultaten, onbereikbare provider, geen feed, verouderde realtime-info, onbekende data en kaartfouten hebben inhoudelijke, zichtbare uitleg. Geen blanco kaart zonder diagnose.
- **Geen kunstmatige interface-elementen:** echte SVG-iconen via library, niet tekens zoals Unicode-pijlen als iconen; geen API-ID's of gegenereerde demo-informatie in gebruikersinterface.

Indicatieve semantische kleurtaal (niet de definitieve designsystem-palette): actief blauw `#1769E0`; normale bevestigde status groen `#21845B`; waarschuwingen oranje `#C67A16`; afschaffingen/fouten rood `#C83F45`; secundair grijs `#788697`. Altijd contrast, tekstlabels en niet uitsluitend kleur.

## 5. Informatiearchitectuur en navigatie

- **Universele headerzoeker**: station, spoorlijn en treinrit, **alleen wanneer index/API werkelijk beschikbaar**. Groepeer resultaten duidelijk per categorie.
- **Contextpaneel** voor planner, resultaatslijst, reisdetails, station, lijn/segment of treinrit. Huidige selectie/zoekcriteria blijven bewaard.
- **Browser-URL en history** weerspiegelen gekozen object of reis; deelbare deep links waar privacyveilig. Kaart pan/zoom mag de history niet volspammen.
- Compacte map-popup voor snelle context; diepere acties openen zijpaneel. **Terug naar mijn reis** herstelt vorige reisfocus.
- **Geen automatisch verspringende kaart** bij realtime updates; geen stiekeme herordening van de resultaten.
- Desktop en mobiel hebben dezelfde kernmogelijkheden. Geen vereiste account of login voor privégebruik.
- NL/FR/DE/EN UI (later volledig) met browserdetectie, NL als fallback en bewaarde manuele keuze; stationsnamen in alle talen doorzoekbaar.

## 6. Inhoudelijke betrouwbaarheid en bronkwaliteit

**NMBS GTFS Static**: geplande treinritten, stops, kalenders; actuele feedgeldigheid en Europe/Brussels-tijd strikt verwerken. **Realtime feeds**: actuele vertragingen, afschaffingen, perron-/ritupdates als beschikbare bron ze echt levert; weer vervallen zodra ze niet actueel zijn. **Infrabel**: bestaande infrastructuur, niet automatisch de werkelijk gereden spoorlijn van een trein. **iRail/naamverrijking**: gekoppelde meertalige stationsvarianten, bronafhankelijk. **OSM/OpenFreeMap**: cartografische ondergrond met zichtbare attributie.

Routeprojectie langs Infrabel-segmenten blijft een **benadering**; ontbrekende koppeling wordt duidelijk zichtbaar en verklaard. Geen claim dat stationpositie een perronpositie is. Gebruik voor aanvullende infrastructuurdata een gevalideerde datamapping en traceerbare actuele importmetadata. Geen eigen historisch treinfeedarchief.

Niet alleen de reisinhoud maar ook de **freshness, herkomst en betrouwbaarheid** moeten te begrijpen zijn. Bij uitval van realtime valt het product expliciet terug op geplande GTFS-informatie. Geen verplichte 24/7 logging.

## 7. Ontwerpregels die toekomstige ontwikkelaars moeten respecteren

1. **Ponytail**: kleinste complete oplossing, gebruik officiële/framework-componenten; schrijf uitsluitend domeinspecifieke code zelf.
2. SvelteKit + TypeScript + **Skeleton** voor de UI, MapLibre voor kaartinteractie, FastAPI voor backend/routeplanning, PostGIS voor geografische opslag. Geen React terugbrengen of tweede planner in de frontend introduceren zonder expliciet besluit.
3. Semantisch juiste interacties, volledige toetsenbordbediening, responsieve layouts en gebruiksgerichte fouten.
4. **Verifieer in de browser met werkelijke API-data** naast deterministische testfixtures. Groen CI is niet gelijk aan goedgekeurde UX.
5. Geen productie-/hosting-/monetisatiearchitectuur als extra werk; privé `localhost` eerst.
6. Alleen expliciet goedgekeurde productkeuzes worden ontwikkeltaken. Een idee in dit document betekent niet dat het de volgende increment is.

## 8. Later mogelijk, maar geen huidige opdracht

- Betrouwbare live stationsborden/ritdetails en optionele geschatte treinmarkers (na validatie).
- Extra betrouwbare Infrabel-kaartlagen, ETCS/elektrificatie/technische details.
- Satelliet/hybride, 3D-gebouwen, professionele legendes, diepe kaartfocus.
- Arrive-by-router, routeadviesrangschikking, pass-through-via, deelbare URL's, volledige i18n.
- Privacyvriendelijke gebruiksstatistiek, optionele onboarding.
- Publicatie, SaaS of gedeeltelijke self-hosting; commerciële exploitatie pas na licentieonderzoek.
- Op lange termijn misschien andere Belgische vervoersmodi, **zonder nu al generieke multimodale architectuur te bouwen**.

**Nooit alsnog als 'later' toevoegen:** eigen historisch treinarchief, replay/tijdmachine of permanente realtimefeed-opname. Deze plannen zijn uitdrukkelijk ingetrokken.

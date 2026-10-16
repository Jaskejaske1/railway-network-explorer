# Atlas — gefaseerde leveringsroadmap (concept, geen bouwopdracht)

**Datum:** 16 oktober 2026  
**Status:** volgorde en acceptatieprincipes ter bewaring. **Geen implementatie starten zonder nieuwe instructie.**  
**Prioriteit:** kwaliteit van een bruikbare privéversie boven het aantal zichtbare functies.  
**Productgrens:** uitsluitend **heden en nabije toekomstige treinverbindingen** plus actuele infrastructuur. Geen historisch archief.

## 0. Eerst: documentatie bevriezen, product opnieuw beoordelen

- De huidige SvelteKit-/Skeleton-/MapLibre-versie is **technisch gestart en in CI getest, maar visueel niet geaccepteerd**.
- Deze documentatiefase verandert **geen UI-, API-, Docker-, database- of testcode**.
- Pas wanneer de gebruiker daar om vraagt: oorspronkelijke conceptreferentie en huidige localhost-screenshot naast elkaar leggen, component voor component een doel/acceptatiecriterium vastleggen.
- **Geen grote frontendherschrijving zonder meetbaar voordeel**; de stack zelf opnieuw wijzigen is geen antwoord op ontbrekende UX-kwaliteit.

## Werkvolgorde als de ontwikkeling wordt hervat

Dit zijn **werkpakketten**, geen datums, sprinttoezeggingen of opdracht om ze nu uit te voeren. Een werkpakket wordt opgesplitst als het niet in één kleine, onafhankelijk testbare increment past.

| Fase | Focus | Minimale bruikbare oplevering | Nu? |
|---|---|---|---|
| 0 | Documentatie en scope | Eén consistente leidende specificatie en eerlijk statusoverzicht | **Ja, uitsluitend docs** |
| 1 | Visuele productbasis | Professionele applicatieschil, juiste componentlibrary, bruikbare kaart en interactieve basistoestanden | Alleen na nieuw verzoek |
| 2 | Reisplanner + API als één geheel | Relevante zoekresultaten, correct geplande reizen, robuuste selectie en routevisualisatie | Daarna |
| 3 | Actuele ritinformatie | Geldige realtimefeed, staleness en fallback, vertraging/afschaffing, live stationdetails | Vereist vóór publieke lancering |
| 4 | Betrouwbare infrastructuurverrijking | Gevalideerde Infrabel-data, bronmetadata, technische lagen zonder fictieve attributen | In kleine stappen |
| 5 | Gebruikskwaliteit en uitrol | i18n, deep links, toegankelijkheid, mobiele UX; later veiligheid, bronlicenties en productieoperatie | Afhankelijk van doel |
| Niet gepland | Historische functies | **Geen** archief, replay, trenddatawarehouse of permanente realtime-opname | **Uitgesloten** |

### Fase 1 — echte app-shell en kaartkwaliteit

**Waarom:** actuele UI laadt een kaart, maar is volgens de gebruiker visueel achteruitgegaan. Niet een nieuwe naam, extra iconen of meer featureknoppen bouwen.

In afzonderlijke increments:
1. Design tokens en componentrichtlijnen vastleggen en aantonen via een klein aantal echte Skeleton-componenten; geen dubbele stylinglaag als de library die al biedt.
2. Header / universeel zoeken: visuele integratie, focus, suggesties, fout-/lege toestand; alleen ondersteunde zoekcategorieën tonen.
3. Linkerpaneel: volwassen lay-out, goede breedteverhouding, resizable/collapse met onderhoudbare library; contextnavigatie die de reis bewaart.
4. Kaart: aantrekkelijke, **werkelijke** geografische basemap, goed leesbare Infrabel-overlays, controleerbare 2D/3D, niveauafhankelijke labels, attributie.
5. Reisresultaten en details: overzichtelijke tijden, automatische overstappen, informatiehiërarchie, geen geneste kaarten-chaos.
6. Responsief gedrag: mobiele Drawer, kaartbediening, toetsenbord en schermlezer.

**Acceptatie:** uitgevoerde screenshots van **echte localhost met eigen PostgreSQL-data**, plus de afgesproken browser- en API-tests. Geen acceptatie op basis van een illustratie of een enkele groene Vite-build.

### Fase 2 — correcte reisplanner, niet méér UI-opties

- Zoekrelevantie: `leu` moet Leuven boven toevallige deelmatches prioriteren; verifieer dit met echte data.
- Vertrek vanaf; geplande ritten met automatisch berekende overstappen, geldige GTFS-service-datums en Europe/Brussels.
- Reisresultaten mogen geen onjuiste claim doen over de exact gereden spoorroute.
- Pas **later**: echt arrive-by, uitlegbare betrouwbare ranking, pass-through-via. Geen bedieningsoptie voordat backendgedrag correct is.
- Systeem geeft expliciet aan wanneer een zoekhorizon of onvolledige data geen volledige NMBS-dekking bieden.

**Acceptatie:** een end-to-end reis zoals Leuven–Weerde met **echte API en database**, zichtbare vertrek-/aankomsttijden, haltes, overstappen en corresponderende route. Geen alleen gemockte tests.

### Fase 3 — realtime zonder historisch archief

- Licentie-/toegangsvoorwaarden van NMBS/Belgian Mobility vooraf verifiëren.
- Actuele updates ophalen en **kortstondig cachen**, met expliciete tijdstempels en vervaltijd.
- Afwijkingen op geplande ritten toepassen, duidelijk verschil tussen **gepland**, **actueel** en **niet beschikbaar**.
- Bij uitval statische GTFS blijven gebruiken; geen stilzwijgend achterhaalde 'live' informatie.
- Geselecteerde reizen bijwerken zonder kaart te verplaatsen of de lijst onverwacht te herschikken; riskante aansluitingen signaleren.
- Optionele geschatte treinen op de kaart pas als de onzekerheid eerlijk te communiceren is.

**Acceptatie:** verifieerbare updates, een test met onderbroken feed, staleness, annulering en consistente planning. **Geen achtergrondrecorder.**

### Fase 4 — spoorgegevens en technische lagen

- Werk met reeds bestaande Infrabel-open datasets, bij voorkeur fijnere geometrie waar betrouwbaar beschikbaar.
- Import: goed gevalideerde velden, bronversie/actualiteitsinformatie, veilige actieve-datasetvervanging en operationele herstelmogelijkheid.
- Lagen zoals elektrificatie, ETCS, aantal sporen en verkeerscategorie **per brononderbouwing**; geen fake legendes voor ontbrekende attributen.
- Geen eigen GIS-product of datawarehouse bouwen: benut PostgreSQL/PostGIS en MapLibre.

### Fase 5 — privé stabiel, eventueel later publiek

- Volledige gebruikersgerichte NL/FR/DE/EN UI, toegankelijkheid, responsiviteit, deelbare detail-URL's.
- Voor publiek: risicoanalyse van alle datasets en kaartproviders, bronattributie, cache-/rate-limitbeleid, security, backups, herstel, monitoring, capaciteit, privacy.
- SaaS en/of gedeeltelijke self-hosting blijven *open businessvragen*. **Geen premature tenant-, betaal- of accountarchitectuur.**

## Acceptatiepoort voor elke toekomstige code-increment

1. **Een zin probleemdefinitie**: welk bestaand waarneembaar probleem wordt opgelost?
2. **Libraries eerst**: Skeleton, SvelteKit, MapLibre en bestaande backend; geen nieuwe eigen componentenlaag of onnodige pakketstapel.
3. **Wijzigingen klein**: één samenhangende interactie, bijbehorende API-logica alleen indien noodzakelijk; geen ongeplande scope.
4. **Eenheidstest waar inhoudelijke logica is**, Svelte-typecheck, productiebuild, passende backend-/integratietests.
5. **Playwright met realistische interacties** (focus, muis, toetsenbord, zichtbaarheid, route, kaartstijl); waar bruikbaar gecontroleerde mocks voor determinisme.
6. **Daarnaast echte end-to-end smoketest** met localhost, lokale API/PostGIS, echte kaarttegels, zichtbare foutmeldingen en screenshotcontrole.
7. **Gebruiker keurt UX expliciet goed**. CI-groen is slechts technische controle.
8. **Transparant afronden**: concrete wijzigingen, wat is getest, wat niet, bekende fouten, rollback. Geen gebruik van demo-data als bewijs voor productkwaliteit.
9. **Geen volume-reset** om tests te laten slagen; nooit `docker compose down -v` bij gewone update.
10. Alleen na uitdrukkelijke herstart van codewerk: wijzigingen op `main` via normale niet-geforceerde commits, met CI en afgesproken rollbackprocedure.

## Prioriteringsregel tegen scope creep

Nieuwe suggesties gaan alleen door wanneer (a) ze passen binnen live-only, (b) een actuele concrete gebruikersbehoefte oplossen, (c) brongegevens/library beschikbaar zijn en (d) de toegevoegde complexiteit gerechtvaardigd is. Anders documenteren als **idee** of markeren als **uitgesloten**, niet implementeren.

**Belangrijk:** deze roadmap bewaart ideeën; ze autoriseert geen implementatie. De opdracht op 16 oktober is **uitsluitend documentatie consolideren**.

# Atlas — documentatie en bron van waarheid

**Laatst bijgewerkt:** 16 oktober 2026  
**Status:** productvisie vastgelegd; huidige frontend **niet visueel geaccepteerd**.  
**Projectnaam:** *Project Atlas* / *Atlas Rail* is voorlopig.  
**Werkafspraak:** tot nader order **uitsluitend documentatie**, geen verdere implementatie.

## Begin hier

| Document | Doel | Status |
|---|---|---|
| [PRODUCT_DECISIONS.md](PRODUCT_DECISIONS.md) | Expliciete keuzes, ingetrokken beslissingen en de **harde live-only-scope** | Normatief voor productbeslissingen |
| [PRODUCT_BLUEPRINT.md](PRODUCT_BLUEPRINT.md) | Samenhangend UX-/functiebeeld: hoe Atlas moet aanvoelen en werken | Gewenste eindrichting; **niet** de huidige implementatie |
| [DELIVERY_ROADMAP.md](DELIVERY_ROADMAP.md) | Gefaseerde, kleine increments en acceptatiepoorten | Voorstel voor latere uitvoering, **niet geautoriseerd om nu te bouwen** |
| [CURRENT_STATE.md](CURRENT_STATE.md) | Wat aantoonbaar draait, wat nog niet werkt of niet is bewezen, en de visuele feedback | Momentopname van 16 oktober 2026 |
| [FRONTEND_ARCHITECTURE.md](FRONTEND_ARCHITECTURE.md) | Huidige SvelteKit-/MapLibre-/API-indeling en technische risico's | Technische referentie, geen kwaliteitsgarantie |
| [data-model.md](data-model.md) | Vroeg infrastructuurdatamodel en zijn beperkingen | **Historisch technisch ontwerp**; check code en database voor actuele waarheid |

## Hiërarchie bij tegenstrijdigheden

1. **Recentste expliciete instructie van de gebruiker**: eerst documenteren; voorlopig niets verder bouwen. Atlas is uitsluitend gericht op **het heden en de nabije toekomst**. Geen historisch treinarchief.
2. [PRODUCT_DECISIONS.md](PRODUCT_DECISIONS.md), inclusief latere herzieningen en expliciet ingetrokken keuzes.
3. [PRODUCT_BLUEPRINT.md](PRODUCT_BLUEPRINT.md) voor gewenste UX en functies, niet als bewijs dat ze bestaan.
4. [CURRENT_STATE.md](CURRENT_STATE.md) plus actuele code en geslaagde tests voor aantoonbare implementatiestatus.
5. Eerdere concepten, screenshots en oorspronkelijke README-secties zijn **referentie**, geen nieuw besluit.

**Statuswoorden:** **Beslist** = gewenst productgedrag; **Geïmplementeerd** = in code aanwezig; **Getest** = genoemde testcontrole geslaagd; **Visueel geaccepteerd** = gebruiker heeft daadwerkelijke UI goedgekeurd; **Uitgesteld** = idee, geen huidig werk; **Uitgesloten** = strijdig met scope. Een test die slaagt betekent niet automatisch visuele acceptatie.

## Onveranderlijke productrichting (tenzij expliciet herzien)

Atlas verenigt een **treinreisplanner voor actuele en nabije toekomstige ritten** met het **verkennen van het bestaande Belgische spoorwegnet op een rijke interactieve kaart**. Realtime-updates krijgen, als beschikbaar en betrouwbaar, voorrang; anders is de dienstregeling expliciet als gepland gelabeld. De gebruiker wil een professioneel platform, geen conceptmockup.

**Geen historische feeds, ritarchief, tijdmachine, continue registratie of eigen historisch datawarehouse.**

De eerste uitvoeringsdoelstelling is **persoonlijk, gratis, localhost**. Open-source-, self-hosting- en commerciële SaaS-modellen zijn nog niet gekozen. Bronlicenties gelden ook voor persoonlijk gebruik.

## Documentatieonderhoud

- Geen nieuw werkpakket zonder afzonderlijke opdracht of duidelijke vervolgbeslissing.
- Bij wijziging: leg expliciet vast **wat** gewijzigd is, **waarom** en **welke oudere passage vervalt**.
- Documenteer onzekerheid: geen provider-, 3D-, routing-, realtime- of testgaranties verzinnen.
- Code of configuratie verandert niet in een documentatiecommit. We werken rechtstreeks op `main` **als de gebruiker later weer implementatie vraagt**.

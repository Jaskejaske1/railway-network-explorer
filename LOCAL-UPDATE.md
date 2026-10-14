# Lokale update naar v0.3.3

1. Bewaar je bestaande `.git`-map en PostgreSQL-volume. Geen `down -v`.
2. Pak de volledige ZIP uit met `-Force` in `D:\source\repos`, zodat
   `D:\source\repos\railway-network-explorer` wordt bijgewerkt.
3. Voer `docker compose up -d --build` uit in de projectmap.
4. **Geen data-import nodig:** Infrabel, GTFS en vertalingen blijven in het volume.
5. Test `docker compose exec api pytest -q /app/tests` en `docker compose exec web npm test`.
6. Open `http://localhost:5173` (Ctrl+F5). Controleer:
   - datum vandaag of later, tijd later dan nu (Belgische tijd)
   - Leuven → Weerde: spoorgeometrie in plaats van ononderbroken rechte lijnen
   - `Overstappen in` Bordet: echte treinwissel of eerlijk 'geen route'
   - kaartschakelaars en taalkeuze
7. Bekijk de route via `GET /api/gtfs/routes?...` bij problemen en de API-log:
   `docker compose logs api --tail 100`.
8. Als alles werkt:
   `git status`, `git add .`, `git commit -m "Improve train geometry and future-date planning"`,
   `git push origin main`.

Opmerking: Infrabel-segmenten geven een **benaderde** lijngeometrie.
Bij ontbrekende stationkoppelingen zie je gestippelde rechte segmenten.
De routeengine is nog geen volledige NMBS-reisplanner; geen realtime of abonnementsgeldigheid.

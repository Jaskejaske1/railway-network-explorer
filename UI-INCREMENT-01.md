# UI increment 01 — Station search (v0.3.4)

Base: public `main` commit `abc7ad1` (v0.3.3). This change is limited to the station search UI and its API client.

## Scope

- Replace custom dropdown with keyboard-accessible Mantine Combobox and TextInput.
- Use TanStack Query for cancellable, deduplicated station searches.
- Add robust same-origin API JSON/error handling with one small unit test.
- Keep GTFS station identifiers, route API, Infrabel geometry, date logic, database and Docker configuration unchanged.

## Apply patch (PowerShell)

```powershell
cd D:\source\repos\railway-network-explorer
git status --short
git apply --check D:\Downloads\railway-ui-increment-01.patch
git apply D:\Downloads\railway-ui-increment-01.patch
docker compose up -d --build
docker compose exec web npm test
docker compose exec web npm run build
```

Confirm searches in `Leuven`, `Louvain`, `Löwen` and `Sint-Katelijne-Waver`, selection with keyboard, clearing station, swap, travel results, and map click. **Do not push without the browser check.**

The full ZIP is an alternative to applying the patch. Do not apply both. After success, locally generate and commit `frontend/package-lock.json` (`cd frontend; npm install --package-lock-only`) for future reproducible builds.

### Current limitation

Only the station picker is migrated; the other hand-crafted UI remains intentionally unchanged. This environment cannot reach npm registry so the full production build must be confirmed locally before committing.

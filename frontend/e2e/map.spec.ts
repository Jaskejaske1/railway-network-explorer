import { test, expect } from '@playwright/test';

const empty = { type: 'FeatureCollection', features: [] };
const stations = [
  { id: 'LEUVEN', name: 'Leuven', original_name: 'Louvain', lon: 4.715, lat: 50.882 },
  { id: 'WEERDE', name: 'Weerde', lon: 4.475, lat: 50.972 }
];
const lines = { type: 'FeatureCollection', features: [
  { type: 'Feature', properties: { from_name: 'Leuven', to_name: 'Weerde', distance_km: 22 },
    geometry: { type: 'LineString', coordinates: [[4.715, 50.882], [4.475, 50.972]] } }
] };

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let data: unknown = {};
    if (path === '/api/gtfs/meta') data = { available: true, realtime: false, feed: {} };
    else if (path === '/api/meta') data = { stations: 2, segments: 1 };
    else if (path === '/api/network') data = lines;
    else if (path === '/api/gtfs/stations/geojson') data = {
      type: 'FeatureCollection', features: stations.map(s => ({
        type: 'Feature', properties: { id: s.id, name: s.name },
        geometry: { type: 'Point', coordinates: [s.lon, s.lat] }
      }))
    };
    else if (path === '/api/gtfs/stations') {
      const query = (url.searchParams.get('search') || '').toLowerCase();
      data = stations.filter(station => station.name.toLowerCase().includes(query));
    } else if (path === '/api/gtfs/routes') data = {
      realtime: false, mode: 'scheduled_gtfs_only', journeys: [{
        departure: '12:00', arrival: '12:45', transfer_count: 0, transfer_stations: [],
        legs: [{ trip_id: 'IC1', departure: '12:00', arrival: '12:45', from_name: 'Leuven',
          to_name: 'Weerde', route: 'IC1', stop_names: ['Leuven', 'Weerde'] }],
        geometry: lines
      }]
    };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
});

test('the railway map initializes and the planner calls the existing API', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Plan je treinreis' })).toBeVisible();
  await expect(page.getByTestId('rail-map')).toBeVisible();
  await expect(page.locator('.maplibregl-canvas')).toBeVisible({ timeout: 15_000 });
  await expect.poll(async () => page.evaluate(() => !!(window as any).__atlasMap?.getSource('atlas-network')))
    .toBeTruthy();

  await page.getByRole('combobox', { name: 'Van' }).fill('Leu');
  await page.getByRole('option', { name: /Leuven/ }).click();
  await page.getByRole('combobox', { name: 'Naar' }).fill('Wee');
  await page.getByRole('option', { name: /Weerde/ }).click();
  await page.getByRole('button', { name: 'Zoek reizen' }).click();
  await expect(page.getByText('12:00').first()).toBeVisible();
  await expect.poll(async () => page.evaluate(() => !!(window as any).__atlasMap?.getSource('atlas-journeys')))
    .toBeTruthy();
  await page.screenshot({ path: 'test-results/atlas-map.png' });
});

test('map settings remain accessible without a connected backend', async ({ page }) => {
  await page.goto('/');
  // Wait for SvelteKit hydration and MapLibre initialization before interacting.
  await expect(page.locator('.maplibregl-canvas')).toBeVisible({ timeout: 15_000 });
  await expect.poll(async () => page.evaluate(() => !!(window as any).__atlasMap?.getSource('atlas-network'))).toBeTruthy();
  await page.getByRole('button', { name: 'Kaartlagen' }).click();
  await expect(page.getByLabel('Basiskaart')).toBeVisible();
  const railSwitch = page.getByRole('checkbox', { name: 'Infrabel-netwerk' });
  await expect(railSwitch).toBeChecked();
  await railSwitch.click();
  await expect.poll(async () => page.evaluate(() =>
    (window as any).__atlasMap?.getLayoutProperty('atlas-rail', 'visibility'))).toBe('none');
  await railSwitch.click();
  await expect.poll(async () => page.evaluate(() =>
    (window as any).__atlasMap?.getLayoutProperty('atlas-rail', 'visibility'))).toBe('visible');
  await page.getByRole('button', { name: 'Schakel naar 3D' }).click();
  await expect(page.getByRole('button', { name: 'Terug naar 2D' })).toBeVisible();
});


test('Skeleton AppBar keeps header search and panel toggle accessible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('banner').getByText('Atlas Rail')).toBeVisible();
  await expect.poll(async () => page.evaluate(() => !!(window as any).__atlasMap?.getSource('atlas-network')))
    .toBeTruthy();
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('banner').getByRole('combobox', { name: 'Station zoeken' })).toBeFocused();
  await page.getByRole('button', { name: 'Zijpaneel sluiten' }).click();
  await expect(page.getByRole('button', { name: 'Zijpaneel openen' })).toBeVisible();
  await page.getByRole('button', { name: 'Zijpaneel openen' }).click();
  await expect(page.getByRole('heading', { name: 'Plan je treinreis' })).toBeVisible();
});

test('Skeleton Combobox supports keyboard selection and station swapping', async ({ page }) => {
  await page.goto('/');
  await expect.poll(async () => page.evaluate(() => !!(window as any).__atlasMap?.getSource('atlas-network')))
    .toBeTruthy();
  const departure = page.getByRole('combobox', { name: 'Van' });
  await departure.fill('Leu');
  await expect(page.getByRole('option', { name: 'Leuven' })).toBeVisible();
  await departure.press('ArrowDown');
  await departure.press('Enter');
  await expect(departure).toHaveValue('Leuven');
  const arrival = page.getByRole('combobox', { name: 'Naar' });
  await arrival.fill('Wee');
  await page.getByRole('option', { name: 'Weerde' }).click();
  await page.getByRole('button', { name: 'Wissel vertrek en aankomst' }).click();
  await expect(departure).toHaveValue('Weerde');
  await expect(arrival).toHaveValue('Leuven');
  await departure.fill('Leu');
  await expect(departure).toHaveValue('Leu');
  await expect(page.getByRole('option', { name: 'Leuven' })).toBeVisible();
});

test('map layer controls update MapLibre state and preserve overlays across basemap changes', async ({ page }) => {
  // Deterministic style fixtures: prove MapLibre style switching, independent of external tile availability.
  await page.route(/^https:\/\/tiles\.openfreemap\.org\/styles\/(liberty|bright|positron)\/?$/, async route => {
    const name = new URL(route.request().url()).pathname.split('/').filter(Boolean).at(-1);
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        version: 8, name: 'Atlas test ' + name,
        sources: {}, layers: [{ id: 'test-background', type: 'background',
          paint: { 'background-color': '#e8eef2' } }]
      })
    });
  });

  await page.goto('/');
  await expect.poll(async () => page.evaluate(() =>
    (window as any).__atlasMap?.getStyle()?.name)).toBe('Atlas test liberty');
  await expect.poll(async () => page.evaluate(() =>
    !!(window as any).__atlasMap?.getSource('atlas-network'))).toBe(true);

  await page.getByRole('button', { name: 'Kaartlagen' }).click();
  const railway = page.getByRole('checkbox', { name: 'Infrabel-netwerk' });
  const stations = page.getByRole('checkbox', { name: 'Stations' });
  const journey = page.getByRole('checkbox', { name: 'Geselecteerde reis' });
  await railway.click();
  await expect.poll(async () => page.evaluate(() =>
    (window as any).__atlasMap.getLayoutProperty('atlas-rail', 'visibility'))).toBe('none');
  await railway.click();
  await expect.poll(async () => page.evaluate(() =>
    (window as any).__atlasMap.getLayoutProperty('atlas-rail', 'visibility'))).toBe('visible');

  await stations.click();
  await expect.poll(async () => page.evaluate(() =>
    (window as any).__atlasMap.getLayoutProperty('atlas-stations', 'visibility'))).toBe('none');
  await expect.poll(async () => page.evaluate(() =>
    (window as any).__atlasMap.getLayoutProperty('atlas-station-names', 'visibility'))).toBe('none');
  await stations.click();
  await expect.poll(async () => page.evaluate(() =>
    (window as any).__atlasMap.getLayoutProperty('atlas-stations', 'visibility'))).toBe('visible');

  await journey.click();
  await expect.poll(async () => page.evaluate(() =>
    (window as any).__atlasMap.getLayoutProperty('atlas-journey', 'visibility'))).toBe('none');
  await journey.click();

  const opacity = page.getByRole('slider');
  await opacity.focus();
  await opacity.press('ArrowLeft');
  await expect.poll(async () => page.evaluate(() =>
    (window as any).__atlasMap.getPaintProperty('atlas-rail', 'line-opacity'))).toBe(0.7);

  await page.getByLabel('Basiskaart').selectOption('bright');
  await expect.poll(async () => page.evaluate(() =>
    (window as any).__atlasMap.getStyle()?.name)).toBe('Atlas test bright');
  await expect.poll(async () => page.evaluate(() =>
    !!(window as any).__atlasMap.getLayer('atlas-rail'))).toBe(true);
  await expect.poll(async () => page.evaluate(() =>
    (window as any).__atlasMap.getPaintProperty('atlas-rail', 'line-opacity'))).toBe(0.7);
  await page.getByLabel('Basiskaart').selectOption('positron');
  await expect.poll(async () => page.evaluate(() =>
    (window as any).__atlasMap.getStyle()?.name)).toBe('Atlas test positron');

  await page.getByRole('button', { name: 'Schakel naar 3D' }).click();
  await expect.poll(async () => page.evaluate(() =>
    (window as any).__atlasMap.getPitch())).toBeGreaterThan(40);
  await page.getByRole('button', { name: 'Terug naar 2D' }).click();
  await expect.poll(async () => page.evaluate(() =>
    (window as any).__atlasMap.getPitch())).toBeLessThan(1);
});

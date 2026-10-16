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
  await page.getByRole('button', { name: 'Kaartlagen' }).click();
  await expect(page.getByLabel('Basiskaart')).toBeVisible();
  await page.getByRole('button', { name: 'Schakel naar 3D' }).click();
  await expect(page.getByRole('button', { name: 'Terug naar 2D' })).toBeVisible();
});

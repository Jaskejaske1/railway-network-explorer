import { describe, expect, it } from 'vitest';
import { journeyLines, coordinatesFor, selectedStations } from './geo';

describe('cartographic presentation', () => {
  it('highlights only the active journey without mutating the API payload', () => {
    const geometry = { type: 'FeatureCollection' as const, features: [
      { type: 'Feature', properties: { geometry_source: 'infrabel' },
        geometry: { type: 'LineString', coordinates: [[4, 50], [5, 51]] } }
    ] };
    const journeys = [0, 1].map(() => ({ departure: '08:00', arrival: '09:00', transfer_count: 0,
      transfer_stations: [], legs: [], geometry }));
    const lines = journeyLines(journeys, 1);
    expect(lines.features.map(f => f.properties.active)).toEqual([0, 1]);
    expect(geometry.features[0].properties).toEqual({ geometry_source: 'infrabel' });
    expect(coordinatesFor(journeys[0])).toEqual([[4, 50], [5, 51]]);
  });
  it('creates map markers only for actual coordinates', () => {
    expect(selectedStations([{ id: 'a', name: 'A', lat: 50, lon: 4 }, null]).features).toHaveLength(1);
  });
});

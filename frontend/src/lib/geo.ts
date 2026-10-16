import type { GeoCollection, Journey } from './api';

export function journeyLines(journeys: Journey[], selected: number): GeoCollection {
  return {
    type: 'FeatureCollection',
    features: journeys.flatMap((journey, index) => (journey.geometry?.features ?? []).map(feature => ({
      ...feature,
      properties: { ...feature.properties, active: index === selected ? 1 : 0 }
    })))
  };
}
export function coordinatesFor(journey?: Journey): [number, number][] {
  if (!journey) return [];
  return (journey.geometry?.features ?? []).flatMap(feature => {
    const geom = feature.geometry;
    if (!geom) return [];
    if (geom.type === 'LineString') return geom.coordinates ?? [];
    if (geom.type === 'MultiLineString') return (geom.coordinates ?? []).flat();
    return [];
  }).filter(point => Array.isArray(point) && point.length >= 2);
}
export function selectedStations(stations: Array<{ id: string; name: string; lon: number; lat: number } | null>): GeoCollection {
  return {
    type: 'FeatureCollection',
    features: stations.filter((station): station is NonNullable<typeof station> => station !== null)
      .filter(station => Number.isFinite(station.lon) && Number.isFinite(station.lat))
      .map((station, i) => ({
        type: 'Feature', geometry: { type: 'Point', coordinates: [station.lon, station.lat] },
        properties: { id: station.id, name: station.name, color: i === 0 ? '#15845c' : '#c95151' }
      }))
  };
}

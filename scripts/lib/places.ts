import { readFile } from 'node:fs/promises';
import { haversine, resample, type LatLon } from './geo.ts';
import { PointIndex } from './graph.ts';

/** Un elemento di data-cache/places.json (scripts/prefetch-places.ts). */
export type Place = {
  type: string;
  id: number;
  tags: Record<string, string>;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  geometry?: { lat: number; lon: number }[];
};

export const where = (p: Place): LatLon | null =>
  p.lat !== undefined && p.lon !== undefined ? [p.lat, p.lon] : p.center ? [p.center.lat, p.center.lon] : null;

/** Paesi e frazioni: dove si arriva (quasi sempre) in macchina. */
export const SETTLEMENT = new Set(['village', 'town', 'hamlet']);

/** Carica luoghi e strade e prepara le due domande che servono per i punti di partenza. */
export async function loadPlaces() {
  const { elements: places } = JSON.parse(await readFile('data-cache/places.json', 'utf8')) as { elements: Place[] };
  const named = places
    .filter((p) => SETTLEMENT.has(p.tags.place ?? '') || p.tags.place === 'locality')
    .map((p) => ({ name: p.tags.name, at: where(p) }))
    .filter((p): p is { name: string; at: LatLon } => p.at !== null);

  // strade aperte al traffico (scripts/prefetch-roads.ts), infittite a un punto ogni 25 m per l'indice spaziale
  const roads = JSON.parse(await readFile('data-cache/roads.json', 'utf8')) as LatLon[][];
  const roadIndex = new PointIndex(roads.flatMap((r) => (r.length > 1 ? resample(r, 25).points : r)));

  return {
    places,
    /** Il paese, la frazione o la località con nome più vicina (entro 1,5 km). */
    nameNear(p: LatLon): string | null {
      let best: { name: string; m: number } | null = null;
      for (const pl of named) {
        const m = haversine(p, pl.at);
        if (m < 1500 && (!best || m < best.m)) best = { name: pl.name, m };
      }
      return best?.name ?? null;
    },
    /**
     * Si arriva in macchina? Una strada aperta al traffico a meno di 200 m. Su OSM ci sono "frazioni" e parcheggi
     * anche agli alpeggi in quota (Alpe Fora, 2063 m) e ai rifugi, dove si sale solo a piedi o con i mezzi di servizio.
     */
    drivable: (p: LatLon) => roadIndex.nearest(p, 200) !== null,
  };
}

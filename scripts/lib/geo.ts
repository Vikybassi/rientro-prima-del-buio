/** Un punto come [latitudine, longitudine], in gradi. */
export type LatLon = [number, number];

const EARTH_RADIUS_M = 6_371_000;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Distanza in metri tra due punti sulla superficie terrestre (formula dell'emisenoverso). */
export function haversine(a: LatLon, b: LatLon): number {
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function lineLength(line: LatLon[]): number {
  let total = 0;
  for (let i = 1; i < line.length; i++) total += haversine(line[i - 1], line[i]);
  return total;
}

/**
 * Ricampiona la traccia con un punto ogni `step` metri, interpolando lungo i segmenti.
 * Serve perché su OSM la densità dei punti è irregolare (fitta nei tornanti, rada nei rettilinei):
 * con punti equidistanti il profilo altimetrico non dipende da come è stata disegnata la traccia.
 */
export function resample(line: LatLon[], step: number): { points: LatLon[]; dist: number[] } {
  const points: LatLon[] = [line[0]];
  const dist = [0];
  let travelled = 0;
  let next = step;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    const seg = haversine(a, b);
    while (seg > 0 && travelled + seg >= next) {
      const t = (next - travelled) / seg;
      points.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      dist.push(next);
      next += step;
    }
    travelled += seg;
  }
  // l'ultimo punto vero della traccia, se non coincide già con l'ultimo campione
  if (travelled - dist[dist.length - 1] > 1) {
    points.push(line[line.length - 1]);
    dist.push(travelled);
  }
  return { points, dist };
}

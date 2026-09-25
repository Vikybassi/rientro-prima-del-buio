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

/** Una strada aperta al traffico (data-cache/roads.json, da scripts/prefetch-roads.ts). */
type Road = { nodes: number[]; coords: LatLon[]; highway: string; name?: string; toll?: boolean };

export const where = (p: Place): LatLon | null =>
  p.lat !== undefined && p.lon !== undefined ? [p.lat, p.lon] : p.center ? [p.center.lat, p.center.lon] : null;

/** Paesi e frazioni: dove si arriva (quasi sempre) in macchina. */
export const SETTLEMENT = new Set(['village', 'town', 'hamlet']);

/**
 * Strade "vere" la cui fine può essere una partenza. Esclusi vialetti e strade residenziali (finiscono davanti a una
 * casa, non all'inizio di un sentiero) e anche le piste: una pista aperta alle auto va bene per arrivare a un
 * parcheggio, ma la sua fine è spesso in alto nella valle, dove non si sale davvero in macchina (in Val Porcellizzo
 * faceva partire il Rifugio Omio sopra Bagni di Masino e faceva sparire il Gianetti).
 */
const THROUGH_ROADS = new Set(['primary', 'secondary', 'tertiary', 'unclassified']);

/** "Strada per Predarossa" → "Predarossa": il nome della strada dice dove porta. */
export function placeFromRoadName(name: string): string {
  return name.replace(/^(strada|via|sp\s*\d*)\s+(per|di|del|della|dei|delle|al|alla|alle|ai)\s+/i, '').trim();
}

/** Carica luoghi e strade e prepara le domande che servono per i punti di partenza. */
export async function loadPlaces() {
  const { elements: places } = JSON.parse(await readFile('data-cache/places.json', 'utf8')) as { elements: Place[] };
  const named = places
    .filter((p) => SETTLEMENT.has(p.tags.place ?? '') || p.tags.place === 'locality')
    .map((p) => ({ name: p.tags.name, at: where(p) }))
    .filter((p): p is { name: string; at: LatLon } => p.at !== null);

  const roads = JSON.parse(await readFile('data-cache/roads.json', 'utf8')) as Road[];
  if (!roads[0]?.coords) throw new Error('data-cache/roads.json è nel formato vecchio: riscaricalo con scripts/prefetch-roads.ts');

  // indice spaziale sui punti delle strade, infittiti a uno ogni 25 m; per ogni punto ricordiamo la sua strada
  const roadPoints: LatLon[] = [];
  const roadOfPoint: number[] = [];
  roads.forEach((r, i) => {
    for (const p of r.coords.length > 1 ? resample(r.coords, 25).points : r.coords) {
      roadPoints.push(p);
      roadOfPoint.push(i);
    }
  });
  const roadIndex = new PointIndex(roadPoints);
  const nearestRoad = (p: LatLon, maxM: number) => {
    const hit = roadIndex.nearest(p, maxM);
    return hit ? roads[roadOfPoint[hit.node]] : null;
  };

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
    drivable: (p: LatLon) => nearestRoad(p, 200) !== null,
    /** La strada per arrivare qui è a pedaggio (tag OSM toll=yes sulla strada più vicina)? */
    toll: (p: LatLon) => nearestRoad(p, 200)?.toll === true,
    /**
     * Dove finiscono le strade vere: in montagna spesso la strada finisce proprio dove comincia il sentiero, anche
     * senza un parcheggio segnato su OSM (Piana di Predarossa, partenza per il Rifugio Ponti).
     * Una fine strada è un estremo di una strada che nessun'altra strada tocca.
     */
    roadEnds(): { at: LatLon; name?: string; toll: boolean }[] {
      const uses = new Map<number, number>();
      for (const r of roads) for (const n of r.nodes) uses.set(n, (uses.get(n) ?? 0) + 1);
      const ends: { at: LatLon; name?: string; toll: boolean }[] = [];
      for (const r of roads) {
        if (!THROUGH_ROADS.has(r.highway) || r.nodes.length < 2) continue;
        for (const k of [0, r.nodes.length - 1]) {
          if (uses.get(r.nodes[k]) === 1) ends.push({ at: r.coords[k], name: r.name, toll: r.toll === true });
        }
      }
      return ends;
    },
  };
}

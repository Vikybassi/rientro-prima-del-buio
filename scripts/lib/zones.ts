import { readFile } from 'node:fs/promises';
import type { Zone } from '../../src/data/types.ts';
import type { LatLon } from './geo.ts';

/** I comuni della Valmalenco: nell'app hanno una zona a sé, anche se fanno parte della Comunità Montana di Sondrio. */
export const VALMALENCO = ['Chiesa in Valmalenco', 'Lanzada', 'Caspoggio', 'Torre di Santa Maria', 'Spriana'];

/** Comunità Montana → zona dell'app. */
const BY_COMMUNITY: [RegExp, Zone][] = [
  [/Valchiavenna/i, 'valchiavenna'],
  [/Morbegno/i, 'bassa-valtellina'],
  [/Sondrio/i, 'media-valtellina'],
  [/Tirano/i, 'media-valtellina'],
  [/Alta Valtellina/i, 'alta-valtellina'],
];

type Boundary = { name: string; level: number; lines: LatLon[][] };

/**
 * Punto nel poligono con il metodo del raggio: si conta quante volte una semiretta verso est attraversa il
 * confine. Dispari = dentro. Funziona anche con i tratti di confine in ordine sparso, come li dà OSM.
 */
function inside(p: LatLon, lines: LatLon[][]): boolean {
  let crossings = 0;
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      const [aLat, aLon] = line[i - 1];
      const [bLat, bLon] = line[i];
      if (aLat > p[0] !== bLat > p[0]) {
        const lonAtLat = aLon + ((p[0] - aLat) / (bLat - aLat)) * (bLon - aLon);
        if (lonAtLat > p[1]) crossings++;
      }
    }
  }
  return crossings % 2 === 1;
}

/** Carica i confini (scripts/prefetch-zones.ts) e restituisce la funzione punto → zona (o null se fuori). */
export async function loadZones(): Promise<(p: LatLon) => Zone | null> {
  const boundaries = JSON.parse(await readFile('data-cache/zones.json', 'utf8')) as Boundary[];
  const communities = boundaries.filter((b) => b.level === 7);
  const valmalenco = boundaries.filter((b) => b.level === 8);
  return (p) => {
    if (valmalenco.some((b) => inside(p, b.lines))) return 'valmalenco';
    const community = communities.find((b) => inside(p, b.lines));
    return community ? (BY_COMMUNITY.find(([re]) => re.test(community.name))?.[1] ?? null) : null;
  };
}

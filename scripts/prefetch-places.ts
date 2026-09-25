/**
 * Scarica in una sola richiesta Overpass i luoghi che servono per costruire gli itinerari:
 * - le mete: rifugi, bivacchi, laghi, passi (con nome);
 * - i punti di partenza possibili: parcheggi e località abitate (paesi, frazioni, nuclei).
 * Salva tutto in data-cache/places.json.
 *
 * Uso: node scripts/prefetch-places.ts
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { overpass } from './lib/overpass.ts';

const QUERY = `[out:json][timeout:300];
area["name"="Sondrio"]["admin_level"="6"]->.a;
(
  nwr["tourism"="alpine_hut"]["name"](area.a);
  nwr["tourism"="wilderness_hut"]["name"](area.a);
  nwr["mountain_pass"="yes"]["name"](area.a);
  nwr["amenity"="parking"](area.a);
  node["place"~"^(village|hamlet|isolated_dwelling|locality|town)$"]["name"](area.a);
);
out tags center;
nwr["natural"="water"]["water"="lake"]["name"](area.a);
out tags geom;`;

const data = await overpass<{ elements: unknown[] }>(QUERY);
await mkdir('data-cache', { recursive: true });
await writeFile('data-cache/places.json', JSON.stringify(data));
console.log(`Salvati ${data.elements.length} luoghi in data-cache/places.json`);

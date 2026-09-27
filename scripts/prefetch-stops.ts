/**
 * Scarica i punti che possono diventare "tappe" lungo i giri e che non sono già in data-cache/places.json:
 * cime (con nome), fontane e sorgenti d'acqua potabile, punti panoramici. Salva data-cache/stops.json.
 * Rifugi, bivacchi, passi, laghi e alpeggi vengono da places.json (scripts/prefetch-places.ts).
 *
 * Uso: node scripts/prefetch-stops.ts
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { overpass } from './lib/overpass.ts';

const QUERY = `[out:json][timeout:300];
area["name"="Sondrio"]["admin_level"="6"]->.a;
(
  node["natural"="peak"]["name"](area.a);
  node["amenity"="drinking_water"](area.a);
  node["natural"="spring"]["drinking_water"="yes"](area.a);
  nwr["tourism"="viewpoint"](area.a);
);
out tags center;`;

const data = await overpass<{ elements: unknown[] }>(QUERY);
// guardia: una risposta vuota (Overpass sovraccarico risponde 200 senza dati) non deve sovrascrivere dati buoni
if (data.elements.length < 100) throw new Error(`Solo ${data.elements.length} punti: risposta sospetta, non salvo`);
await mkdir('data-cache', { recursive: true });
await writeFile('data-cache/stops.json', JSON.stringify(data));
console.log(`Salvati ${data.elements.length} punti in data-cache/stops.json`);

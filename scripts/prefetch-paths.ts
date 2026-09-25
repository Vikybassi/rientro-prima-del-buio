/**
 * Scarica i sentieri e le piste della provincia che NON fanno necessariamente parte della rete CAI numerata
 * (data-cache/paths.json). Servono dove la rete su OSM ha dei buchi: in Val Masino, per esempio, i sentieri
 * di accesso ai rifugi Omio, Gianetti, Allievi esistono come "path" ma non sono inseriti in un percorso numerato.
 *
 * Qui escludiamo solo ciò che è vietato; la scelta di cosa usare (difficoltà, visibilità) la fa build-itineraries.ts,
 * così la regola è in un posto solo e si può rivedere senza riscaricare.
 *
 * Uso: node scripts/prefetch-paths.ts
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { overpass } from './lib/overpass.ts';

type Way = { id: number; nodes: number[]; tags: Record<string, string>; geometry: { lat: number; lon: number }[] };

const data = await overpass<{ elements: Way[] }>(`[out:json][timeout:600];
area["name"="Sondrio"]["admin_level"="6"]->.a;
way["highway"~"^(path|footway|track|bridleway)$"]["access"!~"^(no|private)$"]["foot"!~"^(no|private)$"](area.a);
out geom;`);

// teniamo solo quello che serve: nodi (per collegarsi alla rete), coordinate e i tag che decidono se usarli
const KEEP = ['highway', 'sac_scale', 'trail_visibility', 'informal', 'name', 'ref'];
const paths = data.elements.map((w) => ({
  id: w.id,
  nodes: w.nodes,
  coords: w.geometry.map((p) => [p.lat, p.lon]),
  tags: Object.fromEntries(Object.entries(w.tags).filter(([k]) => KEEP.includes(k))),
}));
if (paths.length < 5_000) throw new Error(`Solo ${paths.length} sentieri: risposta incompleta, non salvo niente`);
await mkdir('data-cache', { recursive: true });
await writeFile('data-cache/paths.json', JSON.stringify(paths));
console.log(`Salvati ${paths.length} sentieri e piste in data-cache/paths.json`);

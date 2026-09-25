/**
 * Scarica in una sola richiesta Overpass tutti i sentieri (route=hiking) della provincia di Sondrio,
 * con i tratti e le coordinate, e li salva in data-cache/osm/ nello stesso formato dell'API principale di OSM.
 * Così gli altri script li trovano già in cache e non fanno centinaia di richieste all'API principale,
 * che non è pensata per scaricamenti in blocco.
 *
 * Uso: node scripts/prefetch-overpass.ts
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { overpass } from './lib/overpass.ts';

const QUERY = `[out:json][timeout:300];
area["name"="Sondrio"]["admin_level"="6"]->.a;
relation["route"="hiking"](area.a)->.r;
.r out body;
way(r.r);
out geom;`;

type Way = { type: 'way'; id: number; nodes: number[]; geometry: { lat: number; lon: number }[] };
type Relation = { type: 'relation'; id: number; tags: Record<string, string>; members: { type: string; ref: number; role: string }[] };

const data = await overpass<{ elements: (Way | Relation)[] }>(QUERY);

const ways = new Map<number, Way>();
const relations: Relation[] = [];
for (const el of data.elements) {
  if (el.type === 'way') ways.set(el.id, el);
  else relations.push(el);
}

await mkdir('data-cache/osm', { recursive: true });
for (const rel of relations) {
  // ricostruisce il formato di /api/0.6/relation/<id>/full.json: nodi, tratti e relazione
  const nodes = new Map<number, { type: 'node'; id: number; lat: number; lon: number }>();
  const relWays = [];
  for (const m of rel.members) {
    const w = m.type === 'way' ? ways.get(m.ref) : undefined;
    if (!w) continue;
    w.nodes.forEach((id, i) => nodes.set(id, { type: 'node', id, lat: w.geometry[i].lat, lon: w.geometry[i].lon }));
    relWays.push({ type: 'way', id: w.id, nodes: w.nodes });
  }
  await writeFile(`data-cache/osm/relation-${rel.id}.json`, JSON.stringify({ elements: [...nodes.values(), ...relWays, rel] }));
}
console.log(`Salvati ${relations.length} sentieri e ${ways.size} tratti in data-cache/osm/`);

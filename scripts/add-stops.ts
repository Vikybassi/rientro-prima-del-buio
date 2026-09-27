/**
 * Le tappe lungo ogni giro: rifugi, bivacchi, laghi, passi, alpeggi, cime, fontane e punti panoramici che il sentiero
 * tocca davvero. Aggiunge `stops` a ogni public/trails/<id>.json (la traccia non cambia).
 *
 * Fonti: data-cache/places.json (scripts/prefetch-places.ts) e data-cache/stops.json (scripts/prefetch-stops.ts).
 * Uso: node scripts/add-stops.ts
 *
 * Regole:
 * - un punto è sul giro se passa a meno di NEAR metri dalla traccia (i laghi, che sono aree, dal punto più vicino
 *   della riva);
 * - niente tappe nei primi e negli ultimi 250 m: la partenza e la meta si vedono già;
 * - due tappe più vicine di 300 m lungo il sentiero sono lo stesso posto: resta la più utile (un rifugio batte una
 *   fontana);
 * - al massimo MAX_STOPS per giro, scelte per importanza ma sparse lungo tutto il percorso.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import type { Stop, StopKind, TrailSummary, TrailTrack } from '../src/data/types.ts';
import { haversine, type LatLon } from './lib/geo.ts';

const NEAR: Record<StopKind, number> = { hut: 150, bivouac: 150, lake: 120, pass: 120, peak: 100, alp: 150, water: 60, viewpoint: 80 };
// più piccolo = più importante
const PRIORITY: Record<StopKind, number> = { hut: 0, bivouac: 1, lake: 2, pass: 3, alp: 4, peak: 5, water: 6, viewpoint: 7 };
const ENDS_M = 250;
const SAME_PLACE_M = 300;
const MAX_STOPS = 8;
// alpeggi: su OSM sono nuclei o località col nome che lo dice
const ALP = /^(alpe|alp|alpeggio|alpi|baita|baite|casera|malga|maiolo|stalle|baitel)\b/i;

type Candidate = { name: string | null; kind: StopKind; points: LatLon[] };

type El = { type: string; lat?: number; lon?: number; center?: { lat: number; lon: number }; geometry?: { lat: number; lon: number }[]; tags?: Record<string, string> };

function kindOf(t: Record<string, string>): StopKind | null {
  if (t.tourism === 'alpine_hut') return 'hut';
  if (t.tourism === 'wilderness_hut') return 'bivouac';
  if (t.natural === 'water') return 'lake';
  if (t.mountain_pass === 'yes') return 'pass';
  if (t.natural === 'peak') return 'peak';
  if (t.amenity === 'drinking_water' || t.natural === 'spring') return 'water';
  if (t.tourism === 'viewpoint') return 'viewpoint';
  if (t.place && ['hamlet', 'isolated_dwelling', 'locality'].includes(t.place) && t.name && ALP.test(t.name)) return 'alp';
  return null;
}

const load = async (file: string) => (JSON.parse(await readFile(file, 'utf8')) as { elements: El[] }).elements;
const elements = [...(await load('data-cache/places.json')), ...(await load('data-cache/stops.json'))];

const candidates: Candidate[] = [];
for (const el of elements) {
  const tags = el.tags ?? {};
  const kind = kindOf(tags);
  if (!kind) continue;
  // le fontane e i panorami senza nome vanno bene; il resto deve avere un nome da mostrare
  const name = tags['name:it'] ?? tags.name ?? null;
  if (!name && kind !== 'water' && kind !== 'viewpoint') continue;
  const points: LatLon[] = el.geometry
    ? el.geometry.map((g) => [g.lat, g.lon] as LatLon)
    : el.center
      ? [[el.center.lat, el.center.lon]]
      : el.lat !== undefined && el.lon !== undefined
        ? [[el.lat, el.lon]]
        : [];
  if (points.length) candidates.push({ name, kind, points });
}

const summaries = JSON.parse(await readFile('src/data/trails.json', 'utf8')) as TrailSummary[];
const byId = new Map(summaries.map((s) => [s.id, s]));

let total = 0;
const files = (await readdir('public/trails')).filter((f) => f.endsWith('.json'));
for (const file of files) {
  const path = `public/trails/${file}`;
  const track = JSON.parse(await readFile(path, 'utf8')) as TrailTrack;
  const summary = byId.get(track.id);
  const pts = track.points;
  const length = pts[pts.length - 1][2];
  // riquadro della traccia (con margine) per scartare in fretta i punti lontani
  const lats = pts.map((p) => p[0]);
  const lons = pts.map((p) => p[1]);
  const box = { s: Math.min(...lats) - 0.003, n: Math.max(...lats) + 0.003, w: Math.min(...lons) - 0.004, e: Math.max(...lons) + 0.004 };

  const found: Stop[] = [];
  for (const c of candidates) {
    if (!c.points.some(([la, lo]) => la >= box.s && la <= box.n && lo >= box.w && lo <= box.e)) continue;
    let best = Infinity;
    let bestIdx = -1;
    for (const q of c.points)
      for (let i = 0; i < pts.length; i++) {
        const dist = haversine(q, [pts[i][0], pts[i][1]]);
        if (dist < best) {
          best = dist;
          bestIdx = i;
        }
      }
    if (best > NEAR[c.kind]) continue;
    const d = pts[bestIdx][2];
    if (d < ENDS_M || d > length - ENDS_M) continue;
    // la meta stessa (stesso nome) non è una tappa
    if (c.name && summary && c.name.toLowerCase() === summary.to.toLowerCase()) continue;
    found.push({ name: c.name, kind: c.kind, d: Math.round(d), ele: Math.round(pts[bestIdx][3]) });
  }

  // stesso posto (o stesso nome): tiene il più importante
  found.sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind] || a.d - b.d);
  const kept: Stop[] = [];
  for (const s of found) {
    if (kept.some((k) => Math.abs(k.d - s.d) < SAME_PLACE_M || (s.name && k.name === s.name))) continue;
    kept.push(s);
  }
  const stops = kept.slice(0, MAX_STOPS).sort((a, b) => a.d - b.d);
  total += stops.length;
  await writeFile(path, JSON.stringify({ ...track, stops }));
}
console.log(`${files.length} giri, ${total} tappe (in media ${(total / files.length).toFixed(1)} per giro)`);

/**
 * Genera i dati dei sentieri per l'app a partire da scripts/trails.config.ts.
 *
 * Per ogni sentiero: scarica la relazione OSM (in cache), ricostruisce la traccia, la ricampiona ogni 50 m,
 * legge le quote dal modello del terreno e la orienta dalla partenza alla meta. Scrive:
 * - src/data/trails.json         riepilogo di tutti i sentieri (entra nel bundle dell'app)
 * - public/trails/<osm>.json     traccia e profilo di un sentiero (caricata solo quando serve)
 *
 * Uso: node scripts/build-trails.ts   (prima, una volta sola: scripts/download-dem.sh)
 */
import { mkdir, writeFile } from 'node:fs/promises';
import type { Difficulty, TrailPoint, TrailSummary, TrailTrack } from '../src/data/types.ts';
import { climb, sampleElevations } from './lib/elevation.ts';
import { resample, type LatLon } from './lib/geo.ts';
import { assemble, fetchRelation } from './lib/osm.ts';
import { minutes } from './lib/tags.ts';
import { TRAILS } from './trails.config.ts';

/** Stesso passo e stessa soglia di isteresi tarati in screen-candidates.ts (errore mediano 3,3% sul dislivello). */
const STEP_M = 50;
const THRESHOLD_M = 5;

const round5 = (x: number) => Math.round(x * 1e5) / 1e5; // ~1 m: più precisione non serve e appesantisce i file

await mkdir('public/trails', { recursive: true });
const summaries: TrailSummary[] = [];

for (const cfg of TRAILS) {
  const rel = await fetchRelation(cfg.osm);
  const assembly = assemble(rel);
  if (!assembly.ok) throw new Error(`${cfg.from} → ${cfg.to} (${cfg.osm}): ${assembly.reason}, ${assembly.detail}`);

  const { points, dist } = resample(assembly.line, STEP_M);
  const rawEle = await sampleElevations(points);
  const total = dist[dist.length - 1];
  // la meta è in alto: se la traccia è stata ricostruita dall'alto verso il basso, la giriamo
  // (e le distanze vanno ricontate dalla nuova partenza)
  const reversed = rawEle[0] > rawEle[rawEle.length - 1];
  const track: LatLon[] = reversed ? [...points].reverse() : points;
  const ele = reversed ? [...rawEle].reverse() : rawEle;
  const along = reversed ? [...dist].reverse().map((d) => total - d) : dist;

  const tags = rel.relation.tags;
  const difficulty = tags.cai_scale as Difficulty;
  if (!['T', 'E', 'EE'].includes(difficulty)) throw new Error(`${cfg.osm}: difficoltà inattesa "${tags.cai_scale}"`);
  const { up, down } = climb(ele, THRESHOLD_M);

  summaries.push({
    osm: cfg.osm,
    ref: tags.ref ?? '',
    from: cfg.from,
    to: cfg.to,
    zone: cfg.zone,
    difficulty,
    lengthM: Math.round(total),
    upM: Math.round(up),
    downM: Math.round(down),
    startEle: Math.round(ele[0]),
    endEle: Math.round(ele[ele.length - 1]),
    maxEle: Math.round(Math.max(...ele)),
    // su OSM "forward" è il verso della relazione, che per questi sentieri va dalla partenza (from) alla meta (to)
    caiUpMin: minutes(tags['duration:forward']) ?? null,
    caiDownMin: minutes(tags['duration:backward']) ?? null,
    start: [round5(track[0][0]), round5(track[0][1])],
    end: [round5(track[track.length - 1][0]), round5(track[track.length - 1][1])],
  });

  const trackFile: TrailTrack = {
    osm: cfg.osm,
    points: track.map(([lat, lon], i): TrailPoint => [round5(lat), round5(lon), Math.round(along[i]), Math.round(ele[i])]),
  };
  await writeFile(`public/trails/${cfg.osm}.json`, JSON.stringify(trackFile));
  console.log(
    `${cfg.from.padEnd(22)} → ${cfg.to.padEnd(26)} ${(total / 1000).toFixed(1).padStart(5)} km  +${String(Math.round(up)).padStart(4)} m  ${ele.length} punti`,
  );
}

await writeFile('src/data/trails.json', JSON.stringify(summaries, null, 2) + '\n');
console.log(`\n${summaries.length} sentieri → src/data/trails.json e public/trails/`);

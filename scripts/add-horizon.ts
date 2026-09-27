/**
 * Il tramonto dietro le montagne: per la partenza e la meta di ogni giro calcola l'orizzonte verso ovest dal modello
 * del terreno (l'altezza delle montagne sopra l'orizzonte, direzione per direzione) e lo aggiunge come `horizon` a
 * public/trails/<id>.json. L'app lo confronta con la posizione del sole (src/engine/sun.ts `shadeAt`).
 *
 * Serve il modello del terreno con le tessere a ovest (scripts/download-dem.sh): da Chiavenna le montagne dietro cui
 * tramonta il sole sono sopra il lago di Como e in Ticino.
 * Uso: node scripts/add-horizon.ts
 *
 * Scelte:
 * - direzioni da sud (180°) a nord-ovest (320°), un grado alla volta: il sole del pomeriggio sta lì tutto l'anno
 *   (in Valtellina tramonta tra 237° a dicembre e 303° a giugno);
 * - montagne fino a 40 km, con la curvatura della Terra e la rifrazione dell'aria;
 * - niente sotto i 300 m: il modello misura la cima degli alberi, e un bosco a due passi dal parcheggio farebbe
 *   "tramontare" il sole a metà pomeriggio.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { HORIZON_AZ0, type TrailSummary, type TrailTrack } from '../src/data/types.ts';
import { loadSampler } from './lib/elevation.ts';

const AZ_STEPS = 141; // da 180° a 320°
const EYE_M = 2;
const R = 6_371_000;
const K = 0.13; // coefficiente di rifrazione: la luce si piega verso terra e le montagne lontane "si alzano" un poco
const M_PER_DEG = 111_320;

// distanze a cui guardare: fitte vicino, rade lontano (una montagna lontana è grande)
const DISTANCES: number[] = [];
for (let d = 300; d <= 40_000; d += d < 2000 ? 30 : d < 8000 ? 60 : d < 20_000 ? 120 : 200) DISTANCES.push(d);

const elevation = await loadSampler();

function horizon([lat, lon]: [number, number]): number[] {
  const h0 = elevation(lat, lon) + EYE_M;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const out: number[] = [];
  for (let k = 0; k < AZ_STEPS; k++) {
    const az = ((HORIZON_AZ0 + k) * Math.PI) / 180;
    const north = Math.cos(az) / M_PER_DEG;
    const east = Math.sin(az) / (M_PER_DEG * cosLat);
    let best = -90;
    for (const d of DISTANCES) {
      const h = elevation(lat + north * d, lon + east * d);
      if (Number.isNaN(h)) break; // fuori dal modello del terreno
      const angle = Math.atan2(h - h0 - ((1 - K) * d * d) / (2 * R), d);
      if (angle > best) best = angle;
    }
    out.push(Math.round(((best * 180) / Math.PI) * 10));
  }
  return out;
}

const summaries = JSON.parse(await readFile('src/data/trails.json', 'utf8')) as TrailSummary[];
const byId = new Map(summaries.map((s) => [s.id, s]));
const files = (await readdir('public/trails')).filter((f) => f.endsWith('.json'));
let done = 0;
for (const file of files) {
  const path = `public/trails/${file}`;
  const track = JSON.parse(await readFile(path, 'utf8')) as TrailTrack;
  const trail = byId.get(track.id);
  if (!trail) continue;
  await writeFile(path, JSON.stringify({ ...track, horizon: { start: horizon(trail.start), end: horizon(trail.end) } }));
  if (++done % 50 === 0) console.log(`${done}/${files.length}`);
}
console.log(`Orizzonte aggiunto a ${done} giri`);

/**
 * Da dove vengono le costanti dei tempi di src/engine/time.ts.
 *
 * Confronta la formula DIN 33466 (lo standard dei club alpini) con i tempi rilevati dal CAI sui sentieri
 * della provincia di Sondrio che su OSM hanno tempo, lunghezza e dislivello ufficiali. Il rapporto
 * tempo CAI / tempo DIN dice quanto i cartelli sono più veloci della formula, e quanto variano.
 *
 * Uso: node scripts/calibrate-time.ts
 */
import { readFile } from 'node:fs/promises';
import { dinHours } from '../src/engine/time.ts';
import { minutes, num } from './lib/tags.ts';

type Tags = Record<string, string>;
const { elements } = JSON.parse(await readFile('research/osm-hiking-routes-sondrio.json', 'utf8')) as {
  elements: { id: number; tags: Tags }[];
};

const ratios: number[] = [];
for (const { tags: t } of elements) {
  const km = num(t.distance);
  const up = num(t.ascent);
  const down = num(t.descent) ?? 0;
  if (km === undefined || up === undefined) continue;
  const fwd = minutes(t['duration:forward']);
  const back = minutes(t['duration:backward']);
  if (fwd) ratios.push(fwd / 60 / dinHours(km, up, down));
  // al ritorno salita e discesa si scambiano
  if (back) ratios.push(back / 60 / dinHours(km, down, up));
}

ratios.sort((a, b) => a - b);
const q = (p: number) => {
  const i = (ratios.length - 1) * p;
  const lo = Math.floor(i);
  return ratios[lo] + (ratios[Math.ceil(i)] - ratios[lo]) * (i - lo);
};
console.log(`Coppie (percorso, tempo CAI): ${ratios.length}`);
console.log(`Rapporto CAI/DIN: min ${q(0).toFixed(2)}, 10° ${q(0.1).toFixed(2)}, 25° ${q(0.25).toFixed(2)}, mediana ${q(0.5).toFixed(2)}, 75° ${q(0.75).toFixed(2)}, 90° ${q(0.9).toFixed(2)}, max ${q(1).toFixed(2)}`);
console.log(`Forbice 10°–90° rispetto alla mediana: ×${(q(0.1) / q(0.5)).toFixed(2)} – ×${(q(0.9) / q(0.5)).toFixed(2)}`);

/**
 * Screening dei sentieri candidati.
 *
 * Parte da tutti i sentieri OSM della provincia di Sondrio (scaricati da scripts/prefetch-overpass.ts),
 * scarta i tratti di raccordo, poi per ognuno: ricostruisce la traccia, calcola lunghezza e profilo altimetrico
 * e, per quelli che possono essere un'escursione di giornata, trova comune e provincia di partenza.
 * Alla fine tara il filtro delle quote sui sentieri che hanno il dislivello ufficiale CAI e scrive
 * research/candidati.md, una tabella da cui scegliere i sentieri della v1.
 *
 * Uso: node scripts/screen-candidates.ts [--limit N]
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { climb, sampleElevations } from './lib/elevation.ts';
import { fetchJsonCached } from './lib/fetch-cached.ts';
import { lineLength, resample, type LatLon } from './lib/geo.ts';
import { assemble, fetchRelation } from './lib/osm.ts';
import { minutes, num } from './lib/tags.ts';

const STEP_M = 50;
const THRESHOLDS = [0, 5, 10, 15, 20, 25, 30, 40];

/**
 * Una "salita verso una meta" guadagna quasi tutta la quota che sale; una traversata in cresta sale e scende di
 * continuo. Il rapporto tra dislivello netto e salita totale le distingue. Serve anche per un limite dei dati:
 * sulle creste strette il modello del terreno pesca le quote dei versanti e gonfia i saliscendi (col GLO-90,
 * Sentiero delle Orobie: 1540 m calcolati contro 300 ufficiali), quindi le traversate restano fuori dalla v1.
 */
const MIN_NET_RATIO = 0.6;
const REFERENCE_THRESHOLD = 25;

type Tags = Record<string, string>;

/**
 * Tratti di raccordo, non escursioni a sé: partono o arrivano a un innesto, a un bivio o a un altro sentiero
 * indicato solo col numero ("258", "167"), o a un punto senza nome.
 */
const JUNCTION = /innesto|incrocio|bivio|^\s*\d+[a-z]?\s*$|^\s*\?\s*$/i;

/**
 * Prima versione: servivano anche parole da "meta" nel nome (rifugio, lago, passo…) e passavano solo 108 sentieri
 * su 958. Ora decide il profilo reale (lunghezza, dislivello, salita verso l'alto), calcolato più avanti.
 */
function isCandidate(t: Tags): boolean {
  if (!['T', 'E', 'EE'].includes(t.cai_scale ?? '')) return false; // niente EEA/ferrate: fuori perimetro
  if (t.roundtrip === 'yes') return false; // gli anelli arrivano nella seconda fase
  if (!t.from || !t.to || JUNCTION.test(t.from) || JUNCTION.test(t.to)) return false;
  const km = num(t.distance);
  return km === undefined || (km >= 2.5 && km <= 14);
}

/** Filtro grossolano prima di chiedere comune e provincia: inutile interrogare Nominatim per sentieri che non useremo. */
const DAY_HIKE = { minKm: 3, maxKm: 14, minUp: 300, maxUp: 1600 } as const;

/** Comune e provincia del punto di partenza (la provincia come codice ISO, es. "IT-SO"). */
async function placeOf([lat, lon]: LatLon): Promise<{ comune: string; province: string }> {
  const r = await fetchJsonCached<{ address?: Record<string, string> }>(
    `nominatim/${lat.toFixed(3)},${lon.toFixed(3)}.json`,
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=10&accept-language=it`,
  );
  const a = r.address ?? {};
  return {
    comune: a.village ?? a.town ?? a.city ?? a.municipality ?? a.county ?? '?',
    province: a['ISO3166-2-lvl6'] ?? '?',
  };
}

type Screened =
  | { id: number; tags: Tags; ok: false; reason: string }
  | {
      id: number;
      tags: Tags;
      ok: true;
      km: number;
      startEle: number;
      endEle: number;
      maxEle: number;
      climbs: Record<number, { up: number; down: number }>;
      kind: 'salita' | 'traversata';
      comune: string;
      province: string;
      start: LatLon;
    };

async function screen(id: number, tags: Tags): Promise<Screened> {
  const assembly = assemble(await fetchRelation(id));
  if (!assembly.ok) return { id, tags, ok: false, reason: assembly.reason };

  let { points } = resample(assembly.line, STEP_M);
  let ele = await sampleElevations(points);
  // orientiamo il sentiero dal basso verso l'alto: di solito si parte a valle
  if (ele[0] > ele[ele.length - 1]) {
    points = [...points].reverse();
    ele = [...ele].reverse();
  }
  const climbs = Object.fromEntries(THRESHOLDS.map((t) => [t, climb(ele, t)]));
  const net = ele[ele.length - 1] - ele[0];
  const kmTotal = lineLength(assembly.line) / 1000;
  const kind = net >= MIN_NET_RATIO * climbs[REFERENCE_THRESHOLD].up ? 'salita' : 'traversata';
  const up = climbs[5].up;
  const worthLocating =
    kind === 'salita' && kmTotal >= DAY_HIKE.minKm && kmTotal <= DAY_HIKE.maxKm && up >= DAY_HIKE.minUp && up <= DAY_HIKE.maxUp;
  return {
    id,
    tags,
    ok: true,
    km: kmTotal,
    startEle: ele[0],
    endEle: ele[ele.length - 1],
    maxEle: Math.max(...ele),
    climbs,
    kind,
    ...(worthLocating ? await placeOf(points[0]) : { comune: '?', province: '?' }),
    start: points[0],
  };
}

const limitArg = process.argv.indexOf('--limit');
const limit = limitArg > 0 ? Number(process.argv[limitArg + 1]) : Infinity;

// tutti i sentieri scaricati da scripts/prefetch-overpass.ts
const files = (await readdir('data-cache/osm')).filter((f) => f.startsWith('relation-'));
const all: { id: number; tags: Tags }[] = [];
for (const f of files) {
  const { elements } = JSON.parse(await readFile(`data-cache/osm/${f}`, 'utf8')) as { elements: { type: string; id: number; tags?: Tags }[] };
  const rel = elements.find((e) => e.type === 'relation' && `relation-${e.id}.json` === f);
  if (rel?.tags) all.push({ id: rel.id, tags: rel.tags });
}
const candidates = all.filter((e) => isCandidate(e.tags)).slice(0, limit);
console.log(`Candidati: ${candidates.length} su ${all.length} sentieri`);

const results: Screened[] = [];
for (const [i, { id, tags }] of candidates.entries()) {
  try {
    results.push(await screen(id, tags));
  } catch (err) {
    results.push({ id, tags, ok: false, reason: `errore: ${(err as Error).message.slice(0, 80)}` });
  }
  if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${candidates.length}`);
}

type Ok = Extract<Screened, { ok: true }>;
type Failed = Extract<Screened, { ok: false }>;
const ok = results.filter((r): r is Ok => r.ok);
const failed = results.filter((r): r is Failed => !r.ok);
const reasonCount = new Map<string, number>();
for (const r of failed) reasonCount.set(r.reason, (reasonCount.get(r.reason) ?? 0) + 1);
const reasons = [...reasonCount].map(([k, n]) => `${k}: ${n}`);
console.log(`\nRicostruiti: ${ok.length} | scartati: ${failed.length} (${reasons.join(', ')})`);

// --- taratura del filtro delle quote sui sentieri con dislivello ufficiale -----------------------------
// Solo salite (le traversate sono fuori perimetro) e solo dati ufficiali plausibili: un dislivello in salita
// minore della differenza di quota tra partenza e arrivo è impossibile (es. 317 Laghi Torena: 650 m ufficiali,
// ma i laghi stanno 768 m sopra la partenza), quindi quel dato è sbagliato e non può fare da riferimento.
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const climbsWithOfficial = ok.filter((r) => r.kind === 'salita' && num(r.tags.ascent) !== undefined);
const official = climbsWithOfficial.filter((r) => num(r.tags.ascent)! >= 0.9 * (r.endEle - r.startEle));
console.log(`\nTaratura: ${official.length} salite con dislivello ufficiale plausibile (${climbsWithOfficial.length - official.length} scartate perché incoerenti)`);
if (official.length === 0) throw new Error('Nessun dislivello ufficiale utilizzabile: impossibile tarare la soglia');
// mediana dell'errore: pochi dati e qualche rilievo sbagliato, la media si farebbe trascinare dai casi estremi
const errors = THRESHOLDS.map((t) => ({
  t,
  median: median(official.map((r) => Math.abs(r.climbs[t].up - num(r.tags.ascent)!) / num(r.tags.ascent)!)),
}));
const best = errors.reduce((a, b) => (b.median < a.median ? b : a));
for (const { t, median: m } of errors) console.log(`  soglia ${String(t).padStart(2)} m → errore mediano ${(m * 100).toFixed(1)}%`);
console.log(`  scelta: ${best.t} m`);
for (const r of official) {
  const ours = r.climbs[best.t].up;
  const theirs = num(r.tags.ascent)!;
  console.log(`    ${r.tags.ref ?? r.id} ${r.tags.to ?? ''}: ufficiale ${theirs} m, calcolato ${Math.round(ours)} m (${(((ours - theirs) / theirs) * 100).toFixed(0)}%)`);
}

const lengthCheck = ok.filter((r) => num(r.tags.distance) !== undefined);
const lengthErr = lengthCheck.map((r) => Math.abs(r.km - num(r.tags.distance)!) / num(r.tags.distance)!);
console.log(`Lunghezza vs ufficiale (${lengthCheck.length} sentieri): errore medio ${((lengthErr.reduce((a, b) => a + b, 0) / lengthErr.length) * 100).toFixed(1)}%`);

// --- tabella per la scelta ---------------------------------------------------------------------------------
// escursioni di giornata vere, in Valtellina: partenza in provincia di Sondrio, salita verso una meta,
// andata tra 3 e 14 km e tra 300 e 1600 m di dislivello
const dayHikes = ok.filter((r) => {
  const up = r.climbs[best.t].up;
  return r.province === 'IT-SO' && r.kind === 'salita' && r.km >= 3 && r.km <= 14 && up >= 300 && up <= 1600;
});
const outside = ok.filter((r) => r.province !== 'IT-SO').length;
const traverses = ok.filter((r) => r.province === 'IT-SO' && r.kind === 'traversata').length;
console.log(`Esclusi: ${outside} con partenza fuori provincia, ${traverses} traversate`);
dayHikes.sort((a, b) => a.comune.localeCompare(b.comune) || a.startEle - b.startEle);

const fmtMin = (m: number | undefined) => (m === undefined ? '' : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`);
const rows = dayHikes.map((r) => {
  const t = r.tags;
  const up = Math.round(r.climbs[best.t].up);
  return `| ${r.comune} | ${t.ref ?? ''} | ${t.from ?? '?'} → ${t.to ?? '?'} | ${t.cai_scale} | ${r.km.toFixed(1)} | +${up} | ${Math.round(r.startEle)} → ${Math.round(r.maxEle)} | ${fmtMin(minutes(t['duration:forward']))} | [${r.id}](https://www.openstreetmap.org/relation/${r.id}) |`;
});

await writeFile(
  'research/candidati.md',
  `# Sentieri candidati per la v1

Generato da \`scripts/screen-candidates.ts\`. ${dayHikes.length} escursioni di giornata su ${candidates.length} candidati
(${ok.length} ricostruiti, scartati: ${reasons.join(', ')}; esclusi ${outside} con partenza fuori provincia
e ${traverses} traversate).

Lunghezza e dislivello sono calcolati (solo andata, dal punto più basso), con soglia di isteresi ${best.t} m tarata su
${official.length} sentieri con dislivello ufficiale. "Tempo CAI" è quello rilevato dal CAI, quando c'è.

| Comune di partenza | N° | Da → a (dati OSM) | Diff. | km | Salita m | Quota m | Tempo CAI | OSM |
|---|---|---|---|---|---|---|---|---|
${rows.join('\n')}
`,
);
await writeFile('research/candidati.json', JSON.stringify({ threshold: best.t, results }, null, 1));
console.log(`\nScritto research/candidati.md (${dayHikes.length} escursioni di giornata)`);

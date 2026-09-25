/**
 * Genera i dati dei sentieri per l'app, unendo due fonti:
 * A. i sentieri CAI "interi" adatti a una giornata (research/candidati.json, da screen-candidates.ts),
 *    con il tempo del cartello quando c'è;
 * B. gli itinerari calcolati sulla rete verso rifugi, bivacchi, passi e laghi (data-cache/itineraries.json,
 *    da build-itineraries.ts), tenuti solo se portano a una meta che A non copre già dalla stessa zona.
 *
 * Per ogni giro: traccia ricampionata ogni 50 m, quote dal modello del terreno, orientata dalla partenza alla meta.
 * Scrive src/data/trails.json (riepiloghi, nel bundle) e public/trails/<id>.json (tracce, caricate quando servono).
 *
 * Uso: node scripts/build-trails.ts
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import type { Destination, Difficulty, TrailPoint, TrailSummary, TrailTrack } from '../src/data/types.ts';
import { climb, sampleElevations } from './lib/elevation.ts';
import { haversine, resample, type LatLon } from './lib/geo.ts';
import { cleanName, destinationOf, looksLikeAddress } from './lib/names.ts';
import { assemble, fetchRelation } from './lib/osm.ts';
import { loadPlaces } from './lib/places.ts';
import { minutes } from './lib/tags.ts';
import { loadZones } from './lib/zones.ts';
import { NAME_OVERRIDES } from './trails.config.ts';

/** Stesso passo e stessa soglia di isteresi tarati in screen-candidates.ts (errore mediano 3,3% sul dislivello). */
const STEP_M = 50;
const THRESHOLD_M = 5;
/** Criteri di un'escursione di giornata, gli stessi della tabella di screen-candidates.ts. */
const DAY = { minKm: 3, maxKm: 14, minUp: 300, maxUp: 1600 };
/** Un itinerario calcolato è un doppione se porta alla stessa meta (entro 400 m) partendo dalla stessa zona (entro 3 km). */
const SAME_TARGET_M = 400;
const SAME_START_M = 3000;

const round5 = (x: number) => Math.round(x * 1e5) / 1e5; // ~1 m: più precisione non serve e appesantisce i file
const zoneOf = await loadZones();

type Built = { summary: TrailSummary; points: TrailPoint[] };

/** Traccia ricampionata, con le quote, orientata dal basso verso l'alto. */
async function profile(line: LatLon[]) {
  const { points, dist } = resample(line, STEP_M);
  const rawEle = await sampleElevations(points);
  const total = dist[dist.length - 1];
  const reversed = rawEle[0] > rawEle[rawEle.length - 1];
  const track = reversed ? [...points].reverse() : points;
  const ele = reversed ? [...rawEle].reverse() : rawEle;
  const along = reversed ? [...dist].reverse().map((d) => total - d) : dist;
  const { up, down } = climb(ele, THRESHOLD_M);
  return { track, ele, along, total, up, down, reversed };
}

function summarize(
  base: Pick<TrailSummary, 'id' | 'osm' | 'refs' | 'from' | 'to' | 'destination' | 'difficulty' | 'unmarked' | 'checkRoad' | 'tollRoad' | 'caiUpMin' | 'caiDownMin'>,
  p: Awaited<ReturnType<typeof profile>>,
): Built | null {
  const start: LatLon = p.track[0];
  const zone = zoneOf(start);
  if (!zone) return null; // partenza fuori provincia
  const end = p.track[p.track.length - 1];
  return {
    summary: {
      ...base,
      zone,
      lengthM: Math.round(p.total),
      upM: Math.round(p.up),
      downM: Math.round(p.down),
      startEle: Math.round(p.ele[0]),
      endEle: Math.round(p.ele[p.ele.length - 1]),
      maxEle: Math.round(Math.max(...p.ele)),
      start: [round5(start[0]), round5(start[1])],
      end: [round5(end[0]), round5(end[1])],
    },
    points: p.track.map(([lat, lon], i): TrailPoint => [round5(lat), round5(lon), Math.round(p.along[i]), Math.round(p.ele[i])]),
  };
}

// --- A. sentieri CAI interi ---------------------------------------------------------------------------------

type Screened = { id: number; ok: boolean; kind?: string; province?: string; km?: number; climbs?: Record<string, { up: number }> };
const { results } = JSON.parse(await readFile('research/candidati.json', 'utf8')) as { results: Screened[] };
const dayHikes = results.filter(
  (r) =>
    r.ok && r.kind === 'salita' && r.province === 'IT-SO' && r.km! >= DAY.minKm && r.km! <= DAY.maxKm &&
    r.climbs!['5'].up >= DAY.minUp && r.climbs!['5'].up <= DAY.maxUp,
);

const { nameNear, drivable, toll } = await loadPlaces();
const built: Built[] = [];
let skippedNoRoad = 0;
for (const { id: osm } of dayHikes) {
  const rel = await fetchRelation(osm);
  const assembly = assemble(rel);
  if (!assembly.ok) continue;
  const p = await profile(assembly.line);
  const tags = rel.relation.tags;
  // La partenza (in basso) deve essere raggiungibile in macchina: esclude per esempio "da un rifugio all'altro".
  // I sentieri scelti a mano (trails.config.ts) passano comunque: lì vale il giudizio di chi li conosce, perché
  // su OSM le strade di servizio delle valli laterali sono spesso etichettate in modo incompleto (Palazzina Falk).
  const roadOk = drivable(p.track[0]);
  if (!(osm in NAME_OVERRIDES) && !roadOk) {
    skippedNoRoad++;
    continue;
  }

  // Su OSM "from", "to" e i tempi forward/backward seguono il verso della relazione. La nostra traccia va dal basso
  // verso l'alto: se il verso di OSM è opposto, nomi e tempi vanno scambiati. Prima guardiamo i nomi: se uno solo
  // dei due è una meta (rifugio, passo, lago…), quella sta in alto. Solo se i nomi non bastano usiamo l'ordine dei
  // tratti (il primo tratto della relazione sta dalla parte di "from"), che su OSM non sempre è curato.
  const fromIsTarget = destinationOf(cleanName(tags.from ?? '')) !== 'other';
  const toIsTarget = destinationOf(cleanName(tags.to ?? '')) !== 'other';
  let flipped: boolean;
  if (fromIsTarget !== toIsTarget) {
    flipped = fromIsTarget;
  } else {
    const firstWay = rel.ways.get(rel.relation.members.find((m) => m.type === 'way' && rel.ways.has(m.ref))!.ref)!;
    const firstEnds = [firstWay[0], firstWay[firstWay.length - 1]].map((n) => rel.nodes.get(n)!);
    const nearTop = Math.min(...firstEnds.map((q) => haversine(q, p.track[p.track.length - 1])));
    const nearBottom = Math.min(...firstEnds.map((q) => haversine(q, p.track[0])));
    flipped = nearTop < nearBottom;
  }

  const rawFrom = cleanName((flipped ? tags.to : tags.from) ?? '');
  const names = NAME_OVERRIDES[osm] ?? {
    // se la partenza su OSM è un indirizzo ("Strada Statale N.38 dello Stelvio"), meglio la località vicina
    from: looksLikeAddress(rawFrom) ? (nameNear(p.track[0]) ?? rawFrom) : rawFrom,
    to: cleanName((flipped ? tags.from : tags.to) ?? ''),
  };
  const up = minutes(tags[flipped ? 'duration:backward' : 'duration:forward']) ?? null;
  const down = minutes(tags[flipped ? 'duration:forward' : 'duration:backward']) ?? null;
  const b = summarize(
    {
      id: String(osm),
      osm,
      refs: tags.ref ? [tags.ref] : [],
      ...names,
      destination: destinationOf(names.to),
      difficulty: tags.cai_scale as Difficulty,
      unmarked: false,
      checkRoad: !roadOk,
      tollRoad: toll(p.track[0]),
      caiUpMin: up,
      caiDownMin: down,
    },
    p,
  );
  if (b) built.push(b);
}
const fromRoutes = built.length;

// --- B. itinerari calcolati sulla rete ------------------------------------------------------------------------

type Itinerary = { id: string; from: string; to: string; kind: Destination; scale: Difficulty; refs: string[]; unmarked: boolean; toll: boolean; line: LatLon[] };
/**
 * Quando due itinerari portano allo stesso punto, vince la meta più significativa: accanto a un rifugio c'è spesso
 * il suo locale invernale o un bivacco (Capanna Piacco accanto al Rifugio Gianetti), e chi cerca vuole il rifugio.
 */
const PRIORITY: Destination[] = ['hut', 'lake', 'pass', 'bivouac', 'peak', 'alp', 'other'];
const itineraries = (JSON.parse(await readFile('data-cache/itineraries.json', 'utf8')) as Itinerary[]).sort(
  (a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind),
);
let duplicates = 0;
for (const it of itineraries) {
  const p = await profile(it.line);
  const start = p.track[0];
  const end = p.track[p.track.length - 1];
  const dup = built.some(
    (b) => haversine(b.summary.end, end) < SAME_TARGET_M && haversine(b.summary.start, start) < SAME_START_M,
  );
  if (dup) {
    duplicates++;
    continue;
  }
  const b = summarize(
    {
      id: it.id,
      osm: null,
      refs: it.refs,
      from: cleanName(it.from),
      to: cleanName(it.to),
      destination: it.kind,
      difficulty: it.scale,
      unmarked: it.unmarked,
      checkRoad: false, // le partenze degli itinerari sono già scelte vicino a una strada aperta
      tollRoad: it.toll,
      caiUpMin: null,
      caiDownMin: null,
    },
    p,
  );
  if (b) built.push(b);
}

// --- scrittura -------------------------------------------------------------------------------------------------

if (new Set(built.map((b) => b.summary.id)).size !== built.length) throw new Error('Identificatori ripetuti');
// Controllo prima di cancellare le tracce vecchie: con dati d'ingresso rotti (es. una risposta Overpass vuota)
// meglio fermarsi che sostituire 185 giri con zero.
const MIN_TRAILS = 100;
if (built.length < MIN_TRAILS) throw new Error(`Solo ${built.length} giri (attesi almeno ${MIN_TRAILS}): controlla i dati in data-cache, non tocco niente`);
built.sort((a, b) => a.summary.zone.localeCompare(b.summary.zone) || a.summary.to.localeCompare(b.summary.to, 'it'));

await rm('public/trails', { recursive: true, force: true }); // niente tracce vecchie di sentieri tolti
await mkdir('public/trails', { recursive: true });
for (const b of built) {
  const track: TrailTrack = { id: b.summary.id, points: b.points };
  await writeFile(`public/trails/${b.summary.id}.json`, JSON.stringify(track));
}
await writeFile('src/data/trails.json', JSON.stringify(built.map((b) => b.summary), null, 1) + '\n');

const count = (d: Destination) => built.filter((b) => b.summary.destination === d).length;
console.log(
  `${built.length} giri: ${fromRoutes} sentieri CAI interi (${skippedNoRoad} scartati: partenza senza strada) + ` +
    `${built.length - fromRoutes} itinerari calcolati (${duplicates} doppioni scartati)`,
);
console.log(`Mete: rifugi ${count('hut')}, bivacchi ${count('bivouac')}, laghi ${count('lake')}, passi ${count('pass')}, cime ${count('peak')}, alpeggi ${count('alp')}, altro ${count('other')}`);

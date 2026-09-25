/**
 * Itinerari verso le mete, costruiti collegando i pezzi della rete dei sentieri.
 *
 * In Valtellina la rete CAI su OSM è salvata a tratti, da un incrocio all'altro: dei 727 sentieri con nome,
 * 561 iniziano o finiscono a un "innesto". Un'escursione vera ne attraversa diversi. Qui:
 * 1. tutti i sentieri T/E/EE diventano un unico grafo (scripts/lib/graph.ts): la rete CAI numerata più, dove la
 *    rete ha buchi, i sentieri e le piste fuori rete di difficoltà escursionistica (costano il 25% in più, così
 *    l'itinerario usa la rete numerata quando c'è);
 * 2. le partenze sono i punti della rete vicini a un parcheggio o a un paese e a una strada aperta al traffico;
 * 3. le mete sono rifugi, bivacchi, passi e laghi con nome, agganciati al punto di rete più vicino;
 * 4. per ogni meta, Dijkstra trova la partenza da cui si arriva prima (ed eventualmente una seconda, da
 *    un'altra valle);
 * 5. si tengono solo le salite fattibili in giornata.
 *
 * Scrive data-cache/itineraries.json e research/itinerari.md.
 * Uso: node scripts/build-itineraries.ts   (dopo prefetch-overpass.ts, prefetch-places.ts, prefetch-roads.ts e download-dem.sh)
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { climb, sampleElevations } from './lib/elevation.ts';
import { haversine, lineLength, resample, type LatLon } from './lib/geo.ts';
import { buildGraph, minutesToTarget, PointIndex } from './lib/graph.ts';
import { loadPlaces, placeFromRoadName, SETTLEMENT, where } from './lib/places.ts';
import { TRAILHEAD_NAMES } from './trails.config.ts';

/** Diagnosi: DEBUG_TARGET="Gianetti|Allievi" racconta cosa succede alle mete il cui nome corrisponde. */
const DEBUG = process.env.DEBUG_TARGET ? new RegExp(process.env.DEBUG_TARGET, 'i') : null;
function debug(name: string, msg: string) {
  if (DEBUG?.test(name)) console.log(`  [${name}] ${msg}`);
}

const SCALES = ['T', 'E', 'EE'] as const;
/** Quanto costa in più un tratto fuori dalla rete numerata: così l'itinerario lo usa solo dove serve. */
const OFF_NETWORK_PENALTY = 1.25;
/** Oltre questi metri su sentieri fuori rete l'app avvisa: sotto, sono raccordi brevi (dal parcheggio al sentiero). */
const UNMARKED_WARN_M = 500;
type Scale = (typeof SCALES)[number];

// --- 1. la rete ---------------------------------------------------------------------------------------------

type OsmEl =
  | { type: 'node'; id: number; lat: number; lon: number }
  | { type: 'way'; id: number; nodes: number[] }
  | { type: 'relation'; id: number; tags: Record<string, string>; members: { type: string; ref: number; role: string }[] };

const coords = new Map<number, LatLon>();
const ways = new Map<number, number[]>();
/**
 * per ogni tratto: i numeri dei sentieri, la difficoltà più alta tra quelli che lo contengono,
 * e se fa parte della rete CAI numerata
 */
const wayInfo = new Map<number, { refs: Set<string>; scale: Scale; network: boolean; footpath: boolean }>();

for (const f of (await readdir('data-cache/osm')).filter((x) => x.startsWith('relation-'))) {
  const { elements } = JSON.parse(await readFile(`data-cache/osm/${f}`, 'utf8')) as { elements: OsmEl[] };
  const rel = elements.find((e): e is Extract<OsmEl, { type: 'relation' }> => e.type === 'relation' && `relation-${e.id}.json` === f);
  const scale = rel?.tags.cai_scale as Scale | undefined;
  // ferrate (EEA) e sentieri senza difficoltà restano fuori dalla rete: un itinerario non deve mai passarci
  if (!rel || !scale || !SCALES.includes(scale)) continue;
  for (const el of elements) {
    if (el.type === 'node') coords.set(el.id, [el.lat, el.lon]);
    if (el.type === 'way') {
      ways.set(el.id, el.nodes);
      const info = wayInfo.get(el.id) ?? { refs: new Set<string>(), scale, network: true, footpath: true };
      if (rel.tags.ref) info.refs.add(rel.tags.ref);
      if (SCALES.indexOf(scale) > SCALES.indexOf(info.scale)) info.scale = scale;
      wayInfo.set(el.id, info);
    }
  }
}
const networkWays = ways.size;

/**
 * Difficoltà di un sentiero fuori dalla rete numerata, dai tag OSM; null = da non usare.
 * - piste, mulattiere e marciapiedi: turistico;
 * - scala SAC: T1 → T, T2 → E, T3 → EE; T4 e oltre è alpinismo, escluso;
 * - senza scala (il 61% dei sentieri in provincia): lo trattiamo da escursionistico, e l'app avvisa che
 *   l'itinerario passa su tratti non numerati;
 * - tracce poco visibili o segnate come informali: escluse.
 */
function pathScale(tags: Record<string, string>): Scale | null {
  if (tags.informal === 'yes' || /^(bad|horrible|no|poor)$/.test(tags.trail_visibility ?? '')) return null;
  const sac = tags.sac_scale;
  if (sac === 'hiking' || sac === 'strolling') return 'T';
  if (sac === 'mountain_hiking') return 'E';
  if (sac === 'demanding_mountain_hiking') return 'EE';
  if (sac) return null; // alpine_hiking e oltre, o valori non riconosciuti
  return tags.highway === 'path' ? 'E' : 'T';
}

type PathWay = { id: number; nodes: number[]; coords: LatLon[]; tags: Record<string, string> };
const paths = JSON.parse(await readFile('data-cache/paths.json', 'utf8')) as PathWay[];
for (const w of paths) {
  if (ways.has(w.id)) continue; // già nella rete numerata: vale quella
  const scale = pathScale(w.tags);
  if (!scale) continue;
  ways.set(w.id, w.nodes);
  w.nodes.forEach((n, i) => coords.set(n, w.coords[i]));
  wayInfo.set(w.id, { refs: new Set(), scale, network: false, footpath: w.tags.highway === 'path' });
}

const nodeIds = [...new Set([...ways.values()].flat())].filter((id) => coords.has(id));
const nodeEle = await sampleElevations(nodeIds.map((id) => coords.get(id)!));
const eleOf = new Map(nodeIds.map((id, i) => [id, nodeEle[i]]));
const graph = buildGraph(
  [...ways].map(([id, nodes]) => ({ id, nodes: nodes.filter((n) => coords.has(n)) })),
  coords,
  (id) => eleOf.get(id)!,
  (id) => (wayInfo.get(id)!.network ? 1 : OFF_NETWORK_PENALTY),
);
const index = new PointIndex(graph.pos);
console.log(`Rete: ${networkWays} tratti numerati + ${ways.size - networkWays} fuori rete, ${graph.osmIds.length} nodi`);

// --- 2. e 3. partenze e mete --------------------------------------------------------------------------------

const { places, nameNear, drivable, toll, roadEnds } = await loadPlaces();
const settlements = places.filter((p) => SETTLEMENT.has(p.tags.place ?? ''));

// Si arriva in macchina: un parcheggio o un paese a meno di 150 m dalla rete, e quel punto della rete
// vicino a una strada aperta al traffico (scripts/lib/places.ts).
const trailheads = new Map<number, { name: string; toll: boolean }>();
for (const p of [...places.filter((x) => x.tags.amenity === 'parking'), ...settlements]) {
  const q = where(p);
  const hit = q && index.nearest(q, 150);
  if (!hit || trailheads.has(hit.node) || !drivable(graph.pos[hit.node])) continue;
  const name = SETTLEMENT.has(p.tags.place ?? '') ? p.tags.name : nameNear(graph.pos[hit.node]);
  if (name) trailheads.set(hit.node, { name: TRAILHEAD_NAMES[name] ?? name, toll: toll(graph.pos[hit.node]) });
}
// Anche la fine di una strada vicino alla rete è una partenza: in montagna la strada finisce spesso proprio dove
// comincia il sentiero, senza un parcheggio segnato (Piana di Predarossa). Il nome viene dalla strada
// ("Strada per Predarossa" → "Predarossa"); in entrambi i casi vale la tabella scelta a mano in trails.config.ts.
let fromRoadEnds = 0;
for (const end of roadEnds()) {
  const hit = index.nearest(end.at, 100);
  if (!hit || trailheads.has(hit.node)) continue;
  const raw = (end.name && placeFromRoadName(end.name)) || nameNear(end.at);
  const name = (end.name && TRAILHEAD_NAMES[end.name]) || (raw && (TRAILHEAD_NAMES[raw] ?? raw));
  if (!name) continue;
  trailheads.set(hit.node, { name, toll: end.toll });
  fromRoadEnds++;
}
console.log(`Partenze possibili: ${trailheads.size} (di cui ${fromRoadEnds} a fine strada)`);

type Kind = 'hut' | 'bivouac' | 'pass' | 'lake';
type Target = { kind: Kind; name: string; osm: string; node: number };
const targets: Target[] = [];
for (const p of places) {
  const t = p.tags;
  const kind: Kind | null =
    t.tourism === 'alpine_hut' ? 'hut' : t.tourism === 'wilderness_hut' ? 'bivouac' : t.mountain_pass === 'yes' ? 'pass' : t.water === 'lake' ? 'lake' : null;
  if (!kind || !t.name) continue;
  let hit: { node: number; m: number } | null = null;
  if (kind === 'lake') {
    // un lago è una forma: vale il punto di rete più vicino alla riva
    for (const v of p.geometry ?? []) {
      const h = index.nearest([v.lat, v.lon], 120);
      if (h && (!hit || h.m < hit.m)) hit = h;
    }
  } else {
    const q = where(p);
    hit = q && index.nearest(q, kind === 'pass' ? 120 : 200);
  }
  if (hit) targets.push({ kind, name: t.name, osm: `${p.type}/${p.id}`, node: hit.node });
  debug(t.name, hit ? `agganciata alla rete (a ${Math.round(hit.m)} m)` : 'nessun punto della rete abbastanza vicino');
}
console.log(`Mete agganciate alla rete: ${targets.length}`);

// --- 4. e 5. il percorso migliore e i controlli ----------------------------------------------------------

/**
 * Raggio della ricerca, nel "costo" del grafo (minuti DIN sommati tratto per tratto, più il sovrapprezzo fuori rete):
 * è più alto del tempo vero, quindi il limite è largo. I criteri veri di un giro di giornata (lunghezza e dislivello,
 * più sotto) si applicano dopo. Con 360 restavano fuori salite classiche come Bagni di Masino → Rifugio Gianetti.
 */
const MAX_MINUTES = 540;
const DAY = { minKm: 2, maxKm: 15, minUp: 250, maxUp: 1700 };
const MIN_NET_RATIO = 0.6; // come nello screening: deve essere una salita verso la meta, non una traversata

export type Itinerary = {
  id: string;
  from: string;
  to: string;
  kind: Kind;
  target: string;
  scale: Scale;
  refs: string[];
  /** true se una parte del percorso segue sentieri o piste fuori dalla rete CAI numerata */
  unmarked: boolean;
  /** true se la strada per la partenza è a pedaggio */
  toll: boolean;
  line: LatLon[];
  km: number;
  up: number;
  startEle: number;
  endEle: number;
};

const itineraries: Itinerary[] = [];
const rejected = new Map<string, number>();
const reject = (why: string) => rejected.set(why, (rejected.get(why) ?? 0) + 1);

for (const target of targets) {
  const { cost, next } = minutesToTarget(graph, target.node, MAX_MINUTES);
  const reached = [...trailheads]
    .filter(([node]) => cost.has(node) && graph.ele[node] < graph.ele[target.node] - 150)
    .map(([node, th]) => ({ node, name: th.name, toll: th.toll, minutes: cost.get(node)! }))
    .sort((a, b) => a.minutes - b.minutes);
  debug(target.name, `${cost.size} nodi raggiungibili in ${MAX_MINUTES} min; partenze più in basso raggiunte: ${reached.slice(0, 3).map((r) => `${r.name} (${Math.round(r.minutes)} min)`).join(', ') || 'nessuna'}`);
  if (reached.length === 0) {
    reject('nessuna partenza raggiungibile');
    continue;
  }
  // la partenza migliore, più eventualmente una seconda da un'altra valle (nome diverso, a oltre 3 km, non molto più lunga)
  const chosen = [reached[0]];
  const alt = reached.find(
    (r) => r.name !== reached[0].name && haversine(graph.pos[r.node], graph.pos[reached[0].node]) > 3000 && r.minutes <= reached[0].minutes * 1.35,
  );
  if (alt) chosen.push(alt);

  for (const start of chosen) {
    const nodes = [start.node];
    const usedWays: number[] = [];
    while (nodes[nodes.length - 1] !== target.node) {
      const step = next.get(nodes[nodes.length - 1])!;
      nodes.push(step.node);
      usedWays.push(step.way);
    }
    const line = nodes.map((n) => graph.pos[n]);
    // metri percorsi su sentieri veri fuori dalla rete numerata (piste e vialetti non contano: lì non ci si perde)
    let unmarkedM = 0;
    usedWays.forEach((w, k) => {
      const info = wayInfo.get(w)!;
      if (!info.network && info.footpath) unmarkedM += haversine(graph.pos[nodes[k]], graph.pos[nodes[k + 1]]);
    });
    const { points } = resample(line, 50);
    const ele = await sampleElevations(points);
    const { up } = climb(ele, 5);
    const km = lineLength(line) / 1000;
    const net = ele[ele.length - 1] - ele[0];
    if (km < DAY.minKm || km > DAY.maxKm) { reject('lunghezza fuori 2–15 km'); debug(target.name, `${start.name}: scartato, ${'lunghezza fuori 2–15 km'} (${km.toFixed(1)} km, +${Math.round(up)} m)`); continue; }
    if (up < DAY.minUp || up > DAY.maxUp) { reject('dislivello fuori 250–1700 m'); debug(target.name, `${start.name}: scartato, ${'dislivello fuori 250–1700 m'} (${km.toFixed(1)} km, +${Math.round(up)} m)`); continue; }
    if (net < MIN_NET_RATIO * climb(ele, 25).up) { reject('non è una salita (sali e scendi)'); debug(target.name, `${start.name}: scartato, ${'non è una salita (sali e scendi)'} (${km.toFixed(1)} km, +${Math.round(up)} m)`); continue; }

    const scale = usedWays.reduce<Scale>((s, w) => {
      const ws = wayInfo.get(w)!.scale;
      return SCALES.indexOf(ws) > SCALES.indexOf(s) ? ws : s;
    }, 'T');
    const refs = [...new Set(usedWays.flatMap((w) => [...wayInfo.get(w)!.refs]))].slice(0, 4);
    itineraries.push({
      id: `${target.osm.replace('/', '-')}-${graph.osmIds[start.node]}`,
      from: start.name,
      to: target.name,
      kind: target.kind,
      target: target.osm,
      scale,
      refs,
      unmarked: unmarkedM > UNMARKED_WARN_M,
      toll: start.toll,
      line,
      km,
      up,
      startEle: ele[0],
      endEle: ele[ele.length - 1],
    });
  }
}

const byKind = (k: Kind) => itineraries.filter((i) => i.kind === k).length;
console.log(`\nItinerari di giornata: ${itineraries.length} (rifugi ${byKind('hut')}, bivacchi ${byKind('bivouac')}, passi ${byKind('pass')}, laghi ${byKind('lake')})`);
console.log('Scartati:', Object.fromEntries(rejected));

await writeFile('data-cache/itineraries.json', JSON.stringify(itineraries));
const rows = [...itineraries]
  .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to))
  .map((i) => `| ${i.from} | ${i.to} | ${i.kind} | ${i.scale} | ${i.refs.join(', ')} | ${i.km.toFixed(1)} | +${Math.round(i.up)} | ${Math.round(i.startEle)} → ${Math.round(i.endEle)} |`);
await writeFile(
  'research/itinerari.md',
  `# Itinerari verso le mete

Generato da \`scripts/build-itineraries.ts\`: ${itineraries.length} itinerari di giornata da ${trailheads.size} partenze possibili
verso ${targets.length} mete agganciate alla rete.

| Partenza | Meta | Tipo | Diff. | Sentieri | km | Salita m | Quota m |
|---|---|---|---|---|---|---|---|
${rows.join('\n')}
`,
);
console.log('Scritti data-cache/itineraries.json e research/itinerari.md');

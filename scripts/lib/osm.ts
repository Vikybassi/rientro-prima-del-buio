import { fetchJsonCached } from './fetch-cached.ts';
import type { LatLon } from './geo.ts';

type OsmNode = { type: 'node'; id: number; lat: number; lon: number };
type OsmWay = { type: 'way'; id: number; nodes: number[] };
type OsmMember = { type: 'node' | 'way' | 'relation'; ref: number; role: string };
export type OsmRelation = { type: 'relation'; id: number; tags: Record<string, string>; members: OsmMember[] };
type OsmElement = OsmNode | OsmWay | OsmRelation;

export type TrailRelation = {
  relation: OsmRelation;
  ways: Map<number, number[]>;
  nodes: Map<number, LatLon>;
};

/** Scarica una relazione con tutti i suoi tratti e nodi dall'API principale di OSM (più stabile di Overpass). */
export async function fetchRelation(id: number): Promise<TrailRelation> {
  const { elements } = await fetchJsonCached<{ elements: OsmElement[] }>(
    `osm/relation-${id}.json`,
    `https://api.openstreetmap.org/api/0.6/relation/${id}/full.json`,
  );
  const nodes = new Map<number, LatLon>();
  const ways = new Map<number, number[]>();
  let relation: OsmRelation | undefined;
  for (const el of elements) {
    if (el.type === 'node') nodes.set(el.id, [el.lat, el.lon]);
    else if (el.type === 'way') ways.set(el.id, el.nodes);
    else if (el.id === id) relation = el;
  }
  if (!relation) throw new Error(`Relazione ${id} non trovata nella risposta`);
  return { relation, ways, nodes };
}

export type Assembly =
  | { ok: true; line: LatLon[]; ways: number }
  | { ok: false; reason: 'vuoto' | 'interrotto' | 'ramificato' | 'anello' | 'sensi unici'; detail: string };

/** Ruoli che indicano varianti o raccordi, non il percorso principale. */
const SIDE_ROLES = new Set(['alternative', 'excursion', 'approach', 'connection']);

/**
 * Ricostruisce la traccia come una linea unica.
 *
 * I tratti dentro una relazione OSM non sono sempre nell'ordine giusto: prenderli in sequenza produce salti
 * (sul sentiero 331 la traccia finiva 500 m sotto il rifugio). Qui li trattiamo come archi di un grafo tra i
 * loro estremi e lo percorriamo da un capo all'altro. Funziona solo se il sentiero è un percorso semplice:
 * esattamente due estremi liberi, nessuna biforcazione, un unico pezzo. Gli altri casi vengono scartati con
 * il motivo, così si possono controllare a mano.
 */
export function assemble({ relation, ways, nodes }: TrailRelation): Assembly {
  const members = relation.members.filter((m) => m.type === 'way' && !SIDE_ROLES.has(m.role));
  if (members.some((m) => m.role === 'forward' || m.role === 'backward')) {
    return { ok: false, reason: 'sensi unici', detail: 'tratti percorribili in un solo verso' };
  }
  const wayIds = [...new Set(members.map((m) => m.ref))].filter((id) => (ways.get(id)?.length ?? 0) >= 2);
  if (wayIds.length === 0) return { ok: false, reason: 'vuoto', detail: 'nessun tratto' };

  // grafo: per ogni nodo di estremità, i tratti che partono da lì (già orientati in uscita)
  const edges = new Map<number, { way: number; seq: number[] }[]>();
  const link = (node: number, way: number, seq: number[]) => {
    const list = edges.get(node) ?? [];
    list.push({ way, seq });
    edges.set(node, list);
  };
  for (const id of wayIds) {
    const seq = ways.get(id)!;
    link(seq[0], id, seq);
    link(seq[seq.length - 1], id, [...seq].reverse());
  }

  const degrees = [...edges.values()].map((e) => e.length);
  if (degrees.some((d) => d > 2)) {
    return { ok: false, reason: 'ramificato', detail: `${degrees.filter((d) => d > 2).length} bivi` };
  }
  const ends = [...edges.entries()].filter(([, e]) => e.length === 1).map(([node]) => node);
  if (ends.length === 0) return { ok: false, reason: 'anello', detail: 'percorso ad anello' };

  // percorre il grafo dal primo estremo; se non usa tutti i tratti, il sentiero è spezzato in più pezzi
  const used = new Set<number>();
  const nodeIds = [ends[0]];
  let current = ends[0];
  for (;;) {
    const next = edges.get(current)!.find((e) => !used.has(e.way));
    if (!next) break;
    used.add(next.way);
    nodeIds.push(...next.seq.slice(1));
    current = next.seq[next.seq.length - 1];
  }
  if (used.size < wayIds.length || ends.length !== 2) {
    return { ok: false, reason: 'interrotto', detail: `${ends.length / 2} pezzi separati` };
  }

  const line = nodeIds.map((id) => nodes.get(id)).filter((p): p is LatLon => p !== undefined);
  return { ok: true, line, ways: wayIds.length };
}

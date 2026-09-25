import { dinHours } from '../../src/engine/time.ts';
import { haversine, type LatLon } from './geo.ts';

/**
 * La rete dei sentieri come grafo: i nodi sono i punti OSM, gli archi i pezzi di sentiero tra due punti consecutivi.
 * Ogni arco ha due costi in minuti, uno per verso, perché salire costa più che scendere (formula DIN).
 */
export type Edge = { to: number; way: number; out: number; in: number };

export type Graph = {
  osmIds: number[];
  pos: LatLon[];
  ele: number[];
  edges: Edge[][];
  indexOf: Map<number, number>;
};

export function buildGraph(
  ways: Iterable<{ id: number; nodes: number[] }>,
  coords: Map<number, LatLon>,
  elevationOf: (osmId: number) => number,
  /** moltiplicatore del costo di un tratto: >1 per scoraggiarlo (es. sentieri fuori dalla rete numerata) */
  penalty: (wayId: number) => number = () => 1,
): Graph {
  const g: Graph = { osmIds: [], pos: [], ele: [], edges: [], indexOf: new Map() };
  const node = (osmId: number) => {
    let i = g.indexOf.get(osmId);
    if (i === undefined) {
      i = g.osmIds.length;
      g.indexOf.set(osmId, i);
      g.osmIds.push(osmId);
      g.pos.push(coords.get(osmId)!);
      g.ele.push(elevationOf(osmId));
      g.edges.push([]);
    }
    return i;
  };
  const minutes = (km: number, dz: number) => dinHours(km, Math.max(dz, 0), Math.max(-dz, 0)) * 60;

  for (const way of ways) {
    const f = penalty(way.id);
    for (let k = 1; k < way.nodes.length; k++) {
      const a = node(way.nodes[k - 1]);
      const b = node(way.nodes[k]);
      if (a === b) continue;
      const km = haversine(g.pos[a], g.pos[b]) / 1000;
      const dz = g.ele[b] - g.ele[a];
      g.edges[a].push({ to: b, way: way.id, out: f * minutes(km, dz), in: f * minutes(km, -dz) });
      g.edges[b].push({ to: a, way: way.id, out: f * minutes(km, -dz), in: f * minutes(km, dz) });
    }
  }
  return g;
}

/**
 * Indice spaziale a griglia: trova in fretta il punto più vicino a una posizione.
 * Serve per i nodi della rete (dove agganciare mete e partenze) e per le strade (si arriva in macchina?).
 */
export class PointIndex {
  private cells = new Map<string, number[]>();
  private readonly size = 0.003; // gradi: circa 330 m in latitudine, 230 m in longitudine a queste latitudini
  private readonly points: LatLon[];

  constructor(points: LatLon[]) {
    this.points = points;
    points.forEach(([lat, lon], i) => {
      const key = this.key(lat, lon);
      const cell = this.cells.get(key) ?? [];
      cell.push(i);
      this.cells.set(key, cell);
    });
  }

  private key(lat: number, lon: number) {
    return `${Math.floor(lat / this.size)},${Math.floor(lon / this.size)}`;
  }

  /** L'indice del punto più vicino entro `maxM` metri, con la distanza, oppure null. */
  nearest(p: LatLon, maxM: number): { node: number; m: number } | null {
    const reach = Math.ceil(maxM / 200) + 1;
    const [cy, cx] = [Math.floor(p[0] / this.size), Math.floor(p[1] / this.size)];
    let best: { node: number; m: number } | null = null;
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        for (const i of this.cells.get(`${cy + dy},${cx + dx}`) ?? []) {
          const m = haversine(p, this.points[i]);
          if (m <= maxM && (!best || m < best.m)) best = { node: i, m };
        }
      }
    }
    return best;
  }
}

/** Coda con priorità (heap binario) per Dijkstra. */
class MinHeap {
  private items: [number, number][] = [];
  get size() {
    return this.items.length;
  }
  push(item: [number, number]) {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): [number, number] {
    const a = this.items;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

/**
 * Dijkstra "all'indietro" dalla meta: per ogni nodo, quanti minuti servono per andare da lì alla meta
 * (usando il costo nel verso della salita) e quale nodo viene dopo sul percorso migliore.
 * Si ferma oltre `maxMinutes`: nessuna partenza più lontana di così interessa.
 */
export function minutesToTarget(g: Graph, target: number, maxMinutes: number) {
  const cost = new Map<number, number>([[target, 0]]);
  const next = new Map<number, { node: number; way: number }>();
  const heap = new MinHeap();
  heap.push([0, target]);
  while (heap.size) {
    const [c, v] = heap.pop();
    if (c > (cost.get(v) ?? Infinity) || c > maxMinutes) continue;
    for (const e of g.edges[v]) {
      // arco v→u; a noi serve il costo per andare da u a v, cioè `in`
      const nc = c + e.in;
      if (nc < (cost.get(e.to) ?? Infinity)) {
        cost.set(e.to, nc);
        next.set(e.to, { node: v, way: e.way });
        heap.push([nc, e.to]);
      }
    }
  }
  return { cost, next };
}

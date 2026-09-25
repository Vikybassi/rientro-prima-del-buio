/**
 * Forma dei dati dei sentieri, condivisa tra lo script che li genera (scripts/build-trails.ts)
 * e l'app che li legge: se uno dei due cambia, TypeScript segnala l'altro.
 */

export type Zone = 'valchiavenna' | 'bassa-valtellina' | 'valmalenco' | 'media-valtellina' | 'alta-valtellina';

/** Scala CAI: T turistico, E escursionistico, EE per escursionisti esperti. */
export type Difficulty = 'T' | 'E' | 'EE';

/** Riepilogo di un sentiero: tutto quello che serve per l'elenco, senza la traccia. */
export type TrailSummary = {
  /** id della relazione su OpenStreetMap */
  osm: number;
  /** numero del sentiero sui cartelli (es. "331"), se c'è */
  ref: string;
  from: string;
  to: string;
  zone: Zone;
  difficulty: Difficulty;
  /** solo andata, dalla partenza alla meta */
  lengthM: number;
  upM: number;
  downM: number;
  startEle: number;
  endEle: number;
  maxEle: number;
  /** tempi rilevati dal CAI, in minuti, quando ci sono (salita e ritorno) */
  caiUpMin: number | null;
  caiDownMin: number | null;
  /** [lat, lon] */
  start: [number, number];
  end: [number, number];
};

/** Un punto della traccia ricampionata: [lat, lon, distanza dalla partenza in m, quota in m]. */
export type TrailPoint = [number, number, number, number];

/** Traccia completa, caricata solo quando si apre il sentiero (public/trails/<osm>.json). */
export type TrailTrack = { osm: number; points: TrailPoint[] };

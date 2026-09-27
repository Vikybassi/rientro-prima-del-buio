/**
 * Forma dei dati dei sentieri, condivisa tra lo script che li genera (scripts/build-trails.ts)
 * e l'app che li legge: se uno dei due cambia, TypeScript segnala l'altro.
 */

export type Zone = 'valchiavenna' | 'bassa-valtellina' | 'valmalenco' | 'media-valtellina' | 'alta-valtellina';

/** Scala CAI: T turistico, E escursionistico, EE per escursionisti esperti. */
export type Difficulty = 'T' | 'E' | 'EE';

/** Che cosa c'è alla meta: serve per filtrare l'elenco. */
export type Destination = 'hut' | 'bivouac' | 'lake' | 'pass' | 'peak' | 'alp' | 'other';

/** Riepilogo di un sentiero: tutto quello che serve per l'elenco, senza la traccia. */
export type TrailSummary = {
  /** identificatore nell'indirizzo: il numero della relazione OSM per i sentieri CAI, un codice per gli itinerari */
  id: string;
  /**
   * id della relazione su OpenStreetMap se il giro è un sentiero CAI intero; null se è un itinerario calcolato
   * collegando più sentieri della rete
   */
  osm: number | null;
  /** numeri dei sentieri sui cartelli (es. ["331"], o ["342", "301"] per un itinerario) */
  refs: string[];
  from: string;
  to: string;
  destination: Destination;
  zone: Zone;
  difficulty: Difficulty;
  /** solo andata, dalla partenza alla meta */
  lengthM: number;
  upM: number;
  downM: number;
  startEle: number;
  endEle: number;
  maxEle: number;
  /** true se una parte del percorso segue sentieri o piste fuori dalla rete CAI numerata */
  unmarked: boolean;
  /**
   * true se su OSM non risulta una strada aperta al traffico vicino alla partenza (tenuto perché scelto a mano):
   * l'app chiede di verificare l'accesso in auto
   */
  checkRoad: boolean;
  /** true se la strada per la partenza è a pedaggio (tag OSM toll=yes) */
  tollRoad: boolean;
  /** tempi rilevati dal CAI, in minuti, quando ci sono (salita e ritorno) */
  caiUpMin: number | null;
  caiDownMin: number | null;
  /** [lat, lon] */
  start: [number, number];
  end: [number, number];
};

/** Un punto della traccia ricampionata: [lat, lon, distanza dalla partenza in m, quota in m]. */
export type TrailPoint = [number, number, number, number];

/** Che cosa si incontra lungo il giro (scripts/add-stops.ts). */
export type StopKind = 'hut' | 'bivouac' | 'lake' | 'pass' | 'peak' | 'alp' | 'water' | 'viewpoint';

/** Una tappa lungo il percorso: nome (null per una fontana senza nome), tipo, distanza dalla partenza e quota. */
export type Stop = { name: string | null; kind: StopKind; d: number; ele: number };

/** Traccia completa, caricata solo quando si apre il sentiero (public/trails/<id>.json). */
/**
 * L'orizzonte verso ovest visto dalla partenza e dalla meta: per ogni direzione della bussola da HORIZON_AZ0 gradi
 * (sud) in avanti, un grado alla volta, quanto sono alte le montagne sopra l'orizzonte, in decimi di grado.
 * Serve a sapere quando il sole sparisce dietro le montagne (engine/sun.ts `shadeAt`).
 */
export type Horizon = { start: number[]; end: number[] };
export const HORIZON_AZ0 = 180;

export type TrailTrack = { id: string; points: TrailPoint[]; stops?: Stop[]; horizon?: Horizon };

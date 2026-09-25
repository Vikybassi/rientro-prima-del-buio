import type { TrailPoint } from '../data/types.ts';

/**
 * Tempi di percorrenza.
 *
 * Base: la formula DIN 33466, lo standard dei club alpini di lingua tedesca per i tempi sui cartelli.
 * Tempo in orizzontale a 4 km/h, in verticale a 300 m/h in salita e 500 m/h in discesa;
 * il totale è il maggiore dei due più metà del minore (in salita ripida conta il dislivello, in piano la distanza).
 */
export function dinHours(km: number, upM: number, downM: number): number {
  const horizontal = km / 4;
  const vertical = upM / 300 + downM / 500;
  return Math.max(horizontal, vertical) + Math.min(horizontal, vertical) / 2;
}

/**
 * Quanto i cartelli CAI sono più veloci della formula DIN: la mediana di 37 tempi ufficiali della provincia di
 * Sondrio (scripts/calibrate-time.ts). Vale per i sentieri che non hanno un cartello loro.
 */
export const CAI_OVER_DIN = 0.9;

/**
 * Il margine per "se ci metti di più" (stanchezza, un tratto rovinato, una pausa in più): il 15% del giro,
 * ma al massimo un'ora in tutto.
 *
 * Prima era il +26% che separa il 90° percentile dei cartelli dalla mediana: su un giro di 9 ore diventava più di
 * due ore, e si sommava al passo scelto (chi diceva "sono veloce" si vedeva togliere il 20% e riaggiungere il 26%).
 * Il passo lo dichiara chi cammina; il margine copre solo gli imprevisti della giornata.
 */
export const PRUDENT_EXTRA = { share: 0.15, maxMin: 60 } as const;

/**
 * Rapporti "tempo CAI / formula" accettati per un singolo sentiero. Nei dati vanno da 0,56 a 1,19: fuori da
 * questo intervallo è più probabile un errore di battitura nel tag OSM (es. "0:20" invece di "2:20") che un
 * sentiero davvero così diverso, e usiamo il valore tipico.
 */
const PLAUSIBLE_RATIO = { min: 0.5, max: 1.3 } as const;

/** Il passo dell'escursionista rispetto ai tempi dei cartelli. */
export type Pace = 'slow' | 'average' | 'fast';
export const PACE_FACTOR: Record<Pace, number> = { slow: 1.25, average: 1, fast: 0.8 };

/**
 * Quanto un sentiero è "veloce" rispetto alla formula. Se c'è il tempo del cartello CAI è il dato migliore
 * per *quel* sentiero (conosce il fondo, i tornanti, i tratti esposti); altrimenti usiamo il valore tipico.
 */
export function officialRatio(officialMin: number | null, formulaMin: number): number | null {
  if (!officialMin || formulaMin <= 0) return null;
  const r = officialMin / formulaMin;
  return r >= PLAUSIBLE_RATIO.min && r <= PLAUSIBLE_RATIO.max ? r : null;
}

export type Range = { estimate: number; prudent: number };

/** Minuti stimati per una tratta, dati i minuti della formula DIN, il rapporto del sentiero e il passo. */
export function legMinutes(formulaMin: number, ratio: number, pace: Pace): number {
  return formulaMin * ratio * PACE_FACTOR[pace];
}

/**
 * Salita e ritorno con il loro caso prudente. Il margine si calcola sul giro intero (così il tetto di un'ora vale
 * per tutta la giornata) e si divide tra le due tratte in proporzione alla loro durata.
 */
export function withMargin(upMin: number, downMin: number): { upMin: Range; downMin: Range } {
  const total = upMin + downMin;
  const factor = total > 0 ? 1 + Math.min(PRUDENT_EXTRA.share, PRUDENT_EXTRA.maxMin / total) : 1;
  return {
    upMin: { estimate: upMin, prudent: upMin * factor },
    downMin: { estimate: downMin, prudent: downMin * factor },
  };
}

/**
 * Minuti trascorsi quando si arriva a ogni punto della traccia, percorrendola nell'ordine dato.
 *
 * Il totale viene dalla formula applicata all'intera tratta (con il dislivello filtrato del riepilogo);
 * poi lo distribuiamo tra i punti in proporzione alla fatica di ogni tratto da 50 m. Così un tratto ripido
 * "costa" più minuti di uno in piano, e la somma torna esattamente col totale.
 */
export function arrivalMinutes(points: TrailPoint[], totalMinutes: number): number[] {
  const effort = [0];
  for (let i = 1; i < points.length; i++) {
    const km = (points[i][2] - points[i - 1][2]) / 1000;
    const dz = points[i][3] - points[i - 1][3];
    effort.push(dinHours(Math.abs(km), Math.max(dz, 0), Math.max(-dz, 0)));
  }
  const totalEffort = effort.reduce((a, b) => a + b, 0);
  let acc = 0;
  return effort.map((e) => (acc += e) * (totalMinutes / totalEffort));
}

/** La stessa traccia percorsa al contrario (per il ritorno), con le distanze ricontate dalla meta. */
export function reverseTrack(points: TrailPoint[]): TrailPoint[] {
  const total = points[points.length - 1][2];
  return [...points].reverse().map(([lat, lon, d, ele]): TrailPoint => [lat, lon, total - d, ele]);
}

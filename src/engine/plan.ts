import type { TrailPoint, TrailSummary } from '../data/types.ts';
import { addMinutes, localToInstant } from './clock.ts';
import { daylight, type Daylight } from './sun.ts';
import { arrivalMinutes, CAI_OVER_DIN, dinHours, legRange, officialRatio, reverseTrack, type Pace, type Range } from './time.ts';
import type { Hazard, Moment } from './weather.ts';

/**
 * Il piano di un giro andata e ritorno e il verdetto: "si rientra prima del buio?".
 *
 * Tutto il ragionamento sulla sicurezza usa il caso prudente (vedi time.ts); la stima serve per mostrare
 * un orario "tipico" accanto a quello prudente.
 */

/** Margine di luce che vogliamo avere al rientro: arrivare alla macchina proprio al tramonto non è un piano. */
export const LIGHT_MARGIN_MIN = 30;

export type PlanInput = {
  trail: TrailSummary;
  track: TrailPoint[];
  /** data locale "AAAA-MM-GG" */
  date: string;
  /** ora di partenza locale "HH:MM" */
  start: string;
  pace: Pace;
  /** sosta alla meta, in minuti (i tempi dei cartelli non comprendono le soste) */
  stopMin: number;
};

export type LightStatus = 'ok' | 'tight' | 'dark';

export type Plan = {
  startAt: Date;
  /** da dove vengono i tempi: dal cartello CAI di questo sentiero o dalla formula con il valore tipico */
  timeSource: 'cai' | 'formula';
  upMin: Range;
  downMin: Range;
  stopMin: number;
  summitAt: { estimate: Date; prudent: Date };
  backAt: { estimate: Date; prudent: Date };
  light: Daylight;
  /** l'ora di partenza più tarda per rientrare (nel caso prudente) con il margine di luce */
  latestStart: Date;
  lightStatus: LightStatus;
  startsInDark: boolean;
  /** dove si è e quando, nel caso prudente: per il profilo colorato e per il meteo */
  moments: (Moment & { leg: 'up' | 'down'; d: number })[];
};

/**
 * Tempi di salita e ritorno di un sentiero, per un passo. Li usano il piano e l'elenco (il tempo di salita accanto
 * a ogni giro): un calcolo solo, così non possono dare numeri diversi.
 */
export function trailTimes(trail: TrailSummary, pace: Pace): { upMin: Range; downMin: Range; timeSource: 'cai' | 'formula' } {
  const km = trail.lengthM / 1000;
  // al ritorno la salita dell'andata diventa discesa e viceversa
  const formulaUp = dinHours(km, trail.upM, trail.downM) * 60;
  const formulaDown = dinHours(km, trail.downM, trail.upM) * 60;
  // il CAI di solito rileva solo l'andata: il rapporto trovato su una tratta vale anche per l'altra
  const cai = {
    up: officialRatio(trail.caiUpMin, formulaUp),
    down: officialRatio(trail.caiDownMin, formulaDown),
  };
  const fallback = cai.up ?? cai.down ?? CAI_OVER_DIN.estimate;
  return {
    upMin: legRange(formulaUp, cai.up ?? fallback, pace),
    downMin: legRange(formulaDown, cai.down ?? fallback, pace),
    timeSource: cai.up !== null || cai.down !== null ? 'cai' : 'formula',
  };
}

export function makePlan({ trail, track, date, start, pace, stopMin }: PlanInput): Plan {
  const { upMin, downMin, timeSource } = trailTimes(trail, pace);

  const startAt = localToInstant(date, start);
  const summitAt = { estimate: addMinutes(startAt, upMin.estimate), prudent: addMinutes(startAt, upMin.prudent) };
  const backAt = {
    estimate: addMinutes(startAt, upMin.estimate + stopMin + downMin.estimate),
    prudent: addMinutes(startAt, upMin.prudent + stopMin + downMin.prudent),
  };

  const light = daylight(date, trail.start[0], trail.start[1]);
  const deadline = addMinutes(light.sunset, -LIGHT_MARGIN_MIN);
  const latestStart = addMinutes(deadline, -(upMin.prudent + stopMin + downMin.prudent));
  const lightStatus: LightStatus =
    backAt.prudent <= deadline ? 'ok' : backAt.prudent <= light.dusk ? 'tight' : 'dark';

  const back = reverseTrack(track);
  const upTimes = arrivalMinutes(track, upMin.prudent);
  const downTimes = arrivalMinutes(back, downMin.prudent);
  const moments = [
    ...track.map(([, , d, ele], i) => ({ at: addMinutes(startAt, upTimes[i]), ele, d, leg: 'up' as const })),
    ...back.map(([, , d, ele], i) => ({ at: addMinutes(summitAt.prudent, stopMin + downTimes[i]), ele, d, leg: 'down' as const })),
  ];

  return {
    startAt,
    timeSource,
    upMin,
    downMin,
    stopMin,
    summitAt,
    backAt,
    light,
    latestStart,
    lightStatus,
    startsInDark: startAt < light.dawn,
    moments,
  };
}

export type Verdict = 'go' | 'caution' | 'no-go';

/**
 * Il verdetto finale mette insieme luce e meteo, e vince il caso peggiore:
 * - no: si rientra col buio, oppure c'è un pericolo meteo (temporale, raffiche molto forti);
 * - attenzione: si rientra con poco margine, si parte col buio, o c'è un avviso meteo;
 * - vai: tutto il resto.
 */
export function verdict(plan: Plan, hazards: Hazard[]): Verdict {
  if (plan.lightStatus === 'dark' || hazards.some((h) => h.level === 'danger')) return 'no-go';
  if (plan.lightStatus === 'tight' || plan.startsInDark || hazards.length > 0) return 'caution';
  return 'go';
}

export type Answer = 'ok' | 'ok-weather' | 'weather-no' | 'tight' | 'dark';

/**
 * La risposta da mostrare come titolo. La luce viene prima (è la domanda dell'app): se si rientra col buio è "no"
 * qualunque sia il meteo. Poi un pericolo meteo fa diventare "no" anche un giro con tutta la luce del mondo.
 */
export function answer(plan: Plan, hazards: Hazard[]): Answer {
  if (plan.lightStatus === 'dark') return 'dark';
  if (hazards.some((h) => h.level === 'danger')) return 'weather-no';
  if (plan.lightStatus === 'tight') return 'tight';
  return hazards.length > 0 ? 'ok-weather' : 'ok';
}

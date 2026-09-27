import type { Horizon, TrailPoint, TrailSummary } from '../data/types.ts';
import { addMinutes, localToInstant } from './clock.ts';
import { daylight, shadeAt, type Daylight } from './sun.ts';
import { arrivalMinutes, CAI_OVER_DIN, dinHours, legMinutes, officialRatio, reverseTrack, withMargin, type Pace, type Range } from './time.ts';
import type { Hazard, Moment } from './weather.ts';

/**
 * Il piano di un giro e il verdetto. Due modi:
 * - andata e ritorno (il solito): "si rientra alla macchina prima del buio?";
 * - pernotto (solo se la meta è un rifugio o un bivacco): "si arriva alla meta prima del buio?", e il giorno dopo si
 *   scende con calma.
 *
 * Ogni tempo ha una stima (col passo scelto) e un caso prudente (se ci si mette di più, vedi time.ts).
 * Il "sì" e l'ultima ora di partenza usano il caso prudente; il "no" per la luce arriva solo quando anche la stima
 * rientra col buio. In mezzo c'è "al limite".
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
  /** true = si dorme alla meta (rifugio o bivacco): conta l'arrivo, non il rientro */
  overnight?: boolean;
  /** l'orizzonte della partenza e della meta (scripts/add-horizon.ts): se c'è, si sa quando il sole va dietro i monti */
  horizon?: Horizon;
};

export type LightStatus = 'ok' | 'tight' | 'dark';

export type Plan = {
  /** true = si dorme alla meta: la giornata finisce all'arrivo */
  overnight: boolean;
  startAt: Date;
  /** da dove vengono i tempi: dal cartello CAI di questo sentiero o dalla formula con il valore tipico */
  timeSource: 'cai' | 'formula';
  upMin: Range;
  downMin: Range;
  stopMin: number;
  summitAt: { estimate: Date; prudent: Date };
  backAt: { estimate: Date; prudent: Date };
  /** quando finisce la giornata di cammino: il rientro alla macchina, o l'arrivo alla meta se ci si dorme */
  endAt: { estimate: Date; prudent: Date };
  light: Daylight;
  /** l'ora entro cui finire la giornata con margine: tramonto meno LIGHT_MARGIN_MIN */
  deadline: Date;
  /**
   * Quando il sole sparisce dietro le montagne dove finisce la giornata (la partenza, o la meta per chi ci dorme):
   * da lì si è in ombra, ma la luce resta fino al tramonto. `at` null = dietro le montagne già dal primo pomeriggio.
   * null se il giro non ha l'orizzonte.
   */
  shade: { at: Date | null } | null;
  /** pernotto: la luce del giorno dopo alla meta e quanto ci vuole a scendere */
  nextDay: { light: Daylight; downMin: Range } | null;
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
  const fallback = cai.up ?? cai.down ?? CAI_OVER_DIN;
  return {
    ...withMargin(legMinutes(formulaUp, cai.up ?? fallback, pace), legMinutes(formulaDown, cai.down ?? fallback, pace)),
    timeSource: cai.up !== null || cai.down !== null ? 'cai' : 'formula',
  };
}

export function makePlan({ trail, track, date, start, pace, stopMin: stopInput, overnight = false, horizon }: PlanInput): Plan {
  const { upMin, downMin, timeSource } = trailTimes(trail, pace);
  // chi dorme alla meta non fa "sosta in cima": arriva e si ferma
  const stopMin = overnight ? 0 : stopInput;

  const startAt = localToInstant(date, start);
  const summitAt = { estimate: addMinutes(startAt, upMin.estimate), prudent: addMinutes(startAt, upMin.prudent) };
  const backAt = {
    estimate: addMinutes(startAt, upMin.estimate + stopMin + downMin.estimate),
    prudent: addMinutes(startAt, upMin.prudent + stopMin + downMin.prudent),
  };

  const endAt = overnight ? summitAt : backAt;
  // la luce che conta è quella dove finisce la giornata: la partenza, o la meta per chi ci dorme
  const where = overnight ? trail.end : trail.start;
  const light = daylight(date, where[0], where[1]);
  const deadline = addMinutes(light.sunset, -LIGHT_MARGIN_MIN);
  const latestStart = addMinutes(deadline, -(overnight ? upMin.prudent : upMin.prudent + stopMin + downMin.prudent));
  // "sì" solo se c'è margine anche andando più piano; "no" solo se col passo dichiarato si arriva già col buio.
  // Così il titolo non contraddice mai l'orario che la risposta mostra per primo.
  const lightStatus: LightStatus =
    endAt.prudent <= deadline ? 'ok' : endAt.estimate <= light.dusk ? 'tight' : 'dark';

  const back = reverseTrack(track);
  const upTimes = arrivalMinutes(track, upMin.prudent);
  const downTimes = arrivalMinutes(back, downMin.prudent);
  const moments = [
    ...track.map(([, , d, ele], i) => ({ at: addMinutes(startAt, upTimes[i]), ele, d, leg: 'up' as const })),
    // chi dorme alla meta oggi non scende: il meteo e il profilo guardano solo la salita
    ...(overnight
      ? []
      : back.map(([, , d, ele], i) => ({ at: addMinutes(summitAt.prudent, stopMin + downTimes[i]), ele, d, leg: 'down' as const }))),
  ];
  const tomorrow = new Date(`${date}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  return {
    overnight,
    startAt,
    timeSource,
    upMin,
    downMin,
    stopMin,
    summitAt,
    backAt,
    endAt,
    light,
    deadline,
    shade: horizon ? { at: shadeAt(light, where[0], where[1], overnight ? horizon.end : horizon.start) } : null,
    nextDay: overnight ? { light: daylight(tomorrow.toISOString().slice(0, 10), trail.end[0], trail.end[1]), downMin } : null,
    latestStart,
    lightStatus,
    startsInDark: startAt < light.dawn,
    moments,
  };
}

/** Il sole va dietro le montagne almeno 10 minuti prima del tramonto: vale la pena dirlo. */
export const shadeEarly = (plan: Plan) =>
  plan.shade !== null && (plan.shade.at === null || plan.light.sunset.getTime() - plan.shade.at.getTime() >= 10 * 60_000);

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

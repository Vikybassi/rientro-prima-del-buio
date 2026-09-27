import type { Stop, TrailPoint } from '../data/types.ts';
import { addMinutes } from './clock.ts';
import type { Plan } from './plan.ts';
import { arrivalMinutes, reverseTrack } from './time.ts';

/**
 * Le tappe lungo il giro, con gli orari:
 * - quando ci arrivi (col tuo passo, e se ci metti di più);
 * - andata e ritorno: entro che ora devi esserci per tornare alla macchina con margine di luce ("torna indietro
 *   entro"), cioè il margine di luce meno il tempo che ti serve da lì alla macchina se ci metti di più;
 * - se ci arrivi in tempo per tornare: sì / al limite / no.
 *
 * È il "punto di non ritorno" degli alpinisti, in una forma semplice: se alla tappa arrivi dopo quell'ora, da lì si
 * torna indietro.
 */
export type Reach = 'ok' | 'tight' | 'late';

export type StopTime = Stop & {
  at: { estimate: Date; prudent: Date };
  /** solo andata e ritorno: entro quando esserci per tornare alla macchina con margine */
  turnBackBy: Date | null;
  reach: Reach | null;
};

/** Il punto della traccia più vicino a una distanza dalla partenza. */
function indexAt(track: TrailPoint[], d: number): number {
  let best = 0;
  for (let i = 1; i < track.length; i++) if (Math.abs(track[i][2] - d) < Math.abs(track[best][2] - d)) best = i;
  return best;
}

export function stopTimes(plan: Plan, track: TrailPoint[], stops: Stop[]): StopTime[] {
  const upEstimate = arrivalMinutes(track, plan.upMin.estimate);
  const upPrudent = arrivalMinutes(track, plan.upMin.prudent);
  // al ritorno la traccia si percorre al contrario: il tempo dalla tappa alla macchina è quello che manca alla fine
  const downPrudent = arrivalMinutes(reverseTrack(track), plan.downMin.prudent);
  const last = track.length - 1;

  return stops.map((stop) => {
    const i = indexAt(track, stop.d);
    const at = { estimate: addMinutes(plan.startAt, upEstimate[i]), prudent: addMinutes(plan.startAt, upPrudent[i]) };
    if (plan.overnight) return { ...stop, at, turnBackBy: null, reach: null };
    const toCar = plan.downMin.prudent - downPrudent[last - i];
    const turnBackBy = addMinutes(plan.deadline, -toCar);
    const reach: Reach = at.prudent <= turnBackBy ? 'ok' : at.estimate <= turnBackBy ? 'tight' : 'late';
    return { ...stop, at, turnBackBy, reach };
  });
}

/**
 * Quando il giro intero non ci sta nella luce (andata e ritorno "al limite" o "col buio"): la tappa più lontana a
 * cui arrivi e da cui torni comunque con margine. È la proposta dell'app: "arriva fin lì, poi torna indietro".
 */
export function furthestSafe(plan: Plan, times: StopTime[]): StopTime | null {
  if (plan.overnight || plan.lightStatus === 'ok') return null;
  const safe = times.filter((s) => s.reach === 'ok');
  return safe.length ? safe[safe.length - 1] : null;
}

/** Entro quando arrivare alla meta (andata e ritorno): margine di luce meno la sosta in cima e la discesa. */
export function summitTurnBackBy(plan: Plan): Date | null {
  return plan.overnight ? null : addMinutes(plan.deadline, -(plan.stopMin + plan.downMin.prudent));
}

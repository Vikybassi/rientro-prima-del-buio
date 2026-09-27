import { getPosition, getTimes } from 'suncalc';
import { HORIZON_AZ0 } from '../data/types.ts';
import { localToInstant } from './clock.ts';

/**
 * Le ore di luce di una giornata in un punto.
 *
 * - `sunset`: il sole scende sotto l'orizzonte astronomico. In valle sparisce prima dietro le montagne,
 *   ma la luce resta: per camminare conta il cielo, non il sole diretto.
 * - `dusk`: fine del crepuscolo civile (sole 6° sotto l'orizzonte). Dopo, senza frontale il sentiero
 *   non si vede più: è il "buio" del nome dell'app.
 * - `dawn`: inizio del crepuscolo civile al mattino; partire prima vuol dire partire col buio.
 */
export type Daylight = { dawn: Date; sunrise: Date; sunset: Date; dusk: Date };

export function daylight(date: string, lat: number, lon: number): Daylight {
  // suncalc usa il giorno solare dell'istante passato: mezzogiorno locale evita ambiguità vicino alla mezzanotte
  const t = getTimes(localToInstant(date, '12:00'), lat, lon);
  const { dawn, sunrise, sunset, dusk } = t;
  // alle nostre latitudini il sole sorge e tramonta sempre; il controllo serve solo a TypeScript (e a un eventuale uso altrove)
  if (!dawn || !sunrise || !sunset || !dusk) throw new Error(`Nessun tramonto il ${date} a ${lat}, ${lon}`);
  return { dawn, sunrise, sunset, dusk };
}

/** Mezzo diametro del sole, in gradi: il sole "sparisce" quando va dietro la cresta anche il suo bordo di sopra. */
const SUN_RADIUS = 0.27;
const STEP_MS = 60_000;

/**
 * Quando il sole sparisce dietro le montagne, visto da un punto: l'ultimo minuto prima del tramonto astronomico in
 * cui il bordo del sole è ancora sopra le creste. `horizon` è l'altezza delle montagne direzione per direzione
 * (scripts/add-horizon.ts, decimi di grado da HORIZON_AZ0 in avanti).
 *
 * Restituisce il tramonto stesso se all'ultimo il sole si vede (una cima, una valle aperta verso ovest), e null se dal
 * primo pomeriggio il sole resta dietro le montagne.
 */
export function shadeAt(light: Daylight, lat: number, lon: number, horizon: number[]): Date | null {
  const ridge = (azimuth: number) => {
    const k = Math.round(azimuth - HORIZON_AZ0);
    return k < 0 || k >= horizon.length ? -90 : horizon[k] / 10;
  };
  // dal tramonto indietro, un minuto alla volta, fino a quando il sole è ancora a sud (primo pomeriggio)
  for (let ms = light.sunset.getTime(); ; ms -= STEP_MS) {
    const { azimuth, altitude } = getPosition(new Date(ms), lat, lon);
    if (azimuth < HORIZON_AZ0) return null;
    if (altitude + SUN_RADIUS > ridge(azimuth)) return new Date(ms);
  }
}

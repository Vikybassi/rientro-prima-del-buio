import { getTimes } from 'suncalc';
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

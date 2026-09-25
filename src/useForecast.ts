import { useEffect, useState } from 'react';
import type { TrailSummary } from './data/types.ts';
import { fetchForecast, forecastAvailability, type Forecast } from './engine/weather.ts';

export type ForecastState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; forecast: Forecast }
  | { status: 'error' }
  | { status: 'too-far' }
  | { status: 'past' };

/** Previsioni già scaricate in questa visita, per sentiero e giorno: cambiare l'ora di partenza non richiede nulla. */
const cache = new Map<string, Forecast | 'error'>();

/**
 * Le previsioni per il sentiero e il giorno scelti. Coprono tutta la giornata, quindi si scaricano una volta sola
 * per coppia (sentiero, giorno). Se la data è fuori dai 16 giorni di Open-Meteo non si chiede nemmeno.
 */
export function useForecast(trail: TrailSummary | null, date: string, today: string): ForecastState {
  const key = trail ? `${trail.id}|${date}` : null;
  const availability = forecastAvailability(date, today);
  // un contatore basta a far ridisegnare quando arriva una risposta: il dato vero sta nella cache
  const [, setReceived] = useState(0);

  useEffect(() => {
    if (!trail || !key || availability !== 'ok' || cache.has(key)) return;
    const controller = new AbortController();
    fetchForecast(trail, date, controller.signal)
      .then((f) => cache.set(key, f))
      .catch((err: Error) => {
        // se la richiesta è stata interrotta perché si è cambiato sentiero o giorno, non è un errore
        if (err.name !== 'AbortError') cache.set(key, 'error');
      })
      .finally(() => {
        if (!controller.signal.aborted) setReceived((n) => n + 1);
      });
    return () => controller.abort();
  }, [trail, key, date, availability]);

  if (!key) return { status: 'idle' };
  if (availability !== 'ok') return { status: availability };
  const cached = cache.get(key);
  if (cached === undefined) return { status: 'loading' };
  return cached === 'error' ? { status: 'error' } : { status: 'ok', forecast: cached };
}

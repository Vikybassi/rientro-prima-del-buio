import type { TrailSummary } from '../data/types.ts';

/**
 * Meteo lungo il giro: previsioni orarie di Open-Meteo in due punti, la partenza e la meta, ciascuno alla
 * propria quota. In ogni momento del giro usiamo il punto più vicino alla quota in cui ci si trova.
 */

/** Serie oraria in un punto; i tempi sono istanti in millisecondi. */
export type HourlySeries = {
  time: number[];
  temperature: number[];
  precipProbability: number[];
  weatherCode: number[];
  gusts: number[];
  freezingLevel: number[];
  cape: number[];
};

export type Forecast = { low: HourlySeries; lowEle: number; high: HourlySeries; highEle: number };

/** Un momento del giro: dove si è (quota) e quando. */
export type Moment = { at: Date; ele: number };

export type HazardKind = 'thunderstorm' | 'rain' | 'wind' | 'freezing';
export type Hazard = { kind: HazardKind; level: 'warning' | 'danger'; at: Date; value: number };

/**
 * Soglie. Sono scelte di progetto, non leggi della fisica: le teniamo qui tutte insieme per poterle discutere.
 * - Temporale in corso previsto (codici WMO 95, 96, 99): pericolo. In montagna è la prima causa di ritirata.
 * - Energia convettiva (CAPE) ≥ 800 J/kg con pioggia probabile ≥ 30%: condizioni da temporale, attenzione.
 *   I modelli prevedono male l'ora esatta dei temporali, quindi segnaliamo anche le condizioni che li favoriscono.
 * - Pioggia probabile ≥ 60%: attenzione (sentiero bagnato, visibilità).
 * - Raffiche ≥ 60 km/h: attenzione; ≥ 80 km/h: pericolo (su creste e passi si fatica a stare in piedi).
 * - Zero termico sotto la quota in cui si è: attenzione (possibile ghiaccio o neve sul sentiero).
 */
export const THRESHOLDS = {
  thunderstormCodes: [95, 96, 99],
  capeStorm: 800,
  capeStormPrecip: 30,
  rainProbability: 60,
  gustsWarning: 60,
  gustsDanger: 80,
} as const;

function hourIndex(series: HourlySeries, at: Date): number {
  // il valore orario più vicino all'istante
  let best = 0;
  for (let i = 1; i < series.time.length; i++) {
    if (Math.abs(series.time[i] - at.getTime()) < Math.abs(series.time[best] - at.getTime())) best = i;
  }
  return best;
}

/**
 * Pericoli meteo nei momenti del giro. Per ogni tipo restituisce solo il caso peggiore (e, a parità,
 * il primo in ordine di tempo): all'utente serve sapere "c'è rischio temporale dalle 14", non 30 righe uguali.
 */
export function assessWeather(forecast: Forecast, moments: Moment[]): Hazard[] {
  const found = new Map<HazardKind, Hazard>();
  const note = (h: Hazard) => {
    const prev = found.get(h.kind);
    if (!prev || (h.level === 'danger' && prev.level === 'warning')) found.set(h.kind, h);
  };

  for (const { at, ele } of moments) {
    const useHigh = Math.abs(ele - forecast.highEle) < Math.abs(ele - forecast.lowEle);
    const s = useHigh ? forecast.high : forecast.low;
    const i = hourIndex(s, at);

    if ((THRESHOLDS.thunderstormCodes as readonly number[]).includes(s.weatherCode[i])) {
      note({ kind: 'thunderstorm', level: 'danger', at, value: s.weatherCode[i] });
    } else if (s.cape[i] >= THRESHOLDS.capeStorm && s.precipProbability[i] >= THRESHOLDS.capeStormPrecip) {
      note({ kind: 'thunderstorm', level: 'warning', at, value: s.cape[i] });
    }
    if (s.precipProbability[i] >= THRESHOLDS.rainProbability) {
      note({ kind: 'rain', level: 'warning', at, value: s.precipProbability[i] });
    }
    if (s.gusts[i] >= THRESHOLDS.gustsWarning) {
      note({ kind: 'wind', level: s.gusts[i] >= THRESHOLDS.gustsDanger ? 'danger' : 'warning', at, value: s.gusts[i] });
    }
    if (s.freezingLevel[i] < ele) {
      note({ kind: 'freezing', level: 'warning', at, value: s.freezingLevel[i] });
    }
  }
  return [...found.values()].sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Open-Meteo dà previsioni orarie fino a 16 giorni: oltre (o nel passato) non ha senso chiederle. */
export const FORECAST_DAYS = 16;

type Values = (number | null)[];
type OpenMeteoLocation = {
  hourly: {
    time: number[];
    temperature_2m: Values;
    precipitation_probability: Values;
    weather_code: Values;
    wind_gusts_10m: Values;
    freezing_level_height: Values;
    cape: Values;
  };
};

/**
 * Open-Meteo mette `null` dove un valore manca. In JavaScript `null < 2000` è vero: uno zero termico mancante
 * diventerebbe una falsa allerta ghiaccio. Con NaN invece ogni confronto è falso, e il valore viene ignorato.
 */
const clean = (xs: Values): number[] => xs.map((x) => x ?? Number.NaN);

const HOURLY = 'temperature_2m,precipitation_probability,weather_code,wind_gusts_10m,freezing_level_height,cape';

/** Scarica le previsioni per il giorno del giro (data locale "AAAA-MM-GG"). */
export async function fetchForecast(trail: TrailSummary, date: string, signal?: AbortSignal): Promise<Forecast> {
  const params = new URLSearchParams({
    latitude: `${trail.start[0]},${trail.end[0]}`,
    longitude: `${trail.start[1]},${trail.end[1]}`,
    // la quota corregge la temperatura rispetto a quella media della cella del modello
    elevation: `${trail.startEle},${trail.endEle}`,
    hourly: HOURLY,
    timezone: 'Europe/Rome',
    start_date: date,
    end_date: date,
    timeformat: 'unixtime',
    wind_speed_unit: 'kmh',
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal });
  if (!res.ok) throw new Error(`Previsioni non disponibili (${res.status})`);
  const [low, high] = (await res.json()) as [OpenMeteoLocation, OpenMeteoLocation];
  const toSeries = ({ hourly: h }: OpenMeteoLocation): HourlySeries => ({
    time: h.time.map((s) => s * 1000),
    temperature: clean(h.temperature_2m),
    precipProbability: clean(h.precipitation_probability),
    weatherCode: clean(h.weather_code),
    gusts: clean(h.wind_gusts_10m),
    freezingLevel: clean(h.freezing_level_height),
    cape: clean(h.cape),
  });
  return { low: toSeries(low), lowEle: trail.startEle, high: toSeries(high), highEle: trail.endEle };
}

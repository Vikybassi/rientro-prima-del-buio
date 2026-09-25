import { localTime, localToInstant, TIME_ZONE } from './engine/clock.ts';
import { LOCALE, type Lang } from './i18n.ts';

const STEP_MIN = 5;
const STEP_MS = STEP_MIN * 60_000;

/**
 * Orario locale arrotondato ai 5 minuti. "13:16" darebbe un'idea di precisione che una stima non ha.
 * Il verso conta per la sicurezza: l'ultima partenza utile si arrotonda per difetto e il rientro più tardo
 * per eccesso, così l'arrotondamento non toglie mai margine.
 */
export function clock(instant: Date, round: 'nearest' | 'down' | 'up' = 'nearest'): string {
  const f = { nearest: Math.round, down: Math.floor, up: Math.ceil }[round];
  return localTime(new Date(f(instant.getTime() / STEP_MS) * STEP_MS));
}

/** Durata come sui cartelli, arrotondata ai 5 minuti: "2h50", "45 min". */
export function duration(minutes: number, round: 'nearest' | 'up' = 'nearest'): string {
  const m = (round === 'up' ? Math.ceil : Math.round)(minutes / STEP_MIN) * STEP_MIN;
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
}

/** "sab 3 ottobre" / "Sat 3 October" per una data locale "AAAA-MM-GG". */
export function dayLabel(date: string, lang: Lang): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { timeZone: TIME_ZONE, weekday: 'short', day: 'numeric', month: 'long' }).format(
    localToInstant(date, '12:00'),
  );
}

export const km = (meters: number, lang: Lang) =>
  `${new Intl.NumberFormat(LOCALE[lang], { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(meters / 1000)} km`;

import { addMinutes, localDate, localTime } from './engine/clock.ts';
import type { Pace } from './engine/time.ts';
import type { Lang } from './i18n.ts';

/**
 * Lo stato della pagina vive nell'indirizzo (?t=7328079&d=2026-10-03&h=08:00&p=average&s=30&lang=it):
 * copiando il link, chi lo apre vede lo stesso piano. Tutto quello che arriva dal link viene controllato,
 * perché può essere vecchio o modificato a mano: un valore non valido torna al suo default.
 */
export type Params = {
  /** id del giro scelto (TrailSummary.id), o null se si sta ancora scegliendo */
  trail: string | null;
  date: string;
  start: string;
  pace: Pace;
  stop: number;
  lang: Lang;
};

export const PACES: readonly Pace[] = ['slow', 'average', 'fast'];
export const STOPS: readonly number[] = [0, 15, 30, 60, 90];

/** Default: oggi se è mattina, altrimenti domani; partenza alle 8, passo da cartello, mezz'ora in cima. */
export function defaults(now: Date, browserLang: string): Params {
  const morning = localTime(now) < '12:00';
  return {
    trail: null,
    date: localDate(morning ? now : addMinutes(now, 24 * 60)),
    start: '08:00',
    pace: 'average',
    stop: 30,
    lang: browserLang.toLowerCase().startsWith('it') ? 'it' : 'en',
  };
}

const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function readParams(search: string, fallback: Params, knownTrails: ReadonlySet<string>): Params {
  const q = new URLSearchParams(search);
  const t = q.get('t') ?? '';
  const d = q.get('d') ?? '';
  const h = q.get('h') ?? '';
  const p = q.get('p') as Pace | null;
  const s = Number(q.get('s'));
  const lang = q.get('lang');
  return {
    trail: knownTrails.has(t) ? t : fallback.trail,
    date: DATE.test(d) ? d : fallback.date,
    start: TIME.test(h) ? h : fallback.start,
    pace: p && PACES.includes(p) ? p : fallback.pace,
    stop: q.has('s') && STOPS.includes(s) ? s : fallback.stop,
    lang: lang === 'it' || lang === 'en' ? lang : fallback.lang,
  };
}

export function writeParams(p: Params): string {
  const q = new URLSearchParams();
  if (p.trail !== null) q.set('t', p.trail);
  q.set('d', p.date);
  q.set('h', p.start);
  q.set('p', p.pace);
  q.set('s', String(p.stop));
  q.set('lang', p.lang);
  // i due punti dell'orario sono ammessi negli indirizzi: "h=08:00" si legge meglio di "h=08%3A00"
  return `?${q}`.replaceAll('%3A', ':');
}

/**
 * Ore locali della Valtellina (fuso Europe/Rome, con ora legale) ↔ istanti assoluti.
 *
 * L'utente pensa in ora locale ("parto sabato alle 8"), mentre tramonto, previsioni e somme di minuti lavorano
 * su istanti assoluti. Usiamo le API di fuso orario del browser (Intl), niente librerie.
 */
export const TIME_ZONE = 'Europe/Rome';

const partsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** Scarto in minuti tra l'ora di Roma e UTC in quell'istante (+60 d'inverno, +120 d'estate). */
function offsetMinutes(utcMs: number): number {
  const p = Object.fromEntries(partsFormatter.formatToParts(utcMs).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60_000);
}

/**
 * Istante corrispondente a una data ("2026-10-03") e un'ora ("08:00") locali.
 * Si parte trattando l'ora come se fosse UTC e si corregge con lo scarto; il secondo controllo serve vicino
 * al cambio dell'ora legale, quando lo scarto nel punto di partenza e in quello d'arrivo è diverso.
 */
export function localToInstant(date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  const first = naive - offsetMinutes(naive) * 60_000;
  return new Date(naive - offsetMinutes(first) * 60_000);
}

/** Ora locale "HH:MM" di un istante. */
export function localTime(instant: Date): string {
  return new Intl.DateTimeFormat('it-IT', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(instant);
}

/** Data locale "AAAA-MM-GG" di un istante. */
export function localDate(instant: Date): string {
  const p = Object.fromEntries(partsFormatter.formatToParts(instant).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

export const addMinutes = (instant: Date, minutes: number) => new Date(instant.getTime() + minutes * 60_000);
export const minutesBetween = (from: Date, to: Date) => (to.getTime() - from.getTime()) / 60_000;

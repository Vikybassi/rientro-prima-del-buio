import { describe, expect, it } from 'vitest';
import { localToInstant } from './engine/clock.ts';
import { defaults, readParams, writeParams, type Params } from './state.ts';

const known = new Set(['7328079']);
const fallback = defaults(localToInstant('2026-10-02', '09:00'), 'it-IT');

describe('defaults', () => {
  it('di mattina propone oggi, dal pomeriggio domani', () => {
    expect(defaults(localToInstant('2026-10-02', '09:00'), 'it').date).toBe('2026-10-02');
    expect(defaults(localToInstant('2026-10-02', '15:00'), 'it').date).toBe('2026-10-03');
  });
  it('sceglie la lingua dal browser: italiano solo per chi ha il browser in italiano', () => {
    expect(defaults(new Date(), 'it-CH').lang).toBe('it');
    expect(defaults(new Date(), 'de-DE').lang).toBe('en');
  });
});

describe('link del piano', () => {
  const plan: Params = { trail: '7328079', date: '2026-10-03', start: '07:30', pace: 'slow', stop: 60, overnight: false, lang: 'en' };

  it('scrivere e rileggere il link dà lo stesso piano', () => {
    expect(readParams(writeParams(plan, fallback), fallback, known)).toEqual(plan);
  });

  it('senza un giro scelto l\'indirizzo resta pulito', () => {
    expect(writeParams({ ...fallback, date: '2026-10-05', start: '07:00' }, fallback)).toBe('');
  });

  it('con un giro: giorno e ora sempre, passo, sosta e lingua solo se cambiati', () => {
    const usual = { ...fallback, trail: '7328079', date: '2026-10-03', start: '08:00' };
    expect(writeParams(usual, fallback)).toBe('?t=7328079&d=2026-10-03&h=08:00');
    expect(writeParams(plan, fallback)).toBe('?t=7328079&d=2026-10-03&h=07:30&p=slow&s=60&lang=en');
  });

  it('un link corto si rilegge con i valori di chi lo apre', () => {
    const read = readParams('?t=7328079&d=2026-10-03&h=08:00', fallback, known);
    expect(read).toEqual({ ...fallback, trail: '7328079', date: '2026-10-03', start: '08:00' });
  });

  it('i valori non validi tornano ai default, uno per uno', () => {
    const read = readParams('?t=123&d=2026-13-40&h=25:00&p=sprint&s=45&lang=fr', fallback, known);
    expect(read).toEqual(fallback);
  });

  it('un link senza parametri dà i default', () => {
    expect(readParams('', fallback, known)).toEqual(fallback);
  });

  it('il pernotto va nel link solo se scelto', () => {
    const stay = { ...plan, overnight: true };
    expect(writeParams(stay, fallback)).toContain('&n=1');
    expect(readParams(writeParams(stay, fallback), fallback, known)).toEqual(stay);
  });

  it('accetta una sosta di zero minuti (e non la confonde con un valore mancante)', () => {
    expect(readParams('?s=0', fallback, known).stop).toBe(0);
  });
});

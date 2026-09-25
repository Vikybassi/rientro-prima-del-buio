import { describe, expect, it } from 'vitest';
import { localDate, localTime, localToInstant } from './clock.ts';

describe('localToInstant (ora di Roma → istante)', () => {
  it("d'estate l'Italia è a UTC+2", () => {
    expect(localToInstant('2026-07-15', '08:00').toISOString()).toBe('2026-07-15T06:00:00.000Z');
  });
  it("d'inverno l'Italia è a UTC+1", () => {
    expect(localToInstant('2026-12-15', '08:00').toISOString()).toBe('2026-12-15T07:00:00.000Z');
  });
  it("il giorno in cui scatta l'ora legale (29 marzo 2026) le 8 sono già ora estiva", () => {
    expect(localToInstant('2026-03-29', '08:00').toISOString()).toBe('2026-03-29T06:00:00.000Z');
  });
  it("il giorno in cui torna l'ora solare (25 ottobre 2026) le 8 sono già ora invernale", () => {
    expect(localToInstant('2026-10-25', '08:00').toISOString()).toBe('2026-10-25T07:00:00.000Z');
  });
});

describe('localTime e localDate', () => {
  it("tornano all'ora e alla data locali di partenza", () => {
    const instant = localToInstant('2026-08-02', '17:45');
    expect(localTime(instant)).toBe('17:45');
    expect(localDate(instant)).toBe('2026-08-02');
  });
  it('funzionano anche quando in UTC è già il giorno prima', () => {
    // le 00:30 del 2 agosto a Roma sono le 22:30 del 1° agosto in UTC
    const instant = localToInstant('2026-08-02', '00:30');
    expect(instant.toISOString()).toBe('2026-08-01T22:30:00.000Z');
    expect(localDate(instant)).toBe('2026-08-02');
  });
});

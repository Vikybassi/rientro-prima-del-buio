import { describe, expect, it } from 'vitest';
import { localToInstant } from './engine/clock.ts';
import { clock, duration } from './format.ts';

const at = (hhmm: string) => localToInstant('2026-10-03', hhmm);

describe('clock', () => {
  it('arrotonda ai 5 minuti più vicini', () => {
    expect(clock(at('13:16'))).toBe('13:15');
    expect(clock(at('13:18'))).toBe('13:20');
  });
  it("l'ultima partenza si arrotonda per difetto: mai più tardi del calcolo", () => {
    expect(clock(at('11:59'), 'down')).toBe('11:55');
  });
  it('il rientro più tardo si arrotonda per eccesso: mai più presto del calcolo', () => {
    expect(clock(at('14:26'), 'up')).toBe('14:30');
  });
  it('un orario già tondo resta uguale in tutti i versi', () => {
    for (const r of ['nearest', 'down', 'up'] as const) expect(clock(at('10:50'), r)).toBe('10:50');
  });
});

describe('duration', () => {
  it('scrive le durate come sui cartelli', () => {
    expect(duration(170)).toBe('2h50');
    expect(duration(44)).toBe('45 min');
    expect(duration(62)).toBe('1h00');
  });
  it('per eccesso quando serve prudenza', () => {
    expect(duration(61, 'up')).toBe('1h05');
  });
});

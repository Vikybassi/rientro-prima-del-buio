import { describe, expect, it } from 'vitest';
import type { TrailPoint } from '../data/types.ts';
import { arrivalMinutes, dinHours, legRange, officialRatio, PRUDENT_OVER_ESTIMATE, reverseTrack } from './time.ts';

describe('dinHours (formula DIN 33466)', () => {
  it('in piano conta solo la distanza, a 4 km/h', () => {
    expect(dinHours(4, 0, 0)).toBe(1);
  });
  it('in verticale 300 m/h in salita e 500 m/h in discesa', () => {
    expect(dinHours(0, 300, 0)).toBe(1);
    expect(dinHours(0, 0, 500)).toBe(1);
  });
  it('somma il maggiore dei due tempi e metà del minore', () => {
    // 6 km → 1,5 h in orizzontale; 600 m → 2 h in verticale; totale 2 + 1,5/2
    expect(dinHours(6, 600, 0)).toBe(2.75);
  });
});

describe('officialRatio', () => {
  it('dice quanto il cartello è più veloce della formula', () => {
    expect(officialRatio(150, 200)).toBe(0.75);
  });
  it('senza tempo ufficiale non dice niente', () => {
    expect(officialRatio(null, 200)).toBeNull();
  });
  it('ignora i tempi implausibili (probabili errori di battitura nel tag)', () => {
    expect(officialRatio(20, 200)).toBeNull(); // "0:20" invece di "2:20"
    expect(officialRatio(400, 200)).toBeNull();
  });
});

describe('legRange', () => {
  it('la stima è formula × rapporto × passo', () => {
    expect(legRange(200, 0.9, 'average').estimate).toBeCloseTo(180);
    expect(legRange(200, 0.9, 'slow').estimate).toBeCloseTo(225);
  });
  it('il caso prudente allunga la stima come il 90° percentile rispetto alla mediana dei cartelli', () => {
    const r = legRange(200, 0.9, 'average');
    expect(r.prudent / r.estimate).toBeCloseTo(PRUDENT_OVER_ESTIMATE);
    expect(PRUDENT_OVER_ESTIMATE).toBeCloseTo(1.26, 2);
  });
  it('chi è più lento dei cartelli ci mette di più', () => {
    const t = (pace: 'slow' | 'average' | 'fast') => legRange(200, 0.9, pace).estimate;
    expect(t('slow')).toBeGreaterThan(t('average'));
    expect(t('average')).toBeGreaterThan(t('fast'));
  });
});

// 1 km in piano, poi 1 km che sale di 300 m (punti ogni 500 m)
const track: TrailPoint[] = [
  [46, 9, 0, 1000],
  [46, 9, 500, 1000],
  [46, 9, 1000, 1000],
  [46, 9, 1500, 1150],
  [46, 9, 2000, 1300],
];

describe('arrivalMinutes', () => {
  const times = arrivalMinutes(track, 120);

  it('parte da zero e arriva esattamente al totale', () => {
    expect(times[0]).toBe(0);
    expect(times.at(-1)).toBeCloseTo(120);
  });
  it('il tempo non torna mai indietro', () => {
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]);
  });
  it('il tratto in salita costa più minuti di quello in piano, a parità di lunghezza', () => {
    const flat = times[2] - times[0];
    const steep = times[4] - times[2];
    expect(steep).toBeGreaterThan(flat);
  });
});

describe('reverseTrack', () => {
  const back = reverseTrack(track);
  it('riparte da distanza zero e finisce alla lunghezza totale', () => {
    expect(back[0][2]).toBe(0);
    expect(back.at(-1)![2]).toBe(2000);
  });
  it('percorre le quote al contrario', () => {
    expect(back.map((p) => p[3])).toEqual([1300, 1150, 1000, 1000, 1000]);
  });
});

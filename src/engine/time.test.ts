import { describe, expect, it } from 'vitest';
import type { TrailPoint } from '../data/types.ts';
import { arrivalMinutes, dinHours, legMinutes, officialRatio, PRUDENT_EXTRA, reverseTrack, withMargin } from './time.ts';

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

describe('legMinutes', () => {
  it('la stima è formula × rapporto × passo', () => {
    expect(legMinutes(200, 0.9, 'average')).toBeCloseTo(180);
    expect(legMinutes(200, 0.9, 'slow')).toBeCloseTo(225);
  });
  it('chi è più lento dei cartelli ci mette di più', () => {
    const t = (pace: 'slow' | 'average' | 'fast') => legMinutes(200, 0.9, pace);
    expect(t('slow')).toBeGreaterThan(t('average'));
    expect(t('average')).toBeGreaterThan(t('fast'));
  });
});

describe('withMargin: il caso "se ci metti di più"', () => {
  const extra = (up: number, down: number) => {
    const r = withMargin(up, down);
    return r.upMin.prudent + r.downMin.prudent - up - down;
  };
  it('su un giro breve è il 15%', () => {
    expect(extra(120, 60)).toBeCloseTo(180 * PRUDENT_EXTRA.share);
  });
  it('su un giro lungo si ferma a un\'ora in tutto', () => {
    expect(extra(330, 225)).toBeCloseTo(PRUDENT_EXTRA.maxMin);
  });
  it('si divide tra salita e ritorno in proporzione', () => {
    const r = withMargin(300, 150);
    expect(r.upMin.prudent / r.upMin.estimate).toBeCloseTo(r.downMin.prudent / r.downMin.estimate);
  });
  it('la stima resta quella', () => {
    expect(withMargin(100, 80).upMin.estimate).toBe(100);
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

import { describe, expect, it } from 'vitest';
import { lineLength, simplify, type LatLon } from './geo.ts';

// una linea dritta verso nord, un punto ogni ~11 m (0,0001° di latitudine)
const straight: LatLon[] = Array.from({ length: 50 }, (_, i) => [46 + i * 0.0001, 9.8]);

describe('simplify', () => {
  it('di una linea dritta tiene solo gli estremi', () => {
    expect(simplify(straight, 5)).toEqual([straight[0], straight[49]]);
  });

  it('tiene un angolo netto', () => {
    const corner: LatLon[] = [...straight, ...Array.from({ length: 50 }, (_, i): LatLon => [46.0049, 9.8 + (i + 1) * 0.0001])];
    const s = simplify(corner, 5);
    expect(s).toHaveLength(3);
    expect(s[1]).toEqual(straight[49]);
  });

  it('ignora le deviazioni più piccole della tolleranza', () => {
    // zig-zag di circa 2 m: con tolleranza 5 m sparisce
    const wobbly = straight.map(([lat, lon], i): LatLon => [lat, lon + (i % 2 ? 0.00003 : 0)]);
    expect(simplify(wobbly, 5)).toHaveLength(2);
  });

  it('la lunghezza cambia poco anche su una traccia vera piena di curve', () => {
    const curvy: LatLon[] = Array.from({ length: 200 }, (_, i) => [46 + i * 0.00005, 9.8 + Math.sin(i / 8) * 0.001]);
    const s = simplify(curvy, 25);
    expect(s.length).toBeLessThan(curvy.length / 3);
    expect(Math.abs(lineLength(s) - lineLength(curvy)) / lineLength(curvy)).toBeLessThan(0.05);
  });
});

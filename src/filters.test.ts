import { describe, expect, it } from 'vitest';
import trails from './data/trails.json';
import type { TrailSummary } from './data/types.ts';
import { filterTrails, NO_FILTERS } from './filters.ts';

const all = trails as TrailSummary[];

describe('filterTrails', () => {
  it('senza filtri mostra tutti i giri', () => {
    expect(filterTrails(all, NO_FILTERS)).toHaveLength(all.length);
  });
  it('la ricerca ignora accenti e maiuscole', () => {
    const found = filterTrails(all, { ...NO_FILTERS, query: 'rifugio palu' });
    expect(found.some((t) => t.to === 'Rifugio Palù')).toBe(true);
  });
  it('trova anche per numero di sentiero', () => {
    expect(filterTrails(all, { ...NO_FILTERS, query: '331' }).some((t) => t.osm === 7328079)).toBe(true);
  });
  it('i filtri si sommano', () => {
    const huts = filterTrails(all, { ...NO_FILTERS, zone: 'valmalenco', destination: 'hut' });
    expect(huts.length).toBeGreaterThan(0);
    expect(huts.every((t) => t.zone === 'valmalenco' && t.destination === 'hut')).toBe(true);
  });
});

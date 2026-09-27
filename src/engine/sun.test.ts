import { describe, expect, it } from 'vitest';
import { localTime, minutesBetween } from './clock.ts';
import { daylight, shadeAt } from './sun.ts';

// Valmalenco, più o meno a San Giuseppe
const LAT = 46.3;
const LON = 9.78;

// Controlli di buon senso, non valori al minuto: il calcolo astronomico lo fa suncalc.
// Qui verifichiamo di usarlo bene (giorno giusto, fuso orario giusto, crepuscolo dopo il tramonto).
describe('daylight', () => {
  it("al solstizio d'estate il sole tramonta verso le 21:15 (ora legale)", () => {
    const { sunset } = daylight('2026-06-21', LAT, LON);
    expect(localTime(sunset) >= '20:50' && localTime(sunset) <= '21:40').toBe(true);
  });
  it("al solstizio d'inverno il sole tramonta verso le 16:45", () => {
    const { sunset } = daylight('2026-12-21', LAT, LON);
    expect(localTime(sunset) >= '16:20' && localTime(sunset) <= '17:05').toBe(true);
  });
  it('gli orari sono nell\'ordine giusto: alba civile, alba, tramonto, fine crepuscolo', () => {
    const d = daylight('2026-10-03', LAT, LON);
    expect(d.dawn < d.sunrise && d.sunrise < d.sunset && d.sunset < d.dusk).toBe(true);
  });
  it('il crepuscolo civile dura circa mezz\'ora a queste latitudini', () => {
    for (const date of ['2026-03-21', '2026-06-21', '2026-10-03', '2026-12-21']) {
      const d = daylight(date, LAT, LON);
      const minutes = minutesBetween(d.sunset, d.dusk);
      expect(minutes).toBeGreaterThan(25);
      expect(minutes).toBeLessThan(50);
    }
  });
});

describe('shadeAt: il sole dietro le montagne', () => {
  const light = daylight('2026-10-03', LAT, LON);
  const flat = (deg: number) => Array.from({ length: 141 }, () => deg * 10);

  it("senza montagne il sole si vede fino al tramonto (entro un paio di minuti: il tramonto è col bordo, qui c'è il bordo)", () => {
    const at = shadeAt(light, LAT, LON, flat(-1));
    expect(Math.abs(minutesBetween(at!, light.sunset))).toBeLessThanOrEqual(2);
  });
  it('più alte le creste, prima si va in ombra', () => {
    const low = shadeAt(light, LAT, LON, flat(5))!;
    const high = shadeAt(light, LAT, LON, flat(20))!;
    expect(high < low && low < light.sunset).toBe(true);
  });
  it('conta la cresta nella direzione del sole: a ovest una valle aperta, a sud-ovest un muro', () => {
    // muro di 30° fino a 250° (sud-ovest), poi aperto: a ottobre il sole tramonta verso 260°
    const horizon = Array.from({ length: 141 }, (_, k) => (180 + k < 250 ? 300 : -10));
    const at = shadeAt(light, LAT, LON, horizon)!;
    expect(minutesBetween(at, light.sunset)).toBeLessThan(5);
  });
  it('dietro una parete altissima il sole non si vede da mezzogiorno: null', () => {
    expect(shadeAt(light, LAT, LON, flat(80))).toBeNull();
  });
});

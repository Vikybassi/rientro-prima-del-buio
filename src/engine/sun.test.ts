import { describe, expect, it } from 'vitest';
import { localTime, minutesBetween } from './clock.ts';
import { daylight } from './sun.ts';

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

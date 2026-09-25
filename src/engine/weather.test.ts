import { describe, expect, it } from 'vitest';
import { localToInstant } from './clock.ts';
import { assessWeather, type Forecast, type HourlySeries } from './weather.ts';

const DATE = '2026-08-01';

/** Una giornata tranquilla: 24 ore di bel tempo, con eventuali ore modificate. */
function day(changes: Record<number, Partial<Record<Exclude<keyof HourlySeries, 'time'>, number>>> = {}): HourlySeries {
  const hours = Array.from({ length: 24 }, (_, h) => h);
  const value = (key: Exclude<keyof HourlySeries, 'time'>, calm: number) => hours.map((h) => changes[h]?.[key] ?? calm);
  return {
    time: hours.map((h) => localToInstant(DATE, `${String(h).padStart(2, '0')}:00`).getTime()),
    temperature: value('temperature', 15),
    precipProbability: value('precipProbability', 5),
    weatherCode: value('weatherCode', 1),
    gusts: value('gusts', 20),
    freezingLevel: value('freezingLevel', 4000),
    cape: value('cape', 50),
  };
}

const forecast = (low: HourlySeries, high: HourlySeries): Forecast => ({ low, lowEle: 1400, high, highEle: 2400 });
const at = (time: string, ele: number) => ({ at: localToInstant(DATE, time), ele });

describe('assessWeather', () => {
  it('con bel tempo non segnala niente', () => {
    expect(assessWeather(forecast(day(), day()), [at('08:00', 1400), at('11:00', 2400)])).toEqual([]);
  });

  it("un temporale previsto in quota all'ora in cui si è in quota è un pericolo", () => {
    const f = forecast(day(), day({ 11: { weatherCode: 95 } }));
    expect(assessWeather(f, [at('11:00', 2400)])).toMatchObject([{ kind: 'thunderstorm', level: 'danger' }]);
  });

  it('lo stesso temporale non conta se a quell\'ora si è già a valle', () => {
    const f = forecast(day(), day({ 16: { weatherCode: 95 } }));
    expect(assessWeather(f, [at('11:00', 2400), at('16:00', 1400)])).toEqual([]);
  });

  it('segnala le condizioni da temporale (energia convettiva alta e pioggia possibile)', () => {
    const f = forecast(day(), day({ 13: { cape: 1200, precipProbability: 40 } }));
    expect(assessWeather(f, [at('13:00', 2300)])).toMatchObject([{ kind: 'thunderstorm', level: 'warning' }]);
  });

  it('per il vento tiene solo il caso peggiore', () => {
    const f = forecast(day(), day({ 10: { gusts: 65 }, 11: { gusts: 85 } }));
    const hazards = assessWeather(f, [at('10:00', 2400), at('11:00', 2400)]);
    expect(hazards).toHaveLength(1);
    expect(hazards[0]).toMatchObject({ kind: 'wind', level: 'danger', value: 85 });
  });

  it('segnala lo zero termico sotto la quota in cui si cammina', () => {
    const f = forecast(day(), day({ 12: { freezingLevel: 2200 } }));
    expect(assessWeather(f, [at('12:00', 2400)])).toMatchObject([{ kind: 'freezing', level: 'warning' }]);
  });

  it('un valore mancante (NaN) non fa scattare falsi allarmi', () => {
    const f = forecast(day(), day({ 12: { freezingLevel: Number.NaN, precipProbability: Number.NaN } }));
    expect(assessWeather(f, [at('12:00', 2400)])).toEqual([]);
  });
});

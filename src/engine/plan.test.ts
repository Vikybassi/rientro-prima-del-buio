import { describe, expect, it } from 'vitest';
import trackMotta from '../../public/trails/19532067.json';
import track331 from '../../public/trails/7328079.json';
import trails from '../data/trails.json';
import type { TrailSummary, TrailTrack } from '../data/types.ts';
import { addMinutes, localTime, minutesBetween } from './clock.ts';
import { LIGHT_MARGIN_MIN, makePlan, verdict, type PlanInput } from './plan.ts';
import type { Hazard } from './weather.ts';

// 331: San Giuseppe → Rifugio Longoni, un sabato di inizio ottobre
const trail = (trails as TrailSummary[]).find((t) => t.osm === 7328079)!;
const base: PlanInput = {
  trail,
  track: (track331 as TrailTrack).points,
  date: '2026-10-03',
  start: '08:00',
  pace: 'average',
  stopMin: 30,
};

describe('makePlan: il 331 a inizio ottobre', () => {
  it('partendo alle 8 si rientra con ampio margine', () => {
    const plan = makePlan(base);
    expect(plan.lightStatus).toBe('ok');
    expect(verdict(plan, [])).toBe('go');
  });

  it('partendo alle 15 si rientra col buio', () => {
    const plan = makePlan({ ...base, start: '15:00' });
    expect(plan.lightStatus).toBe('dark');
    expect(verdict(plan, [])).toBe('no-go');
  });

  it("l'ora di partenza più tarda è proprio il confine: un minuto dopo non si ha più il margine", () => {
    const { latestStart } = makePlan(base);
    // latestStart può cadere a metà minuto: l'orario "HH:MM" arrotondato per difetto è ancora in tempo
    const last = localTime(latestStart);
    expect(makePlan({ ...base, start: last }).lightStatus).toBe('ok');
    expect(makePlan({ ...base, start: localTime(addMinutes(latestStart, 1)) }).lightStatus).not.toBe('ok');
  });

  it('il rientro prudente cade esattamente al tramonto meno il margine, partendo all\'ora più tarda', () => {
    const plan = makePlan(base);
    const planned = makePlan({ ...base, start: localTime(plan.latestStart) });
    const margin = minutesBetween(planned.backAt.prudent, planned.light.sunset);
    expect(margin).toBeGreaterThanOrEqual(LIGHT_MARGIN_MIN);
    expect(margin).toBeLessThan(LIGHT_MARGIN_MIN + 1);
  });

  it('chi va più piano deve partire prima', () => {
    const slow = makePlan({ ...base, pace: 'slow' }).latestStart;
    const fast = makePlan({ ...base, pace: 'fast' }).latestStart;
    expect(slow < fast).toBe(true);
  });

  it('se c\'è il cartello CAI la stima di salita è proprio il suo tempo (331: 2h50)', () => {
    const plan = makePlan(base);
    expect(plan.timeSource).toBe('cai');
    expect(plan.upMin.estimate).toBeCloseTo(170);
  });

  it('senza cartello CAI si usa la formula col valore tipico', () => {
    // N581 Fraciscio → Alpe Motta: su OSM non ha tempi ufficiali
    const motta = (trails as TrailSummary[]).find((t) => t.osm === 19532067)!;
    expect(motta.caiUpMin).toBeNull();
    const plan = makePlan({ ...base, trail: motta, track: (trackMotta as TrailTrack).points });
    expect(plan.timeSource).toBe('formula');
  });

  it('il ritorno è più veloce della salita (sul 331 si scende quasi sempre)', () => {
    const plan = makePlan(base);
    expect(plan.downMin.estimate).toBeLessThan(plan.upMin.estimate);
  });

  it('partire prima dell\'alba civile è un avviso anche se si rientra in tempo', () => {
    const plan = makePlan({ ...base, start: '05:00' });
    expect(plan.startsInDark).toBe(true);
    expect(verdict(plan, [])).toBe('caution');
  });
});

describe('makePlan: i momenti del giro (per il profilo e il meteo)', () => {
  const plan = makePlan(base);
  const { moments } = plan;

  it('iniziano alla partenza e finiscono al rientro prudente', () => {
    expect(moments[0].at.getTime()).toBe(plan.startAt.getTime());
    expect(Math.abs(minutesBetween(moments.at(-1)!.at, plan.backAt.prudent))).toBeLessThan(0.01);
  });
  it('il tempo non torna mai indietro, sosta compresa', () => {
    for (let i = 1; i < moments.length; i++) expect(moments[i].at >= moments[i - 1].at).toBe(true);
  });
  it('alla meta si è alla quota della meta', () => {
    const lastUp = moments.filter((m) => m.leg === 'up').at(-1)!;
    expect(lastUp.ele).toBe(trail.endEle);
  });
});

describe('verdict: luce e meteo insieme', () => {
  const plan = makePlan(base);
  const hazard = (level: Hazard['level']): Hazard => ({ kind: 'wind', level, at: plan.startAt, value: 0 });

  it('un avviso meteo abbassa "vai" ad "attenzione"', () => {
    expect(verdict(plan, [hazard('warning')])).toBe('caution');
  });
  it('un pericolo meteo vuol dire "no" anche con tutta la luce del mondo', () => {
    expect(verdict(plan, [hazard('danger')])).toBe('no-go');
  });
});

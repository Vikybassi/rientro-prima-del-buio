import { describe, expect, it } from 'vitest';
import track331 from '../../public/trails/7328079.json';
import trails from '../data/trails.json';
import type { Stop, TrailSummary, TrailTrack } from '../data/types.ts';
import { makePlan } from './plan.ts';
import { furthestSafe, stopTimes, summitTurnBackBy } from './stops.ts';

const trail = (trails as TrailSummary[]).find((t) => t.osm === 7328079)!;
const track = (track331 as unknown as TrailTrack).points;
const length = track[track.length - 1][2];
// due tappe di prova: a un quarto e a tre quarti della salita
const stops: Stop[] = [
  { name: 'Bassa', kind: 'alp', d: Math.round(length / 4), ele: 1600 },
  { name: 'Alta', kind: 'water', d: Math.round((3 * length) / 4), ele: 2200 },
];
const base = { trail, track, date: '2026-10-03', start: '08:00', pace: 'average' as const, stopMin: 30 };

describe('stopTimes: gli orari delle tappe', () => {
  const plan = makePlan(base);
  const [low, high] = stopTimes(plan, track, stops);

  it('si arriva prima alla tappa bassa, poi a quella alta, tutte e due prima della meta', () => {
    expect(low.at.estimate > plan.startAt).toBe(true);
    expect(high.at.estimate > low.at.estimate).toBe(true);
    expect(high.at.estimate < plan.summitAt.estimate).toBe(true);
    expect(low.at.prudent >= low.at.estimate).toBe(true);
  });

  it('più la tappa è vicina alla macchina, più tardi si può essere lì (e la meta è la più stretta di tutte)', () => {
    expect(low.turnBackBy! > high.turnBackBy!).toBe(true);
    expect(high.turnBackBy! > summitTurnBackBy(plan)!).toBe(true);
  });

  it('partendo alle 8 si arriva a tutte le tappe in tempo; niente proposta di tornare prima', () => {
    expect(low.reach).toBe('ok');
    expect(high.reach).toBe('ok');
    expect(furthestSafe(plan, [low, high])).toBeNull();
  });

  it('se il giro non ci sta nella luce, propone la tappa più lontana da cui si torna in tempo', () => {
    // alle 14:30 il giro intero rientra col buio: fin dove si arriva e si torna con la luce?
    const late = makePlan({ ...base, start: '14:30' });
    expect(late.lightStatus).not.toBe('ok');
    const times = stopTimes(late, track, stops);
    const safe = furthestSafe(late, times);
    if (safe) expect(safe.reach).toBe('ok');
    // la tappa proposta è sempre l'ultima raggiungibile in tempo
    const reachable = times.filter((s) => s.reach === 'ok');
    expect(safe?.name ?? null).toBe(reachable.at(-1)?.name ?? null);
  });

  it('col pernotto le tappe hanno solo gli orari di arrivo', () => {
    const stay = makePlan({ ...base, overnight: true });
    const times = stopTimes(stay, track, stops);
    expect(times.every((s) => s.turnBackBy === null && s.reach === null)).toBe(true);
    expect(furthestSafe(stay, times)).toBeNull();
  });
});

import type { TrailSummary } from '../data/types.ts';
import type { Plan } from '../engine/plan.ts';
import { summitTurnBackBy, type Reach, type StopTime } from '../engine/stops.ts';
import { clock, duration, stopName } from '../format.ts';
import type { Strings } from '../i18n.ts';

type Props = { plan: Plan; trail: TrailSummary; times: StopTime[]; t: Strings };

type Row = {
  key: string;
  at: string;
  name: string;
  meta: string;
  by?: { time: string; reach: Reach };
  end?: boolean;
};

/**
 * Le tappe lungo la salita, come una linea del tempo: a che ora ci arrivi e (andata e ritorno) entro che ora devi
 * esserci per tornare alla macchina con la luce anche se ci metti di più. Chi dorme alla meta vede solo gli arrivi.
 */
export function StopsTimeline({ plan, trail, times, t }: Props) {
  const reachAt = (by: Date, estimate: Date, prudent: Date): Reach => (prudent <= by ? 'ok' : estimate <= by ? 'tight' : 'late');
  const topBy = summitTurnBackBy(plan);

  const rows: Row[] = [
    { key: 'start', at: clock(plan.startAt), name: trail.from, meta: `${t.stops.start} · ${trail.startEle} m` },
    ...times.map((s, i) => ({
      key: `${i}-${s.d}`,
      at: clock(s.at.estimate),
      name: stopName(s, t),
      meta: s.name || !t.stops.unnamed[s.kind] ? `${t.stops.kinds[s.kind]} · ${s.ele} m` : `${s.ele} m`,
      by: s.turnBackBy && s.reach ? { time: clock(s.turnBackBy, 'down'), reach: s.reach } : undefined,
    })),
    {
      key: 'top',
      at: clock(plan.summitAt.estimate),
      name: trail.to,
      meta: [t.stops.top, `${trail.endEle} m`, !plan.overnight && plan.stopMin ? t.stops.breakAtTop(duration(plan.stopMin)) : null]
        .filter(Boolean)
        .join(' · '),
      by: topBy ? { time: clock(topBy, 'down'), reach: reachAt(topBy, plan.summitAt.estimate, plan.summitAt.prudent) } : undefined,
      end: plan.overnight,
    },
  ];
  if (!plan.overnight) rows.push({ key: 'car', at: clock(plan.backAt.estimate), name: t.stops.car, meta: trail.from, end: true });

  return (
    <section className="section">
      <h3 className="section-title">{t.stops.title}</h3>
      <p className="section-hint">{plan.overnight ? t.stops.stayHint : t.stops.hint}</p>
      <ol className="timeline">
        {rows.map((r) => (
          <li key={r.key} className="timeline-row" data-end={r.end || undefined}>
            <span className="timeline-at">{r.at}</span>
            <span className="timeline-dot" aria-hidden="true" />
            <span className="timeline-body">
              <span className="timeline-name">{r.name}</span>
              <span className="timeline-meta">{r.meta}</span>
            </span>
            {r.by && (
              <span className="timeline-by" data-reach={r.by.reach}>
                {(r.by.reach === 'late' ? t.stops.late : t.stops.by)(r.by.time)}
              </span>
            )}
          </li>
        ))}
      </ol>
      {times.length === 0 && <p className="note">{t.stops.none}</p>}
    </section>
  );
}

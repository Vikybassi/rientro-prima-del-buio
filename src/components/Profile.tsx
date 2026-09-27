import type { TrailPoint, TrailSummary } from '../data/types.ts';
import type { Plan } from '../engine/plan.ts';
import type { StopTime } from '../engine/stops.ts';
import { arrivalMinutes } from '../engine/time.ts';
import { clock, stopName } from '../format.ts';
import type { Strings } from '../i18n.ts';
import { layoutLabels, textWidth } from '../labels.ts';
import { useStrip } from '../useStrip.ts';

type Props = { plan: Plan; track: TrailPoint[]; trail: TrailSummary; stops: StopTime[]; t: Strings };

const HOUR_MS = 3_600_000;
const MAX_MARKS = 6;
const CHART_PX = 150;
const ROW_PX = 20;
/** Oltre questa larghezza il nome di una tappa si accorcia coi puntini: sul telefono le righe restano poche. */
const MAX_LABEL_PX = 170;

/** Posizione orizzontale di un'etichetta senza farla uscire dai bordi. */
const edgeShift = (x: number) => (x < 8 ? '0%' : x > 92 ? '-100%' : '-50%');

/**
 * Il profilo della salita. Sopra, le tappe (ora e nome, con una lineetta fino al loro punto sul profilo); sotto, le
 * ore piene come un asse: "alle 17 sei qui". La linea è in SVG (si deforma per riempire lo spazio); le scritte sono
 * HTML posato sopra, così restano leggibili anche sul telefono.
 */
export function Profile({ plan, track, trail, stops, t }: Props) {
  const { ref: boxRef, width, font } = useStrip<HTMLDivElement>(600);
  const times = arrivalMinutes(track, plan.upMin.estimate);
  const total = track[track.length - 1][2];
  const eles = track.map((p) => p[3]);
  const minE = Math.min(...eles);
  const maxE = Math.max(...eles);
  // coordinate in percentuale: la linea occupa dal 6% al 92% dell'altezza
  const x = (d: number) => (d / total) * 100;
  const y = (e: number) => 6 + ((maxE - e) / (maxE - minE || 1)) * 86;
  const line = track.map((p) => `${x(p[2])},${y(p[3])}`).join(' ');
  const area = `0,100 ${line} 100,100`;

  // le ore piene tra la partenza e l'arrivo in cima (il fuso di Roma ha scarti di ore intere: l'ora piena è la stessa in UTC)
  const start = plan.startAt.getTime();
  const top = start + plan.upMin.estimate * 60_000;
  let marks: { at: Date; d: number; e: number }[] = [];
  for (let ms = Math.ceil((start + 1) / HOUR_MS) * HOUR_MS; ms < top - 10 * 60_000; ms += HOUR_MS) {
    const minute = (ms - start) / 60_000;
    const i = times.findIndex((m) => m >= minute);
    if (i <= 0) continue;
    const f = (minute - times[i - 1]) / (times[i] - times[i - 1] || 1);
    const [, , d0, e0] = track[i - 1];
    const [, , d1, e1] = track[i];
    marks.push({ at: new Date(ms), d: d0 + (d1 - d0) * f, e: e0 + (e1 - e0) * f });
  }
  if (marks.length > MAX_MARKS) marks = marks.filter((_, k) => k % 2 === 1); // salite lunghe: un'ora sì e una no

  // le tappe: ognuna al suo punto della traccia, etichette in righe che non si toccano
  const eleAt = (d: number) => track.reduce((best, p) => (Math.abs(p[2] - d) < Math.abs(best[2] - d) ? p : best))[3];
  const labels = stops.map((s, k) => {
    const time = clock(s.at.estimate);
    const name = stopName(s, t);
    return { key: String(k), time, name, d: s.d, e: eleAt(s.d), w: Math.min(MAX_LABEL_PX, textWidth(`${time} ${name}`, font)) };
  });
  const placed = width
    ? layoutLabels(labels.map((l) => ({ key: l.key, x: (x(l.d) / 100) * width, width: l.w })), width)
    : [];
  const rows = placed.reduce((n, l) => Math.max(n, l.row + 1), 0);
  const above = rows * ROW_PX + (rows ? 6 : 0);

  const summit = clock(plan.summitAt.estimate);
  return (
    <section className="section">
      <h3 className="section-title">{t.profile.title}</h3>
      <div ref={boxRef} className="profile" style={{ paddingTop: above }}>
        <div className="profile-chart" role="img" aria-label={t.profile.label(trail.from, trail.startEle, trail.to, trail.endEle, summit)}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polygon points={area} className="profile-area" />
            {marks.map((m) => (
              <line key={m.at.getTime()} x1={x(m.d)} x2={x(m.d)} y1={y(m.e)} y2={100} className="profile-hour" vectorEffect="non-scaling-stroke" />
            ))}
            <polyline points={line} className="profile-line" vectorEffect="non-scaling-stroke" />
          </svg>
          {labels.map((l) => (
            <span key={l.key} className="profile-stop" style={{ left: `${x(l.d)}%`, top: `${y(l.e)}%` }} aria-hidden="true" />
          ))}
        </div>
        {placed.map((p) => {
          const l = labels[Number(p.key)];
          const px = (x(l.d) / 100) * width;
          const labelBottom = p.row * ROW_PX + ROW_PX - 2;
          return (
            <span key={p.key} aria-hidden="true">
              <span className="profile-leader" style={{ left: px, top: labelBottom, height: above + (y(l.e) / 100) * CHART_PX - labelBottom - 5 }} />
              <span className="profile-label" style={{ left: p.left, top: p.row * ROW_PX, maxWidth: MAX_LABEL_PX }}>
                <b>{l.time}</b> {l.name}
              </span>
            </span>
          );
        })}
      </div>
      <div className="profile-axis" aria-hidden="true">
        {marks.map((m) => (
          <span key={m.at.getTime()} style={{ left: `${x(m.d)}%`, transform: `translateX(${edgeShift(x(m.d))})` }}>
            {clock(m.at)}
          </span>
        ))}
      </div>
      <div className="profile-ends" aria-hidden="true">
        <span>{clock(plan.startAt)} · {trail.from} · {trail.startEle} m</span>
        <span>{summit} · {trail.to} · {trail.endEle} m</span>
      </div>
    </section>
  );
}

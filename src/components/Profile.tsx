import type { CSSProperties } from 'react';
import type { TrailPoint, TrailSummary } from '../data/types.ts';
import type { Plan } from '../engine/plan.ts';
import { arrivalMinutes } from '../engine/time.ts';
import { clock } from '../format.ts';
import type { Strings } from '../i18n.ts';

type Props = { plan: Plan; track: TrailPoint[]; trail: TrailSummary; t: Strings };

const HOUR_MS = 3_600_000;
const MAX_MARKS = 6;

/** Posizione orizzontale di un'etichetta senza farla uscire dai bordi. */
const edgeShift = (x: number) => (x < 8 ? '0%' : x > 92 ? '-100%' : '-50%');

/**
 * Il profilo della salita, con un punto a ogni ora piena: "alle 10 sei qui, a 1900 m".
 * La linea è in SVG (si deforma per riempire lo spazio); gli orari sono testo HTML posato sopra,
 * così restano leggibili anche sul telefono.
 */
export function Profile({ plan, track, trail, t }: Props) {
  const times = arrivalMinutes(track, plan.upMin.estimate);
  const total = track[track.length - 1][2];
  const eles = track.map((p) => p[3]);
  const minE = Math.min(...eles);
  const maxE = Math.max(...eles);
  // coordinate in percentuale: la linea occupa dal 14% all'88% dell'altezza, lasciando spazio agli orari sopra
  const x = (d: number) => (d / total) * 100;
  const y = (e: number) => 14 + ((maxE - e) / (maxE - minE || 1)) * 74;
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

  const summit = clock(plan.summitAt.estimate);
  return (
    <section className="section">
      <h3 className="section-title">{t.profile.title}</h3>
      <div className="profile" role="img" aria-label={t.profile.label(trail.from, trail.startEle, trail.to, trail.endEle, summit)}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polygon points={area} className="profile-area" />
          <polyline points={line} className="profile-line" vectorEffect="non-scaling-stroke" />
        </svg>
        {marks.map((m) => {
          const pos: CSSProperties = { left: `${x(m.d)}%`, top: `${y(m.e)}%` };
          return (
            <span key={m.at.getTime()} aria-hidden="true">
              <span className="profile-dot" style={pos} />
              <span className="profile-label" style={{ ...pos, transform: `translate(${edgeShift(x(m.d))}, -135%)` }}>{clock(m.at)}</span>
            </span>
          );
        })}
      </div>
      <div className="profile-ends" aria-hidden="true">
        <span>{clock(plan.startAt)} · {trail.from} · {trail.startEle} m</span>
        <span>{summit} · {trail.to} · {trail.endEle} m</span>
      </div>
    </section>
  );
}

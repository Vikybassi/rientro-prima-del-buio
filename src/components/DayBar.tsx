import type { CSSProperties } from 'react';
import { localDate, localTime, localToInstant } from '../engine/clock.ts';
import type { Plan } from '../engine/plan.ts';
import { clock } from '../format.ts';
import type { Strings } from '../i18n.ts';

type Props = { plan: Plan; date: string; t: Strings };

const hourOf = (d: Date) => Number(localTime(d).slice(0, 2)) + Number(localTime(d).slice(3)) / 60;

/** Un'etichetta posizionata sotto (o sopra) un punto della striscia, senza uscire dai bordi. */
function labelStyle(pct: number, row = 0): CSSProperties {
  const shift = pct < 12 ? '0%' : pct > 88 ? '-100%' : '-50%';
  return { left: `${pct}%`, top: `${row * 17}px`, transform: `translateX(${shift})` };
}

/**
 * La giornata come una striscia: notte, crepuscolo, luce, e sopra il giro. Verde pieno fino al rientro stimato,
 * verde chiaro fino al rientro se ci si mette di più. Gli orari sono scritti direttamente sulla striscia:
 * niente legenda da decifrare.
 */
export function DayBar({ plan, date, t }: Props) {
  const { light, startAt, backAt, latestStart } = plan;
  // finestra: un'ora prima dell'alba (o della partenza) fino a un'ora dopo il buio (o il rientro), a ore intere
  const fromHour = Math.max(0, Math.floor(Math.min(hourOf(light.dawn), hourOf(startAt))) - 1);
  // se il rientro cade dopo mezzanotte la striscia arriva fino a fine giornata (e il giro esce dal bordo)
  const backHour = localDate(backAt.prudent) === date ? hourOf(backAt.prudent) : 24;
  const toHour = Math.min(24, Math.ceil(Math.max(hourOf(light.dusk), backHour)) + 1);
  const from = localToInstant(date, `${String(fromHour).padStart(2, '0')}:00`).getTime();
  const to = from + (toHour - fromHour) * 3_600_000;
  const pct = (d: Date) => Math.min(100, Math.max(0, ((d.getTime() - from) / (to - from)) * 100));
  const span = (a: Date, b: Date) => ({ left: `${pct(a)}%`, width: `${pct(b) - pct(a)}%` });

  const startPct = pct(startAt);
  const backPct = (pct(backAt.estimate) + pct(backAt.prudent)) / 2;
  const darkPct = pct(light.dusk);
  const showLatest = latestStart.getTime() > from && latestStart.getTime() < to;
  // etichette troppo vicine si sovrappongono: la seconda scende di una riga
  const TOO_CLOSE = 24;
  const backRow = backPct - startPct < TOO_CLOSE ? 1 : 0;
  const darkRow = Math.abs(darkPct - backPct) < TOO_CLOSE && backRow === 0 ? 1 : 0;

  const label = t.dayBarLabel(clock(startAt), clock(backAt.estimate), clock(backAt.prudent, 'up'), localTime(light.sunset), localTime(light.dusk));

  return (
    <section className="section">
      <h3 className="section-title">{t.dayBar}</h3>
      <div className="daybar-above" aria-hidden="true">
        {showLatest && (
          <span className="daybar-latest-label" style={labelStyle(pct(latestStart))}>
            {t.bar.latest(clock(latestStart, 'down'))} ▾
          </span>
        )}
      </div>
      <div className="daybar" role="img" aria-label={label}>
        <div className="daybar-band" style={{ ...span(light.dawn, light.dusk), background: 'var(--twilight)' }} />
        <div className="daybar-band" style={{ ...span(light.sunrise, light.sunset), background: 'var(--day)' }} />
        <div className="daybar-hike" style={{ ...span(backAt.estimate, backAt.prudent), background: 'var(--hike-prudent)' }} />
        <div className="daybar-hike" style={{ ...span(startAt, backAt.estimate), background: 'var(--hike)' }} />
      </div>
      <div className="daybar-below" aria-hidden="true" style={{ height: `${(Math.max(backRow, darkRow) + 1) * 17 + 4}px` }}>
        <span style={labelStyle(startPct)}>{t.bar.start(clock(startAt))}</span>
        <span style={labelStyle(backPct, backRow)}>{t.bar.back(clock(backAt.estimate), clock(backAt.prudent, 'up'))}</span>
        <span style={labelStyle(darkPct, darkRow)}>{t.bar.dark(localTime(light.dusk))}</span>
      </div>
    </section>
  );
}

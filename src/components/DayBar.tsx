import { localDate, localTime, localToInstant } from '../engine/clock.ts';
import { shadeEarly, type Plan } from '../engine/plan.ts';
import { clock } from '../format.ts';
import type { Strings } from '../i18n.ts';
import { layoutLabels, textWidth } from '../labels.ts';
import { useStrip } from '../useStrip.ts';

type Props = { plan: Plan; date: string; t: Strings; /** "Alla partenza" o "Al rifugio": dove si guarda il sole */ where: string };

const hourOf = (d: Date) => Number(localTime(d).slice(0, 2)) + Number(localTime(d).slice(3)) / 60;
const ROW_PX = 20;

/**
 * La giornata come una striscia: notte, crepuscolo, luce, e sopra il giro. Verde pieno fino al rientro stimato
 * (o all'arrivo al rifugio, se si dorme lì), verde chiaro fino a quando ci si mette di più. Gli orari sono scritti
 * direttamente sulla striscia: niente legenda da decifrare.
 */
export function DayBar({ plan, date, where, t }: Props) {
  const { light, startAt, endAt, latestStart, overnight } = plan;
  const { ref: stripRef, width, font } = useStrip<HTMLDivElement>();
  // finestra: un'ora prima dell'alba (o della partenza) fino a un'ora dopo il buio (o la fine), a ore intere
  const fromHour = Math.max(0, Math.floor(Math.min(hourOf(light.dawn), hourOf(startAt))) - 1);
  // se la fine cade dopo mezzanotte la striscia arriva fino a fine giornata (e il giro esce dal bordo)
  const endHour = localDate(endAt.prudent) === date ? hourOf(endAt.prudent) : 24;
  const toHour = Math.min(24, Math.ceil(Math.max(hourOf(light.dusk), endHour)) + 1);
  const from = localToInstant(date, `${String(fromHour).padStart(2, '0')}:00`).getTime();
  const to = from + (toHour - fromHour) * 3_600_000;
  const pct = (d: Date) => Math.min(100, Math.max(0, ((d.getTime() - from) / (to - from)) * 100));
  const span = (a: Date, b: Date) => ({ left: `${pct(a)}%`, width: `${pct(b) - pct(a)}%` });
  const showLatest = latestStart.getTime() > from && latestStart.getTime() < to;

  const endText = (overnight ? t.bar.arrive : t.bar.back)(clock(endAt.estimate), clock(endAt.prudent, 'up'));
  const texts = [
    { key: 'start', text: t.bar.start(clock(startAt)), at: pct(startAt) },
    { key: 'end', text: endText, at: (pct(endAt.estimate) + pct(endAt.prudent)) / 2 },
    { key: 'dark', text: t.bar.dark(localTime(light.dusk)), at: pct(light.dusk) },
  ];
  // prima della misura le etichette non si disegnano: meglio che vederle saltare
  const placed = width
    ? layoutLabels(
        texts.map((l) => ({ key: l.key, x: (l.at / 100) * width, width: textWidth(l.text, font) })),
        width,
      )
    : [];
  const rows = placed.reduce((n, l) => Math.max(n, l.row + 1), 1);
  const latestText = t.bar.latest(clock(latestStart, 'down'));
  const latestLeft = width
    ? layoutLabels([{ key: 'latest', x: (pct(latestStart) / 100) * width, width: textWidth(latestText, font.replace(/^500/, '600')) }], width)[0].left
    : 0;

  const label = (overnight ? t.dayBarLabelStay : t.dayBarLabel)(
    clock(startAt),
    clock(endAt.estimate),
    clock(endAt.prudent, 'up'),
    localTime(light.sunset),
    localTime(light.dusk),
  );

  return (
    <section className="section">
      <h3 className="section-title">{t.dayBar}</h3>
      <div className="daybar-above" aria-hidden="true">
        {showLatest && width > 0 && (
          <span className="daybar-latest-label" style={{ left: latestLeft }}>
            {latestText}
          </span>
        )}
      </div>
      <div className="daybar" role="img" aria-label={label}>
        <div className="daybar-band" style={{ ...span(light.dawn, light.dusk), background: 'var(--twilight)' }} />
        <div className="daybar-band" style={{ ...span(light.sunrise, light.sunset), background: 'var(--day)' }} />
        {plan.shade?.at && shadeEarly(plan) && <div className="daybar-band daybar-shade" style={span(plan.shade.at, light.sunset)} />}
        <div className="daybar-hike" style={{ ...span(endAt.estimate, endAt.prudent), background: 'var(--hike-prudent)' }} />
        <div className="daybar-hike" style={{ ...span(startAt, endAt.estimate), background: 'var(--hike)' }} />
        {showLatest && <div className="daybar-latest" style={{ left: `${pct(latestStart)}%` }} />}
      </div>
      <div className="daybar-below" ref={stripRef} aria-hidden="true" style={{ height: `${rows * ROW_PX + 4}px` }}>
        {placed.map((l) => (
          <span key={l.key} style={{ left: l.left, top: l.row * ROW_PX }}>
            {texts.find((x) => x.key === l.key)!.text}
          </span>
        ))}
      </div>
      {shadeEarly(plan) && (
        <p className="daybar-legend">
          {plan.shade?.at && <span className="daybar-swatch daybar-shade" aria-hidden="true" />}
          {plan.shade?.at ? t.shade.at(where, clock(plan.shade.at)) : t.shade.all(where)}
        </p>
      )}
    </section>
  );
}

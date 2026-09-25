import type { TrailSummary } from '../data/types.ts';
import type { Plan } from '../engine/plan.ts';
import { conditionsAt, type Hazard } from '../engine/weather.ts';
import { clock, dayLabel } from '../format.ts';
import type { Lang, Strings } from '../i18n.ts';
import type { ForecastState } from '../useForecast.ts';
import { useOnline } from '../useOnline.ts';

type Props = { state: ForecastState; plan: Plan; hazards: Hazard[]; trail: TrailSummary; date: string; t: Strings; lang: Lang };

/** Una frase per avviso: che cosa, quando (e quanto). */
function describe(h: Hazard, t: Strings): string {
  const at = clock(h.at);
  switch (h.kind) {
    case 'thunderstorm':
      return h.level === 'danger' ? t.weather.thunderstorm(at) : t.weather.stormRisk(at);
    case 'rain':
      return t.weather.rain(at, Math.round(h.value));
    case 'wind':
      return t.weather.wind(at, Math.round(h.value));
    case 'freezing':
      return t.weather.freezing(at, Math.round(h.value / 50) * 50);
  }
}

/** Meteo nelle ore e alle quote del giro: gli avvisi, oppure com'è in cima quando ci arrivi. */
export function WeatherNotes({ state, plan, hazards, trail, date, t, lang }: Props) {
  const online = useOnline();
  let body;
  if (state.status === 'loading' || state.status === 'idle') body = <p className="note">{t.weather.loading}</p>;
  else if (state.status === 'too-far') body = <p>{t.weather.tooFar(dayLabel(date, lang))}</p>;
  else if (state.status === 'past') body = <p>{t.weather.past}</p>;
  else if (state.status === 'error') body = <p>{t.weather.error}</p>;
  else {
    const top = conditionsAt(state.forecast, { at: plan.summitAt.estimate, ele: trail.endEle });
    body = (
      <>
        {hazards.length > 0 ? (
          <ul className={`weather-list${hazards.some((h) => h.level === 'danger') ? ' weather-danger' : ''}`}>
            {hazards.map((h) => <li key={h.kind}>{describe(h, t)}</li>)}
          </ul>
        ) : (
          <p>{t.weather.none}</p>
        )}
        {Number.isFinite(top.temperature) && Number.isFinite(top.gusts) && (
          <p>{t.weather.summit(clock(plan.summitAt.estimate), Math.round(top.temperature), Math.round(top.gusts))}</p>
        )}
        {/* senza rete le previsioni vengono dalla copia salvata (service worker): va detto, possono essere vecchie */}
        {!online && <p className="offline-note">{t.weather.offline}</p>}
        <p className="note">{t.weather.source}</p>
      </>
    );
  }
  return (
    <section className="section weather" aria-live="polite">
      <h3 className="section-title">{t.weather.title}</h3>
      {body}
    </section>
  );
}

import { lazy, Suspense, useState } from 'react';
import type { TrailPoint, TrailSummary } from '../data/types.ts';
import { localTime } from '../engine/clock.ts';
import { answer, verdict, type Plan } from '../engine/plan.ts';
import type { Hazard } from '../engine/weather.ts';
import { clock, dayLabel, duration, km } from '../format.ts';
import type { Lang, Strings } from '../i18n.ts';
import { PACES, STOPS, type Params } from '../state.ts';
import type { ForecastState } from '../useForecast.ts';
import { DayBar } from './DayBar.tsx';
import { Profile } from './Profile.tsx';
import { WeatherNotes } from './WeatherNotes.tsx';

// la mappa (e Leaflet con lei) si scarica solo quando serve: chi guarda solo l'elenco non la paga
const TrailMap = lazy(() => import('./TrailMap.tsx'));

type Props = {
  trail: TrailSummary;
  plan: Plan | null;
  track: TrailPoint[] | null;
  weather: ForecastState;
  hazards: Hazard[];
  params: Params;
  onChange: (patch: Partial<Params>) => void;
  onBack: () => void;
  t: Strings;
  lang: Lang;
};

/**
 * La risposta alla domanda dell'app: il titolo dice sì / al limite / no, prima per la luce e poi per il meteo
 * (engine/plan.ts `answer`); il colore tiene conto di tutti gli avvisi (`verdict`).
 */
function Answer({ plan, hazards, t }: { plan: Plan; hazards: Hazard[]; t: Strings }) {
  const latest = clock(plan.latestStart, 'down');
  const tooLong = plan.latestStart < plan.light.dawn;
  return (
    <section className="verdict" data-verdict={verdict(plan, hazards)} aria-live="polite">
      <h3>{t.answer[answer(plan, hazards)]}</h3>
      <p>{t.backLine(clock(plan.backAt.estimate), clock(plan.backAt.prudent, 'up'), localTime(plan.light.sunset))}</p>
      <p className="verdict-secondary">
        {tooLong ? t.latest.tooLong : plan.lightStatus === 'ok' ? t.latest.ok(latest) : t.latest.late(latest)}
      </p>
      {plan.startsInDark && <p className="verdict-secondary">{t.startsInDark}</p>}
    </section>
  );
}

export function PlanView({ trail, plan, track, weather, hazards, params, onChange, onBack, t, lang }: Props) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <article className="plan-column" aria-labelledby="plan-title">
      <button type="button" className="link-button back-to-list" onClick={onBack}>← {t.back}</button>
      <h2 id="plan-title" className="plan-title">{trail.from} → {trail.to}</h2>
      <p className="plan-subtitle">
        {[trail.refs.length ? t.trailRefs(trail.refs) : null, t.difficulty[trail.difficulty], km(trail.lengthM, lang), `+${trail.upM} m`]
          .filter(Boolean)
          .join(' · ')}
      </p>

      <fieldset className="when">
        <legend>{t.when}</legend>
        <div className="when-fields">
          <label className="field">
            {t.date}
            <input type="date" value={params.date} required onChange={(e) => e.target.value && onChange({ date: e.target.value })} />
            <span className="field-hint">{dayLabel(params.date, lang)}</span>
          </label>
          <label className="field">
            {t.start}
            <input type="time" value={params.start} step={300} required onChange={(e) => e.target.value && onChange({ start: e.target.value })} />
          </label>
        </div>
        <details className="settings">
          <summary>
            {t.settings(params.pace, params.stop)} · <span className="settings-change">{t.change}</span>
          </summary>
          <div className="when-fields">
            <label className="field">
              {t.pace}
              <select value={params.pace} onChange={(e) => onChange({ pace: e.target.value as Params['pace'] })}>
                {PACES.map((p) => <option key={p} value={p}>{t.paces[p]}</option>)}
              </select>
            </label>
            <label className="field">
              {t.stop}
              <select value={params.stop} onChange={(e) => onChange({ stop: Number(e.target.value) })}>
                {STOPS.map((s) => <option key={s} value={s}>{t.minutes(s)}</option>)}
              </select>
            </label>
          </div>
        </details>
      </fieldset>

      {plan && (
        <>
          <p className="step-label">{t.answerStep}</p>
          <Answer plan={plan} hazards={hazards} t={t} />
          <DayBar plan={plan} date={params.date} t={t} />
          <WeatherNotes state={weather} plan={plan} hazards={hazards} trail={trail} date={params.date} t={t} lang={lang} />
          {track && <Profile plan={plan} track={track} trail={trail} t={t} />}
          {track && (
            <section className="section">
              <h3 className="section-title">{t.map.title}</h3>
              <Suspense fallback={<div className="trail-map trail-map-loading">{t.map.loading}</div>}>
                <TrailMap trail={trail} track={track} t={t} />
              </Suspense>
              <p className="map-links">
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${trail.start[0]},${trail.start[1]}`} target="_blank" rel="noopener">
                  {t.map.directions}
                </a>
                <a
                  href={
                    trail.osm !== null
                      ? `https://www.openstreetmap.org/relation/${trail.osm}`
                      : `https://www.openstreetmap.org/?mlat=${trail.end[0]}&mlon=${trail.end[1]}#map=14/${trail.end[0]}/${trail.end[1]}`
                  }
                  target="_blank"
                  rel="noopener"
                >
                  {t.map.osm}
                </a>
              </p>
            </section>
          )}

          <section className="section">
            <h3 className="section-title">{t.hike}</h3>
            <p className="hike-line">{t.upLine(duration(plan.upMin.estimate), clock(plan.summitAt.estimate))}</p>
            <p className="hike-line">{t.downLine(duration(plan.downMin.estimate), clock(plan.backAt.estimate))}</p>
            <p className="note">
              {trail.osm === null
                ? t.itinerary(trail.refs)
                : plan.timeSource === 'cai' && trail.caiUpMin
                  ? t.source.cai(duration(trail.caiUpMin))
                  : t.source.formula}{' '}
              {t.slack(duration(plan.upMin.prudent + plan.downMin.prudent - plan.upMin.estimate - plan.downMin.estimate, 'up'))}
            </p>
          </section>

          {(trail.unmarked || trail.checkRoad || trail.tollRoad) && (
            <ul className="warnings">
              {trail.unmarked && <li>{t.unmarked}</li>}
              {trail.checkRoad && <li>{t.checkRoad}</li>}
              {trail.tollRoad && <li>{t.tollRoad}</li>}
            </ul>
          )}

          <button type="button" className="link-button" onClick={share}>{copied ? t.shared : t.share}</button>
        </>
      )}
    </article>
  );
}

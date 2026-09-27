import { lazy, Suspense, useMemo, useState } from 'react';
import type { TrailSummary, TrailTrack } from '../data/types.ts';
import { localTime } from '../engine/clock.ts';
import { answer, shadeEarly, verdict, type Plan } from '../engine/plan.ts';
import { furthestSafe, stopTimes, type StopTime } from '../engine/stops.ts';
import type { Hazard } from '../engine/weather.ts';
import { clock, dayLabel, duration, km, stopName } from '../format.ts';
import type { Lang, Strings } from '../i18n.ts';
import { PACES, STOPS, type Params } from '../state.ts';
import type { ForecastState } from '../useForecast.ts';
import { DayBar } from './DayBar.tsx';
import { Profile } from './Profile.tsx';
import { StopsTimeline } from './StopsTimeline.tsx';
import { WeatherNotes } from './WeatherNotes.tsx';

// la mappa (e Leaflet con lei) si scarica solo quando serve: chi guarda solo l'elenco non la paga
const TrailMap = lazy(() => import('./TrailMap.tsx'));

type Props = {
  trail: TrailSummary;
  plan: Plan | null;
  track: TrailTrack | null;
  /** la meta è un rifugio o un bivacco: si può scegliere di dormire lì */
  stayPlace: 'hut' | 'bivouac' | null;
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
 * (engine/plan.ts `answer`); il colore tiene conto di tutti gli avvisi (`verdict`). Sotto, i tre numeri che contano
 * (a che ora sei alla macchina o al rifugio, il tramonto, quanta luce ti avanza) e cosa fare se non ci sta.
 */
function Answer({ plan, hazards, stayPlace, furthest, t }: { plan: Plan; hazards: Hazard[]; stayPlace: 'hut' | 'bivouac' | null; furthest: StopTime | null; t: Strings }) {
  const latest = clock(plan.latestStart, 'down');
  const a = answer(plan, hazards);
  const place = plan.overnight && stayPlace ? t.place[stayPlace] : null;
  // se per avere margine bisognerebbe partire prima che faccia giorno, dirlo invece di proporre un orario al buio
  const tooLong = plan.lightStatus !== 'ok' && plan.latestStart < plan.light.dawn;
  // la luce che avanza (o manca) se il giro va come previsto: dal tramonto all'arrivo
  const spare = Math.round((plan.light.sunset.getTime() - plan.endAt.estimate.getTime()) / 60_000);
  return (
    <section className="verdict" data-verdict={verdict(plan, hazards)} aria-live="polite">
      <h3>{place ? t.stayAnswer[a](place) : t.answer[a]}</h3>
      <dl className="facts">
        <div>
          <dt>{place ? t.facts.at(place) : t.facts.car}</dt>
          <dd>{clock(plan.endAt.estimate)}</dd>
          <dd className="fact-note">{t.facts.ifLonger(clock(plan.endAt.prudent, 'up'))}</dd>
        </div>
        <div>
          <dt>{t.facts.sunset}</dt>
          <dd>{localTime(plan.light.sunset)}</dd>
          {shadeEarly(plan) && (
            <dd className="fact-note">{plan.shade?.at ? t.facts.shade(clock(plan.shade.at)) : t.facts.shadeAll}</dd>
          )}
        </div>
        <div>
          <dt>{spare >= 0 ? t.facts.spare : t.facts.short}</dt>
          <dd>{duration(Math.abs(spare))}</dd>
        </div>
      </dl>
      {furthest && <p className="verdict-proposal">{t.stops.furthest(stopName(furthest, t), furthest.ele, clock(furthest.at.estimate))}</p>}
      <p className="verdict-secondary">
        {tooLong ? t.latest.tooLong(latest, localTime(plan.light.dawn)) : (place ? t.stayLatest : t.latest)[plan.lightStatus](latest)}
      </p>
      {plan.nextDay && (
        <p className="verdict-secondary">{t.nextDay(localTime(plan.nextDay.light.dawn), duration(plan.nextDay.downMin.estimate))}</p>
      )}
      {plan.startsInDark && <p className="verdict-secondary">{t.startsInDark}</p>}
    </section>
  );
}

export function PlanView({ trail, plan, track, stayPlace, weather, hazards, params, onChange, onBack, t, lang }: Props) {
  const [copied, setCopied] = useState(false);
  const times = useMemo(() => (plan && track ? stopTimes(plan, track.points, track.stops ?? []) : []), [plan, track]);
  const furthest = plan ? furthestSafe(plan, times) : null;

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
        {/* passo e sosta cambiano molto la risposta: sempre in vista, un tocco per cambiarli */}
        <div className="choices">
          {stayPlace && (
            <fieldset className="choice">
              <legend>{t.mode.label}</legend>
              <div className="segmented">
                {([false, true] as const).map((n) => (
                  <label key={String(n)}>
                    <input type="radio" name="mode" value={n ? 'stay' : 'round'} checked={params.overnight === n} onChange={() => onChange({ overnight: n })} />
                    <span>{n ? t.mode.stay[stayPlace] : t.mode.roundTrip}</span>
                  </label>
                ))}
              </div>
              <span className="field-hint">{t.mode.hint}</span>
            </fieldset>
          )}
          <fieldset className="choice">
            <legend>{t.pace}</legend>
            <div className="segmented">
              {PACES.map((p) => (
                <label key={p}>
                  <input type="radio" name="pace" value={p} checked={params.pace === p} onChange={() => onChange({ pace: p })} />
                  <span>{t.paces[p]}</span>
                </label>
              ))}
            </div>
            <span className="field-hint">{t.paceHint}</span>
          </fieldset>
          {!plan?.overnight && (
          <fieldset className="choice">
            <legend>{t.stop}</legend>
            <div className="segmented">
              {STOPS.map((s) => (
                <label key={s}>
                  <input type="radio" name="stop" value={s} checked={params.stop === s} onChange={() => onChange({ stop: s })} />
                  <span>{t.stopOption(s)}</span>
                </label>
              ))}
            </div>
            <span className="field-hint">{t.stopHint}</span>
          </fieldset>
          )}
        </div>
      </fieldset>

      {plan && (
        <>
          <p className="step-label">{plan.overnight ? t.answerStepStay : t.answerStep}</p>
          <Answer plan={plan} hazards={hazards} stayPlace={stayPlace} furthest={furthest} t={t} />
          <DayBar plan={plan} date={params.date} where={plan.overnight && stayPlace ? t.facts.at(t.place[stayPlace]) : t.shade.start} t={t} />
          {track && <StopsTimeline plan={plan} trail={trail} times={times} t={t} />}
          <WeatherNotes state={weather} plan={plan} hazards={hazards} trail={trail} date={params.date} t={t} lang={lang} />
          {track && <Profile plan={plan} track={track.points} trail={trail} stops={times} t={t} />}
          {track && (
            <section className="section">
              <h3 className="section-title">{t.map.title}</h3>
              <Suspense fallback={<div className="trail-map trail-map-loading">{t.map.loading}</div>}>
                <TrailMap trail={trail} track={track.points} stops={times} t={t} />
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
            <p className="hike-line">
              {plan.overnight ? t.downNextDay(duration(plan.downMin.estimate)) : t.downLine(duration(plan.downMin.estimate), clock(plan.backAt.estimate))}
            </p>
            <p className="note">
              {trail.osm === null
                ? t.itinerary(trail.refs)
                : plan.timeSource === 'cai' && trail.caiUpMin
                  ? t.source.cai(duration(trail.caiUpMin))
                  : t.source.formula}{' '}
              {t.slack(duration(plan.upMin.prudent - plan.upMin.estimate + (plan.overnight ? 0 : plan.downMin.prudent - plan.downMin.estimate), 'up'))}
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

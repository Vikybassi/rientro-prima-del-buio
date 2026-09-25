import { useEffect, useMemo, useState } from 'react';
import { PlanView } from './components/PlanView.tsx';
import { TrailPicker } from './components/TrailPicker.tsx';
import trailsJson from './data/trails.json';
import type { TrailSummary, TrailTrack } from './data/types.ts';
import { localDate } from './engine/clock.ts';
import { makePlan } from './engine/plan.ts';
import { assessWeather } from './engine/weather.ts';
import { STRINGS } from './i18n.ts';
import { defaults, readParams, writeParams, type Params } from './state.ts';
import { useForecast } from './useForecast.ts';

const trails = trailsJson as TrailSummary[];
const knownTrails = new Set(trails.map((tr) => tr.id));

function initialParams(): Params {
  return readParams(window.location.search, defaults(new Date(), navigator.language), knownTrails);
}

export default function App() {
  const [params, setParams] = useState<Params>(initialParams);
  const [track, setTrack] = useState<TrailTrack | null>(null);
  const t = STRINGS[params.lang];
  const trail = trails.find((tr) => tr.id === params.trail) ?? null;

  // lo stato va nell'indirizzo: il link copiato riapre lo stesso piano
  useEffect(() => {
    window.history.replaceState(null, '', writeParams(params));
    document.documentElement.lang = params.lang;
    document.title = trail ? `${trail.from} → ${trail.to} · ${t.appName}` : t.appName;
  }, [params, trail, t]);

  // la traccia di un sentiero si scarica solo quando lo si apre
  useEffect(() => {
    if (params.trail === null) return;
    const controller = new AbortController();
    fetch(`/trails/${params.trail}.json`, { signal: controller.signal })
      .then((r) => r.json() as Promise<TrailTrack>)
      .then(setTrack)
      .catch(() => {}); // interrotta perché si è scelto un altro sentiero
    return () => controller.abort();
  }, [params.trail]);

  const plan = useMemo(() => {
    if (!trail || !track || track.id !== trail.id) return null;
    return makePlan({ trail, track: track.points, date: params.date, start: params.start, pace: params.pace, stopMin: params.stop });
  }, [trail, track, params.date, params.start, params.pace, params.stop]);

  const weather = useForecast(trail, params.date, localDate(new Date()));
  // gli avvisi meteo contano solo nelle ore e alle quote in cui si è sul sentiero (i "momenti" del piano)
  // dipende dalle previsioni, non dall'oggetto `weather` (nuovo a ogni ridisegno): si ricalcola solo se cambiano
  const forecast = weather.status === 'ok' ? weather.forecast : null;
  const hazards = useMemo(() => (plan && forecast ? assessWeather(forecast, plan.moments) : []), [plan, forecast]);

  const update = (patch: Partial<Params>) => setParams((p) => ({ ...p, ...patch }));

  return (
    <div className="app">
      <header className="masthead">
        <div>
          <h1>{t.appName}</h1>
          <p>{t.tagline}</p>
        </div>
        <button type="button" className="link-button" lang={params.lang === 'it' ? 'en' : 'it'} onClick={() => update({ lang: params.lang === 'it' ? 'en' : 'it' })}>
          {t.langSwitch}
        </button>
      </header>

      <main className="layout" data-view={trail ? 'plan' : 'list'}>
        <TrailPicker trails={trails} selected={params.trail} onSelect={(id) => update({ trail: id })} t={t} lang={params.lang} />
        {trail && (
          <PlanView trail={trail} plan={plan} track={track && track.id === trail.id ? track.points : null} weather={weather} hazards={hazards} params={params} onChange={update} onBack={() => update({ trail: null })} t={t} lang={params.lang} />
        )}
      </main>

      <footer className="footer">
        <p>{t.disclaimer}</p>
        <p>
          {t.credits} <a href="https://vittoriabassi.netlify.app">Vittoria Bassi</a>
        </p>
      </footer>
    </div>
  );
}

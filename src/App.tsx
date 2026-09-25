import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { PlanView } from './components/PlanView.tsx';
import { TrailPicker, type BrowseView } from './components/TrailPicker.tsx';
import trailsJson from './data/trails.json';
import type { TrailSummary, TrailTrack } from './data/types.ts';
import { localDate } from './engine/clock.ts';
import { makePlan } from './engine/plan.ts';
import { assessWeather } from './engine/weather.ts';
import { filterTrails, NO_FILTERS, type Filters } from './filters.ts';
import { STRINGS } from './i18n.ts';
import { defaults, readParams, writeParams, type Params } from './state.ts';
import { useForecast } from './useForecast.ts';
import { useMediaQuery } from './useMediaQuery.ts';
import { useOnline } from './useOnline.ts';

const trails = trailsJson as TrailSummary[];
const knownTrails = new Set(trails.map((tr) => tr.id));

// la mappa d'insieme (e Leaflet con lei) si scarica solo quando si apre: sul telefono l'elenco non la paga
const OverviewMap = lazy(() => import('./components/OverviewMap.tsx'));

/** "Prova con un esempio": un giro classico già compilato, per chi apre l'app senza sapere cos'è. */
const EXAMPLE_TRAIL = '7328079'; // San Giuseppe → Rifugio Longoni, sentiero 331

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

  // ricerca e filtri valgono sia per l'elenco sia per la mappa d'insieme
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const visible = useMemo(() => filterTrails(trails, filters), [filters]);
  // sul telefono si sceglie tra elenco e mappa; sul computer la mappa sta sempre a destra
  const [view, setView] = useState<BrowseView>('list');
  // la mappa d'insieme si crea solo se si vede: sul telefono in modalità elenco non si scarica nemmeno Leaflet
  const wide = useMediaQuery('(min-width: 900px)');
  const showOverview = !trail && (wide || view === 'map');
  const [hovered, setHovered] = useState<string | null>(null);
  const [peek, setPeek] = useState<string | null>(null);
  const online = useOnline();

  return (
    <div className="app">
      {!online && <p className="offline-bar" role="status">{t.offline}</p>}
      <header className="masthead">
        <div className="masthead-text">
          <h1>{t.appName}</h1>
          <p>{t.tagline}</p>
          {!trail && (
            <button type="button" className="link-button example" onClick={() => update({ trail: EXAMPLE_TRAIL })}>
              {t.tryExample} →
            </button>
          )}
        </div>
        <button type="button" className="link-button" lang={params.lang === 'it' ? 'en' : 'it'} onClick={() => update({ lang: params.lang === 'it' ? 'en' : 'it' })}>
          {t.langSwitch}
        </button>
      </header>

      <main className="layout" data-view={trail ? 'plan' : view}>
        <TrailPicker
          trails={trails}
          visible={visible}
          filters={filters}
          onFilters={(patch) => setFilters((f) => ({ ...f, ...patch }))}
          view={view}
          onView={setView}
          selected={params.trail}
          onSelect={(id) => update({ trail: id })}
          onHover={setHovered}
          t={t}
          lang={params.lang}
        />
        {trail && (
          <PlanView trail={trail} plan={plan} track={track && track.id === trail.id ? track.points : null} weather={weather} hazards={hazards} params={params} onChange={update} onBack={() => update({ trail: null })} t={t} lang={params.lang} />
        )}
        {showOverview && (
          <div className="overview-column">
            <Suspense fallback={<div className="overview-map overview-loading">{t.overview.loading}</div>}>
              <OverviewMap
                trails={visible}
                hovered={hovered}
                peek={peek}
                onPeek={setPeek}
                onSelect={(id) => {
                  setPeek(null);
                  update({ trail: id });
                }}
                t={t}
                lang={params.lang}
              />
            </Suspense>
          </div>
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

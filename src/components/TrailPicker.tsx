import type { Destination, TrailSummary, Zone } from '../data/types.ts';
import { trailTimes } from '../engine/plan.ts';
import type { Filters } from '../filters.ts';
import { duration, km } from '../format.ts';
import type { Lang, Strings } from '../i18n.ts';

export type BrowseView = 'list' | 'map';

type Props = {
  /** tutti i giri (per le voci dei menu) e quelli che passano i filtri (da mostrare) */
  trails: TrailSummary[];
  visible: TrailSummary[];
  filters: Filters;
  onFilters: (patch: Partial<Filters>) => void;
  view: BrowseView;
  onView: (v: BrowseView) => void;
  selected: string | null;
  onSelect: (id: string) => void;
  /** il giro sotto il mouse o col focus: la mappa d'insieme lo evidenzia */
  onHover: (id: string | null) => void;
  t: Strings;
  lang: Lang;
};

/** Ordine delle mete nel menu: prima le più cercate. */
const DESTINATION_ORDER: Destination[] = ['hut', 'lake', 'pass', 'bivouac', 'peak', 'alp', 'other'];

/**
 * Passo 1: scegliere il giro. Ricerca, due menu (meta e zona) e l'elenco raggruppato per zona; in ogni riga il tempo
 * di salita stimato, allineato a destra per confrontare i giri scorrendo con l'occhio. Sul telefono c'è anche
 * l'interruttore Elenco / Mappa; sul computer la mappa sta sempre a destra.
 */
export function TrailPicker({ trails, visible, filters, onFilters, view, onView, selected, onSelect, onHover, t, lang }: Props) {
  const zones = [...new Set(trails.map((tr) => tr.zone))];
  const destinations = DESTINATION_ORDER.filter((d) => trails.some((tr) => tr.destination === d));

  return (
    <nav className="picker" aria-labelledby="pick-title">
      <h2 id="pick-title" className="pick-title">{t.pickTitle}</h2>
      <p className="pick-count">{t.count(visible.length)}</p>

      <div className="view-toggle" role="group" aria-label={t.view.label}>
        {(['list', 'map'] as const).map((v) => (
          <button key={v} type="button" aria-pressed={view === v} onClick={() => onView(v)}>{t.view[v]}</button>
        ))}
      </div>

      <label className="sr-only" htmlFor="search">{t.search}</label>
      <input id="search" className="search" type="search" placeholder={t.search} value={filters.query} onChange={(e) => onFilters({ query: e.target.value })} />
      <div className="filters">
        <label className="field">
          {t.filterDestination}
          <select value={filters.destination ?? ''} onChange={(e) => onFilters({ destination: (e.target.value || null) as Destination | null })}>
            <option value="">{t.all}</option>
            {destinations.map((d) => <option key={d} value={d}>{t.destinations[d]}</option>)}
          </select>
        </label>
        <label className="field">
          {t.filterZone}
          <select value={filters.zone ?? ''} onChange={(e) => onFilters({ zone: (e.target.value || null) as Zone | null })}>
            <option value="">{t.all}</option>
            {zones.map((z) => <option key={z} value={z}>{t.zones[z]}</option>)}
          </select>
        </label>
      </div>

      <div className="trail-lists">
        {visible.length === 0 && <p className="note">{t.noResults}</p>}
        {zones
          .filter((z) => visible.some((tr) => tr.zone === z))
          .map((z) => (
            <section className="trail-list" key={z} aria-labelledby={`zone-${z}`}>
              <h2 id={`zone-${z}`}>{t.zones[z]}</h2>
              <ul>
                {visible
                  .filter((tr) => tr.zone === z)
                  .map((tr) => (
                    <li className="trail-item" key={tr.id}>
                      <button
                        type="button"
                        aria-current={tr.id === selected ? 'true' : undefined}
                        onClick={() => onSelect(tr.id)}
                        onMouseEnter={() => onHover(tr.id)}
                        onMouseLeave={() => onHover(null)}
                        onFocus={() => onHover(tr.id)}
                        onBlur={() => onHover(null)}
                      >
                        <span className="trail-text">
                          <span className="trail-name">{tr.from} → {tr.to}</span>
                          <span className="trail-meta">
                            {[t.destinationOne[tr.destination], tr.difficulty, km(tr.lengthM, lang), `+${tr.upM} m`].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                        <span className="trail-time">
                          {duration(trailTimes(tr, 'average').upMin.estimate)}
                          <small>{t.ascent}</small>
                        </span>
                        <span className="trail-chevron" aria-hidden="true">›</span>
                      </button>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
      </div>
    </nav>
  );
}

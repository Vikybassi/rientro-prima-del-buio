import { useMemo, useState } from 'react';
import type { Destination, TrailSummary, Zone } from '../data/types.ts';
import { duration, km } from '../format.ts';
import type { Lang, Strings } from '../i18n.ts';

type Props = {
  trails: TrailSummary[];
  selected: string | null;
  onSelect: (id: string) => void;
  t: Strings;
  lang: Lang;
};

/** Toglie accenti e maiuscole, così "palu" trova "Palù". */
const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Ordine dei filtri per tipo di meta: prima le mete più cercate. */
const DESTINATION_ORDER: Destination[] = ['hut', 'lake', 'pass', 'bivouac', 'peak', 'alp', 'other'];

/** Un gruppo di pulsanti-filtro: uno solo attivo alla volta, o nessuno (= tutti). */
function Chips<K extends string>({ options, value, onChange, all, label }: {
  options: [K, string][];
  value: K | null;
  onChange: (k: K | null) => void;
  all: string;
  label: string;
}) {
  return (
    <ul className="zones" aria-label={label}>
      <li><button type="button" className="chip" aria-pressed={value === null} onClick={() => onChange(null)}>{all}</button></li>
      {options.map(([k, name]) => (
        <li key={k}>
          <button type="button" className="chip" aria-pressed={value === k} onClick={() => onChange(value === k ? null : k)}>{name}</button>
        </li>
      ))}
    </ul>
  );
}

/** Elenco dei giri raggruppati per zona, con ricerca per nome o numero di sentiero e filtri per zona e tipo di meta. */
export function TrailPicker({ trails, selected, onSelect, t, lang }: Props) {
  const [query, setQuery] = useState('');
  const [zone, setZone] = useState<Zone | null>(null);
  const [destination, setDestination] = useState<Destination | null>(null);

  const zones = useMemo(() => [...new Set(trails.map((tr) => tr.zone))], [trails]);
  const destinations = useMemo(() => DESTINATION_ORDER.filter((d) => trails.some((tr) => tr.destination === d)), [trails]);
  const q = fold(query.trim());
  const visible = trails.filter(
    (tr) =>
      (zone === null || tr.zone === zone) &&
      (destination === null || tr.destination === destination) &&
      fold(`${tr.from} ${tr.to} ${tr.refs.join(' ')}`).includes(q),
  );

  return (
    <nav className="picker" aria-labelledby="pick-title">
      <h2 id="pick-title" className="pick-title">{t.pickTitle}</h2>
      <p className="pick-count">{t.count(trails.length)}</p>
      <label className="sr-only" htmlFor="search">{t.search}</label>
      <input id="search" className="search" type="search" placeholder={t.search} value={query} onChange={(e) => setQuery(e.target.value)} />
      <Chips options={destinations.map((d) => [d, t.destinations[d]])} value={destination} onChange={setDestination} all={t.allDestinations} label={t.allDestinations} />
      <Chips options={zones.map((z) => [z, t.zones[z]])} value={zone} onChange={setZone} all={t.allZones} label={t.allZones} />

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
                    <button type="button" aria-current={tr.id === selected ? 'true' : undefined} onClick={() => onSelect(tr.id)}>
                      <span className="trail-name">{tr.from} → {tr.to}</span>
                      <span className="trail-meta">
                        {[tr.refs.join(' · '), t.difficulty[tr.difficulty], km(tr.lengthM, lang), `+${tr.upM} m`,
                          tr.caiUpMin ? `${t.caiSign} ${duration(tr.caiUpMin)}` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        ))}
    </nav>
  );
}

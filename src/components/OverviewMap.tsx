import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import type { TrailSummary } from '../data/types.ts';
import { trailTimes } from '../engine/plan.ts';
import { duration, km } from '../format.ts';
import type { Lang, Strings } from '../i18n.ts';
import { addTopoLayer, DETAIL_ZOOM, MAP_COLORS } from './topo.ts';

type Shapes = Record<string, [number, number][]>;

type Props = {
  trails: TrailSummary[];
  /** il giro sotto il mouse nell'elenco */
  hovered: string | null;
  /** il giro cliccato sulla mappa, di cui si mostra la scheda */
  peek: string | null;
  onPeek: (id: string | null) => void;
  onSelect: (id: string) => void;
  t: Strings;
  lang: Lang;
};

/** Le tracce semplificate di tutti i giri (public/overview.json, ~40 KB compressi): scaricate una volta sola. */
let shapesRequest: Promise<Shapes> | null = null;
const loadShapes = () => (shapesRequest ??= fetch(`${import.meta.env.BASE_URL}overview.json`).then((r) => r.json() as Promise<Shapes>));

// ogni giro: un bordino chiaro sotto la linea (si stacca da qualunque fondo) e un punto sulla meta
const CASING = { color: MAP_COLORS.halo, weight: 7, opacity: 0.9, interactive: false };
const NORMAL = { color: MAP_COLORS.trail, weight: 3.5, opacity: 0.95 };
const ACTIVE = { color: MAP_COLORS.highlight, weight: 6, opacity: 1 };
const DOT = { radius: 5, color: MAP_COLORS.halo, weight: 2, fillColor: MAP_COLORS.end, fillOpacity: 1 };
const DOT_ACTIVE = { radius: 8, color: MAP_COLORS.halo, weight: 2, fillColor: MAP_COLORS.highlight, fillOpacity: 1 };

type Drawn = { line: L.Polyline; casing: L.Polyline; dot: L.CircleMarker };

/**
 * Tutti i giri sulla mappa: si clicca un tracciato per vedere che sentiero è e aprirne il piano. Mostra gli stessi
 * giri dell'elenco (gli stessi filtri), e accende il giro che nell'elenco è sotto il mouse.
 * Con la tastiera si sceglie dall'elenco: le linee sulla mappa non sono raggiungibili col tasto Tab.
 */
export default function OverviewMap({ trails, hovered, peek, onPeek, onSelect, t, lang }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const drawn = useRef(new Map<string, Drawn>());
  const onPeekRef = useRef(onPeek);
  const [shapes, setShapes] = useState<Shapes | null>(null);

  useEffect(() => {
    onPeekRef.current = onPeek;
  }, [onPeek]);

  useEffect(() => {
    let alive = true;
    loadShapes().then((s) => alive && setShapes(s));
    return () => {
      alive = false;
    };
  }, []);

  // la mappa si crea una volta; il canvas disegna in fretta anche centinaia di linee
  useEffect(() => {
    if (!box.current) return;
    // canvas con tolleranza: sul telefono si prende la linea anche senza centrarla col dito
    const m = L.map(box.current, { renderer: L.canvas({ tolerance: 8 }), zoomSnap: 0.5 }).setView([46.3, 9.9], 9);
    // topografica sbiadita da lontano (i sentieri devono spiccare), a colori pieni da vicino
    addTopoLayer(m);
    const container = box.current;
    const fade = () => container.classList.toggle('map-far', m.getZoom() < DETAIL_ZOOM);
    fade();
    m.on('zoomend', fade);
    layer.current = L.layerGroup().addTo(m);
    m.on('click', () => onPeekRef.current(null)); // clic fuori da un tracciato: si chiude la scheda
    map.current = m;
    // Leaflet misura il contenitore una volta sola: se poi cambia dimensione (la pagina si sta ancora disponendo,
    // il telefono viene girato) la mappa va avvisata, altrimenti inquadra male e lascia zone grigie
    const resize = new ResizeObserver(() => m.invalidateSize());
    resize.observe(box.current);
    return () => {
      resize.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);

  // le linee dei giri visibili, ridisegnate quando cambiano i filtri
  useEffect(() => {
    const m = map.current;
    const group = layer.current;
    if (!m || !group || !shapes) return;
    group.clearLayers();
    drawn.current.clear();
    const open = (id: string) => (e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e);
      onPeekRef.current(id);
    };
    for (const tr of trails) {
      const shape = shapes[tr.id];
      if (!shape) continue;
      const casing = L.polyline(shape, CASING).addTo(group);
      const line = L.polyline(shape, NORMAL).on('click', open(tr.id)).addTo(group);
      const dot = L.circleMarker(shape[shape.length - 1], DOT).on('click', open(tr.id)).addTo(group);
      drawn.current.set(tr.id, { line, casing, dot });
    }
    const bounds = L.featureGroup([...drawn.current.values()].map((d) => d.line)).getBounds();
    m.invalidateSize(); // dimensioni aggiornate prima di calcolare l'inquadratura
    if (bounds.isValid()) m.fitBounds(bounds, { padding: [20, 20], maxZoom: 13 });
  }, [shapes, trails]);

  // il giro evidenziato: quello cliccato o quello sotto il mouse nell'elenco
  useEffect(() => {
    const active = peek ?? hovered;
    for (const [id, d] of drawn.current) {
      d.line.setStyle(id === active ? ACTIVE : NORMAL);
      d.dot.setStyle(id === active ? DOT_ACTIVE : DOT);
    }
    const a = active ? drawn.current.get(active) : undefined;
    if (a) {
      a.casing.bringToFront();
      a.line.bringToFront();
      a.dot.bringToFront();
    }
  }, [peek, hovered, shapes, trails]);

  const peeked = peek ? trails.find((tr) => tr.id === peek) : undefined;
  return (
    <div className="overview">
      <div ref={box} className="overview-map" role="region" aria-label={t.overview.label} />
      {!shapes && <p className="overview-status">{t.overview.loading}</p>}
      {shapes && !peeked && <p className="overview-status">{t.overview.hint}</p>}
      {peeked && (
        <div className="peek" role="dialog" aria-labelledby="peek-title">
          <button type="button" className="peek-close" aria-label={t.overview.close} onClick={() => onPeek(null)}>×</button>
          <p id="peek-title" className="peek-title">{peeked.from} → {peeked.to}</p>
          <p className="peek-meta">
            {[t.destinationOne[peeked.destination], peeked.difficulty, km(peeked.lengthM, lang), `+${peeked.upM} m`,
              `${t.ascent} ${duration(trailTimes(peeked, 'average').upMin.estimate)}`]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <button type="button" className="peek-open" onClick={() => onSelect(peeked.id)}>{t.overview.open} →</button>
        </div>
      )}
    </div>
  );
}

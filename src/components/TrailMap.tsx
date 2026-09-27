import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import type { TrailPoint, TrailSummary } from '../data/types.ts';
import type { StopTime } from '../engine/stops.ts';
import { clock, stopName } from '../format.ts';
import type { Strings } from '../i18n.ts';
import { addTopoLayer, MAP_COLORS } from './topo.ts';

type Props = { trail: TrailSummary; track: TrailPoint[]; stops: StopTime[]; t: Strings };

/**
 * La traccia su mappa topografica (OpenTopoMap: curve di livello e sentieri), con partenza e meta.
 *
 * Il file viene caricato solo quando si apre un giro (vedi PlanView): Leaflet pesa ~150 KB e chi guarda solo
 * l'elenco non deve scaricarlo. Sul telefono la mappa non si trascina con un dito, altrimenti intrappola lo
 * scorrimento della pagina: si ingrandisce con due dita, e la traccia è già tutta inquadrata.
 */
export default function TrailMap({ trail, track, stops, t }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<L.Map | null>(null);

  useEffect(() => {
    if (!box.current) return;
    const touch = window.matchMedia('(pointer: coarse)').matches;
    const map = L.map(box.current, { scrollWheelZoom: false, dragging: !touch, zoomSnap: 0.5 });
    addTopoLayer(map);

    const line = L.polyline(
      track.map(([lat, lon]) => [lat, lon] as [number, number]),
      { color: MAP_COLORS.trail, weight: 4, opacity: 0.9 },
    ).addTo(map);
    // cerchi invece dei segnaposto con immagine: niente file extra da caricare (e niente icone rotte col bundler)
    L.circleMarker(trail.start, { radius: 7, color: MAP_COLORS.halo, weight: 2, fillColor: MAP_COLORS.start, fillOpacity: 1 })
      .bindTooltip(`${t.map.start}: ${trail.from}`)
      .addTo(map);
    L.circleMarker(trail.end, { radius: 7, color: MAP_COLORS.halo, weight: 2, fillColor: MAP_COLORS.end, fillOpacity: 1 })
      .bindTooltip(`${t.map.end}: ${trail.to}`)
      .addTo(map);
    map.fitBounds(line.getBounds(), { padding: [24, 24] });

    setMap(map);
    return () => {
      setMap(null);
      map.remove();
    };
  }, [trail, track, t]);

  // le tappe cambiano orario a ogni scelta (partenza, passo): si ridisegnano solo loro, la mappa resta com'è
  useEffect(() => {
    if (!map) return;
    const layer = L.layerGroup().addTo(map);
    for (const s of stops) {
      const i = track.reduce((best, p, k) => (Math.abs(p[2] - s.d) < Math.abs(track[best][2] - s.d) ? k : best), 0);
      // punti piccoli e chiari, per non confonderli con partenza e meta
      L.circleMarker([track[i][0], track[i][1]], { radius: 5, color: MAP_COLORS.trail, weight: 2, fillColor: MAP_COLORS.halo, fillOpacity: 1 })
        .bindTooltip(`${clock(s.at.estimate)} · ${stopName(s, t)}`)
        .addTo(layer);
    }
    return () => {
      layer.remove();
    };
  }, [map, track, stops, t]);

  return <div ref={box} className="trail-map" role="region" aria-label={t.map.label(trail.from, trail.to)} />;
}

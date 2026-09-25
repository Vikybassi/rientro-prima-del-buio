import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import type { TrailPoint, TrailSummary } from '../data/types.ts';
import type { Strings } from '../i18n.ts';

type Props = { trail: TrailSummary; track: TrailPoint[]; t: Strings };

/**
 * La traccia su mappa topografica (OpenTopoMap: curve di livello e sentieri), con partenza e meta.
 *
 * Il file viene caricato solo quando si apre un giro (vedi PlanView): Leaflet pesa ~150 KB e chi guarda solo
 * l'elenco non deve scaricarlo. Sul telefono la mappa non si trascina con un dito, altrimenti intrappola lo
 * scorrimento della pagina: si ingrandisce con due dita, e la traccia è già tutta inquadrata.
 */
export default function TrailMap({ trail, track, t }: Props) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!box.current) return;
    const touch = window.matchMedia('(pointer: coarse)').matches;
    const map = L.map(box.current, { scrollWheelZoom: false, dragging: !touch, zoomSnap: 0.5 });
    L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · SRTM · stile © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    }).addTo(map);

    const line = L.polyline(
      track.map(([lat, lon]) => [lat, lon] as [number, number]),
      { color: '#2f4a3c', weight: 4, opacity: 0.9 },
    ).addTo(map);
    // cerchi invece dei segnaposto con immagine: niente file extra da caricare (e niente icone rotte col bundler)
    L.circleMarker(trail.start, { radius: 7, color: '#fbfaf6', weight: 2, fillColor: '#2f4a3c', fillOpacity: 1 })
      .bindTooltip(`${t.map.start}: ${trail.from}`)
      .addTo(map);
    L.circleMarker(trail.end, { radius: 7, color: '#fbfaf6', weight: 2, fillColor: '#8c5f3f', fillOpacity: 1 })
      .bindTooltip(`${t.map.end}: ${trail.to}`)
      .addTo(map);
    map.fitBounds(line.getBounds(), { padding: [24, 24] });

    return () => {
      map.remove();
    };
  }, [trail, track, t]);

  return <div ref={box} className="trail-map" role="region" aria-label={t.map.label(trail.from, trail.to)} />;
}

import L from 'leaflet';

/** Colori della mappa, gli stessi del foglio di stile (styles.css): Leaflet vuole i valori, non le variabili CSS. */
export const MAP_COLORS = { trail: '#2f4a3c', highlight: '#c0392b', start: '#2f4a3c', end: '#8c5f3f', halo: '#fbfaf6' };

/** Il fondo topografico di OpenTopoMap (curve di livello, sentieri), con l'attribuzione richiesta dalla licenza. */
export function topoLayer(): L.TileLayer {
  return L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · SRTM · stile © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
  });
}

export function addTopoLayer(map: L.Map): void {
  topoLayer().addTo(map);
}

/**
 * Sotto questo zoom (da una valle intera in su) la topografica è quasi tutta ombreggiatura del rilievo e i sentieri
 * ci sparivano dentro: la mappa d'insieme la sbiadisce (classe CSS `map-far`) e la riporta a colori pieni da vicino.
 * Un fondo chiaro di un altro servizio (CARTO) avrebbe richiesto una chiave d'accesso.
 */
export const DETAIL_ZOOM = 12;

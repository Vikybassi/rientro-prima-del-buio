import type { Destination, TrailSummary, Zone } from './data/types.ts';

/** Ricerca e filtri dell'elenco: valgono anche per la mappa d'insieme, che mostra gli stessi giri. */
export type Filters = { query: string; zone: Zone | null; destination: Destination | null };

export const NO_FILTERS: Filters = { query: '', zone: null, destination: null };

/** Toglie accenti e maiuscole, così "palu" trova "Palù". */
const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function filterTrails(trails: TrailSummary[], { query, zone, destination }: Filters): TrailSummary[] {
  const q = fold(query.trim());
  return trails.filter(
    (tr) =>
      (zone === null || tr.zone === zone) &&
      (destination === null || tr.destination === destination) &&
      (q === '' || fold(`${tr.from} ${tr.to} ${tr.refs.join(' ')}`).includes(q)),
  );
}

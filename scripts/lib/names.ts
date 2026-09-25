import type { Destination } from '../../src/data/types.ts';

/** Nomi che indicano un indirizzo o un edificio, con il luogo vero tra parentesi: "Via Roma (Cepina)". */
const ADDRESS = /^(via|viale|vicolo|piazza|piazzale|strada|s\.?[ps]\.?\s*\d*|parcheggio|chiesa|località|loc\.)\b/i;

/**
 * Nome leggibile di un punto di partenza o di una meta, dai tag OSM scritti a mano:
 * - "Via Roma (Cepina)" → "Cepina": all'escursionista serve il paese, non la via;
 * - "250 - Fusino" → "Fusino": il numero del sentiero da cui si arriva non fa parte del nome;
 * - "Rif. Antonio ed Elia Longoni" → "Rifugio Antonio ed Elia Longoni": niente abbreviazioni;
 * - "DIga di Cancano" → "Diga di Cancano": maiuscole battute due volte.
 */
export function cleanName(raw: string): string {
  let s = raw.trim().replace(/\s+/g, ' ');
  s = s.replace(/^\d+[a-z]?\s*-\s*/i, '');
  s = s.replace(/\(\s*$/, '').trim(); // parentesi aperta e mai chiusa, a fine nome
  const paren = s.match(/^(.*?)\s*\(([^()]+)\)$/);
  if (paren && ADDRESS.test(paren[1])) s = paren[2].trim();
  s = s.replace(/\b([A-Z])([A-Z])([a-zà-ù]{2,})/g, (_, a: string, b: string, rest: string) => a + b.toLowerCase() + rest);
  return s.replace(/^Rif\.\s*/i, 'Rifugio ').replace(/^Biv\.\s*/i, 'Bivacco ');
}

/** Il nome è ancora un indirizzo (una via, una strada statale…)? Allora è meglio il nome della località vicina. */
export const looksLikeAddress = (name: string) => ADDRESS.test(name) || /\(|\)/.test(name) || name === '';

/** Che cosa c'è alla meta, dal suo nome (per i sentieri CAI, dove non abbiamo il tipo del luogo). */
export function destinationOf(name: string): Destination {
  const n = name.toLowerCase();
  if (/\b(rifugio|capanna)\b/.test(n)) return 'hut';
  if (/\bbivacco\b/.test(n)) return 'bivouac';
  if (/\b(lago|laghi|laghetto|laghetti)\b/.test(n)) return 'lake';
  if (/\b(passo|bocchetta|forcella|colle|sella)\b/.test(n)) return 'pass';
  if (/\b(monte|pizzo|cima|punta|corno|sasso|dosso)\b/.test(n)) return 'peak';
  if (/\b(alpe|malga|baita)\b/.test(n)) return 'alp';
  return 'other';
}

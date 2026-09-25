/**
 * I sentieri della v1: salite di giornata verso una meta, scelte tra i candidati di research/candidati.md.
 *
 * `osm` è l'id della relazione su OpenStreetMap (da lì arrivano traccia, numero, difficoltà e tempo CAI).
 * `from` e `to` sono i nomi mostrati nell'app: su OSM i punti di partenza sono a volte indirizzi
 * ("Via Roma (Cepina)"), qui teniamo il nome del luogo. I nomi propri restano uguali in italiano e in inglese.
 *
 * Per aggiungere un sentiero: una riga qui, poi `node scripts/build-trails.ts`.
 */
import type { Zone } from '../src/data/types.ts';

export type TrailConfig = { osm: number; from: string; to: string; zone: Zone };

export const TRAILS: TrailConfig[] = [
  // Valchiavenna
  { osm: 19532067, from: 'Fraciscio', to: 'Alpe Motta', zone: 'valchiavenna' },
  { osm: 11363923, from: 'Macolino', to: 'Passo Sterla Nord', zone: 'valchiavenna' },
  // Bassa Valtellina e Val Masino
  { osm: 7659201, from: 'Poira di Mello', to: 'Bivacco Bottani-Cornaggia', zone: 'bassa-valtellina' },
  { osm: 9962368, from: 'Filorera', to: 'Bivacco Scermenone', zone: 'bassa-valtellina' },
  // Valmalenco
  { osm: 14542056, from: 'Chiesa in Valmalenco', to: 'Alpe Lago', zone: 'valmalenco' },
  { osm: 7609741, from: 'San Giuseppe', to: 'Rifugio Palù', zone: 'valmalenco' },
  { osm: 7328079, from: 'San Giuseppe', to: 'Rifugio Longoni', zone: 'valmalenco' },
  { osm: 7568446, from: 'Chiareggio', to: 'Alpe Fora', zone: 'valmalenco' },
  { osm: 7568285, from: 'Chiareggio', to: 'Passo del Muretto', zone: 'valmalenco' },
  { osm: 6496287, from: 'Campo Franscia', to: 'Passo Confinale', zone: 'valmalenco' },
  // Media Valtellina e Tiranese
  { osm: 6967144, from: 'Palazzina Falk', to: 'Laghi Torena', zone: 'media-valtellina' },
  { osm: 12900464, from: 'Campello', to: "Passo dell'Arasé", zone: 'media-valtellina' },
  { osm: 14469858, from: 'Quattro Rui', to: 'Rifugio Schiazzera', zone: 'media-valtellina' },
  { osm: 14472077, from: 'Ravoledo', to: 'Monte Storile', zone: 'media-valtellina' },
  // Alta Valtellina e Livigno
  { osm: 14481202, from: 'Sondalo', to: 'Passo della Forcola', zone: 'alta-valtellina' },
  { osm: 14481363, from: 'Cepina', to: 'Lago Campaccio', zone: 'alta-valtellina' },
  { osm: 14452620, from: 'Isolaccia', to: 'Bocchetta di Trela', zone: 'alta-valtellina' },
  { osm: 14522887, from: 'Arnoga', to: 'Passo della Val Viola', zone: 'alta-valtellina' },
  { osm: 14452197, from: 'Ponte Calcheira', to: 'Passo Tropione', zone: 'alta-valtellina' },
  { osm: 15003431, from: 'Passo di Gavia', to: 'Monte Gavia', zone: 'alta-valtellina' },
];

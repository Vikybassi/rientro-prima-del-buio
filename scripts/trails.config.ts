/**
 * Nomi delle partenze scelti a mano, quando quello trovato su OSM (il nome della località vicina, o quello della
 * strada che finisce lì) non è quello che usano gli escursionisti, o lo stesso posto compare con più grafie.
 * Chiave: nome su OSM. Valore: nome della partenza nell'app.
 */
export const TRAILHEAD_NAMES: Record<string, string> = {
  // indicazione di chi conosce la valle: la partenza per il Rifugio Ponti è il parcheggio della Piana di Predarossa
  'Strada per Predarossa': 'Piana di Predarossa',
  'Preda Rossa': 'Piana di Predarossa',
};

/**
 * Nomi scelti a mano per alcuni sentieri CAI, al posto di quelli ripuliti in automatico dai tag OSM.
 *
 * Sono i 20 sentieri della prima versione: per questi avevamo già scelto partenza e meta come le direbbe
 * un escursionista ("Rifugio Longoni", non "Rifugio Antonio ed Elia Longoni"). Tutti gli altri sentieri e
 * gli itinerari vengono da scripts/screen-candidates.ts e scripts/build-itineraries.ts; la zona viene
 * dai confini ufficiali delle Comunità Montane (scripts/lib/zones.ts).
 *
 * Chiave: id della relazione su OpenStreetMap.
 */
export const NAME_OVERRIDES: Record<number, { from: string; to: string }> = {
  19532067: { from: 'Fraciscio', to: 'Alpe Motta' },
  11363923: { from: 'Macolino', to: 'Passo Sterla Nord' },
  7659201: { from: 'Poira di Mello', to: 'Bivacco Bottani-Cornaggia' },
  9962368: { from: 'Filorera', to: 'Bivacco Scermenone' },
  14542056: { from: 'Chiesa in Valmalenco', to: 'Alpe Lago' },
  7609741: { from: 'San Giuseppe', to: 'Rifugio Palù' },
  7328079: { from: 'San Giuseppe', to: 'Rifugio Longoni' },
  7568446: { from: 'Chiareggio', to: 'Alpe Fora' },
  7568285: { from: 'Chiareggio', to: 'Passo del Muretto' },
  6496287: { from: 'Campo Franscia', to: 'Passo Confinale' },
  6967144: { from: 'Palazzina Falk', to: 'Laghi Torena' },
  12900464: { from: 'Campello', to: "Passo dell'Arasé" },
  14469858: { from: 'Quattro Rui', to: 'Rifugio Schiazzera' },
  14472077: { from: 'Ravoledo', to: 'Monte Storile' },
  14481202: { from: 'Sondalo', to: 'Passo della Forcola' },
  14481363: { from: 'Cepina', to: 'Lago Campaccio' },
  14452620: { from: 'Isolaccia', to: 'Bocchetta di Trela' },
  14522887: { from: 'Arnoga', to: 'Passo della Val Viola' },
  14452197: { from: 'Ponte Calcheira', to: 'Passo Tropione' },
  15003431: { from: 'Passo di Gavia', to: 'Monte Gavia' },
};

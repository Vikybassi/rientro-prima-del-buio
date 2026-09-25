import type { Destination, Difficulty, Zone } from './data/types.ts';
import type { HazardKind } from './engine/weather.ts';
import type { Pace } from './engine/time.ts';

/**
 * Testi dell'interfaccia. L'inglese deve avere le stesse chiavi dell'italiano: se ne manca una,
 * TypeScript non compila. I nomi dei luoghi restano in italiano in entrambe le lingue.
 *
 * Regola di scrittura: rispondere alla domanda dell'app ("rientro prima del buio?") con parole normali,
 * senza gergo ("caso prudente", "scenario"). Gli orari mostrati sono arrotondati ai 5 minuti: sono stime.
 */
export type Lang = 'it' | 'en';

const it = {
  appName: 'Rientro prima del buio',
  tagline: 'Scegli un sentiero e l\'ora di partenza: ti dico se rientri con la luce.',
  langSwitch: 'English',
  pickTitle: 'Scegli il sentiero',
  count: (n: number) => `${n} giri in Valtellina e Valchiavenna`,
  search: 'Cerca un rifugio, un lago, un paese',
  allZones: 'Tutte le zone',
  allDestinations: 'Tutte le mete',
  destinations: {
    hut: 'Rifugi',
    bivouac: 'Bivacchi',
    lake: 'Laghi',
    pass: 'Passi',
    peak: 'Cime',
    alp: 'Alpeggi',
    other: 'Paesi e altro',
  } satisfies Record<Destination, string>,
  trailRefs: (refs: string[]) => (refs.length === 1 ? `sentiero ${refs[0]}` : `sentieri ${refs.join(', ')}`),
  noResults: 'Nessun sentiero corrisponde alla ricerca.',
  zones: {
    valchiavenna: 'Valchiavenna',
    'bassa-valtellina': 'Bassa Valtellina e Val Masino',
    valmalenco: 'Valmalenco',
    'media-valtellina': 'Media Valtellina e Tiranese',
    'alta-valtellina': 'Alta Valtellina e Livigno',
  } satisfies Record<Zone, string>,
  difficulty: { T: 'turistico', E: 'escursionistico', EE: 'per esperti' } satisfies Record<Difficulty, string>,
  caiSign: 'cartello CAI',
  back: 'Tutti i sentieri',

  when: 'Quando parti?',
  date: 'Giorno',
  start: 'Ora',
  settings: (pace: Pace, stop: number) =>
    `${{ slow: 'Cammini più piano dei tempi dei cartelli', average: 'Cammini come i tempi dei cartelli', fast: 'Cammini più veloce dei tempi dei cartelli' }[pace]}, ${stop ? `sosta di ${stop} min in cima` : 'senza sosta in cima'}`,
  change: 'cambia',
  pace: 'Il tuo passo',
  paces: { slow: 'più piano dei cartelli', average: 'come i cartelli', fast: 'più veloce dei cartelli' } satisfies Record<Pace, string>,
  stop: 'Sosta in cima',
  minutes: (n: number) => (n ? `${n} min` : 'nessuna'),

  answer: {
    ok: 'Sì, rientri con la luce',
    tight: 'Al limite: rientri al tramonto',
    dark: 'No, rientri col buio',
  },
  backLine: (back: string, late: string, sunset: string) =>
    `Sei alla macchina verso le ${back} (alle ${late} se ci metti di più). Il sole tramonta alle ${sunset}.`,
  latest: {
    ok: (t: string) => `Potresti partire anche fino alle ${t}.`,
    late: (t: string) => `Per rientrare con la luce parti entro le ${t}.`,
    tooLong: 'Anche partendo all\'alba rientreresti col buio: in questo periodo il giro è troppo lungo per le ore di luce.',
  },
  startsInDark: 'Parti prima che faccia giorno: il primo tratto è al buio, porta la frontale.',

  dayBar: 'La tua giornata',
  dayBarLabel: (start: string, back: string, late: string, sunset: string, dusk: string) =>
    `Parti alle ${start}, rientri verso le ${back} (al massimo alle ${late}). Il sole tramonta alle ${sunset}, fa buio alle ${dusk}.`,
  bar: {
    latest: (t: string) => `ultima partenza ${t}`,
    start: (t: string) => `parti ${t}`,
    back: (a: string, b: string) => `rientro ${a}–${b}`,
    dark: (t: string) => `buio ${t}`,
  },

  hike: 'Il giro',
  upLine: (d: string, at: string) => `Salita ${d} · in cima alle ${at}`,
  downLine: (d: string, at: string) => `Ritorno ${d} · alla macchina alle ${at}`,
  source: {
    cai: (t: string) => `Tempi dal cartello CAI di questo sentiero (${t} in salita), adattati al tuo passo.`,
    formula: 'Questo sentiero non ha un tempo CAI: tempi stimati con la formula dei club alpini, tarata sui cartelli della Valtellina.',
  },
  itinerary: (refs: string[]) =>
    `Itinerario costruito collegando ${refs.length === 0 ? 'più sentieri' : refs.length === 1 ? `il sentiero ${refs[0]} ad altri tratti` : `i sentieri ${refs.join(', ')}`} della rete CAI. Prima di partire controlla il percorso sulla carta e segui i cartelli sul posto.`,
  unmarked: 'Una parte del percorso segue sentieri non numerati: difficoltà e segnaletica non sono garantite.',
  checkRoad: 'Su OpenStreetMap la strada per la partenza non risulta aperta al traffico: verifica l\'accesso in auto prima di andare.',
  slack: (extra: string) =>
    `Se ci metti di più: fino a ${extra} in più in tutto (succede a un cartello su dieci). La risposta tiene conto di questo. Le soste lungo la strada non sono comprese.`,
  share: 'Copia il link del piano',
  shared: 'Link copiato',
  hazards: {
    thunderstorm: 'temporale',
    rain: 'pioggia probabile',
    wind: 'raffiche forti',
    freezing: 'zero termico sotto la quota',
  } satisfies Record<HazardKind, string>,
  disclaimer: 'Uno strumento per pianificare, non per decidere al posto tuo. In montagna conta quello che vedi: se il tempo cambia, torna indietro.',
  credits: 'Sentieri © OpenStreetMap contributors (ODbL) · quote Copernicus DEM · meteo Open-Meteo · un progetto di',
};

export type Strings = typeof it;

const en: Strings = {
  appName: 'Back before dark',
  tagline: 'Pick a trail and a start time: I\'ll tell you if you\'re back while it\'s still light.',
  langSwitch: 'Italiano',
  pickTitle: 'Pick a trail',
  count: (n) => `${n} hikes in Valtellina and Valchiavenna`,
  search: 'Search a hut, a lake, a village',
  allZones: 'All areas',
  allDestinations: 'All destinations',
  destinations: { hut: 'Huts', bivouac: 'Bivouacs', lake: 'Lakes', pass: 'Passes', peak: 'Peaks', alp: 'Alpine pastures', other: 'Villages and more' },
  trailRefs: (refs) => (refs.length === 1 ? `trail ${refs[0]}` : `trails ${refs.join(', ')}`),
  noResults: 'No trail matches your search.',
  zones: {
    valchiavenna: 'Valchiavenna',
    'bassa-valtellina': 'Lower Valtellina and Val Masino',
    valmalenco: 'Valmalenco',
    'media-valtellina': 'Central Valtellina and Tirano',
    'alta-valtellina': 'Upper Valtellina and Livigno',
  },
  difficulty: { T: 'easy', E: 'hiking', EE: 'experienced hikers' },
  caiSign: 'CAI signpost',
  back: 'All trails',

  when: 'When do you start?',
  date: 'Day',
  start: 'Time',
  settings: (pace, stop) =>
    `${{ slow: 'You walk slower than the signpost times', average: 'You walk like the signpost times', fast: 'You walk faster than the signpost times' }[pace]}, ${stop ? `${stop} min break at the top` : 'no break at the top'}`,
  change: 'change',
  pace: 'Your pace',
  paces: { slow: 'slower than signposts', average: 'like the signposts', fast: 'faster than signposts' },
  stop: 'Break at the top',
  minutes: (n) => (n ? `${n} min` : 'none'),

  answer: {
    ok: 'Yes, you\'re back in daylight',
    tight: 'Cutting it close: back at sunset',
    dark: 'No, you\'d be back after dark',
  },
  backLine: (back, late, sunset) => `You're back at the car around ${back} (${late} if it takes longer). Sunset is at ${sunset}.`,
  latest: {
    ok: (t) => `You could start as late as ${t}.`,
    late: (t) => `To be back in daylight, start by ${t}.`,
    tooLong: 'Even starting at dawn you\'d be back after dark: at this time of year the hike is too long for the daylight.',
  },
  startsInDark: 'You\'d start before daybreak: the first stretch is in the dark, bring a headlamp.',

  dayBar: 'Your day',
  dayBarLabel: (start, back, late, sunset, dusk) =>
    `You start at ${start} and are back around ${back} (${late} at the latest). Sunset at ${sunset}, dark at ${dusk}.`,
  bar: {
    latest: (t) => `latest start ${t}`,
    start: (t) => `start ${t}`,
    back: (a, b) => `back ${a}–${b}`,
    dark: (t) => `dark ${t}`,
  },

  hike: 'The hike',
  upLine: (d, at) => `Ascent ${d} · at the top at ${at}`,
  downLine: (d, at) => `Return ${d} · back at the car at ${at}`,
  source: {
    cai: (t) => `Times from this trail's CAI signpost (${t} up), adjusted to your pace.`,
    formula: 'This trail has no CAI time: estimated with the alpine clubs\' formula, calibrated on Valtellina signposts.',
  },
  itinerary: (refs) =>
    `Route built by linking ${refs.length === 0 ? 'several trails' : refs.length === 1 ? `trail ${refs[0]} with other sections` : `trails ${refs.join(', ')}`} of the CAI network. Before you go, check it on a map and follow the signposts on the ground.`,
  unmarked: 'Part of the route follows unnumbered trails: difficulty and signposting are not guaranteed.',
  checkRoad: 'On OpenStreetMap the road to the start is not marked as open to traffic: check car access before you go.',
  slack: (extra) =>
    `If it takes longer: up to ${extra} more in total (one signpost in ten is that slow). The answer accounts for it. Breaks along the way are not included.`,
  share: 'Copy link to this plan',
  shared: 'Link copied',
  hazards: { thunderstorm: 'thunderstorm', rain: 'rain likely', wind: 'strong gusts', freezing: 'freezing level below you' },
  disclaimer: 'A planning tool, not a decision maker. In the mountains what you see counts: if the weather turns, turn back.',
  credits: 'Trails © OpenStreetMap contributors (ODbL) · elevation Copernicus DEM · weather Open-Meteo · a project by',
};

export const STRINGS: Record<Lang, Strings> = { it, en };

/** Locale per date e numeri: inglese britannico per l'orologio a 24 ore, come in Italia. */
export const LOCALE: Record<Lang, string> = { it: 'it-IT', en: 'en-GB' };

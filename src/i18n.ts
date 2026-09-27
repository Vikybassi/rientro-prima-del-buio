import type { Destination, Difficulty, StopKind, Zone } from './data/types.ts';
import type { Answer } from './engine/plan.ts';
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
  tagline: 'Sentieri della Valtellina: dimmi quando parti, ti dico se torni alla macchina con la luce.',
  tryExample: 'Prova con un esempio',
  langSwitch: 'English',
  pickTitle: '1 · Scegli il giro',
  count: (n: number) => `${n} giri in Valtellina e Valchiavenna`,
  search: 'Cerca un rifugio, un lago, un paese',
  view: { label: 'Come vedere i giri', list: 'Elenco', map: 'Mappa' },
  filterDestination: 'Meta',
  filterZone: 'Zona',
  all: 'tutte',
  ascent: 'salita',
  overview: {
    label: 'Mappa di tutti i giri. Per sceglierne uno con la tastiera usa l\'elenco.',
    loading: 'Carico la mappa…',
    hint: 'Le linee sono i sentieri, i punti le mete: clicca per vedere che giro è.',
    open: 'Apri il piano',
    close: 'Chiudi',
  },
  destinations: {
    hut: 'Rifugi',
    bivouac: 'Bivacchi',
    lake: 'Laghi',
    pass: 'Passi',
    peak: 'Cime',
    alp: 'Alpeggi',
    other: 'Paesi e altro',
  } satisfies Record<Destination, string>,
  destinationOne: { hut: 'Rifugio', bivouac: 'Bivacco', lake: 'Lago', pass: 'Passo', peak: 'Cima', alp: 'Alpeggio', other: '' } satisfies Record<Destination, string>,
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
  back: 'Tutti i giri',

  when: '2 · Quando parti?',
  answerStep: '3 · Rientri prima del buio?',
  date: 'Giorno',
  start: 'Ora',
  pace: 'Il tuo passo',
  paces: { slow: 'più lento', average: 'come i cartelli', fast: 'più veloce' } satisfies Record<Pace, string>,
  paceHint: 'rispetto ai tempi dei cartelli CAI',
  stop: 'Sosta in cima',
  stopOption: (n: number) => (n === 0 ? 'no' : n < 60 ? `${n} min` : n === 60 ? '1 h' : `1 h ${n - 60}`),
  stopHint: 'i tempi dei cartelli non comprendono le soste',

  mode: {
    label: 'Che giro fai?',
    roundTrip: 'Andata e ritorno',
    stay: { hut: 'Dormo al rifugio', bivouac: 'Dormo al bivacco' },
    hint: 'dormendo alla meta conta l\'arrivo, non il rientro',
  },
  answerStepStay: '3 · Arrivi prima del buio?',
  /** "rifugio" o "bivacco", per le frasi del pernotto */
  place: { hut: 'rifugio', bivouac: 'bivacco' },
  stayAnswer: {
    ok: (p: string) => `Sì, arrivi al ${p} con la luce`,
    'ok-weather': () => 'Sì, ma occhio al meteo',
    'weather-no': () => 'Meglio di no: brutto tempo in quota',
    tight: (p: string) => `Al limite: arrivi al ${p} al tramonto`,
    dark: (p: string) => `No, arrivi al ${p} col buio`,
  } satisfies Record<Answer, (p: string) => string>,
  stayLatest: {
    ok: (t: string) => `Potresti partire anche fino alle ${t}.`,
    tight: (t: string) => `Se ci metti di più arrivi senza margine di luce. Per averlo parti entro le ${t}.`,
    dark: (t: string) => `Per arrivare con la luce parti entro le ${t}.`,
  },
  nextDay: (dawn: string, down: string) => `Il giorno dopo fa giorno alle ${dawn}: per tornare alla macchina ti servono circa ${down}.`,
  facts: {
    car: 'Alla macchina',
    at: (p: string) => `Al ${p}`,
    sunset: 'Tramonto',
    spare: 'Luce che ti avanza',
    short: 'Luce che ti manca',
    ifLonger: (t: string) => `o ${t} se ci metti di più`,
    shade: (t: string) => `in ombra dalle ${t}`,
    shadeAll: 'in ombra dal pomeriggio',
  },
  shade: {
    /** where: "Alla partenza" o "Al rifugio" */
    at: (where: string, t: string) =>
      `${where} il sole va dietro le montagne verso le ${t}: da lì sei in ombra e fa più freddo, ma la luce dura fino al tramonto.`,
    all: (where: string) => `${where} il sole è dietro le montagne già dal primo pomeriggio: c'è luce, ma sei in ombra.`,
    start: 'Alla partenza',
  },
  stops: {
    title: 'Le tappe',
    start: 'Partenza',
    top: 'Meta',
    car: 'Alla macchina',
    by: (t: string) => `entro le ${t}`,
    late: (t: string) => `troppo tardi: entro le ${t}`,
    kinds: { hut: 'Rifugio', bivouac: 'Bivacco', lake: 'Lago', pass: 'Passo', peak: 'Cima', alp: 'Alpeggio', water: 'Acqua', viewpoint: 'Panorama' } satisfies Record<StopKind, string>,
    unnamed: { water: 'Fontana', viewpoint: 'Punto panoramico' } as Partial<Record<StopKind, string>>,
    breakAtTop: (m: string) => `sosta ${m}`,
    hint: 'Accanto a ogni tappa: entro che ora esserci per tornare alla macchina con la luce anche se ci metti di più. Se arrivi più tardi, da lì torna indietro.',
    stayHint: 'Orari di arrivo col tuo passo.',
    none: 'Lungo questo giro OpenStreetMap non segna rifugi, alpeggi, laghi o fontane: le tappe sono solo partenza e meta.',
    furthest: (name: string, ele: number, at: string) =>
      `Con la luce arrivi fino a ${name} (${ele} m) verso le ${at}: da lì torna indietro e rientri con margine.`,
  },
  answer: {
    ok: 'Sì, rientri con la luce',
    'ok-weather': 'Sì, ma occhio al meteo',
    'weather-no': 'Meglio di no: brutto tempo in quota',
    tight: 'Al limite: poco margine di luce',
    dark: 'No, rientri col buio',
  } satisfies Record<Answer, string>,
  backLine: (back: string, late: string, sunset: string) =>
    `Sei alla macchina verso le ${back} (alle ${late} se ci metti di più). Il sole tramonta alle ${sunset}.`,
  latest: {
    ok: (t: string) => `Potresti partire anche fino alle ${t}.`,
    tight: (t: string) => `Se ci metti di più non ti resta margine di luce. Per averlo parti entro le ${t}.`,
    dark: (t: string) => `Per rientrare con la luce parti entro le ${t}.`,
    tooLong: (t: string, dawn: string) =>
      `Per avere margine anche se ci metti di più dovresti partire alle ${t}, ma fa giorno alle ${dawn}: in questo periodo il giro è lungo per le ore di luce.`,
  },
  startsInDark: 'Parti prima che faccia giorno: il primo tratto è al buio, porta la frontale.',

  dayBar: 'La tua giornata',
  dayBarLabel: (start: string, back: string, late: string, sunset: string, dusk: string) =>
    `Parti alle ${start}, rientri verso le ${back} (al massimo alle ${late}). Il sole tramonta alle ${sunset}, fa buio alle ${dusk}.`,
  dayBarLabelStay: (start: string, arrive: string, late: string, sunset: string, dusk: string) =>
    `Parti alle ${start}, arrivi verso le ${arrive} (al massimo alle ${late}). Il sole tramonta alle ${sunset}, fa buio alle ${dusk}.`,
  bar: {
    latest: (t: string) => `ultima partenza ${t}`,
    start: (t: string) => `parti ${t}`,
    back: (a: string, b: string) => `rientro ${a}–${b}`,
    arrive: (a: string, b: string) => `arrivo ${a}–${b}`,
    dark: (t: string) => `buio ${t}`,
  },

  hike: 'Il giro',
  upLine: (d: string, at: string) => `Salita ${d} · in cima alle ${at}`,
  downLine: (d: string, at: string) => `Ritorno ${d} · alla macchina alle ${at}`,
  downNextDay: (d: string) => `Discesa il giorno dopo · ${d}`,
  source: {
    cai: (t: string) => `Tempi dal cartello CAI di questo sentiero (${t} in salita), adattati al tuo passo.`,
    formula: 'Questo sentiero non ha un tempo CAI: tempi stimati con la formula dei club alpini, tarata sui cartelli della Valtellina.',
  },
  itinerary: (refs: string[]) =>
    `Itinerario costruito collegando ${refs.length === 0 ? 'sentieri presenti su OpenStreetMap' : refs.length === 1 ? `il sentiero CAI ${refs[0]} ad altri tratti` : `i sentieri CAI ${refs.join(', ')}`}. Prima di partire controlla il percorso sulla carta e segui i cartelli sul posto.`,
  unmarked: 'Una parte del percorso segue sentieri non numerati: difficoltà e segnaletica non sono garantite.',
  checkRoad: 'Su OpenStreetMap la strada per la partenza non risulta aperta al traffico: verifica l\'accesso in auto prima di andare.',
  tollRoad: 'La strada per arrivare alla partenza è a pedaggio.',
  slack: (extra: string) =>
    `Se ci metti di più (stanchezza, imprevisti) contiamo fino a ${extra} in più in tutto: la risposta tiene conto anche di questo. Le soste lungo la strada non sono comprese.`,
  share: 'Copia il link del piano',
  shared: 'Link copiato',
  profile: {
    title: 'Dove sarai, ora per ora',
    label: (from: string, fromEle: number, to: string, toEle: number, at: string) =>
      `Profilo della salita da ${from} (${fromEle} m) a ${to} (${toEle} m): in cima verso le ${at}.`,
  },
  map: {
    title: 'Il percorso',
    start: 'Partenza',
    end: 'Meta',
    label: (from: string, to: string) => `Mappa del percorso da ${from} a ${to}`,
    loading: 'Carico la mappa…',
    directions: 'Indicazioni stradali per la partenza',
    osm: 'Apri su OpenStreetMap',
  },
  weather: {
    title: 'Meteo nelle ore del giro',
    loading: 'Carico le previsioni…',
    none: 'Nessun avviso per le ore e le quote in cui sarai sul sentiero.',
    summit: (at: string, temp: number, gusts: number) => `In cima verso le ${at}: ${temp} °C, raffiche fino a ${gusts} km/h.`,
    tooFar: (day: string) => `Le previsioni arrivano 16 giorni prima: per ${day} ricontrolla più avanti.`,
    past: 'È una data passata: niente previsioni.',
    error: 'Previsioni non disponibili in questo momento: controlla il meteo prima di partire.',
    source: 'Previsioni orarie Open-Meteo alla partenza e alla meta, ognuna alla sua quota.',
    offline: 'Sei offline: queste sono le previsioni scaricate l\'ultima volta che hai aperto questo giro. Ricontrollale appena hai campo.',
    thunderstorm: (t: string) => `Temporale previsto verso le ${t}, mentre sei sul sentiero.`,
    stormRisk: (t: string) => `Condizioni da temporale verso le ${t}: in quota non farti sorprendere.`,
    rain: (t: string, p: number) => `Pioggia probabile (${p}%) verso le ${t}.`,
    wind: (t: string, kmh: number) => `Raffiche fino a ${kmh} km/h verso le ${t}.`,
    freezing: (t: string, m: number) => `Zero termico a ${m} m verso le ${t}: possibile ghiaccio o neve sul sentiero.`,
  },
  offline: 'Sei offline: funzionano i giri che hai già aperto con la rete.',
  disclaimer: 'Uno strumento per pianificare, non per decidere al posto tuo. In montagna conta quello che vedi: se il tempo cambia, torna indietro.',
  credits: 'Sentieri © OpenStreetMap contributors (ODbL) · mappe OpenTopoMap · quote Copernicus DEM · meteo Open-Meteo · un progetto di',
};

export type Strings = typeof it;

const en: Strings = {
  appName: 'Back before dark',
  tagline: 'Trails in Valtellina: tell me when you start, I\'ll tell you if you\'re back at the car in daylight.',
  tryExample: 'Try an example',
  langSwitch: 'Italiano',
  pickTitle: '1 · Pick a hike',
  count: (n) => `${n} hikes in Valtellina and Valchiavenna`,
  search: 'Search a hut, a lake, a village',
  view: { label: 'How to browse the hikes', list: 'List', map: 'Map' },
  filterDestination: 'Destination',
  filterZone: 'Area',
  all: 'all',
  ascent: 'up',
  overview: {
    label: 'Map of all hikes. To pick one with the keyboard, use the list.',
    loading: 'Loading the map…',
    hint: 'Lines are trails, dots are destinations: click one to see which hike it is.',
    open: 'Open the plan',
    close: 'Close',
  },
  destinations: { hut: 'Huts', bivouac: 'Bivouacs', lake: 'Lakes', pass: 'Passes', peak: 'Peaks', alp: 'Alpine pastures', other: 'Villages and more' },
  destinationOne: { hut: 'Hut', bivouac: 'Bivouac', lake: 'Lake', pass: 'Pass', peak: 'Peak', alp: 'Alpine pasture', other: '' },
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
  back: 'All hikes',

  when: '2 · When do you start?',
  answerStep: '3 · Back before dark?',
  date: 'Day',
  start: 'Time',
  pace: 'Your pace',
  paces: { slow: 'slower', average: 'like signposts', fast: 'faster' },
  paceHint: 'compared with CAI signpost times',
  stop: 'Break at the top',
  stopOption: (n) => (n === 0 ? 'none' : n < 60 ? `${n} min` : n === 60 ? '1 h' : `1 h ${n - 60}`),
  stopHint: 'signpost times don\'t include breaks',

  mode: {
    label: 'What kind of trip?',
    roundTrip: 'Round trip',
    stay: { hut: 'I sleep at the hut', bivouac: 'I sleep at the bivouac' },
    hint: 'sleeping there, what counts is arriving, not getting back',
  },
  answerStepStay: '3 · Do you arrive before dark?',
  place: { hut: 'hut', bivouac: 'bivouac' },
  stayAnswer: {
    ok: (p) => `Yes, you reach the ${p} in daylight`,
    'ok-weather': () => 'Yes, but watch the weather',
    'weather-no': () => 'Better not: bad weather up high',
    tight: (p) => `Cutting it close: you reach the ${p} at sunset`,
    dark: (p) => `No, you'd reach the ${p} after dark`,
  },
  stayLatest: {
    ok: (t) => `You could start as late as ${t}.`,
    tight: (t) => `If it takes longer you'll arrive with no daylight to spare. To keep a margin, start by ${t}.`,
    dark: (t) => `To arrive in daylight, start by ${t}.`,
  },
  nextDay: (dawn, down) => `The next day it gets light at ${dawn}: going back to the car takes about ${down}.`,
  facts: {
    car: 'Back at the car',
    at: (p) => `At the ${p}`,
    sunset: 'Sunset',
    spare: 'Daylight to spare',
    short: 'Daylight missing',
    ifLonger: (t) => `or ${t} if it takes longer`,
    shade: (t) => `in shade from ${t}`,
    shadeAll: 'in shade all afternoon',
  },
  shade: {
    at: (where, t) => `${where} the sun goes behind the mountains around ${t}: from then on you're in the shade and it gets colder, but the daylight lasts until sunset.`,
    all: (where) => `${where} the sun is behind the mountains from early afternoon: there's daylight, but you're in the shade.`,
    start: 'At the start',
  },
  stops: {
    title: 'Along the way',
    start: 'Start',
    top: 'Destination',
    car: 'Back at the car',
    by: (t) => `by ${t}`,
    late: (t) => `too late: by ${t}`,
    kinds: { hut: 'Hut', bivouac: 'Bivouac', lake: 'Lake', pass: 'Pass', peak: 'Peak', alp: 'Alpine pasture', water: 'Water', viewpoint: 'Viewpoint' },
    unnamed: { water: 'Fountain', viewpoint: 'Viewpoint' },
    breakAtTop: (m) => `${m} break`,
    hint: 'Next to each stop: the time to be there by to get back to the car in daylight even if it takes longer. If you arrive later, turn back from there.',
    stayHint: 'Arrival times at your pace.',
    none: 'OpenStreetMap shows no huts, pastures, lakes or fountains along this route: the only stops are the start and the destination.',
    furthest: (name, ele, at) => `In daylight you can get as far as ${name} (${ele} m) around ${at}: turn back from there and you're back with time to spare.`,
  },
  answer: {
    ok: 'Yes, you\'re back in daylight',
    'ok-weather': 'Yes, but watch the weather',
    'weather-no': 'Better not: bad weather up high',
    tight: 'Cutting it close: little daylight to spare',
    dark: 'No, you\'d be back after dark',
  },
  backLine: (back, late, sunset) => `You're back at the car around ${back} (${late} if it takes longer). Sunset is at ${sunset}.`,
  latest: {
    ok: (t) => `You could start as late as ${t}.`,
    tight: (t) => `If it takes longer you'll have no daylight to spare. To keep a margin, start by ${t}.`,
    dark: (t) => `To be back in daylight, start by ${t}.`,
    tooLong: (t, dawn) =>
      `To have a margin if it takes longer you'd need to start at ${t}, but it only gets light at ${dawn}: at this time of year the hike is long for the daylight.`,
  },
  startsInDark: 'You\'d start before daybreak: the first stretch is in the dark, bring a headlamp.',

  dayBar: 'Your day',
  dayBarLabel: (start, back, late, sunset, dusk) =>
    `You start at ${start} and are back around ${back} (${late} at the latest). Sunset at ${sunset}, dark at ${dusk}.`,
  dayBarLabelStay: (start, arrive, late, sunset, dusk) =>
    `You start at ${start} and arrive around ${arrive} (${late} at the latest). Sunset at ${sunset}, dark at ${dusk}.`,
  bar: {
    latest: (t) => `latest start ${t}`,
    start: (t) => `start ${t}`,
    back: (a, b) => `back ${a}–${b}`,
    arrive: (a, b) => `arrive ${a}–${b}`,
    dark: (t) => `dark ${t}`,
  },

  hike: 'The hike',
  upLine: (d, at) => `Ascent ${d} · at the top at ${at}`,
  downLine: (d, at) => `Return ${d} · back at the car at ${at}`,
  downNextDay: (d) => `Descent the next day · ${d}`,
  source: {
    cai: (t) => `Times from this trail's CAI signpost (${t} up), adjusted to your pace.`,
    formula: 'This trail has no CAI time: estimated with the alpine clubs\' formula, calibrated on Valtellina signposts.',
  },
  itinerary: (refs) =>
    `Route built by linking ${refs.length === 0 ? 'trails mapped on OpenStreetMap' : refs.length === 1 ? `CAI trail ${refs[0]} with other sections` : `CAI trails ${refs.join(', ')}`}. Before you go, check it on a map and follow the signposts on the ground.`,
  unmarked: 'Part of the route follows unnumbered trails: difficulty and signposting are not guaranteed.',
  checkRoad: 'On OpenStreetMap the road to the start is not marked as open to traffic: check car access before you go.',
  tollRoad: 'The road to the start is a toll road.',
  slack: (extra) =>
    `If it takes longer (fatigue, the unexpected) we allow up to ${extra} more in total, and the answer accounts for it. Breaks along the way are not included.`,
  share: 'Copy link to this plan',
  shared: 'Link copied',
  profile: {
    title: 'Where you\'ll be, hour by hour',
    label: (from, fromEle, to, toEle, at) => `Ascent profile from ${from} (${fromEle} m) to ${to} (${toEle} m): at the top around ${at}.`,
  },
  map: {
    title: 'The route',
    start: 'Start',
    end: 'Destination',
    label: (from, to) => `Map of the route from ${from} to ${to}`,
    loading: 'Loading the map…',
    directions: 'Driving directions to the start',
    osm: 'Open in OpenStreetMap',
  },
  weather: {
    title: 'Weather during your hike',
    loading: 'Loading the forecast…',
    none: 'No warnings for the hours and altitudes you\'ll be on the trail.',
    summit: (at, temp, gusts) => `At the top around ${at}: ${temp} °C, gusts up to ${gusts} km/h.`,
    tooFar: (day) => `Forecasts are available 16 days ahead: check back later for ${day}.`,
    past: 'That date is in the past: no forecast.',
    error: 'Forecast not available right now: check the weather before you go.',
    source: 'Hourly Open-Meteo forecasts at the start and at the top, each at its own altitude.',
    offline: 'You\'re offline: this is the forecast downloaded the last time you opened this hike. Check it again when you have signal.',
    thunderstorm: (t) => `Thunderstorm expected around ${t}, while you're on the trail.`,
    stormRisk: (t) => `Thunderstorm conditions around ${t}: don't get caught up high.`,
    rain: (t, p) => `Rain likely (${p}%) around ${t}.`,
    wind: (t, kmh) => `Gusts up to ${kmh} km/h around ${t}.`,
    freezing: (t, m) => `Freezing level at ${m} m around ${t}: possible ice or snow on the trail.`,
  },
  offline: 'You\'re offline: hikes you already opened with a connection still work.',
  disclaimer: 'A planning tool, not a decision maker. In the mountains what you see counts: if the weather turns, turn back.',
  credits: 'Trails © OpenStreetMap contributors (ODbL) · maps OpenTopoMap · elevation Copernicus DEM · weather Open-Meteo · a project by',
};

export const STRINGS: Record<Lang, Strings> = { it, en };

/** Locale per date e numeri: inglese britannico per l'orologio a 24 ore, come in Italia. */
export const LOCALE: Record<Lang, string> = { it: 'it-IT', en: 'en-GB' };

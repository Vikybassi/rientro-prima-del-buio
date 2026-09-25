/**
 * Scarica le strade percorribili in macchina della provincia di Sondrio (data-cache/roads.json).
 * Servono a decidere dove può iniziare un itinerario: un parcheggio o un paese contano come partenza
 * solo se c'è una strada aperta al traffico a pochi passi.
 *
 * - Strade normali: tenute, tranne quelle con accesso vietato, privato, agricolo, forestale o su permesso
 *   (chi non ha il permesso resterebbe senza partenza). "destination" invece va bene: un parcheggio per
 *   escursionisti è proprio una destinazione.
 * - Piste (highway=track): in Valtellina sono spesso strade agro-silvo-pastorali chiuse al traffico, quindi le
 *   teniamo solo se sono esplicitamente aperte alle auto. Senza questa eccezione sparivano partenze vere come
 *   Palazzina Falk (Val Belviso) e Campello (Val Fontana), che si raggiungono su piste con motor_vehicle=yes.
 *
 * Uso: node scripts/prefetch-roads.ts
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { overpass } from './lib/overpass.ts';

const QUERY = `[out:json][timeout:300];
area["name"="Sondrio"]["admin_level"="6"]->.a;
(
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service)$"]
    ["access"!~"^(no|private|agricultural|forestry|permit)$"]
    ["motor_vehicle"!~"^(no|private|agricultural|forestry|permit)$"]
    (area.a);
  way["highway"="track"]["access"!~"^(no|private|agricultural|forestry|permit)$"]
    [~"^(motor_vehicle|motorcar)$"~"^(yes|designated|destination)$"]
    (area.a);
  way["highway"="track"]["access"~"^(yes|destination)$"]["motor_vehicle"!~"^(no|private|agricultural|forestry|permit)$"]
    (area.a);
);
out geom qt;`;

const data = await overpass<{ elements: { geometry: { lat: number; lon: number }[] }[] }>(QUERY);
// teniamo solo le coordinate: tipo e nome della strada non servono
const roads = data.elements.map((w) => w.geometry.map((p) => [p.lat, p.lon]));
// in provincia ce ne sono circa 16.000: molte meno vuol dire una risposta incompleta, meglio non sovrascrivere
if (roads.length < 10_000) throw new Error(`Solo ${roads.length} strade: risposta incompleta, non salvo niente`);
await mkdir('data-cache', { recursive: true });
await writeFile('data-cache/roads.json', JSON.stringify(roads));
console.log(`Salvate ${roads.length} strade in data-cache/roads.json`);

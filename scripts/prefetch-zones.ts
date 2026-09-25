/**
 * Confini delle zone dell'app, presi dai confini amministrativi ufficiali su OSM:
 * le 5 Comunità Montane della provincia (admin_level 7) e i 5 comuni della Valmalenco (admin_level 8),
 * che nell'app hanno una zona a sé. Salva data-cache/zones.json.
 *
 * Uso: node scripts/prefetch-zones.ts
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { overpass } from './lib/overpass.ts';
import { VALMALENCO } from './lib/zones.ts';

type Rel = { tags: Record<string, string>; members: { type: string; role: string; geometry?: { lat: number; lon: number }[] }[] };
const { elements } = await overpass<{ elements: Rel[] }>(`[out:json][timeout:300];
area["name"="Sondrio"]["admin_level"="6"]->.a;
(
  relation["boundary"="administrative"]["admin_level"="7"]["name"~"Comunit.* montana",i](area.a);
  relation["boundary"="administrative"]["admin_level"="8"]["name"~"^(${VALMALENCO.join('|')})$"](area.a);
);
out geom;`);

// per il test "punto nel poligono" bastano i segmenti del bordo esterno, in qualunque ordine
const zones = elements.map((r) => ({
  name: r.tags.name,
  level: Number(r.tags.admin_level),
  lines: r.members
    .filter((m) => m.type === 'way' && m.role === 'outer' && m.geometry)
    .map((m) => m.geometry!.map((p) => [p.lat, p.lon])),
}));
await mkdir('data-cache', { recursive: true });
await writeFile('data-cache/zones.json', JSON.stringify(zones));
console.log(zones.map((z) => `${z.name} (livello ${z.level}, ${z.lines.length} tratti di confine)`).join('\n'));

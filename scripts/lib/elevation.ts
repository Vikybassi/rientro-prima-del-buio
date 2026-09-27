import { fromFile } from 'geotiff';
import type { LatLon } from './geo.ts';

/**
 * Quote dal modello del terreno Copernicus GLO-30 (celle da 1" d'arco, circa 30 m), letto in locale.
 *
 * All'inizio usavamo l'API di Open-Meteo, che però serve il GLO-90 (celle da 90 m) e, nella versione gratuita,
 * conta ogni punto come una richiesta: con un centinaio di sentieri si esauriva il limite orario e giornaliero.
 * Le tessere GLO-30 sono pubbliche (AWS Open Data): si scaricano una volta con `scripts/download-dem.sh`
 * in data-cache/dem/ e non ci sono più limiti. Nota: è un modello di *superficie* (DSM), quindi nel bosco
 * misura la cima degli alberi; sopra i 1800-2000 m, dove passano quasi tutti questi sentieri, conta poco.
 *
 * © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS
 * by the European Union and ESA; all rights reserved.
 */

type Tile = { data: Float32Array; width: number; height: number; west: number; north: number; dx: number; dy: number };

const tiles = new Map<string, Promise<Tile>>();

/** Nome della tessera che contiene il punto: una per grado di latitudine e longitudine (es. N46…E009). */
function tileName(lat: number, lon: number): string {
  const la = Math.floor(lat);
  const lo = Math.floor(lon);
  const ns = `${la >= 0 ? 'N' : 'S'}${String(Math.abs(la)).padStart(2, '0')}_00`;
  const ew = `${lo >= 0 ? 'E' : 'W'}${String(Math.abs(lo)).padStart(3, '0')}_00`;
  return `Copernicus_DSM_COG_10_${ns}_${ew}_DEM`;
}

async function loadTile(name: string): Promise<Tile> {
  const tiff = await fromFile(`data-cache/dem/${name}.tif`).catch(() => {
    throw new Error(`Manca la tessera ${name}: lancia scripts/download-dem.sh`);
  });
  const image = await tiff.getImage();
  const [west, south, east, north] = image.getBoundingBox();
  const width = image.getWidth();
  const height = image.getHeight();
  const [data] = (await image.readRasters()) as unknown as [Float32Array];
  return { data, width, height, west, north, dx: (east - west) / width, dy: (north - south) / height };
}

function tileFor(lat: number, lon: number): Promise<Tile> {
  const name = tileName(lat, lon);
  if (!tiles.has(name)) tiles.set(name, loadTile(name));
  return tiles.get(name)!;
}

/** Quota in un punto, interpolando tra i centri delle 4 celle vicine (bilineare): niente "scalini" tra una cella e l'altra. */
function sample(t: Tile, lat: number, lon: number): number {
  const x = (lon - t.west) / t.dx - 0.5;
  const y = (t.north - lat) / t.dy - 0.5;
  const x0 = Math.max(0, Math.min(t.width - 2, Math.floor(x)));
  const y0 = Math.max(0, Math.min(t.height - 2, Math.floor(y)));
  const fx = Math.min(1, Math.max(0, x - x0));
  const fy = Math.min(1, Math.max(0, y - y0));
  const at = (cx: number, cy: number) => t.data[cy * t.width + cx];
  const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx;
  const bottom = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx;
  return top * (1 - fy) + bottom * fy;
}

export async function sampleElevations(points: LatLon[]): Promise<number[]> {
  const out: number[] = [];
  for (const [lat, lon] of points) out.push(sample(await tileFor(lat, lon), lat, lon));
  return out;
}

/**
 * Quota letta in modo sincrono, per chi ne chiede milioni (l'orizzonte di scripts/add-horizon.ts): carica prima
 * tutte le tessere presenti in data-cache/dem/. Fuori dalle tessere restituisce NaN.
 */
export async function loadSampler(): Promise<(lat: number, lon: number) => number> {
  const { readdir } = await import('node:fs/promises');
  const names = (await readdir('data-cache/dem')).filter((f) => f.endsWith('.tif')).map((f) => f.slice(0, -4));
  const loaded = new Map<string, Tile>();
  for (const name of names) loaded.set(name, await tileFor(...latLonOf(name)));
  return (lat, lon) => {
    const t = loaded.get(tileName(lat, lon));
    return t ? sample(t, lat, lon) : NaN;
  };
}

/** Un punto dentro la tessera col nome dato (il suo angolo sud-ovest, spostato un poco verso l'interno). */
function latLonOf(name: string): [number, number] {
  const m = /_([NS])(\d{2})_00_([EW])(\d{3})_00_/.exec(name);
  if (!m) throw new Error(`Nome di tessera inatteso: ${name}`);
  const lat = Number(m[2]) * (m[1] === 'N' ? 1 : -1);
  const lon = Number(m[4]) * (m[3] === 'E' ? 1 : -1);
  return [lat + 0.5, lon + 0.5];
}

/**
 * Dislivello positivo e negativo, ignorando le oscillazioni più piccole di `threshold` metri (isteresi).
 *
 * Il modello del terreno ha un rumore di qualche metro: sommando ogni saliscendi il dislivello si gonfia
 * (sul sentiero 331: 1179 m calcolati contro 1021 m del rilievo CAI). Con l'isteresi una variazione conta
 * solo quando ci si è allontanati di almeno `threshold` metri dall'ultima quota "accettata".
 */
export function climb(ele: number[], threshold: number): { up: number; down: number } {
  let up = 0;
  let down = 0;
  let ref = ele[0];
  for (const z of ele.slice(1)) {
    if (z - ref >= threshold) {
      up += z - ref;
      ref = z;
    } else if (ref - z >= threshold) {
      down += ref - z;
      ref = z;
    }
  }
  // l'ultimo tratto sotto soglia conta comunque, così salita − discesa = arrivo − partenza
  const last = ele[ele.length - 1];
  if (last > ref) up += last - ref;
  else down += ref - last;
  return { up, down };
}

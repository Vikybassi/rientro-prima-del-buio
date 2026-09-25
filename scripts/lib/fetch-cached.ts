import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/** I servizi pubblici (OSM, Nominatim) chiedono di identificarsi: niente user agent generici. */
const USER_AGENT = 'rientro-prima-del-buio/0.1 (progetto portfolio; https://github.com/Vikybassi)';

/**
 * Pausa minima tra due richieste allo stesso servizio, secondo le loro regole d'uso:
 * Nominatim vuole al massimo 1 richiesta al secondo, l'API di OSM chiede di non martellarla.
 */
const MIN_INTERVAL_MS: Record<string, number> = {
  'api.openstreetmap.org': 1000,
  'nominatim.openstreetmap.org': 1100,
  // la versione gratuita di Open-Meteo pesa ogni coordinata: 100 punti per richiesta esauriscono presto il limite al minuto
  'api.open-meteo.com': 1000,
};

const lastCall = new Map<string, number>();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function politeFetch(url: string): Promise<unknown> {
  const host = new URL(url).host;
  for (let attempt = 1; ; attempt++) {
    const wait = (lastCall.get(host) ?? 0) + (MIN_INTERVAL_MS[host] ?? 500) - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall.set(host, Date.now());
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (res.ok) return res.json();
    // 429 = troppe richieste: il limite si azzera dopo un po', quindi aspettiamo quanto chiede il servizio (o un minuto)
    if (res.status === 429 && attempt < 6) {
      const retryAfter = Number(res.headers.get('retry-after'));
      const ms = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 61_000;
      console.log(`  ${host}: troppe richieste, attendo ${Math.round(ms / 1000)} s`);
      await sleep(ms);
      continue;
    }
    // gli errori 5xx sono spesso temporanei: riprova con attese crescenti
    if (res.status >= 500 && attempt < 4) {
      await sleep(2000 * attempt);
      continue;
    }
    throw new Error(`${res.status} da ${host}`);
  }
}

/**
 * Scarica un JSON una volta sola e lo salva in `data-cache/`: rilanciare lo script non rifà le richieste
 * (più veloce, e non pesa sui servizi gratuiti). Per riscaricare basta cancellare il file.
 */
export async function fetchJsonCached<T>(cacheFile: string, url: string): Promise<T> {
  const path = `data-cache/${cacheFile}`;
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    const data = await politeFetch(url);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(data));
    return data as T;
  }
}

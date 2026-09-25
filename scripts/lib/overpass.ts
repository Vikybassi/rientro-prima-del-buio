/**
 * Una richiesta a Overpass (il servizio di interrogazione di OpenStreetMap), provando più server:
 * quello principale è spesso sovraccarico (504) e i mirror a volte non rispondono.
 */
const SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

export async function overpass<T>(query: string): Promise<T> {
  for (let round = 1; round <= 2; round++) {
    for (const server of SERVERS) {
      try {
        const res = await fetch(server, {
          method: 'POST',
          headers: { 'User-Agent': 'rientro-prima-del-buio/0.1 (progetto portfolio)', 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.timeout(330_000),
        });
        if (res.ok) {
          const data = (await res.json()) as T & { remark?: string };
          // Quando la richiesta scade Overpass risponde comunque 200, con dati vuoti o a metà e un avviso in "remark".
          // Una risposta così va trattata come un errore: una volta ci ha fatto salvare 0 strade.
          if (data.remark && /error|timed out|timeout/i.test(data.remark)) {
            console.log(`  ${new URL(server).host}: ${data.remark}`);
            continue;
          }
          return data;
        }
        console.log(`  ${new URL(server).host}: ${res.status}`);
      } catch (err) {
        console.log(`  ${new URL(server).host}: ${(err as Error).name}`);
      }
    }
    if (round === 1) {
      console.log('  nessun server disponibile, riprovo tra un minuto');
      await new Promise((r) => setTimeout(r, 60_000));
    }
  }
  throw new Error('Nessun server Overpass ha risposto: riprova più tardi');
}

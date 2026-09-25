# Rientro prima del buio

Scegli un giro in Valtellina, il giorno e l'ora in cui parti: l'app ti dice se torni alla macchina con la luce, a che ora arrivi alla meta, quando tramonta il sole e che tempo fa alle quote in cui sarai.

**Provala: [rientro-prima-del-buio.netlify.app](https://rientro-prima-del-buio.netlify.app)**

> **In English** — *Back before dark* is a web app for day hikes in Valtellina (Italian Alps). Pick one of 362 hikes, a date and a start time: it tells you whether you'll be back at the car before dark, with arrival times, sunset and the hourly forecast at the altitudes you'll be walking. Hikes are built from OpenStreetMap trail data and a 30 m terrain model; walking times start from the official CAI signpost times where they exist, otherwise from the DIN 33466 formula calibrated on those signposts. React + TypeScript, no backend, installable and usable offline. The interface is in Italian and English.

![La pagina iniziale: elenco dei giri e mappa della provincia con tutti i tracciati](docs/screenshots/home-desktop.jpg)

<img src="docs/screenshots/plan-mobile.jpg" alt="Su telefono: la risposta, la barra della giornata, il meteo e il profilo del giro" width="300" align="right">

## Cosa fa

- **362 giri** in Valtellina e Valchiavenna, verso rifugi, bivacchi, laghi, passi e alpeggi, ognuno con partenza da un posto dove si arriva in macchina.
- **La risposta in una frase**: sì, rientri con la luce; al limite; no, rientri col buio. Con l'ultima ora a cui puoi ancora partire.
- **La giornata su una barra**: partenza, rientro, tramonto, fine del crepuscolo.
- **Il meteo nelle ore del giro**, alla quota della partenza e a quella della meta: temporali, pioggia, raffiche di vento, zero termico sotto la quota.
- **Il profilo del percorso** con l'ora a cui passi, e la mappa del tracciato.
- **Il tuo passo** (più piano, come o più veloce dei cartelli) e la sosta alla meta.
- **Link condivisibile**: giro, giorno, ora e passo stanno nell'indirizzo.
- **Funziona senza campo**: si installa sul telefono; i giri aperti a casa restano disponibili in montagna, con l'ultima previsione salvata.

<br clear="right">

## Come ragiona

**I giri.** Su OpenStreetMap la rete dei sentieri CAI della provincia di Sondrio è salvata a tratti, da un incrocio all'altro: dei 727 sentieri con nome, 561 iniziano o finiscono a un innesto. Per questo i giri nascono in due modi:

1. i **sentieri CAI interi** che da soli fanno una gita di giornata (42), con il tempo del cartello quando c'è;
2. gli **itinerari verso le mete** (320): tutta la rete diventa un grafo e per ogni meta si cerca il percorso più breve da un punto di partenza raggiungibile in macchina. I sentieri non numerati entrano solo dove la rete ha dei buchi e "costano" di più, così l'itinerario usa i sentieri segnati quando ci sono.

Una partenza vale solo se a pochi passi c'è una strada aperta al traffico: niente piste forestali chiuse o strade su permesso. Le strade a pedaggio e quelle da verificare sono segnalate.

**Le quote** vengono dal modello del terreno Copernicus GLO-30 (un punto ogni 30 m). Il dislivello si calcola ignorando le oscillazioni sotto i 5 m, una soglia tarata sui dislivelli ufficiali CAI: l'errore mediano è del 3%.

**I tempi.** Dove il sentiero ha il tempo del cartello CAI, si parte da quello. Altrimenti si usa la formula DIN 33466, corretta confrontandola con i tempi CAI di tutta la provincia: in mediana i cartelli sono il 10% più veloci della formula. Ogni tempo ha anche una versione prudente, più lunga del 26%: tanto quanto è più lento un cartello su dieci. La risposta si basa su quella.

**La luce.** Tramonto e fine del crepuscolo si calcolano per il punto di partenza e il giorno scelto, nel fuso di Roma. Se con il tempo prudente sei alla macchina almeno 30 minuti prima del tramonto, la risposta è sì; se arrivi più tardi ma prima del buio, è al limite; dopo, è no.

**Il meteo** arriva da Open-Meteo, ora per ora, per la partenza e per la meta alla loro quota. Un temporale previsto o raffiche oltre gli 80 km/h nelle ore del giro cambiano la risposta in "meglio di no", anche con tutta la luce del mondo; pioggia probabile, vento forte e zero termico basso sono avvisi. Le previsioni coprono i prossimi 16 giorni; per le date più lontane l'app lo dice.

## Com'è fatta

- **App**: React 19, TypeScript, Vite. Nessun server: i dati dei giri sono file statici, il meteo arriva direttamente dal browser.
- **Mappe**: Leaflet con le carte di OpenTopoMap, caricate solo quando servono.
- **Sole**: [suncalc](https://github.com/mourner/suncalc).
- **Offline**: service worker generato da Workbox (vite-plugin-pwa). L'app e la mappa d'insieme si salvano alla prima visita, le tracce quando si aprono, e della mappa solo i riquadri già visti: le regole d'uso di OpenTopoMap vietano di scaricarli in blocco.
- **Test**: 85 test (Vitest) sul motore dei tempi, della luce e del meteo, sui filtri e sui formati.

```
src/engine/      tempi, sole, meteo e risposta (logica pura, testata)
src/components/  interfaccia
scripts/         costruzione dei giri da OpenStreetMap e dal modello del terreno
research/        appunti e verifiche fatte durante lo sviluppo
```

### Avviarla

```bash
npm install
npm run dev
```

Altri comandi: `npm test`, `npm run lint`, `npm run build`.

### Rigenerare i giri

I dati pronti sono già nel repository (`src/data/trails.json`, `public/trails/`). Per ricostruirli da zero servono circa 170 MB di modello del terreno e qualche minuto di richieste a Overpass:

```bash
sh scripts/download-dem.sh
node scripts/prefetch-overpass.ts
node scripts/prefetch-places.ts
node scripts/prefetch-roads.ts
node scripts/prefetch-paths.ts
node scripts/prefetch-zones.ts
node scripts/screen-candidates.ts
node scripts/build-itineraries.ts
npm run build:trails
```

Gli script girano con Node 22 o successivo. I download finiscono in `data-cache/`, esclusa da git.

## Limiti

È uno strumento per organizzare la gita, non per decidere in montagna. I tempi sono stime; i dati di OpenStreetMap possono essere incompleti o non aggiornati (manca per esempio il sentiero per il Rifugio Allievi); il meteo in quota cambia in fretta. La difficoltà indicata è quella dichiarata su OpenStreetMap. Prima di partire controlla il bollettino, lo stato di sentieri e strade, e tieniti un margine.

## Crediti e licenze

- Sentieri, luoghi e strade: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, licenza [ODbL](https://opendatacommons.org/licenses/odbl/). I dati dei giri in `src/data/` e `public/` ne derivano e restano sotto ODbL.
- Carte: © [OpenTopoMap](https://opentopomap.org) (CC-BY-SA).
- Quote: Copernicus GLO-30 Digital Elevation Model, © DLR e Airbus, fornito nell'ambito del programma Copernicus.
- Meteo: [Open-Meteo](https://open-meteo.com) (CC BY 4.0).

Il codice è sotto licenza [MIT](LICENSE).

# Note di ricerca: fattibilità dei dati (25 settembre 2026)

## Sentieri
- OpenStreetMap ha **958 sentieri** (`route=hiking`) in provincia di Sondrio: 912 con numero, 866 con partenza/arrivo, 792 con difficoltà CAI (T/E/EE).
- Elenco salvato in `osm-hiking-routes-sondrio.json` (query Overpass sull'area amministrativa "Sondrio", admin_level 6).
- **Overpass è inaffidabile**: il 25/09 tutti i server davano 504 o timeout per buona parte della mattina. Conferma che i sentieri vanno preparati in anticipo e non cercati dal vivo nell'app.
- Per scaricare un singolo sentiero l'API principale di OSM (`/api/0.6/relation/<id>/full.json`) è più stabile.

## Ricostruire la traccia
- I tratti (way) dentro una relazione **non sono sempre in ordine**: sul 331 l'ordine della relazione produceva 2 salti e un arrivo sbagliato (1963 m invece del rifugio a 2461 m).
- Soluzione: ignorare l'ordine, costruire un grafo tra gli estremi dei tratti e percorrerlo da un capo all'altro. Sul 331 usa tutti i 34 tratti e arriva al rifugio.
- Da gestire più avanti: sentieri con varianti o anelli (più di 2 estremi liberi).

## Quote
- Open-Meteo Elevation API (gratuita, senza chiave, fino a 100 punti per richiesta): quote corrette. Sul 331: partenza 1460 m, massimo 2461 m (Rifugio Longoni ≈ 2450 m).
- Il dislivello però esce **gonfiato di circa il 15%** (1179 m contro i 1021 m del rilievo CAI): il modello del terreno ha piccole oscillazioni. Serve un filtro più robusto, da tarare sui 46 sentieri che hanno il dislivello ufficiale (`ascent`).

## Dal servizio Open-Meteo al modello del terreno locale
- Open-Meteo gratuito conta **ogni coordinata come una richiesta**: con ~130 punti per sentiero lo screening di 108
  sentieri ha esaurito prima il limite al minuto, poi quello orario ("Hourly API request limit exceeded"). 108 sentieri
  fanno ~15.000 punti, oltre anche il limite giornaliero.
- Passati alle tessere **Copernicus GLO-30** (celle da 30 m invece dei 90 m di Open-Meteo), scaricate una volta da AWS
  Open Data (`scripts/download-dem.sh`, 4 tessere, ~170 MB) e lette in locale con interpolazione bilineare.
- Risultato: 97 sentieri su 108 ricostruiti in 74 s (gli 11 scartati hanno problemi nei dati: 10 interrotti, 1 a sensi
  unici); errore **mediano** sul dislivello **3,3%** su 8 salite con dato ufficiale plausibile (331: −1%), soglia di
  isteresi ottimale scesa da 25 m a 5 m (dati meno rumorosi da filtrare). Lunghezza: errore medio 4,7% su 13 sentieri.
- Le traversate in cresta restano fuori dalla v1 (rapporto dislivello netto / salita < 0,6): 19 escluse.
- Esclusi anche 25 sentieri che partono fuori provincia (Bergamo, Lecco): sono nell'elenco perché finiscono in provincia di Sondrio.
- Candidati finali: 37 escursioni di giornata → `candidati.md`.

## Tempi di percorrenza
- 37 coppie (percorso, tempo ufficiale CAI) utilizzabili (`duration:forward`/`backward` + `distance` + `ascent`/`descent`).
- Errore medio rispetto ai tempi CAI: Munter 56 min, DIN 33466 57 min.
- Una formula a 3 parametri tarata sui dati scende a 50 min su sentieri mai visti, ma con valori senza senso fisico (1253 m/h in salita): impara il rumore, scartata.
- **I tempi CAI stessi sono incoerenti**: il rapporto tempo CAI / DIN va da 0,56 a 1,19. Esempio: 12,9 km +991 m → 4h45; 15,5 km +925 m → 8h00.
- Formato dei tempi misto (`02:30`, `2:30`, `2.50`): letto come ore:minuti.

## Conseguenze per il progetto
1. Niente falsa precisione: l'app mostra una **forbice** di tempo e decide il verdetto sul caso **lento**, perché la domanda è di sicurezza.
2. Formula base: DIN 33466 (standard dei club alpini, spiegabile), più un **fattore personale** ("rispetto ai cartelli sei più veloce, uguale o più lento?", in seguito tarabile su un giro fatto davvero).
3. Quando OSM ha il tempo CAI ufficiale, l'app lo mostra accanto alla stima.
4. Dislivello: se c'è quello ufficiale si usa quello, altrimenti il valore calcolato con filtro.

# Martucc Fuel

PWA React/Vite che fonde FuelWise con il dataset e la pipeline Diesel App/Fuel Now.

## Cosa include

- Prezzi carburanti reali da `public/stations.json` con mapping Benzina, Diesel, GPL e Metano.
- Mappa Leaflet con marker prezzo, posizione utente e filtri raggio/servizi/autostrada.
- Analisi locale sempre disponibile e analisi Gemini opzionale con API key salvata in locale.
- Trip planner con geocoding, rotta OSRM, stima consumi, costo viaggio e soste suggerite.
- Garage con database `cars.json`, ricerca modello, serbatoio e consumo.
- PWA con manifest, service worker, cache dati e shortcut `/?drive=1` per modalita guida.
- Pipeline Diesel App copiata a root: `fetch_stations.py`, `news_fetch.py`, `requirements.txt`, `data/history.csv`.

## Sviluppo

```bash
npm install
npm run dev
npm run build
```

Durante lo sviluppo l'app legge i dati statici da `public/`. Senza chiave Gemini usa il motore locale; con chiave Gemini, apri le impostazioni e inserisci la key.

## Dati

```bash
pip install -r requirements.txt
python fetch_stations.py
python news_fetch.py
```

`fetch_stations.py` aggiorna `public/stations.json` e `data/history.csv`. `news_fetch.py` aggiorna `public/news.json` quando la chiave Gemini e disponibile.

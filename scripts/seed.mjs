#!/usr/bin/env node
/**
 * Rinfresca il seme offline in public/stations.json.
 *
 * Il seme e quello che l'app usa al primo avvio senza rete. Se resta
 * indietro mostra prezzi vecchi con l'aria di essere quelli di oggi, che
 * per un'app di prezzi e il peggio che possa capitare. Va rilanciato prima
 * di ogni build che finisce su un telefono:  npm run seed
 */
import { writeFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const URL_DATI = 'https://raw.githubusercontent.com/martucc/Fuel-Now/main/public/stations.json';
const DESTINAZIONE = resolve(process.cwd(), 'public/stations.json');
const TIMEOUT_MS = 120_000;

const stacco = AbortSignal.timeout(TIMEOUT_MS);

console.log('Scarico i prezzi da', URL_DATI);

let risposta;
try {
  risposta = await fetch(URL_DATI, { signal: stacco });
} catch (e) {
  console.error('Non ci arrivo:', e.message);
  console.error('Il seme resta quello di prima.');
  process.exit(1);
}

if (!risposta.ok) {
  console.error(`Il server ha risposto ${risposta.status}. Il seme resta quello di prima.`);
  process.exit(1);
}

const testo = await risposta.text();

let dati;
try {
  dati = JSON.parse(testo);
} catch {
  console.error('Non e JSON valido. Il seme resta quello di prima.');
  process.exit(1);
}

// Meglio un seme vecchio che un seme rotto: si scrive solo se e roba vera.
if (!Array.isArray(dati.stations) || dati.stations.length < 1000) {
  console.error(`Solo ${dati.stations?.length ?? 0} impianti: sembra un file monco. Non lo scrivo.`);
  process.exit(1);
}

writeFileSync(DESTINAZIONE, testo, 'utf8');

const mb = (statSync(DESTINAZIONE).size / 1024 / 1024).toFixed(1);
console.log(`Scritto public/stations.json — ${dati.stations.length} impianti, ${mb} MB`);
console.log(`Estratto il ${dati.extracted_at}, ultimo prezzo ${dati.source?.latest_price_at ?? 'ignoto'}`);

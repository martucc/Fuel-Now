import { Capacitor, CapacitorHttp } from '@capacitor/core';

/**
 * Le chiamate all'API live del Ministero, fatte dal telefono.
 *
 * Passano dall'HTTP nativo di Capacitor e non da `fetch`: l'API non manda
 * intestazioni CORS e la WebView le bloccherebbe. Nel browser quindi non
 * c'è piano B (`ministeroDisponibile()` è falso).
 *
 * Stesse richieste di `fetch_stations.py`: la lista delle regioni, poi
 * `search/area` per ognuna con tutti i carburanti. Venti regioni, quattro
 * alla volta.
 */

const BASE = 'https://carburanti.mise.gov.it/ospzApi/';
const INTESTAZIONI = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'User-Agent': 'osservatorio-prezzi-node-wrapper',
};
const REGIONI_INSIEME = 4;
/** Se risponde meno di metà delle regioni, meglio tenersi il file che si ha. */
const QUOTA_MINIMA_REGIONI = 0.5;

export function ministeroDisponibile(): boolean {
  return Capacitor.isNativePlatform();
}

async function chiedi(metodo: 'GET' | 'POST', percorso: string, corpo?: object): Promise<Record<string, unknown>> {
  const r = await CapacitorHttp.request({
    method: metodo,
    url: BASE + percorso,
    headers: INTESTAZIONI,
    data: corpo,
    connectTimeout: 15_000,
    readTimeout: 30_000,
    responseType: 'json',
  });
  if (r.status < 200 || r.status >= 300) throw new Error(`HTTP ${r.status} da ${percorso}`);
  const dati: unknown = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
  if (!dati || typeof dati !== 'object') throw new Error(`risposta vuota da ${percorso}`);
  return dati as Record<string, unknown>;
}

/** Tutti i `results` di `search/area`, regione per regione. */
export async function scaricaDalMinistero(signal: AbortSignal): Promise<unknown[]> {
  const elenco = (await chiedi('GET', 'registry/region')).results;
  const regioni = Array.isArray(elenco)
    ? elenco.map((r) => Number((r as { id?: unknown })?.id)).filter((id) => Number.isInteger(id) && id > 0)
    : [];
  if (!regioni.length) throw new Error('lista delle regioni vuota');

  const risultati: unknown[] = [];
  let riuscite = 0;
  for (let i = 0; i < regioni.length; i += REGIONI_INSIEME) {
    if (signal.aborted) throw new Error('tempo scaduto');
    const lotto = await Promise.allSettled(
      regioni.slice(i, i + REGIONI_INSIEME).map((region) =>
        chiedi('POST', 'search/area', { region, province: null, town: null, priceOrder: 'asc', fuelType: '0-x' }),
      ),
    );
    for (const esito of lotto) {
      if (esito.status !== 'fulfilled' || !Array.isArray(esito.value.results)) continue;
      riuscite++;
      for (const r of esito.value.results) risultati.push(r);
    }
  }
  if (riuscite < regioni.length * QUOTA_MINIMA_REGIONI) {
    throw new Error(`risposte solo da ${riuscite} regioni su ${regioni.length}`);
  }
  return risultati;
}

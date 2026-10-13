import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

/**
 * L'unico posto da cui prendere maplibre.
 *
 * La configurazione del worker deve essere fatta una volta sola e PRIMA che
 * qualunque mappa venga costruita. Stando dentro il componente della mappa
 * grande, valeva solo se quella veniva caricata per prima: la Home pero si
 * apre prima della scheda Mappa, e la sua mini mappa sarebbe partita senza
 * worker, cioe nera. Qui invece basta importare questo modulo e la riga e
 * gia stata eseguita.
 */

/*
  Senza questa riga la mappa e nera nella build, e in silenzio.

  maplibre cerca il suo worker con
      new URL(dev ? 'maplibre-gl-worker-dev.mjs' : 'maplibre-gl-worker.mjs',
              import.meta.url)
  Il nome lo decide a tempo di esecuzione, quindi il bundler non lo vede e non
  lo copia. Importarlo con `?url` non basta: copia il worker ma non
  maplibre-gl-shared.mjs, che il worker importa come file accanto a se, e
  quell'indirizzo finisce col rispondere l'index — che come modulo non si
  carica. Il worker muore zitto: nessun errore, isStyleLoaded() fermo su
  false, tessere mai decodificate.

  Tutti e due i file li mette in public/maplibre lo script che gira prima di
  ogni build e di ogni avvio: vedi scripts/copia-worker-maplibre.mjs.
*/
maplibregl.setWorkerUrl(`${import.meta.env.BASE_URL}maplibre/maplibre-gl-worker.mjs`);

/**
 * Gli stili, scritti qui e non nei componenti: se la mappa grande e quella
 * della Home ne usassero due diversi, si vedrebbe subito che sono due mappe
 * invece di due finestre sulla stessa.
 *
 * OpenFreeMap ospita tutto in casa — tessere, font e sprite — e non chiede
 * nessuna chiave. Non e un dettaglio: e il motivo per cui siamo qui invece
 * che su CARTO, che senza chiave rimanda tessere marchiate «API KEY
 * REQUIRED» in diagonale.
 */
export const STILE_MAPPA: Record<'dark' | 'voyager', string> = {
  dark: 'https://tiles.openfreemap.org/styles/dark',
  voyager: 'https://tiles.openfreemap.org/styles/positron',
};

export default maplibregl;
export { maplibregl };

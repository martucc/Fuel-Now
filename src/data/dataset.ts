import type { RawDataset } from '../domain/raw';
import { serveAggiornare } from '../domain/aggiornamento';
import type { FaseDati, MotivoAggiornamento } from '../domain/aggiornamento';
import { archivioPredefinito } from './archivio';
import type { Archivio } from './archivio';

/**
 * Il file dei prezzi: dove sta, come arriva, quando si riscarica.
 *
 * Com'era prima e perche mostrava prezzi di dieci giorni fa: all'avvio si
 * leggeva la copia salvata e il download nuovo partiva dietro, ma nessuna
 * schermata ascoltava il suo arrivo; in piu `main.tsx` svuotava a ogni
 * avvio la Cache Storage dove stava la copia buona, e il ripiego era un
 * backup da 7 MB nelle Preferences di Capacitor, cioe nelle
 * SharedPreferences di Android, che non sono fatte per pesi cosi.
 *
 * Adesso: un solo negozio con uno stato osservabile. Si mostra subito
 * l'ultima copia salvata (IndexedDB), poi si riscarica sempre, all'avvio e
 * a ogni ritorno in primo piano, e chi guarda i dati li vede cambiare.
 */

export const DATASET_URL =
  'https://raw.githubusercontent.com/martucc/Fuel-Now/main/public/stations.json';
/** Un telefono con poca rete ci mette: meglio aspettare che restare indietro di un giorno. */
export const TIMEOUT_DOWNLOAD_MS = 25_000;
/** Un file con meno impianti di cosi e troncato o sbagliato: si tengono i dati che ci sono. */
export const MIN_STAZIONI = 1000;
const ATTESA_RIPROVA_MS = 1500;

export type OrigineDati = 'rete' | 'archivio' | 'pacchetto';

export interface StatoDataset {
  dati: RawDataset | null;
  origine: OrigineDati | null;
  /** Quando questi dati sono stati scaricati dalla rete. Nullo per i prezzi inclusi nell'app. */
  scaricatoIl: number | null;
  fase: FaseDati;
  /** Cresce a ogni dataset nuovo: utile per ricalcolare solo quando serve. */
  versione: number;
  ultimoTentativo: number | null;
}

export interface DipendenzeDataset {
  archivio: Archivio;
  /** Scarica il file dalla rete e restituisce il testo. Lancia se non riesce. */
  scarica: (signal: AbortSignal) => Promise<string>;
  /** Il file incluso nell'app, per il primo avvio senza rete. */
  pacchetto: () => Promise<string | null>;
  adesso: () => number;
  attendi: (ms: number) => Promise<void>;
  minStazioni: number;
}

export interface NegozioDataset {
  stato(): StatoDataset;
  iscriviti(cb: () => void): () => void;
  /** Mostra la copia salvata e poi riscarica. Chiamarla piu volte non rifa niente. */
  avvia(): Promise<void>;
  /** Riscarica se la regola del motivo lo consente. Restituisce true se ha portato dati nuovi. */
  aggiorna(motivo: MotivoAggiornamento): Promise<boolean>;
}

function interpreta(testo: string | null, minStazioni: number): RawDataset | null {
  if (!testo) return null;
  try {
    const v = JSON.parse(testo) as RawDataset;
    if (!v || typeof v !== 'object' || !Array.isArray(v.stations)) return null;
    if (v.stations.length < minStazioni) return null;
    return v;
  } catch {
    return null;
  }
}

export function creaNegozioDataset(dip: DipendenzeDataset): NegozioDataset {
  let stato: StatoDataset = {
    dati: null, origine: null, scaricatoIl: null, fase: 'carico', versione: 0, ultimoTentativo: null,
  };
  let ultimoSuccesso: number | null = null;
  let inCorso: Promise<boolean> | null = null;
  let avvio: Promise<void> | null = null;
  const ascoltatori = new Set<() => void>();

  function imposta(parziale: Partial<StatoDataset>): void {
    stato = { ...stato, ...parziale };
    for (const cb of ascoltatori) {
      try { cb(); } catch { /* un ascoltatore rotto non ferma gli altri */ }
    }
  }

  function pubblica(dati: RawDataset, origine: OrigineDati, scaricatoIl: number | null, fase: FaseDati): void {
    imposta({ dati, origine, scaricatoIl, fase, versione: stato.versione + 1 });
  }

  async function scaricaUnaVolta(): Promise<{ dati: RawDataset; testo: string } | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_DOWNLOAD_MS);
    try {
      const testo = await dip.scarica(controller.signal);
      const dati = interpreta(testo, dip.minStazioni);
      return dati ? { dati, testo } : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async function dallaRete(motivo: MotivoAggiornamento): Promise<boolean> {
    const adesso = dip.adesso();
    imposta({ ultimoTentativo: adesso, fase: stato.dati ? 'aggiorno' : 'carico' });

    let esito = await scaricaUnaVolta();
    // Una seconda possibilita quando l'utente ha appena aperto l'app: spesso
    // la rete del telefono si sveglia un attimo dopo l'app.
    if (!esito && motivo !== 'intervallo') {
      await dip.attendi(ATTESA_RIPROVA_MS);
      esito = await scaricaUnaVolta();
    }

    if (esito) {
      const quando = dip.adesso();
      ultimoSuccesso = quando;
      pubblica(esito.dati, 'rete', quando, 'pronto');
      try {
        await dip.archivio.scrivi({ testo: esito.testo, scaricatoIl: quando });
      } catch { /* senza archivio si riscarica al prossimo avvio, niente di grave */ }
      return true;
    }

    if (!stato.dati) {
      const dati = interpreta(await dip.pacchetto().catch(() => null), dip.minStazioni);
      if (dati) {
        pubblica(dati, 'pacchetto', null, 'errore');
        return false;
      }
    }
    imposta({ fase: 'errore' });
    return false;
  }

  function aggiorna(motivo: MotivoAggiornamento): Promise<boolean> {
    if (inCorso) return inCorso;
    const ok = serveAggiornare(
      motivo,
      { ultimoSuccesso, ultimoTentativo: stato.ultimoTentativo, inCorso: false },
      dip.adesso(),
    );
    if (!ok) return Promise.resolve(false);
    inCorso = dallaRete(motivo).finally(() => { inCorso = null; });
    return inCorso;
  }

  async function avviaUnaVolta(): Promise<void> {
    try {
      const salvato = await dip.archivio.leggi();
      const dati = interpreta(salvato?.testo ?? null, dip.minStazioni);
      if (salvato && dati) {
        ultimoSuccesso = salvato.scaricatoIl;
        pubblica(dati, 'archivio', salvato.scaricatoIl, 'pronto');
      }
    } catch { /* archivio illeggibile: si va in rete */ }
    // Con una copia gia a schermo il download non blocca niente; senza, e
    // lui che fa arrivare i primi dati.
    const download = aggiorna('avvio');
    if (!stato.dati) await download;
  }

  return {
    stato: () => stato,
    iscriviti(cb) {
      ascoltatori.add(cb);
      return () => { ascoltatori.delete(cb); };
    },
    avvia() {
      avvio ??= avviaUnaVolta();
      return avvio;
    },
    aggiorna,
  };
}

async function scaricaDallaRete(signal: AbortSignal): Promise<string> {
  // Il parametro cambia a ogni richiesta: ne la cache HTTP della WebView ne
  // quella della CDN di GitHub (cinque minuti) possono rispondere con il
  // file di ieri.
  const res = await fetch(`${DATASET_URL}?t=${Date.now()}`, { signal, cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function leggiPacchetto(): Promise<string | null> {
  const res = await fetch('stations.json');
  return res.ok ? res.text() : null;
}

function predefinito(): NegozioDataset {
  return creaNegozioDataset({
    archivio: archivioPredefinito(),
    scarica: scaricaDallaRete,
    pacchetto: leggiPacchetto,
    adesso: () => Date.now(),
    attendi: (ms) => new Promise((r) => setTimeout(r, ms)),
    minStazioni: MIN_STAZIONI,
  });
}

let negozio: NegozioDataset | null = null;

/** Il negozio dell'app. Uno solo, creato al primo uso. */
export function datasetStore(): NegozioDataset {
  negozio ??= predefinito();
  return negozio;
}

/** Solo per i test: sostituisce il negozio dell'app (null lo ricrea al prossimo uso). */
export function usaNegozioPerTest(n: NegozioDataset | null): void {
  negozio = n;
}

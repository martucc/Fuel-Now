import type { RawDataset } from '../domain/raw';
import { attesePerTentativo, confronta, serveAggiornare } from '../domain/aggiornamento';
import type { FaseDati, MotivoAggiornamento } from '../domain/aggiornamento';
import { cuciPrezzi, leggiRisultati, prezziFermi, ultimoPrezzoIl } from '../domain/ministero';
import { ministeroDisponibile, scaricaDalMinistero } from '../services/ministero';
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
 * l'ultima copia salvata (IndexedDB), poi si ricontrolla sempre, all'avvio e
 * a ogni ritorno in primo piano, e chi guarda i dati li vede cambiare.
 */

export const DATASET_URL =
  'https://raw.githubusercontent.com/martucc/Fuel-Now/main/public/stations.json';
/** Per ogni tentativo. Un telefono con poca rete ci mette: meglio aspettare che restare indietro. */
export const TIMEOUT_DOWNLOAD_MS = 20_000;
/** Un file con meno impianti di cosi e troncato o sbagliato: si tengono i dati che ci sono. */
export const MIN_STAZIONI = 1000;
/**
 * Al primo avvio senza copia salvata: dopo quanto si mostrano i prezzi
 * inclusi nell'app invece di tenere l'utente davanti allo schermo vuoto.
 * Il download continua e li sostituisce appena arriva.
 */
export const ATTESA_PRIMO_AVVIO_MS = 2500;
/** Il piano B scarica una decina di MB: se non ha funzionato, si riprova fra qualche ora. */
export const PAUSA_PIANO_B_MS = 3 * 3_600_000;
/** Venti regioni con una rete da telefono: oltre questo tempo si lascia perdere. */
export const TIMEOUT_PIANO_B_MS = 90_000;

/** `ministero`: prezzi chiesti dal telefono al Ministero perche il file era fermo. */
export type OrigineDati = 'rete' | 'archivio' | 'pacchetto' | 'ministero';

export interface StatoDataset {
  dati: RawDataset | null;
  origine: OrigineDati | null;
  /**
   * L'ultima volta che il telefono ha controllato con successo il file in
   * rete, anche quando non era cambiato. Nullo per i prezzi inclusi nell'app.
   */
  verificatoIl: number | null;
  fase: FaseDati;
  /** Cresce solo quando arriva un dataset diverso: e la chiave per ricalcolare. */
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
  attesaPrimoAvvioMs: number;
  /**
   * Il piano B: i `results` dell'API live del Ministero, tutte le regioni.
   * Assente dove non si può chiamare (nel browser, per il CORS).
   */
  ministero?: (signal: AbortSignal) => Promise<unknown[]>;
}

export interface NegozioDataset {
  stato(): StatoDataset;
  iscriviti(cb: () => void): () => void;
  /** Mostra la copia salvata e poi ricontrolla. Chiamarla piu volte non rifa niente. */
  avvia(): Promise<void>;
  /** Ricontrolla se la regola del motivo lo consente. Restituisce true se ha portato dati nuovi. */
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
    dati: null, origine: null, verificatoIl: null, fase: 'carico', versione: 0, ultimoTentativo: null,
  };
  let ultimoSuccesso: number | null = null;
  let ultimoEsito: 'ok' | 'errore' | null = null;
  let ultimoPianoB: number | null = null;
  let inCorso: Promise<boolean> | null = null;
  let avvio: Promise<void> | null = null;
  const ascoltatori = new Set<() => void>();

  function imposta(parziale: Partial<StatoDataset>): void {
    stato = { ...stato, ...parziale };
    for (const cb of ascoltatori) {
      try { cb(); } catch { /* un ascoltatore rotto non ferma gli altri */ }
    }
  }

  function pubblica(dati: RawDataset, origine: OrigineDati, verificatoIl: number | null, fase: FaseDati): void {
    imposta({ dati, origine, verificatoIl, fase, versione: stato.versione + 1 });
  }

  async function scaricaUnaVolta(): Promise<{ dati: RawDataset; testo: string } | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_DOWNLOAD_MS);
    let testo: string;
    try {
      testo = await dip.scarica(controller.signal);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
    const dati = interpreta(testo, dip.minStazioni);
    return dati ? { dati, testo } : null;
  }

  async function dalFile(motivo: MotivoAggiornamento): Promise<boolean> {
    imposta({ ultimoTentativo: dip.adesso(), fase: stato.dati ? 'aggiorno' : 'carico' });

    let esito: { dati: RawDataset; testo: string } | null = null;
    for (const attesa of attesePerTentativo(motivo)) {
      if (attesa > 0) await dip.attendi(attesa);
      esito = await scaricaUnaVolta();
      if (esito) break;
    }

    if (!esito) {
      ultimoEsito = 'errore';
      imposta({ fase: 'errore' });
      return false;
    }

    const quando = dip.adesso();
    ultimoSuccesso = quando;
    ultimoEsito = 'ok';
    const confronto = confronta(esito.dati, stato.origine === 'pacchetto' ? null : stato.dati);

    if (confronto !== 'nuovo') {
      // Stesso file (o la CDN che rimanda il precedente): i prezzi a schermo
      // sono gia quelli giusti. Cambia solo l'ora del controllo.
      imposta({ verificatoIl: quando, fase: 'pronto' });
      try {
        await dip.archivio.segnaVerifica(quando);
      } catch { /* l'ora del controllo salvata e un dettaglio */ }
      return false;
    }

    pubblica(esito.dati, 'rete', quando, 'pronto');
    try {
      await dip.archivio.scrivi({ testo: esito.testo, scaricatoIl: quando });
    } catch { /* senza archivio si riscarica al prossimo avvio, niente di grave */ }
    return true;
  }

  /**
   * Il piano B. Se anche dopo il controllo i prezzi a schermo sono fermi da
   * ore (lo script su GitHub non gira o non arriva al Ministero), li si
   * chiede al Ministero dal telefono e li si cuce sul file che si ha.
   *
   * Il risultato porta l'ora del telefono come `generated_at`: il file di
   * GitHub vecchio risulta «più vecchio» e non lo sostituisce, il primo
   * file nuovo di GitHub sì.
   */
  function serveIlPianoB(): boolean {
    const adesso = dip.adesso();
    // GitHub che non risponde di solito vuol dire niente rete: si aspetta
    // che torni, senza bruciare la pausa del piano B.
    return Boolean(dip.ministero) && stato.dati !== null && ultimoEsito === 'ok'
      && prezziFermi(stato.dati, adesso)
      && (ultimoPianoB === null || adesso - ultimoPianoB >= PAUSA_PIANO_B_MS);
  }

  async function pianoB(chiedi: NonNullable<DipendenzeDataset['ministero']>, base: RawDataset): Promise<boolean> {
    ultimoPianoB = dip.adesso();

    const fasePrima = stato.fase;
    imposta({ fase: 'aggiorno' });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_PIANO_B_MS);
    let risultati: unknown[];
    try {
      risultati = await chiedi(controller.signal);
    } catch {
      imposta({ fase: fasePrima });
      return false;
    } finally {
      clearTimeout(timer);
    }

    const letti = leggiRisultati(risultati);
    const quando = dip.adesso();
    const cucito = cuciPrezzi(base, letti, new Date(quando));
    const piuFresco = (ultimoPrezzoIl(cucito) ?? 0) > (ultimoPrezzoIl(base) ?? 0);
    if (letti.size < dip.minStazioni || !piuFresco || stato.dati !== base) {
      // Risposta troppo corta, il Ministero fermo anche lui, o nel frattempo
      // e arrivato un file: si resta con quello che c'e.
      imposta({ fase: fasePrima });
      return false;
    }

    pubblica(cucito, 'ministero', quando, 'pronto');
    try {
      await dip.archivio.scrivi({ testo: JSON.stringify(cucito), scaricatoIl: quando });
    } catch { /* al prossimo avvio si rifa */ }
    return true;
  }

  async function dallaRete(motivo: MotivoAggiornamento): Promise<boolean> {
    const dalGithub = await dalFile(motivo);
    if (!serveIlPianoB() || !dip.ministero || !stato.dati) return dalGithub;
    return (await pianoB(dip.ministero, stato.dati)) || dalGithub;
  }

  function aggiorna(motivo: MotivoAggiornamento): Promise<boolean> {
    if (inCorso) return inCorso;
    const ok = serveAggiornare(
      motivo,
      { ultimoSuccesso, ultimoTentativo: stato.ultimoTentativo, ultimoEsito, inCorso: false },
      dip.adesso(),
    );
    if (!ok) return Promise.resolve(false);
    inCorso = dallaRete(motivo).finally(() => { inCorso = null; });
    return inCorso;
  }

  async function mostraPacchetto(): Promise<void> {
    if (stato.dati) return;
    const dati = interpreta(await dip.pacchetto().catch(() => null), dip.minStazioni);
    if (dati && !stato.dati) {
      pubblica(dati, 'pacchetto', null, inCorso ? 'aggiorno' : stato.fase === 'errore' ? 'errore' : 'pronto');
    }
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

    const download = aggiorna('avvio');
    if (stato.dati) return; // con una copia a schermo il download non blocca niente

    // Primo avvio: si aspetta la rete per poco, poi si mostrano i prezzi
    // inclusi nell'app e il download li sostituira appena arriva.
    const scaduto = dip.attendi(dip.attesaPrimoAvvioMs).then(() => 'scaduto' as const);
    const primo = await Promise.race([download.then(() => 'rete' as const), scaduto]);
    if (primo === 'scaduto' || !stato.dati) await mostraPacchetto();
    if (!stato.dati) {
      await download;
      await mostraPacchetto();
    }
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

/*
  Indirizzo fisso e `cache: 'no-cache'`: la WebView rimanda l'ETag e, se il
  file non e cambiato, GitHub risponde 304 senza ritrasmettere 1,4 MB.
  Niente parametri per «rompere la cache»: la CDN di GitHub li ignora
  (verificato) e farebbero solo perdere il 304. Niente intestazioni fatte a
  mano: farebbero partire un preflight CORS, che raw.githubusercontent
  respinge con 403. La CDN tiene il file al massimo cinque minuti.
*/
async function scaricaDallaRete(signal: AbortSignal): Promise<string> {
  const res = await fetch(DATASET_URL, { signal, cache: 'no-cache' });
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
    attesaPrimoAvvioMs: ATTESA_PRIMO_AVVIO_MS,
    ministero: ministeroDisponibile() ? scaricaDalMinistero : undefined,
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

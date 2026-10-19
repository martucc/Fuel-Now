/**
 * La copia salvata del file dei prezzi, per mostrare subito qualcosa
 * all'apertura mentre parte il download.
 *
 * IndexedDB e non le Preferences di Capacitor: il file pesa circa 7 MB e le
 * Preferences su Android sono SharedPreferences, un XML riscritto per intero
 * a ogni modifica e caricato tutto in memoria. Prima il backup stava li.
 */

export interface CopiaSalvata {
  testo: string;
  scaricatoIl: number;
}

export interface Archivio {
  /** La copia salvata; `scaricatoIl` e l'ultimo controllo riuscito, anche senza cambi. */
  leggi(): Promise<CopiaSalvata | null>;
  scrivi(v: CopiaSalvata): Promise<void>;
  /** Il file non era cambiato: si salva solo l'ora del controllo, non 7 MB di nuovo. */
  segnaVerifica(t: number): Promise<void>;
}

const DB = 'martucc-fuel';
const STORE = 'archivio';
const CHIAVE = 'stations';
const CHIAVE_VERIFICA = 'verificato';

function apri(): Promise<IDBDatabase> {
  return new Promise((ok, ko) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => ko(req.error);
  });
}

function richiesta<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((ok, ko) => {
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}

function archivioIndexedDB(): Archivio {
  return {
    async leggi() {
      const db = await apri();
      try {
        const store = db.transaction(STORE, 'readonly').objectStore(STORE);
        const [v, t] = await Promise.all([richiesta(store.get(CHIAVE)), richiesta(store.get(CHIAVE_VERIFICA))]);
        const c = v as CopiaSalvata | undefined;
        if (!c || typeof c.testo !== 'string' || typeof c.scaricatoIl !== 'number') return null;
        const verifica = typeof t === 'number' && t > c.scaricatoIl ? t : c.scaricatoIl;
        return { testo: c.testo, scaricatoIl: verifica };
      } finally {
        db.close();
      }
    },
    async scrivi(v) {
      const db = await apri();
      try {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(v, CHIAVE);
        await new Promise<void>((ok, ko) => {
          tx.oncomplete = () => ok();
          tx.onerror = () => ko(tx.error);
          tx.onabort = () => ko(tx.error);
        });
      } finally {
        db.close();
      }
    },
    async segnaVerifica(t) {
      const db = await apri();
      try {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(t, CHIAVE_VERIFICA);
        await new Promise<void>((ok, ko) => {
          tx.oncomplete = () => ok();
          tx.onerror = () => ko(tx.error);
          tx.onabort = () => ko(tx.error);
        });
      } finally {
        db.close();
      }
    },
  };
}

const NIENTE: Archivio = {
  async leggi() { return null; },
  async scrivi() { /* niente dove salvare */ },
  async segnaVerifica() { /* idem */ },
};

export function archivioPredefinito(): Archivio {
  return typeof indexedDB === 'undefined' ? NIENTE : archivioIndexedDB();
}

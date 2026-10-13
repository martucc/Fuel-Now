import { Preferences } from '@capacitor/preferences';
import type { RawDataset } from '../domain/raw';

export const DATASET_URL =
  'https://raw.githubusercontent.com/martucc/Fuel-Now/main/public/stations.json';
export const FETCH_TIMEOUT_MS = 8000;

const CACHE_NAME = 'stations-offline-cache';
const BACKUP_KEY = 'mf_offline_stations_backup';

let cache: RawDataset | null = null;
let inFlight: Promise<RawDataset | null> | null = null;
const listeners = new Set<(d: RawDataset) => void>();

export function cachedDataset(): RawDataset | null {
  return cache;
}

export function resetDatasetCache(): void {
  cache = null;
  inFlight = null;
  listeners.clear();
}

/** Avvisa quando il rinfresco dietro ha portato dati nuovi. Restituisce come disiscriversi. */
export function onDatasetUpdate(cb: (d: RawDataset) => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function publish(d: RawDataset): void {
  cache = d;
  for (const cb of listeners) {
    try { cb(d); } catch { /* un ascoltatore rotto non ferma gli altri */ }
  }
}

function isDataset(v: unknown): v is RawDataset {
  return !!v && typeof v === 'object' && Array.isArray((v as RawDataset).stations);
}

async function persist(res: Response): Promise<void> {
  try {
    if (typeof caches !== 'undefined') {
      const c = await caches.open(CACHE_NAME);
      await c.put(DATASET_URL, res.clone());
    }
  } catch { /* la cache e un lusso, non una condizione */ }
  try {
    await Preferences.set({ key: BACKUP_KEY, value: await res.clone().text() });
  } catch { /* idem */ }
}

async function fromNetwork(): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const bust = Math.floor(Date.now() / 3600000);
    const res = await fetch(`${DATASET_URL}?t=${bust}`, { signal: controller.signal, cache: 'no-cache' });
    if (!res || !res.ok) return null;
    const body = await res.clone().json();
    void persist(res);
    return body;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fromCacheStorage(): Promise<unknown | null> {
  try {
    if (typeof caches === 'undefined') return null;
    const c = await caches.open(CACHE_NAME);
    const hit = await c.match(DATASET_URL);
    return hit && hit.ok ? await hit.json() : null;
  } catch {
    return null;
  }
}

async function fromPreferences(): Promise<unknown | null> {
  try {
    const b = await Preferences.get({ key: BACKUP_KEY });
    return b?.value ? JSON.parse(b.value) : null;
  } catch {
    return null;
  }
}

async function fromBundle(): Promise<unknown | null> {
  try {
    const res = await fetch('stations.json');
    return res && res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/**
 * Il download vero. Un fallimento non tocca `cache`: i dati vecchi valgono
 * piu di una schermata vuota, e la loro eta e gia visibile su ogni riga.
 */
export async function refreshDataset(): Promise<RawDataset | null> {
  const v = await fromNetwork();
  if (isDataset(v)) {
    publish(v);
    return v;
  }
  return null;
}

/** Ordine della spec § 7: cache, poi backup, poi rete, poi bundle. */
async function firstAvailable(): Promise<RawDataset | null> {
  for (const src of [fromCacheStorage, fromPreferences]) {
    const v = await src();
    if (isDataset(v)) return v;
  }
  const rete = await fromNetwork();
  if (isDataset(rete)) return rete;
  const bundle = await fromBundle();
  return isDataset(bundle) ? bundle : null;
}

export async function loadDataset(opts?: { force?: boolean }): Promise<RawDataset | null> {
  if (opts?.force) return refreshDataset();
  if (cache) return cache;
  if (inFlight) return inFlight;

  inFlight = firstAvailable().then((d) => {
    inFlight = null;
    if (d) cache = d;
    return d;
  });
  return inFlight;
}

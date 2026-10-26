import { useSyncExternalStore } from 'react';
import type { FuelKey } from '../domain/raw';
import { FUEL_KEYS } from '../domain/raw';
import type { LivelloVibrazione } from '../domain/vibrazione';
import { LIVELLI_VIBRAZIONE, VIBRAZIONE_PREDEFINITA } from '../domain/vibrazione';

/**
 * Le scelte dell'utente. Poche e piccole: stanno in localStorage, che nella
 * WebView di Capacitor resta finche l'app non viene disinstallata.
 */

export type OrdineLista = 'risparmio' | 'prezzo' | 'distanza';

export interface Impostazioni {
  carburante: FuelKey;
  /** Il campo `model` di cars.json; null finche l'utente non sceglie. */
  auto: string | null;
  chiaveGemini: string;
  modelloGemini: string;
  ordineLista: OrdineLista;
  /** Quanto vibra l'app ai tocchi: spenta, leggera (tocco di sistema) o decisa. */
  vibrazione: LivelloVibrazione;
}

export const MODELLO_GEMINI_PREDEFINITO = 'gemini-2.5-flash';

export const PREDEFINITE: Impostazioni = {
  carburante: 'diesel',
  auto: null,
  chiaveGemini: '',
  modelloGemini: MODELLO_GEMINI_PREDEFINITO,
  ordineLista: 'risparmio',
  vibrazione: VIBRAZIONE_PREDEFINITA,
};

const CHIAVE = 'mf2_impostazioni';
const ORDINI: readonly OrdineLista[] = ['risparmio', 'prezzo', 'distanza'];

/** Tiene solo i campi validi: un valore rotto torna al predefinito invece di rompere l'app. */
export function normalizza(v: unknown): Impostazioni {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return {
    carburante: FUEL_KEYS.includes(o.carburante as FuelKey) ? (o.carburante as FuelKey) : PREDEFINITE.carburante,
    auto: typeof o.auto === 'string' && o.auto.trim() ? o.auto : null,
    chiaveGemini: typeof o.chiaveGemini === 'string' ? o.chiaveGemini.trim() : '',
    modelloGemini:
      typeof o.modelloGemini === 'string' && o.modelloGemini.trim()
        ? o.modelloGemini.trim()
        : PREDEFINITE.modelloGemini,
    ordineLista: ORDINI.includes(o.ordineLista as OrdineLista) ? (o.ordineLista as OrdineLista) : PREDEFINITE.ordineLista,
    vibrazione: LIVELLI_VIBRAZIONE.includes(o.vibrazione as LivelloVibrazione)
      ? (o.vibrazione as LivelloVibrazione)
      : PREDEFINITE.vibrazione,
  };
}

function leggi(): Impostazioni {
  try {
    const s = localStorage.getItem(CHIAVE);
    return normalizza(s ? JSON.parse(s) : null);
  } catch {
    return PREDEFINITE;
  }
}

let correnti: Impostazioni | null = null;
const ascoltatori = new Set<() => void>();

export function impostazioni(): Impostazioni {
  correnti ??= leggi();
  return correnti;
}

export function aggiornaImpostazioni(parziale: Partial<Impostazioni>): void {
  correnti = normalizza({ ...impostazioni(), ...parziale });
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(correnti));
  } catch { /* senza spazio si resta con le scelte in memoria */ }
  for (const cb of ascoltatori) cb();
}

function iscriviti(cb: () => void): () => void {
  ascoltatori.add(cb);
  return () => { ascoltatori.delete(cb); };
}

export function useImpostazioni(): Impostazioni {
  return useSyncExternalStore(iscriviti, impostazioni, impostazioni);
}

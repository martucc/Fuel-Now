import { useSyncExternalStore } from 'react';
import { daProporre, serveControllare } from '../domain/versione';
import type { Rilascio } from '../domain/versione';
import { chiediUltimoRilascio, versioneInstallata } from '../services/rilasci';

/**
 * C'è una versione nuova dell'app? Si chiede a GitHub all'avvio e alla
 * ripresa, al più ogni sei ore; la risposta resta salvata in mezzo. Solo
 * sul telefono: nel browser la versione è sempre l'ultima.
 */

const CHIAVE = 'mf2_rilascio';
const CHIAVE_SCARTATA = 'mf2_rilascio_scartato';

interface Salvato {
  controllatoIl: number;
  rilascio: Rilascio | null;
}

export interface StatoVersione {
  /** La versione installata, se si sa. */
  installata: string | null;
  /** Il rilascio da proporre, o null. */
  proposta: Rilascio | null;
}

let stato: StatoVersione = { installata: null, proposta: null };
let inCorso: Promise<void> | null = null;
const ascoltatori = new Set<() => void>();

function leggi<T>(chiave: string): T | null {
  try {
    const v = localStorage.getItem(chiave);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

function scrivi(chiave: string, v: unknown): void {
  try {
    localStorage.setItem(chiave, JSON.stringify(v));
  } catch { /* al prossimo avvio si richiede */ }
}

function imposta(nuovo: StatoVersione): void {
  stato = nuovo;
  for (const cb of ascoltatori) cb();
}

async function controlla(): Promise<void> {
  const installata = await versioneInstallata();
  if (!installata) return;

  let salvato = leggi<Salvato>(CHIAVE);
  if (serveControllare(salvato?.controllatoIl ?? null, Date.now())) {
    try {
      salvato = { controllatoIl: Date.now(), rilascio: await chiediUltimoRilascio() };
      scrivi(CHIAVE, salvato);
    } catch { /* senza rete si tiene la risposta di prima */ }
  }
  imposta({ installata, proposta: daProporre(installata, salvato?.rilascio ?? null, leggi<string>(CHIAVE_SCARTATA)) });
}

export function controllaNuovaVersione(): Promise<void> {
  inCorso ??= controlla().finally(() => { inCorso = null; });
  return inCorso;
}

/** «Non ora»: quella versione non si ripropone, la successiva sì. */
export function scartaVersione(versione: string): void {
  scrivi(CHIAVE_SCARTATA, versione);
  imposta({ ...stato, proposta: stato.proposta?.versione === versione ? null : stato.proposta });
}

function iscriviti(cb: () => void): () => void {
  ascoltatori.add(cb);
  return () => { ascoltatori.delete(cb); };
}

export function useNuovaVersione(): StatoVersione {
  return useSyncExternalStore(iscriviti, () => stato, () => stato);
}

import { useSyncExternalStore } from 'react';
import { datasetStore } from '../data/dataset';
import type { StatoDataset } from '../data/dataset';
import type { RawDataset } from '../domain/raw';
import type { StationRow } from '../domain/parse';
import { parseStations } from '../domain/parse';
import type { CohortIndex } from '../domain/market';
import { buildCohorts } from '../domain/market';
import type { CarSpec } from '../domain/units';

/** Lo stato del file dei prezzi, osservabile da React. */
export function useDataset(): StatoDataset {
  const n = datasetStore();
  return useSyncExternalStore(n.iscriviti, n.stato, n.stato);
}

export interface Base {
  dataset: RawDataset;
  rows: StationRow[];
  /** Per aprire la scheda di un impianto dal suo id. */
  perId: Map<string, StationRow>;
  cohorts: CohortIndex;
}

let ultimaBase: Base | null = null;

/**
 * Righe e coorti del dataset: si calcolano una volta per dataset (21 mila
 * impianti, qualche decina di millisecondi) e si riusano in tutta l'app.
 */
export function baseDi(dataset: RawDataset): Base {
  if (ultimaBase?.dataset === dataset) return ultimaBase;
  const rows = parseStations(dataset.stations);
  const perId = new Map(rows.map((r) => [r.id, r] as const));
  ultimaBase = { dataset, rows, perId, cohorts: buildCohorts(rows) };
  return ultimaBase;
}

/* ── Le auto di cars.json ─────────────────────────────────────────────── */

export interface Auto extends CarSpec {
  tags: string;
}

let auto: Auto[] | null = null;
let caricoAuto: Promise<Auto[]> | null = null;
const ascoltatoriAuto = new Set<() => void>();

function valida(v: unknown): Auto | null {
  const o = v as Record<string, unknown>;
  if (!o || typeof o.model !== 'string') return null;
  const liters = Number(o.liters);
  const kml = Number(o.kml);
  if (!Number.isFinite(liters) || !Number.isFinite(kml)) return null;
  return { model: o.model, liters, kml, tags: typeof o.tags === 'string' ? o.tags : '' };
}

export function caricaAuto(): Promise<Auto[]> {
  caricoAuto ??= fetch('cars.json')
    .then((r) => (r.ok ? r.json() : []))
    .then((v: unknown) => (Array.isArray(v) ? v.map(valida).filter((x): x is Auto => x !== null) : []))
    .catch(() => [])
    .then((lista) => {
      auto = lista;
      for (const cb of ascoltatoriAuto) cb();
      return lista;
    });
  return caricoAuto;
}

function elencoAuto(): Auto[] | null {
  return auto;
}

function iscrivitiAuto(cb: () => void): () => void {
  ascoltatoriAuto.add(cb);
  if (!caricoAuto) void caricaAuto();
  return () => { ascoltatoriAuto.delete(cb); };
}

/** L'elenco delle auto, null finche non e caricato. */
export function useElencoAuto(): Auto[] | null {
  return useSyncExternalStore(iscrivitiAuto, elencoAuto, elencoAuto);
}

/** Cerca per parole: «panda hybrid» trova «Fiat Panda 1.0 Hybrid». */
export function cercaAuto(elenco: Auto[], testo: string): Auto[] {
  const parole = testo.toLowerCase().split(/\s+/).filter(Boolean);
  if (parole.length === 0) return elenco;
  return elenco.filter((a) => {
    const dove = `${a.model} ${a.tags}`.toLowerCase();
    return parole.every((p) => dove.includes(p));
  });
}

/* ── Distributori nascosti e preferiti ───────────────────────────────── */

/** Un insieme di id salvato sul telefono, osservabile da React. */
function insiemeSalvato(chiave: string) {
  let valore: ReadonlySet<string> | null = null;
  const ascoltatori = new Set<() => void>();

  function leggi(): ReadonlySet<string> {
    if (valore) return valore;
    try {
      const v = JSON.parse(localStorage.getItem(chiave) ?? '[]');
      valore = new Set(Array.isArray(v) ? v.map(String) : []);
    } catch {
      valore = new Set();
    }
    return valore;
  }

  function imposta(id: string, dentro: boolean): void {
    const s = new Set(leggi());
    if (dentro) s.add(id);
    else s.delete(id);
    valore = s;
    try {
      localStorage.setItem(chiave, JSON.stringify([...s]));
    } catch { /* resta in memoria */ }
    for (const cb of ascoltatori) cb();
  }

  function iscriviti(cb: () => void): () => void {
    ascoltatori.add(cb);
    return () => { ascoltatori.delete(cb); };
  }

  return { leggi, imposta, iscriviti };
}

/** Quelli che l'utente non vuole più vedere consigliati. */
const nascosti = insiemeSalvato('mf2_nascosti');
/** «I miei distributori»: quelli con la stella. */
const preferiti = insiemeSalvato('mf2_preferiti');

export function impostaNascosto(id: string, nascosto: boolean): void {
  nascosti.imposta(id, nascosto);
}

export function useNascosti(): ReadonlySet<string> {
  return useSyncExternalStore(nascosti.iscriviti, nascosti.leggi, nascosti.leggi);
}

export function impostaPreferito(id: string, preferito: boolean): void {
  preferiti.imposta(id, preferito);
}

export function usePreferiti(): ReadonlySet<string> {
  return useSyncExternalStore(preferiti.iscriviti, preferiti.leggi, preferiti.leggi);
}

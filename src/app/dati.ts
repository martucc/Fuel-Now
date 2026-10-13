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

/* ── Distributori nascosti dall'utente ───────────────────────────────── */

const CHIAVE_NASCOSTI = 'mf2_nascosti';
let nascosti: ReadonlySet<string> | null = null;
const ascoltatoriNascosti = new Set<() => void>();

function leggiNascosti(): ReadonlySet<string> {
  if (nascosti) return nascosti;
  try {
    const v = JSON.parse(localStorage.getItem(CHIAVE_NASCOSTI) ?? '[]');
    nascosti = new Set(Array.isArray(v) ? v.map(String) : []);
  } catch {
    nascosti = new Set();
  }
  return nascosti;
}

export function impostaNascosto(id: string, nascosto: boolean): void {
  const s = new Set(leggiNascosti());
  if (nascosto) s.add(id);
  else s.delete(id);
  nascosti = s;
  try {
    localStorage.setItem(CHIAVE_NASCOSTI, JSON.stringify([...s]));
  } catch { /* resta in memoria */ }
  for (const cb of ascoltatoriNascosti) cb();
}

function iscrivitiNascosti(cb: () => void): () => void {
  ascoltatoriNascosti.add(cb);
  return () => { ascoltatoriNascosti.delete(cb); };
}

export function useNascosti(): ReadonlySet<string> {
  return useSyncExternalStore(iscrivitiNascosti, leggiNascosti, leggiNascosti);
}

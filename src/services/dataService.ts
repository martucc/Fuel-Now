import type { FuelStation } from '../types';
import type { StationRow } from '../domain/parse';
import type { RawDataset } from '../domain/raw';
import { parseStations } from '../domain/parse';
import { datasetStore } from '../data/dataset';
import { toFuelStations } from '../data/adapter';

/** Raggio oltre il quale una stazione non e piu un'alternativa realistica. */
const NEARBY_KM = 50;

let rows: StationRow[] = [];
let rowsDa: RawDataset | null = null;
let blocked: string[] = [];

export function getRows(): StationRow[] {
  return rows;
}

export function getRawDataset(): RawDataset | null {
  return datasetStore().stato().dati;
}

async function loadCommunityBlocked(): Promise<void> {
  if (blocked.length > 0) return;
  try {
    const res = await fetch('community_blocked.json');
    if (res.ok) blocked = await res.json();
  } catch { /* la lista e opzionale */ }
}

/**
 * Le stazioni del dataset attuale. Non scarica niente da sola: il download
 * lo decide il negozio (`data/dataset.ts`), all'avvio e a ogni ripresa.
 * Con `forceRefresh` aspetta un download nuovo prima di rispondere.
 */
export async function getStations(
  userLocation?: { lat: number; lng: number },
  forceRefresh = false
): Promise<{ stations: FuelStation[]; nationalStats: any }> {
  const negozio = datasetStore();
  await negozio.avvia();
  if (forceRefresh) await negozio.aggiorna('manuale');

  const data = negozio.stato().dati;
  if (!data) return { stations: [], nationalStats: {} };

  await loadCommunityBlocked();

  // Le coorti provinciali hanno bisogno del dataset intero: si conserva
  // tutto, e la vista vicina si ricava per selezione. Nessun filtro
  // sull'eta — la penalizzazione avviene nell'algoritmo (spec § 7).
  if (rowsDa !== data) {
    rows = parseStations(data.stations).filter((r) => !blocked.includes(r.id));
    rowsDa = data;
  }

  let stations = toFuelStations(rows, userLocation);
  if (userLocation) {
    stations = stations
      .filter((s) => s.distance !== undefined && s.distance < NEARBY_KM)
      .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
  }

  return { stations, nationalStats: data.national ?? {} };
}

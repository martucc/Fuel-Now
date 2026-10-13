import type { FuelStation } from '../types';
import type { StationRow } from '../domain/parse';
import type { RawDataset } from '../domain/raw';
import { parseStations } from '../domain/parse';
import { loadDataset, refreshDataset, cachedDataset } from '../data/dataset';
import { toFuelStations } from '../data/adapter';

/** Raggio oltre il quale una stazione non e piu un'alternativa realistica. */
const NEARBY_KM = 50;
/** Spec § 7: si rinfresca alla ripresa se sono passate piu di sei ore. */
const REFRESH_AFTER_MS = 6 * 60 * 60 * 1000;

let rows: StationRow[] = [];
let blocked: string[] = [];
let servedAt = 0;

export function getRows(): StationRow[] {
  return rows;
}

export function getRawDataset(): RawDataset | null {
  return cachedDataset();
}

async function loadCommunityBlocked(): Promise<void> {
  if (blocked.length > 0) return;
  try {
    const res = await fetch('community_blocked.json');
    if (res.ok) blocked = await res.json();
  } catch { /* la lista e opzionale */ }
}

export async function getStations(
  userLocation?: { lat: number; lng: number },
  forceRefresh = false
): Promise<{ stations: FuelStation[]; nationalStats: any }> {
  const data = await loadDataset({ force: forceRefresh });
  if (!data) return { stations: [], nationalStats: {} };

  // I dati sono gia serviti; il download vero parte adesso e non blocca
  // nessuno. Chi vuole i dati nuovi si iscrive con onDatasetUpdate.
  if (!forceRefresh && Date.now() - servedAt > REFRESH_AFTER_MS) {
    servedAt = Date.now();
    void refreshDataset();
  }

  await loadCommunityBlocked();

  // Le coorti provinciali hanno bisogno del dataset intero: si conserva
  // tutto, e la vista vicina si ricava per selezione. Nessun filtro
  // sull'eta — la penalizzazione avviene nell'algoritmo (spec § 7).
  rows = parseStations(data.stations).filter((r) => !blocked.includes(r.id));

  let stations = toFuelStations(rows, userLocation);
  if (userLocation) {
    stations = stations
      .filter((s) => s.distance !== undefined && s.distance < NEARBY_KM)
      .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
  }

  return { stations, nationalStats: data.national ?? {} };
}

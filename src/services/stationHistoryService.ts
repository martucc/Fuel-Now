import type { FuelStation, FuelType } from '../types';

const KEY = 'mf_station_history_v1';
const RETENTION_DAYS = 60;
const MAX_STATIONS = 500;

interface PricePoint {
  d: string;
  p: number;
}

interface StationRecord {
  id: string;
  name: string;
  brand: string;
  city: string;
  series: Partial<Record<FuelType, PricePoint[]>>;
  lastSeen: number;
}

type Store = Record<string, StationRecord>;

let cache: Store | null = null;

function load(): Store {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? JSON.parse(raw) : {};
  } catch {
    cache = {};
  }
  return cache!;
}

function persist(store: Store) {
  cache = store;
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    const entries = Object.entries(store).sort((a, b) => b[1].lastSeen - a[1].lastSeen);
    const trimmed: Store = {};
    for (const [k, v] of entries.slice(0, Math.floor(MAX_STATIONS / 2))) trimmed[k] = v;
    cache = trimmed;
    try { localStorage.setItem(KEY, JSON.stringify(trimmed)); } catch {}
  }
}

const FUELS: FuelType[] = ['Benzina', 'Diesel', 'GPL', 'Metano'];

export function recordObservation(stations: FuelStation[]) {
  if (!stations.length) return;
  const store = load();
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = Date.now() - RETENTION_DAYS * 86400_000;

  for (const s of stations) {
    if (!s.id) continue;
    const existing = store[s.id] || {
      id: s.id, name: s.name, brand: s.brand, city: s.city,
      series: {}, lastSeen: 0,
    };
    existing.lastSeen = Date.now();
    existing.name = s.name || existing.name;
    existing.brand = s.brand || existing.brand;
    existing.city = s.city || existing.city;
    for (const f of FUELS) {
      const fp = s.prices.find(p => p.type === f);
      if (!fp || !fp.price) continue;
      const list = existing.series[f] || [];
      const last = list[list.length - 1];
      if (last && last.d === today) {
        last.p = fp.price;
      } else {
        list.push({ d: today, p: fp.price });
      }
      existing.series[f] = list.filter(pt => new Date(pt.d).getTime() >= cutoff);
    }
    store[s.id] = existing;
  }

  const ids = Object.keys(store);
  if (ids.length > MAX_STATIONS) {
    const sorted = ids.sort((a, b) => store[b].lastSeen - store[a].lastSeen);
    for (const id of sorted.slice(MAX_STATIONS)) delete store[id];
  }
  persist(store);
}

export interface StationHistoryView {
  series: PricePoint[];
  min: number;
  max: number;
  avg: number;
  current: number;
  first: number;
  deltaPct: number;
  pointCount: number;
}

export function getStationHistory(stationId: string, fuel: FuelType): StationHistoryView | null {
  const store = load();
  const rec = store[stationId];
  if (!rec) return null;
  const series = rec.series[fuel] || [];
  if (!series.length) return null;
  let min = Infinity, max = -Infinity, sum = 0;
  for (const p of series) {
    if (p.p < min) min = p.p;
    if (p.p > max) max = p.p;
    sum += p.p;
  }
  const avg = sum / series.length;
  const current = series[series.length - 1].p;
  const first = series[0].p;
  const deltaPct = first > 0 ? ((current - first) / first) * 100 : 0;
  return { series, min, max, avg, current, first, deltaPct, pointCount: series.length };
}

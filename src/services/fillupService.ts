import type { Fillup, FuelType } from '../types';

const KEY = 'mf_fillups_v1';

export function loadFillups(): Fillup[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr as Fillup[];
  } catch {
    return [];
  }
}

export function saveFillups(list: Fillup[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function addFillup(f: Omit<Fillup, 'id'>): Fillup[] {
  const list = loadFillups();
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const next = [...list, { ...f, id }];
  next.sort((a, b) => a.odometer - b.odometer);
  saveFillups(next);
  return next;
}

export function removeFillup(id: string): Fillup[] {
  const next = loadFillups().filter(f => f.id !== id);
  saveFillups(next);
  return next;
}

export function fillupsForCar(carModel: string): Fillup[] {
  return loadFillups()
    .filter(f => f.carModel === carModel)
    .sort((a, b) => a.odometer - b.odometer);
}

export interface FillupStats {
  count: number;
  totalLiters: number;
  totalCost: number;
  kmDriven: number;
  realKml: number | null;
  avgPricePerL: number | null;
  costPerKm: number | null;
  lastDate: string | null;
  daysSinceLast: number | null;
  consumptionSeries: { date: string; kml: number; odo: number }[];
  vsWltpPct: number | null;
}

export function computeStats(fills: Fillup[], wltpKml?: number): FillupStats {
  const count = fills.length;
  let totalLiters = 0, totalCost = 0;
  for (const f of fills) {
    totalLiters += f.liters;
    totalCost += f.total;
  }

  const first = fills[0];
  const last = fills[fills.length - 1];
  const kmDriven = first && last ? Math.max(0, last.odometer - first.odometer) : 0;

  const fulls = fills.filter(f => f.full);
  const series: { date: string; kml: number; odo: number }[] = [];
  let sumKmBetweenFulls = 0;
  let sumLitersBetweenFulls = 0;

  for (let i = 1; i < fulls.length; i++) {
    const prev = fulls[i - 1];
    const cur = fulls[i];
    const km = cur.odometer - prev.odometer;
    if (km <= 0) continue;
    let liters = 0;
    for (const f of fills) {
      if (f.odometer > prev.odometer && f.odometer <= cur.odometer) liters += f.liters;
    }
    if (liters <= 0) continue;
    const kml = km / liters;
    series.push({ date: cur.date, kml, odo: cur.odometer });
    sumKmBetweenFulls += km;
    sumLitersBetweenFulls += liters;
  }

  const realKml = sumLitersBetweenFulls > 0 ? sumKmBetweenFulls / sumLitersBetweenFulls : null;
  const avgPricePerL = totalLiters > 0 ? totalCost / totalLiters : null;
  const costPerKm = kmDriven > 0 ? totalCost / kmDriven : null;
  const lastDate = last ? last.date : null;
  const daysSinceLast = last
    ? Math.floor((Date.now() - new Date(last.date).getTime()) / 86400_000)
    : null;
  const vsWltpPct = (realKml && wltpKml) ? ((realKml - wltpKml) / wltpKml) * 100 : null;

  return {
    count, totalLiters, totalCost, kmDriven,
    realKml, avgPricePerL, costPerKm,
    lastDate, daysSinceLast,
    consumptionSeries: series,
    vsWltpPct,
  };
}

export function defaultFuelType(carTags?: string): FuelType {
  const t = (carTags || '').toLowerCase();
  if (t.includes('diesel')) return 'Diesel';
  if (t.includes('gpl')) return 'GPL';
  if (t.includes('metano')) return 'Metano';
  return 'Benzina';
}

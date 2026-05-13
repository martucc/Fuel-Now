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
  try { window.dispatchEvent(new CustomEvent('mf-fillup-changed')); } catch {}
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

export function updateFillup(id: string, patch: Omit<Fillup, 'id'>): Fillup[] {
  const list = loadFillups();
  const next = list.map(f => f.id === id ? { ...patch, id } : f);
  next.sort((a, b) => a.odometer - b.odometer);
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

export interface MonthBucket {
  key: string;
  label: string;
  year: number;
  month: number;
  total: number;
  liters: number;
  count: number;
}

export function computeMonthlySpend(fills: Fillup[], monthsBack = 12): MonthBucket[] {
  const now = new Date();
  const buckets: MonthBucket[] = [];
  const MONTHS_IT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear(), m = d.getMonth();
    buckets.push({
      key: `${y}-${String(m + 1).padStart(2, '0')}`,
      label: MONTHS_IT[m],
      year: y, month: m,
      total: 0, liters: 0, count: 0,
    });
  }
  const byKey = new Map(buckets.map(b => [b.key, b]));
  for (const f of fills) {
    const d = new Date(f.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const b = byKey.get(key);
    if (!b) continue;
    b.total += f.total;
    b.liters += f.liters;
    b.count += 1;
  }
  return buckets;
}

export interface PienoPrediction {
  kmSinceLast: number;
  litersUsedEst: number;
  litersLeftEst: number;
  tankPct: number;
  daysSinceLast: number;
  kmPerDay: number;
  daysUntilEmpty: number | null;
  predictedDate: string | null;
  rangeLeftKm: number | null;
}

export function predictNextFillup(fills: Fillup[], kml: number | undefined, tankL: number | undefined): PienoPrediction | null {
  if (!kml || !tankL) return null;
  const fulls = fills.filter(f => f.full);
  if (fulls.length < 2) return null;
  const first = fulls[0];
  const last = fulls[fulls.length - 1];
  const daysSpan = Math.max(1, (new Date(last.date).getTime() - new Date(first.date).getTime()) / 86400_000);
  const kmSpan = last.odometer - first.odometer;
  const kmPerDay = kmSpan / daysSpan;
  if (kmPerDay <= 0) return null;
  const daysSinceLast = (Date.now() - new Date(last.date).getTime()) / 86400_000;
  const kmSinceLast = kmPerDay * daysSinceLast;
  const litersUsedEst = kmSinceLast / kml;
  const litersLeftEst = Math.max(0, tankL - litersUsedEst);
  const tankPct = Math.min(1, litersUsedEst / tankL);
  const rangeLeftKm = litersLeftEst * kml;
  const daysUntilEmpty = kmPerDay > 0 ? rangeLeftKm / kmPerDay : null;
  const predictedDate = daysUntilEmpty != null
    ? new Date(Date.now() + daysUntilEmpty * 86400_000).toISOString().slice(0, 10)
    : null;
  return {
    kmSinceLast, litersUsedEst, litersLeftEst, tankPct,
    daysSinceLast, kmPerDay, daysUntilEmpty, predictedDate, rangeLeftKm,
  };
}

export function defaultFuelType(carTags?: string): FuelType {
  const t = (carTags || '').toLowerCase();
  if (t.includes('diesel')) return 'Diesel';
  if (t.includes('gpl')) return 'GPL';
  if (t.includes('metano')) return 'Metano';
  return 'Benzina';
}

import type { FuelType } from '../types';

export interface HistoryPoint {
  date: string;
  ts: number;
  avg: number;
  min: number;
  max: number;
  n: number;
}

export type Period = '1M' | '3M' | '6M' | '1Y' | '5Y' | 'MAX';

const PERIOD_DAYS: Record<Period, number> = {
  '1M': 30, '3M': 90, '6M': 180, '1Y': 365, '5Y': 365 * 5, 'MAX': Infinity,
};

const FUEL_KEY: Record<FuelType, string> = {
  Benzina: 'benzina', Diesel: 'diesel', GPL: 'gpl', Metano: 'metano',
};

let cache: Record<string, HistoryPoint[]> | null = null;

export async function loadHistory(): Promise<Record<string, HistoryPoint[]>> {
  if (cache) return cache;
  const base = (import.meta as any).env?.BASE_URL || '/';
  const candidates = [`${base}data/history.csv`, `${base}history.csv`, '/data/history.csv'];
  let text = '';
  for (const url of candidates) {
    try {
      const r = await fetch(url);
      if (r.ok) { text = await r.text(); break; }
    } catch { /* try next */ }
  }
  if (!text) { cache = {}; return cache; }

  const out: Record<string, HistoryPoint[]> = { benzina: [], diesel: [], gpl: [], metano: [] };
  const lines = text.trim().split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    const [date, fuel, avg, min, max, n] = lines[i].split(',');
    if (!fuel || !out[fuel]) continue;
    const avgN = parseFloat(avg);
    if (!isFinite(avgN) || avgN <= 0) continue;
    const minN = parseFloat(min);
    const maxN = parseFloat(max);
    const nN = parseInt(n);
    out[fuel].push({
      date,
      ts: new Date(date).getTime(),
      avg: avgN,
      min: isFinite(minN) ? minN : avgN,
      max: isFinite(maxN) ? maxN : avgN,
      n: isFinite(nN) ? nN : 0,
    });
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => a.ts - b.ts);
  cache = out;
  return cache;
}

export function getSeries(history: Record<string, HistoryPoint[]>, fuel: FuelType, period: Period): HistoryPoint[] {
  const series = history[FUEL_KEY[fuel]] || [];
  if (period === 'MAX' || !series.length) return series;
  const days = PERIOD_DAYS[period];
  const cutoff = Date.now() - days * 86400_000;
  return series.filter(p => p.ts >= cutoff);
}

export function pctDelta(series: HistoryPoint[]): number {
  if (series.length < 2) return 0;
  const a = series[0].avg, b = series[series.length - 1].avg;
  return ((b - a) / a) * 100;
}

export function rangeStats(series: HistoryPoint[]) {
  if (!series.length) return { hi: 0, lo: 0, avg: 0, vol: 0, count: 0 };
  // hi/lo = range della media nazionale nel periodo (NOT raw min/max che includono outlier MIMIT)
  let hi = -Infinity, lo = Infinity, sum = 0;
  for (const p of series) {
    if (p.avg > hi) hi = p.avg;
    if (p.avg < lo) lo = p.avg;
    sum += p.avg;
  }
  const avg = sum / series.length;
  let varSum = 0;
  for (const p of series) varSum += (p.avg - avg) ** 2;
  const vol = Math.sqrt(varSum / series.length);
  return { hi, lo, avg, vol, count: series.length };
}

export function movingAverage(series: HistoryPoint[], window: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < series.length; i++) {
    if (i < window - 1) { out.push(null); continue; }
    let sum = 0;
    for (let j = i - window + 1; j <= i; j++) sum += series[j].avg;
    out.push(sum / window);
  }
  return out;
}

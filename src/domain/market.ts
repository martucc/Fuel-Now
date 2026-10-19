import type { FuelKey } from './raw';
import { FUEL_KEYS } from './raw';
import type { StationRow } from './parse';

export const MIN_COHORT_N = 8;

export type Segment = 'road' | 'highway';

export type CohortSource =
  | 'province-road'
  | 'province-highway'
  | 'national-road'
  | 'national-highway'
  | 'national';

export interface Stats {
  avg: number;
  std: number;
  min: number;
  max: number;
  n: number;
}

export interface Cohort extends Stats {
  source: CohortSource;
  /** true solo per la coorte provinciale del proprio segmento. */
  reliable: boolean;
}

export interface CohortIndex {
  /** chiave `${prov}|${segment}|${fuel}` */
  byProv: Map<string, Stats>;
  /** chiave `${segment}|${fuel}` */
  bySegment: Map<string, Stats>;
  byFuel: Map<FuelKey, Stats>;
}

/** Deviazione standard di popolazione, come statistics.pstdev della pipeline. */
function statsOf(values: number[]): Stats {
  const n = values.length;
  const avg = values.reduce((a, v) => a + v, 0) / n;
  const variance = values.reduce((a, v) => a + (v - avg) ** 2, 0) / n;
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { avg, std: Math.sqrt(variance), min, max, n };
}

function push(bucket: Map<string, number[]>, key: string, value: number): void {
  const arr = bucket.get(key);
  if (arr) arr.push(value);
  else bucket.set(key, [value]);
}

/**
 * Costruisce tutte le coorti in una passata sola.
 * VINCOLO: `rows` deve essere il dataset INTERO, mai un sottoinsieme filtrato
 * per distanza o per riquadro di mappa.
 */
export function buildCohorts(rows: StationRow[]): CohortIndex {
  const prov = new Map<string, number[]>();
  const segment = new Map<string, number[]>();
  const fuel = new Map<string, number[]>();

  for (const r of rows) {
    const seg: Segment = r.isHighway ? 'highway' : 'road';
    for (const f of FUEL_KEYS) {
      const p = r.prices[f];
      if (p === undefined) continue;
      if (r.prov) push(prov, `${r.prov}|${seg}|${f}`, p);
      push(segment, `${seg}|${f}`, p);
      push(fuel, f, p);
    }
  }

  const byProv = new Map<string, Stats>();
  for (const [k, v] of prov) byProv.set(k, statsOf(v));
  const bySegment = new Map<string, Stats>();
  for (const [k, v] of segment) bySegment.set(k, statsOf(v));
  const byFuel = new Map<FuelKey, Stats>();
  for (const [k, v] of fuel) byFuel.set(k as FuelKey, statsOf(v));

  return { byProv, bySegment, byFuel };
}

/**
 * La coorte contro cui giudicare questo impianto per questo carburante.
 * Un impianto autostradale resta nell'autostrada per tutta la catena: la
 * ricaduta sulla coorte cittadina lo dipingerebbe rosso per sempre.
 */
export function cohortFor(row: StationRow, fuel: FuelKey, idx: CohortIndex): Cohort | null {
  const seg: Segment = row.isHighway ? 'highway' : 'road';
  const provSource: CohortSource = seg === 'highway' ? 'province-highway' : 'province-road';
  const segSource: CohortSource = seg === 'highway' ? 'national-highway' : 'national-road';

  const chain: Array<[CohortSource, Stats | undefined]> = [
    [provSource, row.prov ? idx.byProv.get(`${row.prov}|${seg}|${fuel}`) : undefined],
    [segSource, idx.bySegment.get(`${seg}|${fuel}`)],
    ['national', idx.byFuel.get(fuel)],
  ];

  for (let i = 0; i < chain.length; i++) {
    const entry = chain[i]!;
    const stats = entry[1];
    if (stats && stats.n >= MIN_COHORT_N && stats.std > 0) {
      return { ...stats, source: entry[0], reliable: i === 0 };
    }
  }

  const last = idx.byFuel.get(fuel);
  return last ? { ...last, source: 'national', reliable: false } : null;
}

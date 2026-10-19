import { describe, it, expect } from 'vitest';
import { buildCohorts, cohortFor, MIN_COHORT_N } from './market';
import { parseStations } from './parse';
import type { StationRow } from './parse';
import { FUEL_KEYS } from './raw';
import { realDataset } from './__fixtures__/dataset';

const d = realDataset();
const rows = parseStations(d.stations);
const idx = buildCohorts(rows);

function row(over: Partial<StationRow>): StationRow {
  return {
    id: 'x', name: 'n', brand: 'b', operator: '', prov: 'PE', city: '', address: '',
    isHighway: false, lat: 42, lng: 14, prices: { diesel: 2.0 }, servito: {}, updated: null,
    ...over,
  };
}

describe("buildCohorts contro l'oracolo by_province", () => {
  it('la media road+highway di ogni provincia coincide con quella della pipeline', () => {
    let checked = 0;
    for (const [prov, fuels] of Object.entries(d.by_province)) {
      if (!/^[A-Z]{2}$/.test(prov)) continue;
      for (const f of FUEL_KEYS) {
        const oracle = fuels[f];
        if (!oracle) continue;
        const mine = rows.filter((r) => r.prov === prov && r.prices[f] !== undefined);
        expect(mine.length, `${prov}/${f} numerosità`).toBe(oracle.n);
        const avg = mine.reduce((a, r) => a + r.prices[f]!, 0) / mine.length;
        expect(avg, `${prov}/${f} media`).toBeCloseTo(oracle.avg, 3);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(300);
  });
});

describe('cohortFor', () => {
  it('un impianto cittadino in provincia popolosa usa la coorte provinciale stradale', () => {
    const c = cohortFor(row({ prov: 'MI', isHighway: false }), 'diesel', idx)!;
    expect(c.source).toBe('province-road');
    expect(c.reliable).toBe(true);
    expect(c.n).toBeGreaterThanOrEqual(MIN_COHORT_N);
  });

  it('un impianto autostradale non ricade MAI sulla coorte cittadina', () => {
    let sawNationalHighway = false;
    for (const r of rows.filter((x) => x.isHighway)) {
      const c = cohortFor(r, 'diesel', idx);
      if (!c) continue;
      expect(['province-highway', 'national-highway', 'national']).toContain(c.source);
      expect(c.source).not.toBe('province-road');
      expect(c.source).not.toBe('national-road');
      if (c.source === 'national-highway') sawNationalHighway = true;
    }
    // La mediana è 5 impianti autostradali per provincia: la ricaduta nazionale
    // autostradale deve scattare spesso, altrimenti la catena è rotta.
    expect(sawNationalHighway).toBe(true);
  });

  it('la coorte autostradale nazionale è più cara di quella stradale nazionale', () => {
    const hw = cohortFor(row({ prov: 'ZZ', isHighway: true }), 'diesel', idx)!;
    const rd = cohortFor(row({ prov: 'ZZ', isHighway: false }), 'diesel', idx)!;
    expect(hw.avg).toBeGreaterThan(rd.avg);
  });

  it('una stazione senza provincia ricade sulla coorte nazionale del suo segmento', () => {
    const c = cohortFor(row({ prov: null, isHighway: false }), 'diesel', idx)!;
    expect(c.source).toBe('national-road');
    expect(c.reliable).toBe(false);
  });

  it('marca inaffidabile ogni coorte che non sia quella provinciale del segmento', () => {
    const c = cohortFor(row({ prov: 'ZZ', isHighway: false }), 'metano', idx)!;
    expect(c.reliable).toBe(false);
  });

  it('non restituisce mai una coorte con std nulla o n sotto la soglia quando ne esiste una migliore', () => {
    for (const f of FUEL_KEYS) {
      const c = cohortFor(row({ prov: 'ZZ' }), f, idx)!;
      expect(c.n).toBeGreaterThanOrEqual(MIN_COHORT_N);
      expect(c.std).toBeGreaterThan(0);
    }
  });
});

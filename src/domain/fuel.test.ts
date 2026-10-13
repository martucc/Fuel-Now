import { describe, it, expect } from 'vitest';
import { selectPrice, isPlausible, toFuelKey, toFuelType, PRICE_LIMITS } from './fuel';
import { FUEL_KEYS } from './raw';
import { realDataset } from './__fixtures__/dataset';

describe('selectPrice', () => {
  it('per diesel e benzina usa solo il self, mai il servito', () => {
    expect(selectPrice([1.899, 1.999], 'diesel')).toBe(1.899);
    expect(selectPrice([null, 1.999], 'diesel')).toBeNull();
    expect(selectPrice([null, 1.999], 'benzina')).toBeNull();
  });

  it('per gpl e metano ricade sul servito quando il self manca', () => {
    expect(selectPrice([0.769, null], 'gpl')).toBe(0.769);
    expect(selectPrice([null, 0.799], 'gpl')).toBe(0.799);
    expect(selectPrice([null, 1.599], 'metano')).toBe(1.599);
  });

  it('restituisce null quando il carburante non è erogato', () => {
    expect(selectPrice(undefined, 'diesel')).toBeNull();
  });

  it('scarta i prezzi fuori dai limiti fisici', () => {
    expect(selectPrice([0.4, null], 'diesel')).toBeNull();
    expect(selectPrice([9.99, null], 'benzina')).toBeNull();
    expect(selectPrice([3.2, null], 'gpl')).toBeNull();
  });

  it('lascia passare i prezzi reali del dataset', () => {
    const d = realDataset();
    let kept = 0;
    for (const s of d.stations) {
      for (const f of FUEL_KEYS) {
        if (selectPrice(s.p[f], f) !== null) kept++;
      }
    }
    // La pipeline conta 20.176 diesel + 20.192 benzina + 4.581 gpl + 1.517 metano.
    const expected = FUEL_KEYS.reduce((acc, f) => acc + (d.national[f]?.n ?? 0), 0);
    expect(kept).toBe(expected);
  });
});

describe('isPlausible', () => {
  it('rispetta i limiti di fetch_stations.py', () => {
    expect(PRICE_LIMITS.diesel).toEqual([1.0, 3.5]);
    expect(PRICE_LIMITS.metano).toEqual([0.5, 4.0]);
    expect(isPlausible(1.0, 'diesel')).toBe(true);
    expect(isPlausible(3.5, 'diesel')).toBe(true);
    expect(isPlausible(3.51, 'diesel')).toBe(false);
    expect(isPlausible(0.29, 'gpl')).toBe(false);
  });
});

describe("conversione con i tipi dell'app", () => {
  it('va e torna', () => {
    expect(toFuelKey('Diesel')).toBe('diesel');
    expect(toFuelKey('GPL')).toBe('gpl');
    expect(toFuelType('metano')).toBe('Metano');
    for (const f of FUEL_KEYS) expect(toFuelKey(toFuelType(f))).toBe(f);
  });
});

import { describe, it, expect } from 'vitest';
import { zScore, levelForZ, priceLevel, LEVEL_LABEL, LEVEL_VAR } from './pricing';
import type { Cohort } from './market';

const c: Cohort = { avg: 2.0, std: 0.05, min: 1.8, max: 2.3, n: 100, source: 'province-road', reliable: true };

describe('zScore', () => {
  it('misura in scarti tipo', () => {
    expect(zScore(2.0, c)).toBe(0);
    expect(zScore(1.95, c)).toBeCloseTo(-1, 6);
    expect(zScore(2.1, c)).toBeCloseTo(2, 6);
  });

  it('restituisce null se la coorte non ha dispersione', () => {
    expect(zScore(2.0, { ...c, std: 0 })).toBeNull();
  });
});

describe('levelForZ — i confini della spec § 6.1', () => {
  it('mappa ogni fascia', () => {
    expect(levelForZ(-2)).toBe('best');
    expect(levelForZ(-1.5)).toBe('best');
    expect(levelForZ(-1.49)).toBe('good');
    expect(levelForZ(-0.5)).toBe('good');
    expect(levelForZ(-0.49)).toBe('normal');
    expect(levelForZ(0)).toBe('normal');
    expect(levelForZ(0.49)).toBe('normal');
    expect(levelForZ(0.5)).toBe('high');
    expect(levelForZ(1.49)).toBe('high');
    expect(levelForZ(1.5)).toBe('worst');
    expect(levelForZ(9)).toBe('worst');
  });

  it('senza z il livello è "nella media"', () => {
    expect(levelForZ(null)).toBe('normal');
  });
});

describe('priceLevel', () => {
  it("propaga l'affidabilità della coorte", () => {
    expect(priceLevel(1.9, c).reliable).toBe(true);
    expect(priceLevel(1.9, { ...c, reliable: false }).reliable).toBe(false);
    expect(priceLevel(1.9, { ...c, std: 0 }).reliable).toBe(false);
  });

  it('restituisce livello, z e affidabilità insieme', () => {
    const r = priceLevel(1.9, c);
    expect(r.level).toBe('best');
    expect(r.z).toBeCloseTo(-2, 6);
  });
});

describe('etichette e variabili CSS', () => {
  it('coprono tutti e cinque i livelli con i nomi della spec', () => {
    expect(LEVEL_LABEL.best).toBe('Affarone');
    expect(LEVEL_LABEL.good).toBe('Conviene');
    expect(LEVEL_LABEL.normal).toBe('Nella media');
    expect(LEVEL_LABEL.high).toBe('Caro');
    expect(LEVEL_LABEL.worst).toBe('Salasso');
    expect(LEVEL_VAR.best).toBe('--mf-price-best');
    expect(Object.values(LEVEL_VAR).every((v) => v.startsWith('--mf-'))).toBe(true);
    expect(Object.keys(LEVEL_VAR)).toHaveLength(5);
  });
});

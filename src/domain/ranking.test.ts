import { describe, it, expect } from 'vitest';
import { netSaving, rankStations, pickBest, TIE_EURO } from './ranking';
import type { RankContext } from './ranking';
import { buildCohorts } from './market';
import { parseStations } from './parse';
import type { StationRow } from './parse';
import { realDataset } from './__fixtures__/dataset';

describe('netSaving', () => {
  it('calcola la formula della spec § 6.3 riga per riga', () => {
    const b = netSaving({
      price: 1.9, cohortAvg: 2.0, liters: 38.25, distanceKm: 5, kml: 18, confidence: 1,
    });
    expect(b.gross).toBeCloseTo(3.825, 6);          // (2.00 − 1.90) × 38,25
    expect(b.roadCost).toBeCloseTo(1.0555, 3);      // (2 × 5 / 18) × 1,90
    expect(b.net).toBeCloseTo(2.7695, 3);
  });

  it('sconta il lordo con la fiducia, non il costo della strada', () => {
    const fresh = netSaving({ price: 1.9, cohortAvg: 2.0, liters: 40, distanceKm: 10, kml: 20, confidence: 1 });
    const stale = netSaving({ price: 1.9, cohortAvg: 2.0, liters: 40, distanceKm: 10, kml: 20, confidence: 0.5 });
    expect(stale.roadCost).toBeCloseTo(fresh.roadCost, 9);
    expect(stale.net).toBeCloseTo(fresh.gross * 0.5 - fresh.roadCost, 9);
  });

  it("diventa negativo quando l'impianto è troppo lontano", () => {
    const b = netSaving({ price: 1.97, cohortAvg: 2.0, liters: 38, distanceKm: 60, kml: 15, confidence: 1 });
    expect(b.net).toBeLessThan(0);
  });
});

function row(over: Partial<StationRow>): StationRow {
  return {
    id: 'x', name: 'n', brand: 'b', operator: '', prov: 'MI', city: '', address: '',
    isHighway: false, lat: 45.4642, lng: 9.19, prices: { diesel: 2.0 }, servito: {},
    updated: '2026-06-08 10:00', ...over,
  };
}

const d = realDataset();
const allRows = parseStations(d.stations);
const cohorts = buildCohorts(allRows);

const ctx: RankContext = {
  fuel: 'diesel',
  user: { lat: 45.4642, lng: 9.19 },
  cohorts,
  now: new Date(2026, 5, 8, 12, 0),
  liters: 38.25,
  kml: 18,
  blocked: new Set<string>(),
};

describe('rankStations', () => {
  it('preferisce il vicino leggermente più caro al lontano leggermente più economico', () => {
    const near = row({ id: 'vicino', prices: { diesel: 1.98 }, lat: 45.4642, lng: 9.19 });
    const far = row({ id: 'lontano', prices: { diesel: 1.95 }, lat: 45.9, lng: 9.19 });
    const best = pickBest(rankStations([near, far], ctx))!;
    expect(best.row.id).toBe('vicino');
  });

  it('a parità di netto entro 15 centesimi vince il più vicino', () => {
    // 'b' costa 4 decimi di centesimo in meno e guida la classifica per un
    // soffio, ma è 640 m più lontano: rientra nella parità, quindi vince 'a'.
    const a = row({ id: 'a', prices: { diesel: 1.95 }, lat: 45.4642, lng: 9.19 });
    const b = row({ id: 'b', prices: { diesel: 1.946 }, lat: 45.47, lng: 9.19 });
    const ranked = rankStations([a, b], ctx);
    expect(ranked[0]!.row.id).toBe('b');
    expect(Math.abs(ranked[0]!.net.net - ranked[1]!.net.net)).toBeLessThanOrEqual(TIE_EURO);
    expect(pickBest(ranked)!.row.id).toBe('a');
  });

  it("esclude l'impianto bloccato", () => {
    const blocked = row({ id: 'bloccato', prices: { diesel: 1.5 } });
    const ok = row({ id: 'ok', prices: { diesel: 1.99 } });
    const best = pickBest(rankStations([blocked, ok], { ...ctx, blocked: new Set(['bloccato']) }))!;
    expect(best.row.id).toBe('ok');
  });

  it('esclude il prezzo assurdo invece di premiarlo', () => {
    const absurd = row({ id: 'assurdo', prices: { diesel: 1.02 } });
    const ok = row({ id: 'ok', prices: { diesel: 1.98 } });
    const ranked = rankStations([absurd, ok], ctx);
    expect(ranked.find((r) => r.row.id === 'assurdo')!.eligible).toBe(false);
    expect(ranked.find((r) => r.row.id === 'assurdo')!.reason).toBe('prezzo-assurdo');
    expect(pickBest(ranked)!.row.id).toBe('ok');
  });

  it('declassa il dato vecchio senza nasconderlo', () => {
    const old = row({ id: 'vecchio', prices: { diesel: 1.93 }, updated: '2026-05-20 08:00' });
    const fresh = row({ id: 'fresco', prices: { diesel: 1.95 } });
    const ranked = rankStations([old, fresh], ctx);
    expect(ranked.find((r) => r.row.id === 'vecchio')!.confidence).toBe(0.3);
    expect(ranked.some((r) => r.row.id === 'vecchio')).toBe(true);
    expect(pickBest(ranked)!.row.id).toBe('fresco');
  });

  it('salta le stazioni che non erogano il carburante scelto', () => {
    const gplOnly = row({ id: 'solo-gpl', prices: { gpl: 0.75 } });
    expect(rankStations([gplOnly], ctx)).toHaveLength(0);
  });

  it('regge il dataset reale e produce un migliore sensato', () => {
    const milan = { lat: 45.4642, lng: 9.19 };
    const near = allRows.filter((r) => Math.abs(r.lat - milan.lat) < 0.2 && Math.abs(r.lng - milan.lng) < 0.2);
    const ranked = rankStations(near, { ...ctx, user: milan });
    const best = pickBest(ranked)!;
    expect(best).toBeTruthy();
    expect(best.net.net).toBeGreaterThan(0);
    expect(best.eligible).toBe(true);
    expect(best.distanceKm).toBeLessThan(40);
  });

  it('non elegge un impianto autostradale solo perché la coorte cittadina è più bassa', () => {
    const hw = allRows.filter((r) => r.isHighway && r.prices.diesel !== undefined);
    const ranked = rankStations(hw.slice(0, 200), ctx);
    for (const r of ranked) {
      expect(['province-highway', 'national-highway', 'national']).toContain(r.cohort.source);
    }
  });
});

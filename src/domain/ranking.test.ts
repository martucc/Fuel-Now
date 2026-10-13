import { describe, it, expect } from 'vitest';
import { netSaving, rankStations, pickBest, TIE_EURO, ORE_RIFERIMENTO_FRESCO } from './ranking';
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
    expect(b.kmStrada).toBeCloseTo(13, 6);          // 2 × 5 × 1,3 (fattore strada)
    expect(b.roadCost).toBeCloseTo(1.3722, 3);      // (13 / 18) × 1,90
    expect(b.net).toBeCloseTo(2.4528, 3);
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
const realCohorts = buildCohorts(allRows);

/**
 * Una coorte milanese finta con media esattamente 2,00 €/L. I test sul
 * comportamento non possono dipendere dai prezzi del giorno: col dataset
 * vero la media di Milano cambia a ogni `seed`, e un 1,98 «sotto la media»
 * a giugno era sopra la media a ottobre (LEGGIMI § 5).
 */
const coorteMilano: StationRow[] = Array.from({ length: 41 }, (_, i) =>
  row({ id: `coorte-${i}`, prices: { diesel: 1.9 + i * 0.005 }, lat: 45.2, lng: 9.0 }));
const cohorts = buildCohorts(coorteMilano);

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
    // 'b' costa 8 decimi di centesimo in meno e guida la classifica per un
    // soffio, ma è 640 m più lontano: rientra nella parità, quindi vince 'a'.
    const a = row({ id: 'a', prices: { diesel: 1.95 }, lat: 45.4642, lng: 9.19 });
    const b = row({ id: 'b', prices: { diesel: 1.942 }, lat: 45.47, lng: 9.19 });
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
    const ranked = rankStations(near, { ...ctx, user: milan, cohorts: realCohorts, now: new Date() });
    const best = pickBest(ranked)!;
    expect(best).toBeTruthy();
    expect(best.net.net).toBeGreaterThan(0);
    expect(best.eligible).toBe(true);
    expect(best.distanceKm).toBeLessThan(40);
  });

  it('non elegge un impianto autostradale solo perché la coorte cittadina è più bassa', () => {
    const hw = allRows.filter((r) => r.isHighway && r.prices.diesel !== undefined);
    const ranked = rankStations(hw.slice(0, 200), { ...ctx, cohorts: realCohorts });
    for (const r of ranked) {
      expect(['province-highway', 'national-highway', 'national']).toContain(r.cohort.source);
    }
  });

  it('misura il risparmio contro il più vicino con un prezzo recente, non contro uno vecchio', () => {
    // Il più vicino in assoluto ha un prezzo di sei giorni fa: non può fare
    // da metro. Il riferimento diventa il più vicino fra quelli freschi.
    const vecchio = row({ id: 'vecchio-vicino', prices: { diesel: 2.05 }, updated: '2026-06-02 10:00' });
    const fresco = row({ id: 'fresco', prices: { diesel: 1.99 }, lat: 45.47, lng: 9.19 });
    const altro = row({ id: 'altro', prices: { diesel: 1.95 }, lat: 45.48, lng: 9.19 });
    const ranked = rankStations([vecchio, fresco, altro], ctx);
    const r = ranked.find((x) => x.row.id === 'altro')!;
    expect(r.net.riferimento?.price).toBe(1.99);
    expect(ORE_RIFERIMENTO_FRESCO).toBe(72);
  });

  it('con almeno tre prezzi freschi non consiglia un prezzo di quattro giorni fa', () => {
    const vecchiotto = row({ id: 'quattro-giorni', prices: { diesel: 1.90 }, updated: '2026-06-04 10:00' });
    const f1 = row({ id: 'f1', prices: { diesel: 1.97 } });
    const f2 = row({ id: 'f2', prices: { diesel: 1.98 }, lat: 45.465 });
    const f3 = row({ id: 'f3', prices: { diesel: 1.99 }, lat: 45.466 });
    const best = pickBest(rankStations([vecchiotto, f1, f2, f3], ctx))!;
    expect(best.row.id).not.toBe('quattro-giorni');
  });
});

import { describe, it, expect } from 'vitest';
import { parseStations } from './parse';
import { buildCohorts } from './market';
import { rankStations, pickBest } from './ranking';
import { realDataset } from './__fixtures__/dataset';
import type { RankContext } from './ranking';

describe('Bagnacavallo / Lugo / Russi real-world ranking scenario', () => {
  const d = realDataset();
  const rows = parseStations(d.stations);
  const cohorts = buildCohorts(rows);

  const ctx: RankContext = {
    fuel: 'diesel',
    user: { lat: 44.416, lng: 11.976 }, // Bagnacavallo
    cohorts,
    now: new Date('2026-08-20T20:00:00Z'),
    liters: 45,
    kml: 16,
    blocked: new Set<string>(),
  };

  it('ordina per convenienza reale e non mette in cima distributori autostradali cari', () => {
    const ranked = rankStations(rows, ctx).filter((r) => r.distanceKm <= 20);
    const best = pickBest(ranked);

    expect(best).not.toBeNull();
    // Il migliore non deve essere un impianto autostradale costoso
    expect(best?.row.isHighway).toBe(false);

    // Controlliamo i primi 5
    const top5 = ranked.filter((r) => r.eligible).slice(0, 5);
    console.log('TOP 5 consigliati a Bagnacavallo (Diesel):');
    for (const r of top5) {
      console.log(`- ${r.row.brand} ${r.row.city || r.row.name}: ${r.price} €/L (${r.distanceKm.toFixed(1)}km), Netto: ${r.net.net.toFixed(2)}€, Livello: ${r.level}`);
    }

    // Le stazioni autostradali care (come Sarni Oil) non devono superare le stazioni urbane economiche
    const sarni = ranked.find((r) => r.row.brand?.includes('Sarni') || r.row.name?.includes("SANT'EUFEMIA"));
    if (sarni && top5.length > 0) {
      expect(top5[0]!.net.net).toBeGreaterThan(sarni.net.net);
    }
  });
});

/**
 * La regressione che ha fatto dire «mi consiglia il piu vicino, non quello
 * economico».
 *
 * Contando la distanza assoluta, ogni candidato si portava dietro un viaggio
 * andata e ritorno intero — anche la pompa a settecento metri. In una zona
 * dove i prezzi sono tutti attorno alla media di provincia il guadagno lordo
 * e quasi zero, quindi TUTTI i netti finivano sotto zero e a ordinare
 * restava solo la distanza. L'app consigliava il piu vicino e lo presentava
 * come «miglior scelta netta», con un «in tasca» negativo sotto.
 */
describe('il consiglio deve valere qualcosa, non essere solo il piu vicino', () => {
  const d = realDataset();
  const rows = parseStations(d.stations);
  const cohorts = buildCohorts(rows);

  const zone: Array<[string, number, number]> = [
    ['Bagnacavallo', 44.416, 11.976],
    ['Lugo', 44.4208, 11.911],
    ['Milano', 45.4642, 9.19],
    ['Roma', 41.9028, 12.4964],
  ];

  for (const [nome, lat, lng] of zone) {
    it(`a ${nome} il consigliato non perde soldi rispetto al piu vicino`, () => {
      const ranked = rankStations(rows, {
        fuel: 'benzina',
        user: { lat, lng },
        cohorts,
        now: new Date('2026-08-31T12:00:00Z'),
        liters: 38.25,
        kml: 15,
        blocked: new Set<string>(),
      }).filter((r) => r.distanceKm <= 20);

      const best = pickBest(ranked);
      expect(best).not.toBeNull();

      // Il netto del consiglio e per costruzione un confronto col pieno che
      // faresti comunque: se e negativo, stiamo consigliando una perdita.
      expect(best!.net.net).toBeGreaterThanOrEqual(0);

      // E non puo costare piu del piu vicino: sarebbe il peggio dei due mondi,
      // piu lontano E piu caro.
      const vicino = [...ranked]
        .filter((r) => r.eligible)
        .sort((a, b) => a.distanceKm - b.distanceKm)[0]!;
      expect(best!.price).toBeLessThanOrEqual(vicino.price);
    });
  }
});

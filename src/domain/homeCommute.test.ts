import { describe, it, expect } from 'vitest';
import {
  rankStations,
  pickBest,
  calculateDetourFriction,
  minutiDeviazione,
  limiteDeviazioneKm,
  netSaving,
  VALORE_TEMPO_EURO_ORA,
} from './ranking';
import type { RankContext } from './ranking';
import type { StationRow } from './parse';
import type { CohortIndex } from './market';
import type { Percorso } from './corridoio';

const cohorts: CohortIndex = {
  byProv: new Map([['RA|road|diesel', { avg: 1.8, std: 0.05, min: 1.7, max: 1.9, n: 20 }]]),
  bySegment: new Map(),
  byFuel: new Map([['diesel', { avg: 1.8, std: 0.05, min: 1.7, max: 1.9, n: 40 }]]),
};

function pompa(over: Partial<StationRow> & Pick<StationRow, 'id' | 'lat' | 'lng'>): StationRow {
  return {
    name: over.id,
    brand: 'Eni',
    operator: 'Eni',
    prov: 'RA',
    city: 'Russi',
    address: 'Via Ravegnana',
    isHighway: false,
    prices: { diesel: 1.76 },
    servito: {},
    updated: '2026-08-26 12:00',
    ...over,
  } as StationRow;
}

// Faenza -> Ravenna, circa 30 km in linea d'aria.
const FAENZA = { lat: 44.289, lng: 11.877 };
const RAVENNA = { lat: 44.418, lng: 12.203 };

const rows: StationRow[] = [
  // Praticamente sulla congiungente Faenza-Ravenna.
  pompa({ id: 'sul-percorso', lat: 44.353, lng: 12.04, prices: { diesel: 1.76 } }),
  // Nella direzione opposta: dietro le spalle.
  pompa({ id: 'alle-spalle', lat: 44.22, lng: 11.78, prices: { diesel: 1.74 }, city: 'Brisighella' }),
  // Molto piu a nord, fuori da qualunque rientro ragionevole.
  pompa({ id: 'lontanissima', lat: 44.69, lng: 12.18, prices: { diesel: 1.68 }, city: 'Comacchio' }),
];

describe('rientro verso casa', () => {
  const base: RankContext = {
    fuel: 'diesel',
    user: FAENZA,
    cohorts,
    now: new Date('2026-08-26T14:00:00Z'),
    liters: 40,
    kml: 16,
    blocked: new Set(),
  };

  it('senza casa impostata il costo strada e solo quello in piu rispetto al piu vicino', () => {
    const ranked = rankStations(rows, base);
    expect(ranked).toHaveLength(3);
    for (const r of ranked) expect(r.detourKm).toBeUndefined();

    const perDistanza = [...ranked].sort((a, b) => a.distanceKm - b.distanceKm);
    const vicino = perDistanza[0]!;
    const lontano = perDistanza[perDistanza.length - 1]!;

    // Il piu vicino e il pieno che faresti comunque: raggiungerlo non e un
    // costo aggiuntivo, e il suo guadagno rispetto a se stesso e zero.
    expect(vicino.net.roadCost).toBe(0);
    expect(vicino.net.gross).toBe(0);

    // Gli altri pagano solo i chilometri in piu, andata e ritorno.
    const extra = lontano.distanceKm - vicino.distanceKm;
    expect(lontano.net.roadCost).toBeCloseTo((2 * extra / base.kml) * lontano.price, 6);
    expect(lontano.net.roadCost).toBeLessThan((2 * lontano.distanceKm / base.kml) * lontano.price);
  });

  it('con casa impostata premia chi sta sul tragitto e scarta chi allunga troppo', () => {
    const ranked = rankStations(rows, { ...base, home: RAVENNA });
    const best = pickBest(ranked);

    const sul = ranked.find((r) => r.row.id === 'sul-percorso');
    expect(sul?.detourKm).toBeLessThan(1.0);
    expect(sul?.eligible).toBe(true);

    const lontana = ranked.find((r) => r.row.id === 'lontanissima');
    expect(lontana?.detourKm).toBeGreaterThan(25);
    expect(lontana?.eligible).toBe(false);
    expect(lontana?.reason).toBe('deviazione-eccessiva');

    expect(best?.row.id).toBe('sul-percorso');
  });

  it('col percorso stradale misura la deviazione sulla strada, non col triangolo', () => {
    const percorso: Percorso = {
      punti: [FAENZA, { lat: 44.32, lng: 11.95 }, { lat: 44.353, lng: 12.04 }, RAVENNA],
      km: 33,
    };
    const ranked = rankStations(rows, { ...base, home: RAVENNA, percorso });

    const sul = ranked.find((r) => r.row.id === 'sul-percorso');
    expect(sul?.deviazioneSuStrada).toBe(true);
    expect(sul?.detourKm).toBeLessThan(0.3);
    // Il totale parte dai km stradali del router, non dalla linea d'aria.
    expect(sul?.tripTotalKm).toBeGreaterThanOrEqual(33);
    expect(sul?.progresso).toBeGreaterThan(0.4);
  });

  it('senza percorso dichiara che la deviazione e una stima in linea d-aria', () => {
    const ranked = rankStations(rows, { ...base, home: RAVENNA });
    expect(ranked.every((r) => r.deviazioneSuStrada === false)).toBe(true);
  });

  it('il limite di deviazione cresce coi viaggi lunghi', () => {
    expect(limiteDeviazioneKm(4)).toBe(6);
    expect(limiteDeviazioneKm(80)).toBe(20);
  });
});

describe('attrito della deviazione', () => {
  it('e nullo a deviazione nulla e cresce col tempo perso', () => {
    expect(calculateDetourFriction(0)).toBe(0);
    expect(calculateDetourFriction(-1)).toBe(0);
    expect(calculateDetourFriction(4)).toBeGreaterThan(calculateDetourFriction(2));
  });

  it('vale il tempo perso piu l-usura, non un numero a caso', () => {
    // 35 km in deviazione = un'ora di guida al valore orario, piu l'usura.
    const atteso = VALORE_TEMPO_EURO_ORA + 35 * 0.06;
    expect(calculateDetourFriction(35)).toBeCloseTo(atteso, 6);
  });

  it('boccia i venti chilometri per pochi centesimi senza bisogno di curve', () => {
    // 45 litri a 8 centesimi sotto media = 3,60 € lordi.
    const conto = netSaving({
      price: 1.72,
      cohortAvg: 1.8,
      liters: 45,
      distanceKm: 20,
      kml: 16,
      confidence: 1,
      detourKm: 20,
    });
    expect(conto.gross).toBeCloseTo(3.6, 6);
    expect(conto.net).toBeLessThan(0);
  });

  it('conta i minuti, e per l-autostrada aggiunge rampe e casello', () => {
    expect(minutiDeviazione(0)).toBe(0);
    expect(minutiDeviazione(3.5)).toBeCloseTo(6, 5);
    expect(minutiDeviazione(3.5, true)).toBeCloseTo(14, 5);
  });
});

import { describe, it, expect } from 'vitest';
import { buildHomeModel, motivoDi } from './homeModel';
import { realDataset } from '../../domain/__fixtures__/dataset';
import { parseStations } from '../../domain/parse';
import { buildCohorts } from '../../domain/market';
import type { StationRow } from '../../domain/parse';
import type { RawDataset } from '../../domain/raw';
import { ADESSO, UTENTE, aKm, riga, coorte, cittaFinta, oreFa } from '../../domain/__fixtures__/sintetico';

const data = realDataset();
const rows = parseStations(data.stations);
const cohorts = buildCohorts(rows);
const ROMA = { lat: 41.9028, lng: 12.4964 };

function model(over: Partial<Parameters<typeof buildHomeModel>[0]> = {}) {
  return buildHomeModel({
    rows, cohorts, dataset: data, fuel: 'benzina', user: ROMA,
    now: new Date('2026-08-19T10:00:00'), liters: 38, kml: 15,
    blocked: new Set<string>(), radiusKm: 15, tankPct: null,
    ...over,
  });
}

describe('buildHomeModel — la risposta', () => {
  it('trova un migliore fra le stazioni romane', () => {
    const m = model();
    expect(m.best).not.toBeNull();
    expect(m.best!.distanceKm).toBeLessThanOrEqual(15);
  });

  it('il migliore NON e sempre il prezzo piu basso: conta il netto', () => {
    const m = model({ radiusKm: 300 });
    const minimo = Math.min(...m.list.map((i) => i.price));
    expect(m.best!.price).toBeGreaterThanOrEqual(minimo);
    expect(m.best!.distanceKm).toBeLessThan(300);
  });

  it('la lista mette gli eleggibili prima e parte dal consigliato', () => {
    const m = model();
    // Una stazione bloccata o dal prezzo assurdo non sale in cima solo
    // perche il suo netto e alto: prima viene l'eleggibilita.
    const primoIneleggibile = m.list.findIndex((i) => !i.eligible);
    if (primoIneleggibile >= 0) {
      for (const i of m.list.slice(primoIneleggibile)) expect(i.eligible).toBe(false);
    }
    expect(m.list[0]!.id).toBe(m.best!.row.id);
  });

  it('dichiara quanti impianti ha confrontato', () => {
    const m = model();
    expect(m.eligibleCount).toBe(m.list.filter((i) => i.eligible).length);
  });

  it('ogni riga porta la differenza rispetto al migliore', () => {
    const m = model();
    const primo = m.list.find((i) => i.id === m.best!.row.id);
    expect(primo?.deltaVsBest).toBe(0);
    const altro = m.list.find((i) => i.id !== m.best!.row.id);
    expect(altro?.deltaVsBest).toBeCloseTo(altro!.price - m.best!.price, 6);
  });

  it('rispetta il raggio', () => {
    for (const i of model({ radiusKm: 5 }).list) expect(i.distanceKm).toBeLessThanOrEqual(5);
  });

  it('nessun impianto batte il migliore sia nel netto che nella distanza', () => {
    // Se esistesse, la risposta sarebbe sbagliata in modo visibile: piu
    // caro E piu lontano non e mai "il migliore".
    const m = model();
    const b = m.best!;
    const dominanti = m.list
      .filter((i) => i.eligible && i.net > b.net.net && i.distanceKm < b.distanceKm)
      .map((i) => `${i.name} ${i.price} @ ${i.distanceKm.toFixed(2)}km net=${i.net.toFixed(3)}`);
    expect(dominanti).toEqual([]);
  });

  it('una stazione bloccata non puo essere la risposta', () => {
    const m = model();
    const id = m.best!.row.id;
    const m2 = model({ blocked: new Set([id]) });
    expect(m2.best?.row.id).not.toBe(id);
  });
});

describe('buildHomeModel — lo spettro', () => {
  it('sta sempre dentro la barra', () => {
    const s = model().spectrum!;
    expect(s.position).toBeGreaterThanOrEqual(0);
    expect(s.position).toBeLessThanOrEqual(1);
    expect(s.lo).toBeLessThan(s.hi);
  });

  it('la posizione viene dallo z, non dal min-max', () => {
    // Il difetto che questo test blocca: con una coorte dalla coda alta il
    // min-max metteva il segno a meta barra mentre il livello diceva
    // «Affarone». La barra e il livello devono raccontare la stessa cosa.
    const m = model();
    const s = m.spectrum!;
    const atteso = (m.best!.z! + 2) / 4;
    expect(s.position).toBeCloseTo(Math.max(0, Math.min(1, atteso)), 6);
  });

  it('un prezzo di livello "best" cade nella meta sinistra della barra', () => {
    const m = model();
    if (m.best!.level === 'best') expect(m.spectrum!.position).toBeLessThan(0.5);
  });

  it('i bordi sono a due scarti tipo dalla media', () => {
    const m = model();
    const s = m.spectrum!;
    expect(s.avg - s.lo).toBeCloseTo(s.hi - s.avg, 9);
    expect(s.avg).toBeCloseTo(m.best!.cohort.avg, 9);
  });

  it('dichiara da dove viene la coorte e quanti impianti la compongono', () => {
    const s = model().spectrum!;
    expect(s.n).toBeGreaterThanOrEqual(8);
    expect(s.source).toMatch(/province|segment|national/);
  });
});

describe('buildHomeModel — il verdetto', () => {
  it('produce sempre un consiglio con la sua motivazione', () => {
    const m = model();
    expect(m.advice).toBeTruthy();
    expect(m.adviceReason.length).toBeGreaterThan(10);
  });

  it('in riserva il consiglio e URGENT, qualunque cosa dica il prezzo', () => {
    expect(model({ tankPct: 0.05 }).advice).toBe('URGENT');
  });

  it('senza forecast non ne inventa uno', () => {
    const senza = { ...data, forecast: {} } as typeof data;
    expect(model({ dataset: senza }).forecast).toBeNull();
  });

  it("senza forecast utilizzabile non scrive nemmeno l'impatto in euro", () => {
    const senza = { ...data, forecast: {} } as typeof data;
    expect(model({ dataset: senza }).adviceImpactEur).toBeNull();
  });

  it("l'impatto in euro viene dal delta del forecast di backend, sui litri considerati", () => {
    const finto = {
      ...data,
      forecast: { benzina: { direction: 'down', delta_c: -2.5, days_ahead: 7, confidence: 0.8 } },
    } as unknown as typeof data;
    const m = model({ dataset: finto, liters: 40 });
    // −2,5 cent/L su 40 L = 1,00 € risparmiati aspettando.
    expect(m.adviceImpactEur).toBeCloseTo(1.0, 6);
  });

  it('con i prezzi attesi in salita aspettare costa, e il segno lo dice', () => {
    const finto = {
      ...data,
      forecast: { benzina: { direction: 'up', delta_c: 3, days_ahead: 5, confidence: 0.7 } },
    } as unknown as typeof data;
    expect(model({ dataset: finto, liters: 40 }).adviceImpactEur).toBeLessThan(0);
  });

  it('senza forecast e senza un affarone dichiara il segnale insufficiente', () => {
    // Serve un caso in cui il migliore NON sia di livello "best": con una
    // coorte dalla coda alta, il prezzo piu basso resta solo "conviene".
    const prezzi = [
      1.900, 1.902, 1.904, 1.906, 1.908, 1.910, 1.912, 1.914, 1.916, 1.918,
      2.600, 2.600, 2.600,
    ];
    const sintetiche = prezzi.map((p, k) => ({
      id: `s${k}`, name: `S${k}`, brand: 'X', operator: '', prov: 'RM', city: 'Roma',
      address: '', isHighway: false, lat: 41.9028 + k * 0.0005, lng: 12.4964,
      prices: { benzina: p }, servito: {}, updated: '2026-08-19 08:00',
    }));
    const m = buildHomeModel({
      rows: sintetiche, cohorts: buildCohorts(sintetiche),
      dataset: { ...data, forecast: {} } as typeof data,
      fuel: 'benzina', user: ROMA, now: new Date('2026-08-19T10:00:00'),
      liters: 38, kml: 15, blocked: new Set<string>(), radiusKm: 15, tankPct: null,
    });
    expect(m.best!.level).not.toBe('best');
    expect(m.advice).toBe('PRICE-ONLY');
    expect(m.adviceReason).toContain('segnale insufficiente');
  });
});

describe('buildHomeModel — il tabellone', () => {
  it('riassume quanti impianti, il migliore e il peggiore in vista', () => {
    const b = model().board;
    expect(b.count).toBe(model().list.length);
    expect(b.best!).toBeLessThanOrEqual(b.worst!);
  });

  it('con zero stazioni non si rompe e non inventa numeri', () => {
    const m = model({ user: { lat: 0, lng: 0 }, radiusKm: 1 });
    expect(m.best).toBeNull();
    expect(m.list).toEqual([]);
    expect(m.board.count).toBe(0);
    expect(m.board.best).toBeNull();
    expect(m.spectrum).toBeNull();
  });
});

/* ── Il consigliato è il primo della lista (revisione, B7) ─────────────── */

const datasetFinto = { forecast: {}, history: {}, national: {}, by_province: {}, fuels: ['diesel'], stations: [], extracted_at: '2026-10-13' } as unknown as RawDataset;
const coorteFinta = buildCohorts(coorte('RA', 'diesel', 2.0));

function vicino(righe: StationRow[]) {
  return buildHomeModel({
    rows: righe, cohorts: coorteFinta, dataset: datasetFinto, fuel: 'diesel', user: UTENTE,
    now: ADESSO, liters: 40, kml: 18, blocked: new Set<string>(), radiusKm: 15, tankPct: null,
  });
}

describe('buildHomeModel — il consigliato e la lista dicono la stessa cosa', () => {
  it('anche quando il più conveniente ha un prezzo vecchio', () => {
    // Prima: in cima alla lista un 1,86 di cinque giorni fa, consigliato un
    // altro, e «km risparmiati» negativi.
    const m = vicino([
      riga({ id: 'vecchio', ...aKm(0.4), prices: { diesel: 1.86 }, updated: oreFa(130) }),
      riga({ id: 'fresco', ...aKm(5.0), prices: { diesel: 1.98 } }),
      riga({ id: 'rif', ...aKm(0.2), prices: { diesel: 2.05 } }),
    ]);
    expect(m.list[0]!.id).toBe(m.best!.row.id);
  });

  it('anche quando vince il più vicino per parità', () => {
    const m = vicino([
      riga({ id: 'a', ...aKm(0), prices: { diesel: 1.95 } }),
      riga({ id: 'b', ...aKm(0, 0.64), prices: { diesel: 1.943 } }),
    ]);
    expect(m.best!.row.id).toBe('a');
    expect(m.list[0]!.id).toBe('a');
  });

  it('su venti città finte', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const m = vicino(cittaFinta(seed));
      expect(m.list[0]!.id, `città #${seed}`).toBe(m.best!.row.id);
      expect(m.best!.net.net, `città #${seed}`).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('buildHomeModel — chi non si consiglia resta in lista, col suo motivo', () => {
  it('autostrada, forse chiuso, nascosto e prezzo fuori mercato si leggono nella riga', () => {
    const altrove = riga({ id: 'altrove', ...aKm(0, 300) }); // il lotto è di adesso
    const m = buildHomeModel({
      rows: [
        riga({ id: 'ok', ...aKm(1), prices: { diesel: 2.0 } }),
        riga({ id: 'hw', ...aKm(0.3), isHighway: true, prices: { diesel: 1.95 } }),
        riga({ id: 'chiuso', ...aKm(0.5), prices: { diesel: 1.96 }, updated: oreFa(240) }),
        riga({ id: 'nascosto', ...aKm(0.7), prices: { diesel: 1.97 } }),
        riga({ id: 'errore', ...aKm(0.9), prices: { diesel: 1.2 } }),
        altrove,
      ],
      cohorts: coorteFinta, dataset: datasetFinto, fuel: 'diesel', user: UTENTE,
      now: ADESSO, liters: 40, kml: 18, blocked: new Set(['nascosto']), radiusKm: 15, tankPct: null,
    });
    const motivo = (id: string) => m.list.find((i) => i.id === id)!.motivo;
    expect(m.best!.row.id).toBe('ok');
    expect(m.list[0]!.id).toBe('ok');
    expect(motivo('ok')).toBeUndefined();
    expect(motivo('hw')).toBe('in autostrada');
    expect(motivo('chiuso')).toBe('forse chiuso');
    expect(motivo('nascosto')).toBe('nascosto');
    expect(motivo('errore')).toBe('prezzo fuori mercato');
  });

  it('se nessuno è consigliabile non c’è consiglio, ma la lista sì', () => {
    const m = vicino([
      riga({ id: 'hw', ...aKm(0.3), isHighway: true }),
      riga({ id: 'hw2', ...aKm(2), isHighway: true }),
    ]);
    expect(m.best).toBeNull();
    expect(m.list.map((i) => i.motivo)).toEqual(['in autostrada', 'in autostrada']);
  });
});

describe('motivoDi', () => {
  it('«troppa strada» non scrive mai un numero di minuti dentro il tetto', () => {
    // 20,2 minuti sono oltre i venti: «+20 min, troppa strada» smentiva il
    // foglio Perché («mai oltre 20 minuti in più»).
    expect(motivoDi({ nonConsigliabile: 'troppa-strada', minutiInPiu: 20.2 })).toBe('+21 min, troppa strada');
    expect(motivoDi({ nonConsigliabile: 'troppa-strada', minutiInPiu: 34 })).toBe('+34 min, troppa strada');
    expect(motivoDi({ nonConsigliabile: 'prezzo-vecchio', minutiInPiu: 3 })).toBe('prezzo vecchio');
  });
});

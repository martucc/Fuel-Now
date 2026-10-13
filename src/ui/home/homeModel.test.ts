import { describe, it, expect } from 'vitest';
import { buildHomeModel } from './homeModel';
import { realDataset } from '../../domain/__fixtures__/dataset';
import { parseStations } from '../../domain/parse';
import { buildCohorts } from '../../domain/market';

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

  it('la lista mette gli eleggibili prima, e dentro ciascun gruppo ordina per netto', () => {
    const m = model();
    // Una stazione bloccata o dal prezzo assurdo non sale in cima solo
    // perche il suo netto e alto: prima viene l'eleggibilita.
    const primoIneleggibile = m.list.findIndex((i) => !i.eligible);
    if (primoIneleggibile >= 0) {
      for (const i of m.list.slice(primoIneleggibile)) expect(i.eligible).toBe(false);
    }
    const gruppi = [m.list.filter((i) => i.eligible), m.list.filter((i) => !i.eligible)];
    for (const g of gruppi) {
      for (let k = 1; k < g.length; k++) expect(g[k - 1]!.net).toBeGreaterThanOrEqual(g[k]!.net);
    }
  });

  it('dichiara quanti impianti ha confrontato', () => {
    const m = model();
    expect(m.bestRank).toBeGreaterThanOrEqual(1);
    expect(m.eligibleCount).toBe(m.list.filter((i) => i.eligible).length);
  });

  it('se il migliore non guida la classifica, dice quanti km fa risparmiare', () => {
    const m = model();
    if (m.bestRank === 1) {
      expect(m.tieSavedKm).toBeNull();
    } else {
      // Chi guida per netto e piu lontano: e per questo che non ha vinto.
      expect(m.tieSavedKm).toBeGreaterThan(0);
    }
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

import { describe, it, expect } from 'vitest';
import { clusterStations, cellSizeForZoom, markerBudgetForZoom, limitToBudget, recolorForView } from './cluster';
import type { ListItem } from '../home/homeModel';

function item(id: string, lat: number, lng: number, price: number, level: ListItem['level'] = 'normal'): ListItem {
  return {
    id, name: `S${id}`, brand: 'Eni', city: 'Roma', lat, lng, price, level,
    levelLabel: 'Nella media', reliable: true, distanceKm: 1, ageLabel: 'oggi',
    // Netto coerente col prezzo: piu costa, meno conviene.
    net: (2.2 - price) * 40, deltaVsBest: 0, eligible: true,
  };
}

describe('cellSizeForZoom', () => {
  it('a zoom alto le celle sono piu piccole', () => {
    expect(cellSizeForZoom(16).lng).toBeLessThan(cellSizeForZoom(8).lng);
    expect(cellSizeForZoom(16).lat).toBeLessThan(cellSizeForZoom(8).lat);
  });

  it('e sempre positiva', () => {
    for (const z of [1, 5, 8, 10, 12, 14, 16, 18, 20]) {
      expect(cellSizeForZoom(z).lat).toBeGreaterThan(0);
      expect(cellSizeForZoom(z).lng).toBeGreaterThan(0);
    }
  });

  it('la cella e dimensionata sulla pillola: in uno schermo da 390px ne stanno almeno cinque', () => {
    // Con celle troppo larghe la mappa mostrava 27 pillole per tutta Roma.
    for (const z of [8, 11, 13, 15]) {
      const gradiPerPx = 360 / (256 * Math.pow(2, z));
      const larghezzaSchermo = 390 * gradiPerPx;
      expect(larghezzaSchermo / cellSizeForZoom(z).lng).toBeGreaterThanOrEqual(5);
    }
  });
});

describe('clusterStations', () => {
  it('a zoom massimo ogni stazione resta sola', () => {
    const items = [item('a', 41.900, 12.500, 1.8), item('b', 41.901, 12.501, 1.9)];
    const cs = clusterStations(items, 18);
    expect(cs).toHaveLength(2);
    expect(cs.every((c) => c.count === 1)).toBe(true);
  });

  it('a zoom basso stazioni vicine finiscono in un solo gruppo', () => {
    const items = [item('a', 41.90, 12.50, 1.8), item('b', 41.91, 12.51, 1.9), item('c', 41.92, 12.52, 2.0)];
    const cs = clusterStations(items, 4);
    expect(cs).toHaveLength(1);
    expect(cs[0]!.count).toBe(3);
  });

  it('NON perde nessuna stazione: il totale dei gruppi eguaglia il totale in ingresso', () => {
    const items = Array.from({ length: 200 }, (_, i) =>
      item(String(i), 41 + (i % 20) * 0.05, 12 + Math.floor(i / 20) * 0.05, 1.7 + (i % 7) * 0.02));
    for (const z of [4, 8, 11, 14, 17]) {
      const tot = clusterStations(items, z).reduce((s, c) => s + c.count, 0);
      expect(tot).toBe(200);
    }
  });

  it('il gruppo dichiara il prezzo del suo membro piu conveniente', () => {
    const items = [item('a', 41.90, 12.50, 1.999), item('b', 41.91, 12.51, 1.799)];
    const c = clusterStations(items, 4)[0]!;
    expect(c.bestPrice).toBe(1.799);
    expect(c.bestId).toBe('b');
  });

  it('un prezzo vecchio e piu basso NON parla per tutto il gruppo', () => {
    // Il caso reale: impianti con prezzi di due mesi fa risultavano i piu
    // economici d Italia. Il netto porta dentro la freschezza.
    const vecchioEconomico = { ...item('vecchio', 41.90, 12.50, 1.60), net: 1.0, ageLabel: '73 giorni fa' };
    const frescoNormale = { ...item('fresco', 41.91, 12.51, 1.90), net: 9.0, ageLabel: '3h fa' };
    const c = clusterStations([vecchioEconomico, frescoNormale], 4)[0]!;
    expect(c.bestId).toBe('fresco');
  });

  it('il gruppo prende il livello del suo membro migliore, cosi il colore non mente', () => {
    const items = [item('a', 41.90, 12.50, 1.999, 'worst'), item('b', 41.91, 12.51, 1.799, 'best')];
    expect(clusterStations(items, 4)[0]!.level).toBe('best');
  });

  it('il gruppo si posa sul suo membro migliore, non su un baricentro inventato', () => {
    const items = [item('a', 41.90, 12.50, 1.999), item('b', 41.95, 12.55, 1.799)];
    const c = clusterStations(items, 4)[0]!;
    expect(c.lat).toBe(41.95);
    expect(c.lng).toBe(12.55);
  });

  it('con nessuna stazione restituisce nessun gruppo', () => {
    expect(clusterStations([], 12)).toEqual([]);
  });
});

describe('markerBudgetForZoom', () => {
  it('meno zoom, meno pillole', () => {
    const zoom = [17, 16, 15, 14, 13, 12, 10, 8, 5];
    const budget = zoom.map(markerBudgetForZoom);
    for (let i = 1; i < budget.length; i++) {
      expect(budget[i]!).toBeLessThanOrEqual(budget[i - 1]!);
    }
  });

  it('non scende mai a due marker come faceva zoomLimit', () => {
    expect(markerBudgetForZoom(1)).toBeGreaterThanOrEqual(8);
  });
});

describe('limitToBudget', () => {
  const molti = Array.from({ length: 300 }, (_, i) =>
    item(String(i), 41 + i * 0.01, 12 + i * 0.01, 1.6 + i * 0.002));

  it('a zoom basso tiene solo i piu convenienti', () => {
    const cs = clusterStations(molti, 8);
    const tenuti = limitToBudget(cs, 8);
    expect(tenuti.length).toBe(markerBudgetForZoom(8));
    const nettoMinimoTenuto = Math.min(...tenuti.map((c) => c.bestNet));
    const scartati = cs.filter((c) => !tenuti.includes(c)).map((c) => c.bestNet);
    for (const n of scartati) expect(n).toBeLessThanOrEqual(nettoMinimoTenuto);
  });

  it('a zoom alto non toglie niente se ci stanno tutti', () => {
    const pochi = clusterStations(molti.slice(0, 20), 17);
    expect(limitToBudget(pochi, 17).length).toBe(pochi.length);
  });

  it('il consigliato resta anche se non e fra i piu convenienti', () => {
    const cs = clusterStations(molti, 8);
    const carissimo = [...cs].sort((a, b) => a.bestNet - b.bestNet)[0]!;
    const id = carissimo.members[0]!.id;
    const tenuti = limitToBudget(cs, 8, id);
    expect(tenuti.some((c) => c.members.some((m) => m.id === id))).toBe(true);
    expect(tenuti.length).toBe(markerBudgetForZoom(8));
  });

  it('il piu conveniente viene disegnato per ultimo, cosi sta sopra agli altri', () => {
    const tenuti = limitToBudget(clusterStations(molti, 8), 8);
    const netti = tenuti.map((c) => c.bestNet);
    expect(netti[netti.length - 1]).toBe(Math.max(...netti));
  });
});

describe('recolorForView', () => {
  function cluster(price: number, level: ListItem['level'] = 'best'): any {
    const m = item(String(price), 41, 12, price, level);
    return { bestId: m.id, lat: 41, lng: 12, bestPrice: price, bestNet: (2.2 - price) * 40, level, count: 1, members: [m] };
  }

  it('col piu economico d Italia in vista i colori tornano a distinguersi', () => {
    // Tutti «best» rispetto alla loro provincia: senza ricolorare sarebbero
    // tutti verdi e la mappa non direbbe piu niente.
    const cs = [1.70, 1.75, 1.80, 1.85, 1.95].map((p) => cluster(p, 'best'));
    const dopo = recolorForView(cs);
    expect(new Set(dopo.map((c) => c.level)).size).toBeGreaterThan(1);
  });

  it('il piu economico della vista resta il piu verde', () => {
    const cs = [1.70, 1.80, 1.90, 2.00, 2.10].map((p) => cluster(p, 'normal'));
    const dopo = recolorForView(cs);
    const ordinati = [...dopo].sort((a, b) => a.bestPrice - b.bestPrice);
    const scala = ['best', 'good', 'normal', 'high', 'worst'];
    expect(scala.indexOf(ordinati[0]!.level)).toBeLessThan(
      scala.indexOf(ordinati[ordinati.length - 1]!.level)
    );
  });

  it('con poche pillole tiene il livello della coorte: una media di tre prezzi non dice nulla', () => {
    const cs = [1.70, 1.90, 2.10].map((p) => cluster(p, 'best'));
    expect(recolorForView(cs).every((c) => c.level === 'best')).toBe(true);
  });

  it('se i prezzi sono tutti uguali non inventa differenze', () => {
    const cs = [1.9, 1.9, 1.9, 1.9, 1.9].map((p) => cluster(p, 'good'));
    expect(recolorForView(cs).every((c) => c.level === 'good')).toBe(true);
  });

  it('non cambia prezzi, posizioni ne conteggi', () => {
    const cs = [1.70, 1.80, 1.90, 2.00].map((p) => cluster(p));
    const dopo = recolorForView(cs);
    expect(dopo.map((c) => c.bestPrice)).toEqual(cs.map((c) => c.bestPrice));
    expect(dopo.map((c) => c.count)).toEqual(cs.map((c) => c.count));
  });
});

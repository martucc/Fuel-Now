import { describe, it, expect } from 'vitest';
import { whyRows } from './why';
import type { RankedStation } from '../../domain/ranking';
import { netSaving } from '../../domain/ranking';

const cohort = { avg: 1.95, std: 0.04, min: 1.82, max: 2.10, n: 120, source: 'province-road' as const, reliable: true };
const net = netSaving({ price: 1.879, cohortAvg: 1.95, liters: 38, distanceKm: 3.2, kml: 15, confidence: 0.9 });

const r: RankedStation = {
  row: { id: '1', name: 'X', brand: 'Eni', operator: '', prov: 'RM', city: 'Roma', address: '',
         isHighway: false, lat: 41.9, lng: 12.5, prices: { benzina: 1.879 }, servito: {}, updated: '2026-08-19 08:00' },
  price: 1.879, distanceKm: 3.2, cohort, z: -1.775, level: 'best', reliable: true,
  ageH: 6, confidence: 0.9, net, eligible: true,
};

describe('whyRows', () => {
  it('mostra ogni ingresso del conto, in ordine', () => {
    const etichette = whyRows(r).map((x) => x.label);
    expect(etichette).toEqual([
      'Litri considerati',
      'Media della zona',
      'Prezzo qui',
      'Risparmio lordo',
      'Distanza (andata e ritorno)',
      'Consumo stimato',
      'Costo del viaggio',
      'Eta del dato',
      'Coefficiente di fiducia',
      'In tasca',
    ]);
  });

  it('il netto e quello gia calcolato, non uno ricalcolato dal foglio', () => {
    const riga = whyRows(r).find((x) => x.label === 'In tasca');
    expect(riga?.value).toContain(net.net.toFixed(2).replace('.', ','));
    expect(riga?.emphasis).toBe(true);
  });

  it('la distanza dichiara che e andata e ritorno', () => {
    const riga = whyRows(r).find((x) => x.label.startsWith('Distanza'));
    expect(riga?.value).toContain('6,4');
  });

  it("l'eta e scritta a parole, non in ore grezze", () => {
    const riga = whyRows(r).find((x) => x.label.startsWith('Eta'));
    expect(riga?.value).not.toMatch(/^\d+$/);
  });

  it('nessuna riga resta vuota: una scatola nera parziale e sempre una scatola nera', () => {
    for (const x of whyRows(r)) expect(x.value.trim().length).toBeGreaterThan(0);
  });
});

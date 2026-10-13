import { describe, it, expect } from 'vitest';
import { toFuelStation, toFuelStations } from './adapter';
import type { StationRow } from '../domain/parse';

const row: StationRow = {
  id: '42',
  name: 'Stazione Prova',
  brand: 'Q8',
  operator: 'Tizio',
  prov: 'RM',
  city: 'Roma',
  address: 'Via Prova 1',
  isHighway: false,
  lat: 41.9,
  lng: 12.5,
  prices: { benzina: 1.879, diesel: 1.759 },
  servito: { benzina: 2.049 },
  updated: '2026-08-18 10:00',
};

describe('toFuelStation', () => {
  it('traduce le chiavi carburante nelle etichette che usano le tab vecchie', () => {
    const s = toFuelStation(row);
    const tipi = s.prices.map((p) => p.type).sort();
    expect(tipi).toEqual(['Benzina', 'Benzina', 'Diesel']);
  });

  it('marca self e servito distintamente', () => {
    const s = toFuelStation(row);
    const self = s.prices.filter((p) => p.isSelf);
    const servito = s.prices.filter((p) => !p.isSelf);
    expect(self.map((p) => p.price).sort()).toEqual([1.759, 1.879]);
    expect(servito.map((p) => p.price)).toEqual([2.049]);
  });

  it('mette il prezzo confrontabile per primo, perche le tab vecchie leggono prices.find()', () => {
    const s = toFuelStation(row);
    const primaBenzina = s.prices.find((p) => p.type === 'Benzina');
    expect(primaBenzina?.price).toBe(1.879);
    expect(primaBenzina?.isSelf).toBe(true);
  });

  it('dichiara i servizi che i filtri esistenti si aspettano', () => {
    expect(toFuelStation(row).services).toContain('Self-Service');
    expect(toFuelStation({ ...row, isHighway: true }).services).toContain('Autostrada');
    expect(toFuelStation(row).services).not.toContain('Autostrada');
  });

  it('calcola la distanza solo se sa dov e l utente', () => {
    expect(toFuelStation(row).distance).toBeUndefined();
    const s = toFuelStation(row, { lat: 41.9, lng: 12.5 });
    expect(s.distance).toBe(0);
  });

  it('riporta la distanza in km con un decimale', () => {
    const s = toFuelStation(row, { lat: 41.8, lng: 12.5 });
    expect(s.distance).toBeCloseTo(11.1, 1);
    expect(String(s.distance)).toMatch(/^\d+(\.\d)?$/);
  });

  it('propaga la data di aggiornamento su ogni prezzo', () => {
    for (const p of toFuelStation(row).prices) expect(p.lastUpdated).toBe('2026-08-18 10:00');
  });

  it('non perde stazioni nella conversione in blocco', () => {
    expect(toFuelStations([row, { ...row, id: '43' }])).toHaveLength(2);
  });
});

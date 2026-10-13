import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getStations, getRows } from './dataService';
import { creaNegozioDataset, usaNegozioPerTest } from '../data/dataset';

const OGGI = '2026-08-19 08:00';
const VENTI_GIORNI_FA = '2026-07-30 08:00';

const dataset = {
  stations: [
    { id: 1, name: 'Recente', brand: 'Eni', operator: 'x', prov: 'RM', city: 'Roma',
      address: 'Via A', lat: 41.90, lng: 12.50, is_highway: false,
      p: { benzina: [1.879, null] }, updated: OGGI },
    { id: 2, name: 'Vecchia', brand: 'Q8', operator: 'y', prov: 'RM', city: 'Roma',
      address: 'Via B', lat: 41.91, lng: 12.51, is_highway: false,
      p: { benzina: [1.799, null] }, updated: VENTI_GIORNI_FA },
  ],
  national: {}, by_province: {}, forecast: {}, history: {},
};

beforeEach(() => {
  usaNegozioPerTest(creaNegozioDataset({
    archivio: { leggi: async () => null, scrivi: async () => {} },
    scarica: async () => JSON.stringify(dataset),
    pacchetto: async () => null,
    adesso: () => Date.now(),
    attendi: async () => {},
    minStazioni: 1,
  }));
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, async json() { return []; } })));
});

afterEach(() => { vi.unstubAllGlobals(); usaNegozioPerTest(null); });

describe('getStations — spec § 7', () => {
  it('NON nasconde una stazione vecchia di 20 giorni', async () => {
    const { stations } = await getStations();
    expect(stations.map((s) => s.name).sort()).toEqual(['Recente', 'Vecchia']);
  });

  it("conserva la data di aggiornamento, cosi l'eta puo essere mostrata", async () => {
    const { stations } = await getStations();
    const vecchia = stations.find((s) => s.name === 'Vecchia');
    expect(vecchia?.prices[0]?.lastUpdated).toBe(VENTI_GIORNI_FA);
  });

  it('espone le righe di dominio non filtrate: le coorti hanno bisogno di tutte', async () => {
    await getStations({ lat: 45.0, lng: 9.0 });
    expect(getRows()).toHaveLength(2);
  });

  it('con una posizione ordina per distanza crescente', async () => {
    const { stations } = await getStations({ lat: 41.90, lng: 12.50 });
    expect(stations[0]?.name).toBe('Recente');
    expect(stations[0]?.distance).toBeLessThanOrEqual(stations[1]?.distance ?? Infinity);
  });
});

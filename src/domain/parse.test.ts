import { describe, it, expect } from 'vitest';
import { parseStation, parseStations, isValidProv, dropMisgeocoded, prezzoAllaPompa } from './parse';
import type { StationRow } from './parse';
import type { RawStation } from './raw';
import { realDataset } from './__fixtures__/dataset';

const base: RawStation = {
  id: 1, name: 'Eni Test', brand: 'Agip Eni', operator: 'ACME',
  type: 'Stradale', is_highway: false, address: 'Via Roma 1', city: 'PESCARA',
  prov: 'PE', lat: 42.46, lng: 14.21,
  p: { benzina: [1.899, 1.999], diesel: [2.029, null] },
  updated: '2026-06-08 10:04',
};

describe('isValidProv', () => {
  it('accetta solo due maiuscole', () => {
    expect(isValidProv('PE')).toBe(true);
    expect(isValidProv('pe')).toBe(false);
    expect(isValidProv('')).toBe(false);
    expect(isValidProv('Via Vestina 408 65015')).toBe(false);
  });
});

describe('parseStation', () => {
  it('normalizza i campi e applica la regola di selezione', () => {
    const r = parseStation(base)!;
    expect(r.id).toBe('1');
    expect(r.prov).toBe('PE');
    expect(r.isHighway).toBe(false);
    expect(r.prices.benzina).toBe(1.899);
    expect(r.prices.diesel).toBe(2.029);
    expect(r.servito.benzina).toBe(1.999);
    expect(r.servito.diesel).toBeUndefined();
  });

  it('mette prov a null quando il campo contiene spazzatura', () => {
    const r = parseStation({ ...base, prov: 'Via Vestina 408 65015' })!;
    expect(r.prov).toBeNull();
  });

  it('conserva la stazione anche se un solo carburante è utilizzabile', () => {
    const r = parseStation({ ...base, p: { gpl: [null, 0.799] } })!;
    expect(r.prices.gpl).toBe(0.799);
  });

  it('tiene la stazione che per il diesel ha solo il servito (B6)', () => {
    // Prima spariva: per diesel e benzina la statistica usa solo il self, e
    // senza self la riga veniva buttata. Ma lì si fa benzina, al servito.
    const r = parseStation({ ...base, p: { diesel: [null, 2.19] } })!;
    expect(r).not.toBeNull();
    expect(r.prices.diesel).toBeUndefined(); // fuori dalle statistiche
    expect(r.servito.diesel).toBe(2.19);
    expect(prezzoAllaPompa(r, 'diesel')).toEqual({ prezzo: 2.19, alServito: true });
    expect(prezzoAllaPompa(r, 'benzina')).toBeNull();
  });

  it('il prezzo alla pompa è il self quando c’è', () => {
    expect(prezzoAllaPompa(parseStation(base)!, 'benzina')).toEqual({ prezzo: 1.899, alServito: false });
  });

  it('scarta la stazione senza alcun prezzo plausibile', () => {
    expect(parseStation({ ...base, p: { diesel: [null, 9.99], benzina: [0.01, null] } })).toBeNull();
  });

  it('scarta la stazione con coordinate non finite', () => {
    expect(parseStation({ ...base, lat: NaN })).toBeNull();
  });

  it('usa "Indipendente" quando la bandiera è vuota', () => {
    expect(parseStation({ ...base, brand: '' })!.brand).toBe('Indipendente');
  });
});

describe('parseStations sul dataset reale', () => {
  const rows = parseStations(realDataset().stations);

  it('conserva la grande maggioranza degli impianti', () => {
    expect(rows.length).toBeGreaterThan(20000);
  });

  it('non lascia passare nessuna prov invalida', () => {
    for (const r of rows) {
      if (r.prov !== null) expect(isValidProv(r.prov)).toBe(true);
    }
  });

  it('lascia qualche riga senza provincia, senza scartarla', () => {
    const orphans = rows.filter((r) => r.prov === null);
    expect(orphans.length).toBeGreaterThan(0);
    expect(orphans.length).toBeLessThan(100);
  });

  it('ogni riga conservata ha almeno un prezzo, self o servito', () => {
    for (const r of rows) {
      expect(Object.keys(r.prices).length + Object.keys(r.servito).length, r.id).toBeGreaterThan(0);
    }
  });
});

describe('dropMisgeocoded', () => {
  function riga(over: Partial<StationRow>): StationRow {
    return {
      id: 'x', name: 'Impianto', brand: 'Marchio', operator: '',
      prov: 'MI', city: 'MILANO', address: '', isHighway: false,
      lat: 45.4642, lng: 9.19,
      prices: { benzina: 1.8 }, servito: {}, updated: null,
      ...over,
    };
  }

  it('lascia stare gli impianti che stanno ognuno per conto suo', () => {
    const righe = [
      riga({ id: 'a', lat: 45.1, lng: 9.1, prov: 'MI' }),
      riga({ id: 'b', lat: 44.9, lng: 11.3, prov: 'MO' }),
    ];
    expect(dropMisgeocoded(righe).map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('tiene due impianti nello stesso punto se sono della stessa provincia', () => {
    // Due pompe nello stesso piazzale sono normali: non e un errore di dati.
    const righe = [
      riga({ id: 'a', lat: 45.1, lng: 9.1, prov: 'MI' }),
      riga({ id: 'b', lat: 45.1, lng: 9.1, prov: 'MI' }),
    ];
    expect(dropMisgeocoded(righe)).toHaveLength(2);
  });

  it('butta via il punto dove due province si sovrappongono', () => {
    const righe = [
      riga({ id: 'a', lat: 45.464204, lng: 9.189982, prov: 'MO', city: 'FINALE EMILIA' }),
      riga({ id: 'b', lat: 45.464204, lng: 9.189982, prov: 'PR', city: 'SALA BAGANZA' }),
      riga({ id: 'c', lat: 45.1, lng: 9.1, prov: 'MI' }),
    ];
    expect(dropMisgeocoded(righe).map((r) => r.id)).toEqual(['c']);
  });

  it('porta via anche i compagni senza provincia, che condividono lo stesso punto falso', () => {
    const righe = [
      riga({ id: 'a', lat: 1, lng: 1, prov: 'MO' }),
      riga({ id: 'b', lat: 1, lng: 1, prov: 'PR' }),
      riga({ id: 'c', lat: 1, lng: 1, prov: null }),
    ];
    expect(dropMisgeocoded(righe)).toEqual([]);
  });

  it('non tocca un gruppo dove la provincia manca ma non contraddice', () => {
    const righe = [
      riga({ id: 'a', lat: 1, lng: 1, prov: 'MI' }),
      riga({ id: 'b', lat: 1, lng: 1, prov: null }),
    ];
    expect(dropMisgeocoded(righe)).toHaveLength(2);
  });
});

describe('dropMisgeocoded: fuori dalla propria provincia', () => {
  function riga(over: Partial<StationRow>): StationRow {
    return {
      id: 'x', name: 'Impianto', brand: 'Marchio', operator: '',
      prov: 'NU', city: 'NUORO', address: '', isHighway: false,
      lat: 40.32, lng: 9.33,
      prices: { benzina: 1.8 }, servito: {}, updated: null,
      ...over,
    };
  }

  /** Dieci impianti sparsi di poco: la provincia normale. */
  function provincia(prov: string, lat: number, lng: number, quanti = 10): StationRow[] {
    return Array.from({ length: quanti }, (_, i) =>
      riga({ id: `${prov}-${i}`, prov, lat: lat + i * 0.01, lng: lng + i * 0.01 })
    );
  }

  it('toglie l impianto di Nuoro che risulta a Milano', () => {
    const righe = [
      ...provincia('NU', 40.32, 9.33),
      riga({ id: 'fantasma', prov: 'NU', lat: 45.4642, lng: 9.19 }),
    ];
    const restano = dropMisgeocoded(righe).map((r) => r.id);
    expect(restano).not.toContain('fantasma');
    expect(restano).toHaveLength(10);
  });

  it('non tocca una provincia lunga, dove stare lontani dal centro e normale', () => {
    // Il Salento e allungato: la soglia si adatta alla larghezza della provincia.
    const lunga = Array.from({ length: 12 }, (_, i) =>
      riga({ id: `LE-${i}`, prov: 'LE', lat: 40.0 + i * 0.08, lng: 18.0 + i * 0.05 })
    );
    expect(dropMisgeocoded(lunga)).toHaveLength(12);
  });

  it('non accusa nessuno quando la provincia ha pochi impianti', () => {
    // Con quattro righe la mediana non e una statistica, e un'opinione.
    const poche = [
      riga({ id: 'a', prov: 'AO', lat: 45.73, lng: 7.32 }),
      riga({ id: 'b', prov: 'AO', lat: 45.74, lng: 7.33 }),
      riga({ id: 'c', prov: 'AO', lat: 45.75, lng: 7.34 }),
      riga({ id: 'd', prov: 'AO', lat: 41.9, lng: 12.5 }),
    ];
    expect(dropMisgeocoded(poche)).toHaveLength(4);
  });

  it('lascia stare gli impianti senza provincia, che non si possono confrontare', () => {
    const righe = [...provincia('NU', 40.32, 9.33), riga({ id: 'muto', prov: null, lat: 45.46, lng: 9.19 })];
    expect(dropMisgeocoded(righe).map((r) => r.id)).toContain('muto');
  });
});

import { describe, it, expect } from 'vitest';
import type { StationRow } from './parse';
import type { RawDataset } from './raw';
import { buildCohorts } from './market';
import { freschezza, mediaNazionale, mediaProvincia, provinciaPiuVicina, quadroOggi } from './quadro';

function riga(over: Partial<StationRow> & { id: string }): StationRow {
  return {
    name: 'Distributore',
    brand: 'Indipendente',
    operator: '',
    prov: 'RA',
    city: 'Lugo',
    address: '',
    isHighway: false,
    lat: 44.4,
    lng: 11.9,
    prices: { diesel: 1.9 },
    servito: {},
    updated: '2026-10-13 07:00',
    ...over,
  };
}

const ADESSO = new Date(2026, 9, 13, 9, 0);

function dataset(over: Partial<RawDataset> = {}): RawDataset {
  return {
    extracted_at: '2026-10-13',
    fuels: ['diesel'],
    national: {},
    by_province: {},
    history: {},
    forecast: {},
    stations: [],
    ...over,
  };
}

/** Dieci impianti in provincia di Ravenna e dieci a Roma, con prezzi noti. */
function campione(): StationRow[] {
  const ra = Array.from({ length: 10 }, (_, i) => riga({ id: `ra${i}`, prices: { diesel: 1.8 + i * 0.01 } }));
  const rm = Array.from({ length: 10 }, (_, i) => riga({ id: `rm${i}`, prov: 'RM', prices: { diesel: 2.0 + i * 0.01 } }));
  return [...ra, ...rm];
}

describe('provinciaPiuVicina', () => {
  it('prende la provincia del distributore piu vicino', () => {
    const rows = campione();
    const perId = new Map(rows.map((r) => [r.id, r] as const));
    expect(provinciaPiuVicina([{ id: 'ra3', distanceKm: 4 }, { id: 'rm1', distanceKm: 1.2 }], perId)).toBe('RM');
  });

  it('salta chi non ha una provincia valida', () => {
    const rows = [riga({ id: 'a', prov: null }), riga({ id: 'b', prov: 'BO' })];
    const perId = new Map(rows.map((r) => [r.id, r] as const));
    expect(provinciaPiuVicina([{ id: 'a', distanceKm: 0.3 }, { id: 'b', distanceKm: 3 }], perId)).toBe('BO');
    expect(provinciaPiuVicina([], perId)).toBeNull();
  });
});

describe('mediaNazionale', () => {
  it('usa la media del backend quando c e', () => {
    const d = dataset({ national: { diesel: { avg: 2.25, min: 1.3, n: 20000, std: 0.07 } } });
    expect(mediaNazionale(d, buildCohorts(campione()), 'diesel')).toEqual({ media: 2.25, campione: 20000 });
  });

  it('senza, ripiega sulle coorti', () => {
    const m = mediaNazionale(dataset(), buildCohorts(campione()), 'diesel')!;
    expect(m.campione).toBe(20);
    expect(m.media).toBeCloseTo(1.945, 6);
  });

  it('e nulla per un carburante che non c e', () => {
    expect(mediaNazionale(dataset(), buildCohorts(campione()), 'metano')).toBeNull();
  });
});

describe('mediaProvincia', () => {
  it('e la coorte stradale della provincia, col nome e lo scarto dal paese', () => {
    const p = mediaProvincia(buildCohorts(campione()), 'RA', 'diesel', { media: 1.9, campione: 100 })!;
    expect(p.nome).toBe('Ravenna');
    expect(p.campione).toBe(10);
    expect(p.media).toBeCloseTo(1.845, 6);
    expect(p.deltaC).toBeCloseTo(-5.5, 6);
  });

  it('non conta gli impianti in autostrada', () => {
    const rows = [...campione(), riga({ id: 'auto', isHighway: true, prices: { diesel: 2.6 } })];
    const p = mediaProvincia(buildCohorts(rows), 'RA', 'diesel', null)!;
    expect(p.campione).toBe(10);
    expect(p.deltaC).toBeNull();
  });

  it('tace sotto la soglia delle coorti', () => {
    const pochi = Array.from({ length: 3 }, (_, i) => riga({ id: `x${i}`, prov: 'IS' }));
    expect(mediaProvincia(buildCohorts(pochi), 'IS', 'diesel', null)).toBeNull();
    expect(mediaProvincia(buildCohorts(campione()), null, 'diesel', null)).toBeNull();
  });
});

describe('freschezza', () => {
  it('divide i prezzi per eta con le soglie di freshness', () => {
    const rows = [
      riga({ id: '1', updated: '2026-10-13 08:30' }),
      riga({ id: '2', updated: '2026-10-12 10:00' }),
      riga({ id: '3', updated: '2026-10-11 09:00' }),
      riga({ id: '4', updated: '2026-10-01 09:00' }),
      riga({ id: '5', updated: null }),
      riga({ id: '6', prices: { benzina: 1.8 } }),
    ];
    expect(freschezza(rows, 'diesel', ADESSO)).toEqual({
      ultimoGiorno: 2,
      entroTreGiorni: 1,
      piuVecchi: 1,
      senzaData: 1,
      totale: 5,
    });
  });
});

describe('quadroOggi', () => {
  it('mette insieme nazionale, provincia e freschezza', () => {
    const rows = campione();
    const q = quadroOggi({
      rows,
      cohorts: buildCohorts(rows),
      dataset: dataset({ national: { diesel: { avg: 1.95, min: 1.8, n: 20, std: 0.07 } } }),
      fuel: 'diesel',
      now: ADESSO,
      provincia: 'RM',
    });
    expect(q.nazionale!.media).toBe(1.95);
    expect(q.provincia!.nome).toBe('Roma');
    expect(q.provincia!.deltaC).toBeCloseTo(9.5, 6);
    expect(q.freschezza.totale).toBe(20);
    expect(q.freschezza.ultimoGiorno).toBe(20);
  });
});

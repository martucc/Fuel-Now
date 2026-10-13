import { describe, it, expect } from 'vitest';
import type { StationRow } from '../../domain/parse';
import type { RawDataset } from '../../domain/raw';
import { buildCohorts } from '../../domain/market';
import { parseStations } from '../../domain/parse';
import { realDataset } from '../../domain/__fixtures__/dataset';
import { buildMarketModel, unisciStorico, componiVerdetto, type MarketInput } from './marketModel';

const ORA = new Date('2026-08-20T10:00:00');
const ADESSO = '2026-08-20 08:00';

function riga(over: Partial<StationRow> & { id: string }): StationRow {
  return {
    name: 'Impianto', brand: 'Marchio', operator: '',
    prov: 'RM', city: 'ROMA', address: '', isHighway: false,
    lat: 41.9, lng: 12.5,
    prices: { benzina: 1.9 }, servito: {}, updated: ADESSO,
    ...over,
  };
}

/** Una provincia plausibile: prezzi sparsi attorno a 1,90. */
function provinciaRoma(quanti = 20): StationRow[] {
  return Array.from({ length: quanti }, (_, i) =>
    riga({
      id: `rm-${i}`,
      lat: 41.9 + i * 0.002,
      lng: 12.5 + i * 0.002,
      prices: { benzina: 1.85 + (i % 10) * 0.01 },
    })
  );
}

function dataset(over: Partial<RawDataset> = {}): RawDataset {
  return {
    extracted_at: '2026-08-20T06:00:00',
    fuels: ['benzina'],
    national: { benzina: { avg: 1.92, min: 1.7, n: 18000, std: 0.06 } },
    by_province: {},
    history: { benzina: [] },
    forecast: {},
    stations: [],
    ...over,
  };
}

function input(over: Partial<MarketInput> = {}): MarketInput {
  const rows = over.rows ?? provinciaRoma();
  return {
    rows,
    cohorts: buildCohorts(rows),
    dataset: dataset(),
    fuel: 'benzina',
    user: { lat: 41.9, lng: 12.5 },
    now: ORA,
    liters: 50,
    kml: 15,
    blocked: new Set<string>(),
    radiusKm: 20,
    ...over,
  };
}

describe('buildMarketModel: dove siamo', () => {
  it('prende la provincia dall impianto piu vicino', () => {
    const m = buildMarketModel(input());
    expect(m.prov).toBe('RM');
  });

  it('non inventa una provincia quando non c e nessun impianto raggiungibile', () => {
    const m = buildMarketModel(input({ user: { lat: 38.1, lng: 13.3 }, radiusKm: 5 }));
    expect(m.prov).toBeNull();
    expect(m.migliore).toBeNull();
    expect(m.campione).toBe(0);
  });
});

describe('buildMarketModel: zona contro Italia', () => {
  it('dice di quanti centesimi la zona sta sopra o sotto la media nazionale', () => {
    // Coorte romana: media 1,895. Nazionale del dataset: 1,92. -2,5 centesimi.
    const m = buildMarketModel(input());
    expect(m.zona!.avg).toBeCloseTo(1.895, 3);
    expect(m.deltaZonaItaliaC).toBeCloseTo(-2.5, 1);
  });

  it('tace sul confronto quando il dataset non porta la media nazionale', () => {
    const m = buildMarketModel(input({ dataset: dataset({ national: {} }) }));
    expect(m.nazionale).toBeNull();
    expect(m.deltaZonaItaliaC).toBeNull();
  });
});

describe('buildMarketModel: il migliore raggiungibile', () => {
  it('riporta prezzo, distanza e in che percentile sta', () => {
    const m = buildMarketModel(input());
    expect(m.migliore!.price).toBeCloseTo(1.85, 3);
    // Due impianti su venti stanno a 1,85: il migliore batte gli altri diciotto.
    expect(m.migliore!.percentile).toBeCloseTo(90, 0);
  });

  it('misura la forbice e quanto vale sul serbatoio', () => {
    const m = buildMarketModel(input());
    // Da 1,85 a 1,94 sono nove centesimi: su cinquanta litri, 4,50 euro.
    expect(m.spreadC).toBeCloseTo(9, 1);
    expect(m.risparmioMassimoEur).toBeCloseTo(4.5, 2);
  });

  it('non conta gli impianti bloccati fra quelli raggiungibili', () => {
    const bloccati = new Set(['rm-0', 'rm-10']);
    const m = buildMarketModel(input({ blocked: bloccati }));
    expect(m.campione).toBe(18);
    expect(m.migliore!.price).toBeCloseTo(1.86, 3);
  });
});

describe('buildMarketModel: distribuzione per livello', () => {
  it('mette ogni impianto raggiungibile in un secchio solo', () => {
    const m = buildMarketModel(input());
    const totale = m.distribuzione.reduce((a, s) => a + s.n, 0);
    expect(totale).toBe(m.campione);
  });

  it('rende i cinque livelli sempre nello stesso ordine, anche vuoti', () => {
    const m = buildMarketModel(input());
    expect(m.distribuzione.map((s) => s.level)).toEqual(['best', 'good', 'normal', 'high', 'worst']);
  });
});

describe('buildMarketModel: storico', () => {
  /** Quaranta giorni veri, dal 1 luglio: le date finte non si parsano. */
  const storico = Array.from({ length: 40 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 6, 1 + i));
    return { date: d.toISOString().slice(0, 10), avg: 1.9 + i * 0.002 };
  });

  it('ancora i confronti all ultimo rilevamento, non a oggi', () => {
    // Lo storico finisce prima di oggi: ancorando a oggi «un mese prima»
    // pescherebbe lo stesso punto e direbbe 0,0%, che e falso.
    const m = buildMarketModel(input({ dataset: dataset({ history: { benzina: storico } }) }));
    const mese = m.confronti.find((c) => c.giorni === 30);
    expect(mese).toBeDefined();
    expect(mese!.delta).toBeGreaterThan(0);
  });

  it('non produce confronti che non ha i dati per fare', () => {
    const corto = storico.slice(-3);
    const m = buildMarketModel(input({ dataset: dataset({ history: { benzina: corto } }) }));
    expect(m.confronti).toEqual([]);
  });

  it('misura la volatilita in centesimi', () => {
    const m = buildMarketModel(input({ dataset: dataset({ history: { benzina: storico } }) }));
    expect(m.volatilitaC).toBeGreaterThan(0);
  });
});

describe('buildMarketModel: previsione', () => {
  it('traduce il delta previsto in euro sul serbatoio dell utente', () => {
    const d = dataset({ forecast: { benzina: { direction: 'down', delta_c: -3, days_ahead: 7, confidence: 0.8 } } });
    const m = buildMarketModel(input({ dataset: d }));
    // Tre centesimi in meno su cinquanta litri sono 1,50 euro risparmiati aspettando.
    expect(m.previsioneEur).toBeCloseTo(1.5, 2);
  });

  it('non mette cifre su una previsione di cui non ci si fida', () => {
    const d = dataset({ forecast: { benzina: { direction: 'down', delta_c: -3, days_ahead: 7, confidence: 0.1 } } });
    const m = buildMarketModel(input({ dataset: d }));
    expect(m.previsione!.usable).toBe(false);
    expect(m.previsioneEur).toBeNull();
  });
});

describe('buildMarketModel: marchi', () => {
  it('classifica i marchi che hanno abbastanza impianti per dire qualcosa', () => {
    const rows = [
      ...provinciaRoma(12),
      ...Array.from({ length: 4 }, (_, i) =>
        riga({ id: `q8-${i}`, brand: 'Q8', lat: 41.905 + i * 0.001, prices: { benzina: 1.81 } })
      ),
      // Due soli: troppo pochi per essere una classifica.
      riga({ id: 'uno-0', brand: 'Solitario', prices: { benzina: 1.5 } }),
      riga({ id: 'uno-1', brand: 'Solitario', prices: { benzina: 1.5 } }),
    ];
    const m = buildMarketModel(input({ rows, cohorts: buildCohorts(rows) }));
    const nomi = m.marchi.map((x) => x.brand);
    expect(nomi).toContain('Q8');
    expect(nomi).not.toContain('Solitario');
    expect(m.marchi[0]!.brand).toBe('Q8');
    expect(m.marchi[0]!.delta).toBeLessThan(0);
  });
});

describe('buildMarketModel: autostrada e servito', () => {
  it('dice quanto costa in piu l autostrada quando ci sono i dati', () => {
    const rows = [
      ...provinciaRoma(12),
      ...Array.from({ length: 10 }, (_, i) =>
        riga({ id: `a-${i}`, isHighway: true, lat: 41.91 + i * 0.001, prices: { benzina: 2.1 } })
      ),
    ];
    const m = buildMarketModel(input({ rows, cohorts: buildCohorts(rows) }));
    expect(m.autostradaC).toBeGreaterThan(15);
  });

  it('tace sull autostrada quando in zona non ce n e', () => {
    const m = buildMarketModel(input());
    expect(m.autostradaC).toBeNull();
  });

  it('dice quanto costa il servito dove entrambi i prezzi ci sono', () => {
    const rows = provinciaRoma(12).map((r, i) =>
      i < 8 ? { ...r, servito: { benzina: r.prices.benzina! + 0.2 } } : r
    );
    const m = buildMarketModel(input({ rows, cohorts: buildCohorts(rows) }));
    expect(m.servitoC).toBeCloseTo(20, 0);
  });

  it('tace sul servito su un campione troppo piccolo', () => {
    const rows = provinciaRoma(12).map((r, i) =>
      i < 2 ? { ...r, servito: { benzina: r.prices.benzina! + 0.2 } } : r
    );
    const m = buildMarketModel(input({ rows, cohorts: buildCohorts(rows) }));
    expect(m.servitoC).toBeNull();
  });
});

describe('buildMarketModel: freschezza', () => {
  it('conta quanti prezzi sono recenti e quanto e vecchio quello di mezzo', () => {
    const rows = provinciaRoma(10).map((r, i) =>
      i < 4 ? { ...r, updated: '2026-08-10 08:00' } : r
    );
    const m = buildMarketModel(input({ rows, cohorts: buildCohorts(rows) }));
    expect(m.freschezza.totale).toBe(10);
    expect(m.freschezza.recenti).toBe(6);
    expect(m.freschezza.medianaOre).not.toBeNull();
  });
});

describe('buildMarketModel sul dataset vero', () => {
  it('non produce numeri impossibili a Roma', () => {
    const d = realDataset();
    const rows = parseStations(d.stations);
    const cohorts = buildCohorts(rows);
    const m = buildMarketModel({
      rows, cohorts, dataset: d, fuel: 'benzina',
      user: { lat: 41.9028, lng: 12.4964 },
      now: new Date(d.extracted_at),
      liters: 50, kml: 15, blocked: new Set(), radiusKm: 20,
    });

    expect(m.prov).toBe('RM');
    expect(m.campione).toBeGreaterThan(100);
    expect(m.migliore).not.toBeNull();
    // Nessun impianto raggiungibile puo stare piu lontano del raggio chiesto.
    expect(m.migliore!.km).toBeLessThanOrEqual(20);
    expect(m.migliore!.percentile).toBeGreaterThanOrEqual(0);
    expect(m.migliore!.percentile).toBeLessThanOrEqual(100);
    // Una forbice di oltre un euro al litro sarebbe un dato sbagliato, non un mercato.
    expect(m.spreadC!).toBeGreaterThan(0);
    expect(m.spreadC!).toBeLessThan(100);
    expect(m.distribuzione.reduce((a, s) => a + s.n, 0)).toBe(m.campione);
    expect(m.freschezza.totale).toBe(m.campione);
    expect(m.marchi.length).toBeGreaterThan(0);
    // I marchi arrivano in ordine di prezzo crescente.
    for (let k = 1; k < m.marchi.length; k++) {
      expect(m.marchi[k]!.avg).toBeGreaterThanOrEqual(m.marchi[k - 1]!.avg);
    }
  });
});

describe('unisciStorico', () => {
  it('rende il recente quando non c e nient altro', () => {
    const recente = [{ date: '2026-06-01', avg: 1.9 }];
    expect(unisciStorico(undefined, recente)).toEqual(recente);
    expect(unisciStorico([], recente)).toEqual(recente);
  });

  it('mette in fila le due fonti per data', () => {
    const lungo = [{ date: '2020-01-06', avg: 1.59 }, { date: '2026-06-01', avg: 1.88 }];
    const recente = [{ date: '2026-06-02', avg: 1.9 }];
    expect(unisciStorico(lungo, recente).map((p) => p.date)).toEqual([
      '2020-01-06', '2026-06-01', '2026-06-02',
    ]);
  });

  it('sulle date in comune vince il dataset, che e la rilevazione piu fresca', () => {
    const lungo = [{ date: '2026-06-01', avg: 1.5 }];
    const recente = [{ date: '2026-06-01', avg: 1.9 }];
    expect(unisciStorico(lungo, recente)).toEqual([{ date: '2026-06-01', avg: 1.9 }]);
  });

  it('scarta i punti senza un prezzo vero', () => {
    const lungo = [{ date: '2026-05-01', avg: 0 }, { date: '2026-05-02', avg: 1.8 }];
    expect(unisciStorico(lungo, []).map((p) => p.date)).toEqual(['2026-05-02']);
  });
});

describe('componiVerdetto', () => {
  it('tace quando non ha il confronto col paese', () => {
    expect(componiVerdetto(null, 'RM', 12)).toBeNull();
  });

  it('nomina la provincia e da il tono giusto a una zona cara', () => {
    const v = componiVerdetto(4.2, 'MI', 14)!;
    expect(v.titolo).toBe('Zona cara');
    expect(v.tono).toBe('worst');
    expect(v.frase).toContain('provincia di MI');
    expect(v.frase).toContain('4,2 centesimi');
  });

  it('chiama in linea uno scarto che nel portafoglio non si sente', () => {
    const v = componiVerdetto(0.3, 'RM', 3)!;
    expect(v.tono).toBe('normal');
    expect(v.frase).toContain('quanto nel resto');
  });

  it('mette la forbice solo quando e larga abbastanza da contare', () => {
    expect(componiVerdetto(0, 'RM', 3)!.frase).not.toContain('ballano');
    expect(componiVerdetto(0, 'RM', 14)!.frase).toContain('ballano 14 centesimi');
  });

  it('se ne esce senza provincia senza scrivere «undefined»', () => {
    const v = componiVerdetto(-4, null, null)!;
    expect(v.frase.startsWith('Qui si paga')).toBe(true);
    expect(v.tono).toBe('best');
  });
});

describe('buildMarketModel: i dati nuovi', () => {
  it('scompone la media di zona in prodotto, accisa e IVA', () => {
    const m = buildMarketModel(input());
    expect(m.scomposizione).not.toBeNull();
    expect(m.scomposizione!.quotaTasse).toBeGreaterThan(0.4);
  });

  it('non scompone i carburanti di cui non conosce l accisa', () => {
    const rows = provinciaRoma().map((r) => ({ ...r, prices: { gpl: 0.755 } }));
    const m = buildMarketModel(input({ rows, cohorts: buildCohorts(rows), fuel: 'gpl' }));
    expect(m.scomposizione).toBeNull();
  });

  it('porta il ritmo settimanale, anche quando dice che non c e', () => {
    const m = buildMarketModel(input());
    expect(m.ritmo).toBeDefined();
    expect(m.ritmo.significativo).toBe(false);
  });
});

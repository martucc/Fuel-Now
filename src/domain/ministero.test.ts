import { describe, it, expect } from 'vitest';
import {
  cuciPrezzi, leggiRisultati, oraMinistero, presiDalTelefono, prezziFermi, statistiche, PIANO_B_DOPO_ORE,
} from './ministero';
import { realDataset } from './__fixtures__/dataset';
import type { RawDataset, RawStation } from './raw';

/** Un risultato di `search/area` com'è nell'API live. */
function risultato(id: number, fuels: Array<[number, number | string, boolean]>, insertDate = '2026-10-26T08:15:00', extra: object = {}) {
  return {
    id, name: `Impianto ${id}`, brand: 'Q8', address: 'Via Roma 1',
    location: { lat: 44.42, lng: 11.91 },
    fuels: fuels.map(([fuelId, price, isSelf]) => ({ fuelId, price, isSelf, name: '' })),
    insertDate,
    ...extra,
  };
}

function stazione(id: number, over: Partial<RawStation> = {}): RawStation {
  return {
    id, name: `S${id}`, brand: 'Eni', operator: 'Gestore', type: 'Stradale', is_highway: false,
    address: 'Via Emilia', city: 'LUGO', prov: 'RA', lat: 44.42, lng: 11.91,
    p: { diesel: [2.1, 2.3], benzina: [1.9, 2.1] }, updated: '2026-10-20 07:00', ...over,
  };
}

function base(stations: RawStation[]): RawDataset {
  return {
    extracted_at: '2026-10-20',
    source: { kind: 'live_api', generated_at: '2026-10-20T06:00:00Z', latest_price_at: '2026-10-20 07:00' },
    fuels: ['diesel', 'benzina', 'gpl', 'metano'],
    national: {}, by_province: {},
    history: { diesel: [{ date: '2026-10-20', avg: 2.2 }] },
    forecast: { diesel: { direction: 'flat', delta_c: 0, days_ahead: 7, confidence: 0.5 } },
    stations,
  };
}

describe('leggiRisultati', () => {
  it('mette self e servito al posto giusto e traduce gli id carburante', () => {
    const m = leggiRisultati([risultato(7, [[2, 2.089, true], [2, 2.249, false], [1, '1,899', true], [4, 0.719, false]])]);
    expect(m.get(7)?.p).toEqual({ diesel: [2.089, 2.249], benzina: [1.899, null], gpl: [null, 0.719] });
    expect(m.get(7)?.updated).toBe('2026-10-26 08:15');
  });

  it('scarta i prezzi fuori limite e i carburanti che non conosce', () => {
    const m = leggiRisultati([risultato(7, [[2, 0.209, true], [2, 2.2, false], [1, 12, true], [9, 1.5, true]])]);
    expect(m.get(7)?.p).toEqual({ diesel: [null, 2.2] });
  });

  it('un impianto in due regioni tiene i prezzi di entrambe e l’ora più recente', () => {
    const m = leggiRisultati([
      risultato(7, [[2, 2.1, true]], '2026-10-25T18:00:00'),
      risultato(7, [[1, 1.9, true]], '2026-10-26T07:30:00'),
    ]);
    expect(m.size).toBe(1);
    expect(m.get(7)?.p).toEqual({ diesel: [2.1, null], benzina: [1.9, null] });
    expect(m.get(7)?.updated).toBe('2026-10-26 07:30');
  });

  it('ignora la spazzatura senza rompersi', () => {
    const m = leggiRisultati([null, 3, 'x', {}, { id: 'abc' }, { id: 5, fuels: 'no' }]);
    expect([...m.keys()]).toEqual([5]);
    expect(m.get(5)?.p).toEqual({});
  });
});

describe('oraMinistero', () => {
  it('tiene l’ora come la scrive il Ministero, fuso compreso o no', () => {
    expect(oraMinistero('2026-10-26T08:15:00')).toBe('2026-10-26 08:15');
    expect(oraMinistero('2026-10-26T08:15:00+01:00')).toBe('2026-10-26 08:15');
    expect(oraMinistero('2026-10-26 08:15')).toBe('2026-10-26 08:15');
    expect(oraMinistero('26/10/2026')).toBeNull();
    expect(oraMinistero(undefined)).toBeNull();
  });
});

describe('cuciPrezzi', () => {
  const GEN = new Date(2026, 9, 26, 9, 0);

  it('chi è nella risposta prende prezzi e ora del Ministero, l’anagrafica resta', () => {
    const d = cuciPrezzi(base([stazione(1), stazione(2)]), leggiRisultati([risultato(1, [[2, 2.05, true]])]), GEN);
    const s1 = d.stations.find((s) => s.id === 1)!;
    expect(s1.p).toEqual({ diesel: [2.05, null] });
    expect(s1.updated).toBe('2026-10-26 08:15');
    expect(s1.city).toBe('LUGO');
    expect(s1.prov).toBe('RA');
    expect(s1.operator).toBe('Gestore');
  });

  it('chi non è nella risposta resta com’era, ora vecchia compresa', () => {
    const d = cuciPrezzi(base([stazione(1), stazione(2)]), leggiRisultati([risultato(1, [[2, 2.05, true]])]), GEN);
    expect(d.stations.find((s) => s.id === 2)).toEqual(stazione(2));
  });

  it('una risposta senza prezzi validi non cancella quelli che c’erano', () => {
    const d = cuciPrezzi(base([stazione(1)]), leggiRisultati([risultato(1, [[2, 9.9, true]])]), GEN);
    expect(d.stations[0]).toEqual(stazione(1));
  });

  it('un impianto nuovo entra, senza comune e senza provincia; fuori dall’Italia no', () => {
    const d = cuciPrezzi(base([stazione(1)]), leggiRisultati([
      risultato(50, [[2, 2.0, true]]),
      risultato(51, [[2, 2.0, true]], '2026-10-26T08:15:00', { location: { lat: 52.5, lng: 13.4 } }),
    ]), GEN);
    const nuovo = d.stations.find((s) => s.id === 50);
    expect(nuovo).toMatchObject({ name: 'Impianto 50', brand: 'Q8', city: '', prov: '', updated: '2026-10-26 08:15' });
    expect(d.stations.some((s) => s.id === 51)).toBe(false);
  });

  it('rifà medie e fonte, tiene storico e previsione', () => {
    const b = base([stazione(1), stazione(2), stazione(3)]);
    const d = cuciPrezzi(b, leggiRisultati([
      risultato(1, [[2, 2.0, true]]), risultato(2, [[2, 2.1, true]]), risultato(3, [[2, 2.3, true]], '2026-10-26T08:40:00'),
    ]), GEN);
    expect(d.national.diesel?.avg).toBeCloseTo(2.1333, 4);
    expect(d.national.diesel?.n).toBe(3);
    expect(d.by_province.RA?.diesel?.avg).toBeCloseTo(2.1333, 4);
    expect(d.source?.kind).toBe('telefono');
    expect(d.source?.latest_price_at).toBe('2026-10-26 08:40');
    expect(d.source?.generated_at).toBe(GEN.toISOString());
    expect(d.extracted_at).toBe('2026-10-26');
    expect(d.history).toBe(b.history);
    expect(d.forecast).toBe(b.forecast);
    expect(presiDalTelefono(d)).toBe(true);
    expect(presiDalTelefono(b)).toBe(false);
  });

  it('non tocca il file di partenza', () => {
    const b = base([stazione(1)]);
    const copia = JSON.parse(JSON.stringify(b));
    cuciPrezzi(b, leggiRisultati([risultato(1, [[2, 2.05, true]])]), GEN);
    expect(b).toEqual(copia);
  });
});

describe('statistiche', () => {
  it('rifà le medie nazionali come lo script su GitHub (file vero)', () => {
    const vero = realDataset();
    const s = statistiche(vero.stations);
    for (const k of ['diesel', 'benzina', 'gpl', 'metano'] as const) {
      const atteso = vero.national[k];
      const nostro = s.national[k];
      expect(nostro?.n).toBe(atteso?.n);
      expect(nostro?.avg).toBeCloseTo(atteso!.avg, 3);
      expect(nostro?.min).toBeCloseTo(atteso!.min, 3);
      expect(nostro?.max).toBeCloseTo(atteso!.max!, 3);
      expect(nostro?.p10).toBeCloseTo(atteso!.p10!, 3);
      expect(nostro?.p90).toBeCloseTo(atteso!.p90!, 3);
      expect(nostro?.std).toBeCloseTo(atteso!.std, 3);
    }
  });

  it('rifà le medie per provincia come lo script su GitHub (file vero)', () => {
    const vero = realDataset();
    const s = statistiche(vero.stations);
    expect(Object.keys(s.by_province).sort()).toEqual(Object.keys(vero.by_province).sort());
    for (const [prov, riga] of Object.entries(vero.by_province)) {
      for (const [k, st] of Object.entries(riga)) {
        const nostro = s.by_province[prov]?.[k as keyof typeof riga];
        expect(nostro?.n, `${prov} ${k}`).toBe(st!.n);
        expect(nostro?.avg, `${prov} ${k}`).toBeCloseTo(st!.avg, 3);
      }
    }
  });

  it('senza prezzi per un carburante la media nazionale è null', () => {
    expect(statistiche([stazione(1)]).national.gpl).toBeNull();
  });
});

describe('prezziFermi', () => {
  const ADESSO = new Date(2026, 9, 26, 9, 0).getTime();
  const conUltimo = (latest_price_at?: string) => ({ ...base([]), source: { latest_price_at } });

  it('scatta solo oltre la soglia', () => {
    expect(prezziFermi(conUltimo('2026-10-26 07:30'), ADESSO)).toBe(false);
    expect(prezziFermi(conUltimo('2026-10-25 22:00'), ADESSO)).toBe(false);
    const oltre = new Date(ADESSO - (PIANO_B_DOPO_ORE + 1) * 3_600_000);
    const s = `${oltre.getFullYear()}-${String(oltre.getMonth() + 1).padStart(2, '0')}-${String(oltre.getDate()).padStart(2, '0')} ${String(oltre.getHours()).padStart(2, '0')}:00`;
    expect(prezziFermi(conUltimo(s), ADESSO)).toBe(true);
    expect(prezziFermi(conUltimo('2026-10-13 00:28'), ADESSO)).toBe(true);
  });

  it('senza l’ora dell’ultimo prezzo non scatta', () => {
    expect(prezziFermi(conUltimo(undefined), ADESSO)).toBe(false);
  });
});

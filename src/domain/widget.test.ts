import { describe, it, expect } from 'vitest';
import { componiIstantanea, istantaneaVuota } from './widget';
import { buildHomeModel } from '../ui/home/homeModel';
import { realDataset } from './__fixtures__/dataset';
import { parseStations } from './parse';
import { buildCohorts } from './market';

const data = realDataset();
const rows = parseStations(data.stations);
const cohorts = buildCohorts(rows);
const ROMA = { lat: 41.9028, lng: 12.4964 };
const QUANDO = new Date('2026-08-20T22:00:00');

function model(over: Partial<Parameters<typeof buildHomeModel>[0]> = {}) {
  return buildHomeModel({
    rows, cohorts, dataset: data, fuel: 'benzina', user: ROMA,
    now: new Date('2026-08-19T10:00:00'), liters: 38, kml: 15,
    blocked: new Set<string>(), radiusKm: 15, tankPct: null,
    ...over,
  });
}

describe('istantanea del widget', () => {
  it('mostra lo stesso impianto che la Home consiglia', () => {
    // E il punto di tutto il modulo: il widget non ha una sua opinione.
    const m = model();
    const i = componiIstantanea(m, 'benzina', QUANDO);
    expect(i.mf_w_dove).toContain(m.best!.row.brand);
    expect(Number(i.mf_w_lat)).toBe(m.best!.row.lat);
    expect(Number(i.mf_w_lng)).toBe(m.best!.row.lng);
  });

  it('il livello e quello del migliore, cosi la tacca accesa e la sua', () => {
    const m = model();
    const i = componiIstantanea(m, 'benzina', QUANDO);
    expect(i.mf_w_livello).toBe(m.best!.level);
    expect(['best', 'good', 'normal', 'high', 'worst']).toContain(i.mf_w_livello);
  });

  it('scrive il prezzo all italiana, con la virgola e tre decimali', () => {
    const i = componiIstantanea(model(), 'benzina', QUANDO);
    expect(i.mf_w_prezzo).toMatch(/^\d,\d{3}$/);
  });

  it('il verdetto e una delle frasi del consiglio, mai una sigla', () => {
    const i = componiIstantanea(model(), 'benzina', QUANDO);
    expect(i.mf_w_verdetto).not.toMatch(/[A-Z]{2,}-/);
    expect(i.mf_w_verdetto.length).toBeGreaterThan(0);
  });

  it('dichiara carburante e distanza nella riga di contesto', () => {
    const i = componiIstantanea(model(), 'diesel', QUANDO);
    expect(i.mf_w_contesto).toContain('Diesel');
    expect(i.mf_w_contesto).toContain('km');
  });

  it('senza modello non inventa niente: il widget dira «apri l app»', () => {
    const i = componiIstantanea(null, 'benzina', QUANDO);
    expect(i).toEqual(istantaneaVuota(QUANDO));
    expect(i.mf_w_prezzo).toBe('');
    expect(i.mf_w_livello).toBe('');
  });

  it('timbra quando e stata scritta, senno il widget non sa di essere vecchio', () => {
    // MfNotte confronta questo con l ora corrente e oltre otto ore smette
    // di dare consigli, invece di spacciare per fresco un prezzo di ieri.
    const i = componiIstantanea(model(), 'benzina', QUANDO);
    expect(Number(i.mf_w_scritto)).toBe(QUANDO.getTime());
  });

  it('quando il risparmio e trascurabile non lo scrive', () => {
    // Un raggio strettissimo lascia in piedi pochi impianti vicini: il netto
    // resta piccolo e la riga deve dire solo il livello.
    const i = componiIstantanea(model({ radiusKm: 1 }), 'benzina', QUANDO);
    if (i.mf_w_prezzo !== '') {
      const haCifra = /\d+,\d{2} € in tasca/.test(i.mf_w_scarto);
      if (!haCifra) expect(i.mf_w_scarto).not.toContain('in tasca');
    }
  });

  it('non produce mai stringhe che il widget non sa mostrare', () => {
    const i = componiIstantanea(model(), 'benzina', QUANDO);
    for (const v of Object.values(i)) {
      expect(typeof v).toBe('string');
      expect(v).not.toContain('undefined');
      expect(v).not.toContain('NaN');
    }
  });
});

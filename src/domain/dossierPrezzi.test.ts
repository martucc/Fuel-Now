import { describe, it, expect } from 'vitest';
import type { StationRow } from './parse';
import { buildCohorts } from './market';
import { pulisciStorico } from './andamento';
import type { RitmoSettimanale } from './settimana';
import type { DossierInput } from './dossierPrezzi';
import { contestoIa, dossierPrezzi, righeAggiuntive } from './dossierPrezzi';

function riga(id: string, over: Partial<StationRow> = {}): StationRow {
  return {
    id,
    name: 'Distributore',
    brand: 'Eni',
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

const NIENTE_RITMO: RitmoSettimanale = { giorni: [], migliore: null, peggiore: null, ampiezzaC: 0, significativo: false };

function storico(n: number, prezzo: (i: number) => number) {
  return pulisciStorico(
    Array.from({ length: n }, (_, i) => ({
      date: new Date(Date.UTC(2026, 6, 1) + i * 86_400_000).toISOString().slice(0, 10),
      avg: prezzo(i),
    })),
  );
}

function input(over: Partial<DossierInput> = {}): DossierInput {
  const rows = [
    riga('a', { prices: { diesel: 1.85 }, servito: { diesel: 2.05 } }),
    riga('b', { prices: { diesel: 1.95 }, brand: 'Q8' }),
    riga('c', { prices: { diesel: 1.9 } }),
    riga('d', { prices: { diesel: 1.5 } }),
  ];
  return {
    fuel: 'diesel',
    quadro: {
      nazionale: { media: 1.95, campione: 20000 },
      provincia: { sigla: 'RA', nome: 'Ravenna', media: 1.9, campione: 150, deltaC: -5 },
      freschezza: { ultimoGiorno: 15000, entroTreGiorni: 3000, piuVecchi: 2000, senzaData: 0, totale: 20000 },
    },
    vicini: [
      { id: 'a', price: 1.85, distanceKm: 1, eligible: true },
      { id: 'b', price: 1.95, distanceKm: 2, eligible: true },
      { id: 'c', price: 1.9, distanceKm: 3, eligible: true },
      // Un prezzo assurdo escluso dalla classifica non entra nella zona.
      { id: 'd', price: 1.5, distanceKm: 0.5, eligible: false },
    ],
    perId: new Map(rows.map((r) => [r.id, r] as const)),
    cohorts: buildCohorts(rows),
    consigliato: { nome: 'Eni Lugo', prezzo: 1.85, km: 1, risparmioEur: 2.5 },
    storico: storico(60, (i) => 1.8 + i * 0.001),
    previsione: null,
    ritmo: NIENTE_RITMO,
    auto: null,
    now: new Date(2026, 9, 13, 9, 0),
    ...over,
  };
}

describe('contestoIa', () => {
  it('fa la zona solo coi distributori utilizzabili', () => {
    const c = contestoIa(input());
    expect(c.zona!.campione).toBe(3);
    expect(c.zona!.minimo).toBe(1.85);
    expect(c.zona!.massimo).toBe(1.95);
    expect(c.mercato!.spreadC).toBeCloseTo(10, 6);
    expect(c.mercato!.frescoSuTotale).toEqual([3, 3]);
  });

  it('passa un mese di storico e la provincia per nome', () => {
    const c = contestoIa(input());
    expect(c.storico).toHaveLength(31);
    expect(c.mercato!.prov).toBe('Ravenna');
    expect(c.mercato!.deltaZonaItaliaC).toBe(-5);
  });

  it('non inventa servito, autostrada o marchi con troppo pochi impianti', () => {
    const m = contestoIa(input()).mercato!;
    expect(m.servitoC).toBeNull();
    expect(m.autostradaC).toBeNull();
    expect(m.marchiEconomici).toEqual([]);
  });

  it('senza vicini dichiara la zona assente', () => {
    const c = contestoIa(input({ vicini: [] }));
    expect(c.zona).toBeNull();
    expect(c.mercato!.frescoSuTotale).toBeNull();
  });
});

describe('righeAggiuntive', () => {
  it('porta la media nazionale, la provincia e i confronti col passato', () => {
    const t = righeAggiuntive(input()).join('\n');
    expect(t).toContain('Media nazionale di oggi: €1.950');
    expect(t).toContain('provincia di Ravenna');
    expect(t).toContain('Rispetto a 7 giorni fa la media nazionale e salita di 0.7 centesimi');
    expect(t).toContain('Rispetto a 30 giorni fa la media nazionale e salita di 3.0 centesimi');
  });

  it('senza previsione affidabile lo dice e chiede di non inventarla', () => {
    const t = righeAggiuntive(input()).join('\n');
    expect(t).toContain('non ha una previsione affidabile');
  });

  it('con la previsione riporta verso, delta e affidabilita', () => {
    const t = righeAggiuntive(
      input({ previsione: { direction: 'down', deltaC: -1.2, daysAhead: 7, confidence: 0.8, usable: true } }),
    ).join('\n');
    expect(t).toContain('prezzi in calo');
    expect(t).toContain('-1.2 centesimi');
    expect(t).toContain('affidabilita 80%');
  });

  it('dice quanto del prezzo e tassa per diesel e benzina', () => {
    expect(righeAggiuntive(input()).join('\n')).toContain('accisa €0.632');
    expect(righeAggiuntive(input({ fuel: 'gpl' })).join('\n')).not.toContain('accisa');
  });

  it('chiede i numeri all italiana', () => {
    expect(righeAggiuntive(input()).join('\n')).toContain('con la virgola');
  });
});

describe('dossierPrezzi', () => {
  it('mette insieme il contesto comune e le righe di oggi', () => {
    const t = dossierPrezzi(input());
    expect(t).toContain('Carburante in esame: Diesel.');
    expect(t).toContain('Eni Lugo');
    expect(t).toContain('Media nazionale di oggi');
    expect(t).not.toContain('tetto');
  });
});

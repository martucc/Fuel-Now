import { describe, it, expect } from 'vitest';
import { buildAiContext, variazioneStorico, type ContestoIa } from './aiContext';

const base: ContestoIa = {
  fuel: 'benzina',
  zona: null,
  consigliato: null,
  storico: [],
  news: [],
  auto: null,
  budget: null,
};

describe('variazioneStorico', () => {
  it('e nulla sotto i due punti', () => {
    expect(variazioneStorico([])).toBeNull();
    expect(variazioneStorico([{ price: 1.8 }])).toBeNull();
  });

  it('misura primo contro ultimo, non il massimo', () => {
    const v = variazioneStorico([{ price: 1.8 }, { price: 2.4 }, { price: 1.9 }]);
    expect(v).toBeCloseTo(5.555, 2);
  });
});

describe('buildAiContext', () => {
  it('dichiara l assenza dei prezzi invece di tacerla', () => {
    // Il silenzio su un dato mancante e cio che fa inventare numeri al modello.
    const t = buildAiContext(base);
    expect(t).toContain('Nessun prezzo confrontabile');
    expect(t).toContain('Storico nazionale non disponibile');
  });

  it('riporta la zona con campione, media e forbice in centesimi', () => {
    const t = buildAiContext({
      ...base,
      zona: { media: 1.85, minimo: 1.799, massimo: 1.949, campione: 42 },
    });
    expect(t).toContain('42 distributori');
    expect(t).toContain('€1.850');
    expect(t).toContain('15.0 centesimi');
  });

  it('nomina il consigliato col risparmio netto quando c e', () => {
    const t = buildAiContext({
      ...base,
      consigliato: { nome: 'Q8 Prenestina', prezzo: 1.779, km: 3.2, risparmioEur: 4.35 },
    });
    expect(t).toContain('Q8 Prenestina');
    expect(t).toContain('3.2 km');
    expect(t).toContain('4.35 euro');
  });

  it('omette il risparmio quando non e positivo', () => {
    const t = buildAiContext({
      ...base,
      consigliato: { nome: 'Eni Tuscolana', prezzo: 1.8, km: 1.1, risparmioEur: 0 },
    });
    expect(t).not.toContain('risparmio netto');
  });

  it('taglia lo storico agli ultimi quattordici punti ma calcola la variazione su tutto', () => {
    const storico = Array.from({ length: 30 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      price: 1.8 + i * 0.01,
    }));
    const t = buildAiContext({ ...base, storico });

    expect(t).toContain('ultimi 14 rilevamenti');
    expect(t).not.toContain('2026-01-01 ');
    expect(t).toContain('2026-01-30');
    // 1.80 -> 2.09 e +16,1%: la variazione guarda tutta la serie, non la coda.
    expect(t).toContain('salita del 16.1%');
  });

  it('preferisce il consumo reale a quello dichiarato', () => {
    const t = buildAiContext({
      ...base,
      auto: { modello: 'Golf 1.6 TDI', serbatoioL: 50, kml: 18, kmlReale: 15.4 },
    });
    expect(t).toContain('reale misurato');
    expect(t).toContain('15.4 km/l');
    expect(t).not.toContain('18.0 km/l');
  });

  it('tace sul budget quando non e stato impostato', () => {
    const t = buildAiContext({ ...base, budget: { mensile: 0, speso: 0, giorniRimasti: 12 } });
    expect(t).not.toContain('tetto');
  });

  it('riporta il budget con quanto resta e per quanti giorni', () => {
    const t = buildAiContext({ ...base, budget: { mensile: 200, speso: 145.5, giorniRimasti: 9 } });
    expect(t).toContain('200 euro al mese');
    expect(t).toContain('54.50 euro per 9 giorni');
  });

  it('scarta le notizie senza titolo', () => {
    const t = buildAiContext({
      ...base,
      news: [{ impact: 'negative' }, { title: 'Sciopero benzinai', impact: 'negative' }],
    });
    expect(t).toContain('Sciopero benzinai');
    expect(t.match(/\[negativo?\]/g)?.length ?? 0).toBeLessThanOrEqual(1);
  });
});

describe('buildAiContext: i fatti di mercato', () => {
  it('tace su tutto quello che il mercato non sa dire', () => {
    const t = buildAiContext({
      ...base,
      mercato: {
        prov: 'RM',
        deltaZonaItaliaC: null,
        spreadC: null,
        autostradaC: null,
        servitoC: null,
        marchiEconomici: [],
        frescoSuTotale: null,
      },
    });
    expect(t).not.toContain('media italiana');
    expect(t).not.toContain('autostrada');
    expect(t).not.toContain('servito');
  });

  it('dice se la provincia costa piu o meno del paese', () => {
    const t = buildAiContext({
      ...base,
      mercato: {
        prov: 'RM',
        deltaZonaItaliaC: 2.4,
        spreadC: 15.2,
        autostradaC: 18.7,
        servitoC: 21,
        marchiEconomici: [{ brand: 'Q8', avg: 1.799 }],
        frescoSuTotale: [120, 300],
      },
    });
    expect(t).toContain('provincia di RM');
    expect(t).toContain('piu cara');
    expect(t).toContain('2.4 centesimi');
    expect(t).toContain('15.2 centesimi');
    expect(t).toContain('Q8');
    expect(t).toContain('120 impianti su 300');
  });
});

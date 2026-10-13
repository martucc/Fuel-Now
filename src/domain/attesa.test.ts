import { describe, it, expect } from 'vitest';
import { affidabilita, convieneAspettare, fraseGiornoMigliore } from './attesa';
import type { GiornoSettimana, RitmoSettimanale } from './settimana';
import type { ForecastView } from './forecast';

const f = (over: Partial<ForecastView>): ForecastView => ({
  direction: 'flat', deltaC: 0, daysAhead: 7, confidence: 0.9, usable: true, ...over,
});

describe('convieneAspettare', () => {
  it('previsione in calo e affidabile: aspetta, con i numeri all italiana', () => {
    const r = convieneAspettare({ forecast: f({ direction: 'down', deltaC: -2.4, confidence: 0.8 }), bestLevel: 'normal', litri: 50 });
    expect(r.verso).toBe('aspetta');
    expect(r.titolo).toBe('Sì, se puoi aspettare');
    expect(r.testo).toContain('circa 2,4 cent');
    expect(r.testo).toContain('nei prossimi 7 giorni');
    expect(r.testo).toContain('1,20 €');
    expect(r.testo).not.toMatch(/\d\.\d/);
    expect(r.euroPieno).toBeCloseTo(1.2, 9);
  });

  it('previsione in salita: fai il pieno ora', () => {
    const r = convieneAspettare({ forecast: f({ direction: 'up', deltaC: 1.5 }), bestLevel: 'high', litri: 40 });
    expect(r.verso).toBe('ora');
    expect(r.testo).toContain('in salita di circa 1,5 cent');
    expect(r.euroPieno).toBeCloseTo(-0.6, 9);
  });

  it('senza previsione affidabile non scrive numeri sul futuro', () => {
    for (const forecast of [null, f({ usable: false, direction: 'down', deltaC: -5 })]) {
      const r = convieneAspettare({ forecast, bestLevel: 'normal', litri: 50 });
      expect(r.verso).toBe('incerto');
      expect(r.testo).toContain('Nessuna previsione affidabile');
      expect(r.testo).not.toMatch(/\d/);
      expect(r.euroPieno).toBeNull();
    }
  });

  it('un affare vicino vince, e dice se il futuro e ignoto', () => {
    const r = convieneAspettare({ forecast: null, bestLevel: 'best', litri: 50 });
    expect(r.titolo).toBe('No, approfitta di oggi');
    expect(r.testo).toContain('non c’è una previsione affidabile');
  });

  it('prezzi stabili: non serve aspettare', () => {
    const r = convieneAspettare({ forecast: f({}), bestLevel: 'normal', litri: 50 });
    expect(r.titolo).toBe('Non serve aspettare');
    expect(r.verso).toBe('indifferente');
  });

  it('un calo incerto non diventa un invito ad aspettare', () => {
    const r = convieneAspettare({ forecast: f({ direction: 'down', deltaC: -1, confidence: 0.4 }), bestLevel: 'normal', litri: 50 });
    expect(r.verso).toBe('indifferente');
    expect(r.testo).toContain('incerta');
  });

  it('non scrive euro ridicoli su un delta minuscolo', () => {
    const r = convieneAspettare({ forecast: f({ direction: 'up', deltaC: 0.1 }), bestLevel: 'normal', litri: 40 });
    expect(r.testo).not.toContain('€');
  });
});

describe('affidabilita', () => {
  it('traduce la fiducia in parole e tace se la previsione non regge', () => {
    expect(affidabilita(f({ confidence: 0.85 }))).toBe('alta');
    expect(affidabilita(f({ confidence: 0.55 }))).toBe('media');
    expect(affidabilita(f({ confidence: 0.35 }))).toBe('bassa');
    expect(affidabilita(f({ usable: false }))).toBeNull();
    expect(affidabilita(null)).toBeNull();
  });
});

describe('fraseGiornoMigliore', () => {
  const giorno = (g: number, nome: string, scartoC: number): GiornoSettimana => ({ giorno: g, nome, scartoC, campione: 20, erroreC: 0.05 });
  const ritmo = (migliore: GiornoSettimana, significativo: boolean): RitmoSettimanale => ({
    giorni: [migliore], migliore, peggiore: migliore, ampiezzaC: 0.8, significativo,
  });

  it('nomina il giorno con l articolo giusto e i centesimi all italiana', () => {
    expect(fraseGiornoMigliore(ritmo(giorno(1, 'lunedì', -0.42), true))).toBe(
      'Di solito il giorno più economico è il lunedì: circa 0,4 cent sotto la media della settimana.',
    );
    expect(fraseGiornoMigliore(ritmo(giorno(0, 'domenica', -0.5), true))).toContain('è la domenica');
  });

  it('tace quando il ritmo non e significativo', () => {
    expect(fraseGiornoMigliore(ritmo(giorno(1, 'lunedì', -0.42), false))).toBeNull();
    expect(fraseGiornoMigliore({ giorni: [], migliore: null, peggiore: null, ampiezzaC: 0, significativo: false })).toBeNull();
  });
});

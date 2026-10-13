import { describe, it, expect } from 'vitest';
import { readForecast, adviceOfTheDay, MIN_FORECAST_CONFIDENCE } from './forecast';
import type { ForecastView } from './forecast';
import { realDataset } from './__fixtures__/dataset';

const d = realDataset();

describe('readForecast', () => {
  it('legge la previsione di backend senza toccarla', () => {
    const f = readForecast(d, 'benzina')!;
    expect(f.direction).toBe(d.forecast.benzina!.direction);
    expect(f.deltaC).toBe(d.forecast.benzina!.delta_c);
    expect(f.daysAhead).toBe(d.forecast.benzina!.days_ahead);
    expect(f.confidence).toBe(d.forecast.benzina!.confidence);
  });

  it('marca utilizzabile solo la previsione sopra soglia', () => {
    // Non si fissano i valori del dataset: cambiano ogni giorno, e un test
    // che li insegue fallisce ogni volta che i dati vengono rinfrescati.
    // Quello che deve reggere e la regola.
    expect(MIN_FORECAST_CONFIDENCE).toBe(0.3);

    const sotto = { ...d, forecast: { benzina: { direction: 'flat' as const, delta_c: 0, days_ahead: 7, confidence: 0.07 } } };
    expect(readForecast(sotto, 'benzina')!.usable).toBe(false);

    const sopra = { ...d, forecast: { benzina: { direction: 'up' as const, delta_c: 1.2, days_ahead: 5, confidence: 0.91 } } };
    expect(readForecast(sopra, 'benzina')!.usable).toBe(true);

    const esatta = { ...d, forecast: { benzina: { direction: 'flat' as const, delta_c: 0, days_ahead: 7, confidence: MIN_FORECAST_CONFIDENCE } } };
    expect(readForecast(esatta, 'benzina')!.usable).toBe(true);
  });

  it('sul dataset vero ogni carburante o ha una previsione intera o non ce l ha', () => {
    for (const f of d.fuels) {
      const v = readForecast(d, f);
      if (v === null) continue;
      expect(Number.isFinite(v.deltaC), f).toBe(true);
      expect(v.daysAhead, f).toBeGreaterThan(0);
      expect(v.confidence, f).toBeGreaterThanOrEqual(0);
      expect(v.confidence, f).toBeLessThanOrEqual(1);
      expect(v.usable, f).toBe(v.confidence >= MIN_FORECAST_CONFIDENCE);
    }
  });

  it('restituisce null se il carburante non ha previsione', () => {
    expect(readForecast({ ...d, forecast: {} }, 'diesel')).toBeNull();
  });
});

const usable = (over: Partial<ForecastView>): ForecastView => ({
  direction: 'flat', deltaC: 0, daysAhead: 7, confidence: 0.9, usable: true, ...over,
});

describe('adviceOfTheDay', () => {
  it('in riserva dice di rifornire, comunque vada la previsione', () => {
    const r = adviceOfTheDay({ bestLevel: 'worst', forecast: usable({ direction: 'down' }), tankPct: 0.08 });
    expect(r.advice).toBe('URGENT');
  });

  it('previsione in calo e confidenza sufficiente: metti il minimo', () => {
    const r = adviceOfTheDay({ bestLevel: 'normal', forecast: usable({ direction: 'down', confidence: 0.6 }), tankPct: 0.5 });
    expect(r.advice).toBe('TEN-EURO');
  });

  it('previsione in calo ma confidenza sotto 0,5: non si azzarda', () => {
    const r = adviceOfTheDay({ bestLevel: 'normal', forecast: usable({ direction: 'down', confidence: 0.4 }), tankPct: 0.5 });
    expect(r.advice).not.toBe('TEN-EURO');
  });

  it('previsione in salita: fai il pieno', () => {
    const r = adviceOfTheDay({ bestLevel: 'normal', forecast: usable({ direction: 'up', confidence: 0.8 }), tankPct: 0.5 });
    expect(r.advice).toBe('FILL-FULL');
  });

  it('affarone disponibile: fai il pieno anche senza previsione', () => {
    const r = adviceOfTheDay({ bestLevel: 'best', forecast: null, tankPct: 0.5 });
    expect(r.advice).toBe('FILL-FULL');
  });

  it('senza previsione utilizzabile lo dichiara', () => {
    const r = adviceOfTheDay({ bestLevel: 'high', forecast: usable({ usable: false }), tankPct: 0.5 });
    expect(r.advice).toBe('PRICE-ONLY');
    expect(r.reason).toContain('segnale insufficiente');
  });

  it('senza livello serbatoio non inventa la riserva', () => {
    const r = adviceOfTheDay({ bestLevel: 'normal', forecast: usable({ direction: 'up' }), tankPct: null });
    expect(r.advice).toBe('FILL-FULL');
  });
});

import { describe, it, expect } from 'vitest';
import { seriesFromDataset } from './series';
import { realDataset } from '../../domain/__fixtures__/dataset';
import type { RawDataset } from '../../domain/raw';

const data = realDataset();

describe('seriesFromDataset — storico', () => {
  it('viene dal backend, non generato', () => {
    const s = seriesFromDataset(data, 'benzina');
    expect(s.historicalData.length).toBeGreaterThan(0);
    const ultimo = s.historicalData[s.historicalData.length - 1]!;
    const storico = data.history!.benzina!;
    expect(ultimo.price).toBe(storico[storico.length - 1]!.avg);
  });

  it('le date sono quelle vere, non "-3g"', () => {
    for (const p of seriesFromDataset(data, 'benzina').historicalData) {
      expect(p.date).toMatch(/^\d{2}\/\d{2}$/);
    }
  });

  it('regge una serie corta: metano ne ha molti meno degli altri', () => {
    const s = seriesFromDataset(data, 'metano');
    expect(s.historicalData.length).toBeGreaterThan(0);
    expect(() => seriesFromDataset(data, 'metano')).not.toThrow();
  });

  it('senza storico non inventa punti', () => {
    const senza = { ...data, history: {} } as RawDataset;
    expect(seriesFromDataset(senza, 'benzina').historicalData).toEqual([]);
  });
});

describe('seriesFromDataset — previsione', () => {
  it('parte dall ultimo valore vero dello storico', () => {
    const finto = {
      ...data,
      forecast: { benzina: { direction: 'down', delta_c: -2, days_ahead: 4, confidence: 0.9 } },
    } as unknown as RawDataset;
    const s = seriesFromDataset(finto, 'benzina');
    const ultimoStorico = s.historicalData[s.historicalData.length - 1]!.price;
    expect(s.forecast[0]!.price).toBeLessThan(ultimoStorico);
    expect(s.forecast).toHaveLength(4);
  });

  it('arriva esattamente al delta dichiarato dal backend', () => {
    const finto = {
      ...data,
      forecast: { benzina: { direction: 'down', delta_c: -2, days_ahead: 4, confidence: 0.9 } },
    } as unknown as RawDataset;
    const s = seriesFromDataset(finto, 'benzina');
    const ultimoStorico = s.historicalData[s.historicalData.length - 1]!.price;
    const ultimaPrevisione = s.forecast[s.forecast.length - 1]!.price;
    expect(ultimaPrevisione - ultimoStorico).toBeCloseTo(-0.02, 3);
  });

  it('con confidenza sotto la soglia non disegna niente', () => {
    const finto = {
      ...data,
      forecast: { benzina: { direction: 'down', delta_c: -3, days_ahead: 7, confidence: 0.1 } },
    } as unknown as RawDataset;
    expect(seriesFromDataset(finto, 'benzina').forecast).toEqual([]);
  });

  it('senza forecast nel dataset non ne fabbrica uno', () => {
    const senza = { ...data, forecast: {} } as RawDataset;
    expect(seriesFromDataset(senza, 'benzina').forecast).toEqual([]);
  });

  it('non aggiunge ondulazioni: la previsione e una retta', () => {
    const finto = {
      ...data,
      forecast: { benzina: { direction: 'up', delta_c: 3, days_ahead: 6, confidence: 0.8 } },
    } as unknown as RawDataset;
    const p = seriesFromDataset(finto, 'benzina').forecast.map((x) => x.price);
    const passi = p.slice(1).map((v, i) => v - p[i]!);
    for (const passo of passi) expect(passo).toBeCloseTo(passi[0]!, 6);
  });
});

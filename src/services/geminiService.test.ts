import { describe, it, expect } from 'vitest';
import { estraiJson, normalizza, MESSAGGIO_ERRORE } from './geminiService';

describe('estraiJson', () => {
  it('legge il JSON nudo', () => {
    expect(estraiJson('{"advice":"WAIT"}')).toEqual({ advice: 'WAIT' });
  });

  it('legge il JSON dentro i backtick', () => {
    expect(estraiJson('```json\n{"trend":"UP"}\n```')).toEqual({ trend: 'UP' });
  });

  it('recupera il JSON annegato nella prosa', () => {
    const t = 'Ecco la risposta:\n{"advice":"URGENT"}\nSpero sia utile.';
    expect(estraiJson(t)).toEqual({ advice: 'URGENT' });
  });

  it('restituisce null se non c e JSON', () => {
    expect(estraiJson('mi dispiace, non posso rispondere')).toBeNull();
    expect(estraiJson('')).toBeNull();
  });
});

describe('normalizza', () => {
  it('riempie gli elenchi mancanti invece di lasciarli indefiniti', () => {
    const a = normalizza({ advice: 'WAIT', reasoning: 'x', detailedReport: 'y', trend: 'DOWN' });
    expect(a.categories).toEqual([]);
    expect(a.tips).toEqual([]);
    expect(a.forecast).toEqual([]);
  });

  it('butta via i punti di previsione senza un prezzo vero', () => {
    // Un prezzo previsto che non e un numero manda a zero il grafico.
    const a = normalizza({
      forecast: [
        { date: '+1g', price: 1.82 },
        { date: '+2g', price: null },
        { date: '+3g', price: 0 },
        { date: '+4g' },
      ],
    });
    expect(a.forecast).toEqual([{ date: '+1g', price: 1.82 }]);
  });

  it('mette valori di ripiego su verso e consiglio', () => {
    const a = normalizza({});
    expect(a.trend).toBe('STABLE');
    expect(a.advice).toBeTruthy();
  });
});

describe('messaggi di errore', () => {
  it('sono frasi in italiano, non codici', () => {
    for (const [codice, messaggio] of Object.entries(MESSAGGIO_ERRORE)) {
      expect(messaggio.length, codice).toBeGreaterThan(20);
      expect(messaggio, codice).not.toMatch(/[A-Z]{4,}/);
    }
  });
});

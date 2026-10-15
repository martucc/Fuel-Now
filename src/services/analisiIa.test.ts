import { describe, it, expect } from 'vitest';
import type { MarketAnalysis } from '../types';
import type { Archivio } from './analisiIa';
import { chiaveAnalisi, codiceErrore, daRisposta, firmaDataset, leggiAnalisi, paragrafi, salvaAnalisi } from './analisiIa';
import { ErroreIa } from './geminiService';

class Finto implements Archivio {
  m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

const risposta = (over: Partial<MarketAnalysis> = {}): MarketAnalysis => ({
  advice: 'FILL-FULL',
  reasoning: 'Fai il pieno quando ti serve.',
  detailedReport: 'Primo paragrafo.\n\n**Secondo** paragrafo.\n',
  trend: 'STABLE',
  categories: [],
  tips: [{ title: 'Self', text: 'Il self costa meno.', impact: 'HIGH' }],
  historicalData: [],
  forecast: [],
  ...over,
});

describe('chiave e firma', () => {
  it('la chiave tiene insieme carburante, modello e file dei prezzi', () => {
    expect(chiaveAnalisi('diesel', 'gemini-2.5-flash', '2026-10-12T22:27:46Z')).toBe(
      'mf2_ia_diesel_gemini-2.5-flash_2026-10-12T22:27:46Z',
    );
  });

  it('la firma preferisce l ora della pipeline alla data di estrazione', () => {
    expect(firmaDataset({ extracted_at: '2026-10-13', source: { generated_at: '2026-10-12T22:27:46Z' } })).toBe('2026-10-12T22:27:46Z');
    expect(firmaDataset({ extracted_at: '2026-10-13' })).toBe('2026-10-13');
    expect(firmaDataset(null)).toBeNull();
  });
});

describe('daRisposta', () => {
  it('divide il rapporto in paragrafi e toglie il markdown', () => {
    const a = daRisposta(risposta(), 'gemini-2.5-flash', 1000);
    expect(a.paragrafi).toEqual(['Primo paragrafo.', 'Secondo paragrafo.']);
    expect(a.consigli).toEqual([{ titolo: 'Self', testo: 'Il self costa meno.' }]);
    expect(a.creata).toBe(1000);
  });

  it('regge una risposta senza consigli', () => {
    const a = daRisposta(risposta({ tips: undefined as unknown as MarketAnalysis['tips'] }), 'm', 0);
    expect(a.consigli).toEqual([]);
  });

  it('toglie titoletti ed elenchi', () => {
    expect(paragrafi('## Quadro\n- uno\n• due')).toEqual(['Quadro', 'uno', 'due']);
  });
});

describe('leggiAnalisi e salvaAnalisi', () => {
  it('rilegge quello che ha salvato', () => {
    const f = new Finto();
    const a = daRisposta(risposta(), 'm', 5);
    salvaAnalisi('mf2_ia_diesel_m_F1', 'F1', a, f);
    expect(leggiAnalisi('mf2_ia_diesel_m_F1', f)).toEqual(a);
  });

  it('butta le copie di un file dei prezzi vecchio e lascia stare il resto', () => {
    const f = new Finto();
    f.setItem('mf2_ia_diesel_m_F0', '{}');
    f.setItem('mf2_ia_benzina_m_F1', '{}');
    f.setItem('mf2_impostazioni', '{}');
    salvaAnalisi('mf2_ia_diesel_m_F1', 'F1', daRisposta(risposta(), 'm', 5), f);
    expect([...f.m.keys()].sort()).toEqual(['mf2_ia_benzina_m_F1', 'mf2_ia_diesel_m_F1', 'mf2_impostazioni']);
  });

  it('ignora una copia rotta invece di romperci sopra', () => {
    const f = new Finto();
    f.setItem('k1', 'non json');
    f.setItem('k2', JSON.stringify({ sintesi: 3 }));
    expect(leggiAnalisi('k1', f)).toBeNull();
    expect(leggiAnalisi('k2', f)).toBeNull();
    expect(leggiAnalisi('assente', f)).toBeNull();
    expect(leggiAnalisi('k1', null)).toBeNull();
  });
});

describe('codiceErrore', () => {
  it('tiene il codice degli errori di Gemini e indovina gli altri dalla rete', () => {
    expect(codiceErrore(new ErroreIa('QUOTA', 'x'), true)).toBe('QUOTA');
    expect(codiceErrore(new TypeError('Failed to fetch'), false)).toBe('NETWORK');
    expect(codiceErrore('boh', true)).toBe('UNKNOWN');
  });
});

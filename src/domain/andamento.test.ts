import { describe, it, expect } from 'vitest';
import {
  andamento,
  estremi,
  frasePrevisione,
  centesimiCirca,
  pulisciStorico,
  puntiPrevisione,
  ritaglia,
  variazione,
} from './andamento';
import type { ForecastView } from './forecast';

/** n giorni consecutivi dal 1 gennaio 2026. */
function giorni(n: number, prezzo: (i: number) => number) {
  const inizio = Date.UTC(2026, 0, 1);
  return Array.from({ length: n }, (_, i) => ({
    date: new Date(inizio + i * 86_400_000).toISOString().slice(0, 10),
    avg: prezzo(i),
  }));
}

const previsione = (over: Partial<ForecastView>): ForecastView => ({
  direction: 'flat', deltaC: 0, daysAhead: 7, confidence: 0.9, usable: true, ...over,
});

describe('pulisciStorico', () => {
  it('scarta date illeggibili e prezzi non positivi, e mette in ordine', () => {
    const s = pulisciStorico([
      { date: '2026-01-03', avg: 1.9 },
      { date: 'boh', avg: 1.8 },
      { date: '2026-01-01', avg: 0 },
      { date: '2026-01-02', avg: 1.85 },
      { date: '2026-01-04', avg: Number.NaN },
    ]);
    expect(s.map((p) => p.date)).toEqual(['2026-01-02', '2026-01-03']);
  });

  it('tiene una data sola, l ultima arrivata', () => {
    const s = pulisciStorico([
      { date: '2026-01-02', avg: 1.8 },
      { date: '2026-01-02', avg: 1.81 },
    ]);
    expect(s).toHaveLength(1);
    expect(s[0]!.prezzo).toBe(1.81);
  });

  it('regge uno storico assente', () => {
    expect(pulisciStorico(undefined)).toEqual([]);
  });
});

describe('ritaglia', () => {
  it('conta i giorni dall ultimo punto, non da oggi', () => {
    const s = pulisciStorico(giorni(100, () => 1.9));
    const r = ritaglia(s, 30);
    expect(r).toHaveLength(31);
    expect(r[r.length - 1]).toBe(s[s.length - 1]);
  });

  it('su uno storico settimanale taglia per data, non per numero di punti', () => {
    const settimanale = Array.from({ length: 20 }, (_, i) => ({
      date: new Date(Date.UTC(2025, 0, 6) + i * 7 * 86_400_000).toISOString().slice(0, 10),
      avg: 1.8,
    }));
    expect(ritaglia(pulisciStorico(settimanale), 30)).toHaveLength(5);
  });
});

describe('estremi', () => {
  it('trova minimo e massimo, e a pari prezzo il piu recente', () => {
    const s = pulisciStorico(giorni(5, (i) => [1.9, 1.8, 2.0, 1.8, 1.95][i]!));
    const e = estremi(s)!;
    expect(e.minimo.date).toBe('2026-01-04');
    expect(e.massimo.date).toBe('2026-01-03');
    expect(e.ultimo.prezzo).toBe(1.95);
    expect(e.primo.prezzo).toBe(1.9);
  });

  it('e nullo su una serie vuota', () => {
    expect(estremi([])).toBeNull();
  });
});

describe('variazione', () => {
  it('misura centesimi e percentuale contro il punto di una settimana prima', () => {
    const s = pulisciStorico(giorni(40, (i) => 1.8 + i * 0.001));
    const v = variazione(s, 7)!;
    expect(v.da.date).toBe('2026-02-02');
    expect(v.deltaC).toBeCloseTo(0.7, 6);
    expect(v.percento).toBeCloseTo((0.007 / 1.832) * 100, 6);
  });

  it('dice di quanto sono scesi col segno meno', () => {
    const s = pulisciStorico(giorni(40, (i) => 2 - i * 0.002));
    expect(variazione(s, 30)!.deltaC).toBeCloseTo(-6, 6);
  });

  it('tace se il punto di partenza e troppo lontano dalla data cercata', () => {
    // Un buco di tre settimane prima dell ultima settimana di dati.
    const s = pulisciStorico([
      { date: '2026-01-01', avg: 1.8 },
      ...giorni(40, () => 1.9).slice(25),
    ]);
    expect(variazione(s, 30)).toBeNull();
  });

  it('tace se lo storico e piu corto del confronto', () => {
    expect(variazione(pulisciStorico(giorni(5, () => 1.9)), 7)).toBeNull();
    expect(variazione([], 7)).toBeNull();
  });
});

describe('puntiPrevisione', () => {
  const ultimo = pulisciStorico([{ date: '2026-01-10', avg: 2 }])[0];

  it('distribuisce il delta in linea retta sui giorni dichiarati', () => {
    const p = puntiPrevisione(ultimo, previsione({ direction: 'down', deltaC: -1.4, daysAhead: 7 }));
    expect(p).toHaveLength(7);
    expect(p[0]!.date).toBe('2026-01-11');
    expect(p[6]!.prezzo).toBeCloseTo(2 - 0.014, 9);
  });

  it('non disegna niente se la previsione non e affidabile', () => {
    expect(puntiPrevisione(ultimo, previsione({ usable: false }))).toEqual([]);
    expect(puntiPrevisione(ultimo, null)).toEqual([]);
    expect(puntiPrevisione(undefined, previsione({}))).toEqual([]);
  });
});

describe('frasePrevisione', () => {
  it('senza previsione affidabile lo dice', () => {
    expect(frasePrevisione(null)).toBe('Nessuna previsione affidabile per i prossimi giorni.');
    expect(frasePrevisione(previsione({ usable: false, direction: 'up', deltaC: 3 }))).toBe(
      'Nessuna previsione affidabile per i prossimi giorni.',
    );
  });

  it('scrive i centesimi all italiana', () => {
    expect(frasePrevisione(previsione({ direction: 'down', deltaC: -1.25 }))).toBe(
      'In tratteggio la previsione: in calo di circa 1,3 cent al litro nei prossimi 7 giorni.',
    );
  });

  it('chiama stabili i prezzi piatti', () => {
    expect(frasePrevisione(previsione({}))).toBe('In tratteggio la previsione: prezzi stabili nei prossimi 7 giorni.');
  });

  it('non scrive «circa 0,0 cent»', () => {
    expect(centesimiCirca(0.01)).toBe('meno di un decimo di cent');
    expect(centesimiCirca(-2)).toBe('circa 2,0 cent');
  });
});

describe('andamento', () => {
  it('ritaglia la finestra ma misura i confronti su tutta la serie', () => {
    const s = pulisciStorico(giorni(400, (i) => 1.7 + i * 0.001));
    const a = andamento(s, 30, previsione({ direction: 'up', deltaC: 0.7 }));
    expect(a.punti).toHaveLength(31);
    expect(a.estremi!.ultimo).toBe(s[s.length - 1]);
    expect(a.settimana!.deltaC).toBeCloseTo(0.7, 6);
    expect(a.mese!.deltaC).toBeCloseTo(3, 6);
    expect(a.previsione).toHaveLength(7);
    expect(andamento(s, 365, null).punti).toHaveLength(366);
  });
});

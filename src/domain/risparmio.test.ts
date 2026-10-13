import { describe, it, expect } from 'vitest';
import {
  calcolaBilancio, consiglioPer, stessoImpianto, normalizzaNome, filtraAnno,
  type ConsiglioRegistrato, type PienoFatto,
} from './risparmio';

function consiglio(over: Partial<ConsiglioRegistrato> = {}): ConsiglioRegistrato {
  return {
    date: '2026-08-10',
    fuel: 'benzina',
    stationId: 's1',
    stationName: 'Q8 Prenestina',
    price: 1.8,
    cohortAvg: 1.9,
    netEur: 4.5,
    ...over,
  };
}

function pieno(over: Partial<PienoFatto> = {}): PienoFatto {
  return {
    id: 'p1',
    date: '2026-08-10',
    fuel: 'benzina',
    liters: 50,
    pricePerLiter: 1.8,
    stationName: 'Q8 Prenestina',
    ...over,
  };
}

describe('normalizzaNome', () => {
  it('toglie accenti, maiuscole e punteggiatura', () => {
    expect(normalizzaNome('Q8 — Prenestìna, 12')).toBe('q8 prenestina 12');
  });
});

describe('stessoImpianto', () => {
  it('riconosce lo stesso nome scritto diversamente', () => {
    expect(stessoImpianto('Q8 Prenestina', 'q8  prenestina')).toBe(true);
  });

  it('accetta il nome piu corto dentro quello piu lungo', () => {
    // Chi scrive a mano abbrevia: «Q8» per «Q8 Prenestina».
    expect(stessoImpianto('Q8', 'Q8 Prenestina')).toBe(true);
  });

  it('non accoppia impianti diversi', () => {
    expect(stessoImpianto('Eni Casilina', 'Q8 Prenestina')).toBe(false);
  });

  it('e falso quando un nome manca', () => {
    expect(stessoImpianto(undefined, 'Q8')).toBe(false);
    expect(stessoImpianto('', 'Q8')).toBe(false);
  });
});

describe('consiglioPer', () => {
  it('prende il consiglio dello stesso giorno', () => {
    const c = consiglio();
    expect(consiglioPer(pieno(), [c])).toBe(c);
  });

  it('accetta il consiglio del giorno prima', () => {
    // Si fa il pieno la mattina, sul consiglio di ieri sera.
    const ieri = consiglio({ date: '2026-08-09' });
    expect(consiglioPer(pieno({ date: '2026-08-10' }), [ieri])).toBe(ieri);
  });

  it('scarta un consiglio troppo vecchio', () => {
    expect(consiglioPer(pieno({ date: '2026-08-10' }), [consiglio({ date: '2026-08-01' })])).toBeNull();
  });

  it('non mescola i carburanti', () => {
    expect(consiglioPer(pieno({ fuel: 'diesel' }), [consiglio({ fuel: 'benzina' })])).toBeNull();
  });

  it('fra due consigli sceglie il piu vicino nel tempo', () => {
    const oggi = consiglio({ date: '2026-08-10', stationName: 'Oggi' });
    const ieri = consiglio({ date: '2026-08-09', stationName: 'Ieri' });
    expect(consiglioPer(pieno({ date: '2026-08-10' }), [ieri, oggi])).toBe(oggi);
  });
});

describe('calcolaBilancio', () => {
  it('misura quanto hai speso sotto la media di quel giorno', () => {
    // 1,90 di media contro 1,80 pagati, su 50 litri: 5 euro in meno.
    const b = calcolaBilancio([pieno()], [consiglio()]);
    expect(b.esiti).toHaveLength(1);
    expect(b.esiti[0]!.scartoEur).toBeCloseTo(5, 2);
    expect(b.totaleEur).toBeCloseTo(5, 2);
  });

  it('conta anche i pieni fatti peggio della media, col segno giusto', () => {
    const b = calcolaBilancio([pieno({ pricePerLiter: 1.98 })], [consiglio()]);
    expect(b.esiti[0]!.scartoEur).toBeCloseTo(-4, 2);
    expect(b.totaleEur).toBeLessThan(0);
  });

  it('lascia fuori i pieni per cui non ha un riferimento di quel giorno', () => {
    // Confrontare un pieno di marzo con la media di agosto non misura niente.
    const b = calcolaBilancio([pieno({ date: '2026-03-02' })], [consiglio()]);
    expect(b.esiti).toEqual([]);
    expect(b.conConsiglio).toBe(0);
    expect(b.mediaEur).toBeNull();
  });

  it('scarta i pieni senza litri o senza prezzo', () => {
    const b = calcolaBilancio(
      [pieno({ id: 'a', liters: 0 }), pieno({ id: 'b', pricePerLiter: 0 })],
      [consiglio()]
    );
    expect(b.esiti).toEqual([]);
  });

  it('dice quanti pieni hai fatto dove diceva l app', () => {
    const pieni = [
      pieno({ id: 'a', stationName: 'Q8 Prenestina' }),
      pieno({ id: 'b', stationName: 'Eni Casilina' }),
    ];
    const b = calcolaBilancio(pieni, [consiglio()]);
    expect(b.conConsiglio).toBe(2);
    expect(b.seguiti).toBe(1);
  });

  it('confronta il promesso col mantenuto solo sui pieni seguiti', () => {
    // Promessi 4,50; alla pompa il conto e stato 5,00.
    const b = calcolaBilancio([pieno()], [consiglio({ netEur: 4.5 })]);
    expect(b.promessoEur).toBeCloseTo(4.5, 2);
    expect(b.mantenutoEur).toBeCloseTo(5, 2);
  });

  it('non azzarda il confronto quando non hai seguito nessun consiglio', () => {
    const b = calcolaBilancio([pieno({ stationName: 'Altro posto' })], [consiglio()]);
    expect(b.promessoEur).toBeNull();
    expect(b.mantenutoEur).toBeNull();
  });

  it('mette i pieni dal piu recente', () => {
    const pieni = [
      pieno({ id: 'vecchio', date: '2026-08-09' }),
      pieno({ id: 'nuovo', date: '2026-08-10' }),
    ];
    const consigli = [consiglio({ date: '2026-08-09' }), consiglio({ date: '2026-08-10' })];
    expect(calcolaBilancio(pieni, consigli).esiti.map((e) => e.id)).toEqual(['nuovo', 'vecchio']);
  });
});

describe('filtraAnno', () => {
  it('tiene solo i pieni dell anno chiesto e rifa i conti', () => {
    const pieni = [
      pieno({ id: 'a', date: '2026-08-10' }),
      pieno({ id: 'b', date: '2025-08-10' }),
    ];
    const consigli = [consiglio({ date: '2026-08-10' }), consiglio({ date: '2025-08-10' })];
    const tutto = calcolaBilancio(pieni, consigli);
    expect(tutto.esiti).toHaveLength(2);

    const soloQuest = filtraAnno(tutto, 2026);
    expect(soloQuest.esiti.map((e) => e.id)).toEqual(['a']);
    expect(soloQuest.totaleEur).toBeCloseTo(5, 2);
  });
});

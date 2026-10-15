import { describe, it, expect } from 'vitest';
import { centesimiConSegno, dataBreve, dataConAnno, delCarburante, ora, sottotitoloMigliore, unitaPrezzo } from './formatoPrezzi';

describe('formatoPrezzi', () => {
  it('scrive le date corte in italiano, senza slittare di un giorno', () => {
    const ts = Date.parse('2026-09-12T00:00:00Z');
    expect(dataBreve(ts)).toBe('12 set');
    expect(dataConAnno(ts)).toBe('12 set 2026');
  });

  it('mette sempre il segno ai centesimi, col meno tipografico', () => {
    expect(centesimiConSegno(1.24)).toBe('+1,2 cent');
    expect(centesimiConSegno(-0.4)).toBe('−0,4 cent');
    expect(centesimiConSegno(0.01)).toBe('0,0 cent');
    expect(centesimiConSegno(Number.NaN)).toBe('—');
  });

  it('scrive l ora con due cifre', () => {
    expect(ora(new Date(2026, 9, 13, 8, 5).getTime())).toBe('08:05');
  });

  it('mette l articolo giusto e l unita giusta', () => {
    expect(delCarburante('benzina')).toBe('della benzina');
    expect(delCarburante('gpl')).toBe('del GPL');
    expect(unitaPrezzo('metano')).toBe('€/kg');
    expect(unitaPrezzo('diesel')).toBe('€/L');
  });

  it('sotto il più conveniente dice quando il prezzo è al servito', () => {
    // Ventotene: l'unica pompa ha il solo servito, e la carta Oggi lo
    // mostrava sotto la nota «Prezzi self» come se fosse un self.
    expect(sottotitoloMigliore({ row: { brand: 'Agip Eni' }, distanceKm: 0.4, alServito: true })).toBe('Eni · 400 m · solo servito');
    expect(sottotitoloMigliore({ row: { brand: 'Q8' }, distanceKm: 2.34, alServito: false })).toBe('Q8 · 2,3 km');
  });
});

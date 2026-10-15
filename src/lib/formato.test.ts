import { describe, it, expect } from 'vitest';
import { numero, euro, prezzo, prezzoEuro, delta, chilometri, litri } from './formato';

describe('formato italiano', () => {
  it('separa le migliaia col punto e i decimali con la virgola', () => {
    expect(numero(12345)).toBe('12.345');
    expect(numero(12345.5, 2)).toBe('12.345,50');
  });

  it('lascia unite le quattro cifre, come vuole la convenzione italiana', () => {
    // CLDR per l'italiano non raggruppa i numeri di quattro cifre: «1055»,
    // non «1.055». Seguiamo la locale invece di correggerla a mano.
    expect(numero(1055)).toBe('1055');
    expect(numero(1234.5, 2)).toBe('1234,50');
  });

  it('scrive gli importi come sullo scontrino', () => {
    expect(euro(83.1)).toBe('83,10 €');
    expect(euro(200, 0)).toBe('200 €');
  });

  it('tiene i tre decimali del prezzo anche quando finiscono per zero', () => {
    // «1,88» e «1,880» sono lo stesso numero ma il secondo si confronta a colpo d'occhio.
    expect(prezzo(1.88)).toBe('1,880');
    expect(prezzoEuro(1.899)).toBe('€1,899');
  });

  it('mette sempre il segno sui delta, e il meno tipografico', () => {
    expect(delta(2.4)).toBe('+2,4%');
    expect(delta(-2.4)).toBe('−2,4%');
    expect(delta(0)).toBe('0,0%');
  });

  it('restituisce il trattino invece di NaN', () => {
    expect(numero(NaN)).toBe('—');
    expect(euro(Infinity)).toBe('—');
    expect(prezzo(0)).toBe('—');
    expect(chilometri(NaN)).toBe('—');
    expect(litri(NaN)).toBe('—');
  });

  it('scrive km e litri con l unita attaccata al numero giusto', () => {
    expect(chilometri(12400)).toBe('12.400 km');
    expect(litri(44)).toBe('44,0 L');
  });
});

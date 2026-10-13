import { describe, it, expect } from 'vitest';
import { durata, litriDaMettere, soste, unitaPrezzo } from './formatoViaggio';
import { normalizzaMemoria } from './memoriaViaggio';

describe('formatoViaggio', () => {
  it('scrive la durata come la si dice', () => {
    expect(durata(0.4)).toBe('1 min');
    expect(durata(45)).toBe('45 min');
    expect(durata(60)).toBe('1 h');
    expect(durata(229.6)).toBe('3 h 50 min');
    expect(durata(NaN)).toBe('—');
    expect(durata(0)).toBe('—');
  });

  it('accorda le soste al numero', () => {
    expect(soste(1)).toBe('1 sosta');
    expect(soste(3)).toBe('3 soste');
  });

  it('non dice mai di mettere zero litri', () => {
    expect(litriDaMettere(0.02)).toBe('0,1 L');
    expect(litriDaMettere(6.44)).toBe('6,4 L');
    expect(litriDaMettere(31.6)).toBe('32 L');
  });

  it('l unita del prezzo dipende dal carburante', () => {
    expect(unitaPrezzo('diesel')).toBe('€/L self');
    expect(unitaPrezzo('gpl')).toBe('€/L');
    expect(unitaPrezzo('metano')).toBe('€/kg');
  });
});

describe('normalizzaMemoria', () => {
  it('rilegge un arrivo e una priorita validi', () => {
    const m = normalizzaMemoria({ arrivo: { lat: 41.9, lng: 12.5, nome: ' Roma ', dettaglio: 'Lazio' }, strategia: 'veloce' });
    expect(m).toEqual({ arrivo: { lat: 41.9, lng: 12.5, nome: 'Roma', dettaglio: 'Lazio' }, strategia: 'veloce' });
  });

  it('butta via i valori rotti invece di rompere la scheda', () => {
    expect(normalizzaMemoria(null)).toEqual({ arrivo: null, strategia: null });
    expect(normalizzaMemoria('ciao')).toEqual({ arrivo: null, strategia: null });
    expect(normalizzaMemoria({ arrivo: { lat: 'x', lng: 12, nome: 'Roma' }, strategia: 'turbo' })).toEqual({ arrivo: null, strategia: null });
    expect(normalizzaMemoria({ arrivo: { lat: 41.9, lng: 12.5, nome: '' } }).arrivo).toBeNull();
    expect(normalizzaMemoria({ arrivo: { lat: 141.9, lng: 12.5, nome: 'Roma' } }).arrivo).toBeNull();
  });

  it('senza dettaglio ne mette uno vuoto', () => {
    expect(normalizzaMemoria({ arrivo: { lat: 41.9, lng: 12.5, nome: 'Roma' } }).arrivo?.dettaglio).toBe('');
  });
});

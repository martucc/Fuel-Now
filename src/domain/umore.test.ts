import { describe, expect, it } from 'vitest';
import { fraseUmore, umoreZona } from './umore';

const zona = (centro: number) => [centro - 0.02, centro - 0.01, centro, centro + 0.01, centro + 0.02];

describe('umoreZona', () => {
  it('misura la mediana della zona sulla media italiana, nelle cinque fasce dei prezzi', () => {
    expect(umoreZona(zona(2.15), 2.2).umore).toBe('best');
    expect(umoreZona(zona(2.18), 2.2).umore).toBe('good');
    expect(umoreZona(zona(2.2), 2.2).umore).toBe('normal');
    expect(umoreZona(zona(2.22), 2.2).umore).toBe('high');
    expect(umoreZona(zona(2.26), 2.2).umore).toBe('worst');
  });

  it('guarda la mediana, non il più economico: un solo prezzo basso non fa la zona verde', () => {
    const q = umoreZona([1.9, 2.3, 2.3, 2.31, 2.32], 2.2);
    expect(q.mediana).toBeCloseTo(2.3);
    expect(q.umore).toBe('worst');
  });

  it('senza abbastanza prezzi o senza media italiana resta neutro', () => {
    expect(umoreZona([2.1, 2.2], 2.2).umore).toBe('neutro');
    expect(umoreZona(zona(2.1), null).umore).toBe('neutro');
    expect(umoreZona([Number.NaN, 0, -1, 2.1], 2.2).umore).toBe('neutro');
  });

  it('i bordi delle fasce stanno dalla parte di chi spende meno', () => {
    expect(umoreZona(zona(2.16), 2.2).umore).toBe('best');
    expect(umoreZona(zona(2.17), 2.2).umore).toBe('good');
    expect(umoreZona(zona(2.24), 2.2).umore).toBe('worst');
  });
});

describe('fraseUmore', () => {
  it('dice di quanti centesimi la zona sta sopra o sotto la media italiana', () => {
    expect(fraseUmore(umoreZona(zona(2.15), 2.2))).toBe('Qui oggi si spende poco: 5,0 cent sotto la media italiana.');
    expect(fraseUmore(umoreZona(zona(2.3), 2.2))).toBe('Qui si spende tanto: 10 cent sopra la media italiana.');
    expect(fraseUmore(umoreZona(zona(2.2), 2.2))).toBe('Qui i prezzi sono nella media italiana.');
  });

  it('niente frase quando la zona non si può giudicare', () => {
    expect(fraseUmore(umoreZona([2.2], 2.2))).toBeNull();
  });
});

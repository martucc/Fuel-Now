import { describe, it, expect } from 'vitest';
import { iniziali, logoMarchio, nomeImpianto, nomeMarchio } from './marchio';

describe('logoMarchio', () => {
  it('riconosce i marchi per parola intera', () => {
    expect(logoMarchio('Agip Eni')).toBe('assets/logos/eni.png');
    expect(logoMarchio('Api-Ip')).toBe('assets/logos/ip.png');
    expect(logoMarchio('Q8')).toBe('assets/logos/q8.png');
  });
  it('«Indipendente» e «Pompe Bianche» non diventano IP', () => {
    expect(logoMarchio('Indipendente')).toBeNull();
    expect(logoMarchio('Pompe Bianche')).toBeNull();
    expect(logoMarchio('Itala Petroli')).toBeNull();
  });
});

describe('nomeMarchio', () => {
  it('rende leggibili i marchi del MIMIT', () => {
    expect(nomeMarchio('Agip Eni')).toBe('Eni');
    expect(nomeMarchio('Api-Ip')).toBe('IP');
    expect(nomeMarchio('Pompe Bianche')).toBe('Indipendente');
    expect(nomeMarchio('KEROPETROL')).toBe('Keropetrol');
    expect(nomeMarchio('San Marco Petroli')).toBe('San Marco Petroli');
  });
});

describe('iniziali', () => {
  it('due lettere', () => {
    expect(iniziali('Pompe Bianche')).toBe('PB');
    expect(iniziali('Vega')).toBe('VE');
  });
});

describe('nomeImpianto', () => {
  it('scarta codici e ripetizioni del marchio', () => {
    expect(nomeImpianto('53733 LUGO', 'Agip Eni')).toBeNull();
    expect(nomeImpianto('Agip Eni', 'Agip Eni')).toBeNull();
    expect(nomeImpianto('', 'Q8')).toBeNull();
  });
  it('rende umano un nome tutto maiuscolo', () => {
    expect(nomeImpianto('STAZIONE DI SERVIZIO ROSSI', 'Pompe Bianche')).toBe('Stazione Di Servizio Rossi');
  });
});

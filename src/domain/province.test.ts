import { describe, it, expect } from 'vitest';
import { nomeProvincia } from './province';

// Le sigle che il MIMIT usa oggi. Scritte qui e non lette dal dataset: il
// test deve reggere anche quando il file dei prezzi cambia.
const SIGLE = `AG AL AN AO AP AQ AR AT AV BA BG BI BL BN BO BR BS BT BZ CA CB CE CH CL CN CO CR CS CT CZ
EN FC FE FG FI FM FR GE GO GR IM IS KR LC LE LI LO LT LU MB MC ME MI MN MO MS MT NA NO NU OR PA PC
PD PE PG PI PN PO PR PT PU PV PZ RA RC RE RG RI RM RN RO SA SI SO SP SR SS SU SV TA TE TN TO TP TR
TS TV UD VA VB VC VE VI VR VT VV`.split(/\s+/);

describe('nomeProvincia', () => {
  it('conosce tutte le 107 sigle in uso', () => {
    expect(SIGLE).toHaveLength(107);
    for (const s of SIGLE) expect(nomeProvincia(s), s).not.toBe(s);
  });

  it('scrive i nomi con gli accenti e gli apostrofi giusti', () => {
    expect(nomeProvincia('RA')).toBe('Ravenna');
    expect(nomeProvincia('FC')).toBe('Forlì-Cesena');
    expect(nomeProvincia('AQ')).toBe('L’Aquila');
  });

  it('accetta la sigla in minuscolo o con spazi', () => {
    expect(nomeProvincia(' rm ')).toBe('Roma');
  });

  it('lascia com e una sigla che non conosce', () => {
    expect(nomeProvincia('XX')).toBe('XX');
  });
});

import { describe, it, expect } from 'vitest';
import { litersFor, kmlFor, DEFAULT_KML, DEFAULT_TANK_L } from './units';

const panda = { model: 'Fiat Panda 1.0 Hybrid (Benzina)', liters: 38, kml: 19 };

describe('litersFor', () => {
  it("riempie l'85% del serbatoio dell'auto scelta", () => {
    expect(litersFor(panda)).toBeCloseTo(32.3, 6);
  });

  it('senza auto usa il serbatoio di riferimento da 45 litri', () => {
    expect(litersFor(null)).toBeCloseTo(DEFAULT_TANK_L * 0.85, 6);
  });

  it('ignora un serbatoio dichiarato assurdo', () => {
    expect(litersFor({ ...panda, liters: 0 })).toBeCloseTo(DEFAULT_TANK_L * 0.85, 6);
  });
});

describe('kmlFor', () => {
  it("preferisce il consumo reale quando c'è", () => {
    expect(kmlFor(panda, 'benzina', 15.2)).toBe(15.2);
  });

  it("poi il dato di targa dell'auto", () => {
    expect(kmlFor(panda, 'benzina', null)).toBe(19);
  });

  it('infine il default del carburante', () => {
    expect(kmlFor(null, 'diesel', null)).toBe(DEFAULT_KML.diesel);
    expect(kmlFor(null, 'metano', null)).toBe(DEFAULT_KML.metano);
  });

  it('scarta consumi non plausibili', () => {
    expect(kmlFor(panda, 'benzina', 0)).toBe(19);
    expect(kmlFor(panda, 'benzina', 300)).toBe(19);
    expect(kmlFor({ ...panda, kml: -1 }, 'benzina', null)).toBe(DEFAULT_KML.benzina);
  });

  it('applica i default della spec § 6.3', () => {
    expect(DEFAULT_KML).toEqual({ benzina: 15, diesel: 18, gpl: 11, metano: 14 });
  });
});

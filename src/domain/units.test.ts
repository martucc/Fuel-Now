import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { litersFor, kmlFor, autoPerCarburante, DEFAULT_KML, DEFAULT_TANK_L, DEFAULT_TANK_KG } from './units';
import type { CarSpec } from './units';

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

  it('applica i default della spec § 6.3 (metano rivisto: 22 km/kg)', () => {
    expect(DEFAULT_KML).toEqual({ benzina: 15, diesel: 18, gpl: 11, metano: 22 });
  });
});

describe('metano', () => {
  const golf = { model: 'VW Golf TGI Metano', liters: 14, tags: 'vw golf metano tgi gnc', kml: 24 };

  it('senza auto il pieno è di 15 kg, le bombole intere', () => {
    expect(litersFor(null, 'metano')).toBeCloseTo(DEFAULT_TANK_KG, 6);
    expect(DEFAULT_TANK_KG).toBe(15);
  });

  it("con un'auto a metano usa le sue bombole e il suo consumo in km/kg", () => {
    expect(litersFor(golf, 'metano')).toBeCloseTo(14, 6);
    expect(kmlFor(golf, 'metano', null)).toBe(24);
  });

  it("i numeri di un'auto a benzina non valgono per il metano, e viceversa", () => {
    expect(autoPerCarburante(panda, 'metano')).toBeNull();
    expect(autoPerCarburante(golf, 'benzina')).toBeNull();
    expect(litersFor(panda, 'metano')).toBeCloseTo(DEFAULT_TANK_KG, 6);
    expect(kmlFor(golf, 'benzina', null)).toBe(DEFAULT_KML.benzina);
  });

  it("il default è quello di un'auto a metano del catalogo, non un consumo da benzina", () => {
    // Il vecchio 14 km/kg stava sotto a tutte le auto a metano del catalogo
    // (20-24 km/kg): la strada costava troppo e la Home consigliava
    // diversamente da come farebbe una Panda o una Golf TGI vera.
    const catalogo = JSON.parse(readFileSync(resolve(process.cwd(), 'public/cars.json'), 'utf8')) as CarSpec[];
    const aMetano = catalogo.filter((a) => autoPerCarburante(a, 'metano'));
    expect(aMetano.length).toBeGreaterThan(3);
    const consumi = aMetano.map((a) => a.kml).sort((a, b) => a - b);
    const bombole = aMetano.map((a) => a.liters).sort((a, b) => a - b);
    expect(DEFAULT_KML.metano).toBeGreaterThanOrEqual(consumi[0]!);
    expect(DEFAULT_KML.metano).toBeLessThanOrEqual(consumi[consumi.length - 1]!);
    expect(DEFAULT_TANK_KG).toBeGreaterThanOrEqual(bombole[0]!);
    expect(DEFAULT_TANK_KG).toBeLessThanOrEqual(bombole[bombole.length - 1]!);
  });
});

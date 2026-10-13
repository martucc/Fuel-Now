import { describe, it, expect } from 'vitest';
import { geometria, passoGriglia, piuVicino, tacche } from './geometria';
import type { Misure } from './geometria';
import { pulisciStorico } from '../../domain/andamento';

const MISURE: Misure = { larghezza: 340, altezza: 180, sopra: 20, sotto: 10, sinistra: 0, destra: 40 };

function serie(prezzi: number[]) {
  return pulisciStorico(
    prezzi.map((avg, i) => ({ date: new Date(Date.UTC(2026, 8, 1) + i * 86_400_000).toISOString().slice(0, 10), avg })),
  );
}

describe('passoGriglia e tacche', () => {
  it('sceglie un passo pulito con al massimo quattro righe', () => {
    expect(passoGriglia(2.1, 2.4)).toBe(0.1);
    expect(passoGriglia(2.24, 2.26)).toBe(0.005);
  });

  it('mette le tacche sui multipli del passo, senza errori di virgola mobile', () => {
    expect(tacche(2.13, 2.41, 0.1)).toEqual([2.2, 2.3, 2.4]);
    expect(tacche(2.25, 2.3, 0.05)).toEqual([2.25, 2.3]);
  });
});

describe('geometria', () => {
  it('mette il primo punto a sinistra, l ultimo a destra e i prezzi alti in alto', () => {
    const g = geometria(serie([2.0, 2.2, 2.1]), [], MISURE)!;
    expect(g.punti[0]!.x).toBe(0);
    expect(g.punti[2]!.x).toBe(300);
    expect(g.punti[1]!.y).toBeLessThan(g.punti[0]!.y);
    expect(g.linea.startsWith('M0.0,')).toBe(true);
    expect(g.area.endsWith('Z')).toBe(true);
    expect(g.previsione).toBe('');
  });

  it('con la previsione lascia spazio a destra e la fa partire dall ultimo punto', () => {
    const s = serie([2.0, 2.1, 2.2, 2.3]);
    const ultimo = s[s.length - 1]!;
    const futuri = [1, 2].map((k) => ({ date: '', ts: ultimo.ts + k * 86_400_000, prezzo: 2.3 - k * 0.01 }));
    const g = geometria(s, futuri, MISURE)!;
    expect(g.punti[3]!.x).toBeCloseTo(180, 6);
    expect(g.previsione.startsWith(`M${g.punti[3]!.x.toFixed(1)},${g.punti[3]!.y.toFixed(1)}`)).toBe(true);
  });

  it('non ingigantisce una serie piatta', () => {
    const g = geometria(serie([2.25, 2.2501, 2.25]), [], MISURE)!;
    const ys = g.punti.map((p) => p.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(5);
  });

  it('le righe della griglia stanno dentro l area del grafico', () => {
    const g = geometria(serie([2.13, 2.41, 2.3]), [], MISURE)!;
    expect(g.righe.length).toBeGreaterThan(0);
    for (const r of g.righe) {
      expect(r.y).toBeGreaterThanOrEqual(MISURE.sopra);
      expect(r.y).toBeLessThanOrEqual(g.fondo);
    }
  });

  it('regge un punto solo e rifiuta misure impossibili', () => {
    expect(geometria(serie([2.2]), [], MISURE)!.punti).toHaveLength(1);
    expect(geometria([], [], MISURE)).toBeNull();
    expect(geometria(serie([2.2, 2.3]), [], { ...MISURE, larghezza: 20 })).toBeNull();
  });
});

describe('piuVicino', () => {
  const punti = [0, 10, 20, 30].map((x) => ({ x, y: 0 }));

  it('trova il punto piu vicino al dito', () => {
    expect(piuVicino(punti, -5)).toBe(0);
    expect(piuVicino(punti, 14)).toBe(1);
    expect(piuVicino(punti, 16)).toBe(2);
    expect(piuVicino(punti, 99)).toBe(3);
    expect(piuVicino([], 3)).toBe(-1);
  });
});

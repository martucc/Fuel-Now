import { describe, it, expect } from 'vitest';
import { righePreferiti } from './preferiti';
import { buildCohorts } from './market';
import { aKm, oreFa, riga, UTENTE } from './__fixtures__/sintetico';
import type { StationRow } from './parse';

function indice(rows: StationRow[]) {
  return { perId: new Map(rows.map((r) => [r.id, r] as const)), cohorts: buildCohorts(rows) };
}

describe('righePreferiti', () => {
  it('mostra solo i salvati, dal più economico', () => {
    const a = riga({ prices: { diesel: 2.1 } });
    const b = riga({ prices: { diesel: 1.95 } });
    const c = riga({ prices: { diesel: 2.0 } });
    const { perId, cohorts } = indice([a, b, c]);
    const r = righePreferiti(new Set([a.id, b.id]), perId, cohorts, 'diesel', UTENTE, oreFa(0));
    expect(r.map((x) => x.row.id)).toEqual([b.id, a.id]);
    expect(r[0].prezzo).toBe(1.95);
  });

  it('a pari prezzo viene prima il più vicino', () => {
    const lontano = riga({ ...aKm(9), prices: { diesel: 2.0 } });
    const vicino = riga({ ...aKm(1), prices: { diesel: 2.0 } });
    const { perId, cohorts } = indice([lontano, vicino]);
    const r = righePreferiti(new Set([lontano.id, vicino.id]), perId, cohorts, 'diesel', UTENTE, oreFa(0));
    expect(r.map((x) => x.row.id)).toEqual([vicino.id, lontano.id]);
    expect(r[0].km).toBeCloseTo(1, 1);
  });

  it('chi non vende il carburante scelto va in fondo, senza prezzo', () => {
    const soloBenzina = riga({ prices: { benzina: 1.8 } });
    const diesel = riga({ prices: { diesel: 2.2 } });
    const { perId, cohorts } = indice([soloBenzina, diesel]);
    const r = righePreferiti(new Set([soloBenzina.id, diesel.id]), perId, cohorts, 'diesel', UTENTE, oreFa(0));
    expect(r.map((x) => x.row.id)).toEqual([diesel.id, soloBenzina.id]);
    expect(r[1].prezzo).toBeNull();
    expect(r[1].livello).toBeNull();
  });

  it('senza self usa il servito e lo dice', () => {
    const servito = riga({ prices: {}, servito: { gpl: 0.799 } });
    const { perId, cohorts } = indice([servito]);
    const [r] = righePreferiti(new Set([servito.id]), perId, cohorts, 'gpl', UTENTE, oreFa(0));
    expect(r.prezzo).toBe(0.799);
    expect(r.alServito).toBe(true);
  });

  it('un salvato sparito dal file non compare e non rompe niente', () => {
    const a = riga();
    const { perId, cohorts } = indice([a]);
    const r = righePreferiti(new Set(['non-esiste', a.id]), perId, cohorts, 'diesel', null, oreFa(0));
    expect(r.map((x) => x.row.id)).toEqual([a.id]);
    expect(r[0].km).toBeNull();
  });

  it('segna i prezzi vecchi rispetto al lotto', () => {
    const vecchio = riga({ updated: oreFa(24 * 9) });
    const { perId, cohorts } = indice([vecchio]);
    const [r] = righePreferiti(new Set([vecchio.id]), perId, cohorts, 'diesel', UTENTE, oreFa(0));
    expect(r.vecchio).toBe(true);
  });
});

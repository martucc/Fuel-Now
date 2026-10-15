import { describe, it, expect } from 'vitest';
import { puntiMappa, collezionePunti, prezzoBreve, PREZZO_ESCLUSO } from './mappa';
import { buildCohorts } from './market';
import type { StationRow } from './parse';

/** Il prezzo piu recente del lotto: e da lui che si misura l'eta. */
const ORA = '2026-10-13 07:00';

function row(over: Partial<StationRow>): StationRow {
  return {
    id: 'x', name: 'Impianto', brand: 'Eni', operator: '', prov: 'RA', city: 'Lugo', address: '',
    isHighway: false, lat: 44.42, lng: 11.91, prices: { diesel: 1.7 }, servito: {},
    updated: '2026-10-13 07:00', ...over,
  };
}

// Una coorte di Ravenna con media 1,70 e scarto 0,02 circa.
const coorte = Array.from({ length: 21 }, (_, i) => row({ id: `c${i}`, prices: { diesel: 1.67 + i * 0.003 } }));
const cohorts = buildCohorts(coorte);

describe('puntiMappa', () => {
  it('mette sulla mappa tutti gli impianti col carburante scelto, non solo i piu economici', () => {
    const p = puntiMappa(coorte, cohorts, 'diesel', ORA);
    expect(p).toHaveLength(21);
  });

  it('salta chi non vende quel carburante e chi e stato nascosto', () => {
    const solo = row({ id: 'gpl', prices: { gpl: 0.7 } });
    const p = puntiMappa([...coorte, solo], cohorts, 'diesel', ORA, new Set(['c0']));
    expect(p.map((x) => x.id)).not.toContain('gpl');
    expect(p.map((x) => x.id)).not.toContain('c0');
  });

  it('colora col livello della coorte: il piu economico e verde, il piu caro rosso', () => {
    const p = puntiMappa(coorte, cohorts, 'diesel', ORA);
    expect(p.find((x) => x.id === 'c0')!.livello).toBe('best');
    expect(p.find((x) => x.id === 'c20')!.livello).toBe('worst');
  });

  it('segna come vecchio un prezzo fermo da piu di una settimana', () => {
    const p = puntiMappa([row({ id: 'v', updated: '2026-09-30 08:00' })], cohorts, 'diesel', ORA);
    expect(p[0]!.vecchio).toBe(true);
  });

  it('se è il lotto intero a essere vecchio, la mappa non diventa tutta grigia', () => {
    // Il file ha otto giorni (telefono senza rete): l'impianto ha comunicato
    // con gli altri, non è chiuso.
    const p = puntiMappa([row({ id: 'v', updated: '2026-10-05 08:00' })], cohorts, 'diesel', '2026-10-05 09:00');
    expect(p[0]!.vecchio).toBe(false);
  });

  it('segna come sospetto un prezzo fuori scala', () => {
    const p = puntiMappa([row({ id: 's', prices: { diesel: 1.2 } })], cohorts, 'diesel', ORA);
    expect(p[0]!.sospetto).toBe(true);
  });

  it('porta il servito quando c’e', () => {
    const p = puntiMappa([row({ id: 'sv', servito: { diesel: 1.85 } })], cohorts, 'diesel', ORA);
    expect(p[0]!.servito).toBe(1.85);
  });

  it('mostra anche chi ha solo il servito, al prezzo servito', () => {
    const p = puntiMappa([row({ id: 'solo', prices: {}, servito: { diesel: 1.85 } })], cohorts, 'diesel', ORA);
    expect(p.map((x) => x.id)).toEqual(['solo']);
    expect(p[0]!.prezzo).toBe(1.85);
  });
});

describe('collezionePunti', () => {
  it('scrive il prezzo all’italiana e mette i piu economici davanti nelle collisioni', () => {
    const c = collezionePunti(puntiMappa(coorte, cohorts, 'diesel', ORA));
    const f0 = c.features.find((f) => f.properties.id === 'c0')!;
    const f20 = c.features.find((f) => f.properties.id === 'c20')!;
    expect(f0.properties.testo).toBe('1,670');
    expect(f0.properties.ordine).toBeLessThan(f20.properties.ordine);
    expect(f0.geometry.coordinates).toEqual([11.91, 44.42]);
  });

  it('un prezzo spento cede il posto e non diventa il minimo di un gruppo', () => {
    const p = puntiMappa([...coorte, row({ id: 'vecchio', prices: { diesel: 1.5 }, updated: '2026-09-01 08:00' })], cohorts, 'diesel', ORA);
    const c = collezionePunti(p);
    const v = c.features.find((f) => f.properties.id === 'vecchio')!;
    const normale = c.features.find((f) => f.properties.id === 'c20')!;
    expect(v.properties.spento).toBe(1);
    expect(v.properties.minimo).toBe(PREZZO_ESCLUSO);
    expect(v.properties.ordine).toBeGreaterThan(normale.properties.ordine);
  });
});

describe('prezzoBreve', () => {
  it('tre decimali con la virgola', () => {
    expect(prezzoBreve(1.6)).toBe('1,600');
    expect(prezzoBreve(1.8329)).toBe('1,833');
  });
});

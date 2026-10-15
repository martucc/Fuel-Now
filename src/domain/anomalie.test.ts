import { describe, it, expect } from 'vitest';
import { giudiceAnomalie, zonaPrezzi, extradoganale, RAGGIO_ZONA_LARGO_KM } from './anomalie';
import { buildCohorts } from './market';
import { ADESSO, aKm, coorte, oreFa, riga } from './__fixtures__/sintetico';
import { rankStations, pickBest } from './ranking';

/*
  Zone finte, coorti finte lontane dall'utente (LEGGIMI § 5): nessun prezzo
  del giorno.
*/

const italia = coorte('XX', 'diesel', 2.25, { n: 401, passo: 0.0005 });
const cohorts = buildCohorts(italia);

/** Una zona di `n` pompe a 2,25-2,29 entro una decina di km. */
function zona(n = 12) {
  return Array.from({ length: n }, (_, i) => riga({ id: `z${i}`, ...aKm(2 + (i % 6) * 1.5, (i % 2) * 3), prices: { diesel: 2.25 + (i % 5) * 0.01 } }));
}

describe('zonaPrezzi', () => {
  it('mediana e MAD dei prezzi recenti intorno, lui escluso', () => {
    const lui = riga({ id: 'lui', ...aKm(0), prices: { diesel: 1.5 } });
    const rows = [lui, ...zona()];
    const z = zonaPrezzi(lui, rows, 'diesel')!;
    expect(z.campione).toBe(12);
    // Tre a 2,25 e 2,26, due a 2,27, 2,28 e 2,29.
    expect(z.mediana).toBeCloseTo(2.265, 6);
    expect(z.mad).toBeCloseTo(0.015, 6);
  });

  it('non conta i prezzi vecchi, gli autostradali e il servito', () => {
    const lui = riga({ id: 'lui', ...aKm(0) });
    const altri = [
      riga({ id: 'vecchio', ...aKm(1), updated: oreFa(100) }),
      riga({ id: 'hw', isHighway: true, ...aKm(1) }),
      riga({ id: 'servito', ...aKm(1), prices: {}, servito: { diesel: 2.4 } }),
      riga({ id: 'ok', ...aKm(1), prices: { diesel: 2.1 } }),
    ];
    const z = zonaPrezzi(lui, [lui, ...altri], 'diesel')!;
    expect(z.campione).toBe(1);
    expect(z.mediana).toBe(2.1);
  });

  it('con meno di cinque prezzi entro 25 km si allarga a 50', () => {
    const lui = riga({ id: 'lui', ...aKm(0) });
    const lontani = [30, 35, 40].map((k, i) => riga({ id: `l${i}`, ...aKm(k) }));
    const z = zonaPrezzi(lui, [lui, ...lontani], 'diesel')!;
    expect(z.raggioKm).toBe(RAGGIO_ZONA_LARGO_KM);
    expect(z.campione).toBe(3);
  });
});

describe('giudiceAnomalie', () => {
  it('un prezzo molto sotto la zona è assurdo, a meno che un vicino lo confermi', () => {
    const errore = riga({ id: 'errore', ...aKm(0), prices: { diesel: 1.85 } });
    const g = giudiceAnomalie([errore, ...zona()], 'diesel', cohorts);
    expect(g(errore, 1.85)).toBe('prezzo-assurdo');

    const gemello = riga({ id: 'gemello', ...aKm(3), prices: { diesel: 1.869 } });
    const g2 = giudiceAnomalie([errore, gemello, ...zona()], 'diesel', cohorts);
    expect(g2(errore, 1.85)).toBeUndefined();
  });

  it('un gemello chiuso o in autostrada non conferma niente', () => {
    const errore = riga({ id: 'errore', ...aKm(0), prices: { diesel: 1.85 } });
    const chiuso = riga({ id: 'chiuso', ...aKm(3), prices: { diesel: 1.85 }, updated: oreFa(240) });
    const hw = riga({ id: 'hw', isHighway: true, ...aKm(3), prices: { diesel: 1.85 } });
    const g = giudiceAnomalie([errore, chiuso, hw, ...zona()], 'diesel', cohorts);
    expect(g(errore, 1.85)).toBe('prezzo-assurdo');
  });

  it('un prezzo di poco sotto la zona è un fantasma solo se è vecchio', () => {
    const fresco = riga({ id: 'fresco', ...aKm(0), prices: { diesel: 2.08 } });
    const vecchio = riga({ id: 'vecchio', ...aKm(0.2), prices: { diesel: 2.08 }, updated: oreFa(60) });
    const rows = [fresco, vecchio, ...zona()];
    // Si confermano a vicenda: tolta la conferma, il vecchio è un fantasma.
    expect(giudiceAnomalie(rows, 'diesel', cohorts)(vecchio, 2.08)).toBeUndefined();
    const soloVecchio = [vecchio, ...zona()];
    const g = giudiceAnomalie(soloVecchio, 'diesel', cohorts);
    expect(g(vecchio, 2.08)).toBe('prezzo-sospetto-stantio');
    expect(giudiceAnomalie([fresco, ...zona()], 'diesel', cohorts)(fresco, 2.08)).toBeUndefined();
  });

  it('in una zona dai prezzi molto diversi la soglia si allarga con la MAD', () => {
    // Metano: la stessa zona ha impianti a 1,40 e a 2,10.
    const metano = buildCohorts(coorte('XX', 'metano', 1.9, { n: 401, passo: 0.0002 }));
    const prezzi = [1.4, 1.55, 1.7, 1.85, 2.0, 2.1, 1.45, 1.95];
    const z = prezzi.map((p, i) => riga({ id: `m${i}`, ...aKm(2 + i), prices: { metano: p } }));
    const buono = riga({ id: 'buono', ...aKm(0), prices: { metano: 1.32 } });
    expect(giudiceAnomalie([buono, ...z], 'metano', metano)(buono, 1.32)).toBeUndefined();
  });

  it('all’insù è assurdo solo se fuori scala anche per l’Italia', () => {
    const rows = zona();
    const caro = riga({ id: 'caro', ...aKm(0) });
    const g = giudiceAnomalie([caro, ...rows], 'diesel', cohorts);
    expect(g(caro, 2.99)).toBe('prezzo-assurdo');
    expect(g(caro, 2.45)).toBeUndefined();
    // Gli autostradali costano di più per conto loro.
    const hw = riga({ id: 'hw', isHighway: true, ...aKm(0) });
    expect(giudiceAnomalie([hw, ...rows], 'diesel', cohorts)(hw, 2.99)).toBeUndefined();
  });

  it('senza nessun prezzo entro 50 km il metro è la media nazionale', () => {
    const solo = riga({ id: 'solo', ...aKm(0) });
    const g = giudiceAnomalie([solo], 'diesel', cohorts);
    expect(g(solo, 1.7)).toBe('prezzo-assurdo');
    expect(g(solo, 2.2)).toBeUndefined();
  });
});

describe('giudiceAnomalie — revisione del 14 ottobre', () => {
  const benzina = buildCohorts(coorte('XX', 'benzina', 2.0, { n: 401, passo: 0.0005 }));

  it('in una zona dai prezzi tutti uguali un 1,719 fresco è un errore, anche se è solo il 14% sotto', () => {
    // Fano, 13 ottobre: la zona a 1,995 ± 0,005, e l'1,719 mandato dal
    // gestore insieme a un gasolio a 1,629. Col pavimento al 15% passava e
    // la Home prometteva dieci euro.
    const zona = Array.from({ length: 20 }, (_, i) =>
      riga({ id: `f${i}`, ...aKm(1 + (i % 10) * 1.2, (i % 2) * 2), prices: { benzina: 1.99 + (i % 3) * 0.005 } }));
    const fano = riga({ id: 'fano', ...aKm(0.3), prices: { benzina: 1.719 } });
    const z = zonaPrezzi(fano, [fano, ...zona], 'benzina')!;
    expect(z.mad).toBeLessThanOrEqual(0.005);
    expect((z.mediana - 1.719) / z.mediana).toBeLessThan(0.15);
    expect(giudiceAnomalie([fano, ...zona], 'benzina', benzina)(fano, 1.719)).toBe('prezzo-assurdo');
    // Un distributore che costa davvero meno, sette centesimi sotto, resta.
    const buono = riga({ id: 'buono', ...aKm(0.3), prices: { benzina: 1.925 } });
    expect(giudiceAnomalie([buono, ...zona], 'benzina', benzina)(buono, 1.925)).toBeUndefined();
  });

  it('Livigno: 1,29 / 1,31 / 1,35 / 1,38 passano perché la zona è bassa, non per un prezzo uguale', () => {
    const paese = [1.29, 1.31, 1.35, 1.38].map((p, k) => riga({ id: `liv${k}`, prov: 'SO', ...aKm(0.3 + k * 1.1), prices: { diesel: p } }));
    // Bormio a venti km, la Valtellina oltre i cinquanta.
    const bormio = [2.195, 2.48].map((p, k) => riga({ id: `bo${k}`, prov: 'SO', ...aKm(19 + k * 0.5, 6), prices: { diesel: p } }));
    const valtellina = Array.from({ length: 20 }, (_, k) => riga({ id: `va${k}`, prov: 'SO', ...aKm(55 + k, -10), prices: { diesel: 2.25 + (k % 5) * 0.01 } }));
    const rows = [...paese, ...bormio, ...valtellina];
    const g = giudiceAnomalie(rows, 'diesel', cohorts);
    for (const r of paese) {
      const prezzo = r.prices.diesel!;
      // Nessun altro impianto ha lo stesso prezzo.
      expect(rows.filter((o) => o.prices.diesel === prezzo)).toHaveLength(1);
      expect(zonaPrezzi(r, rows, 'diesel')!.mediana).toBeLessThan(1.4);
      expect(g(r, prezzo)).toBeUndefined();
    }
  });

  it('un’isola con una sola pompa, al servito, non è fuori mercato e resta il consiglio', () => {
    // Ventotene, Ustica, le Tremiti: il servito costa 30-60 centesimi più del
    // self in terraferma, ma è il prezzo vero. Si confronta coi serviti.
    const isola = riga({ id: 'isola', ...aKm(0.4), prices: {}, servito: { benzina: 2.65 } });
    const costa = Array.from({ length: 12 }, (_, k) =>
      riga({ id: `c${k}`, ...aKm(35 + (k % 4) * 3, (k % 3) * 2), prices: { benzina: 1.99 + (k % 3) * 0.01 }, servito: { benzina: 2.33 + (k % 4) * 0.02 } }));
    const rows = [isola, ...costa];
    expect(zonaPrezzi(isola, rows, 'benzina', true)!.mediana).toBeGreaterThan(2.3);
    expect(giudiceAnomalie(rows, 'benzina', benzina)(isola, 2.65)).toBeUndefined();
    const best = pickBest(rankStations(rows, {
      fuel: 'benzina', user: aKm(0), cohorts: benzina, now: new Date(2026, 9, 13, 12), liters: 40, kml: 15, blocked: new Set(), raggioKm: 15,
    }));
    expect(best?.row.id).toBe('isola');
  });

  it('il servito sbagliato all’ingiù resta un errore anche fra i serviti', () => {
    const solo = riga({ id: 'solo', ...aKm(0.4), prices: {}, servito: { benzina: 1.6 } });
    const zona = Array.from({ length: 10 }, (_, k) =>
      riga({ id: `z${k}`, ...aKm(1 + k), prices: { benzina: 1.99 }, servito: { benzina: 2.25 + (k % 3) * 0.01 } }));
    expect(giudiceAnomalie([solo, ...zona], 'benzina', benzina)(solo, 1.6)).toBe('prezzo-assurdo');
  });
});


describe('giudiceAnomalie — Livigno, mercato a sé', () => {
  // L'Italia dei test con lo scarto tipo di oggi (≈ 0,07): tre scarti tipo
  // sono 21 centesimi, e non bastano a salvare un prezzo 43 centesimi sotto.
  const italiaVera = buildCohorts(coorte('XX', 'diesel', 2.25, { n: 401, passo: 0.0006 }));

  /** Il paese a 1,72 come nei dati del 13 ottobre, Bormio a venti km, la Valtellina oltre. */
  function valle(citta: string, agip: number, oreAgip = 51) {
    const paese = [0.2, 0.3, 1.1, 1.2, 1.3, 1.5, 1.9, 2.1, 4.6, 5.7].map((k, i) =>
      riga({ id: `liv${i}`, prov: 'SO', city: citta, ...aKm(k), prices: { diesel: 1.718 + (i % 4) * 0.004 } }));
    // L'Agip: un prezzo di due giorni prima degli ultimi arrivati (che sono
    // di due ore fa), e nessun altro distributore allo stesso prezzo.
    const a = riga({ id: 'agip', prov: 'SO', city: citta, ...aKm(2.3), prices: { diesel: agip }, servito: { diesel: 1.723 }, updated: oreFa(oreAgip) });
    const bormio = [2.195, 2.48].map((p, k) => riga({ id: `bo${k}`, prov: 'SO', city: 'BORMIO', ...aKm(19.5 + k * 0.2, 2), prices: { diesel: p } }));
    const valtellina = Array.from({ length: 20 }, (_, k) =>
      riga({ id: `va${k}`, prov: 'SO', city: 'SONDALO', ...aKm(27 + k, -5), prices: { diesel: 2.25 + (k % 5) * 0.01 } }));
    return { a, rows: [...paese, a, ...bormio, ...valtellina] };
  }

  it('il comune extradoganale si riconosce dal nome', () => {
    expect(extradoganale({ city: 'LIVIGNO' })).toBe(true);
    expect(extradoganale({ city: ' Livigno ' })).toBe(true);
    expect(extradoganale({ city: 'BORMIO' })).toBe(false);
  });

  it('il 1,292 dell’Agip è vero anche senza un altro distributore che lo confermi', () => {
    // Prima lo salvava solo l'altro 1,292 del paese: bastava che restasse
    // fermo ancora qualche giorno, o cambiasse prezzo, e la Home di Livigno
    // consigliava l'1,72.
    const { a, rows } = valle('LIVIGNO', 1.292);
    expect(rows.filter((r) => r !== a && Math.abs((r.prices.diesel ?? 0) - 1.292) <= 0.02)).toHaveLength(0);
    const z = zonaPrezzi(a, rows, 'diesel')!;
    expect(z.mediana).toBeGreaterThan(1.7);
    expect((z.mediana - 1.292) / z.mediana).toBeGreaterThan(0.2);
    expect(giudiceAnomalie(rows, 'diesel', italiaVera)(a, 1.292)).toBeUndefined();
    const best = pickBest(rankStations(rows, {
      fuel: 'diesel', user: aKm(0), cohorts: italiaVera, now: ADESSO, liters: 40, kml: 18, blocked: new Set(), raggioKm: 15,
    }));
    expect(best?.row.id).toBe('agip');
  });

  it('lo stesso prezzo in un paese qualunque è un errore', () => {
    const { a, rows } = valle('SEMOGO', 1.292);
    expect(giudiceAnomalie(rows, 'diesel', italiaVera)(a, 1.292)).toBe('prezzo-assurdo');
  });

  it('a Livigno un errore di battitura resta un errore', () => {
    const { a, rows } = valle('LIVIGNO', 0.729, 2);
    expect(giudiceAnomalie(rows, 'diesel', italiaVera)(a, 0.729)).toBe('prezzo-assurdo');
  });

  it('Livigno non entra nella zona di Bormio', () => {
    const { rows } = valle('LIVIGNO', 1.292);
    const bormio = rows.find((r) => r.id === 'bo0')!;
    expect(zonaPrezzi(bormio, rows, 'diesel')!.mediana).toBeGreaterThan(2.2);
    expect(giudiceAnomalie(rows, 'diesel', italiaVera)(bormio, 2.195)).toBeUndefined();
  });
});

describe('giudiceAnomalie — all’insù solo chi fa da metro', () => {
  const benzina = buildCohorts(coorte('XX', 'benzina', 2.0, { n: 401, passo: 0.0006 }));
  const costa = Array.from({ length: 12 }, (_, k) =>
    riga({ id: `c${k}`, ...aKm(38 + (k % 4) * 3, (k % 3) * 2), prices: { benzina: 1.99 + (k % 3) * 0.01 }, servito: { benzina: 2.25 + (k % 4) * 0.02 } }));

  it('l’unica pompa di un’isola, cara, resta il consiglio dell’isola', () => {
    // Linosa: 3,25 al servito, la terraferma (Lampedusa) a quaranta km a
    // 2,6. Prima era «fuori mercato» e la Home restava senza consiglio.
    const isola = riga({ id: 'isola', ...aKm(0.4), prices: {}, servito: { benzina: 3.25 } });
    const rows = [isola, ...costa];
    expect(giudiceAnomalie(rows, 'benzina', benzina)(isola, 3.25)).toBeUndefined();
    const best = pickBest(rankStations(rows, {
      fuel: 'benzina', user: aKm(0), cohorts: benzina, now: ADESSO, liters: 40, kml: 15, blocked: new Set(), raggioKm: 15,
    }));
    expect(best?.row.id).toBe('isola');
  });

  it('anche senza nessuna zona intorno', () => {
    // Ustica: nessun distributore entro 50 km, il metro è la media nazionale.
    const isola = riga({ id: 'isola', ...aKm(0.2), prices: {}, servito: { benzina: 2.697 } });
    expect(giudiceAnomalie([isola], 'benzina', benzina)(isola, 2.697)).toBeUndefined();
  });

  it('ma se accanto c’è un altro distributore, lo stesso prezzo non gli fa da metro', () => {
    const isola = riga({ id: 'isola', ...aKm(0.4), prices: {}, servito: { benzina: 3.25 } });
    const vicino = riga({ id: 'vicino', ...aKm(3), prices: {}, servito: { benzina: 2.3 } });
    expect(giudiceAnomalie([isola, vicino, ...costa], 'benzina', benzina)(isola, 3.25)).toBe('prezzo-assurdo');
  });
});

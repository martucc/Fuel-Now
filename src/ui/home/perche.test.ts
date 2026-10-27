import { describe, it, expect } from 'vitest';
import { vociPerche, nomeDelPiuVicino } from './perche';
import type { Voce } from './perche';
import { rankStations, pickBest } from '../../domain/ranking';
import type { RankContext } from '../../domain/ranking';
import { buildCohorts } from '../../domain/market';
import type { StationRow } from '../../domain/parse';
import { ADESSO, UTENTE, aKm, riga, coorte, oreFa } from '../../domain/__fixtures__/sintetico';

/*
  Il foglio «Perché» riga per riga, su distributori finti (LEGGIMI § 5):
  nessuna riga deve smentirne un'altra o la carta.
*/

const ctx: RankContext = {
  fuel: 'diesel', user: UTENTE, cohorts: buildCohorts(coorte('RA', 'diesel', 2.2)), now: ADESSO,
  liters: 40, kml: 18, blocked: new Set<string>(), raggioKm: 15,
};

function foglio(righe: StationRow[]) {
  const best = pickBest(rankStations(righe, ctx))!;
  const voci = vociPerche(best, { fuel: 'diesel', auto: null, eta: 'ieri alle 18:00' });
  const voce = (etichetta: string): Voce | undefined => voci.find((v) => v.etichetta === etichetta);
  return { best, voci, voce };
}

describe('foglio Perché', () => {
  it('se più vicino ci sono un prezzo vecchio e un servito recente, il più vicino è «al self con un prezzo recente»', () => {
    // Talmassons: «il più vicino con un prezzo recente» era falso, perché
    // più vicino c'era un servito col prezzo recente.
    const { best, voci, voce } = foglio([
      riga({ id: 'vecchio', ...aKm(0.3), prices: { diesel: 2.2 }, updated: oreFa(144) }),
      riga({ id: 'servito', ...aKm(0.8), prices: {}, servito: { diesel: 2.45 } }),
      riga({ id: 'self', ...aKm(1.2), prices: { diesel: 2.2 } }),
      riga({ id: 'altro', ...aKm(1.6), prices: { diesel: 2.21 } }),
      riga({ id: 'altro2', ...aKm(2), prices: { diesel: 2.22 } }),
    ]);
    const rif = best.net.riferimento!;
    expect(rif.id).toBe('self');
    expect(rif.piuVicini).toEqual({ vecchi: 1, alServito: 1 });
    expect(nomeDelPiuVicino(rif)).toBe('Il più vicino al self con un prezzo recente');
    expect(voci.some((v) => v.etichetta === 'Il più vicino con un prezzo recente')).toBe(false);
    // I minuti si contano dal servito: il foglio dice da dove.
    expect(voce('Tempo in più')?.nota).toContain('al servito, a 0,8 km');
  });

  it('il pieno al servito sotto casa: dice che il self c’è, ma non conviene', () => {
    const { best, voce } = foglio([
      riga({ id: 'paese', ...aKm(0.05), prices: {}, servito: { diesel: 2.3 } }),
      riga({ id: 'valle', ...aKm(10), prices: { diesel: 2.2 } }),
    ]);
    expect(best.row.id).toBe('paese');
    const riga1 = voce('Il più vicino a te')!;
    expect(riga1.nota).toContain('il self più vicino è più in là');
    expect(riga1.nota).not.toContain('un self non c’è');
    expect(voce('Strada in più')?.nota).toBe('nessuna: è qui che faresti il pieno comunque');
  });

  it('dove il self non c’è, lo dice', () => {
    const { voce } = foglio([
      riga({ id: 'isola', ...aKm(0.2), prices: {}, servito: { diesel: 2.6 } }),
    ]);
    expect(voce('Il più vicino a te')?.nota).toContain('perché qui intorno un self non c’è');
  });

  it('il consigliato più vicino del riferimento non ha «strada in più», e lo dice giusto', () => {
    // Il più vicino è caro; il riferimento sta un km più in là; il
    // consigliato sta in mezzo, tre millesimi sotto il riferimento, con un
    // prezzo di quattro giorni: abbastanza per vincere, non per fare da metro.
    const { best, voce } = foglio([
      riga({ id: 'caro', ...aKm(0.3), prices: { diesel: 2.4 } }),
      riga({ id: 'medio', ...aKm(0.8), prices: { diesel: 2.192 }, updated: oreFa(100) }),
      riga({ id: 'rif', ...aKm(1.3), prices: { diesel: 2.195 } }),
      ...[2.21, 2.22, 2.23].map((p, k) => riga({ ...aKm(6 + k), prices: { diesel: p } })),
    ]);
    expect(best.net.riferimento!.id).toBe('rif');
    expect(best.row.id).toBe('medio');
    expect(voce('Strada in più')?.nota).toBe('nessuna: è più vicino del pieno che faresti comunque');
    expect(voce('In tasca')?.valore.startsWith('−')).toBe(false);
  });

  it('«in tasca» non è mai negativo, anche con un prezzo meno recente in mezzo', () => {
    const { best, voce } = foglio([
      riga({ id: 'caro', ...aKm(0.3), prices: { diesel: 2.4 } }),
      riga({ id: 'medio', ...aKm(0.8), prices: { diesel: 2.205 }, updated: oreFa(100) }),
      riga({ id: 'rif', ...aKm(1.3), prices: { diesel: 2.2 } }),
      ...[2.21, 2.22, 2.23].map((p, k) => riga({ ...aKm(6 + k), prices: { diesel: p } })),
    ]);
    expect(best.row.id).toBe('rif');
    expect(voce('In tasca')?.valore.startsWith('−')).toBe(false);
    expect(voce('Dove faresti il pieno comunque')?.nota).toContain('è questo');
  });
});

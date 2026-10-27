import { describe, it, expect } from 'vitest';
import { netSaving, rankStations, pickBest, classifica, TIE_EURO, FATTORE_STRADA, MAX_MINUTI_IN_PIU, KM_PORTATA, minutiStrada } from './ranking';
import type { RankContext, RankedStation } from './ranking';
import { buildCohorts } from './market';
import { ADESSO, UTENTE, aKm, riga, coorte, cittaFinta, oreFa, rng } from './__fixtures__/sintetico';

/*
  Nessun valore del dataset: le coorti sono finte e stanno lontano
  dall'utente (LEGGIMI § 5). Col dataset vero la media di provincia cambia a
  ogni `seed`, e un 1,98 «sotto la media» a giugno era sopra la media a ottobre.
*/

describe('netSaving', () => {
  it('senza riferimento: media di zona, andata e ritorno per il fattore strada', () => {
    const b = netSaving({ price: 1.9, cohortAvg: 2.0, liters: 38.25, distanceKm: 5, kml: 18, confidence: 1 });
    expect(b.gross).toBeCloseTo(3.825, 6); // (2,00 − 1,90) × 38,25
    expect(b.kmStrada).toBeCloseTo(13, 6); // 2 × 5 × 1,3
    expect(b.roadCost).toBeCloseTo(1.3722, 3); // (13 / 18) × 1,90
    expect(b.net).toBeCloseTo(2.4528, 3);
  });

  it('sconta il lordo con la fiducia, non il costo della strada', () => {
    const fresh = netSaving({ price: 1.9, cohortAvg: 2.0, liters: 40, distanceKm: 10, kml: 20, confidence: 1 });
    const stale = netSaving({ price: 1.9, cohortAvg: 2.0, liters: 40, distanceKm: 10, kml: 20, confidence: 0.5 });
    expect(stale.roadCost).toBeCloseTo(fresh.roadCost, 9);
    expect(stale.net).toBeCloseTo(fresh.gross * 0.5 - fresh.roadCost, 9);
  });

  it("diventa negativo quando l'impianto è troppo lontano", () => {
    expect(netSaving({ price: 1.97, cohortAvg: 2.0, liters: 38, distanceKm: 60, kml: 15, confidence: 1 }).net).toBeLessThan(0);
  });

  it('col riferimento conta solo i km in più, andata e ritorno', () => {
    const b = netSaving({
      price: 1.95, cohortAvg: 2.0, riferimento: { price: 2.0, distanceKm: 1 },
      liters: 40, distanceKm: 4, kml: 20, confidence: 1,
    });
    expect(b.gross).toBeCloseTo(2.0, 9); // (2,00 − 1,95) × 40
    expect(b.kmStrada).toBeCloseTo(2 * 3 * FATTORE_STRADA, 9);
    expect(b.roadCost).toBeCloseTo(((2 * 3 * FATTORE_STRADA) / 20) * 1.95, 9);
  });
});

// Coorte stradale RA con media esatta 2,00 e scarto tipo ≈ 0,059.
const cohorts = buildCohorts(coorte('RA', 'diesel', 2.0));
const ctx: RankContext = {
  fuel: 'diesel', user: UTENTE, cohorts, now: ADESSO, liters: 40, kml: 18, blocked: new Set<string>(),
};

function trova(ranked: RankedStation[], id: string): RankedStation {
  const r = ranked.find((x) => x.row.id === id);
  if (!r) throw new Error(`${id} non è nella classifica`);
  return r;
}

describe('rankStations', () => {
  it('preferisce il vicino leggermente più caro al lontano leggermente più economico', () => {
    const near = riga({ id: 'vicino', prices: { diesel: 1.98 }, ...aKm(0.1) });
    const far = riga({ id: 'lontano', prices: { diesel: 1.95 }, ...aKm(0, 48) });
    expect(pickBest(rankStations([near, far], ctx))!.row.id).toBe('vicino');
  });

  it('a parità entro 15 centesimi vince il più vicino', () => {
    // 'b' costa 7 decimi di centesimo in meno e nel netto sta davanti di
    // una decina di centesimi, ma è 640 m più lontano: vince 'a'.
    const a = riga({ id: 'a', prices: { diesel: 1.95 }, ...aKm(0) });
    const b = riga({ id: 'b', prices: { diesel: 1.943 }, ...aKm(0, 0.64) });
    const ranked = rankStations([a, b], ctx);
    const scarto = trova(ranked, 'b').net.net - trova(ranked, 'a').net.net;
    expect(scarto).toBeGreaterThan(0);
    expect(scarto).toBeLessThanOrEqual(TIE_EURO);
    expect(pickBest(ranked)!.row.id).toBe('a');
  });

  it("esclude l'impianto bloccato", () => {
    const blocked = riga({ id: 'bloccato', prices: { diesel: 1.9 } });
    const ok = riga({ id: 'ok', prices: { diesel: 1.99 } });
    expect(pickBest(rankStations([blocked, ok], { ...ctx, blocked: new Set(['bloccato']) }))!.row.id).toBe('ok');
  });

  it('esclude il prezzo assurdo invece di premiarlo', () => {
    const absurd = riga({ id: 'assurdo', prices: { diesel: 1.02 } });
    const ok = riga({ id: 'ok', prices: { diesel: 1.98 } });
    const ranked = rankStations([absurd, ok], ctx);
    expect(trova(ranked, 'assurdo').eligible).toBe(false);
    expect(trova(ranked, 'assurdo').reason).toBe('prezzo-assurdo');
    expect(pickBest(ranked)!.row.id).toBe('ok');
  });

  it('declassa il dato vecchio senza nasconderlo', () => {
    const old = riga({ id: 'vecchio', prices: { diesel: 1.97 }, updated: oreFa(6 * 24) });
    const fresh = riga({ id: 'fresco', prices: { diesel: 1.98 } });
    const ranked = rankStations([old, fresh], ctx);
    expect(trova(ranked, 'vecchio').confidence).toBe(0.3);
    expect(trova(ranked, 'vecchio').eligible).toBe(true);
    expect(pickBest(ranked)!.row.id).toBe('fresco');
  });

  it('salta le stazioni che non erogano il carburante scelto', () => {
    expect(rankStations([riga({ prices: { gpl: 0.75 } })], ctx)).toHaveLength(0);
  });

  it("giudica l'autostradale con la coorte dell'autostrada", () => {
    const coh = buildCohorts([...coorte('RA', 'diesel', 2.0), ...coorte('RA', 'diesel', 2.2, { autostrada: true })]);
    const hw = riga({ id: 'hw', isHighway: true, prices: { diesel: 2.12 }, ...aKm(0.3) });
    const strade = [2.0, 2.01, 2.02].map((p, k) => riga({ id: `r${k}`, prices: { diesel: p }, ...aKm(1 + k) }));
    const h = trova(rankStations([hw, ...strade], { ...ctx, cohorts: coh }), 'hw');
    expect(h.cohort.source).toBe('province-highway');
    // Fra autostradali tutti cari sarebbe «Conviene»: col mercato della zona e nella media.
    expect(h.level).toBe('normal');
  });

  it('con almeno tre prezzi freschi non consiglia un prezzo di sei giorni fa', () => {
    const vecchiotto = riga({ id: 'sei-giorni', prices: { diesel: 1.96 }, updated: oreFa(6 * 24) });
    const f = [1.97, 1.98, 1.99].map((p, k) => riga({ id: `f${k}`, prices: { diesel: p }, ...aKm(1 + k * 0.1) }));
    expect(pickBest(rankStations([vecchiotto, ...f], ctx))!.row.id).not.toBe('sei-giorni');
  });

  it('un prezzo fermo da tre giorni, più vicino e più economico, vince (Lugo, Eni di via Piratello)', () => {
    // 2,190 fermo da 72 ore e mezza a un km; tutti gli altri aggiornati da
    // poche ore e più cari. Con la soglia a tre giorni spariva dal consiglio
    // e vinceva un 2,254 più lontano.
    const coh = buildCohorts(coorte('RA', 'diesel', 2.3));
    const eni = riga({ id: 'eni', ...aKm(0.99), prices: { diesel: 2.19 }, updated: oreFa(72.6) });
    const vicino = riga({ id: 'avia', ...aKm(0.04), prices: { diesel: 2.339 }, updated: oreFa(44) });
    const altri = [[1.18, 2.329], [1.23, 2.299], [1.4, 2.254], [1.84, 2.299], [3, 2.239]].map(([k, p], i) =>
      riga({ id: `a${i}`, ...aKm(k!), prices: { diesel: p! }, updated: oreFa(10) }));
    const ranked = rankStations([eni, vicino, ...altri], { ...ctx, cohorts: coh, raggioKm: 15 });
    expect(trova(ranked, 'eni').consigliabile).toBe(true);
    expect(pickBest(ranked)!.row.id).toBe('eni');
  });
});

/**
 * I difetti trovati nella revisione del 13 ottobre. Ogni test riproduce il
 * caso sul codice di allora e dice come deve andare.
 */
describe('revisione: il riferimento', () => {
  it('B1 un impianto probabilmente chiuso non si consiglia e non fa da metro', () => {
    const chiuso = riga({ id: 'chiuso', ...aKm(0.3), prices: { diesel: 1.95 }, updated: oreFa(240) });
    const a = riga({ id: 'a', ...aKm(1.0), prices: { diesel: 1.99 } });
    const b = riga({ id: 'b', ...aKm(2.0), prices: { diesel: 2.01 } });
    const ranked = rankStations([chiuso, a, b], ctx);
    const c = trova(ranked, 'chiuso');
    expect(c.probabilmenteChiuso).toBe(true);
    expect(c.eligible).toBe(false);
    expect(c.reason).toBe('probabilmente-chiuso');
    expect(pickBest(ranked)!.row.id).toBe('a');
  });

  it('B1 neanche quando intorno non c’è niente di recente', () => {
    // Prima: nessun prezzo di tre giorni, quindi il metro era il più vicino
    // in assoluto, cioè il chiuso a 1,95, e il consiglio «perdeva» soldi.
    const chiuso = riga({ id: 'chiuso', ...aKm(0.3), prices: { diesel: 1.95 }, updated: oreFa(300) });
    const x = riga({ id: 'x', ...aKm(1.0), prices: { diesel: 2.05 }, updated: oreFa(100) });
    const lontano = riga({ id: 'lontano', ...aKm(0, 80), prices: { diesel: 2.0 }, updated: oreFa(100) });
    const best = pickBest(rankStations([chiuso, x, lontano], ctx))!;
    expect(best.row.id).toBe('x');
    expect(best.net.riferimento!.price).toBe(2.05);
    expect(best.net.net).toBeGreaterThanOrEqual(0);
  });

  it('B9 se i vicini sono tutti chiusi non si consiglia niente', () => {
    // Il lotto è fresco (un impianto lontano ha comunicato due ore fa):
    // sono questi tre a essere fermi da dieci giorni.
    const vecchi = [0.5, 1.5, 3].map((k, i) =>
      riga({ id: `v${i}`, ...aKm(k), prices: { diesel: 2.02 - i * 0.03 }, updated: oreFa(240) }));
    const altrove = riga({ id: 'altrove', ...aKm(0, 300), updated: oreFa(2) });
    const ranked = rankStations([...vecchi, altrove], ctx).filter((r) => r.distanceKm <= 15);
    expect(ranked.every((r) => r.probabilmenteChiuso && !r.eligible)).toBe(true);
    expect(pickBest(ranked)).toBeNull();
  });

  it('B9 se è il lotto intero a essere vecchio, gli impianti non sono «chiusi»', () => {
    // Primo avvio senza rete col seme di dieci giorni fa: vecchi sono i dati,
    // non i distributori. Il consiglio c'è, con la sua età scritta sotto.
    const vecchi = [0.5, 1.5, 3].map((k, i) =>
      riga({ id: `v${i}`, ...aKm(k), prices: { diesel: 2.02 - i * 0.03 }, updated: oreFa(240) }));
    const ranked = rankStations(vecchi, ctx);
    expect(ranked.some((r) => r.probabilmenteChiuso)).toBe(false);
    expect(pickBest(ranked)).not.toBeNull();
  });

  it('una sola data sbagliata nel futuro non spegne tutti i distributori', () => {
    // Un gestore scrive una data di otto giorni avanti: col massimo grezzo
    // tutti gli altri risultavano fermi da oltre una settimana, «forse chiusi».
    const citta = cittaFinta(11, 150, 12, 2.0, 0.08);
    const sbagliato = riga({ id: 'futuro', ...aKm(0, 200), updated: oreFa(-8 * 24) });
    const ranked = rankStations([...citta, sbagliato], { ...ctx, raggioKm: 15 });
    expect(ranked.some((r) => r.probabilmenteChiuso)).toBe(false);
    expect(pickBest(ranked)).not.toBeNull();
  });

  it('senza prezzi recenti qui intorno il pieno che faresti comunque resta consigliabile', () => {
    // Il lotto è fresco, ma qui il più vicino ha un prezzo di sei giorni e
    // l'unico di quattro giorni sta a 24 minuti di strada: prima nessun
    // consiglio, e la Home diceva «solo distributori in autostrada o chiusi».
    const vicino = riga({ id: 'vicino', ...aKm(0.5), prices: { diesel: 2.0 }, updated: oreFa(150) });
    const lontano = riga({ id: 'lontano', ...aKm(6), prices: { diesel: 1.99 }, updated: oreFa(100) });
    const altrove = riga({ id: 'altrove', ...aKm(0, 300), updated: oreFa(2) });
    const ranked = rankStations([vicino, lontano, altrove], { ...ctx, raggioKm: 15 });
    const best = pickBest(ranked)!;
    expect(best.row.id).toBe('vicino');
    expect(best.net.riferimento!.id).toBe('vicino');
    expect(trova(ranked, 'lontano').minutiInPiu).toBeGreaterThan(MAX_MINUTI_IN_PIU);
  });

  it('fragile: col lotto di quattro giorni fa il metro non è un prezzo di dieci giorni', () => {
    const vecchissimo = riga({ id: 'vecchissimo', ...aKm(0.3), prices: { diesel: 1.99 }, updated: oreFa(240) });
    const lotto = [1.999, 2.02, 2.03].map((p, k) =>
      riga({ id: `l${k}`, ...aKm(1 + k * 0.5), prices: { diesel: p }, updated: oreFa(96) }));
    const best = pickBest(rankStations([vecchissimo, ...lotto], ctx))!;
    expect(best.net.riferimento!.price).not.toBe(1.99);
    expect(best.net.net).toBeGreaterThanOrEqual(0);
  });

  it('fragile: un vicino carissimo non gonfia il risparmio di tutti', () => {
    // Il più vicino costa 2,349 e mezzo km più in là c'è il 2,19 della zona:
    // misurare tutti contro il caro prometteva sei euro a chi va al 2,19.
    const coh = buildCohorts(coorte('RA', 'diesel', 2.2));
    const caro = riga({ id: 'caro', ...aKm(0.3), prices: { diesel: 2.349 } });
    const zona = [2.19, 2.19, 2.21, 2.2].map((p, k) => riga({ id: `z${k}`, ...aKm(0.8 + k * 0.4), prices: { diesel: p } }));
    const ranked = rankStations([caro, ...zona], { ...ctx, cohorts: coh });
    const best = pickBest(ranked)!;
    const rif = best.net.riferimento!;
    expect(rif.price).toBe(2.19);
    expect(rif.id).toBe('z0');
    expect(rif.vicinoCaro?.price).toBe(2.349);
    expect(best.row.id).toBe('z0');
    expect(best.net.net).toBe(0);
    expect(trova(ranked, 'caro').net.net).toBeLessThan(0);
  });

  it('se gli altri sono lontani, il vicino caro resta il pieno che faresti comunque', () => {
    // Niente prezzo tipico preso a otto km e messo sotto casa: quel pieno
    // non esiste, e il consigliato finiva con un «in tasca» negativo.
    const coh = buildCohorts(coorte('RA', 'diesel', 2.2));
    const caro = riga({ id: 'caro', ...aKm(0.3), prices: { diesel: 2.4 } });
    const lontani = [8, 9, 10].map((k) => riga({ id: `l${k}`, ...aKm(k), prices: { diesel: 2.19 } }));
    const best = pickBest(rankStations([caro, ...lontani], { ...ctx, cohorts: coh }))!;
    expect(best.net.riferimento!.price).toBe(2.4);
    expect(best.row.id).toBe('caro');
    expect(best.net.net).toBe(0);
  });

  it('e se a prezzo normale ce n’è uno a tre km, il risparmio è vero rispetto al vicino', () => {
    const coh = buildCohorts(coorte('RA', 'diesel', 2.2));
    const caro = riga({ id: 'caro', ...aKm(0.3), prices: { diesel: 2.4 } });
    const zona = [3.0, 3.2, 3.4].map((k) => riga({ id: `z${k}`, ...aKm(k), prices: { diesel: 2.19 } }));
    const best = pickBest(rankStations([caro, ...zona], { ...ctx, cohorts: coh }))!;
    expect(best.row.id).toBe('z3');
    expect(best.net.riferimento!.price).toBe(2.4);
    expect(best.net.net).toBeGreaterThan(7);
  });

  it('il vicino appena sopra il prezzo tipico resta il metro', () => {
    // Un decimo di centesimo sopra la mediana non fa di nessuno il caro
    // del quartiere: il tetto scatta oltre i 15 centesimi sul pieno.
    const vicino = riga({ id: 'vicino', ...aKm(0.3), prices: { diesel: 2.002 } });
    const zona = [2.0, 1.99, 2.01, 2.0].map((p, k) => riga({ id: `z${k}`, ...aKm(0.8 + k * 0.4), prices: { diesel: p } }));
    const best = pickBest(rankStations([vicino, ...zona], ctx))!;
    expect(best.net.riferimento!.price).toBe(2.002);
  });

  it('anche con due soli distributori, il caro accanto all’altro non fa da metro', () => {
    // In cima al passo dello Stelvio: un 2,48 a cento metri e un 2,195
    // trecento metri più in là, e nient'altro. Prima il metro era il 2,48 e
    // il consiglio prometteva dieci euro a chi non avrebbe mai fatto il
    // pieno dal caro.
    // La provincia di Sondrio, con dentro Livigno, ha uno scarto tipo largo:
    // il 2,48 è «caro», non un errore.
    const coh = buildCohorts(coorte('SO', 'diesel', 2.2, { passo: 0.015 }));
    const caro = riga({ id: 'caro', prov: 'SO', ...aKm(0.1), prices: { diesel: 2.48 } });
    const normale = riga({ id: 'normale', prov: 'SO', ...aKm(0.4), prices: { diesel: 2.195 } });
    const best = pickBest(rankStations([caro, normale], { ...ctx, cohorts: coh }))!;
    expect(best.row.id).toBe('normale');
    expect(best.net.riferimento!.id).toBe('normale');
    expect(best.net.riferimento!.vicinoCaro?.price).toBe(2.48);
    expect(best.net.net).toBe(0);
  });
});

describe('revisione: il pieno che faresti comunque paga la sua strada', () => {
  it('mezzo centesimo in meno un km più in là non sposta il riferimento', () => {
    // Prima bastava che il più vicino stesse 0,4 centesimi sopra la mediana
    // dei vicini: il riferimento passava a B, la strada fino a B diventava
    // gratis e il consiglio mandava un km più in là facendo perdere 13
    // centesimi e quattro minuti e mezzo.
    const a = riga({ id: 'A', ...aKm(0.2), prices: { diesel: 1.994 } });
    const b = riga({ id: 'B', ...aKm(1.2), prices: { diesel: 1.99 } });
    const altri = [[3, 1.99], [4, 1.99], [5, 1.995]].map(([k, p]) => riga({ ...aKm(k!), prices: { diesel: p! } }));
    const ranked = rankStations([a, b, ...altri], { ...ctx, raggioKm: 15 });
    const best = pickBest(ranked)!;
    expect(best.row.id).toBe('A');
    expect(best.net.riferimento!.id).toBe('A');
    expect(best.net.riferimento!.vicinoCaro).toBeUndefined();
    // B rispetto ad A: un centesimo e mezzo di carburante in più, la strada no.
    expect(trova(ranked, 'B').net.net).toBeLessThan(0);
  });

  it('anche con due soli distributori, un centesimo non paga un km in più', () => {
    const a = riga({ id: 'A', ...aKm(0.2), prices: { diesel: 2.0 } });
    const b = riga({ id: 'B', ...aKm(1.2), prices: { diesel: 1.99 } });
    const best = pickBest(rankStations([a, b], { ...ctx, raggioKm: 15 }))!;
    expect(best.row.id).toBe('A');
    expect(best.net.riferimento!.id).toBe('A');
  });

  it('quando lo scambio conviene, i minuti si contano lo stesso dal più vicino', () => {
    const coh = buildCohorts(coorte('RA', 'diesel', 2.2));
    const caro = riga({ id: 'caro', ...aKm(0.3), prices: { diesel: 2.349 } });
    const zona = [2.19, 2.2, 2.21].map((p, k) => riga({ id: `z${k}`, ...aKm(0.8 + k * 0.4), prices: { diesel: p } }));
    const ranked = rankStations([caro, ...zona], { ...ctx, cohorts: coh, raggioKm: 15 });
    const z0 = trova(ranked, 'z0');
    expect(z0.net.riferimento!.id).toBe('z0');
    expect(z0.minutiInPiu).toBeCloseTo(minutiStrada(2 * 0.5 * FATTORE_STRADA), 1);
  });
});

describe('revisione: il consigliato non costa più del pieno che faresti comunque', () => {
  // Il più vicino è caro; mezzo km più in là uno appena più caro del
  // riferimento, col prezzo meno recente; il riferimento un km più in là.
  // Prima il riferimento era il terzo, ma il consigliato il secondo, perché
  // ci mette meno minuti: «in tasca − 0,20 €».
  const coh = buildCohorts(coorte('RA', 'diesel', 2.25));
  const lontani = [2.21, 2.22, 2.23].map((p, k) => riga({ ...aKm(6 + k), prices: { diesel: p } }));

  it('un prezzo meno recente fra il vicino caro e il riferimento non vince con un netto negativo', () => {
    // Quattro giorni: ancora consigliabile, ma col risparmio scontato quanto
    // basta perché mezzo centesimo in più non lo faccia scegliere.
    const caro = riga({ id: 'caro', ...aKm(0.3), prices: { diesel: 2.4 } });
    const medio = riga({ id: 'medio', ...aKm(0.8), prices: { diesel: 2.205 }, updated: oreFa(100) });
    const rif = riga({ id: 'rif', ...aKm(1.3), prices: { diesel: 2.2 } });
    const ranked = rankStations([caro, medio, rif, ...lontani], { ...ctx, cohorts: coh, raggioKm: 15 });
    const { best, lista } = classifica(ranked);
    expect(best!.net.riferimento!.id).toBe('rif');
    expect(best!.row.id).toBe('rif');
    expect(best!.net.net).toBeGreaterThanOrEqual(0);
    expect(lista[0]).toBe(best);
    // Il medio resta in lista, consigliabile, col suo netto vero.
    expect(trova(ranked, 'medio').consigliabile).toBe(true);
    expect(trova(ranked, 'medio').net.net).toBeLessThan(0);
  });

  it('anche con un prezzo di ieri a un solo centesimo', () => {
    const caro = riga({ id: 'caro', ...aKm(0.3), prices: { diesel: 2.4 } });
    const medio = riga({ id: 'medio', ...aKm(0.6), prices: { diesel: 2.199 }, updated: oreFa(30) });
    const rif = riga({ id: 'rif', ...aKm(1.3), prices: { diesel: 2.19 } });
    const best = pickBest(rankStations([caro, medio, rif, ...lontani], { ...ctx, cohorts: coh, raggioKm: 15 }))!;
    expect(best.price).toBeLessThanOrEqual(best.net.riferimento!.price);
    expect(best.net.net).toBeGreaterThanOrEqual(0);
  });

  it('e con un solo servito più vicino di tutti, appena più caro del self', () => {
    const servito = riga({ id: 'servito', ...aKm(0.3), prices: {}, servito: { diesel: 2.205 } });
    const caro = riga({ id: 'caro', ...aKm(0.5), prices: { diesel: 2.4 } });
    const self = riga({ id: 'self', ...aKm(1.4), prices: { diesel: 2.2 } });
    const best = pickBest(rankStations([servito, caro, self, ...lontani], { ...ctx, cohorts: coh, raggioKm: 15 }))!;
    expect(best.price).toBeLessThanOrEqual(best.net.riferimento!.price);
    expect(best.net.net).toBeGreaterThanOrEqual(0);
  });
});

describe('revisione: i minuti in più si contano dal più vicino, servito compreso', () => {
  it('con la pompa del paese al servito sotto casa, non manda a un self a dieci km', () => {
    // Campodolcino: il paese ha una pompa col solo servito, i self stanno a
    // valle. Prima i minuti si contavano dal self più vicino e la Home
    // mandava a dieci km scrivendo «strada in più: nessuna».
    const coh = buildCohorts(coorte('SO', 'diesel', 2.2));
    const paese = riga({ id: 'paese', prov: 'SO', ...aKm(0.05), prices: {}, servito: { diesel: 2.3 } });
    const valle = [[10, 2.2], [10.3, 2.21], [10.6, 2.205]].map(([k, p], i) =>
      riga({ id: `valle${i}`, prov: 'SO', ...aKm(k!), prices: { diesel: p! } }));
    const ranked = rankStations([paese, ...valle], { ...ctx, cohorts: coh, raggioKm: 15 });
    const best = pickBest(ranked)!;
    expect(best.row.id).toBe('paese');
    expect(best.net.riferimento!.alServito).toBe(true);
    expect(best.net.riferimento!.selfNonConviene).toBe(true);
    for (const v of ranked.filter((r) => r.row.id.startsWith('valle'))) {
      expect(v.minutiInPiu).toBeGreaterThan(MAX_MINUTI_IN_PIU);
      expect(v.nonConsigliabile).toBe('troppa-strada');
    }
  });

  it('il self a portata fa da riferimento solo se rende più del servito, contando strada e tempo', () => {
    // Il servito sotto casa costa un centesimo in più del self a quattro km:
    // quattro centesimi di carburante non pagano venti minuti di strada.
    const servito = riga({ id: 'servito', ...aKm(0.1), prices: {}, servito: { diesel: 2.21 } });
    const self = riga({ id: 'self', ...aKm(4.2), prices: { diesel: 2.2 } });
    const ranked = rankStations([servito, self], { ...ctx, raggioKm: 15 });
    const best = pickBest(ranked)!;
    expect(best.row.id).toBe('servito');
    expect(best.net.net).toBe(0);
    expect(trova(ranked, 'self').minutiInPiu).toBeLessThanOrEqual(MAX_MINUTI_IN_PIU);
  });

  it('i minuti del self che fa da riferimento si contano dal servito più vicino', () => {
    const coh = buildCohorts(coorte('BO', 'diesel', 2.26));
    const servito = riga({ id: 'servito', prov: 'BO', ...aKm(1.06), prices: {}, servito: { diesel: 2.379 } });
    const self = riga({ id: 'self', prov: 'BO', ...aKm(2.3), prices: { diesel: 2.259 } });
    const ranked = rankStations([servito, self], { ...ctx, cohorts: coh, raggioKm: 15 });
    const s = trova(ranked, 'self');
    expect(s.net.riferimento!.id).toBe('self');
    expect(s.net.riferimento!.daKm).toBeCloseTo(trova(ranked, 'servito').distanceKm, 9);
    expect(s.minutiInPiu).toBeCloseTo(minutiStrada(2 * (s.distanceKm - trova(ranked, 'servito').distanceKm) * FATTORE_STRADA), 9);
  });
});

describe('revisione: riferimento e consiglio con le stesse regole di età', () => {
  it('Primiero: col distributore a 700 m dal prezzo di quattro giorni, non manda a otto km', () => {
    // Il più vicino ha un prezzo di 80 ore prima degli ultimi arrivati; i
    // primi prezzi recenti stanno a 7,8 km e oltre. Prima il riferimento
    // saltava lì, la strada fin lì era gratis e la Home mandava a 17 minuti
    // dicendo «il più conveniente qui vicino».
    const coh = buildCohorts(coorte('TN', 'diesel', 2.25));
    const cristoforetti = riga({ id: 'vicino', prov: 'TN', ...aKm(0.7), prices: { diesel: 2.149 }, updated: oreFa(82) });
    const lontani = [[7.75, 2.19, 17], [11.4, 2.254, 30], [14, 2.254, 30], [8.7, 2.279, 150], [10.2, 2.249, 120]].map(([k, p, h], i) =>
      riga({ id: `l${i}`, prov: 'TN', ...aKm(k!), prices: { diesel: p! }, updated: oreFa(h!) }));
    const lotto = riga({ id: 'altrove', prov: 'TN', ...aKm(0, 300), updated: oreFa(2) });
    const ranked = rankStations([cristoforetti, ...lontani, lotto], { ...ctx, cohorts: coh, raggioKm: 15 });
    const best = pickBest(ranked)!;
    expect(best.row.id).toBe('vicino');
    expect(best.net.riferimento!.id).toBe('vicino');
    expect(trova(ranked, 'vicino').consigliabile).toBe(true);
  });

  it('se però intorno al più vicino ci sono tre prezzi recenti, il riferimento è fra quelli e lo dice', () => {
    const vecchio = riga({ id: 'vecchio', ...aKm(0.3), prices: { diesel: 1.97 }, updated: oreFa(144) });
    const f = [1.99, 2.0, 2.01].map((p, k) => riga({ id: `f${k}`, ...aKm(1 + k * 0.3), prices: { diesel: p } }));
    const ranked = rankStations([vecchio, ...f], { ...ctx, raggioKm: 15 });
    const best = pickBest(ranked)!;
    expect(best.net.riferimento!.id).toBe('f0');
    expect(best.net.riferimento!.piuVicini).toEqual({ vecchi: 1, alServito: 0 });
    expect(trova(ranked, 'vecchio').nonConsigliabile).toBe('prezzo-vecchio');
    // Il più vicino di tutti è a 300 m: il consiglio non va oltre la strada di venti minuti da lì.
    expect(best.distanceKm).toBeLessThanOrEqual(1 + KM_PORTATA);
  });
});

describe('revisione: il servito non fa da metro', () => {
  it('un impianto col solo servito accanto a te non gonfia il risparmio', () => {
    // Zola Predosa: il più vicino era un 2,379 al servito e il consiglio
    // prometteva sei euro invece di tre e mezzo.
    const coh = buildCohorts(coorte('BO', 'diesel', 2.26));
    const servito = riga({ id: 'servito', prov: 'BO', ...aKm(1.06), prices: {}, servito: { diesel: 2.379 } });
    const self = [[2.3, 2.259], [2.6, 2.27], [4, 2.199]].map(([k, p], i) => riga({ id: `self${i}`, prov: 'BO', ...aKm(k!), prices: { diesel: p! } }));
    const ranked = rankStations([servito, ...self], { ...ctx, cohorts: coh, raggioKm: 15 });
    const best = pickBest(ranked)!;
    const rif = best.net.riferimento!;
    expect(rif.id).toBe('self0');
    expect(rif.alServito).toBeUndefined();
    expect(rif.piuVicini).toEqual({ vecchi: 0, alServito: 1 });
    expect(best.net.gross).toBeLessThanOrEqual((2.259 - 2.199) * ctx.liters + 1e-9);
  });

  it('se intorno c’è solo il servito, il riferimento è al servito e lo dice', () => {
    const a = riga({ id: 'a', ...aKm(0.5), prices: {}, servito: { diesel: 2.1 } });
    const b = riga({ id: 'b', ...aKm(1.5), prices: {}, servito: { diesel: 2.15 } });
    const best = pickBest(rankStations([a, b], { ...ctx, raggioKm: 15 }))!;
    expect(best.net.riferimento!.id).toBe('a');
    expect(best.net.riferimento!.alServito).toBe(true);
  });
});

describe('revisione: la lista dice quello che la carta dice', () => {
  it('dopo il consigliato, i consigliabili per risparmio; chi rende di più ci mette più minuti', () => {
    const vicino = riga({ id: 'vicino', ...aKm(0.5), prices: { diesel: 2.0 } });
    const altri = [[1.2, 1.97], [2.0, 1.95], [3.5, 1.9], [5.5, 1.85], [9, 1.78]].map(([k, p], i) =>
      riga({ id: `a${i}`, ...aKm(k!), prices: { diesel: p! } }));
    const vecchio = riga({ id: 'vecchio', ...aKm(1), prices: { diesel: 1.96 }, updated: oreFa(144) });
    const hw = riga({ id: 'hw', isHighway: true, ...aKm(0.8), prices: { diesel: 2.2 } });
    const { best, lista } = classifica(rankStations([vicino, ...altri, vecchio, hw], { ...ctx, raggioKm: 15 }));
    expect(lista[0]).toBe(best);
    const gruppo = (r: (typeof lista)[number]) => (r.consigliabile ? 0 : r.eligible ? 1 : 2);
    for (let i = 1; i < lista.length; i++) expect(gruppo(lista[i]!)).toBeGreaterThanOrEqual(gruppo(lista[i - 1]!));
    const consigliabili = lista.slice(1).filter((r) => r.consigliabile);
    for (let i = 1; i < consigliabili.length; i++) expect(consigliabili[i]!.net.net).toBeLessThanOrEqual(consigliabili[i - 1]!.net.net);
    for (const r of consigliabili) {
      if (r.net.net > best!.net.net) expect(r.minutiInPiu > best!.minutiInPiu || r.distanceKm > best!.distanceKm).toBe(true);
    }
    // Il 1,78 a nove km rende di più ma chiede troppa strada: non è fra i consigliabili e lo dice.
    expect(lista.find((r) => r.row.id === 'a4')!.nonConsigliabile).toBe('troppa-strada');
    expect(lista.find((r) => r.row.id === 'vecchio')!.nonConsigliabile).toBe('prezzo-vecchio');
    expect(lista.at(-1)!.row.id).toBe('hw');
  });
});

/**
 * Il mercato nazionale di contorno: quattrocento impianti stradali a 2,25
 * con lo scarto tipo di oggi (≈ 0,06). Senza, la «nazione» dei test sarebbe
 * la sola provincia coi suoi errori.
 */
const italia = coorte('XX', 'diesel', 2.25, { n: 401, passo: 0.0005 });

describe('revisione: i prezzi da non credere', () => {
  it('B5 un prezzo fresco ma fuori scala per la zona non promette 25 euro', () => {
    // La provincia ha già sei errori a 1,55: lo scarto tipo si gonfia e un
    // 1,60 finisce a z ≈ −2, cioè «Affarone» invece di «errore».
    const norm = Array.from({ length: 30 }, (_, i) => riga({ id: `n${i}`, prov: 'RO', prices: { diesel: 2.18 + (i % 7) * 0.01 }, lat: 0, lng: 0 }));
    const err = Array.from({ length: 6 }, (_, i) => riga({ id: `e${i}`, prov: 'RO', prices: { diesel: 1.55 }, lat: 0, lng: 0 }));
    const coh = buildCohorts([...italia, ...norm, ...err]);
    const sbagliato = riga({ id: 'errore', prov: 'RO', ...aKm(1), prices: { diesel: 1.6 } });
    const zona = [2.2, 2.19, 2.21, 2.2, 2.22].map((p, k) => riga({ id: `z${k}`, prov: 'RO', ...aKm(0.5 + k * 0.6), prices: { diesel: p } }));
    const ranked = rankStations([sbagliato, ...zona], { ...ctx, cohorts: coh });
    const e = trova(ranked, 'errore');
    expect(e.z!).toBeGreaterThan(-4);
    expect(e.eligible).toBe(false);
    expect(e.reason).toBe('prezzo-assurdo');
    expect(pickBest(ranked)!.row.id).not.toBe('errore');
  });

  it('B5 anche con un solo vicino a fare da confronto', () => {
    const norm = Array.from({ length: 30 }, (_, i) => riga({ id: `n${i}`, prov: 'RO', prices: { diesel: 2.18 + (i % 7) * 0.01 }, lat: 0, lng: 0 }));
    const err = Array.from({ length: 6 }, (_, i) => riga({ id: `e${i}`, prov: 'RO', prices: { diesel: 1.55 }, lat: 0, lng: 0 }));
    const coh = buildCohorts([...italia, ...norm, ...err]);
    const sbagliato = riga({ id: 'errore', prov: 'RO', ...aKm(1), prices: { diesel: 1.7 } });
    const vero = riga({ id: 'vero', prov: 'RO', ...aKm(0.5), prices: { diesel: 2.2 } });
    expect(pickBest(rankStations([sbagliato, vero], { ...ctx, cohorts: coh }))!.row.id).toBe('vero');
  });

  it('due errori diversi vicini non si confermano a vicenda', () => {
    const coh = buildCohorts([...italia, ...coorte('RA', 'diesel', 2.2)]);
    const e1 = riga({ id: 'e1', ...aKm(1), prices: { diesel: 1.6 } });
    const e2 = riga({ id: 'e2', ...aKm(1.5), prices: { diesel: 1.7 } });
    const zona = [2.2, 2.19, 2.21, 2.2].map((p, k) => riga({ id: `z${k}`, ...aKm(0.5 + k * 0.6), prices: { diesel: p } }));
    const ranked = rankStations([e1, e2, ...zona], { ...ctx, cohorts: coh });
    expect(trova(ranked, 'e1').reason).toBe('prezzo-assurdo');
    expect(trova(ranked, 'e2').reason).toBe('prezzo-assurdo');
  });

  it('il metano costa molto diverso da un impianto all’altro: un 1,60 fra impianti a 2,10 è vero', () => {
    // Nel dataset vero metà del metano sta fra 1,70 e 2,10 €/kg, con lo
    // scarto tipo a 0,18: un 15% fisso scartava i distributori buoni.
    const coh = buildCohorts(coorte('RM', 'metano', 1.9, { n: 401, passo: 0.0016 }));
    const buono = riga({ id: 'buono', ...aKm(2), prices: { metano: 1.599 } });
    const zona = [2.099, 2.1, 2.09, 2.11, 2.099].map((p, k) => riga({ id: `z${k}`, ...aKm(0.5 + k * 0.3), prices: { metano: p } }));
    const ranked = rankStations([buono, ...zona], { ...ctx, fuel: 'metano', cohorts: coh });
    expect(trova(ranked, 'buono').eligible).toBe(true);
    expect(pickBest(ranked)!.row.id).toBe('buono');
  });

  /**
   * Livigno: zona extradoganale, il gasolio costa un quarto meno che a
   * Bormio ed è vero. L'Agip a 1,292 sta un altro quarto sotto gli altri del
   * paese, e nessuno lo conferma.
   */
  function livigno(coh: ReturnType<typeof buildCohorts>) {
    const paese = [0.2, 0.25, 1.1, 1.2, 1.3, 1.5, 1.9, 2.1, 4.5, 5.7].map((k, i) =>
      riga({ id: `liv${i}`, prov: 'SO', city: 'LIVIGNO', ...aKm(k), prices: { diesel: 1.72 + (i % 3) * 0.005 } }));
    // Due giorni e un'ora prima degli ultimi arrivati (di due ore fa): com'era
    // il prezzo vero nel pomeriggio del 13 ottobre.
    const agip = riga({ id: 'agip', prov: 'SO', city: 'LIVIGNO', ...aKm(2.3), prices: { diesel: 1.292 }, updated: oreFa(51) });
    return rankStations([...paese, agip], { ...ctx, cohorts: coh });
  }

  it('Livigno: il prezzo extradoganale non è un errore', () => {
    // Come nel dataset vero: Livigno sta nella provincia di Sondrio, e
    // l'Italia ha uno scarto tipo di sette centesimi.
    const resto = Array.from({ length: 50 }, (_, i) => riga({ id: `so${i}`, prov: 'SO', prices: { diesel: 2.22 + (i % 7) * 0.01 }, lat: 0, lng: 0 }));
    const paese = Array.from({ length: 10 }, (_, i) => riga({ id: `sol${i}`, prov: 'SO', prices: { diesel: 1.72 }, lat: 0, lng: 0 }));
    const coh = buildCohorts([...coorte('XX', 'diesel', 2.25, { n: 1201, passo: 0.0002 }), ...resto, ...paese, riga({ prov: 'SO', prices: { diesel: 1.292 }, lat: 0, lng: 0 })]);
    expect(coh.bySegment.get('road|diesel')!.std).toBeLessThan(0.1);
    const ranked = livigno(coh);
    expect(trova(ranked, 'agip').eligible).toBe(true);
    expect(trova(ranked, 'agip').ritardoH).toBeGreaterThan(48);
    expect(pickBest(ranked)!.price).toBe(1.292);
  });

  it('Livigno: lo giudica il mercato del paese, non la provincia', () => {
    // Una provincia dallo scarto stretto: per lei ogni prezzo di Livigno è
    // a z −9. Ma dodici impianti vicini che dicono la stessa cosa non sbagliano.
    const coh = buildCohorts(coorte('SO', 'diesel', 2.25));
    const ranked = livigno(coh);
    expect(ranked.filter((r) => r.eligible).length).toBe(ranked.length);
    expect(pickBest(ranked)!.price).toBe(1.292);
  });

  it('nel Salento un 2,199 di due giorni e mezzo fa non è un fantasma: la zona sono 25 km, non i cinque più vicini', () => {
    // Taviano, come nei dati veri: accanto tre pompe care (2,37-2,45), ma
    // nei 25 km intorno ce ne sono ottanta, quasi tutte fra 2,23 e 2,30.
    // Prima il metro erano i cinque più vicini e il 2,199 sembrava un prezzo
    // rimasto lì; poi lo salvava la media di provincia, che però lasciava
    // passare gli errori dove la provincia è abbassata da un'enclave.
    const coh = buildCohorts([...italia, ...coorte('LE', 'diesel', 2.25)]);
    const vicine = [2.445, 2.369, 2.369, 2.261, 2.254].map((p, k) =>
      riga({ id: `z${k}`, prov: 'LE', ...aKm(1.5 + k), prices: { diesel: p } }));
    const zona = Array.from({ length: 30 }, (_, i) =>
      riga({ id: `s${i}`, prov: 'LE', ...aKm(-6 - (i % 10) * 1.5, (i % 3) * 4), prices: { diesel: 2.23 + (i % 8) * 0.01 } }));
    const fly = riga({ id: 'fly', prov: 'LE', ...aKm(0.2), prices: { diesel: 2.199 }, updated: oreFa(62) });
    const f = trova(rankStations([fly, ...vicine, ...zona], { ...ctx, cohorts: coh, raggioKm: 15 }), 'fly');
    expect(f.eligible).toBe(true);
    expect(f.reason).toBeUndefined();
  });

  /**
   * La provincia di Sondrio: Valtellina a 2,25-2,30 e un'enclave (Livigno)
   * che abbassa la media di provincia a 2,16 e ne allarga lo scarto tipo.
   */
  function sondrio() {
    const resto = Array.from({ length: 50 }, (_, i) => riga({ id: `so${i}`, prov: 'SO', prices: { diesel: 2.25 + (i % 5) * 0.01 }, lat: 0, lng: 0 }));
    const enclave = Array.from({ length: 12 }, (_, i) => riga({ id: `en${i}`, prov: 'SO', prices: { diesel: 1.72 }, lat: 0, lng: 0 }));
    return buildCohorts([...italia, ...resto, ...enclave]);
  }

  it('Sondrio: un 1,849 inventato e fresco fra pompe a 2,2-2,3 non si consiglia', () => {
    const coh = sondrio();
    const zona = [2.279, 2.299, 2.195, 2.299, 2.24, 2.259, 2.249, 2.299, 2.275].map((p, k) =>
      riga({ id: `z${k}`, prov: 'SO', ...aKm(0.4 + k * 0.6), prices: { diesel: p } }));
    const finto = riga({ id: 'finto', prov: 'SO', ...aKm(1), prices: { diesel: 1.849 } });
    const ranked = rankStations([finto, ...zona], { ...ctx, cohorts: coh, raggioKm: 15 });
    expect(trova(ranked, 'finto').reason).toBe('prezzo-assurdo');
    expect(pickBest(ranked)!.row.id).not.toBe('finto');
  });

  it('un errore 45 centesimi sotto i vicini non passa perché la provincia ha un’enclave economica', () => {
    // Col metro «il più basso fra zona e media di provincia» passava e
    // prometteva diciassette euro.
    const coh = sondrio();
    const zona = [2.3, 2.29, 2.31, 2.3, 2.29].map((p, k) => riga({ id: `z${k}`, prov: 'SO', ...aKm(0.5 + k * 0.5), prices: { diesel: p } }));
    const errore = riga({ id: 'errore', prov: 'SO', ...aKm(1.2), prices: { diesel: 1.85 } });
    const ranked = rankStations([errore, ...zona], { ...ctx, cohorts: coh, raggioKm: 15 });
    expect(trova(ranked, 'errore').eligible).toBe(false);
    expect(trova(ranked, 'errore').reason).toBe('prezzo-assurdo');
    expect(pickBest(ranked)!.net.net).toBeLessThan(1);
  });

  it('Livigno passa perché la sua zona è tutta bassa, anche senza un prezzo uguale vicino', () => {
    // Prezzi bassi diversi fra loro: nessuno ne ha un altro entro due
    // centesimi, quindi nessuna conferma. A venti km Bormio, a 2,2-2,5; la
    // provincia e il resto d'Italia stanno a 2,25.
    const coh = sondrio();
    const prezzi = [1.29, 1.32, 1.35, 1.38, 1.41, 1.44, 1.47];
    const paese = prezzi.map((p, k) => riga({ id: `liv${k}`, prov: 'SO', ...aKm(0.3 + k * 0.7), prices: { diesel: p } }));
    const bormio = [2.195, 2.48, 2.299].map((p, k) => riga({ id: `bo${k}`, prov: 'SO', ...aKm(19 + k * 0.4, 5), prices: { diesel: p } }));
    for (const a of prezzi) for (const b of prezzi) if (a !== b) expect(Math.abs(a - b)).toBeGreaterThan(0.02);
    const ranked = rankStations([...paese, ...bormio], { ...ctx, cohorts: coh, raggioKm: 15 });
    for (const r of ranked.filter((x) => x.row.id.startsWith('liv'))) expect(r.reason).toBeUndefined();
    expect(pickBest(ranked)!.price).toBe(1.29);
  });

  it('Bormio, fra Livigno e la Valtellina, non è «fuori mercato» perché costa come l’Italia', () => {
    const coh = sondrio();
    const paese = Array.from({ length: 9 }, (_, k) => riga({ id: `liv${k}`, prov: 'SO', ...aKm(-15 - k * 0.3), prices: { diesel: 1.72 + (k % 3) * 0.003 } }));
    const bormio = riga({ id: 'bormio', prov: 'SO', ...aKm(0.3), prices: { diesel: 2.195 } });
    const caro = riga({ id: 'caro', prov: 'SO', ...aKm(0.5), prices: { diesel: 2.48 } });
    const ranked = rankStations([...paese, bormio, caro], { ...ctx, cohorts: coh, raggioKm: 15 });
    expect(trova(ranked, 'bormio').reason).toBeUndefined();
    expect(trova(ranked, 'caro').reason).toBeUndefined();
  });

  it('un prezzo all’insù fuori scala sotto casa non fa da metro', () => {
    // Un 2,99 battuto per sbaglio al posto di 1,99: come pieno «che faresti
    // comunque» prometterebbe trenta euro a chiunque.
    const coh = buildCohorts([...italia, ...coorte('RA', 'diesel', 2.0)]);
    const sbagliato = riga({ id: 'sbagliato', ...aKm(0.2), prices: { diesel: 2.99 } });
    const zona = [1.99, 2.0, 2.01, 1.98, 2.0].map((p, k) => riga({ id: `z${k}`, ...aKm(2 + k * 0.5), prices: { diesel: p } }));
    const ranked = rankStations([sbagliato, ...zona], { ...ctx, cohorts: coh, raggioKm: 15 });
    expect(trova(ranked, 'sbagliato').reason).toBe('prezzo-assurdo');
    expect(pickBest(ranked)!.net.riferimento!.id).toBe('z0');
  });
});

describe('revisione: tempo e autostrada', () => {
  it('B3 non manda a 27 minuti di strada per meno di due euro', () => {
    const vicino = riga({ id: 'vicino', ...aKm(0.5), prices: { diesel: 2.0 } });
    const lontano = riga({ id: 'lontano', ...aKm(6.5), prices: { diesel: 1.92 } });
    const ranked = rankStations([vicino, lontano], ctx);
    expect(pickBest(ranked)!.row.id).toBe('vicino');
    expect(trova(ranked, 'lontano').minutiInPiu).toBeGreaterThan(25);
  });

  it('B3 un risparmio vero a pochi minuti resta il consiglio', () => {
    const vicino = riga({ id: 'vicino', ...aKm(0.5), prices: { diesel: 2.0 } });
    const medio = riga({ id: 'medio', ...aKm(2.0), prices: { diesel: 1.9 } });
    const best = pickBest(rankStations([vicino, medio], ctx))!;
    expect(best.row.id).toBe('medio');
    expect(best.net.net).toBeGreaterThan(3);
  });

  it('B3 cinquanta centesimi in più non valgono un quarto d’ora in più', () => {
    const vicino = riga({ id: 'vicino', ...aKm(0.5), prices: { diesel: 2.0 } });
    const a = riga({ id: 'a', ...aKm(2.0), prices: { diesel: 1.92 } }); // +6,7 min
    const b = riga({ id: 'b', ...aKm(4.5), prices: { diesel: 1.89 } }); // +17,8 min
    const ranked = rankStations([vicino, a, b], ctx);
    expect(trova(ranked, 'b').net.net - trova(ranked, 'a').net.net).toBeGreaterThan(0.4);
    expect(pickBest(ranked)!.row.id).toBe('a');
  });

  it('il numero mostrato sono euro veri: carburante risparmiato meno carburante della strada', () => {
    const vicino = riga({ id: 'vicino', ...aKm(0.5), prices: { diesel: 2.0 } });
    const altri = [1.95, 1.93, 2.01].map((p, k) => riga({ id: `a${k}`, ...aKm(1.5 + k * 2), prices: { diesel: p }, updated: oreFa(30) }));
    for (const r of rankStations([vicino, ...altri], ctx)) {
      const n = r.net;
      const rif = n.riferimento!;
      expect(n.kmStrada).toBeCloseTo(2 * Math.max(0, r.distanceKm - rif.distanceKm) * FATTORE_STRADA, 9);
      expect(n.roadCost).toBeCloseTo((n.kmStrada / ctx.kml) * r.price, 9);
      expect(n.gross).toBeCloseTo((rif.price - r.price) * ctx.liters, 9);
      expect(n.net).toBeCloseTo((n.gross >= 0 ? n.gross * r.confidence : n.gross) - n.roadCost, 9);
    }
  });

  it('B4 chi non è in autostrada non ci entra per fare benzina', () => {
    const hw = riga({ id: 'hw', isHighway: true, ...aKm(0.3), prices: { diesel: 1.95 } });
    const strade = [2.0, 2.01, 2.02].map((p, k) => riga({ id: `r${k}`, ...aKm(1 + k * 0.5), prices: { diesel: p } }));
    const ranked = rankStations([hw, ...strade], ctx);
    const h = trova(ranked, 'hw');
    expect(h.eligible).toBe(false);
    expect(h.reason).toBe('autostrada');
    const best = pickBest(ranked)!;
    expect(best.row.isHighway).toBe(false);
    expect(best.net.riferimento!.price).toBe(2.0);
  });

  it('B2 un autostradale caro accanto a te non gonfia il risparmio delle pompe normali', () => {
    const hw = riga({ id: 'hw', isHighway: true, ...aKm(0.2), prices: { diesel: 2.2 } });
    const road = riga({ id: 'road', ...aKm(1.5), prices: { diesel: 2.0 } });
    const best = pickBest(rankStations([hw, road], ctx))!;
    expect(best.row.id).toBe('road');
    expect(best.net.riferimento!.price).toBe(2.0);
    expect(best.net.net).toBe(0);
  });
});

describe('revisione: solo servito', () => {
  it('B6 un impianto col solo servito si confronta al prezzo servito, e lo dice', () => {
    const servito = riga({ id: 'servito', ...aKm(0.3), prices: {}, servito: { diesel: 2.05 } });
    const self = riga({ id: 'self', ...aKm(1), prices: { diesel: 2.0 } });
    const ranked = rankStations([servito, self], ctx);
    const s = trova(ranked, 'servito');
    expect(s.price).toBe(2.05);
    expect(s.alServito).toBe(true);
    expect(s.eligible).toBe(true);
    expect(trova(ranked, 'self').alServito).toBe(false);
  });

  it('B6 il servito non entra nelle statistiche di provincia', () => {
    const idx = buildCohorts([riga({ prices: {}, servito: { diesel: 2.3 } })]);
    expect(idx.byFuel.get('diesel')).toBeUndefined();
  });
});

/**
 * Una città finta più varia: un impianto su sei ha il solo servito (più caro
 * di 20-40 centesimi), uno su otto è il caro del quartiere, e i prezzi hanno
 * fino a quattro giorni. Sono i casi in cui riferimento e consiglio
 * rischiano di dirsi cose diverse.
 */
function cittaMista(seed: number): ReturnType<typeof cittaFinta> {
  const r = rng(seed * 7919);
  return cittaFinta(seed, 40, 12, 2.0, 0.03).map((x) => {
    const tipo = r();
    const eta = r() * 100;
    const p = x.prices.diesel!;
    if (tipo < 1 / 6) return { ...x, prices: {}, servito: { diesel: Math.round((p + 0.2 + r() * 0.2) * 1000) / 1000 }, updated: oreFa(eta) };
    if (tipo < 1 / 6 + 1 / 8) return { ...x, prices: { diesel: Math.round((p + 0.15 + r() * 0.1) * 1000) / 1000 }, updated: oreFa(eta) };
    return { ...x, updated: oreFa(eta) };
  });
}

/**
 * Invarianti che devono valere in qualunque città: si controllano su città
 * finte generate con un seme fisso, non sui prezzi di oggi.
 */
describe('rankStations — invarianti su città finte', () => {
  const citta = [
    ...Array.from({ length: 20 }, (_, i) => ({ nome: `città #${i + 1}`, righe: () => cittaFinta(i + 1) })),
    ...Array.from({ length: 30 }, (_, i) => ({ nome: `città mista #${i + 1}`, righe: () => cittaMista(i + 1) })),
  ];
  for (const { nome, righe } of citta) {
    it(nome, () => {
      const ranked = rankStations(righe(), { ...ctx, raggioKm: 15 });
      const best = pickBest(ranked)!;
      expect(best.eligible).toBe(true);
      expect(best.minutiInPiu).toBeLessThanOrEqual(MAX_MINUTI_IN_PIU);
      // Il consiglio non costa più del distributore più vicino, e quando il
      // metro è il più vicino non ci rimette rispetto a lui.
      const rif = best.net.riferimento!;
      expect(best.net.net).toBeGreaterThanOrEqual(0);
      expect(best.price).toBeLessThanOrEqual(rif.price);
      // Il riferimento è un distributore vero della lista, col suo prezzo e la sua distanza.
      const r = trova(ranked, rif.id!);
      expect(r.price).toBe(rif.price);
      expect(r.distanceKm).toBe(rif.distanceKm);
      // Nessun consigliabile lo batte sia nel netto che nei minuti di strada.
      const dominanti = ranked.filter((r) => r.consigliabile && r.net.net > best.net.net && r.minutiInPiu < best.minutiInPiu);
      expect(dominanti.map((r) => r.row.id)).toEqual([]);
      // E non manda oltre la strada di venti minuti dal più vicino consigliabile.
      const primo = Math.min(...ranked.filter((r) => r.consigliabile).map((r) => r.distanceKm));
      expect(best.distanceKm).toBeLessThanOrEqual(primo + KM_PORTATA + 1e-9);
      expect(rif.daKm).toBe(primo);
      // Il primo della lista è il consigliato.
      expect(classifica(ranked).lista[0]).toBe(best);
    });
  }
});

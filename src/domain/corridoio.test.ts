import { describe, it, expect } from 'vitest';
import { proiettaSuPercorso, deviazioneDaScostamento } from './corridoio';
import type { Percorso } from './corridoio';

/**
 * Percorso finto ma realistico: una retta verso est lungo il 44° parallelo,
 * da lng 12.00 a lng 12.10, cioè circa 8 km.
 */
const retta: Percorso = {
  punti: [
    { lat: 44.0, lng: 12.0 },
    { lat: 44.0, lng: 12.025 },
    { lat: 44.0, lng: 12.05 },
    { lat: 44.0, lng: 12.075 },
    { lat: 44.0, lng: 12.1 },
  ],
  km: 8.0,
};

describe('proiezione di una pompa sul percorso verso casa', () => {
  it('una pompa sul percorso ha scostamento quasi nullo', () => {
    const p = proiettaSuPercorso(retta, { lat: 44.0, lng: 12.05 });
    expect(p.scostamentoKm).toBeLessThan(0.05);
  });

  it('misura lo scostamento laterale, non la distanza dagli estremi', () => {
    // 0.009° di latitudine ≈ 1 km a nord del percorso, a metà strada.
    const p = proiettaSuPercorso(retta, { lat: 44.009, lng: 12.05 });
    expect(p.scostamentoKm).toBeGreaterThan(0.9);
    expect(p.scostamentoKm).toBeLessThan(1.1);
  });

  it('dice quanto sei avanti quando esci dal percorso', () => {
    const inizio = proiettaSuPercorso(retta, { lat: 44.0, lng: 12.005 });
    const meta = proiettaSuPercorso(retta, { lat: 44.0, lng: 12.05 });
    const fine = proiettaSuPercorso(retta, { lat: 44.0, lng: 12.095 });

    expect(inizio.progresso).toBeLessThan(0.1);
    expect(meta.progresso).toBeGreaterThan(0.45);
    expect(meta.progresso).toBeLessThan(0.55);
    expect(fine.progresso).toBeGreaterThan(0.9);
  });

  it('i km rimanenti scalano coi km stradali del router, non con la spezzata', () => {
    const meta = proiettaSuPercorso(retta, { lat: 44.0, lng: 12.05 });
    expect(meta.kmRimanenti).toBeGreaterThan(3.5);
    expect(meta.kmRimanenti).toBeLessThan(4.5);
  });

  it('una pompa oltre la fine del percorso si proietta sull-ultimo punto', () => {
    const p = proiettaSuPercorso(retta, { lat: 44.0, lng: 12.2 });
    expect(p.progresso).toBeCloseTo(1, 2);
    expect(p.scostamentoKm).toBeGreaterThan(7);
  });

  it('regge i percorsi degeneri senza esplodere', () => {
    expect(proiettaSuPercorso({ punti: [], km: 0 }, { lat: 44, lng: 12 }).scostamentoKm).toBe(Infinity);
    const uno = proiettaSuPercorso({ punti: [{ lat: 44, lng: 12 }], km: 0 }, { lat: 44, lng: 12 });
    expect(uno.scostamentoKm).toBeCloseTo(0, 3);
  });

  /**
   * È il caso che il triangolo sbagliava: su un percorso che curva, una pompa
   * dentro l'ansa è vicinissima in linea d'aria a partenza e arrivo — quindi
   * il triangolo la dà quasi «sul percorso» — ma dalla strada è lontana.
   */
  it('non scambia per «sul percorso» una pompa dentro l-ansa di una curva', () => {
    const curva: Percorso = {
      punti: [
        { lat: 44.0, lng: 12.0 },
        { lat: 44.05, lng: 12.02 },
        { lat: 44.05, lng: 12.08 },
        { lat: 44.0, lng: 12.1 },
      ],
      km: 14,
    };
    // Nel mezzo dell'ansa, a sud della strada che va da nord.
    const dentro = proiettaSuPercorso(curva, { lat: 44.0, lng: 12.05 });
    // Il triangolo qui direbbe «quasi zero»; sulla strada sono chilometri.
    expect(dentro.scostamentoKm).toBeGreaterThan(3.5);
  });
});

describe('deviazione da scostamento', () => {
  it('conta andata e ritorno dal percorso', () => {
    expect(deviazioneDaScostamento(1.2)).toBeCloseTo(2.4, 5);
    expect(deviazioneDaScostamento(0)).toBe(0);
  });
});

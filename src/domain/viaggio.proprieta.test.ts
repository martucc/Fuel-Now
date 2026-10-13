import { describe, it, expect } from 'vitest';
import { LITRI_MINIMI_SOSTA, pianificaViaggio, RISERVA, type PianoInput, type TappaCandidata } from './viaggio';
import { casuale, pianoDiRiferimento, verificaPiano } from './__fixtures__/pianoRiferimento';

/**
 * Il piano contro un risolutore di riferimento scritto in un altro modo
 * (una griglia fine sul livello del serbatoio), su istanze casuali ma
 * ripetibili. I prezzi sono finti e vicini a quelli veri, con tanti
 * pareggi a 2,190 come nei dati del MIMIT: non dipendono da stations.json.
 */

const PREZZI_COMUNI = [2.19, 2.19, 2.19, 2.199, 2.209, 2.249];

function istanza(r: () => number, n: number): PianoInput {
  const serbatoioL = 35 + Math.round(r() * 35);
  const kml = 10 + r() * 15;
  const distanzaKm = 50 + r() * 1450;
  const riserva = serbatoioL * RISERVA;
  // Una volta su cinque si parte gia in riserva.
  const litriAdesso = r() < 0.2 ? r() * riserva : riserva + r() * (serbatoioL - riserva);
  const quante = Math.floor(r() * 11);
  const candidate: TappaCandidata[] = [];
  for (let q = 0; q < quante; q++) {
    // Ogni tanto due pompe nello stesso piazzale.
    const gemella = q > 0 && r() < 0.15;
    const km = gemella ? Math.min(distanzaKm - 0.01, candidate[q - 1]!.kmDaPartenza + r() * 0.4) : r() * distanzaKm;
    const prezzo = r() < 0.35 ? PREZZI_COMUNI[Math.floor(r() * PREZZI_COMUNI.length)]! : Math.round((1.85 + r() * 0.5) * 1000) / 1000;
    candidate.push({
      id: `i${n}-t${q}`,
      nome: '',
      brand: '',
      level: 'normal',
      prezzo,
      kmDaPartenza: km,
      deviazioneKm: r() < 0.6 ? 0 : r() * 2.5,
    });
  }
  const prezzoPartenza = r() < 0.3 ? null : Math.round((1.9 + r() * 0.45) * 1000) / 1000;
  return { distanzaKm, kml, serbatoioL, litriAdesso, candidate, prezzoPartenza };
}

describe('pianificaViaggio: proprieta su istanze casuali', () => {
  it('non costa mai piu del riferimento, e fattibile quando lo e il riferimento, non fa soste da zero litri', () => {
    const r = casuale(20261013);
    let confrontate = 0;
    let peggioreScarto = -Infinity;
    const problemi: string[] = [];

    for (let n = 0; n < 600; n++) {
      const i = istanza(r, n);
      const piano = pianificaViaggio(i);
      const rif = pianoDiRiferimento(i);

      const errori = verificaPiano(i, piano, LITRI_MINIMI_SOSTA);
      if (errori.length > 0) problemi.push(`#${n}: ${errori.join('; ')}`);
      if (piano.soste.some((s) => s.litri < LITRI_MINIMI_SOSTA - 1e-9)) problemi.push(`#${n}: sosta da meno di un decilitro`);

      if (!rif.fattibile) continue;
      confrontate++;
      if (!piano.fattibile || piano.arrivoSottoRiserva) {
        problemi.push(`#${n}: il riferimento ci arriva, il piano no`);
        continue;
      }
      const scarto = piano.spesaCarburante - rif.costo;
      peggioreScarto = Math.max(peggioreScarto, scarto);
      if (scarto > 0.05) problemi.push(`#${n}: ${piano.spesaCarburante.toFixed(2)} € contro ${rif.costo.toFixed(2)} €`);
    }

    expect(problemi).toEqual([]);
    expect(confrontate).toBeGreaterThanOrEqual(300);
    expect(peggioreScarto).toBeLessThanOrEqual(0.05);
  });
});

describe('pianificaViaggio: e veloce anche sul telefono', () => {
  it('1.400 km con 300 distributori in meno di 50 ms', () => {
    const r = casuale(7);
    const distributori = (km: number): TappaCandidata[] =>
      Array.from({ length: 300 }, (_, q) => ({
        id: `t${q}`,
        nome: '',
        brand: '',
        level: 'normal',
        prezzo: r() < 0.4 ? 2.19 : Math.round((2.05 + r() * 0.35) * 1000) / 1000,
        kmDaPartenza: r() * km,
        deviazioneKm: r() * 2.5,
      }));
    const lungo = distributori(1400);
    // Il calcolo costa con le coppie di distributori raggiungibili l'uno
    // dall'altro: serbatoio grande e consumo basso sono il caso peggiore, e
    // 300 distributori in 270 km li mette tutti a portata di tutti.
    const casi: PianoInput[] = [
      { distanzaKm: 1400, kml: 15, serbatoioL: 50, litriAdesso: 12, candidate: lungo, prezzoPartenza: 2.2 },
      { distanzaKm: 1400, kml: 25, serbatoioL: 80, litriAdesso: 5, candidate: lungo, prezzoPartenza: null },
      { distanzaKm: 270, kml: 25, serbatoioL: 80, litriAdesso: 1, candidate: distributori(270), prezzoPartenza: 2.2 },
    ];
    for (const caso of casi) {
      for (let w = 0; w < 3; w++) pianificaViaggio(caso);
      const tempi: number[] = [];
      for (let g = 0; g < 9; g++) {
        const t0 = performance.now();
        const p = pianificaViaggio(caso);
        tempi.push(performance.now() - t0);
        expect(p.fattibile).toBe(true);
      }
      tempi.sort((a, b) => a - b);
      expect(tempi[4]!).toBeLessThan(50);
    }
  });
});

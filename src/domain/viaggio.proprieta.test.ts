import { describe, it, expect } from 'vitest';
import { pianificaViaggio, RISERVA, type PianoInput, type TappaCandidata } from './viaggio';
import { casuale, pianoDiRiferimento, valorePiano, verificaPiano } from './__fixtures__/pianoRiferimento';

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
  it('costa quanto il riferimento, e fattibile quando lo e il riferimento, i conti tornano', () => {
    const r = casuale(20261013);
    let confrontate = 0;
    let inRiserva = 0;
    let peggioreScarto = 0;
    const problemi: string[] = [];

    for (let n = 0; n < 600; n++) {
      const i = istanza(r, n);
      // Ogni tanto una riserva minima, anche zero: il piano non deve
      // comunque mai restare a secco.
      if (n % 25 === 0) i.riservaFrazione = n % 50 === 0 ? 0 : 0.005;
      const piano = pianificaViaggio(i);
      const rif = pianoDiRiferimento(i);

      const errori = verificaPiano(i, piano);
      if (errori.length > 0) problemi.push(`#${n}: ${errori.join('; ')}`);

      if (piano.fattibile !== rif.fattibile) {
        problemi.push(`#${n}: piano ${piano.fattibile ? 'fattibile' : 'impossibile'}, riferimento no`);
        continue;
      }
      if (!rif.fattibile) continue;
      confrontate++;
      if (piano.arrivoSottoRiserva || piano.primaSostaInRiserva) inRiserva++;
      const scarto = valorePiano(i, piano) - rif.valore;
      if (Math.abs(scarto) > Math.abs(peggioreScarto)) peggioreScarto = scarto;
      if (Math.abs(scarto) > 0.01) problemi.push(`#${n}: ${valorePiano(i, piano).toFixed(3)} contro ${rif.valore.toFixed(3)}`);
    }

    expect(problemi).toEqual([]);
    expect(confrontate).toBeGreaterThanOrEqual(400);
    // Le istanze passano anche dalla riserva, non solo dai casi comodi.
    expect(inRiserva).toBeGreaterThanOrEqual(30);
    expect(Math.abs(peggioreScarto)).toBeLessThanOrEqual(0.01);
  });

  it('piu carburante alla partenza non peggiora mai il piano', () => {
    // Il difetto di prima: con un decilitro sopra la riserva il piano
    // saltava la pompa sulla strada, o diceva «non ci arrivi».
    const r = casuale(4242);
    const problemi: string[] = [];
    for (let n = 0; n < 60; n++) {
      const i = istanza(r, n);
      let prima = Infinity;
      let fattibilePrima = false;
      for (let l = 0; l <= i.serbatoioL + 1e-9; l += i.serbatoioL / 80) {
        const caso = { ...i, litriAdesso: l };
        const piano = pianificaViaggio(caso);
        const v = valorePiano(caso, piano);
        if (v > prima + 0.01) problemi.push(`#${n}: con ${l.toFixed(2)} L costa ${v.toFixed(2)}, con meno ${prima.toFixed(2)}`);
        if (fattibilePrima && !piano.fattibile) problemi.push(`#${n}: con ${l.toFixed(2)} L non ci si arriva piu`);
        prima = Math.min(prima, v);
        fattibilePrima ||= piano.fattibile;
      }
    }
    expect(problemi).toEqual([]);
  });
});

describe('pianificaViaggio: le pompe battute in tutto si possono ignorare', () => {
  it('su strade fitte di distributori il conto e quello del riferimento, che le guarda tutte', () => {
    // Come in citta in Risparmio: tante pompe in pochi km, molte fino a 2,5
    // km dalla strada, spesso allo stesso prezzo. Il piano toglie quelle
    // battute da una vicina; il riferimento no.
    const r = casuale(31337);
    const problemi: string[] = [];
    let confrontate = 0;
    for (let n = 0; n < 150; n++) {
      const serbatoioL = 30 + Math.round(r() * 40);
      const distanzaKm = 5 + r() * (r() < 0.5 ? 60 : 700);
      const zona = r() < 0.6 ? Math.min(distanzaKm, 3 + r() * 15) : distanzaKm;
      const candidate: TappaCandidata[] = Array.from({ length: 8 + Math.floor(r() * 22) }, (_, q) => ({
        id: `f${n}-${q}`,
        nome: '',
        brand: '',
        level: 'normal',
        prezzo: r() < 0.5 ? 2.19 : Math.round((2.12 + r() * 0.15) * 1000) / 1000,
        kmDaPartenza: r() * zona,
        deviazioneKm: r() < 0.3 ? r() * 0.1 : r() * 2.5,
      }));
      const riserva = serbatoioL * RISERVA;
      const i: PianoInput = {
        distanzaKm,
        kml: 8 + r() * 20,
        serbatoioL,
        litriAdesso: r() < 0.4 ? r() * riserva : r() * serbatoioL,
        candidate,
        prezzoPartenza: 2.2,
      };
      const piano = pianificaViaggio(i);
      const rif = pianoDiRiferimento(i, 0.5);
      if (piano.fattibile !== rif.fattibile) problemi.push(`#${n}: fattibile ${piano.fattibile} contro ${rif.fattibile}`);
      if (!piano.fattibile || !rif.fattibile) continue;
      confrontate++;
      const scarto = valorePiano(i, piano) - rif.valore;
      if (Math.abs(scarto) > 0.01) problemi.push(`#${n}: ${scarto.toFixed(3)} €`);
    }
    expect(problemi).toEqual([]);
    expect(confrontate).toBeGreaterThan(100);
  });
});

describe('pianificaViaggio: e veloce anche sul telefono', () => {
  it('1.300 km con mille distributori in meno di 50 ms', () => {
    // Come Milano → Reggio Calabria in Risparmio: 1.243 km e quasi
    // novecento distributori entro 2,5 km dalla strada, tanti a 2,190.
    const r = casuale(7);
    const distributori = (quanti: number, km: number): TappaCandidata[] =>
      Array.from({ length: quanti }, (_, q) => ({
        id: `t${q}`,
        nome: '',
        brand: '',
        level: 'normal',
        prezzo: r() < 0.4 ? 2.19 : Math.round((2.05 + r() * 0.35) * 1000) / 1000,
        kmDaPartenza: r() * km,
        deviazioneKm: r() < 0.4 ? r() * 0.3 : r() * 2.5,
      }));
    const lungo = distributori(1000, 1300);
    // Il calcolo costa con le coppie di distributori raggiungibili l'uno
    // dall'altro: serbatoio grande e consumo basso sono il caso peggiore, e
    // cinquecento distributori in 270 km li mette tutti a portata di tutti.
    const casi: PianoInput[] = [
      { distanzaKm: 1300, kml: 18, serbatoioL: 45, litriAdesso: 22.5, candidate: lungo, prezzoPartenza: 2.2 },
      { distanzaKm: 1300, kml: 15, serbatoioL: 50, litriAdesso: 4, candidate: lungo, prezzoPartenza: 2.2 },
      { distanzaKm: 1300, kml: 25, serbatoioL: 80, litriAdesso: 5, candidate: lungo, prezzoPartenza: null },
      { distanzaKm: 270, kml: 25, serbatoioL: 80, litriAdesso: 1, candidate: distributori(500, 270), prezzoPartenza: 2.2 },
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

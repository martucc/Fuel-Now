import { describe, it, expect } from 'vitest';
import { fondoPrimaSosta, pianificaViaggio, RISERVA, riservaLitri, type Piano, type PianoInput, type TappaCandidata } from './viaggio';
import { casuale, pianoDiRiferimento, ripercorri, valorePiano, verificaPiano } from './__fixtures__/pianoRiferimento';

/**
 * Il piano contro un risolutore di riferimento scritto in un altro modo
 * (tutti i livelli del serbatoio, al centilitro), su istanze casuali ma
 * ripetibili. I prezzi sono finti e vicini a quelli veri, con tanti
 * pareggi a 2,190 come nei dati del MIMIT: non dipendono da stations.json.
 *
 * Le istanze stanno «sul reticolo»: consumo intero in km/l, distanze a
 * multipli di un centilitro di strada, serbatoio intero, partenza a
 * multipli di due centilitri. Li il riferimento e esatto.
 */

const PREZZI_COMUNI = [2.19, 2.19, 2.19, 2.199, 2.209, 2.249];

/** Arrotonda dei km a un centilitro di strada. */
const suReticolo = (kml: number) => (km: number) => (Math.round((km * 100) / kml) * kml) / 100;

/** Litri a multipli di due centilitri: meta resta sul reticolo. */
const dueCentilitri = (l: number) => Math.round(l * 50) / 50;

function istanza(r: () => number, n: number): PianoInput {
  const serbatoioL = 35 + Math.round(r() * 35);
  const kml = 10 + Math.floor(r() * 16);
  const km = suReticolo(kml);
  const distanzaKm = km(50 + r() * 1450);
  const riserva = serbatoioL * RISERVA;
  // Una volta su cinque si parte gia in riserva.
  const litriAdesso = dueCentilitri(r() < 0.2 ? r() * riserva : riserva + r() * (serbatoioL - riserva));
  const quante = Math.floor(r() * 11);
  const candidate: TappaCandidata[] = [];
  for (let q = 0; q < quante; q++) {
    // Ogni tanto due pompe nello stesso piazzale.
    const gemella = q > 0 && r() < 0.15;
    const x = gemella ? Math.min(distanzaKm - 0.5, candidate[q - 1]!.kmDaPartenza + r() * 0.4) : r() * distanzaKm;
    const prezzo = r() < 0.35 ? PREZZI_COMUNI[Math.floor(r() * PREZZI_COMUNI.length)]! : Math.round((1.85 + r() * 0.5) * 1000) / 1000;
    candidate.push({
      id: `i${n}-t${q}`,
      nome: '',
      brand: '',
      level: 'normal',
      prezzo,
      kmDaPartenza: km(Math.max(0, x)),
      deviazioneKm: r() < 0.6 ? 0 : km(r() * 2.5),
    });
  }
  const prezzoPartenza = r() < 0.3 ? null : Math.round((1.9 + r() * 0.45) * 1000) / 1000;
  return { distanzaKm, kml, serbatoioL, litriAdesso, candidate, prezzoPartenza };
}

/**
 * Quanto e sicuro un piano, e a parita quanto e buono: piu alto e meglio.
 *  - 0: non ci si arriva; conta fin dove si arriva;
 *  - 1: il ripiego, sotto la riserva oltre la prima sosta o in fondo; conta
 *    il punto piu basso del viaggio;
 *  - 2: solo la prima sosta in riserva, mai sotto il fondo; conta la spesa;
 *  - 3: la riserva a ogni pompa e in fondo; conta la spesa.
 */
function bonta(i: PianoInput, piano: Piano): { classe: number; misura: number } {
  if (!piano.fattibile) return { classe: 0, misura: piano.bloccoAlKm ?? 0 };
  const R = riservaLitri(i);
  const S0 = Math.min(Math.max(0, i.litriAdesso), i.serbatoioL);
  const { arrivi, finale } = ripercorri(i, piano);
  const tol = 1e-6;
  const dopoLaPrima = [...arrivi.slice(1), finale];
  const costo = -valorePiano(i, piano, { fondoPrima: 0, fondo: 0, penali: false });
  if (dopoLaPrima.every((a) => a >= R - tol) && (arrivi.length === 0 || arrivi[0]! >= R - tol)) return { classe: 3, misura: costo };
  if (arrivi.length > 0 && dopoLaPrima.every((a) => a >= R - tol) && arrivi[0]! >= fondoPrimaSosta(S0, R) - tol) {
    return { classe: 2, misura: costo };
  }
  return { classe: 1, misura: Math.min(finale, ...arrivi) };
}

describe('pianificaViaggio: proprieta su istanze casuali', () => {
  it('costa quanto il riferimento, e fattibile quando lo e il riferimento, i conti tornano', () => {
    const r = casuale(20261013);
    let confrontate = 0;
    let inRiserva = 0;
    let ripieghi = 0;
    let peggioreScarto = 0;
    const problemi: string[] = [];

    for (let n = 0; n < 600; n++) {
      const i = istanza(r, n);
      // Ogni tanto una riserva minima, anche zero: il piano non deve
      // comunque mai restare a secco.
      if (n % 25 === 0) i.riservaFrazione = n % 50 === 0 ? 0 : 0.05 / i.serbatoioL;
      const piano = pianificaViaggio(i);
      const rif = pianoDiRiferimento(i);

      const errori = verificaPiano(i, piano, rif.regole);
      if (errori.length > 0) problemi.push(`#${n}: ${errori.join('; ')}`);

      if (piano.fattibile !== rif.fattibile) {
        problemi.push(`#${n}: piano ${piano.fattibile ? 'fattibile' : 'impossibile'}, riferimento no`);
        continue;
      }
      if (!rif.fattibile) continue;
      confrontate++;
      if (piano.arrivoSottoRiserva || piano.sostaInRiserva !== null) inRiserva++;
      if (rif.regole?.penali || (rif.regole === null && piano.arrivoSottoRiserva)) ripieghi++;
      const v = valorePiano(i, piano, rif.regole);
      const scarto = v - rif.valore;
      if (Math.abs(scarto) > Math.abs(peggioreScarto)) peggioreScarto = scarto;
      if (Math.abs(scarto) > 0.01) problemi.push(`#${n}: ${v.toFixed(3)} contro ${rif.valore.toFixed(3)}`);
    }

    expect(problemi).toEqual([]);
    expect(confrontate).toBeGreaterThanOrEqual(400);
    // Le istanze passano anche dalla riserva e dal ripiego, non solo dai casi comodi.
    expect(inRiserva).toBeGreaterThanOrEqual(30);
    expect(ripieghi).toBeGreaterThanOrEqual(5);
    expect(Math.abs(peggioreScarto)).toBeLessThanOrEqual(0.01);
  });

  it('piu carburante alla partenza non da mai un piano meno sicuro, ne a parita uno peggiore', () => {
    // Il difetto di prima: con un decilitro sopra la riserva il piano
    // saltava la pompa sulla strada, o diceva «non ci arrivi».
    const r = casuale(4242);
    const problemi: string[] = [];
    for (let n = 0; n < 80; n++) {
      const i = istanza(r, n);
      let prima: { classe: number; misura: number } | null = null;
      for (let q = 0; q <= 90; q++) {
        const caso = { ...i, litriAdesso: (i.serbatoioL * q) / 90 };
        const b = bonta(caso, pianificaViaggio(caso));
        if (prima) {
          const l = caso.litriAdesso.toFixed(2);
          if (b.classe < prima.classe) problemi.push(`#${n}: con ${l} L classe ${b.classe}, con meno ${prima.classe}`);
          else if (b.classe === prima.classe && b.misura < prima.misura - 0.01) {
            problemi.push(`#${n}: con ${l} L, classe ${b.classe}, ${b.misura.toFixed(3)} contro ${prima.misura.toFixed(3)} con meno`);
          }
        }
        prima = b;
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
    // Serbatoi piccoli: il riferimento prova ogni centilitro, e qui le
    // coppie di pompe sono tante.
    for (let n = 0; n < 120; n++) {
      const serbatoioL = 30 + Math.round(r() * 20);
      const kml = 8 + Math.floor(r() * 21);
      const km = suReticolo(kml);
      const distanzaKm = km(5 + r() * (r() < 0.5 ? 60 : 700));
      const zona = r() < 0.6 ? Math.min(distanzaKm, 3 + r() * 15) : distanzaKm;
      const candidate: TappaCandidata[] = Array.from({ length: 8 + Math.floor(r() * 22) }, (_, q) => ({
        id: `f${n}-${q}`,
        nome: '',
        brand: '',
        level: 'normal',
        prezzo: r() < 0.5 ? 2.19 : Math.round((2.12 + r() * 0.15) * 1000) / 1000,
        kmDaPartenza: km(r() * zona),
        deviazioneKm: km(r() < 0.3 ? r() * 0.1 : r() * 2.5),
      }));
      const riserva = serbatoioL * RISERVA;
      const i: PianoInput = {
        distanzaKm,
        kml,
        serbatoioL,
        litriAdesso: dueCentilitri(r() < 0.4 ? r() * riserva : r() * serbatoioL),
        candidate,
        prezzoPartenza: 2.2,
      };
      const piano = pianificaViaggio(i);
      const rif = pianoDiRiferimento(i);
      if (piano.fattibile !== rif.fattibile) problemi.push(`#${n}: fattibile ${piano.fattibile} contro ${rif.fattibile}`);
      if (!piano.fattibile || !rif.fattibile) continue;
      confrontate++;
      const errori = verificaPiano(i, piano, rif.regole);
      if (errori.length > 0) problemi.push(`#${n}: ${errori.join('; ')}`);
      const scarto = valorePiano(i, piano, rif.regole) - rif.valore;
      if (Math.abs(scarto) > 0.01) problemi.push(`#${n}: ${scarto.toFixed(3)} €`);
    }
    expect(problemi).toEqual([]);
    expect(confrontate).toBeGreaterThan(80);
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

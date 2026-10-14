import {
  COSTO_SOSTA_EUR,
  fondoPrimaSosta,
  LITRI_MINIMI_SOSTA,
  LITRI_SOSTA,
  penaleRiserva,
  riservaLitri,
  STESSO_PUNTO_KM,
  type Piano,
  type PianoInput,
} from '../viaggio';

/** Le regole di un gradino del piano, come in `pianificaViaggio`. */
export interface RegoleRiferimento {
  fondoPrima: number;
  fondo: number;
  penali: boolean;
}

export interface EsitoRiferimento {
  fattibile: boolean;
  /** Il gradino in cui si trova il piano migliore; null senza soste o quando non si arriva. */
  regole: RegoleRiferimento | null;
  /** Il conto del piano migliore con le regole del suo gradino. */
  valore: number;
}

/** Litri in centilitri interi. */
const CL = 100;

/**
 * Un risolutore di riferimento per il piano del viaggio, scritto apposta
 * per i test e in modo diverso da quello vero: niente teoria su quali
 * livelli del serbatoio contano, si provano tutti, al centilitro.
 *
 * E esatto sulle istanze «a reticolo», dove consumi, serbatoio, riserva e
 * partenza sono multipli di un centilitro: li ogni piano possibile ha i
 * livelli sul reticolo, quindi anche il migliore. Su istanze qualsiasi
 * rifiuta di rispondere.
 *
 * I gradini sono gli stessi di `pianificaViaggio`, perche sono la
 * specifica: la riserva a ogni arrivo; la prima sosta col fondo minimo, e
 * mai piu giu dell'arrivo senza soste; il ripiego con le penali, contro il
 * viaggio senza soste. Il conto e il carburante piu COSTO_SOSTA_EUR per
 * sosta, piu le penali nel ripiego. Le regole:
 *  - si arriva alla pompa j con `prima - (dev. di ritorno della sosta
 *    precedente + km fra le due + dev. di andata di j) / kml` litri;
 *  - non si scende sotto il fondo del gradino, mai sotto zero;
 *  - una sosta compra almeno LITRI_SOSTA, o fa il pieno con almeno
 *    LITRI_MINIMI_SOSTA, e non supera il serbatoio;
 *  - due soste di fila non stanno mai entro 0,4 km.
 */
export function pianoDiRiferimento(i: PianoInput): EsitoRiferimento {
  const D = i.distanzaKm;
  const k = i.kml;
  const T = i.serbatoioL;
  const R = riservaLitri(i);
  const S0 = Math.min(Math.max(0, i.litriAdesso), T);
  const intero = (litri: number) => {
    const c = Math.round(litri * CL);
    if (Math.abs(c - litri * CL) > 1e-6) throw new Error(`fuori reticolo: ${litri}`);
    return c;
  };
  const Tn = intero(T);
  const Rn = intero(R);
  const S0n = intero(S0);

  const tappe = i.candidate
    .filter((t) => t.kmDaPartenza >= 0 && t.kmDaPartenza < D && t.prezzo > 0)
    .map((t) => ({ x: t.kmDaPartenza, d: Math.max(0, t.deviazioneKm), p: t.prezzo }))
    .sort((a, b) => a.x - b.x);
  const n = tappe.length;
  /** Centilitri dalla pompa h alla pompa j; −1 la partenza, n l'arrivo. */
  const cl = (h: number, j: number) => {
    const da = h < 0 ? 0 : tappe[h]!.x - tappe[h]!.d;
    const a = j >= n ? D : tappe[j]!.x + tappe[j]!.d;
    return intero((a - da) / k);
  };

  const finaleN = S0n - cl(-1, n);
  if (finaleN >= Rn) return { fattibile: true, regole: null, valore: 0 };
  const senzaSoste = finaleN >= 0 ? penaleRiserva(finaleN / CL, R) : Infinity;

  const risolvi = (g: RegoleRiferimento): number => {
    const fondoPrima = intero(g.fondoPrima);
    const fondo = intero(g.fondo);
    const minimo = intero(LITRI_SOSTA);
    const minimoPieno = intero(LITRI_MINIMI_SOSTA);
    const pen = (c: number) => (g.penali ? penaleRiserva(c / CL, R) : 0);
    const arrivi = tappe.map(() => new Float64Array(Tn + 1).fill(Infinity));
    let migliore = Infinity;
    for (let j = 0; j < n; j++) {
      const t = tappe[j]!;
      const arr = arrivi[j]!;
      const a0 = S0n - cl(-1, j);
      if (a0 >= fondoPrima && a0 >= 0) arr[a0] = Math.min(arr[a0]!, COSTO_SOSTA_EUR + pen(a0));
      // Il conto migliore per ripartire con L centilitri: comprandone almeno
      // il minimo, o col pieno.
      const riparti = new Float64Array(Tn + 1).fill(Infinity);
      let minimoProgressivo = Infinity;
      for (let L = minimo; L <= Tn; L++) {
        const a = L - minimo;
        const v = arr[a]! - (a / CL) * t.p;
        if (v < minimoProgressivo) minimoProgressivo = v;
        riparti[L] = minimoProgressivo + (L / CL) * t.p;
      }
      for (let a = Math.max(0, Tn - minimo + 1); a <= Tn - minimoPieno; a++) {
        riparti[Tn] = Math.min(riparti[Tn]!, arr[a]! + ((Tn - a) / CL) * t.p);
      }
      const cFine = cl(j, n);
      for (let L = Math.max(minimoPieno, cFine + fondo); L <= Tn; L++) {
        const v = riparti[L]! + pen(L - cFine);
        if (v < migliore) migliore = v;
      }
      for (let h = j + 1; h < n; h++) {
        if (tappe[h]!.x - t.x <= STESSO_PUNTO_KM) continue;
        const c = cl(j, h);
        const dopo = arrivi[h]!;
        for (let L = Math.max(minimoPieno, c + fondo, c); L <= Tn; L++) {
          const a = L - c;
          const v = riparti[L]! + COSTO_SOSTA_EUR + pen(a);
          if (v < dopo[a]!) dopo[a] = v;
        }
      }
    }
    return migliore;
  };

  /**
   * Il punto piu basso piu alto possibile, fra tutti i piani con soste: per
   * ogni tappa e livello d'arrivo, il punto piu basso migliore con cui ci si
   * arriva. In centilitri; −1 se con le soste non si arriva.
   */
  const fondoPiuAlto = (): number => {
    const minimo = intero(LITRI_SOSTA);
    const minimoPieno = intero(LITRI_MINIMI_SOSTA);
    const basso = tappe.map(() => new Float64Array(Tn + 1).fill(-1));
    let migliore = -1;
    for (let j = 0; j < n; j++) {
      const arr = basso[j]!;
      const a0 = S0n - cl(-1, j);
      if (a0 >= 0) arr[a0] = Math.max(arr[a0]!, a0);
      const riparti = new Float64Array(Tn + 1).fill(-1);
      let massimo = -1;
      for (let L = minimo; L <= Tn; L++) {
        massimo = Math.max(massimo, arr[L - minimo]!);
        riparti[L] = massimo;
      }
      for (let a = Math.max(0, Tn - minimo + 1); a <= Tn - minimoPieno; a++) riparti[Tn] = Math.max(riparti[Tn]!, arr[a]!);
      const cFine = cl(j, n);
      for (let L = Math.max(0, cFine); L <= Tn; L++) if (riparti[L]! >= 0) migliore = Math.max(migliore, Math.min(riparti[L]!, L - cFine));
      for (let h = j + 1; h < n; h++) {
        if (tappe[h]!.x - tappe[j]!.x <= STESSO_PUNTO_KM) continue;
        const c = cl(j, h);
        const dopo = basso[h]!;
        for (let L = Math.max(0, c); L <= Tn; L++) {
          if (riparti[L]! < 0) continue;
          const v = Math.min(riparti[L]!, L - c);
          if (v > dopo[L - c]!) dopo[L - c] = v;
        }
      }
    }
    return migliore;
  };

  const fondoPrima = fondoPrimaSosta(S0, R);
  const gradini: RegoleRiferimento[] = [];
  if (S0n >= Rn) gradini.push({ fondoPrima: R, fondo: R, penali: false });
  // Alla prima sosta, nel secondo gradino, mai piu giu di dove si arriva senza soste.
  if (intero(fondoPrima) < Rn) gradini.push({ fondoPrima: finaleN >= 0 ? Math.max(fondoPrima, finaleN / CL) : fondoPrima, fondo: R, penali: false });
  for (const g of gradini) {
    const v = risolvi(g);
    if (v < Infinity) return { fattibile: true, regole: g, valore: v };
  }
  // Il ripiego: il fondo piu alto che un piano con soste tiene a ogni
  // arrivo, al centilitro; senza soste solo se arriva con di piu.
  const basso = fondoPiuAlto();
  if (finaleN >= 0 && finaleN > basso) return { fattibile: true, regole: null, valore: senzaSoste };
  if (basso >= 0) {
    const ripiego: RegoleRiferimento = { fondoPrima: basso / CL, fondo: basso / CL, penali: true };
    return { fattibile: true, regole: ripiego, valore: risolvi(ripiego) };
  }
  return { fattibile: false, regole: null, valore: Infinity };
}

/** Rifa il viaggio di un piano sosta per sosta: i litri a ogni arrivo e in fondo. */
export function ripercorri(i: PianoInput, piano: Piano): { arrivi: number[]; finale: number } {
  const k = i.kml;
  let livello = Math.min(Math.max(0, i.litriAdesso), i.serbatoioL);
  let pos = 0;
  let devPrima = 0;
  const arrivi: number[] = [];
  for (const s of piano.soste) {
    const t = s.tappa;
    const arrivo = livello - (devPrima + t.kmDaPartenza - pos + t.deviazioneKm) / k;
    arrivi.push(arrivo);
    livello = arrivo + s.litri;
    pos = t.kmDaPartenza;
    devPrima = t.deviazioneKm;
  }
  return { arrivi, finale: livello - (devPrima + i.distanzaKm - pos) / k };
}

/**
 * Il conto di un piano rifatto da capo con le regole di un gradino:
 * carburante e soste, piu le penali nel ripiego. Senza soste, con le
 * regole nulle, zero; Infinity se il piano non arriva.
 */
export function valorePiano(i: PianoInput, piano: Piano, regole: RegoleRiferimento | null): number {
  if (!piano.fattibile) return Infinity;
  const R = riservaLitri(i);
  const { arrivi, finale } = ripercorri(i, piano);
  const penali = regole === null ? piano.soste.length === 0 && finale < R - 1e-6 : regole.penali;
  let valore = penali ? penaleRiserva(finale, R) : 0;
  piano.soste.forEach((s, n) => {
    valore += s.litri * s.tappa.prezzo + COSTO_SOSTA_EUR + (penali ? penaleRiserva(arrivi[n]!, R) : 0);
  });
  return valore;
}

/**
 * Rifa i conti di un piano da capo, sosta per sosta, e dice cosa non torna.
 * Serve a non fidarsi dei numeri che il piano racconta di se. Con le
 * regole di un gradino controlla anche fondi e acquisti minimi.
 */
export function verificaPiano(i: PianoInput, piano: Piano, regole: RegoleRiferimento | null = null): string[] {
  const errori: string[] = [];
  if (!piano.fattibile) return errori;
  const k = i.kml;
  const T = i.serbatoioL;
  const R = riservaLitri(i);
  const eps = 1e-6;
  const ids = new Set(i.candidate.map((t) => t.id));
  const { arrivi, finale } = ripercorri(i, piano);

  let pos = 0;
  let spesa = 0;
  let litri = 0;
  let kmDev = 0;
  piano.soste.forEach((s, n) => {
    const t = s.tappa;
    const arrivo = arrivi[n]!;
    if (!ids.has(t.id)) errori.push(`sosta ${n}: impianto sconosciuto`);
    if (t.kmDaPartenza < pos - eps) errori.push(`sosta ${n}: torna indietro`);
    if (n > 0 && t.kmDaPartenza - pos <= STESSO_PUNTO_KM) errori.push(`sosta ${n}: due soste nello stesso posto`);
    if (arrivo < -eps) errori.push(`sosta ${n}: arriva alla pompa con ${arrivo.toFixed(3)} L, a secco`);
    const fondo = regole ? (n === 0 ? regole.fondoPrima : regole.fondo) : 0;
    if (arrivo < fondo - eps) errori.push(`sosta ${n}: arriva con ${arrivo.toFixed(3)} L, sotto il fondo ${fondo.toFixed(3)}`);
    const dopo = arrivo + s.litri;
    const pieno = dopo >= T - eps;
    if (!(s.litri >= (pieno ? LITRI_MINIMI_SOSTA : LITRI_SOSTA) - eps)) errori.push(`sosta ${n}: ${s.litri.toFixed(3)} L senza fare il pieno`);
    if (dopo > T + eps) errori.push(`sosta ${n}: ${dopo.toFixed(3)} L in un serbatoio da ${T}`);
    if (Math.abs(dopo - s.litriDopo) > eps) errori.push(`sosta ${n}: litriDopo ${s.litriDopo} invece di ${dopo}`);
    if (Math.abs(s.spesa - s.litri * t.prezzo) > eps) errori.push(`sosta ${n}: spesa sbagliata`);
    spesa += s.litri * t.prezzo;
    litri += s.litri;
    kmDev += 2 * t.deviazioneKm;
    pos = t.kmDaPartenza;
  });
  if (finale < -eps) errori.push(`resta a secco prima dell'arrivo: ${finale.toFixed(3)} L`);
  if (regole && finale < regole.fondo - eps) errori.push(`arriva con ${finale.toFixed(3)} L, sotto il fondo ${regole.fondo}`);
  if (Math.abs(Math.max(0, finale) - piano.litriAllArrivo) > eps) errori.push(`litriAllArrivo ${piano.litriAllArrivo} invece di ${finale}`);
  const sotto = 0.001 / k;
  if (piano.arrivoSottoRiserva !== finale < R - sotto) errori.push(`arrivoSottoRiserva ${piano.arrivoSottoRiserva} con ${finale.toFixed(3)} L`);
  const prima = arrivi.findIndex((a) => a < R - sotto);
  if (piano.sostaInRiserva !== (prima >= 0 ? prima + 1 : null)) errori.push(`sostaInRiserva ${piano.sostaInRiserva} invece di ${prima + 1}`);
  if (Math.abs(spesa - piano.spesaCarburante) > eps) errori.push('spesaCarburante non e la somma delle soste');
  if (Math.abs(litri - piano.litriComprati) > eps) errori.push('litriComprati non e la somma delle soste');
  if (Math.abs(kmDev - piano.kmDeviazione) > eps) errori.push('kmDeviazione sbagliati');
  return errori;
}

/** Numeri casuali ripetibili (mulberry32): stesso seme, stesse istanze. */
export function casuale(seme: number): () => number {
  let a = seme >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

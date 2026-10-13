import { RISERVA, type Piano, type PianoInput } from '../viaggio';

/**
 * Un risolutore di riferimento per il piano del viaggio, scritto apposta
 * per i test e in modo diverso da quello vero: niente teoria su quali
 * livelli del serbatoio contano, solo una griglia fine.
 *
 * Il modello e lo stesso di `pianificaViaggio`:
 *  - si arriva alla pompa j con `prima - (dev. di ritorno della sosta
 *    precedente + km fra le due + dev. di andata di j) / kml` litri;
 *  - alla pompa non si scende sotto la riserva (alla prima sosta sotto lo
 *    zero, se si parte gia in riserva);
 *  - dopo aver comprato non si supera il serbatoio;
 *  - si arriva in fondo con almeno la riserva;
 *  - due soste di fila non stanno mai entro 0,4 km.
 *
 * Dopo ogni acquisto il livello sta su una griglia di `passo` litri (piu
 * il pieno esatto); l'ultimo acquisto, quello che porta all'arrivo, e
 * esatto. Quindi ogni piano che trova e fattibile davvero, e il suo costo
 * supera l'ottimo vero al piu di qualche centesimo: un tetto onesto.
 */
export function pianoDiRiferimento(i: PianoInput, passo = 0.05): { fattibile: boolean; costo: number } {
  const D = i.distanzaKm;
  const k = i.kml;
  const T = i.serbatoioL;
  const R = T * (i.riservaFrazione ?? RISERVA);
  const S0 = Math.min(Math.max(0, i.litriAdesso), T);
  const eps = 0.001 / k;
  const fondoIniziale = S0 > R ? R : 0;

  // Stesse regole di ammissione: sulla strada e con un prezzo vero.
  const tappe = i.candidate
    .filter((t) => t.kmDaPartenza >= 0 && t.kmDaPartenza < D && t.prezzo > 0)
    .map((t) => ({ x: t.kmDaPartenza, d: Math.max(0, t.deviazioneKm), p: t.prezzo }))
    .sort((a, b) => a.x - b.x);

  let migliore = S0 - D / k >= R - eps ? 0 : Infinity;

  // Per ogni sosta: i livelli dopo l'acquisto (griglia + pieno) col costo minimo.
  const livelli: Array<{ dopo: number[]; costo: number[] }> = [];
  const griglia: number[] = [];
  for (let l = 0; l < T - 1e-9; l += passo) griglia.push(l);
  griglia.push(T);

  for (let j = 0; j < tappe.length; j++) {
    const t = tappe[j]!;
    // Tutti i modi di arrivare alla pompa j: livello all'arrivo e costo.
    const arrivi: Array<{ a: number; c: number }> = [];
    const a0 = S0 - (t.x + t.d) / k;
    if (a0 >= fondoIniziale - eps) arrivi.push({ a: a0, c: 0 });
    for (let h = 0; h < j; h++) {
      const q = tappe[h]!;
      // Due pompe entro 0,4 km sono lo stesso posto: mai due soste li.
      if (t.x - q.x <= 0.4) continue;
      const consumo = (q.d + t.x - q.x + t.d) / k;
      const st = livelli[h]!;
      for (let s = 0; s < st.dopo.length; s++) {
        const a = st.dopo[s]! - consumo;
        if (a >= R - eps) arrivi.push({ a, c: st.costo[s]! });
      }
    }
    if (arrivi.length === 0) {
      livelli.push({ dopo: [], costo: [] });
      continue;
    }

    // L'ultimo acquisto, esatto: quanto basta per arrivare con la riserva.
    const finale = (t.d + D - t.x) / k + R;
    if (finale <= T + eps) {
      for (const { a, c } of arrivi) {
        const costo = c + Math.max(0, finale - a) * t.p;
        if (costo < migliore) migliore = costo;
      }
    }

    // Gli altri acquisti: si riparte con un livello della griglia.
    arrivi.sort((u, v) => u.a - v.a);
    const dopo: number[] = [];
    const costo: number[] = [];
    let ptr = 0;
    let minimo = Infinity;
    for (const l of griglia) {
      while (ptr < arrivi.length && arrivi[ptr]!.a <= l + 1e-12) {
        const v = arrivi[ptr]!.c - arrivi[ptr]!.a * t.p;
        if (v < minimo) minimo = v;
        ptr++;
      }
      if (minimo < Infinity) {
        dopo.push(l);
        costo.push(minimo + l * t.p);
      }
    }
    livelli.push({ dopo, costo });
  }

  return { fattibile: Number.isFinite(migliore), costo: migliore };
}

/**
 * Rifa i conti di un piano da capo, sosta per sosta, e dice cosa non torna.
 * Serve a non fidarsi dei numeri che il piano racconta di se.
 */
export function verificaPiano(i: PianoInput, piano: Piano, tolleranzaRiservaL: number): string[] {
  const errori: string[] = [];
  if (!piano.fattibile) return errori;
  const D = i.distanzaKm;
  const k = i.kml;
  const T = i.serbatoioL;
  const R = T * (i.riservaFrazione ?? RISERVA);
  const S0 = Math.min(Math.max(0, i.litriAdesso), T);
  const eps = 1e-6;
  const ids = new Set(i.candidate.map((t) => t.id));

  let livello = S0;
  let pos = 0;
  let devPrima = 0;
  let spesa = 0;
  let litri = 0;
  let kmDev = 0;
  piano.soste.forEach((s, n) => {
    const t = s.tappa;
    if (!ids.has(t.id)) errori.push(`sosta ${n}: impianto sconosciuto`);
    if (t.kmDaPartenza < pos - eps) errori.push(`sosta ${n}: torna indietro`);
    if (n > 0 && t.kmDaPartenza - pos <= 0.4) errori.push(`sosta ${n}: due soste nello stesso posto`);
    const arrivo = livello - (devPrima + t.kmDaPartenza - pos + t.deviazioneKm) / k;
    const fondo = n === 0 && S0 <= R ? 0 : R - tolleranzaRiservaL;
    if (arrivo < fondo - eps) errori.push(`sosta ${n}: arriva alla pompa con ${arrivo.toFixed(3)} L, sotto ${fondo.toFixed(3)}`);
    if (!(s.litri >= 0.1 - eps)) errori.push(`sosta ${n}: ${s.litri.toFixed(3)} L`);
    livello = arrivo + s.litri;
    if (livello > T + eps) errori.push(`sosta ${n}: ${livello.toFixed(3)} L in un serbatoio da ${T}`);
    if (Math.abs(livello - s.litriDopo) > 1e-6) errori.push(`sosta ${n}: litriDopo ${s.litriDopo} invece di ${livello}`);
    if (Math.abs(s.spesa - s.litri * t.prezzo) > 1e-6) errori.push(`sosta ${n}: spesa sbagliata`);
    spesa += s.litri * t.prezzo;
    litri += s.litri;
    kmDev += 2 * t.deviazioneKm;
    pos = t.kmDaPartenza;
    devPrima = t.deviazioneKm;
  });
  const arrivo = livello - (devPrima + D - pos) / k;
  if (!piano.arrivoSottoRiserva && arrivo < R - tolleranzaRiservaL - eps) errori.push(`arriva con ${arrivo.toFixed(3)} L, sotto la riserva`);
  if (arrivo < -eps) errori.push(`resta a secco prima dell'arrivo`);
  if (Math.abs(arrivo - piano.litriAllArrivo) > 1e-6) errori.push(`litriAllArrivo ${piano.litriAllArrivo} invece di ${arrivo}`);
  if (Math.abs(spesa - piano.spesaCarburante) > 1e-6) errori.push('spesaCarburante non e la somma delle soste');
  if (Math.abs(litri - piano.litriComprati) > 1e-6) errori.push('litriComprati non e la somma delle soste');
  if (Math.abs(kmDev - piano.kmDeviazione) > 1e-6) errori.push('kmDeviazione sbagliati');
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

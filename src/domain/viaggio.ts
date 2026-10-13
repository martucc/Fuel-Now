import type { PriceLevel } from './pricing';

/**
 * Dove fermarsi lungo la strada, e quanto metterci.
 *
 * E il problema classico del rifornimento: un serbatoio, una fila di
 * distributori a prezzi diversi, e arrivare spendendo il meno possibile.
 * Fino alla 2.0 lo risolveva una regola golosa che guardava solo fin dove
 * si arrivava col carburante del momento: su 327 viaggi di prova costava
 * piu del minimo di oltre 50 centesimi una volta su tre (fino a 14 €), e
 * a volte faceva deviare per una sosta da zero litri.
 *
 * Qui il piano e quello a costo minimo, esatto. Lo rende veloce un fatto
 * noto (Khuller, Malekian e Mestre, «To fill or not to fill»): in un piano
 * ottimo, a ogni sosta o si fa il pieno, o si mette giusto quanto basta per
 * arrivare alla sosta dopo, o in fondo, con la riserva. Quindi arrivando a
 * una pompa nel serbatoio ci possono essere solo pochi livelli: la
 * riserva, quello con cui si e partiti meno la strada fatta, o un pieno
 * fatto a una pompa precedente meno la strada da li. Su questi livelli la
 * programmazione dinamica trova l'ottimo in O(n² log n): trecento
 * distributori su 1.400 km in pochi millisecondi.
 *
 * Le regole del conto:
 *  - a ogni pompa si arriva con almeno la riserva; chi parte gia in
 *    riserva puo usare tutto quello che ha per arrivare alla prima;
 *  - fermarsi costa la deviazione, andata e ritorno: quei litri si
 *    bruciano davvero e si pagano con quello che si compra;
 *  - dopo aver comprato non si supera il serbatoio;
 *  - si arriva in fondo con la riserva;
 *  - due soste di fila non stanno mai entro 0,4 km: e lo stesso posto;
 *  - una sosta mette almeno un decilitro, mai zero litri;
 *  - a parita di costo vince il piano con meno soste.
 */

export interface TappaCandidata {
  id: string;
  nome: string;
  brand: string;
  /** Prezzo al litro del carburante scelto. */
  prezzo: number;
  level: PriceLevel;
  /** Quanti km dalla partenza, misurati lungo il percorso. */
  kmDaPartenza: number;
  /** Quanto ci si allontana dal percorso per raggiungerlo, sola andata. */
  deviazioneKm: number;
}

export interface PianoInput {
  distanzaKm: number;
  /** Chilometri per litro. Per il metano km al chilo: la formula regge. */
  kml: number;
  serbatoioL: number;
  /** Quanto carburante c'e adesso nel serbatoio. */
  litriAdesso: number;
  /** Quanto non si vuole mai scendere sotto, in frazione di serbatoio. */
  riservaFrazione?: number;
  /** I distributori lungo la strada, in qualunque ordine. */
  candidate: TappaCandidata[];
  /**
   * Prezzo a cui si farebbe il pieno prima di partire. Serve solo al
   * confronto: il piano non ne ha bisogno per scegliere.
   */
  prezzoPartenza?: number | null;
}

export interface Sosta {
  tappa: TappaCandidata;
  /** Litri da mettere qui. Mai meno di LITRI_MINIMI_SOSTA. */
  litri: number;
  spesa: number;
  /** Con quanti litri si riparte dalla pompa. */
  litriDopo: number;
  /** Km che restano da fare dopo questa sosta. */
  kmRimanenti: number;
  /** true quando qui si fa il pieno, false quando si mette solo il necessario. */
  pieno: boolean;
}

export type MotivoImpossibile = 'senza-percorso' | 'senza-consumo' | 'buco-troppo-lungo';

export interface Piano {
  fattibile: boolean;
  motivo?: MotivoImpossibile;
  /** Il punto in cui il piano si arena, per poterlo dire all'utente. */
  bloccoAlKm?: number;
  /**
   * Le soste. Quando il piano non e fattibile sono quelle che portano piu
   * avanti possibile, fino al tratto scoperto.
   */
  soste: Sosta[];
  litriComprati: number;
  spesaCarburante: number;
  /** Chilometri in piu fatti solo per raggiungere i distributori. */
  kmDeviazione: number;
  /** Litri bruciati per quelle deviazioni, gia dentro spesaCarburante. */
  litriDeviazione: number;
  /** Litri stimati nel serbatoio all'arrivo. */
  litriAllArrivo: number;
  /**
   * true quando si arriva, ma sotto la riserva: lungo la strada non c'e un
   * distributore che permetta di tenerla, e il carburante basta lo stesso.
   */
  arrivoSottoRiserva: boolean;
  /**
   * Cosa costerebbe mettere tutto prima di partire, al prezzo di partenza,
   * e arrivare con la stessa riserva del piano. Null quando il confronto
   * non regge: prezzo di partenza ignoto, niente da comprare, o un pieno
   * che nel serbatoio non entra.
   */
  spesaPienoPrima: number | null;
  /** Quanto si risparmia col piano invece che col pieno prima. Puo essere negativo. */
  risparmioEur: number | null;
}

/** Sotto questa frazione di serbatoio non ci si vuole trovare mai. */
export const RISERVA = 0.12;
/** Due distributori entro questo raggio sono lo stesso posto: mai due soste di fila li. */
export const STESSO_PUNTO_KM = 0.4;
/**
 * Sotto un decilitro non e una sosta. Se per tenere la riserva al litro
 * bisognerebbe fermarsi a mettere meno di cosi, si arriva con quel poco in
 * meno: la riserva tiene lo stesso, a un decilitro.
 */
export const LITRI_MINIMI_SOSTA = 0.1;
/**
 * Un metro di tolleranza sulle distanze.
 *
 * Senza, un piano che arriva esatto viene dichiarato impossibile: 440/15
 * moltiplicato per 15 fa 439,99999999999994, e il confronto con 500 dice
 * che mancano sei micrometri. Un metro e sotto qualunque errore vero di
 * un percorso stradale.
 */
const TOLLERANZA_KM = 0.001;
/**
 * Un decimo di centesimo per sosta: a parita di costo vince il piano con
 * meno soste, e nessun conto vero si sposta.
 */
const PENALITA_SOSTA = 0.001;
/** Sotto questa quantita un acquisto e un arrotondamento, non un acquisto. */
const ZERO_LITRI = 1e-9;

/**
 * Autonomia in km. Sopra la riserva se ne tiene da parte; sotto la riserva
 * si usa quello che c'e, perche chi e gia in riserva non ha la scelta di
 * restare fermo — deve arrivare al primo distributore utile.
 */
function autonomia(litri: number, riservaL: number, kml: number): number {
  const utile = litri > riservaL ? litri - riservaL : litri;
  return Math.max(0, utile) * kml;
}

/** Solo le tappe che stanno davvero sulla strada, in ordine di percorrenza. */
function tappeSullaStrada(candidate: readonly TappaCandidata[], distanzaKm: number): TappaCandidata[] {
  return candidate
    .filter(
      (t) =>
        Number.isFinite(t.kmDaPartenza) &&
        t.kmDaPartenza >= 0 &&
        t.kmDaPartenza < distanzaKm &&
        Number.isFinite(t.prezzo) &&
        t.prezzo > 0,
    )
    .map((t) => (t.deviazioneKm >= 0 ? t : { ...t, deviazioneKm: 0 }))
    .sort((a, b) => a.kmDaPartenza - b.kmDaPartenza);
}

/** Un modo di trovarsi alla pompa di una tappa, prima di comprare. */
interface Stato {
  /** Quale tappa, come indice nell'ordine dei km. */
  tappa: number;
  /** Litri all'arrivo alla pompa. */
  litri: number;
  /** Euro spesi fin qui, piu la penalita delle soste. */
  valore: number;
  /** Lo stato alla sosta prima; null se questa e la prima sosta. */
  prima: Stato | null;
}

/**
 * Gli stati utili di una tappa, in ordine di litri. Arrivare con a litri e
 * ripartire con L costa valore + (L − a) × prezzo: per ogni L il migliore e
 * quello col minimo di (valore − a × prezzo) fra gli stati che arrivano con
 * meno di L. Restano solo gli stati che abbassano quel minimo: gli altri
 * non sarebbero mai la risposta.
 */
interface Indice {
  litri: Float64Array;
  /** valore − litri × prezzo, strettamente decrescente. */
  minimo: Float64Array;
  stato: Stato[];
}

/**
 * La posizione del modo piu economico di ripartire con `livello` litri, o
 * −1. Contano solo gli stati che arrivano con meno: chi ha gia abbastanza
 * non comprerebbe niente, e una sosta da zero litri non e una sosta.
 */
function ripartiCon(ind: Indice, livello: number): number {
  let lo = 0;
  let hi = ind.litri.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ind.litri[mid]! < livello - ZERO_LITRI) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1;
}

/** Le tappe di una catena di stati, dalla prima all'ultima. */
function catena(ultimo: Stato): Stato[] {
  const out: Stato[] = [];
  for (let s: Stato | null = ultimo; s; s = s.prima) out.push(s);
  return out.reverse();
}

/** Il piano di rifornimento a costo minimo. */
export function pianificaViaggio(i: PianoInput): Piano {
  const vuoto: Piano = {
    fattibile: false,
    soste: [],
    litriComprati: 0,
    spesaCarburante: 0,
    kmDeviazione: 0,
    litriDeviazione: 0,
    litriAllArrivo: 0,
    arrivoSottoRiserva: false,
    spesaPienoPrima: null,
    risparmioEur: null,
  };

  if (!(i.distanzaKm > 0)) return { ...vuoto, motivo: 'senza-percorso' };
  if (!(i.kml > 0) || !(i.serbatoioL > 0)) return { ...vuoto, motivo: 'senza-consumo' };

  const D = i.distanzaKm;
  const kml = i.kml;
  const T = i.serbatoioL;
  const R = T * (i.riservaFrazione ?? RISERVA);
  const S0 = Number.isFinite(i.litriAdesso) ? Math.min(Math.max(0, i.litriAdesso), T) : 0;
  const eps = TOLLERANZA_KM / kml;
  /** Chi parte gia in riserva puo arrivare alla prima pompa anche a secco. */
  const fondoIniziale = S0 > R ? R : 0;
  /** I km che si fanno con un pieno senza toccare la riserva. */
  const raggioPienoKm = (T - R) * kml;

  const tappe = tappeSullaStrada(i.candidate, D);
  const n = tappe.length;
  const km = tappe.map((t) => t.kmDaPartenza);
  const dev = tappe.map((t) => t.deviazioneKm);
  const prezzo = tappe.map((t) => t.prezzo);

  /**
   * Litri dalla pompa h alla pompa j: ritorno sulla strada da h, strada fra
   * le due, uscita verso j. h = −1 e la partenza, j = n l'arrivo.
   */
  const consumo = (h: number, j: number): number => {
    const da = h < 0 ? 0 : km[h]! - dev[h]!;
    const a = j >= n ? D : km[j]! + dev[j]!;
    return (a - da) / kml;
  };

  /**
   * Dal piano fatto di tappe e livelli di ripartenza alle soste vere.
   *
   * Se una sosta comprerebbe meno di un decilitro (succede quando un pieno
   * precedente arriva per un soffio sotto il necessario) la si toglie, e la
   * differenza la mette chi viene dopo; se senza di lei la riserva non
   * terrebbe nemmeno al decilitro, ci si mette un decilitro.
   */
  const realizza = (sequenza: number[], ripartenze: number[], fino: 'arrivo' | 'blocco') => {
    let seq = sequenza.slice();
    let rip = ripartenze.slice();
    /** Le tappe dove si mette un decilitro perche senza la riserva non terrebbe. */
    const unDecilitro = new Set<number>();

    const simula = (s: number[], r: number[]) => {
      const arrivi: number[] = [];
      const dopo: number[] = [];
      let livello = S0;
      let ok = true;
      for (let t = 0; t < s.length; t++) {
        const arrivo = livello - consumo(t === 0 ? -1 : s[t - 1]!, s[t]!);
        const fondo = t === 0 ? Math.min(fondoIniziale, R - LITRI_MINIMI_SOSTA) : R - LITRI_MINIMI_SOSTA;
        if (arrivo < fondo - eps) ok = false;
        livello = Math.max(r[t]!, arrivo);
        if (unDecilitro.has(s[t]!)) livello = Math.min(T, Math.max(livello, arrivo + LITRI_MINIMI_SOSTA));
        arrivi.push(arrivo);
        dopo.push(livello);
      }
      const finale = livello - consumo(s.length > 0 ? s[s.length - 1]! : -1, n);
      if (fino === 'arrivo' && finale < R - LITRI_MINIMI_SOSTA - eps) ok = false;
      return { arrivi, dopo, finale, ok };
    };

    for (let giro = 0; giro <= 2 * sequenza.length; giro++) {
      const r = simula(seq, rip);
      const t = r.dopo.findIndex((l, q) => l - r.arrivi[q]! < LITRI_MINIMI_SOSTA - ZERO_LITRI && !unDecilitro.has(seq[q]!));
      if (t < 0) break;
      const senzaSeq = seq.filter((_, q) => q !== t);
      const senzaRip = rip.filter((_, q) => q !== t);
      if (simula(senzaSeq, senzaRip).ok) {
        seq = senzaSeq;
        rip = senzaRip;
      } else {
        unDecilitro.add(seq[t]!);
      }
    }

    const r = simula(seq, rip);
    const soste: Sosta[] = seq.map((j, t) => {
      const litri = r.dopo[t]! - r.arrivi[t]!;
      return {
        tappa: tappe[j]!,
        litri,
        spesa: litri * prezzo[j]!,
        litriDopo: r.dopo[t]!,
        kmRimanenti: D - km[j]!,
        pieno: r.dopo[t]! >= T - 0.01,
      };
    });
    return { soste, litriAllArrivo: r.finale };
  };

  const componi = (soste: Sosta[], litriAllArrivo: number, arrivoSottoRiserva: boolean): Piano => {
    let litriComprati = 0;
    let spesaCarburante = 0;
    let kmDeviazione = 0;
    for (const s of soste) {
      litriComprati += s.litri;
      spesaCarburante += s.spesa;
      kmDeviazione += 2 * s.tappa.deviazioneKm;
    }

    // Il confronto col pieno prima di partire, fatto in modo che sia un
    // confronto: stessa partenza, stesso arrivo, stessa riserva in fondo.
    // Regge solo se il piano deve comprare qualcosa, se si arriva con la
    // riserva e se quei litri nel serbatoio entrano davvero: da mettere
    // contro spazio libero, non contro il serbatoio intero.
    const daMettere = D / kml + R - S0;
    const prezzoPartenza = i.prezzoPartenza ?? null;
    const spesaPienoPrima =
      prezzoPartenza !== null &&
      prezzoPartenza > 0 &&
      soste.length > 0 &&
      !arrivoSottoRiserva &&
      daMettere <= T - S0 + eps
        ? daMettere * prezzoPartenza
        : null;

    return {
      fattibile: true,
      soste,
      litriComprati,
      spesaCarburante,
      kmDeviazione,
      litriDeviazione: kmDeviazione / kml,
      litriAllArrivo: Math.max(0, litriAllArrivo),
      arrivoSottoRiserva,
      spesaPienoPrima,
      risparmioEur: spesaPienoPrima === null ? null : spesaPienoPrima - spesaCarburante,
    };
  };

  // Se il carburante che c'e basta, con la riserva, non ci si ferma: zero
  // euro e zero soste non si battono.
  if (S0 - D / kml >= R - LITRI_MINIMI_SOSTA - eps) return componi([], S0 - D / kml, false);

  // La programmazione dinamica, tappa per tappa in ordine di km.
  const indici: Array<Indice | null> = new Array<Indice | null>(n).fill(null);
  // Ripartire da h col pieno costa lo stesso qualunque sia la tappa dopo:
  // si calcola una volta per tappa, non una per coppia.
  const costoPieno = new Float64Array(n).fill(Infinity);
  const statoPieno: Array<Stato | null> = new Array<Stato | null>(n).fill(null);
  let fine: { valore: number; stato: Stato; ripartenza: number } | null = null;

  // I modi di arrivare alla tappa j, in array riusati da una tappa all'altra.
  const candLitri = new Float64Array(n + 2);
  const candValore = new Float64Array(n + 2);
  const candPrima: Array<Stato | null> = new Array<Stato | null>(n + 2).fill(null);
  const ordine = new Int32Array(n + 2);
  let primaUtile = 0;

  for (let j = 0; j < n; j++) {
    let m = 0;

    // Dritti dalla partenza, senza soste prima.
    const daCasa = S0 - consumo(-1, j);
    if (daCasa >= fondoIniziale - eps) {
      candLitri[m] = daCasa;
      candValore[m] = PENALITA_SOSTA;
      candPrima[m] = null;
      m++;
    }

    // Da una sosta precedente: col pieno, o con quanto basta per arrivare
    // qui con la riserva. Il secondo modo da sempre lo stesso livello,
    // quindi ne resta solo il migliore. Oltre un pieno di strada non si
    // guarda nemmeno.
    while (km[j]! - km[primaUtile]! > raggioPienoKm + TOLLERANZA_KM) primaUtile++;
    let giustoValore = Infinity;
    let giustoLitri = 0;
    let giustoPrima: Stato | null = null;
    for (let h = primaUtile; h < j; h++) {
      const ind = indici[h];
      if (!ind || km[j]! - km[h]! <= STESSO_PUNTO_KM) continue;
      const c = consumo(h, j);
      if (c > T - R + eps) continue;

      if (statoPieno[h]) {
        candLitri[m] = T - c;
        candValore[m] = costoPieno[h]! + PENALITA_SOSTA;
        candPrima[m] = statoPieno[h]!;
        m++;
      }
      const bersaglio = Math.min(T, c + R);
      const q = ripartiCon(ind, bersaglio);
      if (q >= 0) {
        const valore = ind.minimo[q]! + bersaglio * prezzo[h]! + PENALITA_SOSTA;
        if (valore < giustoValore) {
          giustoValore = valore;
          giustoLitri = bersaglio - c;
          giustoPrima = ind.stato[q]!;
        }
      }
    }
    if (giustoPrima) {
      candLitri[m] = giustoLitri;
      candValore[m] = giustoValore;
      candPrima[m] = giustoPrima;
      m++;
    }
    if (m === 0) continue;

    // In ordine di litri. Scorrendo le tappe per km i pieni arrivano quasi
    // gia in ordine: l'ordinamento per inserzione fa pochi scambi.
    for (let q = 0; q < m; q++) {
      const o = q;
      let r = q - 1;
      while (r >= 0 && candLitri[ordine[r]!]! > candLitri[o]!) {
        ordine[r + 1] = ordine[r]!;
        r--;
      }
      ordine[r + 1] = o;
    }

    // Restano solo gli stati che abbassano il minimo progressivo.
    const p = prezzo[j]!;
    const litri: number[] = [];
    const minimo: number[] = [];
    const stato: Stato[] = [];
    let min = Infinity;
    for (let q = 0; q < m; q++) {
      const o = ordine[q]!;
      const v = candValore[o]! - candLitri[o]! * p;
      if (v < min) {
        min = v;
        litri.push(candLitri[o]!);
        minimo.push(v);
        stato.push({ tappa: j, litri: candLitri[o]!, valore: candValore[o]!, prima: candPrima[o] ?? null });
      }
    }
    const ind: Indice = { litri: Float64Array.from(litri), minimo: Float64Array.from(minimo), stato };
    indici[j] = ind;

    const qPieno = ripartiCon(ind, T);
    if (qPieno >= 0) {
      costoPieno[j] = ind.minimo[qPieno]! + T * p;
      statoPieno[j] = ind.stato[qPieno]!;
    }

    // Da qui all'arrivo, mettendo quanto basta per arrivare con la riserva.
    const c = consumo(j, n);
    if (c <= T - R + eps) {
      const bersaglio = Math.min(T, c + R);
      const q = ripartiCon(ind, bersaglio);
      if (q >= 0) {
        const valore = ind.minimo[q]! + bersaglio * p;
        if (!fine || valore < fine.valore) fine = { valore, stato: ind.stato[q]!, ripartenza: bersaglio };
      }
    }
  }

  if (fine) {
    const stati = catena(fine.stato);
    const sequenza = stati.map((s) => s.tappa);
    // Si riparte da ogni sosta col livello che serve per arrivare alla
    // successiva con quanto lo stato di quella dice: e il pieno, o il giusto.
    const ripartenze = stati.map((s, t) => {
      const dopo = stati[t + 1];
      return dopo ? dopo.litri + consumo(s.tappa, dopo.tappa) : fine.ripartenza;
    });
    const { soste, litriAllArrivo } = realizza(sequenza, ripartenze, 'arrivo');
    return componi(soste, litriAllArrivo, false);
  }

  // Tenendo la riserva non si arriva. Se il carburante basta comunque, ci
  // si arriva in riserva: e meglio dirlo che dire «non ci arrivi».
  if (S0 - D / kml >= -eps) return componi([], S0 - D / kml, true);

  // Non si arriva: il punto piu lontano che si raggiunge, col pieno
  // all'ultima pompa raggiungibile, e le soste per arrivarci.
  let bloccoAlKm = autonomia(S0, R, kml);
  let ultima = -1;
  for (let j = 0; j < n; j++) {
    if (!indici[j]) continue;
    const finoA = km[j]! - dev[j]! + raggioPienoKm;
    if (finoA > bloccoAlKm) {
      bloccoAlKm = finoA;
      ultima = j;
    }
  }
  let soste: Sosta[] = [];
  if (ultima >= 0) {
    const ultimo = statoPieno[ultima] ?? indici[ultima]!.stato[0]!;
    const stati = catena(ultimo);
    const ripartenze = stati.map((s, t) => {
      const dopo = stati[t + 1];
      return dopo ? dopo.litri + consumo(s.tappa, dopo.tappa) : T;
    });
    soste = realizza(
      stati.map((s) => s.tappa),
      ripartenze,
      'blocco',
    ).soste;
  }
  return { ...vuoto, motivo: 'buco-troppo-lungo', bloccoAlKm: Math.min(D, bloccoAlKm), soste };
}

export const MOTIVO_TESTO: Record<MotivoImpossibile, string> = {
  'senza-percorso': 'Calcola prima il percorso: senza distanza non c’è niente da pianificare.',
  'senza-consumo': 'Servono consumo e serbatoio dell’auto: scegli la tua auto nelle impostazioni.',
  'buco-troppo-lungo':
    'Con questo serbatoio non ci arrivi: fra un distributore e il successivo c’è più strada di quanta ne fai con un pieno.',
};

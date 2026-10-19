import type { PriceLevel } from './pricing';

/**
 * Dove fermarsi lungo la strada, e quanto metterci.
 *
 * Prima il viaggio era una divisione: chilometri diviso consumo per il
 * prezzo piu basso della zona di partenza — un numero che nessuno avrebbe
 * mai pagato davvero, perche lungo la strada i prezzi cambiano e il
 * serbatoio ha un fondo.
 *
 * Qui il conto e quello vero. E il problema classico del rifornimento:
 * hai un serbatoio, una fila di distributori a prezzi diversi, e devi
 * arrivare spendendo il meno possibile. La regola ottima e semplice e si
 * spiega in una riga: da dove sei, se entro la tua autonomia c'e un
 * distributore che costa meno di quello dove ti trovi, mettine solo quanto
 * basta per arrivarci; se non c'e, fai il pieno qui e vai il piu lontano
 * possibile.
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
  /** Prezzo a cui si potrebbe fare il pieno prima di partire, per il confronto. */
  prezzoPartenza?: number | null;
}

export interface Sosta {
  tappa: TappaCandidata;
  /** Litri da mettere qui. */
  litri: number;
  spesa: number;
  /** Con quanti litri si riparte. */
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
  soste: Sosta[];
  litriComprati: number;
  spesaCarburante: number;
  /** Chilometri in piu fatti solo per raggiungere i distributori. */
  kmDeviazione: number;
  /** Litri bruciati per quelle deviazioni, gia dentro spesaCarburante. */
  litriDeviazione: number;
  /** Litri stimati nel serbatoio all'arrivo. */
  litriAllArrivo: number;
  /** Cosa costerebbe fare il pieno prima di partire e non fermarsi mai. */
  spesaPienoPrima: number | null;
  /** Quanto si risparmia col piano invece che col pieno prima. Puo essere negativo. */
  risparmioEur: number | null;
}

/** Sotto questa frazione di serbatoio non ci si vuole trovare mai. */
export const RISERVA = 0.12;
/** Due distributori entro questo raggio sono lo stesso posto: non si sceglie fra loro. */
const STESSO_PUNTO_KM = 0.4;
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
 * Autonomia in km. Sopra la riserva se ne tiene da parte; sotto la riserva
 * si usa quello che c'e, perche chi e gia in riserva non ha la scelta di
 * restare fermo — deve arrivare al primo distributore utile.
 */
function autonomia(litri: number, riservaL: number, kml: number): number {
  const utile = litri > riservaL ? litri - riservaL : litri;
  return Math.max(0, utile) * kml;
}

/**
 * Il piano di rifornimento a costo minimo.
 *
 * Nota sulle deviazioni: ogni sosta costa due volte la sua deviazione in
 * chilometri, e quel carburante lo si paga al prezzo di quella sosta. E
 * incluso nei litri comprati, non aggiunto dopo, perche altrimenti il
 * serbatoio tornerebbe a casa con litri che in realta sono stati bruciati.
 */
export function pianificaViaggio(i: PianoInput): Piano {
  const vuoto: Piano = {
    fattibile: false,
    soste: [],
    litriComprati: 0,
    spesaCarburante: 0,
    kmDeviazione: 0,
    litriDeviazione: 0,
    litriAllArrivo: 0,
    spesaPienoPrima: null,
    risparmioEur: null,
  };

  if (!(i.distanzaKm > 0)) return { ...vuoto, motivo: 'senza-percorso' };
  if (!(i.kml > 0) || !(i.serbatoioL > 0)) return { ...vuoto, motivo: 'senza-consumo' };

  const riservaL = i.serbatoioL * (i.riservaFrazione ?? RISERVA);
  const kml = i.kml;

  // Solo le tappe che stanno davvero sulla strada, in ordine di percorrenza.
  const inStrada = i.candidate
    .filter((t) => t.kmDaPartenza > 0 && t.kmDaPartenza < i.distanzaKm && t.prezzo > 0)
    .sort((a, b) => a.kmDaPartenza - b.kmDaPartenza);

  // Due pompe nello stesso piazzale non sono una scelta: del gruppo resta
  // quella che costa meno, non quella che capita per prima nell'elenco.
  const tappe: TappaCandidata[] = [];
  for (let k = 0; k < inStrada.length; ) {
    let fine = k + 1;
    while (fine < inStrada.length && inStrada[fine]!.kmDaPartenza - inStrada[k]!.kmDaPartenza <= STESSO_PUNTO_KM) {
      fine++;
    }
    let migliore = inStrada[k]!;
    for (let j = k + 1; j < fine; j++) {
      if (inStrada[j]!.prezzo < migliore.prezzo) migliore = inStrada[j]!;
    }
    tappe.push(migliore);
    k = fine;
  }

  const soste: Sosta[] = [];
  let posizione = 0;
  let litri = Math.min(i.litriAdesso, i.serbatoioL);
  // Il prezzo del carburante che si ha in pancia: all'inizio e quello di
  // casa, se lo si conosce, altrimenti non c'e confronto da fare.
  let prezzoInPancia = i.prezzoPartenza ?? null;

  let litriComprati = 0;
  let spesa = 0;
  let kmDeviazione = 0;
  let litriDeviazione = 0;

  // Un giro per sosta; il piu uno e il caso in cui l'ultimo salto arriva.
  for (let guardia = 0; guardia <= tappe.length + 1; guardia++) {
    const raggio = autonomia(litri, riservaL, kml);
    if (posizione + raggio >= i.distanzaKm - TOLLERANZA_KM) break;

    const raggiungibili = tappe.filter(
      (t) => t.kmDaPartenza > posizione && t.kmDaPartenza + t.deviazioneKm <= posizione + raggio + TOLLERANZA_KM
    );
    if (raggiungibili.length === 0) {
      return { ...vuoto, motivo: 'buco-troppo-lungo', bloccoAlKm: posizione + raggio, soste };
    }

    // La regola: la prima tappa piu economica di quello che ho in pancia.
    // Se non ce n'e, si fa il pieno dove costa meno e si va piu lontano
    // possibile — pagare di piu adesso per pagare meno tutto il resto.
    const piuEconomicaDiOra =
      prezzoInPancia === null
        ? raggiungibili[0]!
        : raggiungibili.find((t) => t.prezzo < prezzoInPancia!);

    const scelta =
      piuEconomicaDiOra ??
      raggiungibili.reduce((a, b) => (b.prezzo < a.prezzo ? b : a));

    // Arrivare fin li consuma, e la deviazione si paga due volte.
    const kmFinoLi = scelta.kmDaPartenza - posizione + 2 * scelta.deviazioneKm;
    litri -= kmFinoLi / kml;
    kmDeviazione += 2 * scelta.deviazioneKm;
    litriDeviazione += (2 * scelta.deviazioneKm) / kml;

    const restanti = i.distanzaKm - scelta.kmDaPartenza;

    let daMettere: number;
    let pieno: boolean;
    if (piuEconomicaDiOra && piuEconomicaDiOra.id === scelta.id && prezzoInPancia !== null) {
      // Qui costa meno che nel serbatoio: si va avanti col minimo.
      // «Il minimo» e comunque quanto basta a ripartire e arrivare alla
      // prossima occasione o alla fine, riserva compresa.
      const prossima = tappe.find((t) => t.kmDaPartenza > scelta.kmDaPartenza && t.prezzo < scelta.prezzo);
      const bersaglioKm = prossima
        ? prossima.kmDaPartenza - scelta.kmDaPartenza + 2 * prossima.deviazioneKm
        : restanti;
      const serve = bersaglioKm / kml + riservaL;
      daMettere = Math.max(0, Math.min(i.serbatoioL, serve) - litri);
      pieno = daMettere >= i.serbatoioL - litri - 0.01;
    } else {
      // Qui non c'e di meglio, quindi si fa scorta — ma non oltre quello che
      // serve per arrivare. Comprare un serbatoio pieno a caro prezzo quando
      // ne bastava meta significa portarsi dietro litri pagati troppo.
      const serveFinoInFondo = restanti / kml + riservaL;
      const bersaglio = Math.min(i.serbatoioL, serveFinoInFondo);
      daMettere = Math.max(0, bersaglio - litri);
      pieno = bersaglio >= i.serbatoioL - 0.01;
    }

    litri += daMettere;
    litriComprati += daMettere;
    spesa += daMettere * scelta.prezzo;
    if (daMettere > 0) prezzoInPancia = scelta.prezzo;

    soste.push({
      tappa: scelta,
      litri: daMettere,
      spesa: daMettere * scelta.prezzo,
      litriDopo: litri,
      kmRimanenti: restanti,
      pieno,
    });

    posizione = scelta.kmDaPartenza;
  }

  const litriAllArrivo = Math.max(0, litri - (i.distanzaKm - posizione) / kml);

  // Il confronto col pieno prima di partire, fatto in modo che sia un
  // confronto: stessa partenza e stesso arrivo.
  //
  // Il piano arriva con la riserva ancora in pancia — carburante comprato e
  // non consumato. Mettere a paragone la sua spesa con quella di chi arriva
  // col serbatoio a zero farebbe sembrare il piano piu caro di quello che e.
  // Quindi anche l'alternativa deve prevedere di arrivare con la riserva.
  const litriServono = i.distanzaKm / kml + riservaL;
  const spesaPienoPrima =
    i.prezzoPartenza && litriServono <= i.serbatoioL + i.litriAdesso
      ? Math.max(0, litriServono - i.litriAdesso) * i.prezzoPartenza
      : null;

  return {
    fattibile: true,
    soste,
    litriComprati,
    spesaCarburante: spesa,
    kmDeviazione,
    litriDeviazione,
    litriAllArrivo,
    spesaPienoPrima,
    risparmioEur: spesaPienoPrima === null ? null : spesaPienoPrima - spesa,
  };
}

export const MOTIVO_TESTO: Record<MotivoImpossibile, string> = {
  'senza-percorso': 'Calcola prima il percorso: senza distanza non c’è niente da pianificare.',
  'senza-consumo': 'Servono consumo e serbatoio dell’auto: scegli il modello nel Garage.',
  'buco-troppo-lungo':
    'Con questo serbatoio non ci arrivi: fra un distributore e il successivo c’è più strada di quanta ne fai con un pieno.',
};

import type { PriceLevel } from './pricing';
import { VALORE_TEMPO_EURO_ORA } from './ranking';

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
 * Qui il piano e quello a costo minimo. Lo rende veloce un fatto noto
 * (Khuller, Malekian e Mestre, «To fill or not to fill»): in un piano
 * ottimo, a ogni sosta o si fa il pieno, o si mette giusto quanto basta per
 * arrivare alla sosta dopo, o in fondo, con la riserva, o si mette il
 * minimo di una sosta. Quindi arrivando a una pompa nel serbatoio ci possono
 * essere solo pochi livelli, e su quelli la programmazione dinamica trova
 * il piano migliore senza provarli tutti.
 *
 * Il conto che il piano tiene basso e il carburante comprato, al prezzo di
 * ogni pompa, piu 0,75 € per sosta: cinque minuti al valore del tempo della
 * Home. Quei 0,75 € pesano nella scelta ma non entrano nella spesa che si
 * mostra: servono a non fermarsi per pochi centesimi.
 *
 * Le regole:
 *  - non si resta mai a secco;
 *  - fermarsi costa la deviazione, andata e ritorno: quei litri si
 *    bruciano davvero e si pagano con quello che si compra;
 *  - dopo aver comprato non si supera il serbatoio;
 *  - due soste di fila non stanno mai entro 0,4 km: e lo stesso posto;
 *  - una sosta mette almeno 5 L, o fa il pieno: se nel serbatoio cinque
 *    litri non entrano, il pieno (almeno un decilitro) e l'unica sosta
 *    da meno. Succede prima di un tratto lungo, dove serve ogni litro;
 *  - a ogni pompa e all'arrivo si tiene la riserva, il 12% del serbatoio.
 *
 * Quando la riserva non si puo tenere il piano scende un gradino alla
 * volta, con la stessa regola qualunque sia il carburante di partenza:
 *  1. la riserva a ogni pompa e all'arrivo;
 *  2. se nessun piano ci riesce, alla prima sosta si puo arrivare con meno
 *     (fondoPrimaSosta): meta di quello che c'e, mai piu di meta riserva,
 *     mai meno di 0,3 L. Chi parte in riserva va a una pompa vicina, non a
 *     quella a cinquanta km che costa un centesimo meno;
 *  3. se nemmeno cosi, il piano che va meno in riserva: ogni litro sotto la
 *     riserva a ogni arrivo costa 5 €, sotto meta riserva 20 €, piu di
 *     qualunque litro di carburante; e lo si confronta col viaggio senza
 *     soste. Capita con il primo distributore troppo lontano per chi e quasi
 *     a secco, o con un tratto piu lungo di un pieno meno la riserva.
 * Un test di proprieta controlla che con piu carburante alla partenza il
 * piano non diventi mai meno sicuro.
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
  /** La riserva da tenere a ogni arrivo, in frazione di serbatoio. */
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
  /** Litri da mettere qui: almeno LITRI_SOSTA, o il pieno (almeno LITRI_MINIMI_SOSTA). */
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
  /** Dove si resta a secco, quando non ci si arriva. */
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
  /** true quando si arriva sotto la riserva. */
  arrivoSottoRiserva: boolean;
  /**
   * Il numero (da 1) della prima sosta a cui si arriva sotto la riserva:
   * succede a chi parte in riserva, o prima di un tratto piu lungo di un
   * pieno. Null quando la riserva tiene a ogni sosta.
   */
  sostaInRiserva: number | null;
  /**
   * Cosa costerebbe mettere tutto prima di partire, al prezzo di partenza,
   * e arrivare con lo stesso carburante del piano. Null quando il
   * confronto non regge: prezzo di partenza ignoto, niente da comprare, o
   * un pieno che nel serbatoio non entra.
   */
  spesaPienoPrima: number | null;
  /** Quanto si risparmia col piano invece che col pieno prima. Puo essere negativo. */
  risparmioEur: number | null;
}

/** La riserva che il piano tiene a ogni arrivo, in frazione di serbatoio. */
export const RISERVA = 0.12;
/** Due distributori entro questo raggio sono lo stesso posto: mai due soste di fila li. */
export const STESSO_PUNTO_KM = 0.4;
/** Quanto mette una sosta, almeno, se non fa il pieno: per meno nessuno si ferma. */
export const LITRI_SOSTA = 5;
/** Sotto un decilitro non e una sosta, nemmeno per fare il pieno. */
export const LITRI_MINIMI_SOSTA = 0.1;
/** Una sosta: rallentare, uscire, fare benzina, pagare, ripartire. */
export const MINUTI_SOSTA = 5;
/**
 * Quanto pesa fermarsi nella scelta, oltre al carburante: i minuti della
 * sosta al valore del tempo della Home. Sono 0,75 €, e nella spesa
 * mostrata non entrano.
 */
export const COSTO_SOSTA_EUR = (MINUTI_SOSTA / 60) * VALORE_TEMPO_EURO_ORA;
/** Alla prima sosta, quando la riserva non si puo tenere, mai meno di cosi. */
export const FONDO_MINIMO_L = 0.3;
/**
 * Nel ripiego, ogni litro sotto la riserva a ogni arrivo. Deve costare piu
 * di qualunque litro di carburante: cosi, potendo, si compra il litro
 * invece di andare in riserva.
 */
export const PENALE_RISERVA_EUR_L = 5;
/** In piu, ogni litro sotto meta riserva. */
export const PENALE_FONDO_EUR_L = 15;
/**
 * Un metro di tolleranza sulle distanze.
 *
 * Senza, un piano che arriva esatto viene dichiarato impossibile: 440/15
 * moltiplicato per 15 fa 439,99999999999994, e il confronto con 500 dice
 * che mancano sei micrometri. Un metro e sotto qualunque errore vero di
 * un percorso stradale.
 */
const TOLLERANZA_KM = 0.001;
/** Sotto questa quantita un acquisto e un arrotondamento, non un acquisto. */
const ZERO_LITRI = 1e-9;

/** La riserva in litri: la frazione chiesta, se ha senso, altrimenti quella di sempre. */
export function riservaLitri(i: Pick<PianoInput, 'serbatoioL' | 'riservaFrazione'>): number {
  const f = i.riservaFrazione;
  return i.serbatoioL * (typeof f === 'number' && Number.isFinite(f) ? Math.min(1, Math.max(0, f)) : RISERVA);
}

/**
 * Con quanto si puo arrivare alla prima sosta quando la riserva non si puo
 * tenere: meta di quello che c'e, ma mai piu di meta riserva e mai meno di
 * 0,3 L. Cresce col carburante di partenza, ma piu piano: con un decilitro
 * in piu alla partenza si arriva a ogni pompa con un decilitro in piu e il
 * fondo sale al piu di mezzo. Una pompa ammessa con meno resta ammessa con
 * di piu.
 */
export function fondoPrimaSosta(litriAdesso: number, riservaL: number): number {
  return Math.min(riservaL, Math.max(FONDO_MINIMO_L, 0.5 * Math.min(litriAdesso, riservaL)));
}

/**
 * Nel ripiego, la penale per arrivare con `litri` nel serbatoio, a una
 * pompa o in fondo: zero con la riserva, poi cresce litro per litro, piu in
 * fretta sotto meta riserva.
 */
export function penaleRiserva(litri: number, riservaL: number): number {
  const sotto = Math.max(0, riservaL - litri);
  const sottoMeta = Math.max(0, riservaL / 2 - litri);
  return sotto * PENALE_RISERVA_EUR_L + sottoMeta * PENALE_FONDO_EUR_L;
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

/**
 * Toglie le pompe che un'altra batte in tutto. A batte B quando costa
 * uguale o meno e la sua deviazione, piu la distanza fra le due lungo la
 * strada, non supera la deviazione di B: ad A si arriva con almeno il
 * carburante con cui si arriverebbe a B, e da A si riparte come da un
 * punto non piu indietro. Per esempio B a 2 km dalla strada e A a 300 m,
 * mezzo km piu in la, allo stesso prezzo.
 *
 * Non basta che A sia piu avanti e non piu cara: per arrivarci serve piu
 * carburante, e chi arriva a B con la riserva ad A magari non ci arriva.
 *
 * Sui viaggi lunghi in Risparmio sono piu di un terzo delle candidate, e il
 * calcolo costa col quadrato di quante sono. Un test di proprieta su strade
 * fitte di distributori controlla che il conto non cambi.
 *
 * Le tappe arrivano in ordine di km.
 */
function senzaDominate(tappe: TappaCandidata[]): TappaCandidata[] {
  const n = tappe.length;
  const out: TappaCandidata[] = [];
  let devMax = 0;
  for (const t of tappe) devMax = Math.max(devMax, t.deviazioneKm);
  let da = 0;
  for (let b = 0; b < n; b++) {
    const B = tappe[b]!;
    // Chi batte B sta entro la sua deviazione, in km.
    while (tappe[da]!.kmDaPartenza < B.kmDaPartenza - devMax) da++;
    let battuta = false;
    for (let a = da; a < n && !battuta; a++) {
      const A = tappe[a]!;
      if (A.kmDaPartenza > B.kmDaPartenza + B.deviazioneKm) break;
      if (a === b || A.prezzo > B.prezzo || A.kmDaPartenza < B.kmDaPartenza - B.deviazioneKm) continue;
      const margine = B.deviazioneKm - A.deviazioneKm - Math.abs(A.kmDaPartenza - B.kmDaPartenza);
      if (margine < 0) continue;
      // Fra due identiche ne resta una: la prima.
      battuta = margine > 0 || A.prezzo < B.prezzo || a < b;
    }
    if (!battuta) out.push(B);
  }
  return out;
}

/** Un modo di trovarsi alla pompa di una tappa, prima di comprare. */
interface Stato {
  /** Quale tappa, come indice nell'ordine dei km. */
  tappa: number;
  /** Litri all'arrivo alla pompa. */
  litri: number;
  /** Il conto fin qui: euro spesi, soste e, nel ripiego, penali. */
  valore: number;
  /** Lo stato alla sosta prima; null se questa e la prima sosta. */
  prima: Stato | null;
}

/**
 * Gli stati utili di una tappa, in ordine di litri. Arrivare con a litri e
 * ripartire con L costa valore + (L − a) × prezzo: per ogni L il migliore e
 * quello col minimo di (valore − a × prezzo) fra gli stati che arrivano con
 * abbastanza meno di L da comprare il minimo di una sosta. Restano solo gli
 * stati che abbassano quel minimo: gli altri non sarebbero mai la risposta,
 * nemmeno per l'acquisto minimo, che da uno stato migliore con meno litri
 * si fa comprando un po' di piu.
 */
interface Indice {
  litri: Float64Array;
  /** valore − litri × prezzo, strettamente decrescente. */
  minimo: Float64Array;
  stato: Stato[];
}

/**
 * Le partenze a livello fisso da una tappa: da ogni stato utile l'acquisto
 * minimo, e il pieno. Il livello e scritto come potenziale (vedi risolvi).
 */
interface Partenze {
  livello: Float64Array;
  valore: Float64Array;
  stato: Stato[];
}

/** L'ultima sosta di un piano che arriva, e con quanto si riparte da li. */
interface Fine {
  valore: number;
  stato: Stato;
  ripartenza: number;
}

/** Un giro della programmazione dinamica: con quanto si arriva, e se si paga la riserva. */
interface Regole {
  /** Con quanto si deve arrivare alla prima sosta. */
  fondoPrima: number;
  /** Con quanto si deve arrivare alle altre soste e in fondo. */
  fondo: number;
  /** Il ripiego: ogni litro sotto la riserva, a ogni arrivo, si paga. */
  penali: boolean;
}

interface Esito {
  fine: Fine | null;
  indici: Array<Indice | null>;
  statoPieno: Array<Stato | null>;
}

/**
 * La posizione dell'ultimo stato che arriva con non piu di `livelloMax`
 * litri, o −1. Con `livelloMax` = L − minimo sono gli stati da cui si puo
 * ripartire con L comprando almeno il minimo.
 */
function ripartiCon(ind: Indice, livelloMax: number): number {
  let lo = 0;
  let hi = ind.litri.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ind.litri[mid]! <= livelloMax + ZERO_LITRI) lo = mid + 1;
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

const senzaPenale = (): number => 0;

/*
 * Funzioni convesse lineari a tratti, per rifare i conti di una sequenza di
 * soste gia scelta. Con le soste fissate il costo, in funzione del livello
 * con cui si riparte da ognuna, e una catena di funzioni convesse: la
 * minima si trova esatta, tratto per tratto.
 */

/** Su [da, da + Σ lunghezze]: il valore in `da` e, tratto per tratto, lunghezza e pendenza crescente. */
interface Convessa {
  da: number;
  valore: number;
  lunghezze: number[];
  pendenze: number[];
}

/** Sotto questa pendenza, in € al litro, un tratto e piatto. */
const PIATTO = 1e-9;

function fineConvessa(f: Convessa): number {
  let x = f.da;
  for (const l of f.lunghezze) x += l;
  return x;
}

/** f su [a, b], o null se l'intervallo e vuoto. */
function restringi(f: Convessa, a: number, b: number): Convessa | null {
  const lo = Math.max(f.da, a);
  const hi = Math.min(fineConvessa(f), b);
  if (hi < lo - ZERO_LITRI) return null;
  const lunghezze: number[] = [];
  const pendenze: number[] = [];
  let x = f.da;
  let valore = f.valore;
  for (let s = 0; s < f.lunghezze.length; s++) {
    const pend = f.pendenze[s]!;
    const fine = x + f.lunghezze[s]!;
    if (fine <= lo) {
      valore += (fine - x) * pend;
    } else {
      if (x < lo) valore += (lo - x) * pend;
      const a0 = Math.max(x, lo);
      const a1 = Math.min(fine, hi);
      if (a1 > a0) {
        lunghezze.push(a1 - a0);
        pendenze.push(pend);
      }
      if (fine >= hi) break;
    }
    x = fine;
  }
  return { da: lo, valore, lunghezze, pendenze };
}

/** x ↦ f(x) + p·x. */
function piuLineare(f: Convessa, p: number): Convessa {
  return { da: f.da, valore: f.valore + p * f.da, lunghezze: f.lunghezze.slice(), pendenze: f.pendenze.map((q) => q + p) };
}

/** x ↦ f(x) + penaleRiserva(x, riservaL): pendenza −20 sotto meta riserva, −5 fino alla riserva, poi 0. */
function piuPenale(f: Convessa, riservaL: number): Convessa {
  const pieghe = [riservaL / 2, riservaL];
  const pendenzaPenale = (x: number) =>
    x < riservaL / 2 ? -(PENALE_RISERVA_EUR_L + PENALE_FONDO_EUR_L) : x < riservaL ? -PENALE_RISERVA_EUR_L : 0;
  const lunghezze: number[] = [];
  const pendenze: number[] = [];
  let x = f.da;
  for (let s = 0; s < f.lunghezze.length; s++) {
    const fine = x + f.lunghezze[s]!;
    let a = x;
    for (const k of pieghe) {
      if (k > a && k < fine) {
        lunghezze.push(k - a);
        pendenze.push(f.pendenze[s]! + pendenzaPenale((a + k) / 2));
        a = k;
      }
    }
    lunghezze.push(fine - a);
    pendenze.push(f.pendenze[s]! + pendenzaPenale((a + fine) / 2));
    x = fine;
  }
  return { da: f.da, valore: f.valore + penaleRiserva(f.da, riservaL), lunghezze, pendenze };
}

/**
 * Il minimo di f da `da` fino a x, come funzione di x: la parte che scende,
 * poi piatta fino a `finoA`. E il punto piu a destra dove f e minima.
 */
function minimoFinQui(f: Convessa, finoA: number): { g: Convessa; xMinimo: number } {
  const lunghezze: number[] = [];
  const pendenze: number[] = [];
  let x = f.da;
  let s = 0;
  for (; s < f.lunghezze.length && f.pendenze[s]! < -PIATTO; s++) {
    lunghezze.push(f.lunghezze[s]!);
    pendenze.push(f.pendenze[s]!);
    x += f.lunghezze[s]!;
  }
  let xMinimo = x;
  for (; s < f.lunghezze.length && f.pendenze[s]! <= PIATTO; s++) xMinimo += f.lunghezze[s]!;
  if (finoA > x) {
    lunghezze.push(finoA - x);
    pendenze.push(0);
  }
  return { g: { da: f.da, valore: f.valore, lunghezze, pendenze }, xMinimo };
}

/** Il punto piu a sinistra dove f e minima, e il valore li. */
function minimoConvessa(f: Convessa): { x: number; v: number } {
  let x = f.da;
  let v = f.valore;
  for (let s = 0; s < f.lunghezze.length && f.pendenze[s]! < -PIATTO; s++) {
    x += f.lunghezze[s]!;
    v += f.lunghezze[s]! * f.pendenze[s]!;
  }
  return { x, v };
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
    sostaInRiserva: null,
    spesaPienoPrima: null,
    risparmioEur: null,
  };

  if (!(i.distanzaKm > 0)) return { ...vuoto, motivo: 'senza-percorso' };
  if (!(i.kml > 0) || !(i.serbatoioL > 0)) return { ...vuoto, motivo: 'senza-consumo' };

  const D = i.distanzaKm;
  const kml = i.kml;
  const T = i.serbatoioL;
  const R = riservaLitri(i);
  const S0 = Number.isFinite(i.litriAdesso) ? Math.min(Math.max(0, i.litriAdesso), T) : 0;
  const eps = TOLLERANZA_KM / kml;
  const penale = (litri: number) => penaleRiserva(litri, R);

  const tappe = senzaDominate(tappeSullaStrada(i.candidate, D));
  const n = tappe.length;
  const km = Float64Array.from(tappe, (t) => t.kmDaPartenza);
  const prezzo = Float64Array.from(tappe, (t) => t.prezzo);
  // La deviazione si fa andata e ritorno: arrivare alla pompa costa come
  // fare kmAndata km di strada, e ripartire da li e come ripartire dal km
  // kmRitorno.
  const kmAndata = Float64Array.from(tappe, (t) => t.kmDaPartenza + t.deviazioneKm);
  const kmRitorno = Float64Array.from(tappe, (t) => t.kmDaPartenza - t.deviazioneKm);

  /**
   * Litri dalla pompa h alla pompa j: ritorno sulla strada da h, strada fra
   * le due, uscita verso j. h = −1 e la partenza, j = n l'arrivo.
   */
  const consumo = (h: number, j: number): number => ((j >= n ? D : kmAndata[j]!) - (h < 0 ? 0 : kmRitorno[h]!)) / kml;

  // I modi utili di arrivare alla tappa in corso, in ordine di litri con
  // (valore − litri × prezzo) strettamente decrescente: la scala che
  // diventa l'Indice. Un modo nuovo entra solo se nessuno con meno litri
  // costa meno, e butta fuori quelli con piu litri che costano di piu.
  // Cosi non si accumulano centinaia di candidati da ordinare per tenerne
  // una decina.
  const scalaLitri: number[] = [];
  const scalaW: number[] = [];
  const scalaValore: number[] = [];
  const scalaPrima: Array<Stato | null> = [];

  /** La programmazione dinamica, tappa per tappa in ordine di km. */
  const risolvi = (g: Regole): Esito => {
    const { fondoPrima, fondo } = g;
    const minimo = LITRI_SOSTA;
    const pen = g.penali ? penale : senzaPenale;
    const indici: Array<Indice | null> = new Array<Indice | null>(n).fill(null);
    // Ripartire da h col pieno costa lo stesso qualunque sia la tappa dopo:
    // si calcola una volta per tappa, non una per coppia.
    const costoPieno = new Float64Array(n).fill(Infinity);
    const statoPieno: Array<Stato | null> = new Array<Stato | null>(n).fill(null);
    // Le partenze a livello fisso, il pieno e gli acquisti minimi, di ogni
    // tappa gia vista, scritte col «potenziale»: il livello riportato al km
    // 0, livello + kmRitorno/kml. Da una partenza di potenziale π alla tappa
    // j si arriva con π − kmAndata[j]/kml, da qualunque tappa venga: due
    // partenze si confrontano senza guardare da dove. Chi ha piu potenziale
    // e costa meno vince sempre, e resta solo il fronte di quelle che
    // nessuna batte, in ordine di potenziale e di costo. Una partenza entra
    // nel fronte quando la tappa in corso e a piu di 0,4 km dalla sua: da li
    // in poi vale per tutte quelle dopo.
    const uscite: Array<Partenze | null> = new Array<Partenze | null>(n).fill(null);
    const frontePi: number[] = [];
    const fronteV: number[] = [];
    const fronteStato: Stato[] = [];
    let fronteDa = 0;
    let attivate = 0;
    const attiva = (pi: number, v: number, stato: Stato) => {
      let lo = fronteDa;
      let hi = frontePi.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (frontePi[mid]! < pi) lo = mid + 1;
        else hi = mid;
      }
      if (lo < frontePi.length && fronteV[lo]! <= v) return;
      let da = lo;
      while (da > fronteDa && fronteV[da - 1]! >= v) da--;
      const a = lo < frontePi.length && frontePi[lo] === pi ? lo + 1 : lo;
      frontePi.splice(da, a - da, pi);
      fronteV.splice(da, a - da, v);
      fronteStato.splice(da, a - da, stato);
    };
    let fine: Fine | null = null;
    const proponi = (valore: number, stato: Stato, ripartenza: number) => {
      if (!fine || valore < fine.valore) fine = { valore, stato, ripartenza };
    };
    /** Oltre questi km da una pompa, nemmeno col pieno si arriva alla prossima col fondo. */
    const raggioKm = (T - fondo) * kml;
    let primaUtile = 0;

    // Il prezzo della tappa in corso.
    let p = 0;
    const metti = (litri: number, valore: number, prima: Stato | null) => {
      const w = valore - litri * p;
      const len = scalaLitri.length;
      // Il primo con piu litri.
      let lo = 0;
      let hi = len;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (scalaLitri[mid]! <= litri) lo = mid + 1;
        else hi = mid;
      }
      if (lo > 0 && scalaW[lo - 1]! <= w) return;
      // Chi ha gli stessi litri e costa di piu esce, e cosi chi ne ha di piu.
      let da = lo;
      if (da > 0 && scalaLitri[da - 1] === litri) da--;
      let a = lo;
      while (a < len && scalaW[a]! >= w) a++;
      scalaLitri.splice(da, a - da, litri);
      scalaW.splice(da, a - da, w);
      scalaValore.splice(da, a - da, valore);
      scalaPrima.splice(da, a - da, prima);
    };

    const giusti = new Float64Array(3);
    const giustoValore = new Float64Array(3);
    const giustoPrima: Array<Stato | null> = [null, null, null];

    for (let j = 0; j < n; j++) {
      p = prezzo[j]!;
      scalaLitri.length = 0;
      scalaW.length = 0;
      scalaValore.length = 0;
      scalaPrima.length = 0;

      // Dritti dalla partenza, senza soste prima: con quello che c'e.
      const daCasa = S0 - consumo(-1, j);
      if (daCasa >= fondoPrima - eps) metti(daCasa, COSTO_SOSTA_EUR + pen(daCasa), null);

      // Da una sosta precedente: col pieno, con l'acquisto minimo da uno dei
      // modi di arrivarci, o con quanto basta per arrivare qui con un livello
      // «giusto». I giusti sono tre: la riserva; quanto serve perche qui
      // l'acquisto minimo faccia il pieno; quanto serve perche qui
      // l'acquisto minimo basti fino in fondo con la riserva. Gli ultimi due
      // fanno comprare il piu possibile prima, dove costa meno, quando qui
      // ci si deve fermare comunque. Ogni giusto da sempre lo stesso
      // livello, quindi ne resta solo il migliore.
      const cFine = consumo(j, n);
      let nGiusti = 0;
      const giusto = (livello: number) => {
        if (livello < fondo - eps || livello > T + eps) return;
        for (let g = 0; g < nGiusti; g++) if (Math.abs(giusti[g]! - livello) < ZERO_LITRI) return;
        giusti[nGiusti] = livello;
        giustoValore[nGiusti] = Infinity;
        giustoPrima[nGiusti] = null;
        nGiusti++;
      };
      giusto(R);
      giusto(T - minimo);
      if (cFine + R <= T + eps) giusto(cFine + R - minimo);

      // Il fronte delle partenze: entrano quelle delle tappe ormai a piu di
      // 0,4 km, escono quelle che non arrivano piu nemmeno qui.
      for (; attivate < j && km[j]! - km[attivate]! > STESSO_PUNTO_KM; attivate++) {
        const u = uscite[attivate];
        if (!u) continue;
        for (let q = 0; q < u.livello.length; q++) attiva(u.livello[q]!, u.valore[q]!, u.stato[q]!);
        uscite[attivate] = null;
      }
      const andata = kmAndata[j]!;
      const piMinimo = km[j]! / kml + fondo - eps;
      while (fronteDa < frontePi.length && frontePi[fronteDa]! < piMinimo) fronteDa++;
      if (fronteDa > 256) {
        frontePi.splice(0, fronteDa);
        fronteV.splice(0, fronteDa);
        fronteStato.splice(0, fronteDa);
        fronteDa = 0;
      }
      // Dal fronte entrano nella scala solo quelli che, in ordine di litri,
      // costano meno di tutti quelli con meno litri: gli altri la scala li
      // butterebbe comunque.
      const X = andata / kml;
      let lo = fronteDa;
      let hi = frontePi.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (frontePi[mid]! - X < fondo - eps) lo = mid + 1;
        else hi = mid;
      }
      let minimoW = Infinity;
      for (let q = lo; q < frontePi.length; q++) {
        const a = frontePi[q]! - X;
        const valore = fronteV[q]! + COSTO_SOSTA_EUR + pen(a);
        const w = valore - a * p;
        if (w < minimoW) {
          minimoW = w;
          metti(a, valore, fronteStato[q]!);
        }
      }

      while (km[j]! - km[primaUtile]! > raggioKm + TOLLERANZA_KM) primaUtile++;
      for (let h = primaUtile; h < j; h++) {
        const ind = indici[h];
        if (!ind || km[j]! - km[h]! <= STESSO_PUNTO_KM) continue;
        const c = (andata - kmRitorno[h]!) / kml;
        if (c > T - fondo + eps) continue;

        // Il minimo di tutta la tappa e l'ultimo: se nemmeno quello batte il
        // migliore trovato, la ricerca non serve.
        const minimoTappa = ind.minimo[ind.minimo.length - 1]!;
        for (let g = 0; g < nGiusti; g++) {
          const L = c + giusti[g]!;
          if (L > T + eps) continue;
          const costoFisso = Math.min(T, L) * prezzo[h]! + COSTO_SOSTA_EUR;
          if (minimoTappa + costoFisso >= giustoValore[g]!) continue;
          const q = ripartiCon(ind, L - minimo);
          if (q >= 0) {
            const valore = ind.minimo[q]! + costoFisso;
            if (valore < giustoValore[g]!) {
              giustoValore[g] = valore;
              giustoPrima[g] = ind.stato[q]!;
            }
          }
        }
      }
      for (let g = 0; g < nGiusti; g++) {
        const prima = giustoPrima[g];
        if (prima) metti(giusti[g]!, giustoValore[g]! + pen(giusti[g]!), prima);
      }
      if (scalaLitri.length === 0) continue;

      const litri = scalaLitri.slice();
      const minimi = scalaW;
      const stato: Stato[] = litri.map((l, q) => ({ tappa: j, litri: l, valore: scalaValore[q]!, prima: scalaPrima[q] ?? null }));
      const ind: Indice = { litri: Float64Array.from(litri), minimo: Float64Array.from(minimi), stato };
      indici[j] = ind;

      const qPieno = ripartiCon(ind, T - LITRI_MINIMI_SOSTA);
      if (qPieno >= 0) {
        costoPieno[j] = ind.minimo[qPieno]! + T * p;
        statoPieno[j] = ind.stato[qPieno]!;
      }
      let k = 0;
      while (k < litri.length && litri[k]! + minimo <= T + ZERO_LITRI) k++;
      {
        const pieno = statoPieno[j] !== null ? 1 : 0;
        const livello = new Float64Array(k + pieno);
        const valore = new Float64Array(k + pieno);
        const da: Stato[] = [];
        const ritorno = kmRitorno[j]! / kml;
        for (let q = 0; q < k; q++) {
          livello[q] = Math.min(T, litri[q]! + minimo) + ritorno;
          valore[q] = stato[q]!.valore + minimo * p;
          da.push(stato[q]!);
        }
        if (pieno) {
          livello[k] = T + ritorno;
          valore[k] = costoPieno[j]!;
          da.push(statoPieno[j]!);
        }
        if (da.length > 0) uscite[j] = { livello, valore, stato: da };
      }

      // Da qui all'arrivo: quanto basta per arrivare con la riserva,
      // l'acquisto minimo da chi ha gia quasi abbastanza, o il pieno.
      if (cFine <= T - fondo + eps) {
        const bersaglio = Math.min(T, cFine + R);
        const q = ripartiCon(ind, bersaglio - minimo);
        if (q >= 0) proponi(ind.minimo[q]! + bersaglio * p + pen(bersaglio - cFine), ind.stato[q]!, bersaglio);
        for (let s = q + 1; s < k; s++) {
          const L = Math.min(T, litri[s]! + minimo);
          proponi(stato[s]!.valore + minimo * p + pen(L - cFine), stato[s]!, L);
        }
        if (statoPieno[j]) proponi(costoPieno[j]! + pen(T - cFine), statoPieno[j]!, T);
      }
    }
    return { fine, indici, statoPieno };
  };

  /** Dalle tappe e dai livelli di ripartenza alle soste vere, rifacendo il viaggio litro per litro. */
  const realizza = (sequenza: readonly number[], ripartenze: readonly number[]) => {
    const soste: Sosta[] = [];
    const arrivi: number[] = [];
    let livello = S0;
    for (let t = 0; t < sequenza.length; t++) {
      const j = sequenza[t]!;
      const arrivo = livello - consumo(t === 0 ? -1 : sequenza[t - 1]!, j);
      const dopo = ripartenze[t]!;
      const litri = dopo - arrivo;
      soste.push({
        tappa: tappe[j]!,
        litri,
        spesa: litri * prezzo[j]!,
        litriDopo: dopo,
        kmRimanenti: D - km[j]!,
        pieno: dopo >= T - 0.01,
      });
      arrivi.push(arrivo);
      livello = dopo;
    }
    const finale = livello - consumo(sequenza.length > 0 ? sequenza[sequenza.length - 1]! : -1, n);
    return { soste, arrivi, finale };
  };

  /** Le tappe di una catena di stati e i livelli con cui la programmazione dinamica riparte da ognuna. */
  const daCatena = (ultimo: Stato, ripartenzaFinale: number) => {
    const stati = catena(ultimo);
    const sequenza = stati.map((s) => s.tappa);
    const ripartenze = stati.map((s, t) => {
      const dopo = stati[t + 1];
      return dopo ? dopo.litri + consumo(s.tappa, dopo.tappa) : ripartenzaFinale;
    });
    return { sequenza, ripartenze };
  };

  /**
   * Con le soste gia scelte, i litri migliori da mettere a ognuna: esatti.
   *
   * La programmazione dinamica sceglie le soste guardando pochi livelli, e
   * di solito sono quelli giusti. Non sempre, con l'acquisto minimo: se una
   * sosta obbligata in mezzo costa di piu, conviene comprare prima, dove
   * costa meno, giusto quanto serve perche li basti il minimo per arrivare
   * alla sosta dopo; e quel livello dipende da una sosta che la
   * programmazione dinamica non ha ancora visto. Qui le soste sono note e i
   * conti si fanno su tutti i livelli: il costo, in funzione del livello con
   * cui si riparte da una sosta, e convesso, e il minimo si trova esatto.
   */
  const acquistiMigliori = (sequenza: readonly number[], soloPieno: readonly boolean[], g: Regole): number[] | null => {
    const k = sequenza.length;
    if (k === 0) return [];
    const a1 = S0 - consumo(-1, sequenza[0]!);
    if (a1 < g.fondoPrima - eps) return null;
    // Il conto, in funzione del livello all'arrivo alla sosta t.
    let arrivo: Convessa = { da: a1, valore: g.penali ? penale(a1) : 0, lunghezze: [], pendenze: [] };
    const piuDestra: number[] = [];
    let ripartenza: Convessa | null = null;
    const minimi = soloPieno.map((pieno) => (pieno ? LITRI_MINIMI_SOSTA : LITRI_SOSTA));
    for (let t = 0; t < k; t++) {
      const p = prezzo[sequenza[t]!]!;
      // Ripartire con L costa L·p piu il minimo, su chi arriva con al piu
      // L − minimo, di (conto − livello·p). Una sosta da meno di cinque
      // litri resta un pieno.
      const { g: fin, xMinimo } = minimoFinQui(piuLineare(arrivo, -p), T - minimi[t]!);
      piuDestra.push(xMinimo);
      const r = restringi({ ...fin, da: fin.da + minimi[t]! }, soloPieno[t] ? T : -Infinity, T);
      if (!r) return null;
      ripartenza = piuLineare(r, p);
      if (t + 1 < k) {
        const c = consumo(sequenza[t]!, sequenza[t + 1]!);
        const a = restringi({ ...ripartenza, da: ripartenza.da - c }, Math.max(g.fondo, 0), Infinity);
        if (!a) return null;
        arrivo = g.penali ? piuPenale(a, R) : a;
      }
    }
    const cFine = consumo(sequenza[k - 1]!, n);
    const f = restringi({ ...ripartenza!, da: ripartenza!.da - cFine }, Math.max(g.fondo, 0), Infinity);
    if (!f) return null;
    const migliore = minimoConvessa(g.penali ? piuPenale(f, R) : f);
    // All'indietro: da ogni livello di ripartenza, con quanto conviene arrivare.
    const ripartenze = new Array<number>(k);
    let L = migliore.x + cFine;
    for (let t = k - 1; t >= 0; t--) {
      ripartenze[t] = Math.min(T, L);
      if (t > 0) L = Math.min(L - minimi[t]!, piuDestra[t]!) + consumo(sequenza[t - 1]!, sequenza[t]!);
    }
    return ripartenze;
  };

  const componi = (soste: Sosta[], arrivi: number[], finale: number): Piano => {
    let litriComprati = 0;
    let spesaCarburante = 0;
    let kmDeviazione = 0;
    for (const s of soste) {
      litriComprati += s.litri;
      spesaCarburante += s.spesa;
      kmDeviazione += 2 * s.tappa.deviazioneKm;
    }
    const inRiserva = arrivi.findIndex((a) => a < R - eps);

    // Il confronto col pieno prima di partire, fatto in modo che sia un
    // confronto: stessa partenza, stesso arrivo, stesso carburante in
    // fondo. Regge solo se il piano deve comprare qualcosa e se quei litri
    // nel serbatoio entrano davvero: da mettere contro spazio libero, non
    // contro il serbatoio intero.
    const daMettere = D / kml + finale - S0;
    const prezzoPartenza = i.prezzoPartenza ?? null;
    const spesaPienoPrima =
      prezzoPartenza !== null && prezzoPartenza > 0 && soste.length > 0 && daMettere > 0 && daMettere <= T - S0 + eps
        ? daMettere * prezzoPartenza
        : null;

    return {
      fattibile: true,
      soste,
      litriComprati,
      spesaCarburante,
      kmDeviazione,
      litriDeviazione: kmDeviazione / kml,
      // Ogni giro accetta solo arrivi da −1 m di strada in su: qui si tolgono
      // quei micrometri, non un arrivo a secco.
      litriAllArrivo: Math.max(0, finale),
      arrivoSottoRiserva: finale < R - eps,
      sostaInRiserva: inRiserva >= 0 ? inRiserva + 1 : null,
      spesaPienoPrima,
      risparmioEur: spesaPienoPrima === null ? null : spesaPienoPrima - spesaCarburante,
    };
  };

  /** Il conto di un piano con le regole del giro: carburante, soste e, nel ripiego, penali. */
  const conto = (r: ReturnType<typeof realizza>, g: Regole) => {
    let v = g.penali ? penale(r.finale) : 0;
    r.soste.forEach((s, t) => (v += s.spesa + COSTO_SOSTA_EUR + (g.penali ? penale(r.arrivi[t]!) : 0)));
    return v;
  };

  const dalFine = (f: Fine, g: Regole): Piano => {
    const { sequenza, ripartenze } = daCatena(f.stato, f.ripartenza);
    let r = realizza(sequenza, ripartenze);
    const meglio = acquistiMigliori(
      sequenza,
      r.soste.map((s) => s.litri < LITRI_SOSTA - ZERO_LITRI),
      g,
    );
    if (meglio) {
      const r2 = realizza(sequenza, meglio);
      if (conto(r2, g) < conto(r, g) - 1e-9) r = r2;
    }
    return componi(r.soste, r.arrivi, r.finale);
  };

  /**
   * Il livello piu basso, a una pompa o in fondo, del piano con soste che
   * va meno giu: facendo il pieno a ogni sosta, che non abbassa mai niente
   * dopo. −Infinity se con le soste non si arriva.
   */
  const livelloPiuAlto = (): number => {
    const finQui = new Float64Array(n).fill(-Infinity);
    let migliore = -Infinity;
    let primaUtile = 0;
    for (let j = 0; j < n; j++) {
      let b = S0 - consumo(-1, j);
      while (km[j]! - km[primaUtile]! > T * kml + TOLLERANZA_KM) primaUtile++;
      for (let h = primaUtile; h < j; h++) {
        if (finQui[h] === -Infinity || km[j]! - km[h]! <= STESSO_PUNTO_KM) continue;
        const c = consumo(h, j);
        // Arrivando quasi pieni non si compra niente: non e una sosta.
        if (c < LITRI_MINIMI_SOSTA) continue;
        b = Math.max(b, Math.min(finQui[h]!, T - c));
      }
      if (b < -eps) continue;
      finQui[j] = b;
      const cFine = consumo(j, n);
      if (cFine <= T + eps) migliore = Math.max(migliore, Math.min(b, T - cFine));
    }
    return migliore;
  };

  // Se il carburante che c'e basta, con la riserva, non ci si ferma: zero
  // euro e zero soste non si battono.
  const finaleSenzaSoste = S0 - D / kml;
  if (finaleSenzaSoste >= R - eps) return componi([], [], finaleSenzaSoste);
  const fondoPrima = fondoPrimaSosta(S0, R);

  // 1. La riserva a ogni pompa e in fondo. Chi parte sotto la riserva alla
  // prima pompa non ci arriva con la riserva: il giro non serve.
  if (S0 >= R - eps) {
    const g: Regole = { fondoPrima: R, fondo: R, penali: false };
    const e = risolvi(g);
    if (e.fine) return dalFine(e.fine, g);
  }
  // 2. La prima sosta un po' in riserva, mai troppo.
  if (fondoPrima < R - eps) {
    const g: Regole = { fondoPrima, fondo: R, penali: false };
    const e = risolvi(g);
    if (e.fine) return dalFine(e.fine, g);
  }
  // 3. Il ripiego: prima di tutto il piano il cui punto piu basso e il piu
  // alto possibile; fra quelli, il conto piu basso, con le penali che
  // tengono gli altri arrivi alla riserva quando si puo. Senza soste solo
  // se e piu sicuro: arriva in fondo con piu di quanto qualunque piano con
  // soste tenga nel suo punto piu basso. Cosi il punto piu basso del piano
  // sale sempre col carburante di partenza.
  const senzaSosteArriva = finaleSenzaSoste >= -eps;
  const piuAlto = livelloPiuAlto();
  if (senzaSosteArriva && finaleSenzaSoste > piuAlto + eps) return componi([], [], finaleSenzaSoste);
  if (piuAlto >= -eps) {
    const g: Regole = { fondoPrima: Math.max(0, piuAlto), fondo: Math.max(0, piuAlto), penali: true };
    const e = risolvi(g);
    if (e.fine) return dalFine(e.fine, g);
  }
  // Una rete di sicurezza: il livello piu alto si calcola col pieno a ogni
  // sosta, e se un pieno non si potesse fare il conto qui sopra non
  // troverebbe niente.
  if (senzaSosteArriva) return componi([], [], finaleSenzaSoste);
  const g: Regole = { fondoPrima: 0, fondo: 0, penali: true };
  const ripiego = risolvi(g);
  if (ripiego.fine) return dalFine(ripiego.fine, g);

  // Non si arriva: dove si resta a secco, col pieno all'ultima pompa
  // raggiungibile, e le soste per arrivarci.
  let bloccoAlKm = S0 * kml;
  let ultima = -1;
  for (let j = 0; j < n; j++) {
    if (!ripiego.statoPieno[j]) continue;
    const finoA = kmRitorno[j]! + T * kml;
    if (finoA > bloccoAlKm) {
      bloccoAlKm = finoA;
      ultima = j;
    }
  }
  let soste: Sosta[] = [];
  if (ultima >= 0) {
    const { sequenza, ripartenze } = daCatena(ripiego.statoPieno[ultima]!, T);
    soste = realizza(sequenza, ripartenze).soste;
  }
  return { ...vuoto, motivo: 'buco-troppo-lungo', bloccoAlKm: Math.min(D, bloccoAlKm), soste };
}

export const MOTIVO_TESTO: Record<MotivoImpossibile, string> = {
  'senza-percorso': 'Calcola prima il percorso: senza distanza non c’è niente da pianificare.',
  'senza-consumo': 'Servono consumo e serbatoio dell’auto: scegli la tua auto nelle impostazioni.',
  'buco-troppo-lungo':
    'Con questo serbatoio non ci arrivi: fra un distributore e il successivo c’è più strada di quanta ne fai con un pieno.',
};

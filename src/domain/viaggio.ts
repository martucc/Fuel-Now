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
 * Qui il piano e quello a costo minimo, esatto. La programmazione dinamica
 * passa le pompe in ordine di km e tiene, per ogni livello del serbatoio,
 * il conto minimo per averlo: una funzione lineare a tratti, non pochi
 * livelli scelti in anticipo (com'era nella prima versione, che con
 * l'acquisto minimo a volte sbagliava le soste di qualche euro). Si
 * guardano tutte le pompe: sui viaggi lunghi in Risparmio, quasi
 * novecento, il conto resta sotto i venti millisecondi.
 *
 * Non si tolgono prima le pompe «battute» da una vicina non piu cara e con
 * meno deviazione: sembra innocuo e non lo e. Le soste vanno in ordine di
 * km e due soste non stanno entro 0,4 km, quindi una sosta obbligata fra
 * le due, o troppo vicina a quella che batte, rende inutilizzabile proprio
 * quella che resta. Con 45 L in riserva, una pompa a 2,25 sulla strada al
 * km 40 e due a 1,99 attorno, toglierne una faceva spendere 6 € in piu.
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
 *  - a ogni pompa e all'arrivo si tiene la riserva, il 12% del serbatoio,
 *    con la stessa soglia dappertutto: un metro di strada di tolleranza per
 *    gli arrotondamenti, e mai sotto zero.
 *
 * Quando la riserva non si puo tenere il piano scende un gradino alla
 * volta, con la stessa regola qualunque sia il carburante di partenza:
 *  1. la riserva a ogni pompa e all'arrivo;
 *  2. se nessun piano ci riesce, alla prima sosta si puo arrivare con meno
 *     (fondoPrimaSosta): meta di quello che c'e, mai piu di meta riserva,
 *     mai meno di 0,3 L, mai a secco. Vale uguale appena sopra e appena
 *     sotto la riserva. Chi parte in riserva va a una pompa vicina, non a
 *     quella a cinquanta km che costa un centesimo meno. E mai con meno di
 *     quanto si arriverebbe in fondo senza fermarsi: deviare all'ultimo km
 *     per arrivare alla pompa piu in basso che a destinazione non serve;
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
/** Sotto lo zero si tollerano solo gli arrotondamenti dei conti, mai un litro vero. */
const ARROTONDAMENTO_L = 1e-9;

/** La riserva in litri: la frazione chiesta, se ha senso, altrimenti quella di sempre. */
export function riservaLitri(i: Pick<PianoInput, 'serbatoioL' | 'riservaFrazione'>): number {
  const f = i.riservaFrazione;
  return i.serbatoioL * (typeof f === 'number' && Number.isFinite(f) ? Math.min(1, Math.max(0, f)) : RISERVA);
}

/**
 * Con quanto si puo arrivare alla prima sosta quando la riserva non si puo
 * tenere: meta di quello che c'e, ma mai piu di meta riserva e mai meno di
 * 0,3 L (o della riserva, se e piu piccola). Cresce col carburante di
 * partenza, ma piu piano: con un decilitro
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

/*
 * Il conto della programmazione dinamica, scritto col «potenziale»: il
 * livello del serbatoio riportato al km 0, livello + km/kml. Ripartendo da
 * una pompa con potenziale π si arriva alla pompa j con π − (km di j piu la
 * sua deviazione)/kml litri, da qualunque pompa si venga: le ripartenze di
 * pompe diverse si confrontano senza guardare da dove.
 *
 * Per ogni potenziale il conto minimo per avercelo e una funzione lineare a
 * tratti (il «fronte»): i tratti hanno la pendenza del prezzo a cui si e
 * comprato l'ultimo litro, e una sosta che mette solo il minimo sposta il
 * tratto di chi ha comprato prima senza cambiarne la pendenza. Tenere tutta
 * la funzione, e non qualche livello scelto in anticipo, rende il conto
 * esatto anche con l'acquisto minimo: a volte conviene comprare dove costa
 * meno giusto quanto serve perche due soste obbligate piu avanti, piu
 * care, mettano cinque litri ciascuna e si arrivi in fondo con la riserva.
 */

/** Da dove viene un tratto del conto: serve a rifare le soste alla fine. */
interface Origine {
  /** La tappa da cui si riparte; −1 e la partenza. */
  tappa: number;
  /**
   * true: alla tappa si e arrivati con `arrivo` litri. false: si e messo il
   * minimo, e all'arrivo c'era la ripartenza meno LITRI_SOSTA.
   */
  fisso: boolean;
  arrivo: number;
  /** Come si e arrivati alla tappa; null per la partenza. */
  da: Origine | null;
}

/** Un tratto: su [x0, x1] vale y0 + s·(x − x0). */
interface Tratto {
  x0: number;
  x1: number;
  y0: number;
  s: number;
  o: Origine;
}

/** Un punto: il pieno da una tappa, o la partenza. */
interface Punto {
  x: number;
  y: number;
  o: Origine;
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

/** L'ultima sosta di un piano che arriva, con quanto si riparte da li e da dove viene. */
interface Fine {
  valore: number;
  tappa: number;
  ripartenza: number;
  o: Origine;
}

interface Esito {
  fine: Fine | null;
  /** Per ogni tappa, il modo migliore di ripartire col pieno; null se non ci si arriva. */
  pieni: Array<Punto | null>;
}

/** Tratti piu corti di cosi (in litri) sono arrotondamenti: si buttano. */
const CORTO = 1e-9;

const valoreIn = (t: Tratto, x: number): number => t.y0 + t.s * (x - t.x0);

/**
 * Il minimo di due funzioni fatte di tratti, ognuna in ordine e senza
 * sovrapposizioni. A parita vince la prima.
 */
function inviluppo(a: readonly Tratto[], b: readonly Tratto[]): Tratto[] {
  if (a.length === 0) return b.slice();
  if (b.length === 0) return a.slice();
  const out: Tratto[] = [];
  const emetti = (x0: number, x1: number, t: Tratto) => {
    if (x1 - x0 <= CORTO) return;
    const y0 = valoreIn(t, x0);
    const u = out[out.length - 1];
    // Lo stesso tratto spezzato da un confronto si ricuce.
    if (u && u.o === t.o && u.s === t.s && x0 - u.x1 <= CORTO && Math.abs(valoreIn(u, x0) - y0) <= 1e-9) {
      u.x1 = x1;
      return;
    }
    out.push({ x0, x1, y0, s: t.s, o: t.o });
  };
  let i = 0;
  let k = 0;
  let x = Math.min(a[0]!.x0, b[0]!.x0);
  for (;;) {
    while (i < a.length && a[i]!.x1 <= x) i++;
    while (k < b.length && b[k]!.x1 <= x) k++;
    const A = i < a.length ? a[i]! : null;
    const B = k < b.length ? b[k]! : null;
    if (!A && !B) break;
    const conA = A !== null && A.x0 <= x;
    const conB = B !== null && B.x0 <= x;
    if (!conA && !conB) {
      x = Math.min(A ? A.x0 : Infinity, B ? B.x0 : Infinity);
      continue;
    }
    let fine = Infinity;
    if (A) fine = Math.min(fine, conA ? A.x1 : A.x0);
    if (B) fine = Math.min(fine, conB ? B.x1 : B.x0);
    if (conA && conB) {
      const du = valoreIn(A, x) - valoreIn(B, x);
      const dv = valoreIn(A, fine) - valoreIn(B, fine);
      if (du <= 0 && dv <= 0) emetti(x, fine, A);
      else if (du >= 0 && dv >= 0) emetti(x, fine, B);
      else {
        const t = x + ((fine - x) * du) / (du - dv);
        emetti(x, t, du < 0 ? A : B);
        emetti(t, fine, du < 0 ? B : A);
      }
    } else emetti(x, fine, conA ? A! : B!);
    x = fine;
  }
  return out;
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
  /**
   * Un livello va bene se non sta sotto la soglia di piu di un metro di
   * strada, e mai sotto zero: li si tollerano solo gli arrotondamenti.
   */
  const almeno = (litri: number, soglia: number) => litri >= Math.max(0, soglia - eps) - ARROTONDAMENTO_L;
  const m = LITRI_SOSTA;

  const tappe = tappeSullaStrada(i.candidate, D);
  const n = tappe.length;
  const km = Float64Array.from(tappe, (t) => t.kmDaPartenza);
  const prezzo = Float64Array.from(tappe, (t) => t.prezzo);
  // La deviazione si fa andata e ritorno: arrivare alla pompa costa come
  // fare km + deviazione di strada, e ripartire da li e come ripartire dal
  // km km − deviazione. In litri dal km 0, come il potenziale.
  const andata = Float64Array.from(tappe, (t) => (t.kmDaPartenza + t.deviazioneKm) / kml);
  const ritorno = Float64Array.from(tappe, (t) => (t.kmDaPartenza - t.deviazioneKm) / kml);

  /**
   * Litri dalla pompa h alla pompa j: ritorno sulla strada da h, strada fra
   * le due, uscita verso j. h = −1 e la partenza, j = n l'arrivo.
   */
  const consumo = (h: number, j: number): number => (j >= n ? D / kml : andata[j]!) - (h < 0 ? 0 : ritorno[h]!);

  /** La programmazione dinamica, tappa per tappa in ordine di km. */
  const risolvi = (g: Regole): Esito => {
    const { fondoPrima, fondo, penali } = g;
    const pen = (a: number) => (penali ? penaleRiserva(a, R) : 0);
    const pendenzaPen = (a: number) => (!penali ? 0 : a < R / 2 ? -(PENALE_RISERVA_EUR_L + PENALE_FONDO_EUR_L) : a < R ? -PENALE_RISERVA_EUR_L : 0);
    const pieghe = penali ? [R / 2, R] : [];
    const casa: Origine = { tappa: -1, fisso: true, arrivo: S0, da: null };

    // Le ripartenze delle tappe gia viste: tratti e pieni. Entrano nel
    // fronte quando la tappa in corso e a piu di 0,4 km: da li in poi
    // valgono per tutte quelle dopo.
    let fronte: Tratto[] = [];
    let fronteDa = 0;
    const punti: Punto[] = [];
    const uscite: Array<{ tratti: Tratto[]; pieno: Punto | null } | null> = new Array(n).fill(null);
    const pieni: Array<Punto | null> = new Array<Punto | null>(n).fill(null);
    let attivate = 0;
    let fine: Fine | null = null;
    const proponi = (valore: number, tappa: number, ripartenza: number, o: Origine) => {
      if (!fine || valore < fine.valore - 1e-12) fine = { valore, tappa, ripartenza, o };
    };

    // Cosa si puo arrivare ad avere alla tappa in corso: tratti e punti nel
    // livello all'arrivo, gia col conto della sosta e del prezzo di qui.
    const tratti: Tratto[] = [];
    const puntiQui: Punto[] = [];

    for (let j = 0; j < n; j++) {
      for (; attivate < j && km[j]! - km[attivate]! > STESSO_PUNTO_KM; attivate++) {
        const u = uscite[attivate];
        if (!u) continue;
        if (u.tratti.length > 0) {
          fronte = inviluppo(fronteDa > 0 ? fronte.slice(fronteDa) : fronte, u.tratti);
          fronteDa = 0;
        }
        if (u.pieno) {
          // In ordine di potenziale.
          let k = punti.length;
          while (k > 0 && punti[k - 1]!.x > u.pieno.x) k--;
          punti.splice(k, 0, u.pieno);
        }
        uscite[attivate] = null;
      }
      // Nessuna tappa da qui in avanti si raggiunge con meno di questo.
      const minimoUtile = km[j]! / kml + fondo - eps;
      while (fronteDa < fronte.length && fronte[fronteDa]!.x1 < minimoUtile) fronteDa++;
      // Un pieno che il fronte batte allo stesso potenziale non serve piu:
      // il fronte puo solo scendere.
      {
        let q = fronteDa;
        let tieni = 0;
        for (const pt of punti) {
          if (pt.x < minimoUtile) continue;
          while (q < fronte.length && fronte[q]!.x1 < pt.x) q++;
          let battuto = false;
          for (let r = q; r < fronte.length && fronte[r]!.x0 <= pt.x && !battuto; r++) battuto = valoreIn(fronte[r]!, pt.x) <= pt.y + 1e-12;
          if (!battuto) punti[tieni++] = pt;
        }
        punti.length = tieni;
      }

      const A = andata[j]!;
      const p = prezzo[j]!;
      // Il conto g(a) = arrivare con a, piu la sosta e le penali, meno a·p:
      // ripartire con L comprando da a costa g(a) + L·p.
      tratti.length = 0;
      puntiQui.length = 0;
      const aggiungiTratto = (a0: number, a1: number, y0: number, s: number, o: Origine) => {
        // Le penali cambiano pendenza a meta riserva e alla riserva.
        let x = a0;
        let y = y0 + COSTO_SOSTA_EUR + pen(a0) - a0 * p;
        for (const k of pieghe) {
          if (k > x + CORTO && k < a1 - CORTO) {
            const sk = s + pendenzaPen((x + k) / 2) - p;
            tratti.push({ x0: x, x1: k, y0: y, s: sk, o });
            y += sk * (k - x);
            x = k;
          }
        }
        tratti.push({ x0: x, x1: a1, y0: y, s: s + pendenzaPen((x + a1) / 2) - p, o });
      };
      for (let q = fronteDa; q < fronte.length; q++) {
        const t = fronte[q]!;
        const a1 = t.x1 - A;
        if (a1 < fondo - eps) continue;
        const a0 = Math.max(t.x0 - A, fondo);
        if (a1 - a0 > CORTO) aggiungiTratto(a0, a1, valoreIn(t, a0 + A), t.s, t.o);
        // Un tratto che arriva al fondo per un soffio conta come un punto.
        else puntiQui.push({ x: a1, y: valoreIn(t, a1 + A) + COSTO_SOSTA_EUR + pen(a1) - a1 * p, o: t.o });
      }
      const ordinati = puntiQui.length === 0;
      for (const q of punti) {
        const a = q.x - A;
        if (almeno(a, fondo)) puntiQui.push({ x: a, y: q.y + COSTO_SOSTA_EUR + pen(a) - a * p, o: q.o });
      }
      const daCasa = S0 - A;
      if (almeno(daCasa, fondoPrima)) {
        puntiQui.push({ x: daCasa, y: COSTO_SOSTA_EUR + pen(daCasa) - daCasa * p, o: casa });
        // La partenza va al suo posto: gli altri sono gia in ordine.
        for (let k = puntiQui.length - 1; k > 0 && puntiQui[k - 1]!.x > puntiQui[k]!.x; k--) {
          const t = puntiQui[k]!;
          puntiQui[k] = puntiQui[k - 1]!;
          puntiQui[k - 1] = t;
        }
      }
      if (tratti.length === 0 && puntiQui.length === 0) continue;
      if (!ordinati) puntiQui.sort((u, v) => u.x - v.x);

      // Il minimo di g fin qui, Q(x) = min g(a) per a ≤ x: ripartire con L
      // costa L·p + Q(L − minimo). Dove Q e piatta si compra qui (pendenza
      // p); dove scende si porta avanti il carburante comprato prima, e qui
      // si mette il minimo.
      const finoA = T - m;
      const pieno = T - LITRI_MINIMI_SOSTA;
      const qTratti: Tratto[] = [];
      let minimo = Infinity;
      let piatto = 0;
      let origPiatto: Origine | null = null;
      let minimoPieno = Infinity;
      let origPieno: Origine | null = null;
      const chiudi = (x: number) => {
        if (origPiatto && x - piatto > CORTO) qTratti.push({ x0: piatto, x1: x, y0: minimo, s: 0, o: origPiatto });
      };
      const nuovoMinimo = (x: number, y: number, o: Origine) => {
        chiudi(x);
        minimo = y;
        piatto = x;
        origPiatto = { tappa: j, fisso: true, arrivo: x, da: o };
      };
      /** Arrivando oltre T − minimo il minimo non entra: si puo solo fare il pieno. */
      const versoPieno = (x: number, y: number, o: Origine) => {
        if (x <= pieno + eps && y < minimoPieno) {
          minimoPieno = y;
          origPieno = { tappa: j, fisso: true, arrivo: x, da: o };
        }
      };
      const punto = (x: number, y: number, o: Origine) => {
        if (x > finoA) versoPieno(x, y, o);
        else if (y < minimo) nuovoMinimo(x, y, o);
      };
      const tratto = (u: number, v: number, gu: number, s: number, o: Origine) => {
        if (v > finoA) {
          const da = Math.max(u, finoA);
          const a = Math.min(v, pieno);
          if (a >= da) {
            const gd = gu + s * (da - u);
            const ga = gu + s * (a - u);
            if (gd <= ga) versoPieno(da, gd, o);
            else versoPieno(a, ga, o);
          }
          if (u >= finoA) return;
          v = finoA;
        }
        const gv = gu + s * (v - u);
        if (s >= 0) {
          if (gu < minimo) nuovoMinimo(u, gu, o);
          return;
        }
        if (gv >= minimo) return;
        const t = gu > minimo ? u + (minimo - gu) / s : u;
        chiudi(t);
        if (v - t > CORTO) qTratti.push({ x0: t, x1: v, y0: gu + s * (t - u), s, o: { tappa: j, fisso: false, arrivo: NaN, da: o } });
        minimo = gv;
        piatto = v;
        origPiatto = { tappa: j, fisso: true, arrivo: v, da: o };
      };
      let ip = 0;
      for (const t of tratti) {
        let u = t.x0;
        let gu = t.y0;
        while (ip < puntiQui.length && puntiQui[ip]!.x <= t.x1) {
          const q = puntiQui[ip]!;
          if (q.x > u) {
            tratto(u, q.x, gu, t.s, t.o);
            gu += t.s * (q.x - u);
            u = q.x;
          }
          punto(q.x, q.y, q.o);
          ip++;
        }
        if (t.x1 > u) tratto(u, t.x1, gu, t.s, t.o);
      }
      for (; ip < puntiQui.length; ip++) punto(puntiQui[ip]!.x, puntiQui[ip]!.y, puntiQui[ip]!.o);
      chiudi(finoA);

      // Le ripartenze da qui, nel potenziale: L = x + minimo, valore Q(x) + L·p.
      const rit = ritorno[j]!;
      const uscitaTratti: Tratto[] = qTratti.map((t) => ({
        x0: t.x0 + m + rit,
        x1: t.x1 + m + rit,
        y0: t.y0 + (t.x0 + m) * p,
        s: t.s + p,
        o: t.o,
      }));
      // Col pieno: dal minimo di Q fino a T − minimo, o arrivando gia quasi pieni.
      let pienoQui: Punto | null = null;
      if (origPiatto && minimo < Infinity) pienoQui = { x: T, y: minimo + T * p, o: origPiatto };
      if (origPieno && (!pienoQui || minimoPieno + T * p < pienoQui.y - 1e-12)) pienoQui = { x: T, y: minimoPieno + T * p, o: origPieno };
      pieni[j] = pienoQui;
      const ultimo = uscitaTratti[uscitaTratti.length - 1];
      const pienoAParte = pienoQui !== null && (!ultimo || ultimo.x1 < T + rit - CORTO || valoreIn(ultimo, T + rit) > pienoQui.y + 1e-12);
      uscite[j] = {
        tratti: uscitaTratti,
        pieno: pienoAParte ? { x: T + rit, y: pienoQui!.y, o: pienoQui!.o } : null,
      };

      // Da qui all'arrivo: il minimo del conto fra le ripartenze che
      // arrivano in fondo col fondo, piu le penali dell'arrivo.
      const cFine = consumo(j, n);
      if (cFine > T - fondo + eps) continue;
      const minimoL = cFine + fondo;
      for (const t of uscitaTratti) {
        const l0 = t.x0 - rit;
        const l1 = t.x1 - rit;
        if (l1 < minimoL - eps) continue;
        const prova = (L: number) => proponi(valoreIn(t, L + rit) + pen(L - cFine), j, L, t.o);
        prova(Math.max(l0, Math.min(l1, minimoL)));
        prova(l1);
        for (const k of pieghe) if (cFine + k > l0 && cFine + k < l1) prova(cFine + k);
      }
      if (pienoQui && almeno(T - cFine, fondo)) proponi(pienoQui.y + pen(T - cFine), j, T, pienoQui.o);
    }
    return { fine, pieni };
  };

  /** Dalle tappe e dai livelli di ripartenza alle soste vere, rifacendo il viaggio litro per litro. */
  const realizza = (sequenza: readonly number[], ripartenze: readonly number[]) => {
    const soste: Sosta[] = [];
    const arrivi: number[] = [];
    let livello = S0;
    for (let t = 0; t < sequenza.length; t++) {
      const j = sequenza[t]!;
      const arrivo = livello - consumo(t === 0 ? -1 : sequenza[t - 1]!, j);
      const dopo = Math.min(T, ripartenze[t]!);
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

  /** Le soste di un piano, dall'ultima all'indietro: tappe e livelli di ripartenza. */
  const daOrigine = (tappa: number, ripartenza: number, o: Origine) => {
    const sequenza: number[] = [];
    const ripartenze: number[] = [];
    let j = tappa;
    let L = ripartenza;
    let x: Origine = o;
    for (;;) {
      sequenza.push(j);
      ripartenze.push(L);
      const arrivo = x.fisso ? x.arrivo : L - m;
      const prima = x.da;
      if (!prima || prima.tappa < 0) break;
      L = arrivo + consumo(prima.tappa, j);
      j = prima.tappa;
      x = prima;
    }
    return { sequenza: sequenza.reverse(), ripartenze: ripartenze.reverse() };
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
      // Ogni giro accetta arrivi fino a un metro di strada sotto la soglia,
      // ma mai sotto zero: qui si tolgono solo arrotondamenti.
      litriAllArrivo: Math.max(0, finale),
      arrivoSottoRiserva: finale < R - eps,
      sostaInRiserva: inRiserva >= 0 ? inRiserva + 1 : null,
      spesaPienoPrima,
      risparmioEur: spesaPienoPrima === null ? null : spesaPienoPrima - spesaCarburante,
    };
  };

  const dalFine = (f: Fine): Piano => {
    const { sequenza, ripartenze } = daOrigine(f.tappa, f.ripartenza, f.o);
    const r = realizza(sequenza, ripartenze);
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
  if (almeno(finaleSenzaSoste, R)) return componi([], [], finaleSenzaSoste);
  const fondoPrima = fondoPrimaSosta(S0, R);

  // 1. La riserva a ogni pompa e in fondo. Chi parte sotto la riserva alla
  // prima pompa non ci arriva con la riserva: il giro non serve.
  if (almeno(S0, R)) {
    const e = risolvi({ fondoPrima: R, fondo: R, penali: false });
    if (e.fine) return dalFine(e.fine);
  }
  // 2. La prima sosta un po' in riserva, mai troppo, e mai piu giu di dove
  // si arriverebbe senza fermarsi: una pompa dove si arriva con meno sta,
  // deviazione compresa, oltre l'arrivo. Fermarsi li costa e non rende il
  // viaggio piu sicuro. Vuol dire che (km + deviazione) della prima pompa
  // non supera la distanza: non dipende dal carburante di partenza, e
  // con piu carburante resta ammesso tutto quello che lo era con meno.
  const senzaSosteArriva = almeno(finaleSenzaSoste, 0);
  if (fondoPrima < R - eps) {
    const e = risolvi({ fondoPrima: senzaSosteArriva ? Math.max(fondoPrima, finaleSenzaSoste) : fondoPrima, fondo: R, penali: false });
    if (e.fine) return dalFine(e.fine);
  }
  // 3. Il ripiego: prima di tutto il piano il cui punto piu basso e il piu
  // alto possibile; fra quelli, il conto piu basso, con le penali che
  // tengono gli altri arrivi alla riserva quando si puo. Senza soste solo
  // se e piu sicuro: arriva in fondo con piu di quanto qualunque piano con
  // soste tenga nel suo punto piu basso. Cosi il punto piu basso del piano
  // sale sempre col carburante di partenza.
  const piuAlto = livelloPiuAlto();
  if (senzaSosteArriva && finaleSenzaSoste > piuAlto + eps) return componi([], [], finaleSenzaSoste);
  if (piuAlto >= -eps) {
    const f = Math.max(0, piuAlto);
    const e = risolvi({ fondoPrima: f, fondo: f, penali: true });
    if (e.fine) return dalFine(e.fine);
  }
  // Una rete di sicurezza: il livello piu alto si calcola col pieno a ogni
  // sosta, e se un pieno non si potesse fare il conto qui sopra non
  // troverebbe niente.
  if (senzaSosteArriva) return componi([], [], finaleSenzaSoste);
  const ripiego = risolvi({ fondoPrima: 0, fondo: 0, penali: true });
  if (ripiego.fine) return dalFine(ripiego.fine);

  // Non si arriva: dove si resta a secco, col pieno all'ultima pompa
  // raggiungibile, e le soste per arrivarci. Senza pompe raggiungibili,
  // dove finisce il carburante di adesso.
  let bloccoAlKm = S0 * kml;
  let ultima = -1;
  for (let j = 0; j < n; j++) {
    if (!ripiego.pieni[j]) continue;
    const finoA = ritorno[j]! * kml + T * kml;
    if (finoA > bloccoAlKm) {
      bloccoAlKm = finoA;
      ultima = j;
    }
  }
  let soste: Sosta[] = [];
  if (ultima >= 0) {
    const { sequenza, ripartenze } = daOrigine(ultima, T, ripiego.pieni[ultima]!.o);
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

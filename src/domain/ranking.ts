import type { FuelKey } from './raw';
import type { StationRow } from './parse';
import { prezzoAllaPompa } from './parse';
import type { Cohort, CohortIndex } from './market';
import { cohortFor } from './market';
import type { PriceLevel } from './pricing';
import { priceLevel } from './pricing';
import type { LatLng } from './geo';
import { haversineKm } from './geo';
import { ageHours, confidenceFor, isLikelyClosed, ritardoSulLotto, ultimoPrezzo } from './freshness';
import type { Anomalia } from './anomalie';
import { giudiceAnomalie } from './anomalie';

/*
  Il consiglio della Home: dove conviene fare il pieno qui vicino.

  Tre domande, in quest'ordine.
  1. Di chi ci si puo fidare? Non dei bloccati, dei forse chiusi, degli
     impianti in autostrada (chi e in citta non ci entra per fare benzina)
     e dei prezzi che il mercato della zona smentisce (anomalie.ts). Fra
     quelli, solo dei prezzi abbastanza recenti: vedi ORE_RIFERIMENTO_FRESCO.
  2. Contro cosa si misura il risparmio? Contro il pieno che faresti
     comunque: il distributore utilizzabile piu vicino. Se pero poco piu in
     la ce n'e uno che conviene davvero, contando strada e tempo con lo
     stesso conto del consiglio, e da quello che andresti: un vicino caro
     non gonfia niente, e lo scambio non regala strada a nessuno. Il servito
     e un altro prodotto: chi ha il self a portata guarda il self.
  3. Chi vince? Quello che ti lascia piu soldi in tasca contando la strada in
     piu, purche ne valga il tempo: ogni minuto in piu deve rendere almeno
     EURO_PER_MINUTO, e oltre MAX_MINUTI_IN_PIU dal piu vicino (servito
     compreso) non si va. Il tempo decide la scelta, ma nel numero mostrato
     non entra: «risparmi X €» sono euro veri, carburante risparmiato meno
     carburante della strada. E il consigliato non costa mai piu del pieno
     che faresti comunque: «in tasca» non e mai negativo.
*/

/** Sotto questo scarto due impianti sono pari e vince il piu vicino. */
export const TIE_EURO = 0.15;

/**
 * Le distanze sono in linea d'aria, le strade no: per arrivare a un
 * distributore a 3 km se ne fanno di solito quasi 4. Senza questo fattore
 * il costo della strada era sottostimato e i distributori lontani
 * sembravano piu convenienti di quanto sono.
 */
export const FATTORE_STRADA = 1.3;

/** Velocita media in citta per stimare i minuti: la stessa di «circa N min» nella Home. */
export const VELOCITA_KMH = 35;

/**
 * Quanto deve farti risparmiare ogni minuto di strada in piu perche valga la
 * pena: nove euro l'ora. Non e uno stipendio, e la soglia oltre la quale ti
 * gireresti dall'altra parte. Pesa nella scelta e mai nel numero mostrato.
 */
export const EURO_PER_MINUTO = 0.15;

/** Oltre questi minuti in piu fra andata e ritorno non si consiglia, qualunque sia il risparmio. */
export const MAX_MINUTI_IN_PIU = 20;

/** Il pieno che faresti comunque lo si cerca qui intorno, non dall'altra parte della provincia. */
export const RAGGIO_ZONA_KM = 15;

/**
 * L'eta dei prezzi, sul lotto. Un prezzo di non piu di cinque giorni prima
 * degli ultimi arrivati e recente. Se intorno al piu vicino (entro la strada
 * che si fa in MAX_MINUTI_IN_PIU) ce n'e almeno uno recente si sceglie fra
 * quelli, altrimenti fra tutti (oltre sette giorni l'impianto e forse chiuso
 * e non conta comunque). La regola vale insieme per il consiglio e per il
 * pieno che faresti comunque.
 *
 * Era tre giorni, con un secondo gradino a cinque: a Lugo l'Eni di via
 * Piratello, a un km e 6 centesimi sotto tutti, fermo allo stesso prezzo da
 * 72 ore e mezza, spariva dal consiglio per mezz'ora di troppo. Il gestore
 * comunica quando cambia: un prezzo fermo da qualche giorno e quasi sempre
 * quello vero. Fra i recenti, quanto e vecchio lo dice la fiducia
 * (confidenceFor), che sconta il risparmio.
 */
export const ORE_RIFERIMENTO_FRESCO = 120;

/**
 * Il pieno «senza pensarci» lo faresti dal piu vicino, oppure da uno al
 * massimo un km piu in la del self piu vicino quando ti conviene davvero:
 * piu soldi in tasca di TIE_EURO, contati strada e tempo, come per il
 * consiglio.
 */
export const KM_ALTERNATIVA_VICINA = 1;


/** Consumo di riserva quando il veicolo non dichiara nulla, in km/l. */
const KML_DI_RIPIEGO = 15;

/** Minuti di guida per `km` di strada, alla velocita media di citta. */
export function minutiStrada(km: number): number {
  return km > 0 ? (km / VELOCITA_KMH) * 60 : 0;
}

/** Km di strada (andata e ritorno, col fattore strada) per arrivare `kmInPiu` in linea d'aria piu in la. */
function stradaInPiu(kmInPiu: number): number {
  return 2 * Math.max(0, kmInPiu) * FATTORE_STRADA;
}

/** Minuti in piu, andata e ritorno, per un impianto a `km` invece che a `daKm`. */
function minutiDa(km: number, daKm: number): number {
  return minutiStrada(stradaInPiu(km - daKm));
}

/** Quanti km in linea d'aria piu in la del piu vicino si puo andare restando nei MAX_MINUTI_IN_PIU. */
export const KM_PORTATA = ((MAX_MINUTI_IN_PIU / 60) * VELOCITA_KMH) / (2 * FATTORE_STRADA);

/**
 * Il pieno che faresti comunque: un distributore vero, col suo prezzo e la
 * sua distanza. Vedi trovaRiferimento.
 */
export interface Riferimento {
  price: number;
  distanceKm: number;
  /** L'impianto che fa da riferimento. */
  id?: string;
  /** Il riferimento ha solo il servito: qui intorno non c'e un self utilizzabile. */
  alServito?: boolean;
  /**
   * Il piu vicino, quando non e lui il riferimento: un km piu in la ce n'e
   * uno che conviene davvero, contando strada e tempo.
   */
  vicinoCaro?: { price: number; distanceKm: number; id?: string };
  /** Quanto piu vicino ci sono distributori utilizzabili esclusi: col prezzo vecchio, o col solo servito. */
  piuVicini?: { vecchi: number; alServito: number };
  /**
   * La distanza del piu vicino con un prezzo recente, servito compreso: da
   * li si contano i minuti in piu di tutti.
   */
  daKm?: number;
  /** Il riferimento e al servito anche se un self recente c'e: contando strada e tempo non conviene di piu. */
  selfNonConviene?: boolean;
}

export interface NetInput {
  price: number;
  cohortAvg: number;
  /**
   * Quando c'e, il conto si fa rispetto a lui invece che rispetto alla media
   * di provincia. Vedi netSaving per il perche.
   */
  riferimento?: Riferimento;
  liters: number;
  distanceKm: number;
  kml: number;
  confidence: number;
}

export interface NetBreakdown extends NetInput {
  gross: number;
  /** Km di strada contati nel costo (andata e ritorno, gia col fattore strada). */
  kmStrada: number;
  roadCost: number;
  net: number;
}

/**
 * Il netto: quanto ti resta in tasca davvero.
 *
 * La domanda non e «conviene fare il pieno?», e «conviene farlo QUI invece
 * che dove lo farei comunque». Il carburante lo compri in ogni caso: il
 * confronto giusto e col riferimento, e i chilometri che contano sono solo
 * quelli IN PIU rispetto a raggiungere lui.
 *
 * Sono euro veri: carburante risparmiato meno carburante della strada. Il
 * tempo non c'e — pesa nella scelta (rankStations), non in questo numero.
 *
 * Senza riferimento si ricade sulla media di provincia e su andata e
 * ritorno dedicati: serve a chi chiama netSaving per conto suo.
 *
 * Per il metano kml e km/kg e il prezzo €/kg: la formula regge, cambia
 * l'unita di misura sotto e i conti restano coerenti.
 */
export function netSaving(i: NetInput): NetBreakdown {
  const kml = i.kml > 0 ? i.kml : KML_DI_RIPIEGO;
  const rif = i.riferimento;

  const gross = ((rif ? rif.price : i.cohortAvg) - i.price) * i.liters;

  // Andata e ritorno, perche per il pieno si esce e si torna: fin dove
  // arrivavi comunque non si paga niente.
  const kmStrada = stradaInPiu(rif ? i.distanceKm - rif.distanceKm : i.distanceKm);
  const roadCost = (kmStrada / kml) * i.price;

  // La fiducia sconta il guadagno, non la perdita: un prezzo vecchio puo
  // essere ottimista, ma i chilometri per andarci li fai comunque.
  const net = gross >= 0 ? gross * i.confidence - roadCost : gross - roadCost;

  return { ...i, gross, kmStrada, roadCost, net };
}

export type IneligibleReason = 'bloccato' | 'probabilmente-chiuso' | 'autostrada' | Anomalia;

/**
 * Utilizzabile ma non consigliabile: col prezzo troppo vecchio mentre qui
 * intorno ce ne sono di recenti, o troppo lontano dal piu vicino.
 */
export type MotivoNonConsigliabile = 'prezzo-vecchio' | 'troppa-strada';

export interface RankContext {
  fuel: FuelKey;
  user: LatLng;
  cohorts: CohortIndex;
  now: Date;
  liters: number;
  kml: number;
  blocked: Set<string>;
  /**
   * Se c'e, si classificano solo gli impianti entro questo raggio. Il
   * giudizio sui prezzi guarda comunque tutte le righe: la zona e le
   * conferme non si fermano al bordo della lista.
   */
  raggioKm?: number;
}

export interface RankedStation {
  row: StationRow;
  /** Il prezzo che si paga: il self, o il servito dove il self non c'e. */
  price: number;
  /** true se `price` e il servito: l'impianto non ha il self per questo carburante. */
  alServito: boolean;
  distanceKm: number;
  cohort: Cohort;
  z: number | null;
  level: PriceLevel;
  reliable: boolean;
  ageH: number | null;
  /**
   * Ore di ritardo rispetto al prezzo piu recente del lotto: col seme di un
   * mese fa sono vecchi i dati, non i distributori. Decide chi e chiuso, chi
   * fa da riferimento e chi si puo consigliare; null senza data.
   */
  ritardoH: number | null;
  /** Quanto ci si fida del prezzo adesso, dall'eta vera: sconta il risparmio. */
  confidence: number;
  net: NetBreakdown;
  /**
   * Minuti di strada in piu rispetto al piu vicino utilizzabile con un
   * prezzo recente, servito compreso (quello dove andresti senza pensarci),
   * andata e ritorno.
   */
  minutiInPiu: number;
  /**
   * Il netto meno il valore del tempo in piu: serve solo a scegliere, non si
   * mostra mai come euro.
   */
  punteggio: number;
  eligible: boolean;
  reason?: IneligibleReason;
  /** Utilizzabile, abbastanza recente e entro MAX_MINUTI_IN_PIU: si puo consigliare. */
  consigliabile: boolean;
  /** Perche un utilizzabile non si consiglia. */
  nonConsigliabile?: MotivoNonConsigliabile;
  /**
   * Non comunica un prezzo da oltre una settimana mentre gli altri si: quasi
   * sempre chiuso. Si mostra spento in lista, ma non si consiglia e non fa
   * da metro. L'eta si misura sul lotto e non sull'orologio: col seme di un
   * mese fa sono vecchi i dati, non i distributori.
   */
  probabilmenteChiuso: boolean;
}

interface Candidato {
  row: StationRow;
  price: number;
  alServito: boolean;
  cohort: Cohort;
  distanceKm: number;
  ageH: number | null;
  ritardoH: number | null;
  confidence: number;
  chiuso: boolean;
}

/**
 * Il prezzo di riferimento della zona per gli autostradali: la mediana delle
 * cinque pompe stradali piu vicine entro 15 km. Serve solo al livello di
 * prezzo: fra impianti autostradali tutti cari, il meno caro non e un affare.
 * Con meno di tre campioni non lo si calcola.
 */
function baselineLocale(candidati: Candidato[]): number | null {
  const stradali = candidati
    .filter((c) => !c.row.isHighway && c.distanceKm <= 15)
    .sort((a, b) => a.distanceKm - b.distanceKm);
  if (stradali.length < 3) return null;
  return mediana(stradali.slice(0, 5).map((x) => x.price));
}

function mediana(valori: number[]): number {
  const v = [...valori].sort((a, b) => a - b);
  const m = v.length >> 1;
  return v.length % 2 ? v[m]! : (v[m - 1]! + v[m]!) / 2;
}

/** L'eta massima, sul lotto, dei prezzi fra cui scegliere: vedi ORE_RIFERIMENTO_FRESCO. */
function sogliaEta(utilizzabili: Candidato[]): number {
  const primo = utilizzabili[0];
  if (!primo) return Infinity;
  const portata = primo.distanceKm + KM_PORTATA;
  for (const c of utilizzabili) {
    if (c.distanceKm > portata) break;
    if ((c.ritardoH ?? Infinity) <= ORE_RIFERIMENTO_FRESCO) return ORE_RIFERIMENTO_FRESCO;
  }
  return Infinity;
}

export function rankStations(rows: StationRow[], ctx: RankContext): RankedStation[] {
  // Chiuso e recente si misurano sul lotto (il prezzo piu recente fra tutte
  // le righe); la fiducia invece sull'orologio, perche dice quanto un prezzo
  // puo essere cambiato da allora.
  const ultimo = ultimoPrezzo(rows);
  const raggio = ctx.raggioKm ?? Infinity;

  const candidati: Candidato[] = [];
  for (const row of rows) {
    const distanceKm = haversineKm(ctx.user, row);
    if (distanceKm > raggio) continue;
    const pompa = prezzoAllaPompa(row, ctx.fuel);
    if (!pompa) continue;
    const cohort = cohortFor(row, ctx.fuel, ctx.cohorts);
    if (!cohort) continue;
    const ageH = ageHours(row.updated, ctx.now);
    const ritardoH = ritardoSulLotto(row.updated, ultimo);
    candidati.push({
      row,
      price: pompa.prezzo,
      alServito: pompa.alServito,
      cohort,
      distanceKm,
      ageH,
      ritardoH,
      confidence: confidenceFor(ageH),
      chiuso: isLikelyClosed(ritardoH),
    });
  }
  candidati.sort((a, b) => a.distanceKm - b.distanceKm);

  const baseline = baselineLocale(candidati);
  const anomalia = giudiceAnomalie(rows, ctx.fuel, ctx.cohorts);

  const giudizio = candidati.map((c) => {
    const { level, z, reliable } = priceLevel(
      c.price,
      c.cohort,
      c.row.isHighway && baseline !== null ? baseline : undefined
    );
    let reason: IneligibleReason | undefined;
    if (ctx.blocked.has(c.row.id)) reason = 'bloccato';
    else if (c.chiuso) reason = 'probabilmente-chiuso';
    else if (c.row.isHighway) reason = 'autostrada';
    else reason = anomalia(c.row, c.price);
    return { c, level, z, reliable, reason };
  });

  // Gli utilizzabili, dal piu vicino; fra loro quelli abbastanza recenti.
  const utilizzabili = giudizio.filter((g) => g.reason === undefined).map((g) => g.c);
  const soglia = sogliaEta(utilizzabili);
  const recente = (c: Candidato) => (c.ritardoH ?? Infinity) <= soglia;
  const scelti = utilizzabili.filter(recente);

  const rif = trovaRiferimento(scelti, utilizzabili, ctx);
  const daKm = rif?.daKm ?? 0;

  const out: RankedStation[] = giudizio.map(({ c, level, z, reliable, reason }) => {
    // Un impianto autostradale va confrontato col mercato che l'utente
    // avrebbe davvero a disposizione, non con gli altri autostradali.
    const effectiveCohortAvg = c.row.isHighway && baseline ? baseline : c.cohort.avg;
    const net = netSaving({
      price: c.price,
      cohortAvg: effectiveCohortAvg,
      riferimento: rif?.riferimento,
      liters: ctx.liters,
      distanceKm: c.distanceKm,
      kml: ctx.kml,
      confidence: c.confidence,
    });
    const minutiInPiu = rif ? minutiDa(c.distanceKm, daKm) : minutiStrada(net.kmStrada);
    const eligible = reason === undefined;
    const nonConsigliabile: MotivoNonConsigliabile | undefined = !eligible
      ? undefined
      : !recente(c)
        ? 'prezzo-vecchio'
        : minutiInPiu > MAX_MINUTI_IN_PIU
          ? 'troppa-strada'
          : undefined;

    return {
      row: c.row,
      price: c.price,
      alServito: c.alServito,
      distanceKm: c.distanceKm,
      cohort: c.cohort,
      z,
      level,
      reliable,
      ageH: c.ageH,
      ritardoH: c.ritardoH,
      confidence: c.confidence,
      net,
      minutiInPiu,
      punteggio: net.net - EURO_PER_MINUTO * minutiInPiu,
      eligible,
      reason,
      consigliabile: eligible && nonConsigliabile === undefined && rif !== null,
      nonConsigliabile,
      probabilmenteChiuso: c.chiuso,
    };
  });

  out.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    return b.punteggio - a.punteggio || a.distanceKm - b.distanceKm;
  });
  return out;
}

/**
 * Il pieno che faresti comunque, fra i consigliabili (`scelti`, gia in
 * ordine di distanza): le stesse regole di eta del consiglio, cosi il
 * risparmio non si misura mai contro un prezzo che non si potrebbe
 * consigliare.
 *
 * Si parte dal piu vicino, servito compreso: e li che andresti senza
 * pensarci, e da lui si contano i minuti in piu di tutti (`daKm`). Nessun
 * riferimento sta oltre MAX_MINUTI_IN_PIU da lui, quindi il riferimento si
 * puo sempre consigliare.
 *
 * Poi le alternative, valutate col conto del consiglio rispetto al piu
 * vicino: carburante risparmiato (scontato dalla fiducia), meno la strada e
 * il tempo in piu. Il servito e un altro prodotto: se a portata c'e un self
 * recente, le alternative sono lui e i self al massimo KM_ALTERNATIVA_VICINA
 * piu in la (un vicino caro non fa da metro). Senza self, i serviti in
 * quel km. Un'alternativa prende il posto del piu vicino solo se gli porta
 * piu di TIE_EURO; fra quelle che convengono, a parita entro TIE_EURO, la
 * piu vicina. Lo scambio non regala niente: la strada fino all'alternativa
 * e gia pagata dal suo prezzo, e i minuti si contano comunque dal piu vicino.
 */
function trovaRiferimento(
  scelti: Candidato[],
  utilizzabili: Candidato[],
  ctx: RankContext
): { riferimento: Riferimento; daKm: number } | null {
  const primo = scelti[0];
  if (!primo) return null;
  const daKm = primo.distanceKm;
  const aPortata = (c: Candidato) => minutiDa(c.distanceKm, daKm) <= MAX_MINUTI_IN_PIU;

  const kml = ctx.kml > 0 ? ctx.kml : KML_DI_RIPIEGO;
  const valore = (c: Candidato) => {
    const lordo = (primo.price - c.price) * ctx.liters;
    const km = stradaInPiu(c.distanceKm - daKm);
    return (lordo >= 0 ? lordo * c.confidence : lordo) - (km / kml) * c.price - EURO_PER_MINUTO * minutiStrada(km);
  };

  const selfVicino = scelti.find((c) => !c.alServito && aPortata(c));
  const base = selfVicino ?? primo;
  const finestra = scelti.filter(
    (c) => c.alServito === base.alServito && c.distanceKm <= base.distanceKm + KM_ALTERNATIVA_VICINA && aPortata(c)
  );
  const migliore = Math.max(...finestra.map(valore));
  // Fra quelle che convengono, a parita entro TIE_EURO, la piu vicina.
  const scelto =
    migliore > TIE_EURO ? (finestra.find((c) => valore(c) > TIE_EURO && valore(c) >= migliore - TIE_EURO) ?? primo) : primo;

  // Il «piu vicino» che il foglio Perche mostra: il riferimento stesso, o
  // quello da cui ci si e spostati (il self piu vicino, o il piu vicino).
  const mostrato = scelto === primo || scelto === base ? scelto : base;
  const vecchi = utilizzabili.filter((c) => c.distanceKm < mostrato.distanceKm && !scelti.includes(c)).length;
  const alServito = scelti.filter((c) => c.distanceKm < mostrato.distanceKm && c.alServito).length;

  return {
    daKm,
    riferimento: {
      price: scelto.price,
      distanceKm: scelto.distanceKm,
      id: scelto.row.id,
      alServito: scelto.alServito || undefined,
      vicinoCaro:
        scelto === mostrato ? undefined : { price: mostrato.price, distanceKm: mostrato.distanceKm, id: mostrato.row.id },
      piuVicini: vecchi + alServito > 0 ? { vecchi, alServito } : undefined,
      daKm,
      selfNonConviene: (scelto.alServito && scelti.some((c) => !c.alServito)) || undefined,
    },
  };
}

export interface Classifica {
  best: RankedStation | null;
  /** Tutti, con il consigliato in testa: vedi classifica. */
  lista: RankedStation[];
}

/**
 * Il consiglio e l'ordine della lista, decisi insieme perche non possano
 * dirsi cose diverse.
 *
 * Fra i consigliabili vince il punteggio piu alto (il netto meno il valore
 * del tempo), ma fra tutti quelli che gli stanno entro TIE_EURO vince il piu
 * vicino. Fatto in due passaggi e non nel comparatore, perche un confronto
 * con tolleranza non e un ordinamento.
 *
 * Il consigliato non ti lascia mai meno del pieno che faresti comunque: chi
 * ha un netto negativo non si consiglia, anche se ci mette meno minuti. Il
 * riferimento e consigliabile e ha netto zero, quindi un consiglio c'e
 * sempre. Succede con un prezzo meno recente fra il vicino caro e il
 * riferimento: piu vicino, ma un mezzo centesimo piu caro.
 *
 * La lista: il consigliato; poi gli altri consigliabili per risparmio
 * mostrato (quelli che rendono di piu del consigliato ci mettono piu minuti,
 * e la riga lo dice); poi gli utilizzabili che non si consigliano (troppa
 * strada, prezzo vecchio), poi gli esclusi, col loro motivo.
 */
export function classifica(ranked: RankedStation[]): Classifica {
  const gruppo = (r: RankedStation) => (r.consigliabile ? 0 : r.eligible ? 1 : 2);
  const ordinati = [...ranked].sort(
    (a, b) => gruppo(a) - gruppo(b) || b.punteggio - a.punteggio || a.distanceKm - b.distanceKm
  );

  const consigliabili = ordinati.filter((r) => r.consigliabile);
  const senzaPerdite = consigliabili.filter((r) => r.net.net >= 0);
  const candidati = senzaPerdite.length > 0 ? senzaPerdite : consigliabili;
  const leader = candidati[0];
  if (!leader) return { best: null, lista: ordinati };

  // A parita vince il piu vicino.
  let best = leader;
  for (const r of candidati) {
    if (leader.punteggio - r.punteggio > TIE_EURO) break;
    if (r.distanceKm < best.distanceKm) best = r;
  }

  const altri = consigliabili
    .filter((r) => r !== best)
    .sort((a, b) => b.net.net - a.net.net || a.distanceKm - b.distanceKm);
  return { best, lista: [best, ...altri, ...ordinati.filter((r) => !r.consigliabile)] };
}

/** Il consigliato: vedi classifica. */
export function pickBest(ranked: RankedStation[]): RankedStation | null {
  return classifica(ranked).best;
}

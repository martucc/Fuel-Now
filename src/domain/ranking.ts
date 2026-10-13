import type { FuelKey } from './raw';
import type { StationRow } from './parse';
import type { Cohort, CohortIndex } from './market';
import { cohortFor } from './market';
import type { PriceLevel } from './pricing';
import { priceLevel, Z_ABSURD } from './pricing';
import type { LatLng } from './geo';
import { haversineKm } from './geo';
import { ageHours, confidenceFor, isLikelyClosed } from './freshness';
import type { Percorso } from './corridoio';
import { proiettaSuPercorso, deviazioneDaScostamento } from './corridoio';

/** Sotto questo scarto di netto due impianti sono pari e decide la distanza. */
export const TIE_EURO = 0.15;

/** Deviazione minima ammessa per un rientro ordinario, in km. */
export const MAX_COMMUTE_DETOUR_KM = 6.0;

/**
 * Quanto puo allungare il rientro prima che smetta di essere «lungo la strada».
 *
 * Non e una costante secca: su un rientro da 4 km sei chilometri di deviazione
 * sono un altro viaggio, su uno da 80 km sono un'inezia. Sta qui, esportata,
 * perche la usano sia il ranking sia la Home: scritta due volte, divergerebbe.
 */
export function limiteDeviazioneKm(percorsoDirettoKm: number): number {
  return Math.max(MAX_COMMUTE_DETOUR_KM, percorsoDirettoKm * 0.25);
}

/**
 * Il costo di un chilometro in piu che non sia il carburante: gomme, freni,
 * tagliandi anticipati. Il carburante e contato a parte, col prezzo vero.
 */
export const USURA_EURO_KM = 0.06;

/**
 * Quanto vale un'ora del tuo tempo in questa app. Volutamente bassa: non e
 * uno stipendio, e la soglia oltre la quale ti gireresti dall'altra parte
 * invece di allungare. Con nove euro l'ora, dieci minuti di deviazione ne
 * valgono uno e mezzo — che e piu o meno quando uno smette di avere voglia.
 */
export const VALORE_TEMPO_EURO_ORA = 9;

/** Velocita media di una deviazione: rotonde, semafori, immissioni. */
export const VELOCITA_DEVIAZIONE_KMH = 35;

/** Rampe, casello, rientro in carreggiata: uscire dall'autostrada costa tempo. */
export const MINUTI_USCITA_AUTOSTRADA = 8;

/** Consumo di riserva quando il veicolo non dichiara nulla, in km/l. */
const KML_DI_RIPIEGO = 15;

/**
 * L'attrito di una deviazione, in euro.
 *
 * Prima era una scala a tre gradini con dentro un termine quadratico scelto
 * a occhio. Adesso e tempo perso per il valore del tempo, piu usura: due
 * numeri che si possono discutere e, soprattutto, spiegare all'utente
 * («ti costa sei minuti»). Resta lineare — non serve la curva per bocciare
 * i venti chilometri per venti centesimi, ci pensa gia il prezzo dell'ora.
 */
export function calculateDetourFriction(detourKm: number): number {
  if (detourKm <= 0) return 0;
  const oreperse = detourKm / VELOCITA_DEVIAZIONE_KMH;
  return oreperse * VALORE_TEMPO_EURO_ORA + detourKm * USURA_EURO_KM;
}

/** Minuti persi per una deviazione: e il numero che finisce nella scheda. */
export function minutiDeviazione(detourKm: number, isHighway = false): number {
  if (detourKm <= 0 && !isHighway) return 0;
  const guida = (Math.max(0, detourKm) / VELOCITA_DEVIAZIONE_KMH) * 60;
  return guida + (isHighway ? MINUTI_USCITA_AUTOSTRADA : 0);
}

/**
 * Il pieno che faresti senza pensarci: il distributore utilizzabile piu
 * vicino. E il termine di paragone vero, perche il carburante lo compri
 * comunque — la scelta non e «andare o non andare», e «andare qui o li».
 */
export interface Riferimento {
  price: number;
  distanceKm: number;
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
  isHighway?: boolean;
  /** Km in piu rispetto al percorso diretto. Presente solo in modalita rientro. */
  detourKm?: number;
}

export interface NetBreakdown extends NetInput {
  gross: number;
  roadCost: number;
  detourFriction: number;
  highwayFriction: number;
  net: number;
}

/**
 * Il netto: quanto ti resta in tasca davvero.
 *
 * La domanda non e «conviene fare il pieno?», e «conviene farlo QUI invece
 * che dove lo farei comunque». Il carburante lo compri in ogni caso: il
 * confronto giusto e con il distributore utilizzabile piu vicino, e i
 * chilometri che contano sono solo quelli IN PIU rispetto a raggiungere lui.
 *
 * Contando invece la distanza assoluta — come si faceva prima — ogni
 * candidato si portava dietro un viaggio intero, anche quello sotto casa.
 * Dove i prezzi della zona sono tutti uguali il guadagno lordo e quasi zero,
 * quindi tutti i netti finivano negativi e a decidere restava solo la
 * distanza: l'app consigliava sistematicamente il piu vicino, e lo chiamava
 * «miglior scelta netta» mostrando un «in tasca» sotto zero.
 *
 * Senza riferimento si ricade sul vecchio conto: media di provincia e andata
 * e ritorno dedicati. Serve a chi chiama netSaving per conto suo, e alla
 * scheda Mercato, che ragiona sul mercato e non su una scelta.
 *
 * In modalita rientro il riferimento non si usa: li il termine di paragone e
 * il tragitto verso casa, e la deviazione e gia di per se un costo marginale.
 *
 * Per il metano kml e km/kg e il prezzo €/kg: la formula regge, cambia
 * l'unita di misura sotto e i conti restano coerenti.
 */
export function netSaving(i: NetInput): NetBreakdown {
  const kml = i.kml > 0 ? i.kml : KML_DI_RIPIEGO;
  const inRientro = i.detourKm !== undefined;
  const rif = inRientro ? undefined : i.riferimento;

  const gross = ((rif ? rif.price : i.cohortAvg) - i.price) * i.liters;

  let roadFuelCost: number;
  let detourFriction = 0;

  if (i.detourKm !== undefined) {
    roadFuelCost = (i.detourKm / kml) * i.price;
    detourFriction = calculateDetourFriction(i.detourKm);
  } else if (rif) {
    // Solo i chilometri in piu, e andata e ritorno perche per il pieno si
    // esce e si torna: fin dove arrivavi comunque non si paga niente.
    const extra = Math.max(0, i.distanceKm - rif.distanceKm);
    roadFuelCost = ((2 * extra) / kml) * i.price;
  } else {
    roadFuelCost = ((2 * i.distanceKm) / kml) * i.price;
  }

  const highwayFriction = i.isHighway
    ? (MINUTI_USCITA_AUTOSTRADA / 60) * VALORE_TEMPO_EURO_ORA
    : 0;
  const totalRoadAndFriction = roadFuelCost + detourFriction + highwayFriction;

  // La fiducia sconta il guadagno, non la perdita: un prezzo vecchio puo
  // essere ottimista, ma i chilometri per andarci li fai comunque.
  const net = gross >= 0 ? gross * i.confidence - totalRoadAndFriction : gross - totalRoadAndFriction;

  return {
    ...i,
    gross,
    roadCost: roadFuelCost,
    detourFriction,
    highwayFriction,
    net,
  };
}

export type IneligibleReason =
  | 'bloccato'
  | 'prezzo-assurdo'
  | 'prezzo-sospetto-stantio'
  | 'deviazione-eccessiva';

export interface RankContext {
  fuel: FuelKey;
  user: LatLng;
  /** Destinazione finale: se presente si ottimizza il viaggio utente -> pompa -> casa. */
  home?: LatLng | null;
  /**
   * Il percorso stradale vero verso casa, se il router ha risposto. Quando
   * c'e, la deviazione si misura proiettando la pompa sulla spezzata; quando
   * manca si ripiega sul triangolo in linea d'aria.
   */
  percorso?: Percorso | null;
  cohorts: CohortIndex;
  now: Date;
  liters: number;
  kml: number;
  blocked: Set<string>;
}

export interface RankedStation {
  row: StationRow;
  price: number;
  distanceKm: number;
  cohort: Cohort;
  z: number | null;
  level: PriceLevel;
  reliable: boolean;
  ageH: number | null;
  confidence: number;
  net: NetBreakdown;
  eligible: boolean;
  reason?: IneligibleReason;
  /** Km in piu rispetto al rientro diretto. */
  detourKm?: number;
  /** Lunghezza complessiva del tragitto utente -> pompa -> casa. */
  tripTotalKm?: number;
  /** Minuti persi per la deviazione, uscita autostradale compresa. */
  minutiPersi?: number;
  /** Quanto sei avanti verso casa quando esci, da 0 a 1. Solo col percorso vero. */
  progresso?: number;
  /** true se la deviazione viene dal percorso stradale, false se dal triangolo. */
  deviazioneSuStrada?: boolean;
  /**
   * Non comunica un prezzo da oltre una settimana: quasi sempre chiuso.
   *
   * E una segnalazione, non un'esclusione. Escluderlo qui svuoterebbe il
   * pannello freschezza del Mercato, che esiste apposta per contare quanti
   * prezzi sono vecchi; e comunque un impianto cosi non puo diventare il
   * consiglio, perche pickBest pretende una fiducia che a quell'eta non c'e.
   */
  probabilmenteChiuso: boolean;
}

interface Candidato {
  row: StationRow;
  price: number;
  cohort: Cohort;
  distanceKm: number;
  ageH: number | null;
  confidence: number;
  detourKm?: number;
  tripTotalKm?: number;
  progresso?: number;
  deviazioneSuStrada?: boolean;
}

/**
 * Il prezzo di riferimento della zona: la mediana delle cinque pompe
 * stradali piu vicine.
 *
 * Serve solo agli impianti autostradali, che hanno una coorte tutta loro e
 * quindi possono risultare «convenienti» fra altri impianti carissimi. Con
 * meno di tre campioni non lo si calcola: la mediana di uno solo non e una
 * mediana, e una pompa bianca fuori mercato sposterebbe le etichette di
 * tutta la lista.
 */
function baselineLocale(candidati: Candidato[]): number | null {
  const stradali = candidati
    .filter((c) => !c.row.isHighway && c.distanceKm <= 15)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  if (stradali.length < 3) return null;

  const campione = stradali
    .slice(0, 5)
    .map((x) => x.price)
    .sort((a, b) => a - b);
  return campione[Math.floor(campione.length / 2)]!;
}

export function rankStations(rows: StationRow[], ctx: RankContext): RankedStation[] {
  const candidati: Candidato[] = [];

  const percorso = ctx.percorso && ctx.percorso.punti.length >= 2 ? ctx.percorso : null;
  const direttoKm = percorso ? percorso.km : ctx.home ? haversineKm(ctx.user, ctx.home) : null;
  const limiteDeviazione = direttoKm !== null ? limiteDeviazioneKm(direttoKm) : null;

  // Primo passaggio: distanze, deviazioni ed eta. Il livello di prezzo no,
  // perche dipende dalla baseline che si conosce solo dopo aver visto tutti.
  for (const row of rows) {
    const price = row.prices[ctx.fuel];
    if (price === undefined) continue;

    const cohort = cohortFor(row, ctx.fuel, ctx.cohorts);
    if (!cohort) continue;

    const stationLoc = { lat: row.lat, lng: row.lng };
    const distanceKm = haversineKm(ctx.user, stationLoc);
    const ageH = ageHours(row.updated, ctx.now);
    const confidence = confidenceFor(ageH);

    const c: Candidato = { row, price, cohort, distanceKm, ageH, confidence };

    if (percorso) {
      const p = proiettaSuPercorso(percorso, stationLoc);
      c.detourKm = deviazioneDaScostamento(p.scostamentoKm);
      c.tripTotalKm = percorso.km + c.detourKm;
      c.progresso = p.progresso;
      c.deviazioneSuStrada = true;
    } else if (ctx.home && direttoKm !== null) {
      const distToHome = haversineKm(stationLoc, ctx.home);
      c.tripTotalKm = distanceKm + distToHome;
      c.detourKm = Math.max(0, c.tripTotalKm - direttoKm);
      c.deviazioneSuStrada = false;
    }

    candidati.push(c);
  }

  const baseline = baselineLocale(candidati);

  /*
    Prima si stabilisce chi e utilizzabile, poi qual e il piu vicino fra
    quelli, e solo alla fine si fanno i conti: il netto di ognuno si misura
    rispetto a quel riferimento, quindi va conosciuto prima di calcolarlo.

    Il riferimento deve essere ELEGGIBILE. Prendere il piu vicino e basta
    vorrebbe dire misurare tutti contro una pompa bloccata dall'utente o con
    un prezzo fantasma, cioe contro un pieno che non faresti mai.
  */
  const giudizio = candidati.map((item) => {
    const { row, price, cohort, ageH, detourKm } = item;

    const { level, z, reliable } = priceLevel(
      price,
      cohort,
      row.isHighway && baseline !== null ? baseline : undefined
    );

    let reason: IneligibleReason | undefined;

    if (ctx.blocked.has(row.id)) {
      reason = 'bloccato';
    } else if (z !== null && Math.abs(z) > Z_ABSURD) {
      reason = 'prezzo-assurdo';
    } else if (z !== null && z < -2.5 && ageH !== null && ageH > 48) {
      // Prezzo fuori mercato e pure vecchio: il classico dato fantasma che
      // manda l'utente a fare venti chilometri per una pompa che costa
      // come le altre.
      reason = 'prezzo-sospetto-stantio';
    } else if (detourKm !== undefined && limiteDeviazione !== null && detourKm > limiteDeviazione) {
      reason = 'deviazione-eccessiva';
    }

    return { item, level, z, reliable, reason };
  });

  let riferimento: Riferimento | undefined;
  for (const g of giudizio) {
    if (g.reason !== undefined) continue;
    if (!riferimento || g.item.distanceKm < riferimento.distanceKm) {
      riferimento = { price: g.item.price, distanceKm: g.item.distanceKm };
    }
  }

  const out: RankedStation[] = [];

  for (const { item, level, z, reliable, reason } of giudizio) {
    const { row, price, cohort, distanceKm, ageH, confidence, detourKm, tripTotalKm } = item;

    // Un impianto autostradale va confrontato col mercato che l'utente
    // avrebbe davvero a disposizione, non con gli altri autostradali:
    // fra impianti tutti cari, il meno caro non e un affare.
    const effectiveCohortAvg = row.isHighway && baseline ? baseline : cohort.avg;

    const net = netSaving({
      price,
      cohortAvg: effectiveCohortAvg,
      riferimento,
      liters: ctx.liters,
      distanceKm,
      kml: ctx.kml,
      confidence,
      isHighway: row.isHighway,
      detourKm,
    });

    out.push({
      row,
      price,
      distanceKm,
      cohort,
      z,
      level,
      reliable,
      ageH,
      confidence,
      net,
      eligible: reason === undefined,
      reason,
      probabilmenteChiuso: isLikelyClosed(ageH),
      detourKm,
      tripTotalKm,
      minutiPersi:
        detourKm !== undefined ? minutiDeviazione(detourKm, row.isHighway) : undefined,
      progresso: item.progresso,
      deviazioneSuStrada: item.deviazioneSuStrada,
    });
  }

  out.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    return b.net.net - a.net.net;
  });

  return out;
}

/**
 * Il migliore: netto piu alto, ma fra tutti quelli che gli stanno entro
 * TIE_EURO vince il piu comodo. Fatto in due passaggi e non nel comparatore,
 * perche un confronto con tolleranza non e un ordinamento totale e darebbe
 * risultati dipendenti dall'ordine di partenza.
 *
 * «Piu comodo» cambia significato fra le due modalita: uscendo apposta conta
 * la distanza da dove sei, tornando a casa conta quanto ti allunga. Non serve
 * altro: la deviazione e gia dentro al netto, con il suo costo in tempo.
 */
export function pickBest(ranked: RankedStation[]): RankedStation | null {
  // Un consiglio va dato su un prezzo in cui si crede. Se pero l'unica roba
  // eleggibile e vecchia, meglio un consiglio incerto che nessun consiglio:
  // l'eta e comunque scritta sotto al nome.
  const freschi = ranked.filter((r) => r.eligible && r.confidence >= 0.5);
  const eligible = freschi.length > 0 ? freschi : ranked.filter((r) => r.eligible);

  const leader = eligible[0];
  if (!leader) return null;

  const inRientro = leader.detourKm !== undefined;
  let best = leader;

  for (const r of eligible) {
    if (leader.net.net - r.net.net > TIE_EURO) break;

    if (inRientro) {
      const suo = r.detourKm ?? Infinity;
      const attuale = best.detourKm ?? Infinity;
      if (suo < attuale) best = r;
    } else if (r.distanceKm < best.distanceKm) {
      best = r;
    }
  }

  return best;
}

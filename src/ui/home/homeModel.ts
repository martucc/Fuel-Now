import type { StationRow } from '../../domain/parse';
import type { CohortIndex, CohortSource } from '../../domain/market';
import type { FuelKey, RawDataset } from '../../domain/raw';
import type { LatLng } from '../../domain/geo';
import { haversineKm } from '../../domain/geo';
import type { PriceLevel } from '../../domain/pricing';
import type { RankedStation } from '../../domain/ranking';
import { dropMisgeocoded } from '../../domain/parse';
import type { Advice, ForecastView } from '../../domain/forecast';
import { rankStations, pickBest, limiteDeviazioneKm } from '../../domain/ranking';
import type { Percorso } from '../../domain/corridoio';
import { readForecast, adviceOfTheDay } from '../../domain/forecast';
import { LEVEL_LABEL } from '../../domain/pricing';
import { describeAge } from '../../domain/freshness';

export interface HomeInput {
  rows: StationRow[];
  cohorts: CohortIndex;
  dataset: RawDataset;
  fuel: FuelKey;
  user: LatLng;
  /** Posizione della casa per il calcolo del rientro */
  home?: LatLng | null;
  /** Nome o indirizzo di casa configurato */
  homeAddress?: string | null;
  /** Se true, ottimizza il percorso di rientro verso casa (Utente -> Distributore -> Casa) */
  homeMode?: boolean;
  /**
   * Il percorso stradale verso casa, quando il router ha risposto. Con
   * questo la deviazione si misura sulla strada vera; senza, si ripiega
   * sul triangolo in linea d'aria e la Home lo dichiara.
   */
  percorso?: Percorso | null;
  now: Date;
  liters: number;
  kml: number;
  blocked: Set<string>;
  radiusKm: number;
  /** Frazione di serbatoio residua, null se ignota. */
  tankPct: number | null;
}

export interface ListItem {
  id: string;
  name: string;
  brand: string;
  city: string;
  lat: number;
  lng: number;
  price: number;
  level: PriceLevel;
  levelLabel: string;
  reliable: boolean;
  distanceKm: number;
  ageLabel: string;
  net: number;
  /** Quanto costa in piu al litro rispetto al migliore. 0 per il migliore. */
  deltaVsBest: number;
  eligible: boolean;
  reason?: string;
  detourKm?: number;
  tripTotalKm?: number;
  minutiPersi?: number;
  /** Non comunica un prezzo da oltre una settimana: da mostrare, non da nascondere. */
  probabilmenteChiuso: boolean;
}

export interface Spectrum {
  /** Prezzo a due scarti tipo sotto la media: il bordo sinistro della barra. */
  lo: number;
  /** Prezzo a due scarti tipo sopra la media: il bordo destro. */
  hi: number;
  avg: number;
  price: number;
  /**
   * Posizione sulla barra, da 0 a 1, ricavata dallo z e NON dal minimo e
   * massimo. Con il min-max una coorte dalla coda alta metteva il segno a
   * meta barra mentre l'etichetta diceva «Affarone»: barra e livello
   * raccontavano cose diverse. Mappando z ∈ [-2, +2] sulla stessa scala
   * dei confini di livello, il colore sotto il segno e sempre il suo.
   */
  position: number;
  n: number;
  source: CohortSource;
  reliable: boolean;
}

/** Estremi della barra dello spettro, in scarti tipo. */
export const SPECTRUM_Z = 2;

export interface BoardSummary {
  count: number;
  best: number | null;
  worst: number | null;
}

export interface HomeModel {
  best: RankedStation | null;
  bestRank: number | null;
  eligibleCount: number;
  list: ListItem[];
  spectrum: Spectrum | null;
  board: BoardSummary;
  forecast: ForecastView | null;
  advice: Advice;
  adviceReason: string;
  /**
   * Quanto vale in euro seguire il consiglio, sul pieno considerato.
   * Deriva dal delta in centesimi del forecast di BACKEND: se il forecast
   * non e utilizzabile resta null e il widget non mostra alcuna cifra.
   * Positivo = si guadagna ad aspettare.
   */
  adviceImpactEur: number | null;
  /**
   * Quanti km si risparmiano scegliendo questo invece di chi guida la
   * classifica per netto. null quando il migliore E chi la guida.
   * Senza questo, «2 di 775» si legge come «il secondo migliore».
   */
  tieSavedKm: number | null;
  homeMode: boolean;
  homeAddress: string | null;
  homeLocation: LatLng | null;
  /** Km da qui a casa: stradali se il router ha risposto, in linea d'aria altrimenti. */
  directHomeKm: number | null;
  /** true se le deviazioni sono misurate sulla strada vera e non col triangolo. */
  percorsoSuStrada: boolean;
}

/** Etichette del consiglio, spec § 6.5. */
export const ADVICE_LABEL: Record<Advice, string> = {
  'FILL-FULL': 'Fai il pieno',
  'TEN-EURO': 'Metti il minimo',
  URGENT: 'Rifornisci ora',
  'PRICE-ONLY': 'Decidi sul prezzo di oggi',
};

function toItem(r: RankedStation, bestPrice: number | null): ListItem {
  return {
    id: r.row.id,
    name: r.row.name,
    brand: r.row.brand,
    city: r.row.city,
    lat: r.row.lat,
    lng: r.row.lng,
    price: r.price,
    level: r.level,
    levelLabel: LEVEL_LABEL[r.level],
    reliable: r.reliable,
    distanceKm: r.distanceKm,
    ageLabel: describeAge(r.ageH),
    net: r.net.net,
    deltaVsBest: bestPrice === null ? 0 : r.price - bestPrice,
    eligible: r.eligible,
    reason: r.reason,
    detourKm: r.detourKm,
    tripTotalKm: r.tripTotalKm,
    minutiPersi: r.minutiPersi,
    probabilmenteChiuso: r.probabilmenteChiuso,
  };
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Senza z il prezzo sta al centro: e esattamente quello che «non so» significa. */
function zOrZero(z: number | null): number {
  return z ?? 0;
}

export function buildHomeModel(i: HomeInput): HomeModel {
  // Le coordinate sbagliate si tolgono qui e non a monte: il prezzo di
  // quelle righe e vero e continua a contare nelle medie di provincia,
  // ma non possono entrare in una scelta che pesa i chilometri.
  const rows = dropMisgeocoded(i.rows);

  const homeActive = Boolean(i.homeMode && i.home);
  const percorso = homeActive && i.percorso && i.percorso.punti.length >= 2 ? i.percorso : null;

  // Col percorso vero il «quanto e lontana casa» sono i km stradali del
  // router; senza, la linea d'aria. Sono due numeri diversi e la seconda
  // sottostima sempre: il limite di deviazione ne tiene conto da solo,
  // perche e proporzionale.
  const directHomeKm = percorso
    ? percorso.km
    : homeActive && i.home
      ? haversineKm(i.user, i.home)
      : null;

  const allRanked = rankStations(rows, {
    fuel: i.fuel,
    user: i.user,
    home: homeActive ? i.home : undefined,
    percorso,
    cohorts: i.cohorts,
    now: i.now,
    liters: i.liters,
    kml: i.kml,
    blocked: i.blocked,
  });

  // In rientro il raggio impostato nei filtri non c'entra piu niente: la
  // domanda non e «cosa ho vicino» ma «cosa incontro andando». Il confine
  // lo da la deviazione, non la distanza da dove sei adesso.
  const ranked = allRanked.filter((r) => {
    if (homeActive && directHomeKm !== null) {
      const limite = limiteDeviazioneKm(directHomeKm);
      return (r.detourKm ?? 0) <= limite && r.distanceKm <= directHomeKm + limite;
    }
    return r.distanceKm <= i.radiusKm;
  });

  const best = pickBest(ranked);
  const list = ranked.map((r) => toItem(r, best ? best.price : null));

  const bestRank = best ? ranked.findIndex((r) => r.row.id === best.row.id) + 1 : null;
  const eligibleCount = ranked.filter((r) => r.eligible).length;

  const spectrum: Spectrum | null = best
    ? {
        lo: best.cohort.avg - SPECTRUM_Z * best.cohort.std,
        hi: best.cohort.avg + SPECTRUM_Z * best.cohort.std,
        avg: best.cohort.avg,
        price: best.price,
        position: clamp01((zOrZero(best.z) + SPECTRUM_Z) / (2 * SPECTRUM_Z)),
        n: best.cohort.n,
        source: best.cohort.source,
        reliable: best.reliable,
      }
    : null;

  // Math.min/max qui DESCRIVONO il range mostrato nel velo del tabellone.
  // La scelta di dove conviene andare resta pickBest.
  const prices = list.map((x) => x.price);
  const board: BoardSummary = {
    count: list.length,
    best: prices.length ? Math.min(...prices) : null,
    worst: prices.length ? Math.max(...prices) : null,
  };

  const forecast = readForecast(i.dataset, i.fuel);
  const { advice, reason } = adviceOfTheDay({
    bestLevel: best ? best.level : null,
    forecast,
    tankPct: i.tankPct,
  });

  // Il delta e in centesimi al litro e ha segno: negativo = prezzi in calo,
  // quindi aspettare fa risparmiare. Senza forecast utilizzabile non si
  // scrive alcun numero.
  const adviceImpactEur =
    forecast && forecast.usable ? (-forecast.deltaC / 100) * i.liters : null;

  const leader = ranked.find((r) => r.eligible) ?? null;
  const tieSavedKm =
    best && leader && leader.row.id !== best.row.id
      ? leader.distanceKm - best.distanceKm
      : null;

  return {
    best,
    bestRank,
    eligibleCount,
    list,
    spectrum,
    board,
    forecast,
    advice,
    adviceReason: reason,
    adviceImpactEur,
    tieSavedKm,
    homeMode: homeActive,
    homeAddress: i.homeAddress ?? null,
    homeLocation: i.home ?? null,
    directHomeKm,
    percorsoSuStrada: percorso !== null,
  };
}

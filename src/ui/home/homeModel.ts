import type { StationRow } from '../../domain/parse';
import type { CohortIndex, CohortSource } from '../../domain/market';
import type { FuelKey, RawDataset } from '../../domain/raw';
import type { LatLng } from '../../domain/geo';
import type { PriceLevel } from '../../domain/pricing';
import type { IneligibleReason, MotivoNonConsigliabile, RankedStation } from '../../domain/ranking';
import { dropMisgeocoded } from '../../domain/parse';
import type { Advice, ForecastView } from '../../domain/forecast';
import { rankStations, classifica } from '../../domain/ranking';
import { readForecast, adviceOfTheDay } from '../../domain/forecast';
import { LEVEL_LABEL } from '../../domain/pricing';
import { describeAge, ORE_PREZZO_VECCHIO } from '../../domain/freshness';

export interface HomeInput {
  rows: StationRow[];
  cohorts: CohortIndex;
  dataset: RawDataset;
  fuel: FuelKey;
  user: LatLng;
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
  /** Il prezzo che si paga: il self, o il servito dove il self non c'e. */
  price: number;
  /** L'impianto per questo carburante ha solo il servito: va detto accanto al prezzo. */
  alServito: boolean;
  level: PriceLevel;
  levelLabel: string;
  reliable: boolean;
  distanceKm: number;
  ageLabel: string;
  net: number;
  /** Quanto costa in piu al litro rispetto al migliore. 0 per il migliore. */
  deltaVsBest: number;
  eligible: boolean;
  reason?: IneligibleReason;
  /** Si puo consigliare: e solo per questi che la riga dice «risparmi X €». */
  consigliabile: boolean;
  nonConsigliabile?: MotivoNonConsigliabile;
  /** Minuti di strada in piu rispetto al piu vicino, arrotondati: «+8 min». */
  minutiInPiu: number;
  /**
   * Perche non si consiglia, in due parole da mettere nella riga: «in
   * autostrada», «forse chiuso», «prezzo vecchio», «+34 min, troppa strada»…
   */
  motivo?: string;
  /** Prezzo di oltre tre giorni prima degli ultimi arrivati: l'eta va in arancio. */
  vecchio: boolean;
  /** Non comunica un prezzo da oltre una settimana: da mostrare, non da consigliare. */
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
  eligibleCount: number;
  /** Gli impianti entro il raggio, col consigliato in testa: vedi classifica. */
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
}

/** Etichette del consiglio, spec § 6.5. */
export const ADVICE_LABEL: Record<Advice, string> = {
  'FILL-FULL': 'Fai il pieno',
  'TEN-EURO': 'Metti il minimo',
  URGENT: 'Rifornisci ora',
  'PRICE-ONLY': 'Decidi sul prezzo di oggi',
};

/**
 * Il motivo per cui un distributore della lista e spento: lo stesso elenco
 * del foglio «Perché», detto in due parole.
 */
export const MOTIVO_ESCLUSIONE: Record<IneligibleReason, string> = {
  bloccato: 'nascosto',
  'probabilmente-chiuso': 'forse chiuso',
  autostrada: 'in autostrada',
  'prezzo-assurdo': 'prezzo fuori mercato',
  // L'eta e gia scritta accanto, in arancio quando e vecchia.
  'prezzo-sospetto-stantio': 'prezzo fuori mercato',
};

/**
 * Il motivo della riga: perche e esclusa, o perche non si consiglia pur
 * essendo utilizzabile. I minuti di «troppa strada» si arrotondano per
 * eccesso: sono oltre il tetto, e 20,3 minuti scritti «+20 min» smentivano
 * il foglio Perche («mai oltre 20 minuti in piu»).
 */
export function motivoDi(r: Pick<RankedStation, 'reason' | 'nonConsigliabile' | 'minutiInPiu'>): string | undefined {
  if (r.reason) return MOTIVO_ESCLUSIONE[r.reason];
  if (r.nonConsigliabile === 'prezzo-vecchio') return 'prezzo vecchio';
  if (r.nonConsigliabile === 'troppa-strada') return `+${Math.ceil(r.minutiInPiu)} min, troppa strada`;
  return undefined;
}

function toItem(r: RankedStation, bestPrice: number | null): ListItem {
  return {
    id: r.row.id,
    name: r.row.name,
    brand: r.row.brand,
    city: r.row.city,
    lat: r.row.lat,
    lng: r.row.lng,
    price: r.price,
    alServito: r.alServito,
    level: r.level,
    levelLabel: LEVEL_LABEL[r.level],
    reliable: r.reliable,
    distanceKm: r.distanceKm,
    ageLabel: describeAge(r.ageH),
    net: r.net.net,
    deltaVsBest: bestPrice === null ? 0 : r.price - bestPrice,
    eligible: r.eligible,
    reason: r.reason,
    consigliabile: r.consigliabile,
    nonConsigliabile: r.nonConsigliabile,
    minutiInPiu: Math.round(r.minutiInPiu),
    motivo: motivoDi(r),
    vecchio: (r.ritardoH ?? 0) > ORE_PREZZO_VECCHIO,
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

  // La scelta e la lista si fanno fra gli impianti entro il raggio: «qui vicino».
  const ranked = rankStations(rows, {
    fuel: i.fuel,
    user: i.user,
    cohorts: i.cohorts,
    now: i.now,
    liters: i.liters,
    kml: i.kml,
    blocked: i.blocked,
    raggioKm: i.radiusKm,
  });

  // Consiglio e ordine della lista escono dallo stesso conto: il primo
  // della lista e sempre il consigliato.
  const { best, lista } = classifica(ranked);
  const list = lista.map((r) => toItem(r, best ? best.price : null));
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
  // La scelta di dove conviene andare resta classifica.
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

  return {
    best,
    eligibleCount,
    list,
    spectrum,
    board,
    forecast,
    advice,
    adviceReason: reason,
    adviceImpactEur,
  };
}

import type { StationRow } from '../../domain/parse';
import { dropMisgeocoded } from '../../domain/parse';
import type { CohortIndex, Cohort, Stats } from '../../domain/market';
import type { FuelKey, RawDataset, RawHistoryPoint } from '../../domain/raw';
import type { LatLng } from '../../domain/geo';
import type { PriceLevel } from '../../domain/pricing';
import type { RankedStation } from '../../domain/ranking';
import { rankStations } from '../../domain/ranking';
import { numero } from '../../lib/formato';
import type { ForecastView } from '../../domain/forecast';
import { readForecast } from '../../domain/forecast';
import type { Scomposizione } from '../../domain/accise';
import { scomponiPrezzo } from '../../domain/accise';
import type { RitmoSettimanale } from '../../domain/settimana';
import { ritmoSettimanale } from '../../domain/settimana';

/**
 * Il modello della schermata Mercato.
 *
 * Prima questa schermata girava su localAnalysis: medie ricalcolate a mano
 * sul sottoinsieme gia filtrato, un consiglio dedotto dallo spread e tre
 * paragrafi che il modello scriveva a naso. Qui invece ogni numero esce
 * dallo stesso dominio che decide la Home — coorti per provincia e
 * segmento, scarti tipo, freschezza, previsione del backend — e ogni cosa
 * che non si puo calcolare resta null invece di essere stimata.
 */

export interface MarketInput {
  /** Il dataset intero: le coorti hanno bisogno anche di chi sta lontano. */
  rows: StationRow[];
  cohorts: CohortIndex;
  dataset: RawDataset;
  fuel: FuelKey;
  user: LatLng;
  now: Date;
  /** Serbatoio, per tradurre i centesimi al litro in euro veri. */
  liters: number;
  kml: number;
  blocked: Set<string>;
  radiusKm: number;
  /**
   * Storico piu lungo, se qualcuno lo ha caricato: il dataset porta un anno
   * di rilevazioni giornaliere, il file storico arriva al 2020 ma piu rado.
   * Uniti danno sia il dettaglio recente sia la profondita.
   */
  storicoLungo?: RawHistoryPoint[];
}

export interface Confronto {
  label: string;
  giorni: number;
  /** Variazione percentuale fra allora e l'ultimo rilevamento. */
  delta: number;
}

export interface Secchio {
  level: PriceLevel;
  n: number;
  /** Prezzo minimo e massimo osservati dentro questo livello, null se vuoto. */
  da: number | null;
  a: number | null;
}

export interface Marchio {
  brand: string;
  n: number;
  avg: number;
  /** Centesimi al litro rispetto alla media della zona: negativo = costa meno. */
  delta: number;
}

export interface Migliore {
  id: string;
  nome: string;
  brand: string;
  price: number;
  km: number;
  level: PriceLevel;
  /** Percentuale di impianti in zona che costano di piu. */
  percentile: number;
}

/** La frase che apre la schermata: una sola, con dentro il numero che conta. */
export interface Verdetto {
  titolo: string;
  frase: string;
  /** Il livello da cui prendere il colore: e la zona a essere giudicata. */
  tono: PriceLevel;
}

export interface MarketModel {
  prov: string | null;
  verdetto: Verdetto | null;
  zona: Cohort | null;
  nazionale: Stats | null;
  /** Centesimi al litro fra la zona e l'Italia: negativo = zona piu economica. */
  deltaZonaItaliaC: number | null;

  migliore: Migliore | null;
  /** Impianti confrontabili nel raggio. */
  campione: number;
  /** Forbice della zona in centesimi al litro. */
  spreadC: number | null;
  /** Cosa balla fra il piu caro e il piu economico, su un pieno. */
  risparmioMassimoEur: number | null;

  distribuzione: Secchio[];

  storico: RawHistoryPoint[];
  confronti: Confronto[];
  /** Scarto tipo dello storico recente, in centesimi. */
  volatilitaC: number | null;

  previsione: ForecastView | null;
  /** Euro sul pieno: positivo = si guadagna ad aspettare. */
  previsioneEur: number | null;

  marchi: Marchio[];
  /** Quanto costa in piu l'autostrada in questa provincia, in centesimi. */
  autostradaC: number | null;
  /** Quanto costa in piu farsi servire, in centesimi. */
  servitoC: number | null;

  freschezza: { recenti: number; totale: number; medianaOre: number | null };

  /** Quanto della media di zona e tassa. null dove l'accisa al litro non si sa. */
  scomposizione: Scomposizione | null;
  /** Se esista davvero un giorno della settimana in cui conviene. */
  ritmo: RitmoSettimanale;
}

/** Sotto questo numero di impianti un marchio non e una classifica. */
const MIN_PER_MARCHIO = 3;
/** Sotto questo numero di coppie self/servito il confronto e aneddotica. */
const MIN_PER_SERVITO = 5;
/** Oltre queste ore un prezzo non e piu «di oggi». */
const ORE_RECENTI = 48;
/** Punti di storico sotto i quali non si azzarda una volatilita. */
const MIN_STORICO = 8;
const GIORNI_VOLATILITA = 30;

const LIVELLI: PriceLevel[] = ['best', 'good', 'normal', 'high', 'worst'];

const FINESTRE: Array<[string, number]> = [
  ['un mese prima', 30],
  ['sei mesi prima', 182],
  ['un anno prima', 365],
];

function mediana(valori: number[]): number | null {
  if (valori.length === 0) return null;
  const ordinati = [...valori].sort((a, b) => a - b);
  const meta = ordinati.length >> 1;
  return ordinati.length % 2 ? ordinati[meta]! : (ordinati[meta - 1]! + ordinati[meta]!) / 2;
}

function scartoTipo(valori: number[]): number | null {
  if (valori.length < 2) return null;
  const media = valori.reduce((a, v) => a + v, 0) / valori.length;
  const varianza = valori.reduce((a, v) => a + (v - media) ** 2, 0) / valori.length;
  return Math.sqrt(varianza);
}

/** Da euro al litro a centesimi al litro: e l'unita in cui si parla di prezzi. */
function cent(euroAlLitro: number): number {
  return euroAlLitro * 100;
}

/**
 * Unisce le due fonti di storico. Dove le date coincidono vince il dataset,
 * che e la rilevazione piu recente e piu fitta.
 */
export function unisciStorico(
  lungo: RawHistoryPoint[] | undefined,
  recente: RawHistoryPoint[]
): RawHistoryPoint[] {
  // Niente scorciatoie sui casi vuoti: passando sempre di qui anche i punti
  // senza prezzo vengono scartati, qualunque sia la fonte che li porta.
  const per = new Map<string, number>();
  for (const p of lungo ?? []) if (p.avg > 0) per.set(p.date, p.avg);
  for (const p of recente) if (p.avg > 0) per.set(p.date, p.avg);

  return [...per.entries()]
    .map(([date, avg]) => ({ date, avg }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function confrontiStorici(storico: RawHistoryPoint[]): Confronto[] {
  if (storico.length < 2) return [];

  // L'ultimo punto utile, non l'ultimo punto: una data malformata in coda
  // farebbe sparire tutti i confronti invece di far perdere quel giorno.
  let ultimo: RawHistoryPoint | null = null;
  let fineMs = NaN;
  for (let k = storico.length - 1; k >= 0; k--) {
    const ms = Date.parse(storico[k]!.date);
    if (Number.isFinite(ms)) { ultimo = storico[k]!; fineMs = ms; break; }
  }
  if (!ultimo) return [];

  const fuori: Confronto[] = [];
  for (const [label, giorni] of FINESTRE) {
    const bersaglio = fineMs - giorni * 86400_000;
    let scelto: RawHistoryPoint | null = null;
    for (const punto of storico) {
      const ms = Date.parse(punto.date);
      if (!Number.isFinite(ms)) continue;
      if (ms <= bersaglio) scelto = punto;
      else break;
    }
    // L'ancora e l'ultimo rilevamento, non oggi: se lo storico si ferma a
    // due mesi fa, «un mese prima» misurato da adesso pescherebbe lo stesso
    // punto e direbbe 0,0% — un numero falso con l'aria di essere vero.
    if (scelto && scelto !== ultimo && scelto.avg > 0) {
      fuori.push({ label, giorni, delta: ((ultimo.avg - scelto.avg) / scelto.avg) * 100 });
    }
  }
  return fuori;
}

function classifica(vicini: RankedStation[]): Secchio[] {
  const per = new Map<PriceLevel, number[]>();
  for (const l of LIVELLI) per.set(l, []);
  for (const v of vicini) per.get(v.level)!.push(v.price);

  return LIVELLI.map((level) => {
    const prezzi = per.get(level)!;
    return {
      level,
      n: prezzi.length,
      da: prezzi.length ? Math.min(...prezzi) : null,
      a: prezzi.length ? Math.max(...prezzi) : null,
    };
  });
}

function marchiDiZona(vicini: RankedStation[], mediaZona: number | null): Marchio[] {
  const per = new Map<string, number[]>();
  for (const v of vicini) {
    const b = v.row.brand || 'Indipendente';
    const arr = per.get(b);
    if (arr) arr.push(v.price);
    else per.set(b, [v.price]);
  }

  const fuori: Marchio[] = [];
  for (const [brand, prezzi] of per) {
    if (prezzi.length < MIN_PER_MARCHIO) continue;
    const avg = prezzi.reduce((a, v) => a + v, 0) / prezzi.length;
    fuori.push({
      brand,
      n: prezzi.length,
      avg,
      delta: mediaZona === null ? 0 : cent(avg - mediaZona),
    });
  }
  fuori.sort((a, b) => a.avg - b.avg);
  return fuori;
}

/**
 * Il sovrapprezzo dell'autostrada, misurato sulle coorti della provincia
 * dell'utente. Se una delle due manca si ricade sul segmento nazionale:
 * meglio un confronto giusto su scala piu larga che nessun confronto.
 */
function sovrapprezzoAutostrada(
  cohorts: CohortIndex,
  prov: string | null,
  fuel: FuelKey,
  vicini: RankedStation[]
): number | null {
  // Senza autostrade in zona la domanda non si pone: la risposta nazionale
  // sarebbe vera ma fuori luogo per chi guarda la propria citta.
  if (!vicini.some((v) => v.row.isHighway)) return null;

  const strada = prov ? cohorts.byProv.get(`${prov}|road|${fuel}`) : undefined;
  const autostrada = prov ? cohorts.byProv.get(`${prov}|highway|${fuel}`) : undefined;
  if (strada && autostrada) return cent(autostrada.avg - strada.avg);

  const stradaIt = cohorts.bySegment.get(`road|${fuel}`);
  const autostradaIt = cohorts.bySegment.get(`highway|${fuel}`);
  if (stradaIt && autostradaIt) return cent(autostradaIt.avg - stradaIt.avg);

  return null;
}

function sovrapprezzoServito(vicini: RankedStation[], fuel: FuelKey): number | null {
  const scarti: number[] = [];
  for (const v of vicini) {
    const servito = v.row.servito[fuel];
    if (servito === undefined) continue;
    const delta = servito - v.price;
    // Un servito che costa meno del self e un errore di comunicazione, non uno sconto.
    if (delta > 0) scarti.push(delta);
  }
  if (scarti.length < MIN_PER_SERVITO) return null;
  return cent(scarti.reduce((a, v) => a + v, 0) / scarti.length);
}

/**
 * Il giudizio sulla zona, non sul singolo impianto: quanto costa qui
 * rispetto al paese. Sta in una frase perche chi apre la schermata vuole
 * sapere una cosa sola prima di leggere il resto.
 */
export function componiVerdetto(
  deltaC: number | null,
  prov: string | null,
  spreadC: number | null
): Verdetto | null {
  if (deltaC === null) return null;
  const dove = prov ? `In provincia di ${prov}` : 'Qui';
  const forbice =
    spreadC !== null && spreadC >= 5
      ? ` Fra il più caro e il più economico della zona ballano ${numero(spreadC, 0)} centesimi al litro.`
      : '';

  if (deltaC <= -3) {
    return {
      titolo: 'Zona conveniente',
      frase: `${dove} si paga ${numero(Math.abs(deltaC), 1)} centesimi meno della media italiana.${forbice}`,
      tono: 'best',
    };
  }
  if (deltaC <= -0.8) {
    return {
      titolo: 'Poco sotto la media',
      frase: `${dove} si paga ${numero(Math.abs(deltaC), 1)} centesimi meno del resto d’Italia.${forbice}`,
      tono: 'good',
    };
  }
  if (deltaC < 0.8) {
    return {
      titolo: 'In linea col paese',
      frase: `${dove} si paga quanto nel resto d’Italia.${forbice}`,
      tono: 'normal',
    };
  }
  if (deltaC < 3) {
    return {
      titolo: 'Poco sopra la media',
      frase: `${dove} si paga ${numero(deltaC, 1)} centesimi più del resto d’Italia.${forbice}`,
      tono: 'high',
    };
  }
  return {
    titolo: 'Zona cara',
    frase: `${dove} si paga ${numero(deltaC, 1)} centesimi più della media italiana.${forbice}`,
    tono: 'worst',
  };
}

export function buildMarketModel(i: MarketInput): MarketModel {
  // Le coordinate sbagliate non possono entrare in niente che pesi la
  // distanza: qui pesano il raggio, il piu vicino e la provincia dell'utente.
  const rows = dropMisgeocoded(i.rows);

  const ranked = rankStations(rows, {
    fuel: i.fuel,
    user: i.user,
    cohorts: i.cohorts,
    now: i.now,
    liters: i.liters,
    kml: i.kml,
    blocked: i.blocked,
  });

  const vicini = ranked.filter((r) => r.eligible && r.distanceKm <= i.radiusKm);

  // La provincia e quella dell'impianto piu vicino: dire dove siamo non
  // vale una chiamata di geocodifica inversa.
  let piuVicino: RankedStation | null = null;
  for (const v of vicini) {
    if (!piuVicino || v.distanceKm < piuVicino.distanceKm) piuVicino = v;
  }
  const prov = piuVicino?.row.prov ?? null;

  const zona: Cohort | null = piuVicino ? piuVicino.cohort : null;

  const nazionaleRaw = i.dataset.national?.[i.fuel] ?? null;
  const nazionale: Stats | null = nazionaleRaw
    ? {
        avg: nazionaleRaw.avg,
        std: nazionaleRaw.std,
        min: nazionaleRaw.min,
        max: nazionaleRaw.max ?? nazionaleRaw.avg,
        n: nazionaleRaw.n,
      }
    : null;

  const deltaZonaItaliaC = zona && nazionale ? cent(zona.avg - nazionale.avg) : null;

  const prezzi = vicini.map((v) => v.price);
  const minimo = prezzi.length ? Math.min(...prezzi) : null;
  const massimo = prezzi.length ? Math.max(...prezzi) : null;

  let migliore: Migliore | null = null;
  if (minimo !== null) {
    // Fra i pari prezzo si tiene il piu vicino: e quello che si andrebbe a prendere.
    let scelto = vicini.find((v) => v.price === minimo)!;
    for (const v of vicini) {
      if (v.price === minimo && v.distanceKm < scelto.distanceKm) scelto = v;
    }
    const piuCari = vicini.filter((v) => v.price > minimo).length;
    migliore = {
      id: scelto.row.id,
      nome: scelto.row.name,
      brand: scelto.row.brand,
      price: scelto.price,
      km: scelto.distanceKm,
      level: scelto.level,
      // Sul totale della zona e non sugli «altri»: chi legge si immagina
      // tutti gli impianti intorno, non tutti tranne uno.
      percentile: (piuCari / vicini.length) * 100,
    };
  }

  const spreadC = minimo !== null && massimo !== null ? cent(massimo - minimo) : null;
  const risparmioMassimoEur =
    minimo !== null && massimo !== null ? (massimo - minimo) * i.liters : null;

  const storico = unisciStorico(i.storicoLungo, i.dataset.history?.[i.fuel] ?? []);
  const confronti = confrontiStorici(storico);
  const coda = storico.slice(-GIORNI_VOLATILITA).map((p) => p.avg);
  const volatilitaC =
    storico.length >= MIN_STORICO ? (() => {
      const s = scartoTipo(coda);
      return s === null ? null : cent(s);
    })() : null;

  const previsione = readForecast(i.dataset, i.fuel);
  // Il delta e in centesimi e ha segno: negativo = prezzi in calo, quindi
  // aspettare fa risparmiare. Senza fiducia nella previsione, nessuna cifra.
  const previsioneEur =
    previsione && previsione.usable ? (-previsione.deltaC / 100) * i.liters : null;

  const eta = vicini.map((v) => v.ageH).filter((a): a is number => a !== null);

  return {
    prov,
    verdetto: componiVerdetto(deltaZonaItaliaC, prov, spreadC),
    zona,
    nazionale,
    deltaZonaItaliaC,
    migliore,
    campione: vicini.length,
    spreadC,
    risparmioMassimoEur,
    distribuzione: classifica(vicini),
    storico,
    confronti,
    volatilitaC,
    previsione,
    previsioneEur,
    marchi: marchiDiZona(vicini, zona ? zona.avg : null),
    autostradaC: sovrapprezzoAutostrada(i.cohorts, prov, i.fuel, vicini),
    servitoC: sovrapprezzoServito(vicini, i.fuel),
    freschezza: {
      recenti: eta.filter((a) => a <= ORE_RECENTI).length,
      totale: vicini.length,
      medianaOre: mediana(eta),
    },
    scomposizione: zona ? scomponiPrezzo(zona.avg, i.fuel) : null,
    ritmo: ritmoSettimanale(storico),
  };
}

/** Il livello che ha il maggior numero di impianti: dove sta il grosso della zona. */
export function livelloDominante(d: Secchio[]): PriceLevel | null {
  let scelto: Secchio | null = null;
  for (const s of d) if (s.n > 0 && (!scelto || s.n > scelto.n)) scelto = s;
  return scelto ? scelto.level : null;
}

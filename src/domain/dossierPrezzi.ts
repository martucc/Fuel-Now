import type { FuelKey } from './raw';
import type { StationRow } from './parse';
import type { CohortIndex } from './market';
import type { ContestoIa } from './aiContext';
import { buildAiContext } from './aiContext';
import type { ForecastView } from './forecast';
import type { RitmoSettimanale } from './settimana';
import type { PuntoSerie } from './andamento';
import { ritaglia, variazione } from './andamento';
import type { QuadroOggi } from './quadro';
import { ageHours } from './freshness';
import { scomponiPrezzo } from './accise';

/**
 * Il dossier che la scheda Prezzi manda a Gemini.
 *
 * Il modello non calcola niente: commenta numeri gia fatti dall'app. Per
 * questo il dossier porta i numeri veri di oggi — medie, confronti con una
 * settimana e un mese fa, la previsione dell'app (o il fatto che non c'e),
 * il giorno della settimana, le tasse — e dice esplicitamente cosa manca.
 * La parte comune la scrive `buildAiContext`; qui si aggiunge il resto.
 */

/** Un distributore della lista della Home: bastano questi campi. */
export interface VicinoDossier {
  id: string;
  price: number;
  distanceKm: number;
  eligible: boolean;
}

export interface DossierInput {
  fuel: FuelKey;
  quadro: QuadroOggi;
  /** I distributori entro il raggio della Home. */
  vicini: readonly VicinoDossier[];
  perId: ReadonlyMap<string, StationRow>;
  cohorts: CohortIndex;
  consigliato: { nome: string; prezzo: number; km: number; risparmioEur: number } | null;
  /** Lo storico intero, ripulito. */
  storico: readonly PuntoSerie[];
  previsione: ForecastView | null;
  ritmo: RitmoSettimanale;
  auto: { modello: string; serbatoioL: number; kml: number } | null;
  now: Date;
}

/** Sotto questo numero di impianti un marchio non e una classifica. */
const MIN_PER_MARCHIO = 3;
/** Sotto questo numero di coppie self/servito il confronto e aneddotica. */
const MIN_PER_SERVITO = 5;
/** Oltre queste ore un prezzo non e piu «di adesso» per il commento. */
const ORE_FRESCHE = 48;
/** Lo storico che il modello vede: un mese, abbastanza per l'andamento recente. */
const GIORNI_STORICO = 30;

const e3 = (v: number) => `€${v.toFixed(3)}`;
const c1 = (v: number) => Math.abs(v).toFixed(1);

interface Vicino {
  row: StationRow;
  price: number;
}

function utilizzabili(i: DossierInput): Vicino[] {
  const out: Vicino[] = [];
  for (const v of i.vicini) {
    if (!v.eligible) continue;
    const row = i.perId.get(v.id);
    if (row) out.push({ row, price: v.price });
  }
  return out;
}

function sovrapprezzoAutostrada(i: DossierInput, vicini: Vicino[]): number | null {
  // Senza autostrade in zona la domanda non si pone.
  if (!vicini.some((v) => v.row.isHighway)) return null;
  const prov = i.quadro.provincia?.sigla;
  const strada = prov ? i.cohorts.byProv.get(`${prov}|road|${i.fuel}`) : undefined;
  const autostrada = prov ? i.cohorts.byProv.get(`${prov}|highway|${i.fuel}`) : undefined;
  if (strada && autostrada) return (autostrada.avg - strada.avg) * 100;
  const s = i.cohorts.bySegment.get(`road|${i.fuel}`);
  const a = i.cohorts.bySegment.get(`highway|${i.fuel}`);
  return s && a ? (a.avg - s.avg) * 100 : null;
}

function sovrapprezzoServito(fuel: FuelKey, vicini: Vicino[]): number | null {
  const scarti: number[] = [];
  for (const v of vicini) {
    const servito = v.row.servito[fuel];
    // Un servito che costa meno del self e un errore di comunicazione, non uno sconto.
    if (servito !== undefined && servito > v.price) scarti.push(servito - v.price);
  }
  if (scarti.length < MIN_PER_SERVITO) return null;
  return (scarti.reduce((a, x) => a + x, 0) / scarti.length) * 100;
}

function marchiEconomici(vicini: Vicino[]): { brand: string; avg: number }[] {
  const per = new Map<string, number[]>();
  for (const v of vicini) {
    const b = v.row.brand || 'Indipendente';
    const arr = per.get(b);
    if (arr) arr.push(v.price);
    else per.set(b, [v.price]);
  }
  const out: { brand: string; avg: number }[] = [];
  for (const [brand, prezzi] of per) {
    if (prezzi.length >= MIN_PER_MARCHIO) out.push({ brand, avg: prezzi.reduce((a, x) => a + x, 0) / prezzi.length });
  }
  return out.sort((a, b) => a.avg - b.avg).slice(0, 3);
}

/** La parte del dossier che ha gia una forma comune: `ContestoIa`. */
export function contestoIa(i: DossierInput): ContestoIa {
  const vicini = utilizzabili(i);
  const prezzi = vicini.map((v) => v.price);
  const minimo = prezzi.length ? Math.min(...prezzi) : null;
  const massimo = prezzi.length ? Math.max(...prezzi) : null;
  const freschi = vicini.filter((v) => {
    const h = ageHours(v.row.updated, i.now);
    return h !== null && h <= ORE_FRESCHE;
  }).length;

  return {
    fuel: i.fuel,
    zona:
      minimo !== null && massimo !== null
        ? { media: prezzi.reduce((a, x) => a + x, 0) / prezzi.length, minimo, massimo, campione: prezzi.length }
        : null,
    consigliato: i.consigliato,
    storico: ritaglia(i.storico, GIORNI_STORICO).map((p) => ({ date: p.date, price: p.prezzo })),
    news: [],
    auto: i.auto ? { modello: i.auto.modello, serbatoioL: i.auto.serbatoioL, kml: i.auto.kml } : null,
    budget: null,
    mercato: {
      prov: i.quadro.provincia?.nome ?? null,
      deltaZonaItaliaC: i.quadro.provincia?.deltaC ?? null,
      spreadC: minimo !== null && massimo !== null && prezzi.length >= 2 ? (massimo - minimo) * 100 : null,
      autostradaC: sovrapprezzoAutostrada(i, vicini),
      servitoC: sovrapprezzoServito(i.fuel, vicini),
      marchiEconomici: marchiEconomici(vicini),
      frescoSuTotale: vicini.length > 0 ? [freschi, vicini.length] : null,
    },
  };
}

/** I numeri di oggi che `buildAiContext` non conosce. */
export function righeAggiuntive(i: DossierInput): string[] {
  const righe: string[] = [];
  const { nazionale, provincia, freschezza } = i.quadro;

  if (nazionale) {
    righe.push(`Media nazionale di oggi: ${e3(nazionale.media)} al litro su ${nazionale.campione} distributori.`);
  }
  if (provincia) {
    righe.push(
      `Media della provincia di ${provincia.nome}, solo strade e senza autostrade: ` +
        `${e3(provincia.media)} su ${provincia.campione} distributori.`,
    );
  }

  for (const giorni of [7, 30]) {
    const v = variazione(i.storico, giorni);
    if (!v) continue;
    const verso = Math.abs(v.deltaC) < 0.05 ? 'rimasta ferma' : v.deltaC < 0 ? `scesa di ${c1(v.deltaC)} centesimi` : `salita di ${c1(v.deltaC)} centesimi`;
    righe.push(`Rispetto a ${giorni} giorni fa la media nazionale e ${verso} (${v.percento >= 0 ? '+' : '-'}${c1(v.percento)}%).`);
  }

  const f = i.previsione;
  if (f && f.usable) {
    const verso = f.direction === 'flat' ? 'prezzi stabili' : f.direction === 'down' ? 'prezzi in calo' : 'prezzi in salita';
    righe.push(
      `Previsione statistica dell'app per i prossimi ${f.daysAhead} giorni: ${verso}, ` +
        `variazione attesa ${f.deltaC.toFixed(1)} centesimi al litro, affidabilita ${Math.round(f.confidence * 100)}%.`,
    );
  } else {
    righe.push("L'app non ha una previsione affidabile per i prossimi giorni: non inventarne una con cifre precise.");
  }

  if (i.ritmo.significativo && i.ritmo.migliore) {
    righe.push(
      `Negli ultimi mesi il giorno della settimana piu economico e stato ${i.ritmo.migliore.nome}, ` +
        `${c1(i.ritmo.migliore.scartoC)} centesimi sotto la media della sua settimana.`,
    );
  } else if (i.ritmo.giorni.length === 7) {
    righe.push('Nessun giorno della settimana costa stabilmente meno degli altri: e una leggenda.');
  }

  const s = nazionale ? scomponiPrezzo(nazionale.media, i.fuel) : null;
  if (s) {
    righe.push(
      `Su un litro a ${e3(s.prezzo)}: accisa ${e3(s.accisa)}, IVA ${e3(s.iva)}, ` +
        `prodotto e margine ${e3(s.prodotto)}. Le tasse sono il ${Math.round(s.quotaTasse * 100)}% del prezzo.`,
    );
  }

  if (freschezza.totale > 0) {
    righe.push(`In tutta Italia ${freschezza.ultimoGiorno} distributori su ${freschezza.totale} hanno comunicato il prezzo nelle ultime 24 ore.`);
  }

  righe.push(
    "Nelle risposte scrivi i numeri all'italiana, con la virgola (2,250 euro al litro), e per i prossimi giorni " +
      "attieniti alla previsione dell'app qui sopra.",
  );
  return righe;
}

export function dossierPrezzi(i: DossierInput): string {
  return [buildAiContext(contestoIa(i)), ...righeAggiuntive(i)].join('\n');
}

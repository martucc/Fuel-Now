import type { RawHistoryPoint } from './raw';
import type { ForecastView } from './forecast';
import { numero } from '../lib/formato';

/**
 * L'andamento della media nazionale: la serie del grafico e i numeri che la
 * riassumono.
 *
 * Lo storico del dataset non e uniforme: settimanale dal 2020 alla
 * primavera 2026, giornaliero da li in poi. Per questo le finestre si
 * tagliano sulle date e non sul numero di punti, e i confronti «una
 * settimana fa» cercano il punto giusto invece di contare all'indietro.
 */

const GIORNO_MS = 86_400_000;

export interface PuntoSerie {
  /** "YYYY-MM-DD" come arriva dal backend. */
  date: string;
  /** Mezzanotte UTC di quella data. */
  ts: number;
  /** Media nazionale, euro al litro. */
  prezzo: number;
}

/** Le finestre del grafico, in giorni. */
export type Finestra = 30 | 90 | 365;

/**
 * Lo storico ripulito: date leggibili, prezzi positivi, in ordine, una
 * data sola. Dove una data compare due volte vince l'ultima, che e la
 * rilevazione piu recente.
 */
export function pulisciStorico(storico: readonly RawHistoryPoint[] | undefined): PuntoSerie[] {
  const perData = new Map<string, PuntoSerie>();
  for (const p of storico ?? []) {
    if (!p || typeof p.date !== 'string' || !(p.avg > 0) || !Number.isFinite(p.avg)) continue;
    const ts = Date.parse(`${p.date.slice(0, 10)}T00:00:00Z`);
    if (!Number.isFinite(ts)) continue;
    perData.set(p.date.slice(0, 10), { date: p.date.slice(0, 10), ts, prezzo: p.avg });
  }
  return [...perData.values()].sort((a, b) => a.ts - b.ts);
}

/** Gli ultimi `giorni` giorni della serie, contati dall'ultimo punto e non da oggi. */
export function ritaglia(punti: readonly PuntoSerie[], giorni: number): PuntoSerie[] {
  const ultimo = punti[punti.length - 1];
  if (!ultimo) return [];
  const da = ultimo.ts - giorni * GIORNO_MS;
  return punti.filter((p) => p.ts >= da);
}

export interface Estremi {
  primo: PuntoSerie;
  ultimo: PuntoSerie;
  /** A pari prezzo, il piu recente: e quello che uno ricorda. */
  minimo: PuntoSerie;
  massimo: PuntoSerie;
}

export function estremi(punti: readonly PuntoSerie[]): Estremi | null {
  const primo = punti[0];
  const ultimo = punti[punti.length - 1];
  if (!primo || !ultimo) return null;
  let minimo = primo;
  let massimo = primo;
  for (const p of punti) {
    if (p.prezzo <= minimo.prezzo) minimo = p;
    if (p.prezzo >= massimo.prezzo) massimo = p;
  }
  return { primo, ultimo, minimo, massimo };
}

export interface Variazione {
  giorni: number;
  /** Il punto di partenza del confronto. */
  da: PuntoSerie;
  /** Centesimi al litro, col segno: negativo = prezzi scesi. */
  deltaC: number;
  /** Percentuale col segno. */
  percento: number;
}

/**
 * Di quanto e cambiata la media in `giorni` giorni, misurata dall'ultimo
 * punto. Il punto di partenza e l'ultimo rilevamento che non supera la data
 * cercata, ma solo se le e vicino: con un buco nello storico, un confronto
 * «di una settimana» fatto su tre settimane sarebbe un numero falso con
 * l'aria di essere vero. In quel caso si tace.
 */
export function variazione(punti: readonly PuntoSerie[], giorni: number): Variazione | null {
  const ultimo = punti[punti.length - 1];
  if (!ultimo || giorni <= 0) return null;
  const bersaglio = ultimo.ts - giorni * GIORNO_MS;
  const tolleranzaMs = Math.max(2, Math.ceil(giorni / 5)) * GIORNO_MS;

  let da: PuntoSerie | null = null;
  for (const p of punti) {
    if (p.ts <= bersaglio) da = p;
    else break;
  }
  if (!da || bersaglio - da.ts > tolleranzaMs) return null;

  return {
    giorni,
    da,
    deltaC: (ultimo.prezzo - da.prezzo) * 100,
    percento: ((ultimo.prezzo - da.prezzo) / da.prezzo) * 100,
  };
}

/**
 * I punti della previsione, dal giorno dopo l'ultimo rilevamento. Il
 * backend dichiara solo direzione, delta e orizzonte: si distribuisce il
 * delta in linea retta, senza ondulazioni che nessuno ha calcolato. Vuota
 * se la previsione non e affidabile: una linea tratteggiata si legge come
 * una promessa.
 */
export function puntiPrevisione(ultimo: PuntoSerie | undefined, f: ForecastView | null): PuntoSerie[] {
  if (!ultimo || !f || !f.usable || !(f.daysAhead > 0) || !Number.isFinite(f.deltaC)) return [];
  const giorni = Math.min(30, Math.round(f.daysAhead));
  const passo = f.deltaC / 100 / giorni;
  return Array.from({ length: giorni }, (_, i) => {
    const ts = ultimo.ts + (i + 1) * GIORNO_MS;
    return { date: new Date(ts).toISOString().slice(0, 10), ts, prezzo: ultimo.prezzo + passo * (i + 1) };
  });
}

/** «circa 1,2 cent», sempre positivo: il verso lo dice la frase. */
export function centesimiCirca(deltaC: number): string {
  const v = Math.abs(deltaC);
  return v < 0.05 ? 'meno di un decimo di cent' : `circa ${numero(v, 1)} cent`;
}

/** La riga sotto il grafico. Una frase sola, e niente previsione se non regge. */
export function frasePrevisione(f: ForecastView | null): string {
  if (!f || !f.usable || !(f.daysAhead > 0)) return 'Nessuna previsione affidabile per i prossimi giorni.';
  const giorni = Math.round(f.daysAhead);
  const quando = giorni === 1 ? 'domani' : `nei prossimi ${giorni} giorni`;
  if (f.direction === 'flat' || Math.abs(f.deltaC) < 0.05) {
    return `In tratteggio la previsione: prezzi stabili ${quando}.`;
  }
  const verso = f.deltaC < 0 ? 'in calo' : 'in salita';
  return `In tratteggio la previsione: ${verso} di ${centesimiCirca(f.deltaC)} al litro ${quando}.`;
}

export interface Andamento {
  /** I punti della finestra scelta. */
  punti: PuntoSerie[];
  estremi: Estremi | null;
  /** Vuota se la previsione non e affidabile. */
  previsione: PuntoSerie[];
  /** Misurate sull'intera serie: non cambiano con la finestra. */
  settimana: Variazione | null;
  mese: Variazione | null;
}

/** Tutto quello che serve al grafico, in una passata. */
export function andamento(storico: readonly PuntoSerie[], finestra: Finestra, f: ForecastView | null): Andamento {
  const punti = ritaglia(storico, finestra);
  return {
    punti,
    estremi: estremi(punti),
    previsione: puntiPrevisione(storico[storico.length - 1], f),
    settimana: variazione(storico, 7),
    mese: variazione(storico, 30),
  };
}

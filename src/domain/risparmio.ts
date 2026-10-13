import type { FuelKey } from './raw';

/**
 * Quanto hai risparmiato davvero.
 *
 * L'app dice «in tasca 4,43 €» e poi non sa piu niente: non sa se ci sei
 * andato, non sa se il conto tornava. Qui si chiude il cerchio, e si chiude
 * con una misura onesta — non «ti abbiamo fatto risparmiare», ma «hai pagato
 * questo rispetto alla media della tua provincia quel giorno».
 *
 * Il termine di paragone e la media di coorte registrata il giorno del
 * consiglio, non quella di oggi: confrontare un pieno di marzo con i prezzi
 * di agosto non misura niente.
 */

export interface ConsiglioRegistrato {
  /** Giorno in cui il consiglio e stato dato, YYYY-MM-DD. */
  date: string;
  fuel: FuelKey;
  stationId: string;
  stationName: string;
  /** Prezzo dell'impianto consigliato quel giorno. */
  price: number;
  /** Media della coorte di riferimento quel giorno: e il metro di paragone. */
  cohortAvg: number;
  /** Risparmio netto che l'app aveva promesso, per poterlo verificare. */
  netEur: number;
}

export interface PienoFatto {
  id: string;
  /** YYYY-MM-DD o ISO: si guarda solo la parte della data. */
  date: string;
  fuel: FuelKey;
  liters: number;
  pricePerLiter: number;
  stationName?: string;
}

export interface EsitoPieno {
  id: string;
  date: string;
  liters: number;
  pricePerLiter: number;
  /** Media della zona quel giorno. */
  riferimento: number;
  /** Euro sotto (positivo) o sopra (negativo) la media, su questo pieno. */
  scartoEur: number;
  /** true se il pieno e stato fatto dove l'app aveva detto; null se non c'era consiglio. */
  seguito: boolean | null;
  /** Il risparmio che l'app aveva promesso, quando c'era un consiglio. */
  promessoEur: number | null;
}

export interface Bilancio {
  esiti: EsitoPieno[];
  /** Somma degli scarti: quanto hai speso in meno della media, in tutto. */
  totaleEur: number;
  /** Pieni per cui esisteva un consiglio. */
  conConsiglio: number;
  /** Di quelli, quanti sono stati fatti dove diceva l'app. */
  seguiti: number;
  /** Scarto medio per pieno, null senza pieni misurabili. */
  mediaEur: number | null;
  /**
   * Quanto l'app aveva promesso contro quanto e successo davvero, sui soli
   * pieni fatti dove diceva lei. Serve a tarare il modello, non a vantarsi.
   */
  promessoEur: number | null;
  mantenutoEur: number | null;
}

/** Un pieno del giorno prima puo rispondere al consiglio di ieri sera. */
const GIORNI_TOLLERANZA = 1;

function giorno(iso: string): string {
  return iso.slice(0, 10);
}

function giorniFra(a: string, b: string): number {
  const ms = Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`);
  if (!Number.isFinite(ms)) return Number.POSITIVE_INFINITY;
  return Math.abs(ms) / 86400_000;
}

/** Nomi di impianti scritti a mano: si confrontano senza punteggiatura ne accenti. */
export function normalizzaNome(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function stessoImpianto(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const x = normalizzaNome(a);
  const y = normalizzaNome(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

/** Il consiglio piu vicino nel tempo, fra quelli dello stesso carburante. */
export function consiglioPer(
  pieno: PienoFatto,
  consigli: ConsiglioRegistrato[]
): ConsiglioRegistrato | null {
  const g = giorno(pieno.date);
  let scelto: ConsiglioRegistrato | null = null;
  let distanza = Number.POSITIVE_INFINITY;
  for (const c of consigli) {
    if (c.fuel !== pieno.fuel) continue;
    const d = giorniFra(g, c.date);
    if (d > GIORNI_TOLLERANZA) continue;
    if (d < distanza) {
      distanza = d;
      scelto = c;
    }
  }
  return scelto;
}

export function calcolaBilancio(
  pieni: PienoFatto[],
  consigli: ConsiglioRegistrato[]
): Bilancio {
  const esiti: EsitoPieno[] = [];

  for (const p of pieni) {
    if (!(p.liters > 0) || !(p.pricePerLiter > 0)) continue;
    const c = consiglioPer(p, consigli);
    // Senza un riferimento di quel giorno non si misura niente: il pieno
    // esiste ma resta fuori dal bilancio invece di essere confrontato con
    // una media di un altro mese.
    if (!c || !(c.cohortAvg > 0)) continue;

    esiti.push({
      id: p.id,
      date: giorno(p.date),
      liters: p.liters,
      pricePerLiter: p.pricePerLiter,
      riferimento: c.cohortAvg,
      scartoEur: (c.cohortAvg - p.pricePerLiter) * p.liters,
      seguito: stessoImpianto(p.stationName, c.stationName),
      promessoEur: c.netEur,
    });
  }

  esiti.sort((a, b) => b.date.localeCompare(a.date));

  const totaleEur = esiti.reduce((a, e) => a + e.scartoEur, 0);
  const conConsiglio = esiti.length;
  const seguiti = esiti.filter((e) => e.seguito === true).length;

  const daSeguiti = esiti.filter((e) => e.seguito === true && e.promessoEur !== null);
  const promessoEur = daSeguiti.length ? daSeguiti.reduce((a, e) => a + (e.promessoEur ?? 0), 0) : null;
  const mantenutoEur = daSeguiti.length ? daSeguiti.reduce((a, e) => a + e.scartoEur, 0) : null;

  return {
    esiti,
    totaleEur,
    conConsiglio,
    seguiti,
    mediaEur: conConsiglio ? totaleEur / conConsiglio : null,
    promessoEur,
    mantenutoEur,
  };
}

/** Solo i pieni di un certo anno, per il totale «quest'anno». */
export function filtraAnno(b: Bilancio, anno: number): Bilancio {
  const esiti = b.esiti.filter((e) => e.date.startsWith(String(anno)));
  const totaleEur = esiti.reduce((a, e) => a + e.scartoEur, 0);
  const seguiti = esiti.filter((e) => e.seguito === true).length;
  const daSeguiti = esiti.filter((e) => e.seguito === true && e.promessoEur !== null);
  return {
    esiti,
    totaleEur,
    conConsiglio: esiti.length,
    seguiti,
    mediaEur: esiti.length ? totaleEur / esiti.length : null,
    promessoEur: daSeguiti.length ? daSeguiti.reduce((a, e) => a + (e.promessoEur ?? 0), 0) : null,
    mantenutoEur: daSeguiti.length ? daSeguiti.reduce((a, e) => a + e.scartoEur, 0) : null,
  };
}

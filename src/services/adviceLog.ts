import type { ConsiglioRegistrato } from '../domain/risparmio';

/**
 * Il diario dei consigli.
 *
 * Senza questo l'app non puo sapere cosa aveva detto: il modello si
 * ricostruisce ogni volta dai prezzi di oggi, e la media di provincia di
 * tre settimane fa non esiste piu da nessuna parte. Una riga al giorno per
 * carburante basta a rendere misurabile tutto il resto.
 */

const CHIAVE = 'mf_consigli_v1';
/** Un anno abbondante di consigli su quattro carburanti, poi si taglia. */
const MAX_RIGHE = 500;

export function caricaConsigli(): ConsiglioRegistrato[] {
  try {
    const raw = localStorage.getItem(CHIAVE);
    if (!raw) return [];
    const dati = JSON.parse(raw);
    return Array.isArray(dati) ? (dati as ConsiglioRegistrato[]) : [];
  } catch {
    return [];
  }
}

function salva(righe: ConsiglioRegistrato[]): void {
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(righe.slice(-MAX_RIGHE)));
    window.dispatchEvent(new Event('mf-consigli-changed'));
  } catch {
    /* spazio finito: si perde il diario, non il resto dell'app */
  }
}

/**
 * Registra il consiglio di oggi. Una riga per giorno e carburante: se si
 * riapre l'app dieci volte, l'ultima lettura sostituisce la precedente.
 */
export function registraConsiglio(c: ConsiglioRegistrato): void {
  if (!(c.cohortAvg > 0) || !(c.price > 0)) return;
  const righe = caricaConsigli();
  const i = righe.findIndex((r) => r.date === c.date && r.fuel === c.fuel);
  if (i >= 0) {
    // Stesso impianto e stesso prezzo: non vale la pena riscrivere.
    const p = righe[i]!;
    if (p.stationId === c.stationId && p.price === c.price && p.cohortAvg === c.cohortAvg) return;
    righe[i] = c;
  } else {
    righe.push(c);
  }
  righe.sort((a, b) => a.date.localeCompare(b.date));
  salva(righe);
}

export function svuotaConsigli(): void {
  try {
    localStorage.removeItem(CHIAVE);
    window.dispatchEvent(new Event('mf-consigli-changed'));
  } catch {
    /* niente da fare */
  }
}

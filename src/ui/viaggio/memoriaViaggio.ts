import type { Luogo } from '../../services/luoghi';
import type { Strategia } from '../../domain/tappeViaggio';

/**
 * Cosa ricorda la scheda Viaggio fra un'apertura e l'altra: l'ultimo arrivo
 * scelto (col suo nome) e la priorita. La partenza no: di solito e dove sei.
 */
export interface MemoriaViaggio {
  arrivo: Luogo | null;
  strategia: Strategia | null;
}

const CHIAVE = 'mf2_viaggio';
const STRATEGIE: readonly Strategia[] = ['bilanciato', 'risparmio', 'veloce'];

/** Tiene solo i campi validi: un valore rotto torna vuoto invece di rompere la scheda. */
export function normalizzaMemoria(v: unknown): MemoriaViaggio {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const a = (o.arrivo && typeof o.arrivo === 'object' ? o.arrivo : null) as Record<string, unknown> | null;
  const lat = Number(a?.lat);
  const lng = Number(a?.lng);
  const arrivo =
    a && typeof a.nome === 'string' && a.nome.trim() && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
      ? { lat, lng, nome: a.nome.trim(), dettaglio: typeof a.dettaglio === 'string' ? a.dettaglio : '' }
      : null;
  const strategia = STRATEGIE.includes(o.strategia as Strategia) ? (o.strategia as Strategia) : null;
  return { arrivo, strategia };
}

export function leggiMemoria(): MemoriaViaggio {
  try {
    const s = localStorage.getItem(CHIAVE);
    return normalizzaMemoria(s ? JSON.parse(s) : null);
  } catch {
    return { arrivo: null, strategia: null };
  }
}

export function salvaMemoria(parziale: Partial<MemoriaViaggio>): void {
  try {
    localStorage.setItem(CHIAVE, JSON.stringify({ ...leggiMemoria(), ...parziale }));
  } catch { /* senza spazio o in incognito: pazienza, si riparte da capo */ }
}

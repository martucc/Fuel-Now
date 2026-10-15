import type { MarketAnalysis } from '../types';
import type { FuelKey } from '../domain/raw';
import type { CodiceErroreIa } from './geminiService';
import { ErroreIa } from './geminiService';

/**
 * Il commento dell'IA della scheda Prezzi: la forma in cui si mostra e la
 * copia salvata sul telefono.
 *
 * Una copia per carburante, modello e file dei prezzi: finche i prezzi non
 * cambiano non c'e niente di nuovo da commentare, e rifare la domanda
 * consumerebbe la quota gratuita dell'utente. Quando arriva un file nuovo
 * le copie vecchie si buttano, cosi localStorage non cresce sei volte al
 * giorno.
 */

export interface ConsiglioIa {
  titolo: string;
  testo: string;
}

export interface AnalisiIa {
  /** La risposta secca, una o due frasi. */
  sintesi: string;
  paragrafi: string[];
  consigli: ConsiglioIa[];
  modello: string;
  /** Quando e stata scritta, in millisecondi. */
  creata: number;
}

/** Il pezzo di localStorage che serve qui: in prova si passa un finto. */
export interface Archivio {
  readonly length: number;
  key(i: number): string | null;
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export const PREFISSO = 'mf2_ia_';

/** La «firma» del file dei prezzi: quando la pipeline l'ha prodotto. */
export function firmaDataset(d: { extracted_at?: string; source?: { generated_at?: string } } | null | undefined): string | null {
  return d?.source?.generated_at || d?.extracted_at || null;
}

export function chiaveAnalisi(fuel: FuelKey, modello: string, firma: string): string {
  return `${PREFISSO}${fuel}_${modello}_${firma}`;
}

/** Toglie la sintassi markdown che il modello a volte scrive comunque. */
function pulisci(s: string): string {
  return s
    .replace(/\*\*|__/g, '')
    .replace(/^\s*#{1,6}\s+/, '')
    .replace(/^\s*[-*•]\s+/, '')
    .trim();
}

/** Un paragrafo per riga non vuota: il prompt chiede paragrafi «separati da a capo». */
export function paragrafi(testo: string): string[] {
  return testo
    .split(/\n+/)
    .map(pulisci)
    .filter((p) => p.length > 0);
}

export function daRisposta(r: MarketAnalysis, modello: string, adesso: number): AnalisiIa {
  return {
    sintesi: pulisci(r.reasoning || ''),
    paragrafi: paragrafi(r.detailedReport || ''),
    consigli: (r.tips || [])
      .filter((t) => t && typeof t.title === 'string' && typeof t.text === 'string')
      .map((t) => ({ titolo: pulisci(t.title), testo: pulisci(t.text) }))
      .filter((t) => t.titolo || t.testo)
      .slice(0, 4),
    modello,
    creata: adesso,
  };
}

/** Il codice di un errore qualunque: la schermata ha sempre una frase da dire. */
export function codiceErrore(e: unknown, inLinea: boolean): CodiceErroreIa {
  if (e instanceof ErroreIa) return e.codice;
  return inLinea ? 'UNKNOWN' : 'NETWORK';
}

function valida(v: unknown): AnalisiIa | null {
  const o = v as Partial<AnalisiIa> | null;
  if (!o || typeof o !== 'object') return null;
  if (typeof o.sintesi !== 'string' || !Array.isArray(o.paragrafi) || !Array.isArray(o.consigli)) return null;
  if (typeof o.creata !== 'number' || typeof o.modello !== 'string') return null;
  const paragrafi = o.paragrafi.filter((p): p is string => typeof p === 'string');
  const consigli = o.consigli.filter(
    (c): c is ConsiglioIa => !!c && typeof c.titolo === 'string' && typeof c.testo === 'string',
  );
  if (!o.sintesi && paragrafi.length === 0) return null;
  return { sintesi: o.sintesi, paragrafi, consigli, modello: o.modello, creata: o.creata };
}

function archivioPredefinito(): Archivio | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function leggiAnalisi(chiave: string, archivio: Archivio | null = archivioPredefinito()): AnalisiIa | null {
  if (!archivio) return null;
  try {
    const s = archivio.getItem(chiave);
    return s ? valida(JSON.parse(s)) : null;
  } catch {
    return null;
  }
}

/**
 * Salva la copia e butta quelle di un file dei prezzi diverso da `firma`.
 * Se il telefono non ha spazio si resta senza copia: alla prossima apertura
 * si richiede, niente di peggio.
 */
export function salvaAnalisi(chiave: string, firma: string, a: AnalisiIa, archivio: Archivio | null = archivioPredefinito()): void {
  if (!archivio) return;
  try {
    const vecchie: string[] = [];
    for (let i = 0; i < archivio.length; i++) {
      const k = archivio.key(i);
      if (k && k.startsWith(PREFISSO) && !k.endsWith(`_${firma}`)) vecchie.push(k);
    }
    for (const k of vecchie) archivio.removeItem(k);
    archivio.setItem(chiave, JSON.stringify(a));
  } catch {
    /* niente spazio: pazienza */
  }
}

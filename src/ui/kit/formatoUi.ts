import { numero } from '../../lib/formato';
import { parseUpdatedAt } from '../../domain/freshness';

/** «850 m», «1,2 km», «14 km». */
export function distanza(km: number): string {
  if (!Number.isFinite(km)) return '—';
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`;
  return `${numero(km, km < 10 ? 1 : 0)} km`;
}

/**
 * Minuti di guida, a spanne: in linea d'aria per 1,3 (le strade non sono
 * dritte) a 35 km/h di media urbana. Serve a dare un'idea, non un orario.
 */
export function minutiGuida(km: number): number {
  return Math.max(1, Math.round(((km * 1.3) / 35) * 60));
}

/** «adesso», «alle 07:30», «ieri alle 18:00», «3 giorni fa». */
export function etaPrezzo(updated: string | null | undefined, adesso: Date): string {
  const d = parseUpdatedAt(updated);
  if (!d) return 'data sconosciuta';
  const ore = (adesso.getTime() - d.getTime()) / 3_600_000;
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const oggi = adesso.toDateString() === d.toDateString();
  if (oggi) return ore < 1 ? 'da poco' : `oggi alle ${hhmm}`;
  const ieri = new Date(adesso);
  ieri.setDate(ieri.getDate() - 1);
  if (ieri.toDateString() === d.toDateString()) return `ieri alle ${hhmm}`;
  const giorni = Math.max(2, Math.round(ore / 24));
  return `${giorni} giorni fa`;
}

/** Ore trascorse dall'aggiornamento del prezzo, o null se ignote. */
export function oreDa(updated: string | null | undefined, adesso: Date): number | null {
  const d = parseUpdatedAt(updated);
  return d ? Math.max(0, (adesso.getTime() - d.getTime()) / 3_600_000) : null;
}

/** «Via Roma 12, Lugo» senza ripetizioni e in minuscolo umano. */
export function indirizzo(address: string, city: string): string {
  const pulisci = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/(^|[\s'(-])\p{L}/gu, (m) => m.toUpperCase());
  // Il MIMIT mette spesso il CAP in coda all'indirizzo: «Via Piratello 21 48022».
  const a = pulisci(address.replace(/\b\d{5}\b/g, '').replace(/[\s,]+$/, ''));
  const c = pulisci(city);
  if (!a) return c;
  if (!c || a.toLowerCase().includes(c.toLowerCase())) return a;
  return `${a}, ${c}`;
}

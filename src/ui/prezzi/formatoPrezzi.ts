import { numero } from '../../lib/formato';
import type { FuelKey } from '../../domain/raw';

/**
 * Le poche forme che servono solo alla scheda Prezzi, costruite sopra
 * `lib/formato`: date corte del grafico e centesimi col segno.
 */

/** «12 set». Le date dello storico sono giorni, senza ora: si leggono in UTC. */
export function dataBreve(ts: number): string {
  return new Date(ts).toLocaleDateString('it-IT', { timeZone: 'UTC', day: 'numeric', month: 'short' });
}

/** «12 set 2026». */
export function dataConAnno(ts: number): string {
  return new Date(ts).toLocaleDateString('it-IT', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
}

/** «+1,2 cent», «−0,4 cent», «0,0 cent»: col segno, perche senza un delta non si legge. */
export function centesimiConSegno(c: number): string {
  if (!Number.isFinite(c)) return '—';
  const v = Math.abs(c) < 0.05 ? 0 : c;
  const segno = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${segno}${numero(Math.abs(v), 1)} cent`;
}

/** «alle 08:12» nell'ora del telefono. */
export function ora(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** «della benzina», «del GPL»: il nome col suo articolo, in minuscolo dove va. */
export function delCarburante(fuel: FuelKey): string {
  switch (fuel) {
    case 'benzina': return 'della benzina';
    case 'gpl': return 'del GPL';
    case 'metano': return 'del metano';
    default: return 'del diesel';
  }
}

/** Il metano si vende a chilo. */
export function unitaPrezzo(fuel: FuelKey): string {
  return fuel === 'metano' ? '€/kg' : '€/L';
}

import type { FuelKey } from '../../domain/raw';
import { litri, numero } from '../../lib/formato';

/** «45 min», «1 h», «3 h 50 min». */
export function durata(minuti: number): string {
  if (!Number.isFinite(minuti) || minuti <= 0) return '—';
  const tot = Math.max(1, Math.round(minuti));
  if (tot < 60) return `${tot} min`;
  const h = Math.floor(tot / 60);
  const m = tot % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** «1 sosta», «3 soste». */
export function soste(n: number): string {
  return n === 1 ? '1 sosta' : `${numero(n)} soste`;
}

/** Litri da mettere: un decimale sotto i dieci, interi sopra. Mai «0 L». */
export function litriDaMettere(l: number): string {
  if (!Number.isFinite(l)) return '—';
  return l < 10 ? litri(Math.max(0.1, l), 1) : litri(l, 0);
}

/** «€/L self», «€/L», «€/kg»: diesel e benzina si confrontano sul self. */
export function unitaPrezzo(fuel: FuelKey): string {
  if (fuel === 'metano') return '€/kg';
  return fuel === 'gpl' ? '€/L' : '€/L self';
}

import type { FuelKey, RawPricePair } from './raw';
import type { FuelType } from '../types';

/** Verbatim da fetch_stations.py:39-44. */
export const PRICE_LIMITS: Record<FuelKey, readonly [number, number]> = {
  diesel: [1.0, 3.5],
  benzina: [1.0, 3.5],
  gpl: [0.3, 2.0],
  metano: [0.5, 4.0],
};

/** fetch_stations.py:420 — per questi due la statistica usa solo il self. */
const SELF_ONLY: readonly FuelKey[] = ['diesel', 'benzina'];

export const FUEL_LABEL: Record<FuelKey, string> = {
  benzina: 'Benzina',
  diesel: 'Diesel',
  gpl: 'GPL',
  metano: 'Metano',
};

export function isPlausible(price: number, fuel: FuelKey): boolean {
  const [lo, hi] = PRICE_LIMITS[fuel];
  return Number.isFinite(price) && price >= lo && price <= hi;
}

/**
 * Il prezzo confrontabile di un impianto per un carburante, con la stessa
 * regola della pipeline: self puro per diesel e benzina, self-o-servito per
 * gpl e metano (il 95% delle pompe GPL è servito).
 * Restituisce null se il carburante non c'è o il prezzo è implausibile.
 */
export function selectPrice(pair: RawPricePair | undefined, fuel: FuelKey): number | null {
  if (!pair) return null;
  const self = pair[0];
  const servito = pair[1];
  const chosen = SELF_ONLY.includes(fuel) ? self : (self ?? servito);
  if (chosen === null || chosen === undefined) return null;
  return isPlausible(chosen, fuel) ? chosen : null;
}

const KEY_BY_TYPE: Record<FuelType, FuelKey> = {
  Benzina: 'benzina',
  Diesel: 'diesel',
  GPL: 'gpl',
  Metano: 'metano',
};

const TYPE_BY_KEY: Record<FuelKey, FuelType> = {
  benzina: 'Benzina',
  diesel: 'Diesel',
  gpl: 'GPL',
  metano: 'Metano',
};

export function toFuelKey(t: FuelType): FuelKey {
  return KEY_BY_TYPE[t];
}

export function toFuelType(k: FuelKey): FuelType {
  return TYPE_BY_KEY[k];
}

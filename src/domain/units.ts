import type { FuelKey } from './raw';

/** Spec § 6.3. Metano in km/kg, coerente con il prezzo in €/kg. */
export const DEFAULT_KML: Record<FuelKey, number> = {
  benzina: 15,
  diesel: 18,
  gpl: 11,
  metano: 14,
};

export const DEFAULT_TANK_L = 45;
export const TANK_FILL_FACTOR = 0.85;

export interface CarSpec {
  model: string;
  liters: number;
  kml: number;
}

function sane(v: number | null | undefined, lo: number, hi: number): boolean {
  return typeof v === 'number' && Number.isFinite(v) && v > lo && v < hi;
}

/** Litri di un pieno tipico: l'85% del serbatoio, 45 L se l'auto non è nota. */
export function litersFor(car: CarSpec | null): number {
  const tank = car && sane(car.liters, 5, 200) ? car.liters : DEFAULT_TANK_L;
  return tank * TANK_FILL_FACTOR;
}

/** Consumo reale dai rifornimenti > targa dell'auto > default del carburante. */
export function kmlFor(car: CarSpec | null, fuel: FuelKey, realKml: number | null): number {
  if (sane(realKml, 1, 100)) return realKml as number;
  if (car && sane(car.kml, 1, 100)) return car.kml;
  return DEFAULT_KML[fuel];
}

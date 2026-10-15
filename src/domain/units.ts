import type { FuelKey } from './raw';

/*
  Il metano si vende a peso: €/kg, bombole in kg, consumo in km/kg. Gli
  altri carburanti a volume: €/L, serbatoio in litri, km/L. I conti sono
  gli stessi (prezzo × quantita, km / consumo); cambiano le unita, e vanno
  scritte giuste dappertutto.
*/

/** Spec § 6.3, metano rivisto: km/kg di un'auto a metano del catalogo (Panda, Golf TGI, Octavia G-Tec: 20-24). */
export const DEFAULT_KML: Record<FuelKey, number> = {
  benzina: 15,
  diesel: 18,
  gpl: 11,
  metano: 22,
};

export const DEFAULT_TANK_L = 45;
export const TANK_FILL_FACTOR = 0.85;
/** Le bombole di un'auto a metano media del catalogo, in kg. */
export const DEFAULT_TANK_KG = 15;
/**
 * Col metano il pieno e quasi tutta la bombola: l'auto passa da sola a
 * benzina quando il gas finisce, e si arriva al distributore a bombole vuote.
 */
const FILL_METANO = 1;

export interface CarSpec {
  model: string;
  liters: number;
  kml: number;
  tags?: string;
}

/** «L» o «kg»: come si misura il carburante. */
export function unitaQuantita(fuel: FuelKey): 'L' | 'kg' {
  return fuel === 'metano' ? 'kg' : 'L';
}

/** «km/L» o «km/kg». */
export function unitaConsumo(fuel: FuelKey): string {
  return `km/${unitaQuantita(fuel)}`;
}

/** Un'auto a metano: per lei `liters` sono i kg delle bombole e `kml` i km con un kg. */
export function eAMetano(car: CarSpec): boolean {
  return /metano/i.test(`${car.model} ${car.tags ?? ''}`);
}

/**
 * L'auto, se i suoi numeri valgono per il carburante scelto. Le bombole di
 * un'auto a metano non sono un serbatoio di benzina, e il serbatoio di
 * un'auto a gasolio non si riempie di metano: in quei casi si usano i
 * valori medi del carburante.
 */
export function autoPerCarburante<T extends CarSpec>(car: T | null, fuel: FuelKey): T | null {
  if (!car) return null;
  return eAMetano(car) === (fuel === 'metano') ? car : null;
}

function sane(v: number | null | undefined, lo: number, hi: number): boolean {
  return typeof v === 'number' && Number.isFinite(v) && v > lo && v < hi;
}

/** Il serbatoio (o le bombole) per quel carburante: quello dell'auto se vale, altrimenti il medio. */
export function serbatoioPer(car: CarSpec | null, fuel: FuelKey = 'diesel'): number {
  const a = autoPerCarburante(car, fuel);
  if (a && sane(a.liters, 5, 200)) return a.liters;
  return fuel === 'metano' ? DEFAULT_TANK_KG : DEFAULT_TANK_L;
}

/**
 * La quantita di un pieno tipico: l'85% del serbatoio, 45 L se l'auto non e
 * nota; col metano le bombole intere, 15 kg se l'auto non e nota.
 */
export function litersFor(car: CarSpec | null, fuel: FuelKey = 'diesel'): number {
  return serbatoioPer(car, fuel) * (fuel === 'metano' ? FILL_METANO : TANK_FILL_FACTOR);
}

/** Consumo reale dai rifornimenti > targa dell'auto > default del carburante. */
export function kmlFor(car: CarSpec | null, fuel: FuelKey, realKml: number | null): number {
  if (sane(realKml, 1, 100)) return realKml as number;
  const a = autoPerCarburante(car, fuel);
  if (a && sane(a.kml, 1, 100)) return a.kml;
  return DEFAULT_KML[fuel];
}

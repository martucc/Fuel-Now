import { chili, litri, numero } from '../../lib/formato';
import type { FuelKey } from '../../domain/raw';
import type { CarSpec } from '../../domain/units';
import { eAMetano, unitaConsumo } from '../../domain/units';
import { parseUpdatedAt } from '../../domain/freshness';
import { FATTORE_STRADA, minutiStrada } from '../../domain/ranking';

/** «850 m», «1,2 km», «14 km». */
export function distanza(km: number): string {
  if (!Number.isFinite(km)) return '—';
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`;
  return `${numero(km, km < 10 ? 1 : 0)} km`;
}

/**
 * Minuti di guida, a spanne: in linea d'aria per il fattore strada (le
 * strade non sono dritte) alla media urbana del ranking, cosi «circa N min»
 * e i minuti in piu del consiglio sono lo stesso conto. Serve a dare
 * un'idea, non un orario.
 */
export function minutiGuida(km: number): number {
  return Math.max(1, Math.round(minutiStrada(km * FATTORE_STRADA)));
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

/** «38 L» o, col metano, «15 kg». */
export function quantita(v: number, fuel: FuelKey, dec = 0): string {
  return fuel === 'metano' ? chili(v, dec) : litri(v, dec);
}

/** «Serbatoio 38 L · 19,0 km/L», o per un'auto a metano «Bombole da 12 kg · 22,0 km/kg». */
export function descriviAuto(a: CarSpec): string {
  return eAMetano(a)
    ? `Bombole da ${chili(a.liters, 0)} · ${numero(a.kml, 1)} ${unitaConsumo('metano')}`
    : `Serbatoio ${litri(a.liters, 0)} · ${numero(a.kml, 1)} ${unitaConsumo('benzina')}`;
}

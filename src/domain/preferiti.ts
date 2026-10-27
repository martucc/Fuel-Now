import type { FuelKey } from './raw';
import type { StationRow } from './parse';
import { prezzoAllaPompa } from './parse';
import type { CohortIndex } from './market';
import { cohortFor } from './market';
import type { PriceLevel } from './pricing';
import { priceLevel } from './pricing';
import type { LatLng } from './geo';
import { haversineKm } from './geo';
import { etaNelLotto } from './freshness';

/**
 * «I miei distributori»: quelli che l'utente ha salvato con la stella, coi
 * prezzi di adesso. Sono i posti dove passa comunque (sotto casa, sulla
 * strada del lavoro): servono anche lontano dalla posizione attuale, per
 * questo non stanno dentro i 15 km della lista.
 */

export interface RigaPreferito {
  row: StationRow;
  /** Il prezzo che si paga: il self, o il servito dove il self non c'è. Null se il carburante manca. */
  prezzo: number | null;
  alServito: boolean;
  livello: PriceLevel | null;
  /** Dalla posizione dell'utente, se si sa. */
  km: number | null;
  vecchio: boolean;
  forseChiuso: boolean;
}

/**
 * I preferiti col carburante scelto: prima chi lo vende, dal più economico
 * (a pari prezzo il più vicino), poi chi non lo vende. Chi non c'è più nel
 * file (chiuso, tolto dal Ministero) semplicemente non compare: la stella
 * resta salvata e torna se l'impianto ricompare.
 */
export function righePreferiti(
  ids: ReadonlySet<string>,
  perId: ReadonlyMap<string, StationRow>,
  cohorts: CohortIndex,
  fuel: FuelKey,
  utente: LatLng | null,
  ultimoPrezzo: string | null,
): RigaPreferito[] {
  const righe: RigaPreferito[] = [];
  for (const id of ids) {
    const row = perId.get(id);
    if (!row) continue;
    const allaPompa = prezzoAllaPompa(row, fuel);
    const coorte = allaPompa && !allaPompa.alServito ? cohortFor(row, fuel, cohorts) : null;
    const { vecchio, forseChiuso } = etaNelLotto(row.updated, ultimoPrezzo);
    righe.push({
      row,
      prezzo: allaPompa?.prezzo ?? null,
      alServito: allaPompa?.alServito ?? false,
      livello: coorte && allaPompa ? priceLevel(allaPompa.prezzo, coorte).level : null,
      km: utente ? haversineKm(utente, { lat: row.lat, lng: row.lng }) : null,
      vecchio,
      forseChiuso,
    });
  }
  return righe.sort((a, b) => {
    if (a.prezzo === null || b.prezzo === null) {
      if (a.prezzo !== b.prezzo) return a.prezzo === null ? 1 : -1;
    } else if (a.prezzo !== b.prezzo) {
      return a.prezzo - b.prezzo;
    }
    return (a.km ?? Infinity) - (b.km ?? Infinity) || a.row.id.localeCompare(b.row.id);
  });
}

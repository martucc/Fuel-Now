import type { FuelKey } from './raw';
import type { StationRow } from './parse';
import type { CohortIndex } from './market';
import { cohortFor } from './market';
import type { PriceLevel } from './pricing';
import { priceLevel, Z_ABSURD } from './pricing';
import { ageHours, isLikelyClosed } from './freshness';

/**
 * Cosa finisce sulla mappa. Tutti gli impianti che vendono il carburante
 * scelto, in tutta Italia: la mappa di settembre teneva solo i piu economici
 * N per zoom (otto su milleduecento a livello di provincia) e da lontano
 * sembrava vuota. Il diradamento ora lo fanno i gruppi di MapLibre, che
 * dichiarano quanti impianti contengono.
 *
 * Il colore e il livello nella coorte (provincia, strada o autostrada):
 * lo stesso metro della Home e della lista, cosi un distributore non e
 * verde in un posto e rosso in un altro.
 */

/** Oltre una settimana senza comunicare un prezzo l'impianto e quasi sempre chiuso. */
export const GIORNI_PREZZO_VECCHIO = 7;

export interface PuntoMappa {
  id: string;
  lat: number;
  lng: number;
  /** Prezzo confrontabile (self quando c'e). */
  prezzo: number;
  /** Prezzo servito, se l'impianto lo comunica. */
  servito: number | null;
  livello: PriceLevel;
  /** Prezzo fermo da piu di una settimana: si mostra spento. */
  vecchio: boolean;
  /** Prezzo fuori scala per la sua coorte: quasi certamente un errore di battitura. */
  sospetto: boolean;
  marchio: string;
  nome: string;
}

export function puntiMappa(
  rows: StationRow[],
  cohorts: CohortIndex,
  fuel: FuelKey,
  now: Date,
  nascosti: ReadonlySet<string> = new Set(),
): PuntoMappa[] {
  const out: PuntoMappa[] = [];
  for (const r of rows) {
    const prezzo = r.prices[fuel];
    if (prezzo === undefined || nascosti.has(r.id)) continue;
    const coorte = cohortFor(r, fuel, cohorts);
    const { level, z } = coorte ? priceLevel(prezzo, coorte) : { level: 'normal' as PriceLevel, z: null };
    out.push({
      id: r.id,
      lat: r.lat,
      lng: r.lng,
      prezzo,
      servito: r.servito[fuel] ?? null,
      livello: level,
      vecchio: isLikelyClosed(ageHours(r.updated, now)),
      sospetto: z !== null && Math.abs(z) > Z_ABSURD,
      marchio: r.brand,
      nome: r.name,
    });
  }
  return out;
}

/** «1,629»: tre decimali, virgola italiana. Calcolato qui perche MapLibre non sa formattare in italiano. */
export function prezzoBreve(p: number): string {
  return p.toFixed(3).replace('.', ',');
}

/** Valore fuori scala che nessun minimo di gruppo sceglie mai al posto di un prezzo vero. */
export const PREZZO_ESCLUSO = 99;

export interface FeaturePunto {
  type: 'Feature';
  id: number;
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    id: string;
    prezzo: number;
    testo: string;
    livello: PriceLevel;
    /** 0 normale, 1 vecchio o sospetto: le espressioni di stile leggono numeri meglio che booleani. */
    spento: number;
    /** Ordine di precedenza nelle collisioni: il piu economico vince. */
    ordine: number;
    /**
     * Il prezzo che conta per il minimo di un gruppo: un prezzo spento non
     * puo diventare «da 1,299» per tutta la provincia.
     */
    minimo: number;
  };
}

export interface CollezionePunti {
  type: 'FeatureCollection';
  features: FeaturePunto[];
}

/**
 * La sorgente GeoJSON della mappa. Gli impianti spenti hanno precedenza
 * minima: quando le targhette non ci stanno tutte, cedono il posto a un
 * prezzo vero.
 */
export function collezionePunti(punti: PuntoMappa[]): CollezionePunti {
  return {
    type: 'FeatureCollection',
    features: punti.map((p, i) => {
      const spento = p.vecchio || p.sospetto ? 1 : 0;
      return {
        type: 'Feature',
        id: i,
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: {
          id: p.id,
          prezzo: p.prezzo,
          testo: prezzoBreve(p.prezzo),
          livello: p.livello,
          spento,
          ordine: Math.round(p.prezzo * 1000) + spento * 100_000,
          minimo: spento ? PREZZO_ESCLUSO : p.prezzo,
        },
      };
    }),
  };
}

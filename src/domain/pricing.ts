import type { Cohort } from './market';

export type PriceLevel = 'best' | 'good' | 'normal' | 'high' | 'worst';

/** Oltre questo scarto il dato è quasi certamente errato (spec § 6.3). */
export const Z_ABSURD = 4;

export const LEVEL_LABEL: Record<PriceLevel, string> = {
  best: 'Affarone',
  good: 'Conviene',
  normal: 'Nella media',
  high: 'Caro',
  worst: 'Salasso',
};

/** Prefisso --mf- perché Tailwind sovrascriverebbe i nomi nudi: vedi tokens.css. */
export const LEVEL_VAR: Record<PriceLevel, string> = {
  best: '--mf-price-best',
  good: '--mf-price-good',
  normal: '--mf-price-normal',
  high: '--mf-price-high',
  worst: '--mf-price-worst',
};

export function zScore(price: number, cohort: Cohort): number | null {
  if (!(cohort.std > 0)) return null;
  return (price - cohort.avg) / cohort.std;
}

export function levelForZ(z: number | null): PriceLevel {
  if (z === null) return 'normal';
  if (z <= -1.5) return 'best';
  if (z <= -0.5) return 'good';
  if (z < 0.5) return 'normal';
  if (z < 1.5) return 'high';
  return 'worst';
}

/**
 * Il livello viene dallo z nella propria coorte: è così che «caro» significa
 * caro rispetto a chi ti sta accanto e non rispetto all'Italia.
 *
 * `baselinePrice` è la correzione per gli impianti autostradali, che hanno
 * una coorte tutta loro fatta di prezzi alti: fra impianti tutti cari, il
 * meno caro esce «Affarone» pur costando venti centesimi più della pompa
 * sotto casa. Va passata SOLO per gli autostradali e SOLO quando è il prezzo
 * di riferimento della zona in cui si trova l'utente: applicarla a un
 * impianto stradale dall'altra parte della regione vorrebbe dire giudicarlo
 * col mercato di un'altra provincia.
 */
export function priceLevel(
  price: number,
  cohort: Cohort,
  baselinePrice?: number
): { level: PriceLevel; z: number | null; reliable: boolean } {
  const z = zScore(price, cohort);
  let lvl = levelForZ(z);

  if (baselinePrice !== undefined && price > baselinePrice && (lvl === 'best' || lvl === 'good')) {
    lvl = 'normal';
  }

  return { level: lvl, z, reliable: cohort.reliable && z !== null };
}

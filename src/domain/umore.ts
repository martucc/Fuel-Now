import type { PriceLevel } from './pricing';
import { numero } from '../lib/formato';

/**
 * L'umore della zona: quanto costano i distributori qui intorno rispetto
 * alla media italiana. Da qui viene il colore d'atmosfera dell'app (lo
 * sfondo, la barra, i titoli): verde dove si spende poco, ambra nella
 * media alta, rosso dove si spende tanto. Le stesse cinque fasce dei
 * prezzi, cosi il colore dell'app e quello dei numeri si capiscono a vicenda.
 *
 * Il metro e la mediana dei prezzi della zona, non il piu economico: il
 * consigliato e quasi sempre verde, e un'app sempre verde non dice niente.
 */
export type Umore = PriceLevel | 'neutro';

export interface QuadroUmore {
  umore: Umore;
  /** Mediana dei prezzi della zona, in €/L (o €/kg). */
  mediana: number | null;
  /** Mediana meno media italiana, in euro: negativo vuol dire che qui costa meno. */
  scarto: number | null;
  /** Quanti prezzi sono entrati nel conto. */
  n: number;
}

/** Sotto questo numero di prezzi la «zona» e un paio di pompe: niente umore. */
export const MIN_PREZZI_UMORE = 3;

/** Le soglie in euro al litro, dallo scarto della mediana sulla media italiana. */
export const SOGLIE_UMORE = {
  best: -0.04,
  good: -0.015,
  high: 0.015,
  worst: 0.04,
} as const;

function mediana(valori: number[]): number {
  const v = [...valori].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m]! : (v[m - 1]! + v[m]!) / 2;
}

export function umoreZona(prezzi: readonly number[], mediaItalia: number | null | undefined): QuadroUmore {
  const validi = prezzi.filter((p) => Number.isFinite(p) && p > 0);
  if (validi.length < MIN_PREZZI_UMORE || !(mediaItalia && mediaItalia > 0)) {
    return { umore: 'neutro', mediana: validi.length ? mediana(validi) : null, scarto: null, n: validi.length };
  }
  const med = mediana(validi);
  const scarto = med - mediaItalia;
  const umore: Umore =
    scarto <= SOGLIE_UMORE.best
      ? 'best'
      : scarto <= SOGLIE_UMORE.good
        ? 'good'
        : scarto < SOGLIE_UMORE.high
          ? 'normal'
          : scarto < SOGLIE_UMORE.worst
            ? 'high'
            : 'worst';
  return { umore, mediana: med, scarto, n: validi.length };
}

/** La frase sotto il titolo: com'e la zona oggi, in parole. */
export function fraseUmore(q: QuadroUmore): string | null {
  if (q.umore === 'neutro' || q.scarto === null) return null;
  // Al decimo di centesimo: 0,1 € fa «10 cent», non «10,0» per un errore di virgola mobile.
  const cent = Math.round(Math.abs(q.scarto) * 1000) / 10;
  const quanto = cent < 0.5 ? null : `${numero(cent, cent < 10 ? 1 : 0)} cent`;
  switch (q.umore) {
    case 'best':
      return `Qui oggi si spende poco: ${quanto} sotto la media italiana.`;
    case 'good':
      return `Qui i prezzi sono buoni: ${quanto} sotto la media italiana.`;
    case 'normal':
      return quanto ? `Qui i prezzi sono nella media italiana (${q.scarto < 0 ? '−' : '+'}${quanto}).` : 'Qui i prezzi sono nella media italiana.';
    case 'high':
      return `Qui i prezzi sono un po' alti: ${quanto} sopra la media italiana.`;
    case 'worst':
      return `Qui si spende tanto: ${quanto} sopra la media italiana.`;
  }
}

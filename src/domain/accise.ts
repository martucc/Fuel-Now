import type { FuelKey } from './raw';

/**
 * Quanto di quello che paghi e tassa.
 *
 * E il dato piu sorprendente di tutta l'app e nessuno lo mostra: piu di
 * meta del prezzo alla pompa non c'entra col petrolio. Spiega anche perche
 * il prezzo si muove molto meno del greggio — la parte che oscilla e la
 * fetta piccola.
 *
 * Il conto e esatto, non stimato: il prezzo esposto e (prodotto + accisa)
 * moltiplicato per l'IVA. Note ai valori nella costante qui sotto.
 */

/** IVA ordinaria sui carburanti. */
export const IVA = 0.22;

/**
 * Accisa in euro al litro.
 *
 * Valori del riallineamento benzina/gasolio in vigore dal 2025. Vanno
 * ricontrollati quando cambia il decreto: e l'unico numero di questo
 * modulo che il tempo puo rendere falso, ed e per questo che l'interfaccia
 * lo mostra sempre accanto al risultato invece di nasconderlo.
 *
 * GPL e metano restano fuori: si vendono a chilo e a metro cubo, con
 * accise che non si confrontano con quelle al litro senza dire una
 * sciocchezza.
 */
export const ACCISA: Partial<Record<FuelKey, number>> = {
  benzina: 0.7134,
  diesel: 0.6324,
};

export interface Scomposizione {
  /** Prezzo al litro da cui si parte. */
  prezzo: number;
  /** Quanto vale il carburante vero e proprio, piu il margine di chi lo vende. */
  prodotto: number;
  accisa: number;
  iva: number;
  /** Accisa piu IVA. */
  tasse: number;
  /** Frazione del prezzo che e tassa, da 0 a 1. */
  quotaTasse: number;
}

/**
 * Scompone il prezzo alla pompa. Restituisce null per i carburanti di cui
 * non si conosce l'accisa al litro: meglio non dire niente che dire un
 * numero inventato.
 */
export function scomponiPrezzo(prezzo: number, fuel: FuelKey): Scomposizione | null {
  const accisa = ACCISA[fuel];
  if (accisa === undefined) return null;
  if (!Number.isFinite(prezzo) || prezzo <= 0) return null;

  const imponibile = prezzo / (1 + IVA);
  const iva = prezzo - imponibile;
  const prodotto = imponibile - accisa;

  // Sotto la sola accisa il prezzo non e un prezzo: e un dato sbagliato.
  if (prodotto <= 0) return null;

  const tasse = accisa + iva;
  return {
    prezzo,
    prodotto,
    accisa,
    iva,
    tasse,
    quotaTasse: tasse / prezzo,
  };
}

/**
 * Di quanto cambierebbe il prezzo alla pompa se il prodotto cambiasse di
 * tot. Serve a spiegare perche il prezzo si muove poco: sul prodotto ci
 * cade sopra l'IVA, ma l'accisa resta ferma.
 */
export function effettoSulPrezzo(variazioneProdotto: number): number {
  return variazioneProdotto * (1 + IVA);
}

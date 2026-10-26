import type { PriceLevel } from '../../domain/pricing';

/** Il colore di un livello di prezzo. Solo per i prezzi, mai per la grafica. */
export const COLORE_LIVELLO: Record<PriceLevel, string> = {
  best: 'var(--color-mf-best)',
  good: 'var(--color-mf-good)',
  normal: 'var(--color-mf-normal)',
  high: 'var(--color-mf-high)',
  worst: 'var(--color-mf-worst)',
};

/** Le stesse tinte in esadecimale, per MapLibre che non legge le variabili CSS. */
export const HEX_LIVELLO: Record<PriceLevel, string> = {
  best: '#2ee59d',
  good: '#a6ef6b',
  normal: '#f6f7fb',
  high: '#ffb020',
  worst: '#ff5a5f',
};

export const HEX = {
  bg: '#05070a',
  surface: '#12151b',
  surface2: '#1b1f27',
  ink: '#f6f7fb',
  ink2: '#a3a9b8',
  accent: '#2f8cff',
  stale: '#8b90a0',
} as const;

export const ETICHETTA_LIVELLO: Record<PriceLevel, string> = {
  best: 'Tra i più economici',
  good: 'Sotto la media',
  normal: 'Nella media',
  high: 'Sopra la media',
  worst: 'Tra i più cari',
};

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
  best: '#30d158',
  good: '#9ee37d',
  normal: '#f5f5f7',
  high: '#ff9f0a',
  worst: '#ff453a',
};

export const HEX = {
  bg: '#000000',
  surface: '#1c1c1e',
  surface2: '#2c2c2e',
  ink: '#f5f5f7',
  ink2: '#a1a1a6',
  accent: '#0a84ff',
  stale: '#8e8e93',
} as const;

export const ETICHETTA_LIVELLO: Record<PriceLevel, string> = {
  best: 'Tra i più economici',
  good: 'Sotto la media',
  normal: 'Nella media',
  high: 'Sopra la media',
  worst: 'Tra i più cari',
};

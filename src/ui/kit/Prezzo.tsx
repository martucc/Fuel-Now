import type { PriceLevel } from '../../domain/pricing';
import { prezzo as formatoPrezzo } from '../../lib/formato';
import { COLORE_LIVELLO } from './livelli';

interface Props {
  valore: number;
  livello?: PriceLevel | null;
  /** Prezzo vecchio o impianto forse chiuso: grigio, non colorato. */
  spento?: boolean;
  misura?: 'eroe' | 'grande' | 'riga' | 'piccola';
  unita?: boolean;
  className?: string;
}

const MISURE = {
  eroe: 'text-[52px] leading-[52px] font-bold tracking-[-0.035em]',
  grande: 'text-[28px] leading-[32px] font-bold tracking-[-0.02em]',
  riga: 'text-[19px] leading-[22px] font-semibold tracking-[-0.01em]',
  piccola: 'text-[15px] leading-[18px] font-semibold',
} as const;

/** Un prezzo al litro: tre decimali, cifre tabulari, colore del suo livello. */
export function Prezzo({ valore, livello, spento, misura = 'riga', unita, className = '' }: Props) {
  const colore = spento ? 'var(--color-mf-stale)' : livello ? COLORE_LIVELLO[livello] : 'var(--color-mf-ink)';
  return (
    <span className={`mf-num whitespace-nowrap ${MISURE[misura]} ${className}`} style={{ color: colore }}>
      {formatoPrezzo(valore)}
      {unita && <span className="ml-1 align-baseline text-[0.42em] font-medium tracking-normal text-mf-ink-2">€/L</span>}
    </span>
  );
}

import type { CSSProperties } from 'react';
import type { PriceLevel } from '../../domain/pricing';
import { LEVEL_VAR } from '../../domain/pricing';
import { useNumeroAnimato } from '../motion';

export function priceColor(level: PriceLevel): string {
  return `var(${LEVEL_VAR[level]})`;
}

/** Prezzo all'italiana: tre decimali, virgola. */
export function formatEuro(price: number): string {
  return price.toFixed(3).replace('.', ',');
}

interface PriceTextProps {
  price: number;
  level: PriceLevel;
  /** Il prezzo grande della Home: 58px, peso 800, sans. */
  hero?: boolean;
  className?: string;
  /** Il prezzo scorre fino al nuovo valore invece di saltarci. */
  animato?: boolean;
}

export function PriceText({ price, level, hero = false, className, animato = false }: PriceTextProps) {
  // Il prezzo grande e il contenuto della Home: quando cambi carburante,
  // vederlo scorrere dice che e un'altra misura della stessa cosa.
  const mostrato = useNumeroAnimato(price, animato);
  const style: CSSProperties = {
    color: priceColor(level),
    fontFamily: hero ? 'var(--mf-font-sans)' : 'var(--mf-font-mono)',
    fontVariantNumeric: 'tabular-nums',
    ...(hero
      ? {
          fontSize: 'var(--mf-price-hero-size)',
          fontWeight: 800,
          letterSpacing: 'var(--mf-price-hero-tracking)',
          lineHeight: 1,
        }
      : { fontWeight: 500 }),
  };
  return (
    <span className={className} style={style}>
      {formatEuro(mostrato)}
    </span>
  );
}

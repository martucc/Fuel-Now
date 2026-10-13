import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { triggerHaptic } from '../../lib/haptics';

type Tono = 'pieno' | 'tinta' | 'grigio' | 'semplice';
type Misura = 'grande' | 'media' | 'piccola';

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  tono?: Tono;
  misura?: Misura;
  icona?: ReactNode;
  largo?: boolean;
  children?: ReactNode;
}

const TONI: Record<Tono, string> = {
  pieno: 'bg-mf-accent text-mf-accent-ink',
  tinta: 'bg-mf-accent-soft text-mf-accent',
  grigio: 'bg-mf-surface-2 text-mf-ink',
  semplice: 'bg-transparent text-mf-accent',
};

const MISURE: Record<Misura, string> = {
  grande: 'h-[52px] px-5 text-[17px] font-semibold rounded-mf-md gap-2',
  media: 'h-11 px-4 text-[15px] font-semibold rounded-mf-sm gap-2',
  piccola: 'h-8 px-3 text-[13px] font-semibold rounded-full gap-1.5',
};

/** Il bottone. Uno solo pieno per schermata: e l'azione che conta. */
export function Pulsante({ tono = 'pieno', misura = 'media', icona, largo, className = '', onClick, children, disabled, ...resto }: Props) {
  return (
    <button
      type="button"
      {...resto}
      disabled={disabled}
      onClick={(e) => {
        if (disabled) return;
        void triggerHaptic('light');
        onClick?.(e);
      }}
      className={`mf-press inline-flex items-center justify-center select-none whitespace-nowrap ${TONI[tono]} ${MISURE[misura]} ${largo ? 'w-full' : ''} ${disabled ? 'opacity-40' : ''} ${className}`}
    >
      {icona}
      {children}
    </button>
  );
}

/** Bottone tondo con sola icona, per le barre in alto e i controlli della mappa. */
export function PulsanteIcona({ etichetta, children, className = '', onClick, ...resto }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> & { etichetta: string }) {
  return (
    <button
      type="button"
      aria-label={etichetta}
      title={etichetta}
      {...resto}
      onClick={(e) => {
        void triggerHaptic('light');
        onClick?.(e);
      }}
      className={`mf-press grid h-10 w-10 place-items-center rounded-full bg-mf-surface-2 text-mf-ink ${className}`}
    >
      {children}
    </button>
  );
}

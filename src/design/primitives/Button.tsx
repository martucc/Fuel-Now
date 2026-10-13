import type { CSSProperties, ReactNode } from 'react';

export type ButtonTone = 'primary' | 'ghost' | 'quiet' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const SIZE: Record<ButtonSize, CSSProperties> = {
  sm: { padding: '8px 14px', fontSize: 13 },
  md: { padding: '12px 18px', fontSize: 14 },
  lg: { padding: '16px 20px', fontSize: 15 },
};

function tonaStyle(tone: ButtonTone): CSSProperties {
  switch (tone) {
    case 'primary':
      return { background: 'var(--mf-accent)', color: 'var(--mf-accent-ink)', border: '1px solid transparent' };
    case 'danger':
      return {
        background: 'color-mix(in srgb, var(--mf-price-worst) 14%, transparent)',
        color: 'var(--mf-price-worst)',
        border: '1px solid color-mix(in srgb, var(--mf-price-worst) 35%, transparent)',
      };
    case 'quiet':
      return { background: 'var(--mf-surface-raised)', color: 'var(--mf-ink)', border: '1px solid var(--mf-hairline)' };
    default:
      return { background: 'transparent', color: 'var(--mf-ink-2)', border: '1px solid var(--mf-hairline)' };
  }
}

interface Props {
  children: ReactNode;
  onClick?: () => void;
  tone?: ButtonTone;
  size?: ButtonSize;
  full?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
  type?: 'button' | 'submit';
  ariaLabel?: string;
}

export function Button({
  children, onClick, tone = 'quiet', size = 'md',
  full = false, disabled = false, icon, className, type = 'button', ariaLabel,
}: Props) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`inline-flex items-center justify-center gap-2 transition-transform active:scale-95 ${className ?? ''}`}
      style={{
        ...tonaStyle(tone),
        ...SIZE[size],
        width: full ? '100%' : undefined,
        borderRadius: 'var(--mf-radius-pill)',
        fontFamily: 'var(--mf-font-sans)',
        fontWeight: 700,
        lineHeight: 1.2,
        opacity: disabled ? 0.4 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {children}
    </button>
  );
}

/** Bottone tondo per le icone sole: barra, mappa, intestazioni dei fogli. */
export function IconButton({
  children, onClick, ariaLabel, tone = 'ghost', size = 40,
}: {
  children: ReactNode;
  onClick?: () => void;
  ariaLabel: string;
  tone?: ButtonTone;
  size?: number;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className="inline-flex items-center justify-center transition-transform active:scale-90"
      style={{
        ...tonaStyle(tone),
        width: size,
        height: size,
        borderRadius: 'var(--mf-radius-pill)',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

import type { CSSProperties, ReactNode } from 'react';

type Pad = 'none' | 'sm' | 'md' | 'lg';
const PAD: Record<Pad, number> = { none: 0, sm: 12, md: 16, lg: 24 };

interface CardProps {
  children: ReactNode;
  /** `raised` sta sopra un'altra card; `flat` non ha bordo. */
  tone?: 'default' | 'raised' | 'flat';
  pad?: Pad;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

export function Card({ children, tone = 'default', pad = 'md', className, style, onClick }: CardProps) {
  const base: CSSProperties = {
    background: tone === 'raised' ? 'var(--mf-surface-raised)' : tone === 'flat' ? 'transparent' : 'var(--mf-surface)',
    border: tone === 'flat' ? 'none' : '1px solid var(--mf-hairline)',
    borderRadius: 'var(--mf-radius-lg)',
    padding: PAD[pad],
    boxShadow: tone === 'flat' ? 'none' : 'var(--mf-edge-light)',
    ...style,
  };
  if (onClick) {
    return (
      <button onClick={onClick} className={className} style={{ ...base, width: '100%', textAlign: 'left' }}>
        {children}
      </button>
    );
  }
  return (
    <div className={className} style={base}>
      {children}
    </div>
  );
}

interface SectionProps {
  /** L'occhiello: mono, maiuscolo, spaziato. */
  title: string;
  /** Testo o controllo allineato a destra. */
  aside?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function Section({ title, aside, children, className }: SectionProps) {
  return (
    <section className={className}>
      <header className="mb-3 flex items-baseline justify-between gap-3 px-1">
        <h2 className="mf-label" style={{ fontSize: 10 }}>
          {title}
        </h2>
        {aside && (
          <span className="mf-num truncate" style={{ color: 'var(--mf-ink-2)', fontSize: 11 }}>
            {aside}
          </span>
        )}
      </header>
      {children}
    </section>
  );
}

interface EmptyProps {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}

/** Un vuoto dichiarato, non una schermata che sembra rotta. */
export function Empty({ icon, title, hint, action }: EmptyProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      {icon && <span style={{ color: 'var(--mf-muted)' }}>{icon}</span>}
      <p style={{ fontFamily: 'var(--mf-font-sans)', fontWeight: 600, fontSize: 15, color: 'var(--mf-ink)' }}>
        {title}
      </p>
      {hint && (
        <p style={{ color: 'var(--mf-ink-2)', fontSize: 12, lineHeight: 1.5, maxWidth: 280 }}>{hint}</p>
      )}
      {action}
    </div>
  );
}

interface StatProps {
  label: string;
  value: string;
  /** Colore del valore: per i prezzi passare priceColor(level). */
  color?: string;
  sub?: string;
}

export function Stat({ label, value, color, sub }: StatProps) {
  return (
    <div className="min-w-0">
      <div className="mf-label truncate" style={{ fontSize: 9 }}>
        {label}
      </div>
      <div
        className="mf-num mt-1 truncate"
        style={{ color: color ?? 'var(--mf-ink)', fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}
      >
        {value}
      </div>
      {sub && (
        <div className="mf-num truncate" style={{ color: 'var(--mf-ink-2)', fontSize: 10 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

/** Riga di dati con filetto sopra: la forma base di ogni elenco dell'app. */
export function Row({
  children,
  onClick,
  muted = false,
  first = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  muted?: boolean;
  first?: boolean;
}) {
  const style: CSSProperties = {
    borderTop: first ? 'none' : '1px solid var(--mf-hairline)',
    opacity: muted ? 0.5 : 1,
    width: '100%',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 0',
  };
  return onClick ? (
    <button onClick={onClick} style={style}>
      {children}
    </button>
  ) : (
    <div style={style}>{children}</div>
  );
}

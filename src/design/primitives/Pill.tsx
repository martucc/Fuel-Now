import type { CSSProperties, ReactNode } from 'react';

export type PillTone = 'accent' | 'neutral' | 'ghost';

const TONE: Record<PillTone, { background: string; color: string; border: string }> = {
  accent: { background: 'var(--mf-accent)', color: 'var(--mf-accent-ink)', border: '1px solid transparent' },
  neutral: { background: 'var(--mf-surface-raised)', color: 'var(--mf-ink)', border: '1px solid var(--mf-hairline)' },
  ghost: { background: 'transparent', color: 'var(--mf-ink-2)', border: '1px solid var(--mf-hairline)' },
};

export function pillStyle(tone: PillTone): CSSProperties {
  const t = TONE[tone];
  return {
    background: t.background,
    color: t.color,
    border: t.border,
    borderRadius: 'var(--mf-radius-pill)',
    padding: '6px 12px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--mf-gap-2)',
    fontFamily: 'var(--mf-font-sans)',
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
  };
}

interface PillProps {
  tone?: PillTone;
  children: ReactNode;
  className?: string;
}

export function Pill({ tone = 'neutral', children, className }: PillProps) {
  return (
    <span className={className} style={pillStyle(tone)}>
      {children}
    </span>
  );
}

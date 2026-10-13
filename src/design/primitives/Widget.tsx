import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { BLOCCO } from '../motion';

/**
 * La tessera del cruscotto: un'etichetta, un numero grande, una riga di
 * contesto. Una tessera dice una cosa sola — se ne dicesse due sarebbe una
 * scheda, e una schermata di schede si legge come un rapporto invece che
 * a colpo d'occhio.
 */
export function Widget({
  label,
  value,
  sub,
  color,
  icon,
  wide = false,
  onClick,
  children,
}: {
  label: string;
  /** Il numero. Vuoto o assente diventa un trattino, mai «undefined». */
  value?: string | null;
  sub?: ReactNode;
  color?: string;
  icon?: ReactNode;
  /** Occupa tutte e due le colonne. */
  wide?: boolean;
  onClick?: () => void;
  /** Contenuto libero al posto del numero, per le tessere disegnate. */
  children?: ReactNode;
}) {
  const contenuto = (
    <>
      <div className="mf-label flex items-center gap-1.5 truncate" style={{ fontSize: 9 }}>
        {icon}
        <span className="truncate">{label}</span>
      </div>

      {children ?? (
        <div
          className="mf-num mt-2 truncate"
          style={{
            color: color ?? 'var(--mf-ink)',
            fontSize: wide ? 30 : 24,
            fontWeight: 700,
            letterSpacing: '-0.035em',
            lineHeight: 1.05,
          }}
        >
          {value || '—'}
        </div>
      )}

      {sub && (
        <div className="mt-1.5" style={{ color: 'var(--mf-ink-2)', fontSize: 11.5, lineHeight: 1.4 }}>
          {sub}
        </div>
      )}
    </>
  );

  const stile = {
    background: 'var(--mf-surface)',
    border: '1px solid var(--mf-hairline)',
    borderRadius: 'var(--mf-radius-md)',
    boxShadow: 'var(--mf-edge-light)',
    gridColumn: wide ? 'span 2' : undefined,
    padding: '14px 16px 16px',
    textAlign: 'left' as const,
    width: '100%',
  };

  return onClick ? (
    <button onClick={onClick} style={stile} className="transition-transform active:scale-[0.98]">
      {contenuto}
    </button>
  ) : (
    <div style={stile}>{contenuto}</div>
  );
}

/** La griglia a due colonne che tiene insieme le tessere. */
export function WidgetGrid({ children }: { children: ReactNode }) {
  return (
    <motion.div variants={BLOCCO} className="grid grid-cols-2 gap-3">
      {children}
    </motion.div>
  );
}

/**
 * Barra a segmenti: quando il numero da solo non basta e quello che conta
 * sono le proporzioni fra le parti.
 */
export function BarraSegmenti({
  segmenti,
  altezza = 12,
}: {
  segmenti: { quota: number; colore: string; etichetta: string }[];
  altezza?: number;
}) {
  const totale = segmenti.reduce((a, s) => a + s.quota, 0) || 1;
  return (
    <div>
      <div
        className="flex overflow-hidden"
        style={{ height: altezza, borderRadius: 'var(--mf-radius-pill)', background: 'var(--mf-ground)' }}
      >
        {segmenti.map((s, i) => (
          <div
            key={i}
            title={s.etichetta}
            style={{
              width: `${(s.quota / totale) * 100}%`,
              background: s.colore,
              transition: 'width 340ms ease-out',
            }}
          />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
        {segmenti.map((s, i) => (
          <span key={i} className="flex items-center gap-1.5" style={{ fontSize: 11, color: 'var(--mf-ink-2)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: s.colore, flexShrink: 0 }} />
            {s.etichetta}
          </span>
        ))}
      </div>
    </div>
  );
}

import type { ReactNode } from 'react';

/**
 * Campo di un modulo: etichetta mono sopra, contenitore col filetto sotto.
 * Tutti i moduli dell'app passano da qui, cosi un campo si riconosce a
 * colpo d'occhio anche in una schermata che non si e mai vista.
 */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mf-label mb-2" style={{ fontSize: 9 }}>
        {label}
      </div>
      <div
        className="px-4 py-3"
        style={{
          background: 'var(--mf-ground)',
          border: '1px solid var(--mf-hairline)',
          borderRadius: 'var(--mf-radius-md)',
        }}
      >
        {children}
      </div>
      {hint && (
        <p className="mt-1.5" style={{ color: 'var(--mf-muted)', fontSize: 11, lineHeight: 1.45 }}>
          {hint}
        </p>
      )}
    </div>
  );
}

/** Input di testo del sistema: nessun bordo suo, lo da il Field. */
export function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  inputMode,
  mono = false,
  big = false,
  autoFocus = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: 'text' | 'date' | 'number' | 'password';
  inputMode?: 'text' | 'decimal' | 'numeric';
  mono?: boolean;
  big?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <input
      type={type}
      inputMode={inputMode}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className={`w-full border-none bg-transparent outline-none ${mono ? 'mf-num' : ''}`}
      style={{
        color: 'var(--mf-ink)',
        fontFamily: mono ? undefined : 'var(--mf-font-sans)',
        fontSize: big ? 24 : 15,
        fontWeight: big ? 600 : 400,
        letterSpacing: big ? '-0.02em' : undefined,
        colorScheme: 'dark',
      }}
    />
  );
}

/** Scelta fra poche opzioni: pillole in fila, una sola accesa. */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  columns,
}: {
  options: { key: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  /** Se assente le pillole scorrono in orizzontale invece di andare a capo. */
  columns?: number;
}) {
  return (
    <div
      className={columns ? 'grid gap-2' : 'flex gap-2 overflow-x-auto'}
      style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
    >
      {options.map((o) => {
        const attivo = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className="flex flex-shrink-0 items-center justify-center gap-1.5 py-2.5 transition-colors"
            style={{
              flexDirection: o.icon && columns && columns > 3 ? 'column' : 'row',
              paddingInline: 12,
              borderRadius: 'var(--mf-radius-pill)',
              fontSize: 12,
              fontFamily: 'var(--mf-font-sans)',
              fontWeight: attivo ? 600 : 500,
              background: attivo ? 'var(--mf-accent)' : 'transparent',
              color: attivo ? 'var(--mf-accent-ink)' : 'var(--mf-ink-2)',
              border: `1px solid ${attivo ? 'var(--mf-accent)' : 'var(--mf-hairline)'}`,
            }}
          >
            {o.icon}
            <span className="truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

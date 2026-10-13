interface Props {
  on: boolean;
  onChange: () => void;
  disabled?: boolean;
  ariaLabel: string;
  size?: 'sm' | 'md';
}

/** Interruttore unico dell'app: acceso = accento, spento = filetto. */
export function Toggle({ on, onChange, disabled = false, ariaLabel, size = 'md' }: Props) {
  const w = size === 'sm' ? 36 : 48;
  const h = size === 'sm' ? 20 : 28;
  const knob = h - 6;

  return (
    <button
      onClick={() => !disabled && onChange()}
      disabled={disabled}
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      className="relative flex-shrink-0 transition-colors"
      style={{
        width: w,
        height: h,
        borderRadius: 'var(--mf-radius-pill)',
        background: on ? 'var(--mf-accent)' : 'var(--mf-hairline)',
        opacity: disabled ? 0.35 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <span
        className="absolute transition-all"
        style={{
          top: 3,
          left: on ? w - knob - 3 : 3,
          width: knob,
          height: knob,
          borderRadius: '50%',
          background: on ? 'var(--mf-accent-ink)' : 'var(--mf-ink-2)',
        }}
      />
    </button>
  );
}

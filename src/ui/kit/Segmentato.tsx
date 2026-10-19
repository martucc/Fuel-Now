import { triggerHaptic } from '../../lib/haptics';

interface Props<T extends string> {
  valore: T;
  opzioni: ReadonlyArray<{ valore: T; etichetta: string }>;
  onCambia: (v: T) => void;
  etichetta: string;
  className?: string;
}

/**
 * Il controllo segmentato di iOS. La pillola che si sposta e un solo
 * elemento con transform: costa niente anche sulla WebView piu lenta.
 */
export function Segmentato<T extends string>({ valore, opzioni, onCambia, etichetta, className = '' }: Props<T>) {
  const i = Math.max(0, opzioni.findIndex((o) => o.valore === valore));
  const n = opzioni.length;
  return (
    <div role="radiogroup" aria-label={etichetta} className={`relative flex h-9 rounded-[10px] bg-mf-surface-2 p-[2px] ${className}`}>
      <span
        aria-hidden
        className="absolute bottom-[2px] top-[2px] rounded-[8px] bg-mf-surface-3 shadow-[0_1px_3px_rgb(0_0_0/0.35)] transition-transform duration-300 ease-[var(--ease-mf)]"
        style={{ width: `calc((100% - 4px) / ${n})`, transform: `translateX(${i * 100}%)` }}
      />
      {opzioni.map((o) => (
        <button
          key={o.valore}
          type="button"
          role="radio"
          aria-checked={o.valore === valore}
          onClick={() => {
            if (o.valore !== valore) {
              void triggerHaptic('selection');
              onCambia(o.valore);
            }
          }}
          className={`relative z-10 flex-1 text-[13px] font-semibold transition-colors ${o.valore === valore ? 'text-mf-ink' : 'text-mf-ink-2'}`}
        >
          {o.etichetta}
        </button>
      ))}
    </div>
  );
}

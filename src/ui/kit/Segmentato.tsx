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
    <div role="radiogroup" aria-label={etichetta} className={`relative flex h-10 rounded-[14px] bg-[rgb(255_255_255/0.06)] p-[3px] ring-1 ring-inset ring-[rgb(255_255_255/0.06)] ${className}`}>
      <span
        aria-hidden
        className="absolute bottom-[3px] top-[3px] rounded-[11px] bg-[rgb(255_255_255/0.14)] shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_4px_12px_-4px_rgb(0_0_0/0.6)] transition-transform duration-300 ease-[var(--ease-mf)]"
        style={{ width: `calc((100% - 6px) / ${n})`, transform: `translateX(${i * 100}%)` }}
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

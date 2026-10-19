import type { ReactNode } from 'react';

/** Una schermata o un riquadro senza niente da mostrare, detto chiaramente. */
export function Vuoto({ icona, titolo, testo, azione }: { icona?: ReactNode; titolo: string; testo?: ReactNode; azione?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-8 py-10 text-center">
      {icona && <div className="mb-3 text-mf-ink-3">{icona}</div>}
      <p className="mf-headline text-mf-ink">{titolo}</p>
      {testo && <p className="mf-subhead mt-1.5 text-mf-ink-2">{testo}</p>}
      {azione && <div className="mt-5">{azione}</div>}
    </div>
  );
}

/** Un segnaposto che pulsa piano mentre i dati arrivano. */
export function Segnaposto({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-mf-md bg-mf-surface-2/70 ${className}`} />;
}

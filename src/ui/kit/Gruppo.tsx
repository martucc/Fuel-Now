import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

/**
 * Un gruppo di righe su una superficie arrotondata, come nelle Impostazioni
 * di iOS. Le righe sono separate da un filo che parte dopo l'icona.
 */
export function Gruppo({ titolo, nota, children, className = '' }: { titolo?: string; nota?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      {titolo && <h2 className="mf-section-label mb-2 px-4">{titolo}</h2>}
      <div className="mf-gruppo overflow-hidden rounded-mf-lg [&>*+*]:border-t [&>*+*]:border-mf-hairline">{children}</div>
      {nota && <p className="mf-footnote mt-2 px-4 text-mf-ink-2">{nota}</p>}
    </section>
  );
}

interface RigaProps {
  icona?: ReactNode;
  titolo: ReactNode;
  sottotitolo?: ReactNode;
  valore?: ReactNode;
  freccia?: boolean;
  onClick?: () => void;
  className?: string;
}

export function Riga({ icona, titolo, sottotitolo, valore, freccia, onClick, className = '' }: RigaProps) {
  const contenuto = (
    <>
      {icona && <span className="grid h-8 w-8 shrink-0 place-items-center">{icona}</span>}
      <span className="min-w-0 flex-1 text-left">
        <span className="mf-body block truncate text-mf-ink">{titolo}</span>
        {sottotitolo && <span className="mf-footnote block truncate text-mf-ink-2">{sottotitolo}</span>}
      </span>
      {valore !== undefined && <span className="mf-body max-w-[45%] shrink-0 truncate text-right text-mf-ink-2">{valore}</span>}
      {freccia && <ChevronRight size={18} className="shrink-0 text-mf-ink-3" aria-hidden />}
    </>
  );
  const base = `flex min-h-[52px] w-full items-center gap-3 px-4 py-2.5 ${className}`;
  return onClick ? (
    <button type="button" onClick={onClick} className={`${base} mf-press active:bg-mf-surface-2`}>
      {contenuto}
    </button>
  ) : (
    <div className={base}>{contenuto}</div>
  );
}

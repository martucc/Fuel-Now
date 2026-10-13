import type { ReactNode } from 'react';
import { ArrowDownUp } from 'lucide-react';
import { PulsanteIcona } from '../kit/Pulsante';

export interface Capo {
  titolo: string;
  /** Riga piccola sotto: la provincia del luogo, o perche la posizione manca. */
  nota?: string;
  /** Nessun luogo scelto: il titolo e un invito, in grigio. */
  vuoto?: boolean;
}

interface Props {
  partenza: Capo;
  arrivo: Capo;
  onPartenza: () => void;
  onArrivo: () => void;
  /** Null quando non c'e niente da scambiare. */
  onInverti: (() => void) | null;
}

/** Da dove a dove: due righe da toccare e il bottone che le scambia. */
export function Tragitto({ partenza, arrivo, onPartenza, onArrivo, onInverti }: Props) {
  return (
    <div className="relative overflow-hidden rounded-mf-lg bg-mf-surface">
      <Campo
        segno={<span className="block h-3 w-3 rounded-full border-2 border-mf-ink-2" />}
        etichetta="Partenza"
        capo={partenza}
        onClick={onPartenza}
      />
      <div className="ml-12 mr-16 border-t border-mf-hairline" />
      <Campo
        segno={<span className="block h-3 w-3 rounded-[3px] bg-mf-ink" />}
        etichetta="Arrivo"
        capo={arrivo}
        onClick={onArrivo}
      />
      <div className="absolute inset-y-0 right-3 flex items-center">
        <PulsanteIcona
          etichetta="Inverti partenza e arrivo"
          disabled={!onInverti}
          onClick={() => onInverti?.()}
          className={`h-11 w-11 text-mf-ink-2 ${onInverti ? '' : 'opacity-40'}`}
        >
          <ArrowDownUp size={18} />
        </PulsanteIcona>
      </div>
    </div>
  );
}

function Campo({ segno, etichetta, capo, onClick }: { segno: ReactNode; etichetta: string; capo: Capo; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mf-press flex min-h-[64px] w-full items-center gap-3 py-2.5 pl-4 pr-16 text-left active:bg-mf-surface-2"
    >
      <span className="grid w-5 shrink-0 place-items-center">{segno}</span>
      <span className="min-w-0 flex-1">
        <span className="mf-caption block text-mf-ink-3">{etichetta}</span>
        <span className={`mf-body block truncate ${capo.vuoto ? 'text-mf-ink-3' : 'text-mf-ink'}`}>{capo.titolo}</span>
        {capo.nota && <span className="mf-footnote block truncate text-mf-ink-2">{capo.nota}</span>}
      </span>
    </button>
  );
}

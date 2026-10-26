import { Download, X } from 'lucide-react';
import type { Rilascio } from '../../domain/versione';
import { scartaVersione } from '../../app/nuovaVersione';
import { apriDownload } from '../../services/rilasci';
import { Pulsante } from './Pulsante';

/**
 * «C'è la versione nuova». Una carta sola in cima alla Home, finché non la
 * si scarica o si dice «non ora». Niente blu: il blu vuol dire «vai qui».
 */
export function AvvisoVersione({ rilascio, className = '' }: { rilascio: Rilascio; className?: string }) {
  return (
    <section className={`mf-carta relative p-4 ${className}`} aria-label="Versione nuova dell’app">
      <button
        type="button"
        aria-label="Non ora"
        onClick={() => scartaVersione(rilascio.versione)}
        className="mf-press absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full text-mf-ink-2"
      >
        <X size={17} />
      </button>
      <div className="flex items-start gap-3 pr-8">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
          style={{ background: 'color-mix(in srgb, var(--mf-umore) 18%, transparent)', color: 'var(--mf-umore)' }}
        >
          <Download size={19} />
        </span>
        <div className="min-w-0">
          <h2 className="mf-headline">È uscita la versione {rilascio.versione}</h2>
          {rilascio.note && <p className="mf-footnote mt-0.5 line-clamp-2 text-mf-ink-2">{rilascio.note}</p>}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Pulsante tono="grigio" icona={<Download size={16} />} onClick={() => void apriDownload(rilascio.apk)}>
          Scarica e installa
        </Pulsante>
        <Pulsante tono="semplice" onClick={() => scartaVersione(rilascio.versione)}>
          Non ora
        </Pulsante>
      </div>
    </section>
  );
}

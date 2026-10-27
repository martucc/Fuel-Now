import { useState } from 'react';
import { AlertCircle, ArrowUp, RefreshCw, Sparkles } from 'lucide-react';
import type { CodiceErroreIa } from '../../services/geminiService';
import { MESSAGGIO_ERRORE } from '../../services/geminiService';
import type { AnalisiIa } from '../../services/analisiIa';
import { Pulsante } from '../kit/Pulsante';
import { Segnaposto } from '../kit/Stato';
import type { StatoIa } from './useAnalisiIa';
import { ora } from './formatoPrezzi';

interface Props {
  ia: StatoIa;
  /** Serve a mostrare che i dati non sono ancora arrivati. */
  inAttesaDeiDati: boolean;
  onApriImpostazioni: () => void;
}

/** Errori che si risolvono nelle impostazioni, non riprovando. */
const DA_IMPOSTAZIONI: readonly CodiceErroreIa[] = ['MISSING_KEY', 'BAD_KEY'];

/**
 * Il commento dell'IA: Gemini, con la chiave dell'utente, legge i numeri
 * che l'app ha gia calcolato e li racconta. Non decide niente e non
 * inventa cifre: lo dice la nota in fondo, ed e la verita.
 */
export function SezioneIa({ ia, inAttesaDeiDati, onApriImpostazioni }: Props) {
  return (
    <section className="mt-7">
      <div className="mb-3 flex items-end justify-between gap-3 px-1">
        <h2 className="mf-title">Commento dell’IA</h2>
        <span className="mf-footnote text-mf-ink-2">Google Gemini</span>
      </div>

      {!ia.attiva ? (
        <div className="mf-carta p-4">
          <div className="flex gap-3">
            <Sparkles size={22} className="mt-0.5 shrink-0 text-mf-ink-2" aria-hidden />
            <p className="mf-subhead text-mf-ink-2">
              Con una chiave Google Gemini, l’IA legge i numeri di questa pagina e ti spiega cosa sta succedendo ai
              prezzi e cosa conviene fare. Puoi anche farle domande. La chiave è gratuita e resta sul telefono.
            </p>
          </div>
          <Pulsante className="mt-4" tono="grigio" largo icona={<Sparkles size={17} />} onClick={onApriImpostazioni}>
            Attiva l’IA
          </Pulsante>
        </div>
      ) : (
        <>
          <div className="mf-carta p-4">
            {ia.errore && (
              <Errore codice={ia.errore} onRiprova={ia.rigenera} onApriImpostazioni={onApriImpostazioni} />
            )}
            {ia.analisi ? (
              <Analisi a={ia.analisi} opaca={ia.carico} />
            ) : !ia.errore ? (
              <Caricamento testo={inAttesaDeiDati ? 'Aspetto i prezzi e la posizione…' : 'L’IA sta leggendo i numeri di oggi…'} />
            ) : null}
            {ia.analisi && (
              <Pulsante
                className="mt-4"
                tono="grigio"
                largo
                disabled={ia.carico}
                icona={<RefreshCw size={16} className={ia.carico ? 'animate-spin' : ''} />}
                onClick={ia.rigenera}
              >
                {ia.carico ? 'Rigenero…' : 'Rigenera'}
              </Pulsante>
            )}
          </div>
          <p className="mf-footnote mt-2 px-4 text-mf-ink-2">
            I numeri vengono dai calcoli dell’app sui prezzi del Ministero: l’IA li commenta e può sbagliare.
          </p>
          <Domanda ia={ia} disattiva={inAttesaDeiDati} onApriImpostazioni={onApriImpostazioni} />
        </>
      )}
    </section>
  );
}

function Analisi({ a, opaca }: { a: AnalisiIa; opaca: boolean }) {
  return (
    <div className={`transition-opacity duration-200 ${opaca ? 'opacity-50' : 'opacity-100'}`}>
      {a.sintesi && <p className="mf-headline text-mf-ink">{a.sintesi}</p>}
      {a.paragrafi.length > 0 && (
        <div className="mt-3 space-y-2.5">
          {a.paragrafi.map((p, i) => (
            <p key={i} className="mf-subhead text-mf-ink-2">{p}</p>
          ))}
        </div>
      )}
      {a.consigli.length > 0 && (
        <div className="mt-4 border-t border-mf-hairline pt-3">
          <p className="mf-footnote font-medium text-mf-ink-2">Consigli</p>
          <ul className="mt-2 space-y-2.5">
            {a.consigli.map((c, i) => (
              <li key={i} className="mf-subhead">
                {c.titolo && <span className="font-semibold text-mf-ink">{c.titolo}. </span>}
                <span className="text-mf-ink-2">{c.testo}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mf-caption mt-4 text-mf-ink-3">
        Scritto da {a.modello} alle {ora(a.creata)}.
      </p>
    </div>
  );
}

function Caricamento({ testo }: { testo: string }) {
  return (
    <div aria-busy="true">
      <p className="mf-footnote text-mf-ink-2">{testo}</p>
      <Segnaposto className="mt-3 h-[18px] w-11/12" />
      <Segnaposto className="mt-2 h-[18px] w-4/5" />
      <Segnaposto className="mt-2 h-[18px] w-2/3" />
    </div>
  );
}

function Errore({ codice, onRiprova, onApriImpostazioni }: { codice: CodiceErroreIa; onRiprova: () => void; onApriImpostazioni: () => void }) {
  const impostazioni = DA_IMPOSTAZIONI.includes(codice);
  return (
    <div className="mb-4 flex gap-3" role="alert">
      <AlertCircle size={20} className="mt-0.5 shrink-0 text-mf-warn" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="mf-subhead text-mf-ink">{MESSAGGIO_ERRORE[codice]}</p>
        <Pulsante className="mt-2.5" tono="grigio" onClick={impostazioni ? onApriImpostazioni : onRiprova}>
          {impostazioni ? 'Apri le impostazioni' : 'Riprova'}
        </Pulsante>
      </div>
    </div>
  );
}

function Domanda({ ia, disattiva, onApriImpostazioni }: { ia: StatoIa; disattiva: boolean; onApriImpostazioni: () => void }) {
  const [testo, setTesto] = useState('');
  const r = ia.risposta;
  const occupato = disattiva || !!r?.carico;
  const invia = () => {
    if (occupato || !testo.trim()) return;
    ia.chiedi(testo);
    setTesto('');
  };

  return (
    <div className="mt-5 mf-carta p-4">
      <h3 className="mf-headline">Chiedi all’IA</h3>
      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          invia();
        }}
      >
        <input
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          placeholder="Per esempio: scenderà ancora?"
          aria-label="La tua domanda"
          maxLength={300}
          enterKeyHint="send"
          autoComplete="off"
          className="mf-body h-11 min-w-0 flex-1 rounded-mf-sm bg-mf-surface-2 px-3 text-mf-ink outline-none placeholder:text-mf-ink-3"
        />
        <button
          type="submit"
          aria-label="Invia la domanda"
          disabled={occupato || !testo.trim()}
          className="mf-press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-mf-surface-2 text-mf-ink disabled:opacity-40"
        >
          <ArrowUp size={20} />
        </button>
      </form>

      {r && (
        <div className="mt-4 border-t border-mf-hairline pt-3" aria-live="polite">
          <p className="mf-footnote text-mf-ink-2">«{r.domanda}»</p>
          {r.carico ? (
            <Caricamento testo="L’IA sta pensando…" />
          ) : r.errore ? (
            <div className="mt-2">
              <Errore codice={r.errore} onRiprova={() => ia.chiedi(r.domanda)} onApriImpostazioni={onApriImpostazioni} />
            </div>
          ) : r.analisi ? (
            <div className="mt-2">
              {r.analisi.sintesi && <p className="mf-headline text-mf-ink">{r.analisi.sintesi}</p>}
              <div className="mt-2 space-y-2.5">
                {r.analisi.paragrafi.map((p, i) => (
                  <p key={i} className="mf-subhead text-mf-ink-2">{p}</p>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

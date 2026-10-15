import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, useDragControls, useMotionValue } from 'motion/react';
import { X } from 'lucide-react';
import { aggiungiIndietro } from './indietro';

interface Props {
  titolo?: ReactNode;
  sottotitolo?: ReactNode;
  onChiudi: () => void;
  children: ReactNode;
  /** `auto` cresce col contenuto; `alto` parte gia alto per i contenuti lunghi. */
  altezza?: 'auto' | 'alto';
  /** Azioni che restano attaccate in fondo e non scorrono col contenuto. */
  azioni?: ReactNode;
}

/**
 * Il foglio che sale dal basso: l'unica forma modale dell'app.
 *
 * Si chiude in quattro modi, tutti necessari: la X, il tocco sullo sfondo,
 * il trascinamento della maniglia e il gesto indietro di Android. Sopra
 * resta sempre una fascia di app scoperta, che dice dove si torna.
 *
 * Due elementi annidati e non uno: la salita sta su quello esterno in
 * percentuale, il trascinamento su quello interno in pixel. Sullo stesso
 * elemento motion non li fa convivere e il foglio resta fuori schermo.
 */
export function Foglio({ titolo, sottotitolo, onChiudi, children, altezza = 'auto', azioni }: Props) {
  const trascina = useDragControls();
  const velo = useMotionValue(0.6);
  const [filetto, setFiletto] = useState(false);
  const corpo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const togli = aggiungiIndietro(onChiudi);
    const prima = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      togli();
      document.body.style.overflow = prima;
    };
  }, [onChiudi]);

  const foglio = (
    <motion.div
      className="fixed inset-0 z-[3000] flex items-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onChiudi}
    >
      <motion.div className="absolute inset-0 bg-black" style={{ opacity: velo }} />
      <motion.div
        className="w-full"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 36, stiffness: 380 }}
        onClick={(e) => e.stopPropagation()}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={typeof titolo === 'string' ? titolo : 'Scheda'}
          drag="y"
          dragControls={trascina}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.9 }}
          dragSnapToOrigin
          onDrag={(_, info) => velo.set(Math.max(0, 0.6 * (1 - Math.max(0, info.offset.y) / 320)))}
          onDragEnd={(_, info) => {
            if (info.offset.y > 120 || info.velocity.y > 600) onChiudi();
            else velo.set(0.6);
          }}
          className="mf-foglio relative flex w-full flex-col rounded-t-mf-xl bg-mf-surface"
          style={{ maxHeight: '90vh', minHeight: altezza === 'alto' ? '75vh' : undefined }}
        >
          <div onPointerDown={(e) => trascina.start(e)} className="shrink-0 cursor-grab" style={{ touchAction: 'none' }}>
            <div className="flex justify-center pb-1 pt-2">
              <span className="h-[5px] w-9 rounded-full bg-mf-surface-3" />
            </div>
            <div className={`flex items-start gap-3 px-5 pb-3 pt-1 transition-colors ${filetto ? 'border-b border-mf-hairline' : 'border-b border-transparent'}`}>
              <div className="min-w-0 flex-1">
                {titolo && <h2 className="mf-title truncate text-mf-ink">{titolo}</h2>}
                {sottotitolo && <p className="mf-footnote mt-0.5 text-mf-ink-2">{sottotitolo}</p>}
              </div>
              <button
                type="button"
                onClick={onChiudi}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label="Chiudi"
                className="mf-press grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-mf-surface-2 text-mf-ink-2"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          <div
            ref={corpo}
            onScroll={() => setFiletto((corpo.current?.scrollTop ?? 0) > 4)}
            className="min-h-0 flex-1 overflow-y-auto px-5"
            style={{
              overscrollBehavior: 'contain',
              paddingBottom: azioni ? 12 : 'calc(var(--mf-safe-bottom) + 24px)',
            }}
          >
            {children}
          </div>

          {azioni && (
            <div className="shrink-0 border-t border-mf-hairline px-5 pt-3" style={{ paddingBottom: 'calc(var(--mf-safe-bottom) + 14px)' }}>
              {azioni}
            </div>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  );

  return createPortal(foglio, document.body);
}

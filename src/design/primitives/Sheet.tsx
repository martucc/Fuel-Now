import { useEffect, useRef, useState } from 'react';
import { motion, useDragControls, useMotionValue } from 'motion/react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props {
  title?: string;
  /** Riga piccola sotto il titolo: dove sei, non cosa fare. */
  sottotitolo?: string;
  onClose: () => void;
  children: ReactNode;
  /**
   * `auto` cresce col contenuto, `alto` parte gia in alto per i contenuti
   * lunghi. Nessuno dei due arriva al bordo: sopra resta sempre una fascia
   * di schermo, che e quella che fa capire che sotto c'e ancora l'app e
   * che si torna indietro toccandola.
   */
  height?: 'auto' | 'alto';
  /**
   * I pulsanti importanti. Restano attaccati in fondo e non scorrono: in
   * una scheda lunga finivano in coda al contenuto e per premerli bisognava
   * prima leggersi tutto lo storico.
   */
  azioni?: ReactNode;
}

/**
 * Il foglio che sale dal basso. Unica forma modale dell'app: niente
 * dialoghi nativi, che nella WebView bloccano il thread.
 *
 * Tre cose che prima non c'erano e che rendevano difficile uscirne:
 * la maniglia era disegnata ma non si trascinava, l'intestazione col
 * tasto di chiusura compariva solo se qualcuno passava un titolo, e il
 * tasto indietro di Android non lo guardava nessuno. Un foglio alto
 * 92vh senza titolo si chiudeva solo centrando la striscia di sfondo
 * rimasta scoperta in cima.
 */

/**
 * I fogli aperti, dal piu vecchio al piu recente.
 *
 * Il tasto indietro deve chiudere quello sopra, non tutti: dal dettaglio di
 * un impianto si puo aprire un altro foglio, e chiuderli insieme farebbe
 * perdere il posto.
 */
const pila: Array<() => void> = [];

function chiudiUltimo(): boolean {
  const ultimo = pila[pila.length - 1];
  if (!ultimo) return false;
  ultimo();
  return true;
}

let ascoltatoriMontati = false;

function montaAscoltatori() {
  if (ascoltatoriMontati || typeof window === 'undefined') return;
  ascoltatoriMontati = true;

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && chiudiUltimo()) e.preventDefault();
  });

  // Su Android il gesto indietro e il modo naturale di uscire da un foglio.
  // Senza questo l'app usciva del tutto invece di chiudere la scheda aperta.
  import('@capacitor/app')
    .then(({ App }) => {
      App.addListener('backButton', ({ canGoBack }) => {
        if (chiudiUltimo()) return;
        if (!canGoBack) App.exitApp();
      });
    })
    .catch(() => {
      // Sul web il plugin non c'e: resta l'Escape e il tocco sullo sfondo.
    });
}

export function Sheet({ title, sottotitolo, onClose, children, height = 'auto', azioni }: Props) {
  const trascina = useDragControls();
  /**
   * Lo sfondo si schiarisce mentre trascini: dice che stai uscendo prima
   * ancora di aver lasciato.
   *
   * Il valore si aggiorna da onDrag e non derivando dalla `y` del foglio.
   * Passare una MotionValue numerica in `style` mentre `initial`/`animate`
   * la muovono in percentuale le fa litigare, e il foglio resta parcheggiato
   * fuori schermo: meglio lasciare la y a motion e tenersi a parte solo il velo.
   */
  const velo = useMotionValue(0.65);
  const [ombraTesta, setOmbraTesta] = useState(false);
  const corpo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    montaAscoltatori();
    pila.push(onClose);

    // Il corpo sotto non deve scorrere insieme al foglio.
    const precedente = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      const i = pila.lastIndexOf(onClose);
      if (i >= 0) pila.splice(i, 1);
      if (pila.length === 0) document.body.style.overflow = precedente;
    };
  }, [onClose]);

  // Il filetto sotto l'intestazione compare solo quando c'e del contenuto
  // scorso via: a riposo sarebbe una riga in piu che non dice niente.
  const alloScorrimento = () => {
    const el = corpo.current;
    if (el) setOmbraTesta(el.scrollTop > 4);
  };

  const foglio = (
    <motion.div
      className="fixed inset-0 z-[3000] flex items-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="absolute inset-0"
        style={{ background: 'rgb(0 0 0)', opacity: velo, backdropFilter: 'blur(2px)' }}
      />

      {/*
        Due elementi e non uno: la salita e la discesa stanno qui fuori, in
        percentuale, e il trascinamento sta sul pannello dentro, in pixel.
        Messi sullo stesso elemento non convivono — con `drag` attivo motion
        non anima una y espressa in percentuale, e il foglio restava fermo a
        translateY(100%), cioe appena sotto il bordo dello schermo.
      */}
      <motion.div
        className="w-full"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 34, stiffness: 340 }}
        onClick={(e) => e.stopPropagation()}
      >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Scheda'}
        style={{
          background: 'var(--mf-surface-raised)',
          borderTopLeftRadius: 'var(--mf-radius-lg)',
          borderTopRightRadius: 'var(--mf-radius-lg)',
          borderTop: '1px solid var(--mf-hairline)',
          // Sopra resta sempre una fascia di schermo scoperta: e la via
          // d'uscita piu ovvia e la prova visiva che l'app e ancora li.
          maxHeight: '88vh',
          minHeight: height === 'alto' ? '72vh' : undefined,
          boxShadow: '0 -24px 60px rgba(0,0,0,.55)',
        }}
        drag="y"
        dragControls={trascina}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.9 }}
        dragSnapToOrigin
        onDrag={(_, info) => {
          velo.set(Math.max(0, 0.65 * (1 - Math.max(0, info.offset.y) / 320)));
        }}
        onDragEnd={(_, info) => {
          // Un trascinamento deciso vale quanto uno lungo: chi tira giu di
          // scatto ha gia detto cosa vuole.
          if (info.offset.y > 130 || info.velocity.y > 600) {
            onClose();
            return;
          }
          velo.set(0.65);
        }}
        onClick={(e) => e.stopPropagation()}
        className="relative flex w-full flex-col"
      >
        {/*
          Si trascina da qui e non da tutto il foglio: dentro c'e una lista
          che scorre, e i due gesti si contenderebbero il dito.
        */}
        <div
          onPointerDown={(e) => trascina.start(e)}
          style={{ touchAction: 'none', cursor: 'grab' }}
          className="flex-shrink-0"
        >
          <div className="flex justify-center pb-1 pt-3">
            <span style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--mf-hairline)' }} />
          </div>

          {/*
            L'intestazione c'e sempre, anche senza titolo: e li che sta il
            tasto per chiudere, e un foglio senza modo dichiarato di uscirne
            e la ragione per cui questa scheda dava fastidio.
          */}
          <div
            className="flex items-center justify-between gap-3 px-6 pb-3 pt-1"
            style={{
              borderBottom: `1px solid ${ombraTesta ? 'var(--mf-hairline)' : 'transparent'}`,
              transition: 'border-color .18s ease',
            }}
          >
            <div className="min-w-0 flex-1">
              {title && (
                <h2
                  className="min-w-0 truncate"
                  style={{
                    fontFamily: 'var(--mf-font-sans)',
                    fontWeight: 700,
                    fontSize: 18,
                    letterSpacing: '-0.02em',
                    color: 'var(--mf-ink)',
                  }}
                >
                  {title}
                </h2>
              )}
              {sottotitolo && (
                <p className="mt-0.5 truncate" style={{ color: 'var(--mf-ink-2)', fontSize: 12 }}>
                  {sottotitolo}
                </p>
              )}
            </div>

            <button
              onClick={onClose}
              // Il tasto sta dentro la zona che avvia il trascinamento: senza
              // fermare qui il pointerdown, premerlo comincerebbe una trascinata
              // da zero pixel e il tocco rischierebbe di non arrivare mai al click.
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Chiudi"
              className="flex flex-shrink-0 items-center justify-center active:scale-90"
              style={{
                width: 34,
                height: 34,
                borderRadius: 'var(--mf-radius-pill)',
                background: 'var(--mf-ground)',
                border: '1px solid var(--mf-hairline)',
                color: 'var(--mf-ink-2)',
                transition: 'transform .12s ease',
              }}
            >
              <X size={17} />
            </button>
          </div>
        </div>

        <div
          ref={corpo}
          onScroll={alloScorrimento}
          className="min-h-0 flex-1 overflow-y-auto px-6 pt-3"
          style={{
            overscrollBehavior: 'contain',
            paddingBottom: azioni ? 12 : 'calc(env(safe-area-inset-bottom) + 24px)',
          }}
        >
          {children}
        </div>

        {azioni && (
          <div
            className="flex-shrink-0 px-6 pt-3"
            style={{
              borderTop: '1px solid var(--mf-hairline)',
              background: 'var(--mf-surface-raised)',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)',
            }}
          >
            {azioni}
          </div>
        )}
      </motion.div>
      </motion.div>
    </motion.div>
  );

  return typeof document === 'undefined' ? foglio : createPortal(foglio, document.body);
}

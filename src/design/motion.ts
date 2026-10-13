import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';

/**
 * Come si muove l'app.
 *
 * Un solo posto: se ogni schermata inventa la sua molla, l'insieme sembra
 * fatto da persone diverse. Le durate sono corte di proposito — questa e
 * un'app che si apre al semaforo, non una vetrina.
 */

/** La molla di tutto cio che entra o si sposta. */
export const MOLLA = { type: 'spring' as const, damping: 26, stiffness: 260, mass: 0.7 };

/** Per le cose piccole: un'apertura, un colore, una barra. */
export const RAPIDO = { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const };

/** Il contenitore di una schermata: i figli entrano uno dietro l'altro. */
export const SCHERMATA = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { staggerChildren: 0.045, delayChildren: 0.02 },
  },
  exit: { opacity: 0, transition: { duration: 0.14 } },
};

/** Il singolo blocco dentro una schermata. */
export const BLOCCO = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: MOLLA },
  exit: { opacity: 0, y: -8, transition: { duration: 0.14 } },
};

/**
 * Un numero che cambia valore invece di saltarci.
 *
 * Serve dove il numero e il contenuto — il prezzo, il risparmio — non
 * ovunque: una cifra che balla mentre la leggi e peggio di una ferma.
 * Chi ha chiesto meno movimento al sistema operativo riceve il valore
 * secco, senza transizione.
 */
export function useNumeroAnimato(valore: number, attivo = true, durataMs = 420): number {
  const ridotto = useReducedMotion();
  const [mostrato, setMostrato] = useState(valore);
  const daRef = useRef(valore);
  const frameRef = useRef(0);

  useEffect(() => {
    if (!attivo || ridotto || !Number.isFinite(valore)) {
      daRef.current = valore;
      setMostrato(valore);
      return;
    }
    const da = daRef.current;
    if (da === valore) return;

    const inizio = performance.now();
    cancelAnimationFrame(frameRef.current);

    const passo = (ora: number) => {
      const t = Math.min(1, (ora - inizio) / durataMs);
      // easeOutCubic: parte decisa e si posa, come una cifra meccanica.
      const e = 1 - Math.pow(1 - t, 3);
      const v = da + (valore - da) * e;
      setMostrato(v);
      if (t < 1) frameRef.current = requestAnimationFrame(passo);
      else daRef.current = valore;
    };
    frameRef.current = requestAnimationFrame(passo);

    return () => cancelAnimationFrame(frameRef.current);
  }, [valore, attivo, durataMs, ridotto]);

  return mostrato;
}

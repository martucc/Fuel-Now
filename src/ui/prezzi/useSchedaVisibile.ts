import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

/**
 * true quando la scheda che contiene `rif` e quella a schermo.
 *
 * Le schede gia aperte restano montate e nascoste (`App.tsx` mette
 * `aria-hidden` sulla loro sezione): senza questo controllo un file dei
 * prezzi nuovo, arrivato mentre si guarda la Home, farebbe partire una
 * domanda a Gemini che nessuno legge, a spese della quota dell'utente.
 * Conta anche l'app in secondo piano.
 *
 * Parte da true: la scheda si monta quando la si apre.
 */
export function useSchedaVisibile(rif: RefObject<HTMLElement | null>): boolean {
  const [visibile, setVisibile] = useState(true);

  useEffect(() => {
    const sezione = rif.current?.closest('section') ?? null;
    const calcola = () =>
      setVisibile(document.visibilityState === 'visible' && sezione?.getAttribute('aria-hidden') !== 'true');
    const osservatore = sezione && typeof MutationObserver !== 'undefined' ? new MutationObserver(calcola) : null;
    if (sezione) osservatore?.observe(sezione, { attributes: true, attributeFilter: ['aria-hidden'] });
    document.addEventListener('visibilitychange', calcola);
    return () => {
      osservatore?.disconnect();
      document.removeEventListener('visibilitychange', calcola);
    };
  }, [rif]);

  return visibile;
}

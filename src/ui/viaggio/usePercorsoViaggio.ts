import { startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import type { LatLng } from '../../domain/geo';
import type { MotivoErrorePercorso, PercorsoViaggio } from '../../services/percorsoService';
import { chiediViaggio, ErrorePercorso, viaggioInCache } from '../../services/percorsoService';

export type StatoPercorso =
  | { fase: 'fermo' }
  | { fase: 'carico' }
  | { fase: 'errore'; motivo: MotivoErrorePercorso }
  | { fase: 'pronto'; percorso: PercorsoViaggio };

/** Oltre questo il router non rispondera piu: meglio dirlo e lasciar riprovare. */
const ATTESA_MAX_MS = 25_000;

function chiave(p: LatLng): string {
  return `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
}

/**
 * Il percorso da `da` ad `a`, chiesto al router quando cambiano.
 *
 * Lo stato si ricava dalla richiesta: se l'ultimo esito arrivato non e
 * quello della richiesta di adesso, si sta caricando. Cosi l'effetto non
 * deve mai azzerare niente, e un esito vecchio non si mostra per sbaglio.
 *
 * L'esito arriva in una transizione: il calcolo che segue (gli impianti
 * lungo la strada e il piano) non blocca un tocco dell'utente.
 */
export function usePercorsoViaggio(daOra: LatLng | null, aOra: LatLng | null): { stato: StatoPercorso; riprova: () => void } {
  const [tentativo, setTentativo] = useState(0);
  const [esito, setEsito] = useState<{ richiesta: string; stato: StatoPercorso } | null>(null);
  // I punti cambiano oggetto a ogni render (e il GPS trema di qualche
  // metro): contano solo quando cambia la chiave, a una decina di metri.
  const kDa = daOra ? chiave(daOra) : '';
  const kA = aOra ? chiave(aOra) : '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const da = useMemo(() => daOra, [kDa]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const a = useMemo(() => aOra, [kA]);
  const richiesta = da && a ? `${kDa}>${kA}#${tentativo}` : '';

  useEffect(() => {
    if (!da || !a || viaggioInCache(da, a)) return;
    const ctrl = new AbortController();
    let scaduto = false;
    const timer = setTimeout(() => {
      scaduto = true;
      ctrl.abort();
    }, ATTESA_MAX_MS);

    chiediViaggio(da, a, ctrl.signal)
      .then(
        (percorso) => startTransition(() => setEsito({ richiesta, stato: { fase: 'pronto', percorso } })),
        (e: unknown) => {
          if (ctrl.signal.aborted && !scaduto) return;
          const motivo = e instanceof ErrorePercorso ? e.motivo : 'rete';
          setEsito({ richiesta, stato: { fase: 'errore', motivo } });
        },
      )
      .finally(() => clearTimeout(timer));

    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [da, a, richiesta]);

  const riprova = useCallback(() => setTentativo((t) => t + 1), []);

  let stato: StatoPercorso;
  if (!da || !a) stato = { fase: 'fermo' };
  else {
    const gia = viaggioInCache(da, a);
    if (gia) stato = { fase: 'pronto', percorso: gia };
    else if (esito?.richiesta === richiesta) stato = esito.stato;
    else stato = { fase: 'carico' };
  }
  return { stato, riprova };
}

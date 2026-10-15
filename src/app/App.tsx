import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { datasetStore } from '../data/dataset';
import { avviaAggiornamentiAutomatici } from '../services/aggiornamentiAutomatici';
import { aggiornaPosizione, scegliLuogo, usaGps } from './posizione';
import { caricaAuto } from './dati';
import { useHome, useModello, usePuntiMappa } from './modello';
import { BarraSchede } from './BarraSchede';
import type { Scheda } from './BarraSchede';
import { aggiungiIndietro } from '../ui/kit/indietro';
import { prezzoBreve } from '../domain/mappa';
import { prezzoAllaPompa } from '../domain/parse';
import { Home } from '../ui/schermate/Home';
import { Mappa } from '../ui/schermate/Mappa';
import { FoglioImpianto } from '../ui/schermate/FoglioImpianto';
import { FoglioImpostazioni } from '../ui/schermate/FoglioImpostazioni';
import { FoglioLuogo } from '../ui/schermate/FoglioLuogo';

// Viaggio e Prezzi si caricano solo quando servono: l'apertura resta leggera.
const Viaggio = lazy(() => import('../ui/schermate/Viaggio').then((x) => ({ default: x.Viaggio })));
const Mercato = lazy(() => import('../ui/schermate/Mercato').then((x) => ({ default: x.Mercato })));

/**
 * Il guscio dell'app: quattro schede e i fogli che salgono dal basso.
 *
 * Le schede gia aperte restano montate (nascoste, non distrutte): tornando
 * sulla Mappa la si ritrova dove la si era lasciata, e la Home non perde il
 * punto della lista.
 */
export function App() {
  const m = useModello();
  const home = useHome(m);
  const punti = usePuntiMappa(m);

  const [scheda, setScheda] = useState<Scheda>('home');
  const [aperte, setAperte] = useState<ReadonlySet<Scheda>>(() => new Set(['home']));
  const [impianto, setImpianto] = useState<string | null>(null);
  const [impostazioni, setImpostazioni] = useState(false);
  const [luogo, setLuogo] = useState(false);

  // All'avvio: prezzi, posizione e auto partono insieme. Alla ripresa si
  // ricontrollano prezzi e posizione.
  useEffect(() => {
    void datasetStore().avvia();
    void aggiornaPosizione();
    void caricaAuto();
    return avviaAggiornamentiAutomatici(datasetStore(), () => void aggiornaPosizione());
  }, []);

  const cambiaScheda = useCallback((s: Scheda) => {
    setScheda(s);
    setAperte((prima) => (prima.has(s) ? prima : new Set([...prima, s])));
  }, []);

  // Il gesto indietro da un'altra scheda torna alla Home; dalla Home esce.
  useEffect(() => {
    if (scheda === 'home') return;
    return aggiungiIndietro(() => setScheda('home'));
  }, [scheda]);

  const apriImpianto = useCallback((id: string) => setImpianto(id), []);
  const chiudiImpianto = useCallback(() => setImpianto(null), []);
  const chiudiImpostazioni = useCallback(() => setImpostazioni(false), []);
  const chiudiLuogo = useCallback(() => setLuogo(false), []);

  const scelto = useMemo(() => {
    const r = impianto ? m.base?.perId.get(impianto) : null;
    const p = r ? prezzoAllaPompa(r, m.impostazioni.carburante) : null;
    return r && p ? { id: r.id, lat: r.lat, lng: r.lng, testo: prezzoBreve(p.prezzo) } : null;
  }, [impianto, m.base, m.impostazioni.carburante]);

  const best = home?.best ?? null;

  const pannello = (s: Scheda, contenuto: React.ReactNode, scorre = true) =>
    aperte.has(s) && (
      <section
        key={s}
        aria-hidden={scheda !== s}
        className={`absolute inset-0 ${scorre ? 'overflow-y-auto overscroll-contain' : 'overflow-hidden'} transition-opacity duration-150 ${scheda === s ? 'visible opacity-100' : 'invisible opacity-0'}`}
        style={scorre ? { paddingBottom: 'calc(var(--mf-tabbar-h) + var(--mf-safe-bottom) + 16px)' } : undefined}
      >
        {contenuto}
      </section>
    );

  return (
    <div className="relative h-full overflow-hidden bg-mf-bg text-mf-ink">
      {pannello(
        'home',
        <Home
          m={m}
          home={home}
          punti={punti}
          onApriImpianto={apriImpianto}
          onApriMappa={() => cambiaScheda('mappa')}
          onApriImpostazioni={() => setImpostazioni(true)}
          onScegliLuogo={() => setLuogo(true)}
        />,
      )}
      {pannello('mappa', <Mappa m={m} punti={punti} best={best} scelto={scelto} onApriImpianto={apriImpianto} />, false)}
      {pannello(
        'viaggio',
        <Suspense fallback={null}>
          <Viaggio m={m} onApriImpianto={apriImpianto} />
        </Suspense>,
      )}
      {pannello(
        'mercato',
        <Suspense fallback={null}>
          <Mercato m={m} home={home} onApriImpostazioni={() => setImpostazioni(true)} />
        </Suspense>,
      )}

      <BarraSchede attiva={scheda} onCambia={cambiaScheda} />

      <AnimatePresence>
        {impianto && <FoglioImpianto key="impianto" id={impianto} m={m} onChiudi={chiudiImpianto} />}
        {impostazioni && (
          <FoglioImpostazioni
            key="impostazioni"
            m={m}
            onChiudi={chiudiImpostazioni}
            onScegliLuogo={() => { setImpostazioni(false); setLuogo(true); }}
          />
        )}
        {luogo && (
          <FoglioLuogo
            key="luogo"
            titolo="Dove sei"
            conPosizione
            onChiudi={chiudiLuogo}
            onScegli={(l) => {
              if (l === 'gps') void usaGps();
              else scegliLuogo({ lat: l.lat, lng: l.lng }, l.nome);
              setLuogo(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

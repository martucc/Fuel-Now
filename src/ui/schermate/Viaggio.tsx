import { useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import type { Modello } from '../../app/modello';
import { aggiornaPosizione } from '../../app/posizione';
import { haversineKm } from '../../domain/geo';
import type { LivelloSerbatoio, Strategia } from '../../domain/tappeViaggio';
import { campionaPercorso, vistaPercorso } from '../../domain/lungoPercorso';
import type { Luogo } from '../../services/luoghi';
import { Segmentato } from '../kit/Segmentato';
import { MappaCarburanti } from '../mappa/MappaCarburanti';
import { FoglioLuogo } from './FoglioLuogo';
import { Tragitto } from '../viaggio/Tragitto';
import { Riepilogo } from '../viaggio/Riepilogo';
import { SchedaSosta } from '../viaggio/SchedaSosta';
import { CaricoPercorso, ErrorePercorso, SenzaArrivo, SenzaPartenza, StessoPosto } from '../viaggio/StatiViaggio';
import { usePercorsoViaggio } from '../viaggio/usePercorsoViaggio';
import { useCalcoloViaggio } from '../viaggio/useCalcoloViaggio';
import { leggiMemoria, salvaMemoria } from '../viaggio/memoriaViaggio';

interface Props {
  m: Modello;
  onApriImpianto: (id: string) => void;
}

const LIVELLI: ReadonlyArray<{ valore: LivelloSerbatoio; etichetta: string }> = [
  { valore: 'riserva', etichetta: 'Riserva' },
  { valore: 'quarto', etichetta: '1/4' },
  { valore: 'meta', etichetta: '1/2' },
  { valore: 'tre-quarti', etichetta: '3/4' },
  { valore: 'pieno', etichetta: 'Pieno' },
];

const STRATEGIE: ReadonlyArray<{ valore: Strategia; etichetta: string }> = [
  { valore: 'bilanciato', etichetta: 'Bilanciato' },
  { valore: 'risparmio', etichetta: 'Risparmio' },
  { valore: 'veloce', etichetta: 'Veloce' },
];

/** Partenza e arrivo piu vicini di cosi sono lo stesso posto. */
const STESSO_POSTO_KM = 0.5;
const ALTEZZA_MAPPA = 280;

/**
 * La scheda Viaggio: dove fare benzina lungo un percorso.
 *
 * Si sceglie l'arrivo (la partenza e dove sei, o un altro luogo), quanto
 * carburante hai adesso e la priorita. Il percorso lo da OSRM; gli impianti
 * candidati sono TUTTI quelli d'Italia entro poca strada dal percorso
 * (domain/lungoPercorso.ts), non solo quelli vicino alla partenza come
 * nella versione di settembre.
 */
export function Viaggio({ m, onApriImpianto }: Props) {
  const [memoria] = useState(leggiMemoria);
  const [partenzaScelta, setPartenzaScelta] = useState<Luogo | null>(null);
  const [arrivo, setArrivo] = useState<Luogo | null>(memoria.arrivo);
  const [livello, setLivello] = useState<LivelloSerbatoio>('meta');
  const [strategia, setStrategia] = useState<Strategia>(memoria.strategia ?? 'bilanciato');
  const [foglio, setFoglio] = useState<'partenza' | 'arrivo' | null>(null);

  const da = partenzaScelta ?? m.posizione.punto;
  const stesso = da && arrivo ? haversineKm(da, arrivo) < STESSO_POSTO_KM : false;
  const { stato, riprova } = usePercorsoViaggio(stesso ? null : da, stesso ? null : arrivo);
  const percorso = stato.fase === 'pronto' ? stato.percorso : null;
  const calcolo = useCalcoloViaggio(m, percorso, livello, strategia);

  const vista = useMemo(() => (calcolo.indice ? vistaPercorso(campionaPercorso(calcolo.indice.punti), 360, ALTEZZA_MAPPA) : null), [calcolo.indice]);
  const soste = useMemo(
    () => calcolo.soste.map((s) => ({ id: s.row.id, lat: s.row.lat, lng: s.row.lng, numero: s.numero })),
    [calcolo.soste],
  );

  const nomeDa = partenzaScelta?.nome ?? 'La tua posizione';
  const nomeA = arrivo?.nome ?? '';

  const scegliArrivo = (l: Luogo) => {
    setArrivo(l);
    salvaMemoria({ arrivo: l });
  };

  const inverti = () => {
    if (!da || !arrivo) return;
    const vecchiaPartenza: Luogo = partenzaScelta ?? { lat: da.lat, lng: da.lng, nome: 'La tua posizione', dettaglio: '' };
    setPartenzaScelta(arrivo);
    scegliArrivo(vecchiaPartenza);
  };

  return (
    <div className="mx-auto max-w-xl px-4 pb-6" style={{ paddingTop: 'calc(var(--mf-safe-top) + 8px)' }}>
      <h1 className="mf-large-title mt-1">Viaggio</h1>
      <p className="mf-subhead mt-1 text-mf-ink-2">Dove fare benzina lungo la strada, spendendo meno.</p>

      <div className="mt-4">
        <Tragitto
          partenza={{
            titolo: da ? nomeDa : 'Scegli la partenza',
            nota: partenzaScelta?.dettaglio || (partenzaScelta ? undefined : m.posizione.fase === 'manuale' ? m.posizione.luogo ?? undefined : 'GPS'),
            vuoto: !da,
          }}
          arrivo={{ titolo: arrivo ? nomeA : 'Dove vai?', nota: arrivo?.dettaglio || undefined, vuoto: !arrivo }}
          onPartenza={() => setFoglio('partenza')}
          onArrivo={() => setFoglio('arrivo')}
          onInverti={da && arrivo ? inverti : null}
        />
      </div>

      <section className="mt-5">
        <h2 className="mf-section-label mb-2 px-1">Quanto hai nel serbatoio</h2>
        <Segmentato etichetta="Quanto hai nel serbatoio" valore={livello} opzioni={LIVELLI} onCambia={setLivello} />
      </section>
      <section className="mt-4">
        <h2 className="mf-section-label mb-2 px-1">Cosa conta di più</h2>
        <Segmentato
          etichetta="Cosa conta di più"
          valore={strategia}
          opzioni={STRATEGIE}
          onCambia={(s) => {
            setStrategia(s);
            salvaMemoria({ strategia: s });
          }}
        />
        <p className="mf-footnote mt-2 px-1 text-mf-ink-2">
          {strategia === 'veloce'
            ? 'Solo distributori sulla strada: niente deviazioni.'
            : strategia === 'risparmio'
              ? 'Anche distributori un po’ fuori strada, se conviene.'
              : 'Un buon prezzo senza allungare troppo.'}
          {!m.auto && ' Per conti più giusti scegli la tua auto nelle impostazioni.'}
        </p>
      </section>

      <section className="mt-6 space-y-4">
        {!da ? (
          <SenzaPartenza cerco={m.posizione.fase === 'cerco'} onUsaPosizione={() => void aggiornaPosizione()} onScegli={() => setFoglio('partenza')} />
        ) : !arrivo ? (
          <SenzaArrivo onScegli={() => setFoglio('arrivo')} />
        ) : stesso ? (
          <StessoPosto />
        ) : stato.fase === 'errore' ? (
          <ErrorePercorso motivo={stato.motivo} onRiprova={riprova} onCambiaArrivo={() => setFoglio('arrivo')} />
        ) : stato.fase === 'carico' || !percorso ? (
          <CaricoPercorso altezzaMappa={ALTEZZA_MAPPA} />
        ) : (
          <>
            <div className="relative overflow-hidden rounded-mf-lg ring-1 ring-mf-hairline" style={{ height: ALTEZZA_MAPPA }}>
              <MappaCarburanti
                key={`${percorso.km}-${percorso.punti.length}`}
                punti={calcolo.punti}
                utente={m.posizione.punto}
                percorso={calcolo.linea}
                soste={soste}
                vistaIniziale={vista ?? undefined}
                onScegli={(id) => { if (id) onApriImpianto(id); }}
              />
            </div>
            <Riepilogo
              percorso={percorso}
              esito={calcolo.esito}
              nomeDa={nomeDa}
              nomeA={nomeA}
              fuel={m.impostazioni.carburante}
              strategia={strategia}
              lungoStrada={calcolo.esito ? calcolo.esito.candidate.length : null}
            />
            {calcolo.soste.map((s) => (
              <SchedaSosta key={s.row.id} s={s} fuel={m.impostazioni.carburante} adesso={m.adesso} onApri={() => onApriImpianto(s.row.id)} />
            ))}
          </>
        )}
      </section>

      <AnimatePresence>
        {foglio && (
          <FoglioLuogo
            key={foglio}
            titolo={foglio === 'partenza' ? 'Da dove parti' : 'Dove vai'}
            conPosizione={foglio === 'partenza'}
            onChiudi={() => setFoglio(null)}
            onScegli={(l) => {
              if (foglio === 'partenza') setPartenzaScelta(l === 'gps' ? null : l);
              else if (l !== 'gps') scegliArrivo(l);
              setFoglio(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

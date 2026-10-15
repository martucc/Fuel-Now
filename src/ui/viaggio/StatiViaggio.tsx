import { LocateFixed, MapPin, RefreshCw, Route } from 'lucide-react';
import type { MotivoErrorePercorso } from '../../services/percorsoService';
import { Pulsante } from '../kit/Pulsante';
import { Segnaposto, Vuoto } from '../kit/Stato';

/**
 * Gli stati della scheda Viaggio quando un piano non c'e ancora: cosa
 * manca, cosa sta succedendo, cosa e andato storto. Ognuno dice cosa fare.
 */

function Riquadro({ children }: { children: React.ReactNode }) {
  return <div className="rounded-mf-lg bg-mf-surface">{children}</div>;
}

export function SenzaPartenza({ cerco, onUsaPosizione, onScegli }: { cerco: boolean; onUsaPosizione: () => void; onScegli: () => void }) {
  return (
    <Riquadro>
      <Vuoto
        icona={<MapPin size={30} />}
        titolo={cerco ? 'Cerco dove sei…' : 'Da dove parti?'}
        testo={cerco ? 'Serve qualche secondo al GPS.' : 'Concedi la posizione all’app, oppure scegli da dove parti.'}
        azione={
          <div className="flex flex-col items-center gap-2">
            {!cerco && (
              <Pulsante tono="grigio" icona={<LocateFixed size={17} />} onClick={onUsaPosizione}>
                Usa la posizione
              </Pulsante>
            )}
            <Pulsante tono="grigio" onClick={onScegli}>
              Scegli la partenza
            </Pulsante>
          </div>
        }
      />
    </Riquadro>
  );
}

export function SenzaArrivo({ onScegli }: { onScegli: () => void }) {
  return (
    <Riquadro>
      <Vuoto
        icona={<Route size={30} />}
        titolo="Dove vai?"
        testo="Scegli l’arrivo: ti dico dove fare il pieno lungo la strada, guardando tutti i distributori d’Italia."
        azione={
          <Pulsante tono="grigio" onClick={onScegli}>
            Scegli l’arrivo
          </Pulsante>
        }
      />
    </Riquadro>
  );
}

export function StessoPosto() {
  return (
    <Riquadro>
      <Vuoto icona={<Route size={30} />} titolo="Partenza e arrivo coincidono" testo="Scegli un arrivo diverso dalla partenza." />
    </Riquadro>
  );
}

export function ErrorePercorso({ motivo, onRiprova, onCambiaArrivo }: { motivo: MotivoErrorePercorso; onRiprova: () => void; onCambiaArrivo: () => void }) {
  const nessuno = motivo === 'nessuno';
  return (
    <Riquadro>
      <Vuoto
        icona={<Route size={30} />}
        titolo={nessuno ? 'Non trovo una strada' : 'Percorso non disponibile'}
        testo={
          nessuno
            ? 'Fra questi due posti non c’è un percorso in auto. Prova un arrivo diverso.'
            : 'Non riesco a calcolare il percorso: controlla la connessione e riprova.'
        }
        azione={
          nessuno ? (
            <Pulsante tono="grigio" onClick={onCambiaArrivo}>
              Cambia arrivo
            </Pulsante>
          ) : (
            <Pulsante tono="grigio" icona={<RefreshCw size={17} />} onClick={onRiprova}>
              Riprova
            </Pulsante>
          )
        }
      />
    </Riquadro>
  );
}

export function CaricoPercorso({ altezzaMappa }: { altezzaMappa: number }) {
  return (
    <div aria-busy="true">
      <Segnaposto className="h-[176px] rounded-mf-lg" />
      <div className="mt-4 rounded-mf-lg" style={{ height: altezzaMappa }}>
        <Segnaposto className="h-full rounded-mf-lg" />
      </div>
      <p className="mf-footnote mt-3 text-center text-mf-ink-2">Calcolo il percorso…</p>
    </div>
  );
}

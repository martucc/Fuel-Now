import { useRef, useState } from 'react';
import { LocateFixed, RefreshCw } from 'lucide-react';
import type { Modello } from '../../app/modello';
import { aggiornaImpostazioni } from '../../app/impostazioni';
import { aggiornaPosizione } from '../../app/posizione';
import { datasetStore } from '../../data/dataset';
import type { CollezionePunti } from '../../domain/mappa';
import { prezzoBreve } from '../../domain/mappa';
import { FUEL_LABEL } from '../../domain/fuel';
import type { FuelKey } from '../../domain/raw';
import { FUEL_KEYS } from '../../domain/raw';
import type { RankedStation } from '../../domain/ranking';
import { Segmentato } from '../kit/Segmentato';
import { PulsanteIcona } from '../kit/Pulsante';
import type { ComandiMappa, PuntoEvidenziato } from '../mappa/MappaCarburanti';
import { MappaCarburanti } from '../mappa/MappaCarburanti';

interface Props {
  m: Modello;
  punti: CollezionePunti | null;
  best: RankedStation | null;
  scelto: PuntoEvidenziato | null;
  onApriImpianto: (id: string) => void;
}

const OPZIONI_CARBURANTE = FUEL_KEYS.map((k) => ({ valore: k, etichetta: FUEL_LABEL[k] }));

/**
 * La mappa a tutto schermo. Tutti i distributori del carburante scelto:
 * gruppi da lontano, targhette col prezzo da vicino, il consigliato in blu.
 */
export function Mappa({ m, punti, best, scelto, onApriImpianto }: Props) {
  const comandi = useRef<ComandiMappa | null>(null);
  const [legenda, setLegenda] = useState(true);
  const utente = m.posizione.punto;

  return (
    <div className="absolute inset-x-0 top-0" style={{ bottom: 'calc(var(--mf-tabbar-h) + var(--mf-safe-bottom))' }}>
      <MappaCarburanti
        comandi={comandi}
        punti={punti}
        utente={utente}
        consigliato={best ? { id: best.row.id, lat: best.row.lat, lng: best.row.lng, testo: prezzoBreve(best.price) } : null}
        scelto={scelto}
        vistaIniziale={utente ? { centro: utente, zoom: 12.5 } : undefined}
        onScegli={(id) => { if (id) onApriImpianto(id); }}
      />

      {/* In alto: il carburante, sopra la mappa. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 px-3" style={{ paddingTop: 'calc(var(--mf-safe-top) + 8px)' }}>
        <div className="pointer-events-auto mx-auto max-w-md rounded-[12px] bg-[rgb(28_28_30/0.94)] p-1 shadow-[0_8px_24px_rgb(0_0_0/0.45)]">
          <Segmentato
            etichetta="Carburante"
            valore={m.impostazioni.carburante}
            opzioni={OPZIONI_CARBURANTE}
            onCambia={(v) => aggiornaImpostazioni({ carburante: v as FuelKey })}
          />
        </div>
        {legenda && (
          <button
            type="button"
            onClick={() => setLegenda(false)}
            className="pointer-events-auto mx-auto mt-2 flex max-w-md items-center gap-3 rounded-full bg-[rgb(28_28_30/0.94)] px-3.5 py-1.5 text-[11.5px] text-mf-ink-2"
            aria-label="Nascondi la legenda"
          >
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-mf-best" /> economico</span>
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-mf-ink" /> nella media</span>
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-mf-worst" /> caro</span>
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-mf-accent" /> consigliato</span>
          </button>
        )}
      </div>

      {/* In basso a destra: aggiorna e torna a dove sei. */}
      <div className="absolute right-3 flex flex-col gap-2.5" style={{ bottom: 34 }}>
        <PulsanteIcona
          etichetta="Aggiorna i prezzi"
          className="h-11 w-11 bg-[rgb(28_28_30/0.94)] shadow-[0_6px_18px_rgb(0_0_0/0.5)]"
          onClick={() => void datasetStore().aggiorna('manuale')}
        >
          <RefreshCw size={19} className={m.dataset.fase === 'aggiorno' ? 'animate-spin text-mf-accent' : ''} />
        </PulsanteIcona>
        <PulsanteIcona
          etichetta="Torna alla tua posizione"
          className="h-11 w-11 bg-[rgb(28_28_30/0.94)] text-mf-accent shadow-[0_6px_18px_rgb(0_0_0/0.5)]"
          onClick={() => {
            void aggiornaPosizione();
            if (utente) comandi.current?.vola(utente, 13.5);
          }}
        >
          <LocateFixed size={20} />
        </PulsanteIcona>
      </div>
    </div>
  );
}

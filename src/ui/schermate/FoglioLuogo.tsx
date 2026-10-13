import { useEffect, useState } from 'react';
import { Search, MapPin, LocateFixed } from 'lucide-react';
import type { Luogo } from '../../services/luoghi';
import { cercaLuoghi } from '../../services/luoghi';
import { Foglio } from '../kit/Foglio';
import { Riga } from '../kit/Gruppo';

interface Props {
  titolo: string;
  /** Mostra in cima la voce «La mia posizione» (per il viaggio e per tornare al GPS). */
  conPosizione?: boolean;
  onScegli: (l: Luogo | 'gps') => void;
  onChiudi: () => void;
}

/** Cerca un luogo per nome. Si usa per scegliere dove sei e dove vai. */
export function FoglioLuogo({ titolo, conPosizione, onScegli, onChiudi }: Props) {
  const [testo, setTesto] = useState('');
  const [risultati, setRisultati] = useState<Luogo[]>([]);
  const [stato, setStato] = useState<'fermo' | 'cerco' | 'errore'>('fermo');

  useEffect(() => {
    if (testo.trim().length < 3) {
      setRisultati([]);
      setStato('fermo');
      return;
    }
    const ctrl = new AbortController();
    // Si cerca quando l'utente si ferma: Nominatim non vuole una richiesta per lettera.
    const t = setTimeout(() => {
      setStato('cerco');
      cercaLuoghi(testo, ctrl.signal)
        .then((r) => { setRisultati(r); setStato('fermo'); })
        .catch(() => { if (!ctrl.signal.aborted) setStato('errore'); });
    }, 450);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [testo]);

  return (
    <Foglio titolo={titolo} onChiudi={onChiudi} altezza="alto">
      <div className="sticky top-0 z-10 bg-mf-surface pb-3 pt-1">
        <label className="flex h-11 items-center gap-2 rounded-mf-sm bg-mf-surface-2 px-3">
          <Search size={17} className="shrink-0 text-mf-ink-3" />
          <input
            autoFocus
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            placeholder="Città, paese o indirizzo"
            className="mf-body h-full min-w-0 flex-1 bg-transparent text-mf-ink outline-none placeholder:text-mf-ink-3"
            autoComplete="off"
            enterKeyHint="search"
          />
        </label>
      </div>
      <div className="overflow-hidden rounded-mf-lg bg-mf-surface-2 [&>*+*]:border-t [&>*+*]:border-mf-hairline">
        {conPosizione && (
          <Riga icona={<LocateFixed size={19} className="text-mf-ink-2" />} titolo="La mia posizione" onClick={() => onScegli('gps')} />
        )}
        {risultati.map((l) => (
          <Riga
            key={`${l.lat},${l.lng}`}
            icona={<MapPin size={19} className="text-mf-ink-2" />}
            titolo={l.nome}
            sottotitolo={l.dettaglio}
            onClick={() => onScegli(l)}
          />
        ))}
      </div>
      <p className="mf-footnote mt-3 px-1 text-mf-ink-2">
        {stato === 'cerco' ? 'Cerco…' : stato === 'errore' ? 'Ricerca non disponibile: controlla la connessione.' : testo.trim().length >= 3 && risultati.length === 0 ? 'Nessun luogo trovato.' : ' '}
      </p>
    </Foglio>
  );
}

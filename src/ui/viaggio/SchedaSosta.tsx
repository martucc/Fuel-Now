import { ChevronRight, Navigation } from 'lucide-react';
import type { FuelKey } from '../../domain/raw';
import { euro, numero, prezzo as formatoPrezzo } from '../../lib/formato';
import { portamiLi } from '../../services/navigazione';
import { LogoMarchio } from '../kit/LogoMarchio';
import { Prezzo } from '../kit/Prezzo';
import { Pulsante } from '../kit/Pulsante';
import { nomeMarchio } from '../kit/marchio';
import { distanza, etaPrezzo, indirizzo, oreDa } from '../kit/formatoUi';
import { litriDaMettere, unitaPrezzo } from './formatoViaggio';
import type { SostaMostrata } from './useCalcoloViaggio';

interface Props {
  s: SostaMostrata;
  fuel: FuelKey;
  adesso: Date;
  onApri: () => void;
}

/** Sotto questa distanza dalla strada l'impianto e «sulla strada». */
const SULLA_STRADA_KM = 0.15;

/**
 * Una sosta del piano: dove, a che prezzo, quanto mettere e il bottone per
 * andarci. Il numero e blu come sulla mappa: e un «vai qui».
 */
export function SchedaSosta({ s, fuel, adesso, onApri }: Props) {
  const r = s.row;
  const t = s.sosta.tappa;
  const titolo = nomeMarchio(r.brand);
  const via = indirizzo(r.address, r.city);
  const ore = oreDa(r.updated, adesso);
  const vecchio = ore !== null && ore > 72;
  const servito = r.servito[fuel];

  return (
    <article className="rounded-mf-lg bg-mf-surface p-4">
      <button type="button" onClick={onApri} className="mf-press flex w-full items-center gap-3 text-left">
        <span
          className="mf-num grid h-8 w-8 shrink-0 place-items-center rounded-full bg-mf-accent text-[15px] font-bold text-mf-accent-ink"
          aria-label={`Sosta ${s.numero}`}
        >
          {s.numero}
        </span>
        <LogoMarchio marchio={r.brand} misura={40} />
        <span className="min-w-0 flex-1">
          <span className="mf-headline block truncate">{titolo}</span>
          <span className="mf-footnote block truncate text-mf-ink-2">{via}</span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-mf-ink-3" />
      </button>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="flex items-end gap-4">
          <div>
            <Prezzo valore={t.prezzo} livello={t.level} spento={vecchio} misura="grande" />
            <p className="mf-caption mt-0.5 text-mf-ink-2">{unitaPrezzo(fuel)}</p>
          </div>
          {servito !== undefined && servito !== t.prezzo && (
            <div className="pb-[18px]">
              <span className="mf-num text-[15px] font-semibold text-mf-ink-2">{formatoPrezzo(servito)}</span>
              <p className="mf-caption text-mf-ink-3">servito</p>
            </div>
          )}
        </div>
        <div className="text-right">
          <p className="mf-caption text-mf-ink-2">{s.sosta.pieno ? 'Fai il pieno' : 'Metti'}</p>
          <p className="mf-num mf-headline">{litriDaMettere(s.sosta.litri)}</p>
          <p className="mf-caption mf-num text-mf-ink-2">{euro(s.sosta.spesa)}</p>
        </div>
      </div>

      <p className="mf-footnote mt-3 text-mf-ink-2">
        Al km {numero(t.kmDaPartenza)}
        {' · '}
        {s.scostamentoKm < SULLA_STRADA_KM ? 'sulla strada' : `a ${distanza(s.scostamentoKm)} dalla strada`}
        {' · '}
        <span className={vecchio ? 'text-mf-warn' : ''}>prezzo {etaPrezzo(r.updated, adesso)}</span>
      </p>

      <Pulsante
        largo
        className="mt-3"
        icona={<Navigation size={17} />}
        onClick={() => void portamiLi({ lat: r.lat, lng: r.lng, nome: `${titolo} ${via}` })}
      >
        Portami lì
      </Pulsante>
    </article>
  );
}

import { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { Finestra, PuntoSerie, Variazione } from '../../domain/andamento';
import { andamento, frasePrevisione } from '../../domain/andamento';
import type { ForecastView } from '../../domain/forecast';
import type { FuelKey } from '../../domain/raw';
import { delta, prezzo as formatoPrezzo } from '../../lib/formato';
import { Segmentato } from '../kit/Segmentato';
import { Prezzo } from '../kit/Prezzo';
import { GraficoPrezzi } from './GraficoPrezzi';
import { centesimiConSegno, dataBreve, delCarburante, unitaPrezzo } from './formatoPrezzi';

interface Props {
  fuel: FuelKey;
  /** Lo storico intero, ripulito. */
  storico: readonly PuntoSerie[];
  previsione: ForecastView | null;
  finestra: Finestra;
  onFinestra: (f: Finestra) => void;
  adesso: Date;
}

const OPZIONI: ReadonlyArray<{ valore: `${Finestra}`; etichetta: string }> = [
  { valore: '30', etichetta: '30 giorni' },
  { valore: '90', etichetta: '90 giorni' },
  { valore: '365', etichetta: 'Un anno' },
];

/**
 * Come si muove la media italiana: l'ultimo valore, il confronto con una
 * settimana e un mese fa, il grafico e la previsione in una riga.
 */
export function CartaAndamento({ fuel, storico, previsione, finestra, onFinestra, adesso }: Props) {
  const a = useMemo(() => andamento(storico, finestra, previsione), [storico, finestra, previsione]);
  const ultimo = a.estremi?.ultimo ?? null;

  if (!ultimo || !a.estremi) {
    return (
      <div className="rounded-mf-lg bg-mf-surface p-4">
        <p className="mf-subhead text-mf-ink-2">Lo storico {delCarburante(fuel)} non è disponibile in questo file dei prezzi.</p>
      </div>
    );
  }

  const oggi = dataLocale(adesso) === ultimo.date;
  const descrizione =
    `Media italiana ${delCarburante(fuel)} dal ${dataBreve(a.estremi.primo.ts)} al ${dataBreve(ultimo.ts)}: ` +
    `da ${formatoPrezzo(a.estremi.primo.prezzo)} a ${formatoPrezzo(ultimo.prezzo)} ${unitaPrezzo(fuel)}, ` +
    `massimo ${formatoPrezzo(a.estremi.massimo.prezzo)} il ${dataBreve(a.estremi.massimo.ts)}, ` +
    `minimo ${formatoPrezzo(a.estremi.minimo.prezzo)} il ${dataBreve(a.estremi.minimo.ts)}.`;

  return (
    <div className="rounded-mf-lg bg-mf-surface p-4">
      <p className="mf-footnote text-mf-ink-2">Media italiana {delCarburante(fuel)}</p>
      <div className="mt-1 flex items-baseline gap-1.5">
        <Prezzo valore={ultimo.prezzo} misura="grande" />
        <span className="mf-footnote text-mf-ink-2">{unitaPrezzo(fuel)}</span>
        <span className="mf-footnote ml-auto text-mf-ink-3">{oggi ? 'oggi' : `al ${dataBreve(ultimo.ts)}`}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <Confronto titolo="In una settimana" v={a.settimana} />
        <Confronto titolo="In un mese" v={a.mese} />
      </div>

      <Segmentato
        className="mt-4"
        etichetta="Periodo del grafico"
        valore={String(finestra) as `${Finestra}`}
        opzioni={OPZIONI}
        onCambia={(v) => onFinestra(Number(v) as Finestra)}
      />

      <div className="mt-4">
        <GraficoPrezzi punti={a.punti} previsione={a.previsione} estremi={a.estremi} descrizione={descrizione} />
      </div>

      <p className="mf-footnote mt-3 text-mf-ink-2">{frasePrevisione(previsione)}</p>
    </div>
  );
}

/** "YYYY-MM-DD" nel fuso del telefono: lo storico e datato all'italiana. */
function dataLocale(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Una variazione: centesimi in grande, percentuale sotto. Niente verde o rosso: non sono prezzi. */
function Confronto({ titolo, v }: { titolo: string; v: Variazione | null }) {
  const Icona = !v || Math.abs(v.deltaC) < 0.05 ? Minus : v.deltaC < 0 ? ArrowDownRight : ArrowUpRight;
  return (
    <div className="rounded-mf-md bg-mf-surface-2 px-3 py-2.5">
      <p className="mf-caption text-mf-ink-2">{titolo}</p>
      {v ? (
        <>
          <p className="mf-headline mf-num mt-0.5 flex items-center gap-1 text-mf-ink">
            <Icona size={17} className="shrink-0 text-mf-ink-2" aria-hidden />
            {centesimiConSegno(v.deltaC)}
          </p>
          <p className="mf-caption mf-num text-mf-ink-3">{delta(v.percento)}</p>
        </>
      ) : (
        <p className="mf-subhead mt-0.5 text-mf-ink-3">Dato non disponibile</p>
      )}
    </div>
  );
}

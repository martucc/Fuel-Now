import type { FuelKey } from '../../domain/raw';
import { FUEL_LABEL } from '../../domain/fuel';
import type { EsitoViaggio, Strategia } from '../../domain/tappeViaggio';
import { testoImpossibile } from '../../domain/tappeViaggio';
import { chilometri, euro, litri, numero } from '../../lib/formato';
import type { PercorsoViaggio } from '../../services/percorsoService';
import { Segnaposto } from '../kit/Stato';
import { durata } from './formatoViaggio';

interface Props {
  percorso: PercorsoViaggio;
  /** Null mentre i prezzi non sono ancora arrivati. */
  esito: EsitoViaggio | null;
  nomeDa: string;
  nomeA: string;
  fuel: FuelKey;
  strategia: Strategia;
  /** Quanti distributori il piano poteva scegliere; null finche non si sa. */
  lungoStrada: number | null;
}

/** Sotto questa cifra un risparmio non vale la riga che occupa. */
const RISPARMIO_MINIMO = 0.5;

/** Il viaggio in breve: quanta strada, quanto tempo, quanto carburante e quante soste. */
export function Riepilogo({ percorso, esito, nomeDa, nomeA, fuel, strategia, lungoStrada }: Props) {
  const p = esito?.piano ?? null;
  return (
    <article className="rounded-mf-lg bg-mf-surface p-4">
      <p className="mf-footnote truncate text-mf-ink-2">
        {nomeDa} → {nomeA}
      </p>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-3">
        <span className="mf-num text-[28px] font-bold leading-[32px] tracking-[-0.02em]">{chilometri(percorso.km)}</span>
        <span className="mf-num mf-headline text-mf-ink-2">{durata(percorso.minuti)}</span>
      </p>

      {!esito || !p ? (
        <Segnaposto className="mt-4 h-[92px]" />
      ) : (
        <>
          <dl className="mt-4 grid grid-cols-3 gap-3">
            <Dato
              etichetta="Carburante"
              valore={esito.costoStimato !== null ? euro(esito.costoStimato, 0) : '—'}
              nota={`circa ${litri(esito.litriConsumati, 0)}`}
            />
            <Dato etichetta="Soste" valore={p.fattibile ? numero(p.soste.length) : '—'} />
            <Dato etichetta="All’arrivo" valore={p.fattibile ? litri(p.litriAllArrivo, 0) : '—'} nota="nel serbatoio" />
          </dl>

          <div className="mt-4 border-t border-mf-hairline pt-3">
            {!p.fattibile ? (
              <>
                <p className="mf-headline text-mf-warn">Così non ci arrivi</p>
                <p className="mf-subhead mt-1 text-mf-ink-2">{testoImpossibile(p, strategia)}</p>
              </>
            ) : p.soste.length === 0 ? (
              <>
                <p className="mf-headline">Ci arrivi senza fare benzina</p>
                <p className="mf-subhead mt-1 text-mf-ink-2">Il carburante che hai basta, con un po’ di margine.</p>
              </>
            ) : (
              <>
                <p className="mf-headline">
                  {p.soste.length === 1 ? 'Ti fermi una volta' : `Ti fermi ${numero(p.soste.length)} volte`}
                </p>
                <p className="mf-subhead mt-1 text-mf-ink-2">
                  Metti <span className="mf-num text-mf-ink">{litri(p.litriComprati, 0)}</span> in tutto, per{' '}
                  <span className="mf-num text-mf-ink">{euro(p.spesaCarburante)}</span>.
                  {p.risparmioEur !== null && p.risparmioEur >= RISPARMIO_MINIMO && (
                    <>
                      {' '}Risparmi <span className="mf-num font-semibold text-mf-best">{euro(p.risparmioEur)}</span> rispetto al
                      pieno prima di partire.
                    </>
                  )}
                </p>
              </>
            )}
          </div>
        </>
      )}

      <p className="mf-caption mt-3 text-mf-ink-3">
        {FUEL_LABEL[fuel]}
        {lungoStrada !== null && ` · ${lungoStrada === 1 ? '1 distributore' : `${numero(lungoStrada)} distributori`} lungo la strada`}
        {' · '}tempo senza traffico
      </p>
    </article>
  );
}

function Dato({ etichetta, valore, nota }: { etichetta: string; valore: string; nota?: string }) {
  return (
    <div className="min-w-0">
      <dt className="mf-caption text-mf-ink-2">{etichetta}</dt>
      <dd className="mf-num truncate text-[19px] font-semibold leading-[24px]">{valore}</dd>
      {nota && <dd className="mf-caption mf-num truncate text-mf-ink-3">{nota}</dd>}
    </div>
  );
}

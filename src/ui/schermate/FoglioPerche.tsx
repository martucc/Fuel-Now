import type { Modello } from '../../app/modello';
import type { RankedStation } from '../../domain/ranking';
import { EURO_PER_MINUTO, FATTORE_STRADA, KM_ALTERNATIVA_VICINA, MAX_MINUTI_IN_PIU, TIE_EURO } from '../../domain/ranking';
import { autoPerCarburante } from '../../domain/units';
import { numero } from '../../lib/formato';
import { Foglio } from '../kit/Foglio';
import { nomeMarchio } from '../kit/marchio';
import { etaPrezzo } from '../kit/formatoUi';
import { vociPerche } from '../home/perche';

/**
 * Il conto del consiglio, riga per riga, con i numeri dell'utente. Viene
 * dallo stesso calcolo che ha deciso: niente scatole nere. Le righe le
 * scrive vociPerche (ui/home/perche.ts), che ha i suoi test.
 */
export function FoglioPerche({ best, m, onChiudi }: { best: RankedStation; m: Modello; onChiudi: () => void }) {
  const fuel = m.impostazioni.carburante;
  const voci = vociPerche(best, {
    fuel,
    auto: autoPerCarburante(m.auto, fuel)?.model ?? null,
    eta: etaPrezzo(best.row.updated, m.adesso),
  });

  return (
    <Foglio titolo="Perché questo distributore" sottotitolo={nomeMarchio(best.row.brand)} onChiudi={onChiudi}>
      <p className="mf-subhead pb-3 text-mf-ink-2">
        Non conta solo il prezzo: un distributore lontano che costa poco meno ti fa spendere in strada quello che risparmi alla pompa.
      </p>
      <dl className="overflow-hidden rounded-mf-md bg-mf-surface-2 [&>div+div]:border-t [&>div+div]:border-mf-hairline">
        {voci.map((v) => (
          <div key={v.etichetta} className="flex items-start justify-between gap-4 px-4 py-3">
            <dt className="min-w-0">
              <span className={`mf-body block ${v.forte ? 'font-semibold' : ''}`}>{v.etichetta}</span>
              {v.nota && <span className="mf-footnote block text-mf-ink-2">{v.nota}</span>}
            </dt>
            <dd className={`mf-num shrink-0 text-right ${v.forte ? 'text-[19px] font-bold text-mf-best' : 'mf-body text-mf-ink'}`}>{v.valore}</dd>
          </div>
        ))}
      </dl>
      <div className="mf-footnote mt-3 space-y-2 text-mf-ink-3">
        <p>
          Il risparmio si misura contro il pieno che faresti comunque: il distributore più vicino con un prezzo recente, cioè di non più di tre giorni prima degli ultimi arrivati quando qui intorno ce ne sono almeno tre. Se il più vicino ha solo il servito e un self a portata ti conviene, contando strada e tempo, il pieno lo faresti al self; e se al massimo {numero(KM_ALTERNATIVA_VICINA)} km più in là del self più vicino ce n’è uno che ti conviene già, il confronto si fa con quello. I km sono stimati dalla linea d’aria, aumentata del {numero((FATTORE_STRADA - 1) * 100)}%.
        </p>
        <p>
          Il tempo non entra nel risparmio ma nella scelta: uno più lontano vince solo se ogni minuto in più ti fa risparmiare almeno {numero(EURO_PER_MINUTO * 100)} centesimi, e mai oltre {MAX_MINUTI_IN_PIU} minuti in più rispetto al più vicino, anche se ha solo il servito. A parità, entro {numero(TIE_EURO * 100)} centesimi, vince il più vicino. E il consigliato non costa mai più del pieno che faresti comunque.
        </p>
        <p>
          Non consiglio distributori in autostrada (per i viaggi c’è la scheda Viaggio), quelli che da una settimana non comunicano prezzi mentre gli altri sì e i prezzi fuori mercato per la zona che nessun distributore vicino conferma.
        </p>
      </div>
    </Foglio>
  );
}

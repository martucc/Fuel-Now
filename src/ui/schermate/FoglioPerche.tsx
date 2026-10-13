import type { Modello } from '../../app/modello';
import type { RankedStation } from '../../domain/ranking';
import { euro, litri, numero, prezzo } from '../../lib/formato';
import { Foglio } from '../kit/Foglio';
import { nomeMarchio } from '../kit/marchio';
import { etaPrezzo } from '../kit/formatoUi';

interface Voce {
  etichetta: string;
  valore: string;
  nota?: string;
  forte?: boolean;
}

/**
 * Il conto del consiglio, riga per riga, con i numeri dell'utente. Viene
 * dallo stesso calcolo che ha deciso: niente scatole nere.
 */
export function FoglioPerche({ best, m, onChiudi }: { best: RankedStation; m: Modello; onChiudi: () => void }) {
  const n = best.net;
  const rif = n.riferimento;
  const voci: Voce[] = [];

  voci.push({
    etichetta: 'Pieno considerato',
    valore: litri(n.liters, 0),
    nota: m.auto ? m.auto.model : 'Serbatoio medio: scegli la tua auto nelle impostazioni',
  });
  voci.push({ etichetta: 'Prezzo qui', valore: `${prezzo(n.price)} €/L` });
  if (rif) {
    voci.push({
      etichetta: 'Il più vicino a te',
      valore: `${prezzo(rif.price)} €/L`,
      nota: `a ${numero(rif.distanceKm, 1)} km: è lì che faresti il pieno senza pensarci`,
    });
  } else {
    voci.push({ etichetta: 'Media della zona', valore: `${prezzo(n.cohortAvg)} €/L` });
  }
  voci.push({ etichetta: 'Risparmio sul carburante', valore: euro(n.gross) });
  if (n.confidence < 1 && n.gross > 0) {
    voci.push({
      etichetta: 'Prezzo non di oggi',
      valore: `× ${numero(n.confidence, 2)}`,
      nota: `comunicato ${etaPrezzo(best.row.updated, m.adesso)}: il risparmio conta di meno`,
    });
  }

  const kmInPiu = rif ? Math.max(0, n.distanceKm - rif.distanceKm) : n.distanceKm;
  voci.push({
    etichetta: 'Strada in più',
    valore: `− ${euro(n.roadCost)}`,
    nota: `${numero(kmInPiu * 2, 1)} km andata e ritorno, a ${numero(n.kml, 1)} km/L`,
  });
  if (n.highwayFriction > 0) voci.push({ etichetta: 'Uscita dall’autostrada', valore: `− ${euro(n.highwayFriction)}` });
  if (n.detourFriction > 0) voci.push({ etichetta: 'Tempo e usura', valore: `− ${euro(n.detourFriction)}` });
  voci.push({ etichetta: 'In tasca', valore: euro(n.net), forte: true });

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
      <p className="mf-footnote mt-3 text-mf-ink-3">
        A parità di risparmio (entro 15 centesimi) vince il più vicino. Le distanze sono in linea d’aria.
      </p>
    </Foglio>
  );
}

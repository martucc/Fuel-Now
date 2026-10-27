import { Star } from 'lucide-react';
import type { Modello } from '../../app/modello';
import type { RigaPreferito } from '../../domain/preferiti';
import { prezzoBreve } from '../../domain/mappa';
import { prezzo as formatoPrezzo } from '../../lib/formato';
import { Prezzo } from '../kit/Prezzo';
import { LogoMarchio } from '../kit/LogoMarchio';
import { nomeMarchio } from '../kit/marchio';
import { distanza, etaPrezzo, indirizzo } from '../kit/formatoUi';
import { FUEL_LABEL } from '../../domain/fuel';

interface Props {
  righe: RigaPreferito[];
  m: Modello;
  /** Il prezzo del consigliato, per dire quanto costa in più il proprio solito. */
  prezzoConsigliato: number | null;
  onApri: (id: string) => void;
  className?: string;
}

/**
 * «I miei distributori» nella Home: quelli salvati con la stella, coi
 * prezzi di adesso, anche fuori dai 15 km. Senza stelle non compare.
 */
export function MieiDistributori({ righe, m, prezzoConsigliato, onApri, className = '' }: Props) {
  if (!righe.length) return null;
  const fuel = m.impostazioni.carburante;
  return (
    <section className={className}>
      <div className="mb-3 flex items-end justify-between gap-3 px-1">
        <h2 className="mf-title">I miei distributori</h2>
        <Star size={17} fill="currentColor" className="mb-1 text-mf-ink-2" aria-hidden />
      </div>
      <ul className="mf-carta overflow-hidden [&>li+li]:border-t [&>li+li]:border-mf-hairline">
        {righe.map((r) => {
          const delta = r.prezzo !== null && prezzoConsigliato !== null ? r.prezzo - prezzoConsigliato : 0;
          const servito = r.row.servito[fuel];
          return (
            <li key={r.row.id}>
              <button
                type="button"
                onClick={() => onApri(r.row.id)}
                className="mf-press flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-[rgb(255_255_255/0.04)]"
              >
                <LogoMarchio marchio={r.row.brand} misura={38} />
                <span className="min-w-0 flex-1">
                  <span className="mf-body block truncate font-medium">{nomeMarchio(r.row.brand)}</span>
                  <span className="mf-footnote block truncate text-mf-ink-2">{indirizzo(r.row.address, r.row.city)}</span>
                  <span className="mf-footnote block truncate text-mf-ink-2">
                    {r.km !== null && `${distanza(r.km)} · `}
                    <span className={r.vecchio ? 'text-mf-warn' : ''}>{etaPrezzo(r.row.updated, m.adesso)}</span>
                    {r.forseChiuso && ' · forse chiuso'}
                    {r.alServito && ' · solo servito'}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  {r.prezzo !== null ? (
                    <>
                      <Prezzo valore={r.prezzo} livello={r.livello} spento={r.vecchio || r.forseChiuso} misura="riga" />
                      <span className="mf-caption mf-num block text-mf-ink-2">
                        {delta > 0.0005
                          ? `+${prezzoBreve(delta)} sul consigliato`
                          : servito !== undefined && !r.alServito
                            ? `servito ${formatoPrezzo(servito)}`
                            : ' '}
                      </span>
                    </>
                  ) : (
                    <span className="mf-footnote text-mf-ink-3">niente {fuel === 'gpl' ? 'GPL' : FUEL_LABEL[fuel].toLowerCase()}</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

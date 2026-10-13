import { Navigation, EyeOff, Eye } from 'lucide-react';
import type { Modello } from '../../app/modello';
import { impostaNascosto } from '../../app/dati';
import { cohortFor } from '../../domain/market';
import { priceLevel } from '../../domain/pricing';
import { FUEL_LABEL } from '../../domain/fuel';
import { FUEL_KEYS } from '../../domain/raw';
import { haversineKm } from '../../domain/geo';
import { prezzo as formatoPrezzo } from '../../lib/formato';
import { portamiLi } from '../../services/navigazione';
import { Foglio } from '../kit/Foglio';
import { Pulsante } from '../kit/Pulsante';
import { Prezzo } from '../kit/Prezzo';
import { LogoMarchio } from '../kit/LogoMarchio';
import { nomeImpianto, nomeMarchio } from '../kit/marchio';
import { ETICHETTA_LIVELLO, COLORE_LIVELLO } from '../kit/livelli';
import { distanza, etaPrezzo, indirizzo, minutiGuida, oreDa } from '../kit/formatoUi';

/**
 * La scheda di un distributore: tutti i suoi prezzi, self e servito, quanto
 * sono freschi, dov'e. Si apre dalla lista, dalla mappa e dal consiglio.
 */
export function FoglioImpianto({ id, m, onChiudi }: { id: string; m: Modello; onChiudi: () => void }) {
  const r = m.base?.perId.get(id);
  if (!r || !m.base) return null;

  const nascosto = m.nascosti.has(id);
  const ore = oreDa(r.updated, m.adesso);
  const vecchio = ore !== null && ore > 72;
  const chiuso = ore !== null && ore > 168;
  const lontano = m.posizione.punto ? haversineKm(m.posizione.punto, { lat: r.lat, lng: r.lng }) : null;
  const titolo = nomeMarchio(r.brand);
  const carburanti = FUEL_KEYS.filter((k) => r.prices[k] !== undefined || r.servito[k] !== undefined);
  const scelto = m.impostazioni.carburante;
  const cohorts = m.base.cohorts;

  return (
    <Foglio
      titolo={titolo}
      sottotitolo={indirizzo(r.address, r.city)}
      onChiudi={onChiudi}
      azioni={
        <Pulsante
          largo
          misura="grande"
          icona={<Navigation size={18} />}
          onClick={() => void portamiLi({ lat: r.lat, lng: r.lng, nome: `${titolo} ${indirizzo(r.address, r.city)}` })}
        >
          Portami lì
        </Pulsante>
      }
    >
      <div className="flex items-center gap-3 pb-4">
        <LogoMarchio marchio={r.brand} misura={52} />
        <div className="min-w-0">
          {nomeImpianto(r.name, r.brand) && <p className="mf-subhead truncate text-mf-ink">{nomeImpianto(r.name, r.brand)}</p>}
          <p className="mf-footnote text-mf-ink-2">
            {lontano !== null ? `${distanza(lontano)} · circa ${minutiGuida(lontano)} min · ` : ''}
            {r.isHighway ? 'in autostrada' : 'su strada'}
          </p>
          <p className={`mf-footnote ${vecchio ? 'text-mf-warn' : 'text-mf-ink-2'}`}>
            Prezzi comunicati {etaPrezzo(r.updated, m.adesso)}
            {chiuso ? ' · forse chiuso' : ''}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-mf-md bg-mf-surface-2">
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-5 border-b border-mf-hairline px-4 py-2">
          <span className="mf-caption text-mf-ink-2">Carburante</span>
          <span className="mf-caption w-[72px] text-right text-mf-ink-2">Self</span>
          <span className="mf-caption w-[72px] text-right text-mf-ink-2">Servito</span>
        </div>
        {carburanti.map((k) => {
          const self = r.prices[k];
          const servito = r.servito[k];
          const coorte = self !== undefined ? cohortFor(r, k, cohorts) : null;
          const livello = coorte && self !== undefined ? priceLevel(self, coorte).level : null;
          return (
            <div key={k} className={`grid grid-cols-[1fr_auto_auto] items-center gap-x-5 px-4 py-3 ${k === scelto ? 'bg-mf-surface-3/40' : ''} [&+&]:border-t [&+&]:border-mf-hairline`}>
              <span className="min-w-0">
                <span className={`mf-body block ${k === scelto ? 'font-semibold' : ''}`}>{FUEL_LABEL[k]}</span>
                {livello && (
                  <span className="mf-caption block" style={{ color: vecchio ? 'var(--color-mf-stale)' : COLORE_LIVELLO[livello] }}>
                    {ETICHETTA_LIVELLO[livello]}
                  </span>
                )}
              </span>
              <span className="w-[72px] text-right">
                {self !== undefined ? <Prezzo valore={self} livello={livello} spento={vecchio} misura="piccola" /> : <span className="text-mf-ink-3">—</span>}
              </span>
              <span className="mf-num w-[72px] text-right text-[15px] font-medium text-mf-ink-2">
                {servito !== undefined ? formatoPrezzo(servito) : '—'}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mf-footnote mt-3 text-mf-ink-2">
        Il colore dice com’è il prezzo rispetto agli altri distributori della provincia{r.isHighway ? ' in autostrada' : ''}.
      </p>

      <div className="mt-5">
        <Pulsante
          tono="grigio"
          largo
          icona={nascosto ? <Eye size={17} /> : <EyeOff size={17} />}
          onClick={() => {
            impostaNascosto(id, !nascosto);
            if (!nascosto) onChiudi();
          }}
        >
          {nascosto ? 'Mostra di nuovo nei risultati' : 'Nascondi dai risultati'}
        </Pulsante>
        <p className="mf-caption mt-2 px-1 text-mf-ink-2">
          Per un distributore chiuso o con prezzi sbagliati: non verrà più consigliato.
        </p>
      </div>
    </Foglio>
  );
}

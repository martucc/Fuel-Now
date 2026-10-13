import { Navigation, HelpCircle, Home } from 'lucide-react';
import type { HomeModel } from './homeModel';
import { SpectrumBar } from './Spectrum';
import { PriceText } from '../../design/primitives/PriceText';
import { Pill } from '../../design/primitives/Pill';
import { BrandLogo } from '../../design/primitives/BrandLogo';
import { LEVEL_LABEL } from '../../domain/pricing';
import { describeAge } from '../../domain/freshness';

interface Props {
  model: HomeModel;
  onNavigate: () => void;
  onWhy: () => void;
  /** Raggio attuale e come allargarlo: senza, il vuoto e un vicolo cieco. */
  radius?: number;
  onWiden?: () => void;
}

export function AnswerCard({ model, onNavigate, onWhy, radius, onWiden }: Props) {
  const best = model.best;
  if (!best) {
    return (
      <div
        className="p-6 text-center"
        style={{
          background: 'var(--mf-surface)',
          borderRadius: 'var(--mf-radius-lg)',
          border: '1px solid var(--mf-hairline)',
        }}
      >
        <p style={{ color: 'var(--mf-ink)', fontSize: 15, fontFamily: 'var(--mf-font-sans)', fontWeight: 600 }}>
          Niente da confrontare qui
        </p>
        <p className="mx-auto mt-2" style={{ color: 'var(--mf-ink-2)', fontSize: 12.5, lineHeight: 1.55, maxWidth: '30ch' }}>
          {radius != null
            ? `Entro ${radius} km non c’è nessun impianto con un prezzo recente per questo carburante.`
            : 'Nessun impianto con un prezzo recente per questo carburante.'}
        </p>
        {onWiden && radius != null && radius < 100 && (
          <button
            onClick={onWiden}
            className="mt-4 px-4 py-2"
            style={{
              borderRadius: 'var(--mf-radius-pill)',
              border: '1px solid var(--mf-hairline)',
              color: 'var(--mf-accent)',
              fontFamily: 'var(--mf-font-sans)',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Cerca fino a {Math.min(100, radius * 2)} km
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="p-6"
      style={{
        background: 'var(--mf-surface)',
        borderRadius: 'var(--mf-radius-lg)',
        border: '1px solid var(--mf-hairline)',
      }}
    >
      {model.homeMode ? (
        <div className="flex items-center gap-1.5">
          <Pill tone="accent">
            <span className="flex items-center gap-1">
              <Home size={12} /> rientro verso casa · su {model.eligibleCount} impianti
            </span>
          </Pill>
        </div>
      ) : (
        <Pill tone="accent">miglior scelta netta · su {model.eligibleCount} impianti</Pill>
      )}

      {/* Sul percorso vero il numero è misurato, col triangolo è una stima:
          scriverlo uguale nei due casi sarebbe far credere una precisione
          che non c'è. */}
      {model.homeMode && best.detourKm !== undefined && (
        <p className="mt-3" style={{ color: 'var(--mf-accent)', fontSize: 11.5, fontWeight: 500, lineHeight: 1.5 }}>
          Ti allunga la strada di{' '}
          {model.percorsoSuStrada ? '' : 'circa '}
          {best.detourKm.toFixed(1).replace('.', ',')} km
          {best.minutiPersi !== undefined && best.minutiPersi >= 1
            ? `, ${Math.round(best.minutiPersi)} minuti`
            : ''}
          .
          {model.percorsoSuStrada ? null : (
            <span style={{ color: 'var(--mf-ink-2)', fontWeight: 400 }}>
              {' '}Stima in linea d’aria: il percorso non è disponibile.
            </span>
          )}
        </p>
      )}

      {!model.homeMode && model.tieSavedKm !== null && model.tieSavedKm > 0 && (
        <p className="mt-3" style={{ color: 'var(--mf-ink-2)', fontSize: 11, lineHeight: 1.5 }}>
          Guadagno pari al primo della lista, ma {model.tieSavedKm.toFixed(1).replace('.', ',')} km
          più vicino.
        </p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <BrandLogo brand={best.row.brand} name={best.row.name} size={48} />
        <div className="min-w-0 flex-1">
          <div
            className="truncate"
            style={{ fontFamily: 'var(--mf-font-sans)', fontWeight: 700, fontSize: 18, color: 'var(--mf-ink)' }}
          >
            {best.row.brand} · {best.row.city || best.row.name}
          </div>
          <div className="mf-num mt-1 truncate" style={{ color: 'var(--mf-ink-2)', fontSize: 12 }}>
            {best.distanceKm.toFixed(1).replace('.', ',')} km da qui · {describeAge(best.ageH)}
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        <PriceText price={best.price} level={best.level} hero animato />
        <div className="flex-shrink-0 text-right">
          <div className="mf-label" style={{ color: 'var(--mf-ink-2)', fontSize: 10 }}>
            in tasca
          </div>
          <div className="mf-num" style={{ color: 'var(--mf-ink)', fontSize: 20, fontWeight: 600 }}>
            {best.net.net.toFixed(2).replace('.', ',')} €
          </div>
        </div>
      </div>

      <div className="mf-label mt-1" style={{ color: 'var(--mf-ink-2)', fontSize: 11 }}>
        {LEVEL_LABEL[best.level]}
        {!best.reliable && ' · pochi confronti in zona'}
      </div>

      {model.spectrum && (
        <div className="mt-5">
          <SpectrumBar spectrum={model.spectrum} />
        </div>
      )}

      {/* Due pillole sottili: prima erano alte 56 px e sotto un prezzo grande
          quanto mezza scheda facevano blocco, invece di stare al loro posto
          di ultima riga. In rientro l'etichetta e «Passa di lì», la stessa
          del widget: il navigatore ti porta a casa passando dalla pompa. */}
      <div className="mt-6 flex gap-2.5">
        <button
          onClick={onNavigate}
          className="flex flex-1 items-center justify-center gap-2 py-3 transition-transform active:scale-95"
          style={{
            background: 'var(--mf-accent)',
            color: 'var(--mf-accent-ink)',
            borderRadius: 'var(--mf-radius-pill)',
            fontFamily: 'var(--mf-font-sans)',
            fontWeight: 650,
            fontSize: 14,
          }}
        >
          <Navigation size={15} /> {model.homeMode ? 'Passa di lì' : 'Portami lì'}
        </button>
        <button
          onClick={onWhy}
          className="flex items-center justify-center gap-1.5 px-4 py-3 transition-transform active:scale-95"
          style={{
            background: 'transparent',
            color: 'var(--mf-ink-2)',
            border: '1px solid var(--mf-hairline)',
            borderRadius: 'var(--mf-radius-pill)',
            fontFamily: 'var(--mf-font-sans)',
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          <HelpCircle size={15} /> Perché?
        </button>
      </div>
    </div>
  );
}

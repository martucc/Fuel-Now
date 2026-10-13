import { Sparkles, TrendingDown, TrendingUp, Minus, Fuel, Clock, AlertTriangle, Tag } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Advice } from '../../domain/forecast';
import type { HomeModel } from './homeModel';
import { ADVICE_LABEL } from './homeModel';
import { Pill } from '../../design/primitives/Pill';

const ICON: Record<Advice, LucideIcon> = {
  'FILL-FULL': Fuel,
  'TEN-EURO': Clock,
  URGENT: AlertTriangle,
  'PRICE-ONLY': Tag,
};

/** Il tono del consiglio non usa mai la scala del prezzo: sono due cose diverse. */
const TONE: Record<Advice, string> = {
  'FILL-FULL': 'var(--mf-price-good)',
  'TEN-EURO': 'var(--mf-accent)',
  URGENT: 'var(--mf-price-worst)',
  'PRICE-ONLY': 'var(--mf-ink-2)',
};

function euro(v: number): string {
  return `${Math.abs(v).toFixed(2).replace('.', ',')} €`;
}

interface Props {
  model: HomeModel;
  /** Riga dell'IA: commenta, non decide. Il consiglio resta del motore. */
  aiNote?: string | null;
}

export function AdviceCard({ model, aiNote }: Props) {
  const Icon = ICON[model.advice];
  const tone = TONE[model.advice];
  const f = model.forecast;
  const impact = model.adviceImpactEur;

  return (
    <div
      className="p-5"
      style={{
        background: 'var(--mf-surface)',
        borderRadius: 'var(--mf-radius-lg)',
        border: '1px solid var(--mf-hairline)',
      }}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles size={14} style={{ color: 'var(--mf-accent)' }} />
          <span className="mf-label" style={{ color: 'var(--mf-ink-2)', fontSize: 10 }}>
            cosa conviene fare
          </span>
        </div>
        {/* Provenienza dichiarata: decide il motore, non un modello. */}
        <Pill tone="ghost">motore · dati ufficiali</Pill>
      </div>

      <div className="flex items-start gap-3">
        <Icon size={26} style={{ color: tone, flexShrink: 0, marginTop: 2 }} />
        <div className="min-w-0 flex-1">
          <h3
            style={{
              fontFamily: 'var(--mf-font-sans)',
              fontWeight: 800,
              fontSize: 24,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              color: tone,
            }}
          >
            {ADVICE_LABEL[model.advice]}
          </h3>
          <p className="mt-2" style={{ color: 'var(--mf-ink)', fontSize: 13, lineHeight: 1.5 }}>
            {model.adviceReason}
          </p>
        </div>
      </div>

      {(f?.usable || impact !== null) && (
        <div
          className="mt-4 flex items-center justify-between gap-3 pt-4"
          style={{ borderTop: '1px solid var(--mf-hairline)' }}
        >
          {f?.usable && (
            <span className="flex items-center gap-2" style={{ color: 'var(--mf-ink-2)', fontSize: 12 }}>
              {f.direction === 'down' ? (
                <TrendingDown size={14} style={{ color: 'var(--mf-price-good)' }} />
              ) : f.direction === 'up' ? (
                <TrendingUp size={14} style={{ color: 'var(--mf-price-high)' }} />
              ) : (
                <Minus size={14} />
              )}
              <span className="mf-num">
                {Math.abs(f.deltaC) < 0.05
                  ? `nessun movimento atteso in ${f.daysAhead} giorni`
                  : `${f.deltaC > 0 ? '+' : ''}${f.deltaC.toFixed(1).replace('.', ',')} cent in ${f.daysAhead} giorni`}
              </span>
            </span>
          )}

          {impact !== null && Math.abs(impact) >= 0.05 && (
            <span className="flex-shrink-0 text-right">
              <span className="mf-label block" style={{ color: 'var(--mf-ink-2)', fontSize: 9 }}>
                {impact > 0 ? 'aspettando risparmi' : 'aspettando perdi'}
              </span>
              <span
                className="mf-num"
                style={{
                  color: impact > 0 ? 'var(--mf-price-good)' : 'var(--mf-price-high)',
                  fontSize: 16,
                  fontWeight: 600,
                }}
              >
                {euro(impact)}
              </span>
            </span>
          )}
        </div>
      )}

      {!f?.usable && (
        <p className="mt-3" style={{ color: 'var(--mf-ink-2)', fontSize: 11, lineHeight: 1.5 }}>
          Nessuna previsione affidabile per questo carburante: meglio dirlo che inventarla.
        </p>
      )}

      {/* L'IA aggiunge il contesto che il motore non ha — notizie, mercato —
          ma sta sotto e si vede che e un'altra voce: se decidesse lei,
          l'utente non saprebbe piu su cosa si fonda il consiglio. */}
      {aiNote && (
        <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--mf-hairline)' }}>
          <div className="mb-1.5 flex items-center gap-1.5">
            <Sparkles size={11} style={{ color: 'var(--mf-accent)' }} />
            <span className="mf-label" style={{ fontSize: 9 }}>e l&apos;analisi ia aggiunge</span>
          </div>
          <p style={{ color: 'var(--mf-ink-2)', fontSize: 12.5, lineHeight: 1.55 }}>{aiNote}</p>
        </div>
      )}
    </div>
  );
}

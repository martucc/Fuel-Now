import { useMemo } from 'react';
import type { FuelStation, FuelType } from '../../types';

interface Props {
  stations: FuelStation[];
  fuel: FuelType;
  current?: number; // prezzo di riferimento dell'utente
}

/** Cinque livelli, gli stessi della mappa: a sinistra si risparmia, a destra no. */
const SCALA = [
  'var(--mf-price-best)',
  'var(--mf-price-good)',
  'var(--mf-price-normal)',
  'var(--mf-price-high)',
  'var(--mf-price-worst)',
];

const BIN_COUNT = 18;

export function PriceDistribution({ stations, fuel, current }: Props) {
  const { bins, max, lo, hi } = useMemo(() => {
    const prices = stations
      .map((s) => s.prices.find((p) => p.type === fuel)?.price || 0)
      .filter((p) => p > 0.5);
    if (!prices.length) return { bins: [] as { c: number; lo: number; hi: number }[], max: 0, lo: 0, hi: 0 };
    const lo = Math.min(...prices);
    const hi = Math.max(...prices);
    const span = hi - lo || 0.001;
    const step = span / BIN_COUNT;
    const bins = Array.from({ length: BIN_COUNT }, (_, i) => ({
      c: 0,
      lo: lo + i * step,
      hi: lo + (i + 1) * step,
    }));
    for (const p of prices) {
      let idx = Math.floor((p - lo) / step);
      if (idx < 0) idx = 0;
      if (idx >= BIN_COUNT) idx = BIN_COUNT - 1;
      bins[idx].c++;
    }
    return { bins, max: Math.max(...bins.map((b) => b.c)), lo, hi };
  }, [stations, fuel]);

  if (!bins.length || !max) {
    return (
      <div className="flex h-24 items-center justify-center" style={{ color: 'var(--mf-muted)', fontSize: 12 }}>
        Nessun prezzo in zona
      </div>
    );
  }

  const markerIdx =
    current != null && current > 0 && hi > lo
      ? Math.min(bins.length - 1, Math.max(0, Math.floor(((current - lo) / (hi - lo)) * bins.length)))
      : null;

  return (
    <div>
      <div className="flex h-24 items-end gap-[3px]">
        {bins.map((b, i) => {
          const h = b.c / max;
          const livello = SCALA[Math.min(SCALA.length - 1, Math.floor((i / bins.length) * SCALA.length))];
          const qui = markerIdx === i;
          return (
            <div
              key={i}
              className="flex-1 transition-all"
              style={{
                height: `${Math.max(2, h * 100)}%`,
                borderRadius: '3px 3px 0 0',
                background: livello,
                opacity: b.c === 0 ? 0.14 : qui ? 1 : 0.42 + h * 0.4,
                outline: qui ? '1px solid var(--mf-ink)' : undefined,
                outlineOffset: qui ? 1 : undefined,
              }}
              title={`€${b.lo.toFixed(3)}–€${b.hi.toFixed(3)} · ${b.c} distributori`}
            />
          );
        })}
      </div>
      <div className="mf-num mt-2 flex justify-between" style={{ fontSize: 10, color: 'var(--mf-muted)' }}>
        <span>€{lo.toFixed(3)}</span>
        {markerIdx != null && current != null && (
          <span style={{ color: 'var(--mf-ink)' }}>il tuo €{current.toFixed(3)}</span>
        )}
        <span>€{hi.toFixed(3)}</span>
      </div>
    </div>
  );
}

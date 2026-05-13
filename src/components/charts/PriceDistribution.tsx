import { useMemo } from 'react';
import type { FuelStation, FuelType } from '../../types';

interface Props {
  stations: FuelStation[];
  fuel: FuelType;
  current?: number; // cheapest user price marker
}

export function PriceDistribution({ stations, fuel, current }: Props) {
  const { bins, max, lo, hi } = useMemo(() => {
    const prices = stations
      .map(s => s.prices.find(p => p.type === fuel)?.price || 0)
      .filter(p => p > 0.5);
    if (!prices.length) return { bins: [] as { c: number; lo: number; hi: number }[], max: 0, lo: 0, hi: 0 };
    const lo = Math.min(...prices);
    const hi = Math.max(...prices);
    const span = hi - lo || 0.001;
    const BIN_COUNT = 18;
    const step = span / BIN_COUNT;
    const bins: { c: number; lo: number; hi: number }[] = Array.from({ length: BIN_COUNT }, (_, i) => ({
      c: 0, lo: lo + i * step, hi: lo + (i + 1) * step,
    }));
    for (const p of prices) {
      let idx = Math.floor((p - lo) / step);
      if (idx < 0) idx = 0; if (idx >= BIN_COUNT) idx = BIN_COUNT - 1;
      bins[idx].c++;
    }
    return { bins, max: Math.max(...bins.map(b => b.c)), lo, hi };
  }, [stations, fuel]);

  if (!bins.length || !max) {
    return <div className="h-24 flex items-center justify-center text-[12px] text-zinc-600">Nessun dato</div>;
  }

  const markerIdx = current != null && current > 0 && hi > lo
    ? Math.min(bins.length - 1, Math.max(0, Math.floor(((current - lo) / (hi - lo)) * bins.length)))
    : null;

  return (
    <div>
      <div className="flex items-end gap-[3px] h-24">
        {bins.map((b, i) => {
          const h = b.c / max;
          const isMarker = markerIdx === i;
          return (
            <div
              key={i}
              className="flex-1 rounded-t-[3px] transition-all"
              style={{
                height: `${Math.max(2, h * 100)}%`,
                background: isMarker
                  ? '#10b981'
                  : `rgba(255,255,255,${0.15 + h * 0.4})`,
              }}
              title={`€${b.lo.toFixed(3)}–€${b.hi.toFixed(3)} · ${b.c} stazioni`}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-2 text-[10px] text-zinc-500 font-medium tabular-nums">
        <span>€{lo.toFixed(3)}</span>
        {markerIdx != null && current != null && (
          <span className="text-emerald-400 font-semibold">tu €{current.toFixed(3)}</span>
        )}
        <span>€{hi.toFixed(3)}</span>
      </div>
    </div>
  );
}

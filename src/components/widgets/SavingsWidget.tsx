import { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import { loadHistory } from '../../services/historyService';
import type { FuelType } from '../../types';

const FUEL_KEY: Record<FuelType, string> = {
  Benzina: 'benzina', Diesel: 'diesel', GPL: 'gpl', Metano: 'metano',
};

interface Props {
  fuel: FuelType;
  cheapestLocal: number;
  tankLiters: number;
}

export function SavingsWidget({ fuel, cheapestLocal, tankLiters }: Props) {
  const [nationalAvg, setNationalAvg] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const h = await loadHistory();
      const series = h[FUEL_KEY[fuel]] || [];
      if (series.length) setNationalAvg(series[series.length - 1].avg);
    })();
  }, [fuel]);

  if (!nationalAvg || cheapestLocal === Infinity || !cheapestLocal) return null;

  const deltaPerL = nationalAvg - cheapestLocal;
  const pct = (deltaPerL / nationalAvg) * 100;
  const savingsFull = deltaPerL * tankLiters;
  const positive = deltaPerL > 0;

  return (
    <div
      className={cn(
        'bg-[#09090b]/50 backdrop-blur-xl border rounded-[32px] p-5 shadow-2xl relative overflow-hidden',
        positive ? 'border-emerald-500/20' : 'border-red-500/20'
      )}
    >
      <div
        className={cn(
          'absolute -top-12 -right-12 w-40 h-40 rounded-full blur-[60px] pointer-events-none',
          positive ? 'bg-emerald-500/20' : 'bg-red-500/20'
        )}
      />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'w-1.5 h-1.5 rounded-full',
                positive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'
              )}
            />
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">
              {positive ? 'Stai risparmiando' : 'Stai sopra media'}
            </h3>
          </div>
          <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">{fuel}</span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <p
              className={cn(
                'text-[34px] sm:text-[40px] font-black tabular-nums tracking-tighter leading-none',
                positive ? 'text-emerald-400' : 'text-red-400'
              )}
            >
              {positive ? '−' : '+'}€{Math.abs(deltaPerL).toFixed(3)}
            </p>
            <p className="text-[11px] text-white/40 font-bold mt-1">per litro vs media naz.</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p
              className={cn(
                'text-[20px] font-black tabular-nums',
                positive ? 'text-emerald-400' : 'text-red-400'
              )}
            >
              {positive ? '+' : '-'}€{Math.abs(savingsFull).toFixed(2)}
            </p>
            <p className="text-[10px] text-white/40 font-bold">su pieno {tankLiters}L</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 text-[10px] text-white/40 font-bold tabular-nums">
          <span>Locale €{cheapestLocal.toFixed(3)}</span>
          <span className="w-1 h-1 rounded-full bg-white/20" />
          <span>Naz. €{nationalAvg.toFixed(3)}</span>
          <span className="w-1 h-1 rounded-full bg-white/20" />
          <span className={cn(positive ? 'text-emerald-400' : 'text-red-400')}>
            {positive ? `−${pct.toFixed(1)}%` : `+${Math.abs(pct).toFixed(1)}%`}
          </span>
        </div>
      </div>
    </div>
  );
}

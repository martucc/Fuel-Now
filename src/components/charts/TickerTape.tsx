import { useMemo } from 'react';
import type { FuelType } from '../../types';
import type { HistoryPoint } from '../../services/historyService';

interface TickerItem {
  fuel: FuelType;
  price: number;
  delta: number;
  active: boolean;
}

interface Props {
  history: Record<string, HistoryPoint[]>;
  selected: FuelType;
  onSelect?: (f: FuelType) => void;
}

const FUEL_KEY: Record<FuelType, string> = {
  Benzina: 'benzina', Diesel: 'diesel', GPL: 'gpl', Metano: 'metano',
};

const FUEL_LABEL: Record<FuelType, string> = {
  Benzina: 'BENZ', Diesel: 'DSL', GPL: 'GPL', Metano: 'MTN',
};

export function TickerTape({ history, selected, onSelect }: Props) {
  const items = useMemo<TickerItem[]>(() => {
    const fuels: FuelType[] = ['Benzina', 'Diesel', 'GPL', 'Metano'];
    return fuels.map(f => {
      const s = history[FUEL_KEY[f]] || [];
      if (s.length < 2) return { fuel: f, price: 0, delta: 0, active: f === selected };
      const last = s[s.length - 1];
      const prev = s[s.length - 2];
      const delta = ((last.avg - prev.avg) / prev.avg) * 100;
      return { fuel: f, price: last.avg, delta, active: f === selected };
    });
  }, [history, selected]);

  return (
    <div className="overflow-x-auto no-scrollbar -mx-4 px-4">
      <div className="flex gap-2 min-w-min">
        {items.map(it => {
          const up = it.delta > 0.001;
          const dn = it.delta < -0.001;
          return (
            <button
              key={it.fuel}
              onClick={() => onSelect?.(it.fuel)}
              className={[
                'flex-shrink-0 rounded-2xl px-3.5 py-2.5 border transition-all active:scale-[0.97] text-left min-w-[110px]',
                it.active
                  ? 'bg-gradient-to-b from-[#0a1428] to-black text-white border-blue-500/40 shadow-[0_0_30px_rgba(37,99,235,0.35)]'
                  : 'bg-zinc-900/70 text-white border-zinc-800/80 hover:border-zinc-700',
              ].join(' ')}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className={[
                  'text-[10px] font-semibold tracking-widest',
                  it.active ? 'text-blue-400' : 'text-zinc-500',
                ].join(' ')}>{FUEL_LABEL[it.fuel]}</span>
                <span className={[
                  'text-[10px] font-semibold tabular-nums',
                  up ? 'text-red-400' : dn ? 'text-emerald-400' : (it.active ? 'text-blue-300' : 'text-zinc-500'),
                ].join(' ')}>
                  {up ? '+' : ''}{it.delta.toFixed(2)}%
                </span>
              </div>
              <div className="text-[18px] font-semibold tabular-nums tracking-tight leading-none">
                €{it.price.toFixed(3)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

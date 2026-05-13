import { useEffect, useState } from 'react';
import { loadHistory, getSeries } from '../../services/historyService';
import { cn } from '../../lib/utils';
import type { FuelType } from '../../types';

const FUELS: FuelType[] = ['Benzina', 'Diesel', 'GPL', 'Metano'];

interface Props {
  selected: FuelType;
  onSelect: (f: FuelType) => void;
}

type Row = { last: number; delta: number; points: number[] } | null;

export function MultiFuelSpark({ selected, onSelect }: Props) {
  const [data, setData] = useState<Record<FuelType, Row>>({
    Benzina: null, Diesel: null, GPL: null, Metano: null,
  });

  useEffect(() => {
    (async () => {
      const h = await loadHistory();
      const out: Record<FuelType, Row> = { Benzina: null, Diesel: null, GPL: null, Metano: null };
      for (const f of FUELS) {
        const series = getSeries(h, f, '1M');
        if (series.length < 2) { out[f] = null; continue; }
        const last = series[series.length - 1].avg;
        const first = series[0].avg;
        out[f] = {
          last,
          delta: ((last - first) / first) * 100,
          points: series.map(p => p.avg),
        };
      }
      setData(out);
    })();
  }, []);

  return (
    <div className="bg-[#09090b]/50 backdrop-blur-xl border border-white/5 rounded-[32px] p-5 shadow-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
          <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Mercato Carburanti</h3>
        </div>
        <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Naz. 30g</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {FUELS.map(f => {
          const d = data[f];
          const active = selected === f;
          const color = !d ? '#71717a' : d.delta < -0.3 ? '#10b981' : d.delta > 0.3 ? '#ef4444' : '#f59e0b';
          return (
            <button
              key={f}
              onClick={() => onSelect(f)}
              className={cn(
                'flex flex-col items-start p-3 rounded-2xl border transition-all min-w-0 text-left',
                active
                  ? 'bg-blue-500/10 border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.2)]'
                  : 'bg-white/[0.03] border-white/5 hover:border-white/10'
              )}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest truncate">{f}</span>
                {d && (
                  <span className={cn('text-[9px] font-black tabular-nums', d.delta < -0.3 ? 'text-emerald-400' : d.delta > 0.3 ? 'text-red-400' : 'text-amber-400')}>
                    {d.delta > 0 ? '+' : ''}{d.delta.toFixed(1)}%
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between w-full gap-2">
                <span className="text-[15px] font-black text-white tabular-nums tracking-tight">
                  {d ? `€${d.last.toFixed(3)}` : '—'}
                </span>
                {d && <Spark points={d.points} color={color} />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Spark({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return null;
  const w = 54, h = 18;
  const mn = Math.min(...points), mx = Math.max(...points);
  const range = mx - mn || 1;
  const xs = points.map((_, i) => (i / (points.length - 1)) * w);
  const ys = points.map(p => h - ((p - mn) / range) * (h - 2) - 1);
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ');
  const area = d + ` L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="flex-shrink-0">
      <defs>
        <linearGradient id={`sg-${color}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg-${color})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

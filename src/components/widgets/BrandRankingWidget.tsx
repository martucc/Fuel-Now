import { useMemo } from 'react';
import { cn } from '../../lib/utils';
import { getBrandLogo } from '../../lib/brandLogos';
import type { FuelStation, FuelType } from '../../types';

interface Props {
  stations: FuelStation[];
  fuel: FuelType;
}

export function BrandRankingWidget({ stations, fuel }: Props) {
  const ranking = useMemo(() => {
    const byBrand: Record<string, number[]> = {};
    for (const s of stations) {
      const price = s.prices.find(p => p.type === fuel)?.price;
      if (!price || price <= 0) continue;
      const brand = (s.brand || 'Bianca').trim() || 'Bianca';
      if (!byBrand[brand]) byBrand[brand] = [];
      byBrand[brand].push(price);
    }
    return Object.entries(byBrand)
      .filter(([, arr]) => arr.length >= 1)
      .map(([brand, arr]) => ({
        brand,
        avg: arr.reduce((a, b) => a + b, 0) / arr.length,
        n: arr.length,
      }))
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 5);
  }, [stations, fuel]);

  if (ranking.length < 2) return null;

  const best = ranking[0].avg;

  return (
    <div className="bg-[#09090b]/50 backdrop-blur-xl border border-white/5 rounded-[32px] p-5 shadow-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Brand in zona</h3>
        </div>
        <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">{fuel}</span>
      </div>
      <div className="space-y-2">
        {ranking.map((r, i) => {
          const delta = r.avg - best;
          return (
            <div key={r.brand} className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-white/[0.03] border border-white/5">
              <span
                className={cn(
                  'text-[10px] font-black w-5 text-center tabular-nums',
                  i === 0 ? 'text-emerald-400' : 'text-white/40'
                )}
              >
                #{i + 1}
              </span>
              <img
                src={getBrandLogo(r.brand)}
                alt={r.brand}
                className="w-6 h-6 object-contain rounded-full bg-black p-0.5 border border-white/5 flex-shrink-0"
              />
              <span className="text-[12px] font-bold text-white truncate flex-1">{r.brand}</span>
              <span className="text-[11px] font-black text-white tabular-nums">€{r.avg.toFixed(3)}</span>
              <span
                className={cn(
                  'text-[9px] font-bold tabular-nums w-10 text-right',
                  delta < 0.001 ? 'text-emerald-400' : 'text-white/40'
                )}
              >
                {delta < 0.001 ? 'best' : `+${(delta * 1000).toFixed(0)}`}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-[9px] text-white/30 font-bold mt-3 text-center uppercase tracking-widest">
        Prezzi medi · campione {ranking.reduce((s, r) => s + r.n, 0)} pompe
      </p>
    </div>
  );
}

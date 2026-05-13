import { useMemo } from 'react';
import { Trophy, AlertCircle } from 'lucide-react';
import type { FuelStation, FuelType } from '../types';

interface Props {
  stations: FuelStation[];
  carKml?: number;
  selectedFuel: FuelType;
}

const FUELS: FuelType[] = ['Benzina', 'Diesel', 'GPL', 'Metano'];
const TYPICAL_KML_RATIO: Record<FuelType, number> = {
  Benzina: 1.00,
  Diesel: 1.30,
  GPL: 0.85,
  Metano: 1.40,
};

function avg(prices: number[]): number {
  if (!prices.length) return 0;
  return prices.reduce((a, b) => a + b, 0) / prices.length;
}

export function FuelCostCompare({ stations, carKml, selectedFuel }: Props) {
  const baseline = carKml || 15;

  const rows = useMemo(() => {
    return FUELS.map(f => {
      const prices = stations
        .map(s => s.prices.find(p => p.type === f)?.price)
        .filter((p): p is number => !!p && p > 0);
      const avgP = avg(prices);
      const kml = baseline * TYPICAL_KML_RATIO[f];
      const costPer100 = avgP > 0 && kml > 0 ? (100 / kml) * avgP : 0;
      const costPerKm = avgP > 0 && kml > 0 ? avgP / kml : 0;
      return { fuel: f, avgPrice: avgP, kml, costPer100, costPerKm, sample: prices.length };
    });
  }, [stations, baseline]);

  const valid = rows.filter(r => r.costPer100 > 0);
  if (valid.length < 2) {
    return null;
  }

  const cheapest = valid.reduce((a, b) => a.costPer100 < b.costPer100 ? a : b);
  const current = rows.find(r => r.fuel === selectedFuel);
  const saving = current && current.costPer100 > 0
    ? ((current.costPer100 - cheapest.costPer100) / current.costPer100) * 100
    : 0;
  const isCurrentBest = current?.fuel === cheapest.fuel;

  return (
    <div className="bg-[#0a0f1d] p-6 sm:p-8 rounded-[36px] sm:rounded-[48px] border border-blue-500/30 space-y-5 relative overflow-hidden shadow-2xl">
      <div className="absolute -top-20 -left-20 w-80 h-80 bg-blue-600/10 blur-[100px] pointer-events-none rounded-full" />

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] animate-pulse" />
          <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500/90">Confronto Carburanti</h2>
        </div>
        <h3 className="text-2xl sm:text-3xl font-black uppercase italic tracking-tighter text-white leading-none">Costo per <span className="text-blue-500">100 km</span></h3>
        <div className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-widest mt-2 leading-snug">
          Basato sulla media in zona · KM/L stimato {carKml ? `da tuo veicolo (${carKml})` : 'standard'}
        </div>
      </div>

      <div className="relative z-10 space-y-2">
        {rows.map(r => {
          const isCheapest = r.fuel === cheapest.fuel;
          const isCurrent = r.fuel === selectedFuel;
          const isEmpty = r.costPer100 === 0;
          return (
            <div
              key={r.fuel}
              className={`flex items-center gap-3 p-4 rounded-[20px] border transition-all ${
                isEmpty
                  ? 'bg-black/20 border-white/5 opacity-40'
                  : isCheapest
                    ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                    : isCurrent
                      ? 'bg-blue-500/8 border-blue-500/20'
                      : 'bg-black/40 border-white/5'
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-black flex-shrink-0 border ${
                isCheapest
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : isCurrent
                    ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                    : 'bg-white/5 border-white/10 text-[#8e8e93]'
              }`}>
                {r.fuel[0]}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-[13px] font-black uppercase italic tracking-tight text-white truncate">{r.fuel}</div>
                  {isCheapest && <Trophy size={12} className="text-emerald-400 flex-shrink-0" />}
                  {isCurrent && <span className="text-[9px] font-black uppercase tracking-widest text-blue-400 flex-shrink-0">(Attivo)</span>}
                </div>
                <div className="text-[10px] font-bold text-[#8e8e93] uppercase tracking-widest mt-0.5 tabular-nums">
                  {isEmpty ? 'Non disponibile in zona' : `€${r.avgPrice.toFixed(3)}/L · ${r.kml.toFixed(1)} km/L`}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className={`text-[16px] sm:text-[18px] font-black italic tracking-tighter tabular-nums ${
                  isEmpty ? 'text-[#48484a]' : isCheapest ? 'text-emerald-400' : isCurrent ? 'text-blue-400' : 'text-white'
                }`}>
                  {isEmpty ? '—' : `€${r.costPer100.toFixed(2)}`}
                </div>
                <div className="text-[9px] font-black text-[#8e8e93] uppercase tracking-widest">/100km</div>
              </div>
            </div>
          );
        })}
      </div>

      {!isCurrentBest && saving > 5 && current && (
        <div className="relative z-10 flex items-start gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-[20px]">
          <AlertCircle size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="text-[11px] font-bold text-emerald-300 leading-relaxed">
            Con {cheapest.fuel} risparmieresti il <span className="font-black tabular-nums">{saving.toFixed(0)}%</span> per km rispetto a {current.fuel}.
            {!carKml && ' (Stima basata su consumi tipici — seleziona il tuo veicolo per dati precisi.)'}
          </div>
        </div>
      )}

      <div className="relative z-10 text-[9px] font-bold text-[#48484a] uppercase tracking-widest text-center leading-relaxed px-2">
        I km/L sono stime medie per categoria.<br/>Il consumo reale varia per motore e stile di guida.
      </div>
    </div>
  );
}

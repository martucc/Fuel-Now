import { motion } from 'motion/react';
import { Heart, MapPin, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import type { FuelStation, FuelType } from '../types';

interface Props {
  station: FuelStation;
  fuelType: FuelType;
  index: number;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  isCheapest?: boolean;
  tankLiters: number;
  averagePrice: number;
}

export function StationCard({ station, fuelType, index, isFavorite, onToggleFavorite, isCheapest, tankLiters, averagePrice }: Props) {
  const priceObj = station.prices.find(p => p.type === fuelType);
  const price = priceObj?.price || 0;
  const isAnomalous = price > 0 && averagePrice !== Infinity && price < averagePrice * 0.91;
  const fullTankCost = price > 0 ? (price * tankLiters).toFixed(2) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={cn(
        "group relative flex items-center gap-4 p-4 rounded-[2rem] border transition-all cursor-pointer overflow-hidden backdrop-blur-md",
        isAnomalous ? "bg-[#1c1c1e]/80 border-red-500/20 grayscale pt-10"
          : isCheapest ? "bg-blue-600/10 border-blue-500/30 shadow-xl shadow-blue-500/5"
          : "bg-white/[0.03] border-white/5 hover:bg-white/[0.05] hover:border-white/10"
      )}
    >
      {isAnomalous && (
        <div className="absolute top-0 left-0 right-0 bg-red-500/10 text-red-500 py-1.5 text-center text-[9px] font-black uppercase tracking-[0.2em] italic border-b border-red-500/20 backdrop-blur-md z-10 flex items-center justify-center gap-1.5 shadow-[0_4px_12px_rgba(239,68,68,0.1)]">
          <AlertTriangle size={12} /> POTREBBE ESSERE CHIUSO - PREZZO FUORI MERCATO
        </div>
      )}

      <div className={cn("absolute -right-8 -top-8 w-24 h-24 rounded-full blur-[40px] opacity-[0.05] group-hover:opacity-[0.1]", isCheapest ? "bg-blue-500" : "bg-white")} />

      <div className="relative flex-shrink-0">
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center font-black border shadow-inner", isAnomalous ? "bg-red-500/10 text-red-500 border-red-500/20" : isCheapest ? "bg-blue-600 text-white border-blue-400" : "bg-black text-[#8e8e93] border-white/5")}>
          {station.brand.charAt(0)}
        </div>
        <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(station.id); }} className={cn("absolute -top-1.5 -right-1.5 p-1 backdrop-blur-md rounded-full border z-10", isAnomalous ? "bg-black/60 border-red-500/20" : "bg-black/40 border-white/10")}>
          <Heart size={10} className={cn(isFavorite ? "text-red-500 fill-red-500" : "text-white/20 hover:text-white/40")} />
        </button>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-black text-white italic uppercase tracking-tight text-xs truncate group-hover:text-blue-400 transition-colors">{station.brand || station.name}</h4>
          {isCheapest && !isAnomalous && <span className="px-1.5 py-0.5 bg-blue-600 rounded text-[6px] font-black text-white uppercase tracking-widest animate-pulse">Alpha</span>}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[9px] font-bold text-[#8e8e93] uppercase tracking-wider truncate flex items-center gap-1">
            <MapPin size={8} className={cn(isAnomalous ? "text-red-500/50" : "text-blue-500/50")} /> {station.address.split(',')[0]}
          </span>
          <span className={cn("text-[9px] font-black uppercase tracking-widest italic", isAnomalous ? "text-red-500/40" : "text-blue-500/40")}>{station.distance || '0.5'} KM</span>
        </div>
        {!isAnomalous && (
          <div className="flex gap-1 mt-2">
            {station.services.slice(0, 2).map((s, i) => (
              <span key={i} className="text-[7px] font-black text-[#48484a] bg-black/30 px-1.5 py-0.5 rounded-lg border border-white/5 uppercase tracking-widest">{s}</span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col items-end gap-0.5">
        <div className={cn("text-xl font-black italic tracking-tighter flex items-baseline gap-0.5", isAnomalous ? "text-gray-500 line-through" : isCheapest ? "text-blue-400" : "text-white")}>
          <span className="text-[10px] not-italic mr-0.5 opacity-40">€</span>
          {price.toFixed(3)}
        </div>
        {fullTankCost && !isAnomalous && (
          <div className="text-[8px] font-black text-[#48484a] uppercase tracking-[0.15em] italic">
            Pieno: <span className="text-emerald-500/60">€{fullTankCost}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

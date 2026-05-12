import { motion } from 'motion/react';
import { Navigation, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import type { FuelStation, FuelType } from '../types';
import { getBrandLogo } from '../lib/brandLogos';

interface Props {
  station: FuelStation;
  fuelType: FuelType;
  index: number;
  isAnomalous: boolean;
  tankLiters: number;
}

export function StationCard({ station, fuelType, index, isAnomalous, tankLiters }: Props) {
  const priceObj = station.prices.find(p => p.type === fuelType);
  const price = priceObj?.price || 0;
  const fullTankCost = price > 0 ? (price * tankLiters).toFixed(0) : '-';
  const logo = getBrandLogo(station.brand || station.name || '');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      onClick={() => {
        if (!isAnomalous) window.open(`https://www.google.com/maps/dir/?api=1&destination=${station.location.lat},${station.location.lng}`, '_blank');
      }}
      className={cn(
        "relative flex items-center gap-4 p-4 rounded-[32px] border transition-all cursor-pointer overflow-hidden",
        isAnomalous 
          ? "bg-[#1c1c1e]/30 border-white/5 opacity-60 grayscale"
          : "bg-[#09090b] border-white/5 hover:bg-white/[0.05]"
      )}
    >
      {isAnomalous && (
        <div className="absolute top-0 right-4 bg-[#8e8e93]/20 px-2 py-0.5 rounded-b-lg flex items-center gap-1">
          <AlertTriangle size={10} className="text-[#8e8e93]" />
          <span className="text-[9px] font-bold text-[#8e8e93] uppercase tracking-widest">Anomalia</span>
        </div>
      )}

      {/* Brand Circle */}
      <div className="w-16 h-16 rounded-full bg-black flex items-center justify-center flex-shrink-0 border border-white/10 overflow-hidden shadow-inner z-10">
        <img 
          src={logo} 
          alt={station.brand} 
          className="w-full h-full object-contain scale-[0.9]" 
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 py-1">
        <h4 className={cn("text-[15px] font-bold truncate", isAnomalous ? "text-[#8e8e93]" : "text-white")}>
          {station.brand || station.name}
        </h4>
        <p className="text-[11px] font-medium text-[#8e8e93] mt-0.5 truncate">
          {station.distance || '0.5'} km &bull; {Math.floor(Math.random() * 10 + 2)} min fa
        </p>
      </div>

      {/* Price and Nav Button */}
      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="text-right">
          <div className={cn("text-2xl font-black tabular-nums tracking-tighter leading-none", isAnomalous ? "text-[#8e8e93]" : "text-white")}>
            {price > 0 ? price.toFixed(3) : '-'}
          </div>
          <div className="text-[10px] font-medium text-[#8e8e93] mt-1">
            Pieno <span className="font-bold text-white">{fullTankCost}</span>
          </div>
        </div>

        {!isAnomalous && (
          <button 
            className="w-12 h-12 rounded-full bg-white flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
            onClick={(e) => {
              e.stopPropagation();
              window.open(`https://www.google.com/maps/dir/?api=1&destination=${station.location.lat},${station.location.lng}`, '_blank');
            }}
          >
            <Navigation className="w-5 h-5 text-black" fill="none" strokeWidth={2.5} />
          </button>
        )}
      </div>
    </motion.div>
  );
}

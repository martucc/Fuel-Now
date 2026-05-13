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
  isBest?: boolean;
  onClick?: (s: FuelStation) => void;
}

export function StationCard({ station, fuelType, index, isAnomalous, tankLiters, isBest = false, onClick }: Props) {
  const priceObj = station.prices.find(p => p.type === fuelType);
  const price = priceObj?.price || 0;
  const fullTankCost = price > 0 ? (price * tankLiters).toFixed(0) : '-';
  const logo = getBrandLogo(station.brand || station.name || '');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.01 }}
      onClick={() => {
        if (isAnomalous) return;
        if (onClick) onClick(station);
        else window.open(`https://www.google.com/maps/dir/?api=1&destination=${station.location.lat},${station.location.lng}`, '_blank');
      }}
      className={cn(
        'relative flex items-center gap-4 p-4 rounded-[32px] border transition-all cursor-pointer overflow-hidden',
        isAnomalous
          ? 'bg-[#1c1c1e]/30 border-white/5 opacity-60 grayscale'
          : isBest
            ? 'bg-[#0a0f1d] border-blue-500/40 shadow-[0_0_40px_rgba(37,99,235,0.25)] hover:shadow-[0_0_60px_rgba(37,99,235,0.35)]'
            : 'bg-[#09090b] border-white/5 hover:bg-white/[0.05]'
      )}
    >
      {isBest && !isAnomalous && (
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/8 to-transparent pointer-events-none" />
      )}

      {isAnomalous && (
        <div className="absolute top-0 right-4 bg-[#8e8e93]/20 px-2 py-0.5 rounded-b-lg flex items-center gap-1">
          <AlertTriangle size={10} className="text-[#8e8e93]" />
          <span className="text-[9px] font-bold text-[#8e8e93] uppercase tracking-widest">Anomalia</span>
        </div>
      )}

      {/* Brand Circle */}
      <div
        className={cn(
          'w-16 h-16 rounded-full bg-black flex items-center justify-center flex-shrink-0 overflow-hidden shadow-inner z-10 border',
          isBest && !isAnomalous ? 'border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.4)]' : 'border-white/10'
        )}
      >
        <img
          src={logo}
          alt={station.brand}
          className="w-full h-full object-contain scale-[0.9]"
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 py-1 z-10">
        <h4
          className={cn(
            'text-[15px] font-bold truncate uppercase italic',
            isAnomalous ? 'text-[#8e8e93]' : isBest ? 'text-white' : 'text-white'
          )}
        >
          {station.city || station.name}
        </h4>
        <p className={cn('text-[11px] font-medium mt-0.5 truncate', isBest && !isAnomalous ? 'text-blue-300/70' : 'text-[#8e8e93]')}>
          {station.brand} &bull; {station.distance || '0.5'} km &bull; {station.address}
        </p>
      </div>

      {/* Price and Nav Button */}
      <div className="flex items-center gap-4 flex-shrink-0 z-10">
        <div className="text-right">
          <div
            className={cn(
              'text-2xl font-black tabular-nums tracking-tighter leading-none',
              isAnomalous
                ? 'text-[#8e8e93]'
                : isBest
                  ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]'
                  : 'text-white'
            )}
          >
            {price > 0 ? price.toFixed(3) : '-'}
          </div>
          <div className={cn('text-[10px] font-medium mt-1', isBest && !isAnomalous ? 'text-blue-300/70' : 'text-[#8e8e93]')}>
            Pieno <span className={cn('font-bold', isBest && !isAnomalous ? 'text-blue-300' : 'text-white')}>{fullTankCost}</span>
          </div>
        </div>

        {!isAnomalous && (
          <button
            className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform',
              isBest ? 'bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)]' : 'bg-white'
            )}
            onClick={(e) => {
              e.stopPropagation();
              window.open(`https://www.google.com/maps/dir/?api=1&destination=${station.location.lat},${station.location.lng}`, '_blank');
            }}
          >
            <Navigation className={cn('w-5 h-5', isBest ? 'text-white fill-white' : 'text-black')} fill="none" strokeWidth={2.5} />
          </button>
        )}
      </div>
    </motion.div>
  );
}

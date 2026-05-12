import { useState } from 'react';
import { motion } from 'motion/react';
import { Search, SlidersHorizontal, Crown, Navigation, TrendingDown, TrendingUp, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { FuelStation, FuelType, MarketAnalysis, Alert } from '../../types';
import { FuelTypeSelector } from '../FuelTypeSelector';
import { StationCard } from '../StationCard';
import { getBrandLogo } from '../../lib/brandLogos';

interface Props {
  stations: FuelStation[];
  filteredStations: FuelStation[];
  selectedFuel: FuelType;
  setSelectedFuel: (f: FuelType) => void;
  favorites: string[];
  toggleFavorite: (id: string) => void;
  marketRef: MarketAnalysis | null;
  loading: boolean;
  cheapestPrice: number;
  averagePrice: number;
  tankLiters: number;
  fuelNews: any[];
  aiError: string | null;
  setShowSettings: (v: boolean) => void;
  setShowFilters: (v: boolean) => void;
  selectedBrands: string[];
  selectedServices: string[];
  setSelectedBrands: (v: string[]) => void;
  setSelectedServices: (v: string[]) => void;
  setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>;
  selectedCar: any;
  analysisLoading: boolean;
  fetchAnalysis: (f: FuelType, force?: boolean) => void;
  isPriceAnom: (s: FuelStation, f: FuelType) => boolean;
  radius: number;
  setRadius: (v: number) => void;
}

export function HomeTab(p: Props) {
  const [searchQuery, setSearchQuery] = useState('');

  const bestStation = p.filteredStations.find(s => {
    const cp = s.prices.find(pp => pp.type === p.selectedFuel)?.price;
    return cp === p.cheapestPrice && p.cheapestPrice !== Infinity;
  });

  const displayStations = p.filteredStations.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const spread = p.cheapestPrice !== Infinity && p.averagePrice !== Infinity 
    ? (p.filteredStations[p.filteredStations.length-1]?.prices.find(pp=>pp.type===p.selectedFuel)?.price || p.averagePrice) - p.cheapestPrice 
    : 0;

  const bestLogo = bestStation ? getBrandLogo(bestStation.brand || bestStation.name || '') : 'GENERIC';

  return (
    <motion.div key="home" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="space-y-6 pb-32">
      
      {/* Search and Top Bar */}
      <div className="pt-2 px-1">
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8e8e93]" />
          <input
            type="text"
            placeholder="Cerca stazione..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1c1c1e] rounded-full pl-11 pr-12 py-3 text-sm text-white placeholder:text-[#8e8e93] focus:outline-none transition-all shadow-md"
          />
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => p.setShowFilters(true)}
            className={cn("absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors", (p.selectedBrands.length > 0 || p.selectedServices.length > 0) ? "bg-white text-black" : "text-white")}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </motion.button>
        </div>
        
        <div className="mb-4">
          <FuelTypeSelector current={p.selectedFuel} onSelect={p.setSelectedFuel} />
        </div>

        {/* Radius Slider */}
        <div className="mb-6 px-3 py-4 bg-[#1c1c1e] rounded-[24px] border border-white/5">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-[10px] font-black text-[#8e8e93] uppercase tracking-[0.2em]">Raggio Ricerca</span>
            <span className="text-xs font-black text-blue-400">{p.radius} km</span>
          </div>
          <input 
            type="range" 
            min="1" 
            max="100" 
            value={p.radius} 
            onChange={(e) => p.setRadius(Number(e.target.value))}
            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between mt-2 px-1">
            <span className="text-[9px] font-bold text-[#48484a]">1km</span>
            <span className="text-[9px] font-bold text-[#48484a]">100km</span>
          </div>
        </div>
      </div>

      {/* HERO: Best Price Card */}
      {bestStation && (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}>
          <div className="relative bg-[#0a0f1d] rounded-[40px] p-8 overflow-hidden border border-blue-500/30 shadow-[0_0_60px_rgba(37,99,235,0.25)]">
            {/* Subtle inner gradient to simulate the glow from the image */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-transparent pointer-events-none" />
            
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-10">
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 rounded-full bg-black flex items-center justify-center shadow-[0_0_30px_rgba(37,99,235,0.4)] overflow-hidden border border-white/10 z-10">
                    <img src={bestLogo} alt={bestStation.brand} className="w-full h-full object-contain scale-[0.9]" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1">Miglior Prezzo</p>
                    <h2 className="text-2xl font-black text-white tracking-tighter leading-tight uppercase italic">{bestStation.city || bestStation.name}</h2>
                    <p className="text-[13px] text-[#8e8e93] font-bold mt-0.5">{bestStation.brand} &bull; {bestStation.address} &bull; {bestStation.distance || '1.2'} km</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-blue-500 bg-blue-500/10">
                  <Crown className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-[11px] font-black text-blue-400 uppercase tracking-widest">Alpha</span>
                </div>
              </div>
              
              <div className="flex items-end justify-between mb-10 px-1">
                <div>
                  <p className="text-[11px] font-black text-[#8e8e93] uppercase tracking-widest mb-2">Prezzo/Litro</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[58px] font-black text-[#4ade80] tabular-nums tracking-tighter leading-none">
                      {p.cheapestPrice.toFixed(3)}
                    </span>
                    <span className="text-xl font-black text-white/40">EUR</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-black text-[#8e8e93] uppercase tracking-widest mb-2">Costo Pieno<br/><span className="text-[9px] opacity-60">({p.tankLiters}L)</span></p>
                  <p className="text-[36px] font-black text-white tabular-nums tracking-tighter">
                    {(p.cheapestPrice * p.tankLiters).toFixed(2)}
                  </p>
                </div>
              </div>
              
              <a 
                href={`https://www.google.com/maps/dir/?api=1&destination=${bestStation.location.lat},${bestStation.location.lng}`} 
                target="_blank" 
                rel="noreferrer" 
                className="w-full flex items-center justify-center gap-3 py-5 rounded-full bg-white text-black font-black text-[16px] uppercase tracking-widest hover:bg-gray-100 transition-all shadow-2xl active:scale-95"
              >
                <Navigation className="w-5 h-5 fill-black" /> Naviga Ora
              </a>
            </div>
          </div>
        </motion.div>
      )}

      {/* Intelligence Widget */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-[#09090b]/50 backdrop-blur-xl border border-white/5 rounded-[40px] p-7 shadow-2xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[#4ade80] shadow-[0_0_8px_rgba(74,222,128,0.8)] animate-pulse" />
            <span className="text-[13px] font-black text-white uppercase tracking-[0.2em]">Intelligence</span>
          </div>
          <div className="flex items-center gap-3">
            <div className={cn("flex items-center gap-1.5 text-[11px] font-black px-3 py-1.5 rounded-full border", p.marketRef?.trend === "DOWN" ? "text-[#4ade80] bg-[#4ade80]/10 border-[#4ade80]/20" : "text-red-400 bg-red-500/10 border-red-500/20")}>
              {p.marketRef?.trend === "DOWN" ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
              {p.marketRef?.trend === "DOWN" ? "Ribasso" : "Rialzo"}
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); p.fetchAnalysis(p.selectedFuel, true); }}
              disabled={p.analysisLoading}
              className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 text-white/40 hover:text-white transition-all active:scale-90"
              title="Rigenera Analisi"
            >
              <RefreshCw size={16} className={cn(p.analysisLoading && "animate-spin")} />
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-4 items-center mb-8">
          <div className="text-center space-y-2">
            <p className="text-[10px] font-bold text-[#8e8e93] uppercase tracking-widest">Media</p>
            <p className="text-2xl font-black text-white tabular-nums tracking-tight">{p.averagePrice !== Infinity ? p.averagePrice.toFixed(3) : '-'}</p>
          </div>
          <div className="text-center py-5 px-2 bg-emerald-500/5 rounded-[32px] border border-emerald-500/20 shadow-inner">
            <p className="text-[10px] font-black text-[#4ade80] uppercase tracking-widest mb-1">Più Economico</p>
            <p className="text-2xl font-black text-[#4ade80] tabular-nums tracking-tight">{p.cheapestPrice !== Infinity ? p.cheapestPrice.toFixed(3) : '-'}</p>
          </div>
          <div className="text-center space-y-2">
            <p className="text-[10px] font-bold text-[#8e8e93] uppercase tracking-widest">Spread</p>
            <p className="text-2xl font-black text-white tabular-nums tracking-tight">{spread > 0 ? spread.toFixed(3) : '-'}</p>
          </div>
        </div>

        {p.marketRef && (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-[32px] p-6 border border-white/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[40px] pointer-events-none" />
              <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="flex items-center gap-2">
                  <div className={cn("w-1.5 h-1.5 rounded-full", p.marketRef.advice === 'FILL-FULL' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,1)]" : "bg-blue-500")} />
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Strategia IA</span>
                </div>
                <div className={cn("px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border", 
                  p.marketRef.advice === 'FILL-FULL' ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" : 
                  p.marketRef.advice === 'WAIT' ? "text-blue-400 border-blue-500/30 bg-blue-500/10" : 
                  "text-amber-400 border-amber-500/30 bg-amber-500/10"
                )}>
                  {p.marketRef.advice === 'FILL-FULL' ? 'Pieno Consigliato' : 
                   p.marketRef.advice === 'WAIT' ? 'Attendi Calo' : 
                   p.marketRef.advice === 'TEN-EURO' ? 'Rifornimento Minimo' : 'Azione Urgente'}
                </div>
              </div>
              <p className="text-[13px] text-white/80 font-bold italic leading-relaxed tracking-tight relative z-10">
                "{p.marketRef.reasoning}"
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-[28px] p-5 border border-white/5 flex flex-col items-center justify-center space-y-1">
                <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em]">Previsione 7G</p>
                <div className="flex items-center gap-1.5">
                  <TrendingUp className={cn("w-3 h-3", (p.marketRef.forecast?.[p.marketRef.forecast.length-1]?.price || 0) > p.cheapestPrice ? "text-red-400" : "text-emerald-400 rotate-180")} />
                  <p className={cn("text-lg font-black tracking-tighter tabular-nums", (p.marketRef.forecast?.[p.marketRef.forecast.length-1]?.price || 0) > p.cheapestPrice ? "text-red-400" : "text-emerald-400")}>
                    {((((p.marketRef.forecast?.[p.marketRef.forecast.length-1]?.price || p.cheapestPrice) - p.cheapestPrice) / p.cheapestPrice) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
              <div className="bg-white/5 rounded-[28px] p-5 border border-white/5 flex flex-col items-center justify-center space-y-1">
                <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em]">Trend Atteso</p>
                <p className="text-lg font-black text-white tracking-tighter uppercase italic">
                  {p.marketRef.trend === 'DOWN' ? 'Ribasso' : p.marketRef.trend === 'UP' ? 'Rialzo' : 'Stabile'}
                </p>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Other Stations List */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-[10px] font-black text-[#48484a] uppercase tracking-[0.3em]">
            Altre Stazioni
          </h2>
          <span className="text-[10px] font-bold text-[#8e8e93]">
            {displayStations.length} risultati
          </span>
        </div>
        
        <div className="space-y-4">
          {displayStations.length > 0 ? (
            displayStations.slice(0, 40).map((s, idx) => {
              if (s.id === bestStation?.id) return null; // Skip alpha since it's in the hero
              return <StationCard key={s.id} station={s} fuelType={p.selectedFuel} index={idx} isAnomalous={p.isPriceAnom(s, p.selectedFuel)} tankLiters={p.tankLiters} />;
            })
          ) : (
             <div className="text-center py-16 bg-[#1c1c1e]/30 rounded-[32px] border border-white/5 border-dashed">
               <p className="text-xs font-black uppercase text-[#8e8e93] tracking-widest">Nessun Risultato</p>
             </div>
          )}
        </div>
      </motion.div>

    </motion.div>
  );
}

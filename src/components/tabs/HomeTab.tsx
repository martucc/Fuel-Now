import { motion } from 'motion/react';
import { Droplets, Globe, TrendingDown, TrendingUp, Info, Heart, MapPin, Filter, MapIcon, BarChart3, AlertCircle, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { FuelStation, FuelType, MarketAnalysis, Alert } from '../../types';
import { AdviceSection } from '../AdviceSection';
import { FuelTypeSelector } from '../FuelTypeSelector';
import { StationCard } from '../StationCard';

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
}

export function HomeTab(p: Props) {
  return (
    <motion.div key="home" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="space-y-10 pb-32">
      <div className="flex items-center justify-between px-2 pt-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20"><Droplets className="text-white" size={20} /></div>
          <div className="space-y-0.5">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500/80 leading-none">Status Operativo</h2>
            <p className="text-[9px] font-bold text-[#48484a] uppercase tracking-widest leading-none">Oggi, {new Date().getHours()}:{new Date().getMinutes().toString().padStart(2, '0')}</p>
          </div>
        </div>
      </div>

      {p.aiError && (
        <div className="p-6 bg-red-500/5 border border-red-500/10 rounded-[2.5rem] flex items-center justify-between backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-red-500/10 flex items-center justify-center"><AlertCircle className="text-red-500" size={20} /></div>
            <p className="text-[11px] font-black text-red-500 uppercase tracking-widest">{p.aiError}</p>
          </div>
          <button onClick={() => p.setShowSettings(true)} className="p-2.5 bg-red-500/10 rounded-xl text-red-500"><Settings size={14} /></button>
        </div>
      )}

      <div className="space-y-4">
        {p.fuelNews?.length > 0 ? (
          <div className="grid gap-4">
            {p.fuelNews.slice(0, 1).map((news: any, i: number) => (
              <div key={i} className={cn("p-6 rounded-[2.5rem] border border-white/5 relative overflow-hidden backdrop-blur-xl shadow-2xl", news.impact === 'positive' ? "bg-emerald-500/[0.03]" : news.impact === 'negative' ? "bg-red-500/[0.03]" : "bg-white/[0.02]")}>
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none"><Globe size={80} /></div>
                <div className="flex items-center gap-4 mb-3 relative z-10">
                  <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg", news.impact === 'positive' ? "bg-emerald-500/10 text-emerald-500" : news.impact === 'negative' ? "bg-red-500/10 text-red-500" : "bg-blue-500/10 text-blue-500")}>
                    {news.impact === 'positive' ? <TrendingDown size={20} /> : news.impact === 'negative' ? <TrendingUp size={20} /> : <Info size={20} />}
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[8px] font-black uppercase tracking-[0.3em] text-[#48484a]">Flash Intel</span>
                    <h4 className="font-black text-xs text-white uppercase italic tracking-tight leading-tight line-clamp-1">{news.title}</h4>
                  </div>
                </div>
                <p className="text-[11px] text-[#8e8e93] leading-relaxed line-clamp-2 font-medium relative z-10 pl-14 italic border-l border-white/5 ml-5">"{news.summary || news.content}"</p>
              </div>
            ))}
            {p.marketRef && <AdviceSection analysis={p.marketRef} fuelType={p.selectedFuel} />}
          </div>
        ) : p.marketRef ? <AdviceSection analysis={p.marketRef} fuelType={p.selectedFuel} /> : (
          <div className="w-full h-32 bg-[#1c1c1e]/40 animate-pulse rounded-[2.5rem] border border-white/5 flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="relative mx-auto w-8 h-8"><BarChart3 size={24} className="text-blue-500 opacity-20" /><div className="absolute inset-0 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
              <div className="text-[9px] font-black text-[#48484a] uppercase tracking-[0.3em]">AI Engine Sync...</div>
            </div>
          </div>
        )}
      </div>

      {p.favorites.length > 0 && (
        <section className="space-y-4 pt-2">
          <div className="flex items-center gap-3 px-2">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#48484a]">Watchlist</h2>
            <div className="h-px flex-1 bg-white/5" /><Heart size={12} className="text-red-500 animate-pulse" />
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar px-1">
            {p.stations.filter(s => p.favorites.includes(s.id)).map(s => (
              <div key={s.id} className="min-w-[190px] bg-[#1c1c1e]/60 backdrop-blur-md p-6 rounded-[2.5rem] border border-white/5 space-y-4 hover:border-blue-500/20 transition-all shadow-xl">
                <div className="flex justify-between items-start">
                  <div className="space-y-0.5"><span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">{s.brand}</span><div className="text-[8px] font-bold text-[#48484a] uppercase tracking-tighter truncate max-w-[100px]">{s.name}</div></div>
                  <div className="w-8 h-8 bg-red-500/5 rounded-xl flex items-center justify-center"><Heart size={14} className="text-red-500 fill-red-500/20" /></div>
                </div>
                <div className="flex items-baseline gap-1"><span className="text-2xl font-black italic text-white tracking-tighter">€{s.prices.find(pp => pp.type === p.selectedFuel)?.price.toFixed(3) || '-'}</span><span className="text-[9px] font-black text-[#48484a] uppercase">/L</span></div>
                <div className="flex items-center gap-1.5 text-[9px] text-[#8e8e93] font-black uppercase tracking-widest bg-black/20 p-2 rounded-xl border border-white/5"><MapPin size={10} className="text-blue-500" /> {s.distance || '0.5'} KM</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-6 pt-2">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-white italic">Distributori</h2>
          </div>
          <div className="flex items-center gap-3 bg-black/40 p-1.5 rounded-2xl border border-white/5 backdrop-blur-md">
            <button onClick={() => p.setShowFilters(true)} className={cn("p-2.5 rounded-xl transition-all", (p.selectedBrands.length > 0 || p.selectedServices.length > 0) ? "text-blue-500 bg-blue-500/10" : "text-[#48484a] hover:text-white")}><Filter size={16} /></button>
            <div className="w-px h-4 bg-white/10" />
            <FuelTypeSelector current={p.selectedFuel} onSelect={p.setSelectedFuel} />
          </div>
        </div>
        <div className="space-y-5">
          {p.stations.length === 0 && p.loading ? (
            [...Array(3)].map((_, i) => <div key={i} className="h-44 bg-[#1c1c1e]/40 animate-pulse rounded-[3rem] border border-white/5" />)
          ) : p.filteredStations.length > 0 ? (
            p.filteredStations.slice(0, 40).map((s, idx) => (
              <StationCard key={s.id} station={s} fuelType={p.selectedFuel} index={idx} isFavorite={p.favorites.includes(s.id)} onToggleFavorite={p.toggleFavorite} isCheapest={s.prices.find(pp => pp.type === p.selectedFuel)?.price === p.cheapestPrice && p.cheapestPrice !== Infinity} tankLiters={p.tankLiters} averagePrice={p.averagePrice} />
            ))
          ) : (
            <div className="text-center py-20 bg-[#1c1c1e]/30 rounded-[3.5rem] border border-white/5 border-dashed space-y-5">
              <p className="text-sm font-black uppercase italic text-white tracking-widest">Nessun Risultato</p>
              <button onClick={() => { p.setSelectedBrands([]); p.setSelectedServices([]); }} className="px-6 py-3 bg-blue-600/10 text-blue-500 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border border-blue-500/20 hover:bg-blue-600 hover:text-white transition-all">Reset Filtri</button>
            </div>
          )}
        </div>
      </section>
    </motion.div>
  );
}

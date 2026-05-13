import { motion } from 'motion/react';
import { Car, Search, ChevronRight, Zap } from 'lucide-react';

interface Props {
  cars: any[];
  selectedCar: any;
  setSelectedCar: (c: any) => void;
  carSearchQuery: string;
  setCarSearchQuery: (q: string) => void;
  handleSelectCar: (c: any) => void;
}

export function VehicleTab(p: Props) {
  return (
    <motion.div key="veicolo" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="space-y-6 pb-24">
      <header className="px-2 pt-2 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] animate-pulse" />
          <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500/90">Garage Module</h2>
        </div>
        <h3 className="text-4xl font-black tracking-tighter text-white uppercase italic leading-none">Il Tuo <span className="text-blue-500">Veicolo</span></h3>
      </header>

      {p.selectedCar ? (
        <div className="bg-[#0a0f1d] p-6 sm:p-9 rounded-[36px] sm:rounded-[48px] border border-blue-500/30 space-y-8 sm:space-y-10 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 blur-[100px] pointer-events-none rounded-full" />
          <div className="flex justify-between items-start gap-3 relative z-10">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-black uppercase tracking-[0.3em] sm:tracking-[0.4em] text-blue-400 mb-3">Veicolo Attivo</div>
              <h3 className="text-2xl sm:text-4xl font-black uppercase italic tracking-tighter text-white leading-tight break-words">{p.selectedCar.model}</h3>
              <div className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-widest opacity-60 mt-2 break-words">{p.selectedCar.tags}</div>
            </div>
            <button
              onClick={() => p.setSelectedCar(null)}
              className="px-4 sm:px-5 py-2.5 bg-white/5 hover:bg-red-500/10 rounded-full text-[10px] font-black uppercase tracking-widest text-[#8e8e93] hover:text-red-400 transition-all border border-white/10 flex-shrink-0"
            >
              Rimuovi
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-5 relative z-10">
            <div className="bg-black/40 backdrop-blur-xl p-5 sm:p-7 rounded-[24px] sm:rounded-[32px] border border-white/5 shadow-inner min-w-0 overflow-hidden">
              <div className="text-[10px] font-black text-[#8e8e93] uppercase tracking-[0.2em] mb-2">Serbatoio</div>
              <div className="text-2xl sm:text-4xl font-black italic text-white tracking-tighter tabular-nums truncate">{p.selectedCar.liters}<span className="text-sm ml-1 text-blue-500 font-black">L</span></div>
            </div>
            <div className="bg-black/40 backdrop-blur-xl p-5 sm:p-7 rounded-[24px] sm:rounded-[32px] border border-white/5 shadow-inner min-w-0 overflow-hidden">
              <div className="text-[10px] font-black text-[#8e8e93] uppercase tracking-[0.2em] mb-2">Consumo</div>
              <div className="text-2xl sm:text-4xl font-black italic text-white tracking-tighter tabular-nums truncate">{p.selectedCar.kml}<span className="text-sm ml-1 text-blue-500 font-black">KM/L</span></div>
            </div>
          </div>
          <div className="pt-8 border-t border-white/10 relative z-10">
            <div className="flex justify-between items-center gap-3 p-5 sm:p-7 bg-blue-600/10 rounded-[28px] sm:rounded-[40px] border border-blue-500/20 shadow-2xl backdrop-blur-md">
              <div className="flex items-center gap-4 sm:gap-5 min-w-0 flex-1">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-2xl border border-blue-400/30 flex-shrink-0">
                  <Zap className="w-5 h-5 sm:w-6 sm:h-6 fill-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-blue-400 mb-0.5">Efficienza</div>
                  <div className="text-[13px] font-black text-white uppercase italic tracking-tight truncate">Range Ottimale</div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-2xl sm:text-3xl font-black italic text-white tracking-tighter tabular-nums">{p.selectedCar.kml}</div>
                <div className="text-[10px] font-black text-blue-500/60 uppercase tracking-[0.2em]">KM/L</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-black/40 backdrop-blur-2xl rounded-full p-2.5 flex items-center gap-5 shadow-2xl border border-white/10 focus-within:border-blue-500/50 transition-all">
            <div className="w-11 h-11 rounded-full bg-white/5 flex items-center justify-center text-blue-500 ml-1 border border-white/5">
              <Search size={22} />
            </div>
            <input 
              type="text" 
              placeholder="Cerca il tuo modello..." 
              value={p.carSearchQuery} 
              onChange={e => p.setCarSearchQuery(e.target.value)} 
              className="bg-transparent border-none outline-none text-white w-full text-base font-bold placeholder:text-[#48484a] tracking-tight" 
            />
          </div>
          <div className="text-[11px] font-black uppercase tracking-[0.4em] text-[#48484a] ml-5 italic opacity-60">{p.cars.length} modelli rilevati</div>
          <div className="grid grid-cols-1 gap-4 max-h-[60vh] overflow-y-auto no-scrollbar px-1">
            {p.cars.filter(car => car.model.toLowerCase().includes(p.carSearchQuery.toLowerCase()) || (car.tags||'').toLowerCase().includes(p.carSearchQuery.toLowerCase())).map((car, idx) => (
              <button 
                key={idx} 
                onClick={() => p.handleSelectCar(car)} 
                className="flex items-center justify-between p-6 bg-[#0a0f1d] hover:bg-blue-600/[0.04] rounded-[32px] border border-white/5 transition-all group text-left active:scale-[0.98] shadow-xl hover:border-blue-500/30"
              >
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 bg-black/40 rounded-full flex items-center justify-center text-[#8e8e93] group-hover:bg-blue-600 group-hover:text-white transition-all border border-white/10 shadow-inner">
                    <Car size={26} />
                  </div>
                  <div>
                    <div className="font-black text-white text-[16px] group-hover:text-blue-400 transition-colors uppercase italic tracking-tight">{car.model}</div>
                    <div className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-widest mt-1 opacity-60">{car.liters}L • {car.kml} KM/L</div>
                  </div>
                </div>
                <div className="w-11 h-11 rounded-full bg-white/5 flex items-center justify-center text-[#8e8e93] group-hover:text-blue-500 border border-transparent group-hover:border-blue-500/20 transition-all shadow-md">
                  <ChevronRight size={22} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

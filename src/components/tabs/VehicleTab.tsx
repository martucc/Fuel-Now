import { motion } from 'motion/react';
import { Car, Search, ChevronRight, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';

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
      <header className="px-2 pt-2 space-y-3">
        <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]" /><h2 className="text-[9px] font-black uppercase tracking-[0.4em] text-blue-500/90">Garage Module</h2></div>
        <h3 className="text-4xl font-black tracking-tight text-white uppercase italic leading-none">Il Tuo <span className="text-blue-500">Veicolo</span></h3>
      </header>

      {p.selectedCar ? (
        <div className="bg-[#1c1c1e] p-8 rounded-[3.5rem] border border-white/5 space-y-8 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 blur-[70px] pointer-events-none" />
          <div className="flex justify-between items-start relative z-10">
            <div><div className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500 mb-2">Veicolo Attivo</div><h3 className="text-3xl font-black uppercase italic tracking-tighter text-white">{p.selectedCar.model}</h3><div className="text-[10px] font-bold text-[#48484a] uppercase tracking-widest">{p.selectedCar.tags}</div></div>
            <button onClick={() => p.setSelectedCar(null)} className="px-4 py-2 bg-white/5 hover:bg-red-500/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-[#8e8e93] hover:text-red-500 transition-all border border-white/5">Rimuovi</button>
          </div>
          <div className="grid grid-cols-2 gap-4 relative z-10">
            <div className="bg-black/40 p-6 rounded-[2.5rem] border border-white/5"><div className="text-[9px] font-black text-[#48484a] uppercase tracking-[0.3em] mb-2">Serbatoio</div><div className="text-3xl font-black italic text-white">{p.selectedCar.liters}<span className="text-sm ml-1 text-blue-500">L</span></div></div>
            <div className="bg-black/40 p-6 rounded-[2.5rem] border border-white/5"><div className="text-[9px] font-black text-[#48484a] uppercase tracking-[0.3em] mb-2">Consumo</div><div className="text-3xl font-black italic text-white">{p.selectedCar.kml}<span className="text-sm ml-1 text-blue-500">KM/L</span></div></div>
          </div>
          <div className="pt-6 border-t border-white/5 relative z-10">
            <div className="flex justify-between items-center p-6 bg-blue-600/10 rounded-[2.5rem] border border-blue-500/20 shadow-lg">
              <div className="flex items-center gap-4"><div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-xl"><Zap size={22} className="fill-white" /></div><div><div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">Indice Efficienza</div><div className="text-xs font-black text-white uppercase italic">Range Ottimale</div></div></div>
              <div className="text-right"><div className="text-2xl font-black italic text-white">{p.selectedCar.kml}</div><div className="text-[8px] font-black text-blue-500/60 uppercase tracking-widest">KM/L</div></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-5 flex items-center gap-4 shadow-2xl"><Search size={20} className="text-blue-500" /><input type="text" placeholder="Cerca veicolo..." value={p.carSearchQuery} onChange={e => p.setCarSearchQuery(e.target.value)} className="bg-transparent border-none outline-none text-white w-full text-sm font-black uppercase tracking-[0.2em] placeholder:text-[#48484a]" /></div>
          <div className="text-[9px] font-black uppercase tracking-[0.4em] text-[#48484a] ml-4 italic">{p.cars.length} modelli nel database</div>
          <div className="grid grid-cols-1 gap-4 max-h-[50vh] overflow-y-auto no-scrollbar px-1">
            {p.cars.filter(car => car.model.toLowerCase().includes(p.carSearchQuery.toLowerCase()) || (car.tags||'').toLowerCase().includes(p.carSearchQuery.toLowerCase())).map((car, idx) => (
              <button key={idx} onClick={() => p.handleSelectCar(car)} className="flex items-center justify-between p-6 bg-[#1c1c1e] hover:bg-blue-600/[0.04] rounded-[2.5rem] border border-white/5 transition-all group text-left active:scale-[0.98] shadow-lg hover:border-blue-500/20">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-[#48484a] group-hover:bg-blue-600/10 group-hover:text-blue-500 transition-all border border-transparent group-hover:border-blue-500/20"><Car size={24} /></div>
                  <div><div className="font-black uppercase tracking-tight text-white text-sm group-hover:text-blue-400 italic">{car.model}</div><div className="text-[9px] font-black text-[#48484a] uppercase tracking-widest">{car.liters}L • {car.kml} KM/L</div></div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-[#48484a] group-hover:text-blue-500"><ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" /></div>
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

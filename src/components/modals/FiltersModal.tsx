import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Props {
  show: boolean; setShow: (v: boolean) => void;
  selectedBrands: string[]; setSelectedBrands: (v: string[]) => void;
  selectedServices: string[]; setSelectedServices: (v: string[]) => void;
  h24: boolean; setH24: (v: boolean) => void;
  noHighway: boolean; setNoHighway: (v: boolean) => void;
  hideAnomalies: boolean; setHideAnomalies: (v: boolean) => void;
  radius: number; setRadius: (v: number) => void;
  brands: string[];
}

export function FiltersModal(p: Props) {
  const btn = (active: boolean) => cn("px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border", active ? "bg-blue-600 text-white border-blue-500 shadow-xl shadow-blue-900/20" : "bg-white/5 text-[#8e8e93] border-white/5");

  return (
    <AnimatePresence>
      {p.show && (
        <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed inset-0 z-[60] flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => p.setShow(false)} />
          <div className="w-full max-w-md bg-[#1c1c1e] rounded-t-[3rem] border-t border-white/10 p-8 pt-4 space-y-8 relative z-10 max-h-[85vh] overflow-y-auto no-scrollbar">
            <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto" />
            <div className="flex justify-between items-center"><h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">Filtri</h3><button onClick={() => p.setShow(false)} className="p-3 bg-white/5 rounded-full text-white"><X size={20} /></button></div>
            <section className="space-y-4">
              <h4 className="text-[11px] font-black text-[#8e8e93] uppercase tracking-[0.2em] px-1">Brand</h4>
              <div className="flex flex-wrap gap-2">{p.brands.map(b => <button key={b} onClick={() => p.setSelectedBrands(p.selectedBrands.includes(b) ? p.selectedBrands.filter(x => x !== b) : [...p.selectedBrands, b])} className={btn(p.selectedBrands.includes(b))}>{b}</button>)}</div>
            </section>
            <section className="space-y-4">
              <h4 className="text-[11px] font-black text-[#8e8e93] uppercase tracking-[0.2em] px-1">Servizi</h4>
              <div className="flex flex-wrap gap-2">{['Self-Service', 'Bar', 'Autolavaggio', 'Officina'].map(s => <button key={s} onClick={() => p.setSelectedServices(p.selectedServices.includes(s) ? p.selectedServices.filter(x => x !== s) : [...p.selectedServices, s])} className={btn(p.selectedServices.includes(s))}>{s}</button>)}</div>
            </section>
            <section className="space-y-4">
              <h4 className="text-[11px] font-black text-[#8e8e93] uppercase tracking-[0.2em] px-1">Filtri Extra</h4>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => p.setH24(!p.h24)} className={btn(p.h24)}>H24</button>
                <button onClick={() => p.setNoHighway(!p.noHighway)} className={btn(p.noHighway)}>Evita Autostrada</button>
                <button onClick={() => p.setHideAnomalies(!p.hideAnomalies)} className={cn("px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border", p.hideAnomalies ? "bg-amber-600 text-white border-amber-500" : "bg-white/5 text-[#8e8e93] border-white/5")}>Nascondi Anomalie</button>
              </div>
              <div className="mt-4 px-1"><label className="text-[10px] font-black text-[#8e8e93] uppercase tracking-widest flex justify-between">Distanza Max <span>{p.radius} KM</span></label><input type="range" min="1" max="100" value={p.radius} onChange={e => p.setRadius(parseInt(e.target.value))} className="w-full mt-2" /></div>
            </section>
            <div className="flex gap-4 pt-4 pb-10">
              <button onClick={() => { p.setSelectedBrands([]); p.setSelectedServices([]); p.setH24(false); p.setNoHighway(false); p.setRadius(20); }} className="flex-1 py-5 bg-white/5 text-[#8e8e93] font-black rounded-3xl text-xs uppercase tracking-widest">Resetta</button>
              <button onClick={() => p.setShow(false)} className="flex-[2] py-5 bg-blue-600 text-white font-black rounded-3xl shadow-2xl shadow-blue-900/30 active:scale-95 transition-all text-xs uppercase tracking-widest">Applica</button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

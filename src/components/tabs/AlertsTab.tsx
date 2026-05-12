import { motion } from 'motion/react';
import { BellOff, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { FuelType, Alert } from '../../types';

interface Props {
  selectedFuel: FuelType;
  alerts: Alert[];
  setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>;
}

export function AlertsTab(p: Props) {
  return (
    <motion.div key="alerts" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-8 pb-24">
      <header className="px-2 pt-2 space-y-3">
        <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]" /><h2 className="text-[9px] font-black uppercase tracking-[0.4em] text-blue-500/90">Notification Center</h2></div>
        <h3 className="text-4xl font-black tracking-tight text-white uppercase italic leading-none">Price <span className="text-blue-500">Alert</span></h3>
      </header>

      <div className="bg-[#1c1c1e] p-8 rounded-[3.5rem] border border-white/5 space-y-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[50px] pointer-events-none" />
        <div className="space-y-2 relative z-10">
          <h4 className="text-lg font-black uppercase italic tracking-tight text-white">Smart Monitor</h4>
          <p className="text-xs text-[#8e8e93] font-medium leading-relaxed">Configura una soglia di prezzo. Riceverai una notifica quando il mercato raggiunge il tuo target.</p>
        </div>
        <div className="space-y-6 relative z-10">
          <div className="flex bg-black/40 rounded-[2.5rem] p-6 justify-between items-center border border-white/5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-blue-500/10 rounded-[1.5rem] flex items-center justify-center text-blue-500 border border-blue-500/20 font-black text-xl shadow-lg">{p.selectedFuel[0]}</div>
              <div><span className="font-black uppercase italic tracking-tighter text-white">{p.selectedFuel}</span><div className="text-[8px] font-black text-blue-500/60 uppercase tracking-widest">Carburante Attivo</div></div>
            </div>
            <div className="text-right">
              <div className="text-[8px] text-[#48484a] font-black uppercase tracking-widest mb-1">Target €/L</div>
              <input type="number" step="0.001" placeholder="1.750" className="bg-transparent text-3xl font-black text-blue-500 w-28 text-right outline-none placeholder:text-blue-900/30" id="alert-price-input" />
            </div>
          </div>
          <button onClick={() => {
            const inp = document.getElementById('alert-price-input') as HTMLInputElement;
            const val = parseFloat(inp?.value || '1.75');
            p.setAlerts(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), fuelType: p.selectedFuel, threshold: val, active: true }]);
          }} className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-[2.5rem] shadow-[0_15px_40px_rgba(37,99,235,0.2)] active:scale-95 transition-all text-xs uppercase tracking-[0.3em] italic">Inizia Monitoraggio</button>
        </div>
      </div>

      <div className="space-y-6 px-2">
        <div className="flex items-center justify-between"><h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#48484a]">Alert Attivi</h3><div className="h-px flex-1 bg-white/5 ml-4" /></div>
        {p.alerts.length === 0 ? (
          <div className="p-16 text-center space-y-4 bg-[#1c1c1e]/40 rounded-[3rem] border border-white/5 opacity-40 italic"><BellOff size={40} className="mx-auto text-[#48484a]" /><p className="text-[10px] font-black uppercase tracking-widest text-[#48484a]">Nessun alert attivo</p></div>
        ) : (
          <div className="grid gap-4">
            {p.alerts.map(a => (
              <div key={a.id} className="group bg-[#1c1c1e] p-6 rounded-[2.5rem] border border-white/5 hover:border-blue-500/20 transition-all flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-5">
                  <div className={cn("w-3 h-3 rounded-full", a.active ? "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]" : "bg-[#48484a]")} />
                  <div><div className="text-sm font-black text-white uppercase italic tracking-tight">{a.fuelType}</div><div className="text-[10px] text-[#8e8e93] font-bold uppercase tracking-widest mt-0.5 italic">Target: <span className="text-white">€{a.threshold.toFixed(3)}</span></div></div>
                </div>
                <button onClick={() => p.setAlerts(prev => prev.filter(al => al.id !== a.id))} className="p-3 bg-white/5 hover:bg-red-500/10 rounded-2xl text-[#48484a] hover:text-red-500 border border-transparent hover:border-red-500/20"><X size={18} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

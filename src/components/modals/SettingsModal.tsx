import { motion, AnimatePresence } from 'motion/react';
import { X, Zap, Info } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Props {
  show: boolean; setShow: (v: boolean) => void;
  apiKey: string; setApiKey: (v: string) => void;
  apiModel: string; setApiModel: (v: string) => void;
}

const MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', speed: 'Consigliato' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', speed: 'Analisi profonda' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite', speed: 'Rapido e leggero' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', speed: 'Compatibile' },
  { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash-Lite', speed: 'Economico' },
];

export function SettingsModal(p: Props) {
  return (
    <AnimatePresence>
      {p.show && (
        <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed inset-0 z-[60] flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => p.setShow(false)} />
          <div className="w-full max-w-md bg-[#1c1c1e] rounded-t-[3rem] border-t border-white/10 p-8 pt-4 space-y-8 relative z-10 max-h-[85vh] overflow-y-auto no-scrollbar">
            <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto" />
            <div className="flex justify-between items-center px-1">
              <h3 className="text-2xl font-bold text-white tracking-tight">Impostazioni <span className="text-blue-500">AI</span></h3>
              <button onClick={() => p.setShow(false)} className="p-2.5 bg-white/5 rounded-full text-[#8e8e93] hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <section className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h4 className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-[0.2em]">Google Gemini API</h4>
                {p.apiKey ? (
                  <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 shadow-sm">ACTIVE</span>
                ) : (
                  <span className="text-[9px] font-bold text-red-400 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20 shadow-sm">MISSING</span>
                )}
              </div>
              <div className="relative group">
                <input 
                  type="password" 
                  value={p.apiKey} 
                  onChange={e => { p.setApiKey(e.target.value); localStorage.setItem('martucc_fuel_api_key', e.target.value); }} 
                  placeholder="Inserisci la tua API Key..." 
                  className="w-full bg-[#09090b] border border-white/5 rounded-[24px] p-5 pl-6 text-[15px] text-white focus:border-blue-500/50 outline-none pr-12 transition-all shadow-inner group-hover:border-white/10" 
                />
                <Zap size={20} className="absolute right-5 top-1/2 -translate-y-1/2 text-blue-500 opacity-30 group-focus-within:opacity-100 transition-opacity" />
              </div>
              <div className="bg-[#0c111d] border border-blue-500/10 rounded-[32px] p-6 space-y-4 shadow-xl">
                <div className="flex items-center gap-3 text-blue-400">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Info size={16} />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-widest">Guida Rapida</span>
                </div>
                <div className="text-[13px] text-[#8e8e93] font-medium leading-relaxed space-y-3">
                  <p>1. Ottieni la chiave su <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-blue-500 underline decoration-blue-500/30 underline-offset-4">Google AI Studio</a></p>
                  <p>2. Incolla il codice nel campo sopra per attivare l'analisi avanzata.</p>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h4 className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-[0.2em] px-1">Seleziona Modello</h4>
              <div className="grid grid-cols-1 gap-2.5 px-0.5">
                {MODELS.map(m => (
                  <button 
                    key={m.id} 
                    onClick={() => { p.setApiModel(m.id); localStorage.setItem('martucc_fuel_api_model', m.id); }} 
                    className={cn(
                      "flex items-center justify-between p-4.5 rounded-[24px] transition-all border px-6", 
                      p.apiModel === m.id 
                        ? "bg-white text-black border-white shadow-[0_10px_25px_rgba(255,255,255,0.1)]" 
                        : "bg-[#09090b] text-[#8e8e93] border-white/5 hover:border-white/10"
                    )}
                  >
                    <div className="flex-1">
                      <div className="font-bold text-[14px] tracking-tight">{m.label}</div>
                      <div className={cn("text-[10px] font-medium mt-0.5", p.apiModel === m.id ? "text-black/60" : "text-[#8e8e93]/60")}>{m.speed}</div>
                    </div>
                    {p.apiModel === m.id && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                  </button>
                ))}
              </div>
            </section>

            <div className="flex gap-4 pt-6 pb-10 px-1">
              <button 
                onClick={() => { p.setApiKey(''); p.setApiModel('gemini-2.5-flash'); localStorage.removeItem('martucc_fuel_api_key'); localStorage.removeItem('martucc_fuel_api_model'); }} 
                className="flex-1 py-4.5 bg-white/5 text-red-400 font-bold rounded-full text-[12px] uppercase tracking-widest border border-white/5 hover:bg-red-500/5 transition-all"
              >
                Reset
              </button>
              <button 
                onClick={() => { p.setShow(false); window.location.reload(); }} 
                className="flex-[2] py-4.5 bg-white text-black font-bold rounded-full shadow-2xl active:scale-95 transition-all text-[12px] uppercase tracking-widest"
              >
                Salva
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

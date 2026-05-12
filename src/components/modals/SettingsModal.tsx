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
            <div className="flex justify-between items-center"><h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">Configurazione AI</h3><button onClick={() => p.setShow(false)} className="p-3 bg-white/5 rounded-full text-white"><X size={20} /></button></div>
            <section className="space-y-4">
              <div className="flex items-center justify-between px-1"><h4 className="text-[11px] font-black text-[#8e8e93] uppercase tracking-[0.2em]">Google Gemini Key</h4>{p.apiKey ? <span className="text-[8px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">CONFIGURATA</span> : <span className="text-[8px] font-black text-red-500 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">MANCANTE</span>}</div>
              <div className="relative"><input type="password" value={p.apiKey} onChange={e => { p.setApiKey(e.target.value); localStorage.setItem('martucc_fuel_api_key', e.target.value); }} placeholder="Inserisci la tua API Key..." className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm text-white focus:border-blue-500 outline-none pr-12" /><Zap size={18} className="absolute right-4 top-4 text-[#3a3a3c]" /></div>
              <div className="bg-blue-600/5 border border-blue-500/20 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-blue-400"><Info size={14} /><span className="text-[10px] font-black uppercase tracking-widest">Come ottenere la chiave?</span></div>
                <ol className="text-[10px] text-[#8e8e93] font-medium space-y-1 ml-4 list-decimal"><li>Vai su <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-blue-500 underline">Google AI Studio</a></li><li>Accedi con il tuo account Google</li><li>Clicca su "Get API key" nella barra laterale</li><li>Crea una chiave e incollala qui sopra</li></ol>
              </div>
            </section>
            <section className="space-y-4">
              <h4 className="text-[11px] font-black text-[#8e8e93] uppercase tracking-[0.2em] px-1">Seleziona Modello</h4>
              <div className="grid grid-cols-1 gap-2 max-h-[30vh] overflow-y-auto no-scrollbar">
                {MODELS.map(m => (
                  <button key={m.id} onClick={() => { p.setApiModel(m.id); localStorage.setItem('martucc_fuel_api_model', m.id); }} className={cn("flex items-center justify-between p-4 rounded-2xl text-xs font-bold transition-all border text-left", p.apiModel === m.id ? "bg-blue-600/10 text-white border-blue-500/30" : "bg-white/5 text-[#8e8e93] border-white/5 hover:bg-white/10")}>
                    <div className="flex-1"><div className="font-black italic uppercase tracking-tight truncate max-w-[180px]">{m.label}</div><div className="text-[9px] opacity-60 font-bold">{m.speed}</div></div>
                    {p.apiModel === m.id && <Zap size={14} className="text-blue-500 flex-shrink-0" />}
                  </button>
                ))}
              </div>
            </section>
            <div className="flex gap-4 pt-4 pb-12">
              <button onClick={() => { p.setApiKey(''); p.setApiModel('gemini-2.5-flash'); localStorage.removeItem('martucc_fuel_api_key'); localStorage.removeItem('martucc_fuel_api_model'); }} className="flex-1 py-5 bg-white/5 text-red-500 font-black rounded-3xl text-xs uppercase tracking-widest">Reset</button>
              <button onClick={() => { p.setShow(false); window.location.reload(); }} className="flex-[2] py-5 bg-blue-600 text-white font-black rounded-3xl shadow-2xl shadow-blue-900/30 active:scale-95 transition-all text-xs uppercase tracking-widest">Salva e Ricarica</button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

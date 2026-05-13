import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, BellOff, X, TrendingUp, Flame, Fuel, AlertCircle, Send, Plus, Target, CalendarClock, Wallet } from 'lucide-react';
import type { FuelType, Alert } from '../../types';
import {
  loadPrefs, savePrefs, requestPermission, permissionState, fireTest,
  type NotifPrefs, type NotifCategory,
} from '../../services/notificationService';

interface Props {
  selectedFuel: FuelType;
  alerts: Alert[];
  setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>;
}

const FUELS: FuelType[] = ['Benzina', 'Diesel', 'GPL', 'Metano'];

function autoPrice(v: string): string {
  if (/[.,]/.test(v)) return v;
  const digits = v.replace(/\D/g, '');
  if (digits.length === 0) return '';
  if (digits.length === 1) return digits;
  return digits[0] + '.' + digits.slice(1, 4);
}

const CATEGORIES: { id: NotifCategory; icon: any; label: string; desc: string }[] = [
  { id: 'priceThresholds', icon: Target, label: 'Soglia prezzo', desc: 'Avviso quando un carburante scende sotto la soglia che imposti' },
  { id: 'dailyTrend', icon: TrendingUp, label: 'Andamento giornaliero', desc: 'Notifica una volta al giorno con variazione % vs ieri' },
  { id: 'bestDealZone', icon: Flame, label: 'Offerte in zona', desc: 'Quando una stazione è almeno -4% sotto la media nazionale' },
  { id: 'pienoReminder', icon: Fuel, label: 'Promemoria pieno', desc: 'Stima quando il serbatoio è probabilmente in riserva (richiede storico pieni)' },
  { id: 'deadlineReminder', icon: CalendarClock, label: 'Scadenze veicolo', desc: 'Revisione, bollo, assicurazione: avviso a 30, 7 e 1 giorno dalla scadenza' },
  { id: 'budgetAlert', icon: Wallet, label: 'Budget mensile', desc: 'Avviso al 75%, 90% e superamento del budget carburante del mese' },
];

export function AlertsTab({ selectedFuel, alerts, setAlerts }: Props) {
  const [prefs, setPrefs] = useState<NotifPrefs>(() => loadPrefs());
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>(() => permissionState());
  const [thresholdInput, setThresholdInput] = useState('1.750');
  const [thresholdFuel, setThresholdFuel] = useState<FuelType>(selectedFuel);

  useEffect(() => { setThresholdFuel(selectedFuel); }, [selectedFuel]);

  useEffect(() => {
    const h = () => setPrefs(loadPrefs());
    window.addEventListener('mf-notif-prefs', h);
    return () => window.removeEventListener('mf-notif-prefs', h);
  }, []);

  const updatePrefs = (patch: Partial<NotifPrefs> | ((p: NotifPrefs) => Partial<NotifPrefs>)) => {
    setPrefs(prev => {
      const p = typeof patch === 'function' ? patch(prev) : patch;
      const next = { ...prev, ...p };
      savePrefs(next);
      return next;
    });
  };

  const toggleMaster = async () => {
    if (!prefs.enabled) {
      const res = await requestPermission();
      setPerm(res);
      if (res === 'granted') {
        updatePrefs({ enabled: true });
        await fireTest();
      } else {
        updatePrefs({ enabled: false });
      }
    } else {
      updatePrefs({ enabled: false });
    }
  };

  const toggleCategory = (id: NotifCategory) => {
    updatePrefs(p => ({ categories: { ...p.categories, [id]: !p.categories[id] } }));
  };

  const addThreshold = () => {
    const v = parseFloat(thresholdInput.replace(',', '.'));
    if (!isFinite(v) || v <= 0) return;
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    setAlerts(prev => [...prev, { id, fuelType: thresholdFuel, threshold: v, active: true }]);
  };

  const toggleAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, active: !a.active } : a));
  };

  const removeAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const denied = perm === 'denied';
  const unsupported = perm === 'unsupported';
  const masterDisabled = unsupported;

  return (
    <motion.div key="alerts" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="space-y-6 pb-24">
      <header className="px-2 pt-2 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] animate-pulse" />
          <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500/90">Notification Center</h2>
        </div>
        <h3 className="text-4xl font-black tracking-tighter text-white uppercase italic leading-none">Le tue <span className="text-blue-500">Notifiche</span></h3>
      </header>

      <div className="bg-[#0a0f1d] p-6 sm:p-8 rounded-[36px] sm:rounded-[48px] border border-blue-500/30 space-y-5 relative overflow-hidden shadow-2xl">
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-blue-600/10 blur-[100px] pointer-events-none rounded-full" />

        <div className="flex items-center justify-between gap-4 relative z-10">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              {prefs.enabled ? <Bell size={16} className="text-blue-400" /> : <BellOff size={16} className="text-[#8e8e93]" />}
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Stato</div>
            </div>
            <div className="text-xl sm:text-2xl font-black italic uppercase tracking-tighter text-white">
              {prefs.enabled ? 'Notifiche attive' : 'Notifiche spente'}
            </div>
            <div className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-widest mt-1 leading-snug">
              {unsupported ? 'Browser non supporta le notifiche' : denied ? 'Permesso negato dal browser — riabilita nelle impostazioni del sito' : prefs.enabled ? 'Riceverai avvisi in base alle categorie scelte' : 'Attiva per ricevere avvisi prezzo e trend'}
            </div>
          </div>
          <button
            onClick={toggleMaster}
            disabled={masterDisabled || denied}
            className={`relative w-16 h-9 rounded-full transition-colors flex-shrink-0 ${
              prefs.enabled ? 'bg-blue-600 shadow-[0_0_24px_rgba(37,99,235,0.4)]' : 'bg-white/10'
            } ${masterDisabled || denied ? 'opacity-40 cursor-not-allowed' : ''}`}
            aria-label="Toggle notifiche"
          >
            <div className={`absolute top-0.5 w-8 h-8 rounded-full bg-white shadow-lg transition-all ${prefs.enabled ? 'left-[30px]' : 'left-0.5'}`} />
          </button>
        </div>

        {denied && (
          <div className="relative z-10 flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-[20px]">
            <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] font-bold text-red-300 leading-relaxed">
              Hai negato il permesso. Vai nelle impostazioni del browser per questo sito e riabilita le notifiche, poi ricarica la pagina.
            </div>
          </div>
        )}

        {prefs.enabled && (
          <button
            onClick={fireTest}
            className="relative z-10 w-full flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 active:scale-[0.98] rounded-full text-[11px] font-black uppercase tracking-widest text-white border border-white/10 transition-all"
          >
            <Send size={14} /> Invia notifica di prova
          </button>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3 px-2">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#48484a]">Categorie</h3>
          <div className="h-px flex-1 bg-white/5" />
        </div>

        <div className="space-y-3">
          {CATEGORIES.map(c => {
            const Icon = c.icon;
            const on = prefs.categories[c.id];
            const disabled = !prefs.enabled;
            return (
              <button
                key={c.id}
                onClick={() => !disabled && toggleCategory(c.id)}
                disabled={disabled}
                className={`w-full flex items-center gap-4 p-5 rounded-[28px] border transition-all text-left ${
                  disabled
                    ? 'bg-[#0a0f1d]/40 border-white/5 opacity-40 cursor-not-allowed'
                    : on
                      ? 'bg-[#0a0f1d] border-blue-500/30 shadow-[0_0_20px_rgba(37,99,235,0.12)]'
                      : 'bg-[#0a0f1d] border-white/5 hover:border-white/15'
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 border ${
                  on && !disabled
                    ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                    : 'bg-white/5 border-white/10 text-[#8e8e93]'
                }`}>
                  <Icon size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-black uppercase italic tracking-tight text-white">{c.label}</div>
                  <div className="text-[11px] font-bold text-[#8e8e93] tracking-tight mt-0.5 leading-snug">{c.desc}</div>
                </div>
                <div className={`relative w-12 h-7 rounded-full flex-shrink-0 transition-colors ${on && !disabled ? 'bg-blue-600' : 'bg-white/10'}`}>
                  <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-lg transition-all ${on && !disabled ? 'left-[22px]' : 'left-0.5'}`} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {prefs.categories.priceThresholds && prefs.enabled && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-3 px-2">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#48484a]">Soglie Prezzo</h3>
              <div className="h-px flex-1 bg-white/5" />
            </div>

            <div className="bg-[#0a0f1d] p-5 sm:p-6 rounded-[28px] border border-white/5 space-y-4 shadow-xl">
              <div className="grid grid-cols-4 gap-2">
                {FUELS.map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setThresholdFuel(f)}
                    className={`py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                      thresholdFuel === f
                        ? 'bg-blue-600 text-white border-blue-400/40 shadow-[0_0_16px_rgba(37,99,235,0.4)]'
                        : 'bg-white/5 text-[#8e8e93] border-white/10 hover:text-white'
                    }`}
                  >
                    {f === 'Benzina' ? 'Benz' : f === 'Metano' ? 'Met' : f}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-black/40 rounded-[20px] border border-white/5 focus-within:border-blue-500/40 px-4 py-3">
                  <div className="text-[9px] font-black text-[#8e8e93] uppercase tracking-[0.25em] mb-0.5">Avvisami se scende sotto</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-blue-400 text-[15px] font-black">€</span>
                    <input
                      inputMode="decimal"
                      value={thresholdInput}
                      onChange={e => setThresholdInput(autoPrice(e.target.value))}
                      placeholder="1.750"
                      className="flex-1 bg-transparent text-white text-[20px] font-black tracking-tighter outline-none tabular-nums placeholder:text-[#48484a]"
                    />
                    <span className="text-[10px] font-black text-[#8e8e93] uppercase tracking-widest">/L</span>
                  </div>
                </div>
                <button
                  onClick={addThreshold}
                  className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 flex items-center justify-center text-white border border-blue-400/40 shadow-[0_0_24px_rgba(37,99,235,0.4)]"
                  aria-label="Aggiungi soglia"
                >
                  <Plus size={20} strokeWidth={3} />
                </button>
              </div>

              {alerts.length === 0 ? (
                <div className="py-6 text-center">
                  <div className="text-[10px] font-black text-[#48484a] uppercase tracking-widest">Nessuna soglia impostata</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.map(a => (
                    <div key={a.id} className="bg-black/40 p-3.5 rounded-[20px] border border-white/5 flex items-center gap-3">
                      <button
                        onClick={() => toggleAlert(a.id)}
                        className={`w-9 h-5 rounded-full flex-shrink-0 relative transition-colors ${a.active ? 'bg-emerald-500' : 'bg-white/10'}`}
                        aria-label="Attiva/disattiva"
                      >
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${a.active ? 'left-[18px]' : 'left-0.5'}`} />
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-black uppercase italic tracking-tight text-white">{a.fuelType}</div>
                        <div className="text-[10px] font-bold text-[#8e8e93] uppercase tracking-widest mt-0.5">
                          Soglia: <span className="text-white tabular-nums">€{a.threshold.toFixed(3)}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => removeAlert(a.id)}
                        className="w-8 h-8 rounded-full bg-white/5 hover:bg-red-500/15 active:scale-90 flex items-center justify-center text-[#8e8e93] hover:text-red-400 border border-white/10 hover:border-red-500/30 flex-shrink-0"
                        aria-label="Elimina"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-2">
        <div className="text-[10px] font-bold text-[#48484a] uppercase tracking-widest leading-relaxed text-center">
          Le notifiche vengono inviate solo quando l'app è aperta o in background recente.<br/>
          Per ricevere avvisi sempre, aggiungi l'app alla home screen.
        </div>
      </div>
    </motion.div>
  );
}

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calculator, Euro, Droplet, Route, Fuel } from 'lucide-react';
import type { FuelType } from '../types';

interface Props {
  show: boolean;
  onClose: () => void;
  fuel: FuelType;
  defaultPrice: number;
  carKml?: number;
  tankL?: number;
}

const fmt2 = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = (n: number) => Math.round(n).toLocaleString('it-IT');

const QUICK_BUDGETS = [10, 20, 30, 50];

export function BudgetCalcModal({ show, onClose, fuel, defaultPrice, carKml, tankL }: Props) {
  const [budget, setBudget] = useState<string>('20');
  const [priceOverride, setPriceOverride] = useState<string>('');

  const price = useMemo(() => {
    const p = parseFloat(priceOverride.replace(',', '.'));
    if (isFinite(p) && p > 0) return p;
    return defaultPrice > 0 ? defaultPrice : 1.8;
  }, [priceOverride, defaultPrice]);

  const budgetN = useMemo(() => parseFloat(budget.replace(',', '.')) || 0, [budget]);

  const liters = price > 0 ? budgetN / price : 0;
  const kmRange = carKml ? liters * carKml : null;
  const tankPct = tankL ? Math.min(1, liters / tankL) : null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            onClick={e => e.stopPropagation()}
            className="bg-[#0a0f1d] w-full sm:max-w-lg sm:rounded-[40px] rounded-t-[40px] border border-blue-500/30 shadow-2xl max-h-[92vh] overflow-y-auto no-scrollbar relative"
          >
            <div className="absolute -top-20 -left-20 w-80 h-80 bg-blue-600/10 blur-[100px] pointer-events-none rounded-full" />

            <div className="sticky top-0 z-10 bg-[#0a0f1d]/95 backdrop-blur-xl border-b border-white/5 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0">
                  <Calculator size={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Calcolatore</div>
                  <div className="text-xl font-black italic uppercase tracking-tighter text-white">Metti €X</div>
                </div>
              </div>
              <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#8e8e93] border border-white/10 flex-shrink-0">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5 relative">
              <div className="bg-black/40 rounded-[24px] border border-blue-500/20 p-5 shadow-inner">
                <div className="flex items-center gap-2 mb-3">
                  <Euro size={14} className="text-blue-400" />
                  <div className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">Quanto vuoi spendere</div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-blue-400 text-[28px] font-black">€</span>
                  <input
                    inputMode="decimal"
                    value={budget}
                    onChange={e => setBudget(e.target.value)}
                    placeholder="20"
                    className="flex-1 bg-transparent text-white text-[44px] font-black italic tracking-tighter outline-none tabular-nums placeholder:text-[#48484a] min-w-0"
                  />
                </div>
                <div className="flex gap-2 mt-4">
                  {QUICK_BUDGETS.map(v => (
                    <button
                      key={v}
                      onClick={() => setBudget(String(v))}
                      className={`flex-1 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                        budgetN === v
                          ? 'bg-blue-600 text-white border-blue-400/40 shadow-[0_0_16px_rgba(37,99,235,0.4)]'
                          : 'bg-white/5 text-[#8e8e93] border-white/10 hover:text-white'
                      }`}
                    >
                      €{v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gradient-to-br from-blue-600/20 to-blue-600/5 backdrop-blur-xl p-5 rounded-[24px] border border-blue-500/30 shadow-[0_0_24px_rgba(37,99,235,0.15)] min-w-0 relative overflow-hidden">
                  <Droplet size={14} className="text-blue-400 mb-2" />
                  <div className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1">Litri</div>
                  <div className="text-3xl sm:text-4xl font-black italic text-white tracking-tighter tabular-nums truncate">{fmt2(liters)}</div>
                  <div className="text-[10px] font-bold text-[#8e8e93] uppercase tracking-widest mt-1">{fuel}</div>
                </div>

                <div className="bg-black/40 backdrop-blur-xl p-5 rounded-[24px] border border-white/5 shadow-inner min-w-0 relative overflow-hidden">
                  <Route size={14} className="text-blue-400 mb-2" />
                  <div className="text-[10px] font-black text-[#8e8e93] uppercase tracking-[0.2em] mb-1">Autonomia</div>
                  <div className="text-3xl sm:text-4xl font-black italic text-white tracking-tighter tabular-nums truncate">
                    {kmRange != null ? fmt0(kmRange) : '—'}
                    {kmRange != null && <span className="text-sm ml-1 text-[#8e8e93]">km</span>}
                  </div>
                  <div className="text-[10px] font-bold text-[#8e8e93] uppercase tracking-widest mt-1">{carKml ? `${carKml} km/L` : 'Manca veicolo'}</div>
                </div>
              </div>

              {tankPct != null && (
                <div className="bg-black/40 p-4 rounded-[20px] border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2"><Fuel size={12} className="text-[#8e8e93]" /><span className="text-[10px] font-black text-[#8e8e93] uppercase tracking-widest">Serbatoio coperto</span></div>
                    <span className="text-[12px] font-black italic text-white tabular-nums">{Math.round(tankPct * 100)}%</span>
                  </div>
                  <div className="h-2 bg-black/50 rounded-full overflow-hidden border border-white/5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${tankPct * 100}%` }}
                      transition={{ duration: 0.5 }}
                      className="h-full bg-blue-500 shadow-[0_0_12px_rgba(96,165,250,0.6)]"
                    />
                  </div>
                </div>
              )}

              <div className="bg-black/40 rounded-[20px] border border-white/5 p-4">
                <div className="text-[10px] font-black text-[#8e8e93] uppercase tracking-[0.25em] mb-2">Prezzo usato (€/L)</div>
                <div className="flex items-center gap-3">
                  <span className="text-blue-400 text-[15px] font-black">€</span>
                  <input
                    inputMode="decimal"
                    value={priceOverride}
                    onChange={e => setPriceOverride(e.target.value)}
                    placeholder={defaultPrice > 0 ? defaultPrice.toFixed(3) : '1.800'}
                    className="flex-1 bg-transparent text-white text-[18px] font-bold tracking-tight outline-none tabular-nums placeholder:text-[#48484a] min-w-0"
                  />
                  {priceOverride && (
                    <button onClick={() => setPriceOverride('')} className="text-[10px] font-black text-[#8e8e93] hover:text-white uppercase tracking-widest">Reset</button>
                  )}
                </div>
                <div className="text-[9px] font-bold text-[#48484a] uppercase tracking-widest mt-1.5">
                  {priceOverride ? 'Prezzo personalizzato' : `Media nazionale ${fuel}`}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

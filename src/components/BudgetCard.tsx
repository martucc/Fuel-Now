import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, Edit3, X, TrendingUp, Target } from 'lucide-react';
import { computeBudget, loadBudget, saveBudget, type BudgetView } from '../services/budgetService';

interface Props {
  carModel: string;
}

const fmtEUR = (n: number) => '€' + n.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtEURFine = (n: number) => '€' + n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function BudgetCard({ carModel }: Props) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [view, setView] = useState<BudgetView | null>(() => computeBudget(carModel));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setView(computeBudget(carModel));
  }, [carModel, refreshKey]);

  useEffect(() => {
    const h = () => setRefreshKey(k => k + 1);
    window.addEventListener('mf-fillup-changed', h);
    window.addEventListener('mf-expenses-changed', h);
    window.addEventListener('mf-budget-changed', h);
    return () => {
      window.removeEventListener('mf-fillup-changed', h);
      window.removeEventListener('mf-expenses-changed', h);
      window.removeEventListener('mf-budget-changed', h);
    };
  }, []);

  if (!view) {
    return (
      <>
        <div className="bg-[#0a0f1d] p-6 rounded-[36px] border border-white/5 flex items-center justify-between gap-3 shadow-xl">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0">
              <Target size={20} />
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-black uppercase italic tracking-tight text-white">Budget mensile</div>
              <div className="text-[10px] font-bold text-[#8e8e93] uppercase tracking-widest mt-0.5">Definisci una soglia di spesa</div>
            </div>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 rounded-full text-[10px] font-black uppercase tracking-widest text-white border border-blue-400/30 shadow-[0_0_16px_rgba(37,99,235,0.3)] transition-all flex-shrink-0"
          >Imposta</button>
        </div>
        <AnimatePresence>
          {editing && <BudgetSheet onClose={() => setEditing(false)} />}
        </AnimatePresence>
      </>
    );
  }

  const accent = view.status === 'over' ? 'red' : view.status === 'warn' ? 'amber' : 'blue';
  const accentMap = {
    red: { text: 'text-red-400', bar: 'bg-red-500', glow: 'shadow-[0_0_24px_rgba(239,68,68,0.25)]', border: 'border-red-500/40' },
    amber: { text: 'text-amber-400', bar: 'bg-amber-500', glow: 'shadow-[0_0_24px_rgba(245,158,11,0.2)]', border: 'border-amber-500/40' },
    blue: { text: 'text-blue-400', bar: 'bg-blue-500', glow: 'shadow-[0_0_24px_rgba(37,99,235,0.18)]', border: 'border-blue-500/30' },
  };
  const a = accentMap[accent];
  const pctCapped = Math.min(150, view.pct);
  const overshoot = view.pct > 100 ? view.pct - 100 : 0;
  const projDelta = view.projection > view.budget;

  return (
    <>
      <div className={`bg-[#0a0f1d] p-6 sm:p-8 rounded-[36px] sm:rounded-[48px] border ${a.border} space-y-5 relative overflow-hidden ${a.glow}`}>
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-blue-600/10 blur-[100px] pointer-events-none rounded-full" />

        <div className="flex items-start justify-between gap-3 relative z-10">
          <div className="min-w-0 flex-1">
            <div className={`flex items-center gap-2 ${a.text} mb-2`}>
              <Wallet size={14} />
              <div className="text-[10px] font-black uppercase tracking-[0.3em]">Budget Mensile</div>
            </div>
            <div className="text-3xl sm:text-4xl font-black italic tracking-tighter text-white tabular-nums">
              {fmtEURFine(view.spent)}<span className="text-base text-[#8e8e93] ml-1">/ {fmtEUR(view.budget)}</span>
            </div>
            <div className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-widest mt-1">
              {view.includeOther ? `${fmtEURFine(view.spentFuel)} carb · ${fmtEURFine(view.spentOther)} altro` : 'Solo carburante'}
            </div>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 flex items-center justify-center text-[#8e8e93] border border-white/10 flex-shrink-0"
            aria-label="Modifica budget"
          ><Edit3 size={14} /></button>
        </div>

        <div className="relative z-10 space-y-2">
          <div className="h-3 bg-black/50 rounded-full overflow-hidden border border-white/5 relative">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, pctCapped)}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className={`h-full ${a.bar} shadow-[0_0_12px_rgba(96,165,250,0.5)] rounded-full`}
            />
            {overshoot > 0 && (
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(50, overshoot)}%` }}
                transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
                className="absolute top-0 right-0 h-full bg-red-600 rounded-r-full opacity-80"
              />
            )}
          </div>
          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
            <span className={a.text + ' tabular-nums'}>{Math.round(view.pct)}% usato</span>
            <span className="text-[#8e8e93] tabular-nums">{view.daysLeft} giorni rimasti</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 relative z-10">
          <div className="bg-black/40 p-4 rounded-[20px] border border-white/5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <TrendingUp size={11} className={projDelta ? 'text-red-400' : 'text-emerald-400'} />
              <span className="text-[9px] font-black text-[#8e8e93] uppercase tracking-[0.2em] truncate">Proiezione mese</span>
            </div>
            <div className={`text-[18px] font-black italic tracking-tighter tabular-nums truncate ${projDelta ? 'text-red-400' : 'text-emerald-400'}`}>
              {fmtEURFine(view.projection)}
            </div>
            <div className="text-[9px] font-bold text-[#8e8e93] uppercase tracking-widest mt-1">
              {projDelta ? `+${fmtEURFine(view.projection - view.budget)} sopra` : `${fmtEURFine(view.budget - view.projection)} margine`}
            </div>
          </div>
          <div className="bg-black/40 p-4 rounded-[20px] border border-white/5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Target size={11} className="text-blue-400" />
              <span className="text-[9px] font-black text-[#8e8e93] uppercase tracking-[0.2em] truncate">Rimangono</span>
            </div>
            <div className={`text-[18px] font-black italic tracking-tighter tabular-nums truncate ${view.budget - view.spent < 0 ? 'text-red-400' : 'text-white'}`}>
              {fmtEURFine(Math.max(0, view.budget - view.spent))}
            </div>
            <div className="text-[9px] font-bold text-[#8e8e93] uppercase tracking-widest mt-1">
              ~{view.daysLeft > 0 ? fmtEURFine((view.budget - view.spent) / view.daysLeft) : '—'}/giorno
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {editing && <BudgetSheet onClose={() => setEditing(false)} />}
      </AnimatePresence>
    </>
  );
}

function BudgetSheet({ onClose }: { onClose: () => void }) {
  const current = loadBudget();
  const [amount, setAmount] = useState(current.monthly > 0 ? String(current.monthly) : '');
  const [includeOther, setIncludeOther] = useState(current.includeOther);

  const amountN = parseFloat(amount.replace(',', '.')) || 0;

  const handleSave = () => {
    saveBudget({ monthly: Math.max(0, amountN), includeOther });
    onClose();
  };

  const handleDisable = () => {
    saveBudget({ monthly: 0, includeOther: false });
    onClose();
  };

  return (
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
              <Wallet size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Budget</div>
              <div className="text-xl font-black italic uppercase tracking-tighter text-white">Soglia mensile</div>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#8e8e93] border border-white/10 flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5 relative">
          <div className="bg-black/40 rounded-[24px] border border-blue-500/20 p-5 shadow-inner">
            <div className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mb-3">Importo mensile</div>
            <div className="flex items-baseline gap-2">
              <span className="text-blue-400 text-[28px] font-black">€</span>
              <input
                inputMode="decimal"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="200"
                className="flex-1 bg-transparent text-white text-[44px] font-black italic tracking-tighter outline-none tabular-nums placeholder:text-[#48484a] min-w-0"
              />
            </div>
            <div className="flex gap-2 mt-4">
              {[100, 150, 200, 300].map(v => (
                <button
                  key={v}
                  onClick={() => setAmount(String(v))}
                  className={`flex-1 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                    amountN === v
                      ? 'bg-blue-600 text-white border-blue-400/40 shadow-[0_0_16px_rgba(37,99,235,0.4)]'
                      : 'bg-white/5 text-[#8e8e93] border-white/10 hover:text-white'
                  }`}
                >€{v}</button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIncludeOther(v => !v)}
            className="w-full flex items-center justify-between p-4 bg-black/40 rounded-[20px] border border-white/5 hover:border-blue-500/30 transition-all"
          >
            <div className="text-left">
              <div className="text-[13px] font-black text-white uppercase italic tracking-tight">Includi altre spese</div>
              <div className="text-[10px] font-bold text-[#8e8e93] uppercase tracking-widest opacity-70 mt-0.5">Bollo, assicurazione, manutenzione, ecc.</div>
            </div>
            <div className={`relative w-12 h-7 rounded-full flex-shrink-0 transition-colors ${includeOther ? 'bg-blue-600' : 'bg-white/10'}`}>
              <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-lg transition-all ${includeOther ? 'left-[22px]' : 'left-0.5'}`} />
            </div>
          </button>

          <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-[20px]">
            <Wallet size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] font-bold text-blue-300 leading-relaxed">
              Notifiche al 75%, 90% e al superamento del budget (se le notifiche sono attive).
            </div>
          </div>

          <div className="flex gap-3">
            {current.monthly > 0 && (
              <button
                onClick={handleDisable}
                className="px-5 py-4 rounded-full text-[11px] font-black uppercase tracking-widest text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-all"
              >Disattiva</button>
            )}
            <button
              onClick={handleSave}
              disabled={amountN <= 0}
              className={`flex-1 py-4 rounded-full text-[12px] font-black uppercase tracking-widest transition-all border ${
                amountN > 0
                  ? 'bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white border-blue-400/40 shadow-[0_0_30px_rgba(37,99,235,0.4)]'
                  : 'bg-white/5 text-[#48484a] border-white/5 cursor-not-allowed'
              }`}
            >Salva Budget</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

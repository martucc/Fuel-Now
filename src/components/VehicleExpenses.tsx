import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, Plus, X, Trash2, Wrench, FileText, Shield, AlertTriangle, Coins, MoreHorizontal, Fuel, Calendar, Euro } from 'lucide-react';
import type { Expense, ExpenseType } from '../types';
import {
  addExpense, updateExpense, removeExpense, expensesForCar,
  computeCarSpend, EXPENSE_LABELS, CATEGORY_LABELS, type CategoryKey,
} from '../services/expensesService';

interface Props {
  carModel: string;
}

const TYPE_ICONS: Record<ExpenseType, any> = {
  manutenzione: Wrench,
  bollo: FileText,
  assicurazione: Shield,
  multa: AlertTriangle,
  pedaggio: Coins,
  altro: MoreHorizontal,
};

const CATEGORY_ICONS: Record<CategoryKey, any> = {
  fuel: Fuel,
  ...TYPE_ICONS,
};

const CATEGORY_COLORS: Record<CategoryKey, string> = {
  fuel: 'rgb(96,165,250)',
  manutenzione: 'rgb(168,85,247)',
  bollo: 'rgb(34,197,94)',
  assicurazione: 'rgb(245,158,11)',
  multa: 'rgb(239,68,68)',
  pedaggio: 'rgb(244,114,182)',
  altro: 'rgb(148,163,184)',
};

const fmtEUR = (n: number) => '€' + n.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtEURFine = (n: number) => '€' + n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });

export function VehicleExpenses({ carModel }: Props) {
  const [list, setList] = useState<Expense[]>(() => expensesForCar(carModel));
  const [refreshKey, setRefreshKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  useEffect(() => {
    setList(expensesForCar(carModel));
    setConfirmDel(null);
    setEditing(null);
  }, [carModel]);

  useEffect(() => {
    const h = () => setRefreshKey(k => k + 1);
    window.addEventListener('mf-fillup-changed', h);
    window.addEventListener('mf-expenses-changed', h);
    return () => {
      window.removeEventListener('mf-fillup-changed', h);
      window.removeEventListener('mf-expenses-changed', h);
    };
  }, []);

  const spend = useMemo(() => computeCarSpend(carModel, 12), [carModel, list, refreshKey]);

  const refresh = (next: Expense[]) => {
    setList(next.filter(e => e.carModel === carModel).sort((a, b) => b.date.localeCompare(a.date)));
  };

  const handleSave = (e: Omit<Expense, 'id'>) => {
    if (editing) refresh(updateExpense(editing.id, e));
    else refresh(addExpense(e));
    setOpen(false);
    setEditing(null);
  };

  const handleDel = (id: string) => {
    refresh(removeExpense(id));
    setConfirmDel(null);
  };

  const monthlyMax = Math.max(...spend.monthly.map(m => m.total), 1);
  const monthAvg = spend.monthly.filter(m => m.total > 0).length
    ? spend.total / spend.monthly.filter(m => m.total > 0).length
    : 0;

  const last = spend.monthly[spend.monthly.length - 1];
  const prev = spend.monthly[spend.monthly.length - 2];
  const monthDelta = (last && prev && prev.total > 0)
    ? ((last.total - prev.total) / prev.total) * 100
    : null;

  const validCats = (Object.keys(spend.byCategory) as CategoryKey[])
    .filter(k => spend.byCategory[k] > 0)
    .sort((a, b) => spend.byCategory[b] - spend.byCategory[a]);

  return (
    <div className="bg-[#0a0f1d] p-6 sm:p-8 rounded-[36px] sm:rounded-[48px] border border-blue-500/30 space-y-5 relative overflow-hidden shadow-2xl">
      <div className="absolute -top-20 -left-20 w-80 h-80 bg-blue-600/10 blur-[100px] pointer-events-none rounded-full" />

      <div className="flex items-center justify-between gap-3 relative z-10">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] animate-pulse" />
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500/90">Spese Auto</h2>
          </div>
          <h3 className="text-2xl sm:text-3xl font-black uppercase italic tracking-tighter text-white leading-none">
            Costo <span className="text-blue-500">Totale</span>
          </h3>
        </div>
        <button
          onClick={() => { setEditing(null); setOpen(true); }}
          className="flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 active:scale-95 rounded-full text-[11px] font-black uppercase tracking-widest text-white transition-all shadow-[0_0_24px_rgba(37,99,235,0.4)] border border-blue-400/30 flex-shrink-0"
        >
          <Plus size={16} strokeWidth={3} />
          <span className="hidden sm:inline">Spesa</span>
        </button>
      </div>

      {spend.total === 0 ? (
        <div className="relative z-10 py-10 flex flex-col items-center text-center gap-4">
          <div className="w-20 h-20 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
            <Wallet className="w-9 h-9 text-blue-400" />
          </div>
          <div>
            <div className="text-[15px] font-black text-white uppercase italic tracking-tight">Nessuna spesa</div>
            <div className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-widest mt-1 opacity-70 max-w-xs">Aggiungi bollo, assicurazione, manutenzione… il carburante viene già contato dai tuoi pieni</div>
          </div>
        </div>
      ) : (
        <>
          <div className="relative z-10 flex items-end justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400 mb-1">Totale 12 mesi</div>
              <div className="text-4xl sm:text-5xl font-black italic tracking-tighter text-white tabular-nums">{fmtEUR(spend.total)}</div>
              <div className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-widest mt-1">
                {fmtEURFine(spend.fuel)} carburante · {fmtEURFine(spend.others)} altro
              </div>
            </div>
            {monthDelta != null && (
              <div className={`flex flex-col items-end gap-0.5 flex-shrink-0 ${monthDelta <= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                <div className="text-[14px] font-black italic tabular-nums">{monthDelta >= 0 ? '+' : ''}{monthDelta.toFixed(0)}%</div>
                <div className="text-[9px] font-bold text-[#8e8e93] uppercase tracking-widest">vs mese prec.</div>
              </div>
            )}
          </div>

          <StackedMonthlyBars data={spend.monthly} max={monthlyMax} avg={monthAvg} />

          <div className="relative z-10 space-y-2">
            <div className="text-[10px] font-black text-[#8e8e93] uppercase tracking-[0.3em] px-2">Per categoria</div>
            {validCats.map(c => {
              const Icon = CATEGORY_ICONS[c];
              const val = spend.byCategory[c];
              const pct = (val / spend.total) * 100;
              return (
                <div key={c} className="bg-black/40 rounded-[20px] border border-white/5 p-3.5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border border-white/10" style={{ background: `${CATEGORY_COLORS[c]}20`, color: CATEGORY_COLORS[c] }}>
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="text-[13px] font-black uppercase italic tracking-tight text-white">{CATEGORY_LABELS[c]}</div>
                      <div className="text-[14px] font-black italic text-white tabular-nums tracking-tight">{fmtEURFine(val)}</div>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-black/50 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.5 }}
                          className="h-full rounded-full"
                          style={{ background: CATEGORY_COLORS[c] }}
                        />
                      </div>
                      <div className="text-[9px] font-black text-[#8e8e93] uppercase tracking-widest tabular-nums w-10 text-right">{pct.toFixed(0)}%</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {list.length > 0 && (
            <div className="relative z-10 space-y-2">
              <div className="text-[10px] font-black text-[#8e8e93] uppercase tracking-[0.3em] px-2">Cronologia spese</div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto no-scrollbar pr-1">
                {list.map(e => {
                  const Icon = TYPE_ICONS[e.type];
                  return (
                    <div
                      key={e.id}
                      onClick={() => confirmDel === null && (setEditing(e), setOpen(true))}
                      className="bg-black/40 rounded-[20px] border border-white/5 hover:border-blue-500/30 p-3.5 flex items-center gap-3 cursor-pointer active:scale-[0.99] transition-all"
                    >
                      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border border-white/10" style={{ background: `${CATEGORY_COLORS[e.type]}20`, color: CATEGORY_COLORS[e.type] }}>
                        <Icon size={15} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-black uppercase italic tracking-tight text-white truncate">{e.label || EXPENSE_LABELS[e.type]}</div>
                        <div className="text-[10px] font-bold text-[#8e8e93] uppercase tracking-widest mt-0.5 tabular-nums">{fmtDate(e.date)}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-[14px] font-black italic text-white tabular-nums tracking-tighter">{fmtEURFine(e.amount)}</div>
                        {confirmDel === e.id ? (
                          <div className="flex items-center gap-1 mt-1 justify-end">
                            <button onClick={ev => { ev.stopPropagation(); handleDel(e.id); }} className="px-2 py-0.5 bg-red-500/20 rounded-full text-[9px] font-black uppercase tracking-widest text-red-400 border border-red-500/30">Sì</button>
                            <button onClick={ev => { ev.stopPropagation(); setConfirmDel(null); }} className="px-2 py-0.5 bg-white/5 rounded-full text-[9px] font-black uppercase tracking-widest text-[#8e8e93] border border-white/10">No</button>
                          </div>
                        ) : (
                          <button onClick={ev => { ev.stopPropagation(); setConfirmDel(e.id); }} className="mt-1 w-6 h-6 rounded-full bg-white/5 hover:bg-red-500/15 flex items-center justify-center text-[#8e8e93] hover:text-red-400 border border-white/10 ml-auto" aria-label="Elimina">
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {open && (
          <ExpenseSheet
            key={editing?.id || 'new'}
            carModel={carModel}
            existing={editing}
            onClose={() => { setOpen(false); setEditing(null); }}
            onSave={handleSave}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function StackedMonthlyBars({ data, max, avg }: { data: { key: string; label: string; total: number; fuel: number; others: number }[]; max: number; avg: number }) {
  const W = 320, H = 140, P = 8, GAP = 4;
  const colW = (W - P * 2 - GAP * (data.length - 1)) / data.length;
  const barArea = H - 24;
  const avgY = avg > 0 ? P + (1 - avg / max) * (barArea - P * 2) : null;

  return (
    <div className="relative z-10 bg-black/40 backdrop-blur-xl p-5 rounded-[24px] border border-white/5 shadow-inner">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[140px]" preserveAspectRatio="none">
        <defs>
          <linearGradient id="exFuel" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgb(96,165,250)" stopOpacity="1" />
            <stop offset="100%" stopColor="rgb(96,165,250)" stopOpacity="0.5" />
          </linearGradient>
          <linearGradient id="exOther" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgb(168,85,247)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="rgb(168,85,247)" stopOpacity="0.5" />
          </linearGradient>
        </defs>

        {avgY != null && (
          <>
            <line x1={P} x2={W - P} y1={avgY} y2={avgY} stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="3 3" />
            <text x={W - P} y={avgY - 3} fill="rgba(255,255,255,0.4)" fontSize="8" fontWeight="900" textAnchor="end" letterSpacing="0.15em">MEDIA</text>
          </>
        )}

        {data.map((m, i) => {
          const x = P + i * (colW + GAP);
          const isLast = i === data.length - 1;
          const isEmpty = m.total === 0;
          const totalH = max > 0 ? (m.total / max) * (barArea - P) : 0;
          const fuelH = max > 0 ? (m.fuel / max) * (barArea - P) : 0;
          const otherH = max > 0 ? (m.others / max) * (barArea - P) : 0;
          return (
            <g key={m.key}>
              {isEmpty ? (
                <rect x={x} y={barArea - 2} width={colW} height={2} rx="2" fill="rgba(255,255,255,0.08)" />
              ) : (
                <>
                  {otherH > 0 && (
                    <rect x={x} y={barArea - totalH} width={colW} height={otherH} rx="3" fill="url(#exOther)" />
                  )}
                  {fuelH > 0 && (
                    <rect x={x} y={barArea - fuelH} width={colW} height={fuelH} rx="3" fill="url(#exFuel)" />
                  )}
                </>
              )}
              <text x={x + colW / 2} y={H - 6} fill={isLast ? 'rgb(96,165,250)' : 'rgba(255,255,255,0.4)'} fontSize="9" fontWeight="900" textAnchor="middle" letterSpacing="0.05em">{m.label}</text>
            </g>
          );
        })}
      </svg>

      <div className="flex items-center justify-center gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: 'rgb(96,165,250)' }} />
          <span className="text-[9px] font-black text-[#8e8e93] uppercase tracking-widest">Carburante</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: 'rgb(168,85,247)' }} />
          <span className="text-[9px] font-black text-[#8e8e93] uppercase tracking-widest">Altre Spese</span>
        </div>
      </div>
    </div>
  );
}

function ExpenseSheet({ carModel, existing, onClose, onSave }: {
  carModel: string;
  existing: Expense | null;
  onClose: () => void;
  onSave: (e: Omit<Expense, 'id'>) => void;
}) {
  const isEdit = !!existing;
  const today = new Date().toISOString().slice(0, 10);
  const [type, setType] = useState<ExpenseType>(existing?.type || 'manutenzione');
  const [date, setDate] = useState(existing?.date || today);
  const [amount, setAmount] = useState<string>(existing ? existing.amount.toFixed(2) : '');
  const [label, setLabel] = useState(existing?.label || '');
  const [notes, setNotes] = useState(existing?.notes || '');

  const amountN = parseFloat(amount.replace(',', '.')) || 0;
  const canSave = amountN > 0 && !!date;

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
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-blue-600/10 blur-[100px] pointer-events-none rounded-full" />

        <div className="sticky top-0 z-10 bg-[#0a0f1d]/95 backdrop-blur-xl border-b border-white/5 px-6 py-5 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">{isEdit ? 'Modifica' : 'Nuova Spesa'}</div>
            <div className="text-xl font-black italic uppercase tracking-tighter text-white mt-0.5">{EXPENSE_LABELS[type]}</div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#8e8e93] border border-white/10">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5 relative">
          <div>
            <div className="text-[10px] font-black text-[#8e8e93] uppercase tracking-[0.3em] mb-2 ml-2">Categoria</div>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(EXPENSE_LABELS) as ExpenseType[]).map(t => {
                const Icon = TYPE_ICONS[t];
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                      type === t
                        ? 'bg-blue-600 text-white border-blue-400/40 shadow-[0_0_16px_rgba(37,99,235,0.4)]'
                        : 'bg-white/5 text-[#8e8e93] border-white/10 hover:text-white'
                    }`}
                  >
                    <Icon size={16} />
                    <span className="truncate w-full text-center">{EXPENSE_LABELS[t]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-black text-[#8e8e93] uppercase tracking-[0.3em] mb-2 ml-2 flex items-center gap-2"><Euro size={11} className="text-blue-400" /> Importo</div>
            <div className="bg-black/40 rounded-[20px] border border-white/5 px-4 py-3 focus-within:border-blue-500/40">
              <div className="flex items-baseline gap-2">
                <span className="text-blue-400 text-[20px] font-black">€</span>
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 bg-transparent text-white text-[26px] font-black italic tracking-tighter outline-none tabular-nums placeholder:text-[#48484a]"
                />
              </div>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-black text-[#8e8e93] uppercase tracking-[0.3em] mb-2 ml-2 flex items-center gap-2"><Calendar size={11} className="text-blue-400" /> Data</div>
            <div className="bg-black/40 rounded-[20px] border border-white/5 px-4 py-3 focus-within:border-blue-500/40">
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                max={today}
                className="w-full bg-transparent text-white text-[15px] font-bold tracking-tight outline-none tabular-nums"
                style={{ colorScheme: 'dark' }}
              />
            </div>
          </div>

          <div>
            <div className="text-[10px] font-black text-[#8e8e93] uppercase tracking-[0.3em] mb-2 ml-2">Descrizione (opzionale)</div>
            <div className="bg-black/40 rounded-[20px] border border-white/5 px-4 py-3 focus-within:border-blue-500/40">
              <input
                type="text"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder={`Es. ${EXPENSE_LABELS[type]} 2026`}
                className="w-full bg-transparent text-white text-[15px] font-bold tracking-tight outline-none placeholder:text-[#48484a]"
              />
            </div>
          </div>

          <div>
            <div className="text-[10px] font-black text-[#8e8e93] uppercase tracking-[0.3em] mb-2 ml-2">Note (opzionale)</div>
            <div className="bg-black/40 rounded-[20px] border border-white/5 px-4 py-3 focus-within:border-blue-500/40">
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Dettagli aggiuntivi…"
                className="w-full bg-transparent text-white text-[14px] font-bold tracking-tight outline-none placeholder:text-[#48484a]"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => canSave && onSave({ carModel, type, date, amount: amountN, label: label.trim() || undefined, notes: notes.trim() || undefined })}
            disabled={!canSave}
            className={`w-full py-4 rounded-full text-[12px] font-black uppercase tracking-widest transition-all border ${
              canSave
                ? 'bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white border-blue-400/40 shadow-[0_0_30px_rgba(37,99,235,0.4)]'
                : 'bg-white/5 text-[#48484a] border-white/5 cursor-not-allowed'
            }`}
          >{canSave ? (isEdit ? 'Salva Modifiche' : 'Aggiungi Spesa') : 'Compila i campi'}</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Plus, X, Trash2, Wrench, FileText, Shield, Settings, CalendarClock, AlertCircle } from 'lucide-react';
import type { Deadline, DeadlineType } from '../types';
import {
  addDeadline, updateDeadline, removeDeadline, deadlinesForCar,
  daysUntil, statusOf, nextDateFromRecurrence,
  DEADLINE_LABELS, DEFAULT_RECURRENCE,
} from '../services/deadlinesService';

interface Props {
  carModel: string;
}

const TYPE_ICONS: Record<DeadlineType, any> = {
  revisione: Wrench,
  bollo: FileText,
  assicurazione: Shield,
  tagliando: Settings,
  altro: CalendarClock,
};

const STATUS_STYLE = {
  overdue: { bg: 'bg-red-500/15', border: 'border-red-500/40', text: 'text-red-400', glow: 'shadow-[0_0_20px_rgba(239,68,68,0.2)]' },
  urgent: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', glow: 'shadow-[0_0_16px_rgba(239,68,68,0.15)]' },
  warn: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', glow: '' },
  ok: { bg: 'bg-black/40', border: 'border-white/5', text: 'text-white', glow: '' },
};

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function VehicleDeadlines({ carModel }: Props) {
  const [list, setList] = useState<Deadline[]>(() => deadlinesForCar(carModel));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Deadline | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  useEffect(() => {
    setList(deadlinesForCar(carModel));
    setConfirmDel(null);
    setEditing(null);
  }, [carModel]);

  const sorted = useMemo(() => {
    return [...list].sort((a, b) => daysUntil(a.date) - daysUntil(b.date));
  }, [list]);

  const refresh = (next: Deadline[]) => {
    setList(next.filter(d => d.carModel === carModel).sort((a, b) => a.date.localeCompare(b.date)));
  };

  const handleSave = (d: Omit<Deadline, 'id'>) => {
    if (editing) refresh(updateDeadline(editing.id, d));
    else refresh(addDeadline(d));
    setOpen(false);
    setEditing(null);
  };

  const handleDel = (id: string) => {
    refresh(removeDeadline(id));
    setConfirmDel(null);
  };

  const handleRenew = (d: Deadline) => {
    const next = nextDateFromRecurrence(d.date, d.recurrence);
    if (!next) return;
    refresh(updateDeadline(d.id, { ...d, date: next }));
  };

  return (
    <div className="bg-[#0a0f1d] p-6 sm:p-8 rounded-[36px] sm:rounded-[48px] border border-blue-500/30 space-y-5 relative overflow-hidden shadow-2xl">
      <div className="absolute -top-20 -right-20 w-80 h-80 bg-blue-600/10 blur-[100px] pointer-events-none rounded-full" />

      <div className="flex items-center justify-between gap-3 relative z-10">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] animate-pulse" />
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500/90">Scadenze Veicolo</h2>
          </div>
          <h3 className="text-2xl sm:text-3xl font-black uppercase italic tracking-tighter text-white leading-none">
            Da <span className="text-blue-500">Ricordare</span>
          </h3>
        </div>
        <button
          onClick={() => { setEditing(null); setOpen(true); }}
          className="flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 active:scale-95 rounded-full text-[11px] font-black uppercase tracking-widest text-white transition-all shadow-[0_0_24px_rgba(37,99,235,0.4)] border border-blue-400/30 flex-shrink-0"
        >
          <Plus size={16} strokeWidth={3} />
          <span className="hidden sm:inline">Nuova</span>
        </button>
      </div>

      {list.length === 0 ? (
        <div className="relative z-10 py-10 flex flex-col items-center text-center gap-4">
          <div className="w-20 h-20 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
            <Calendar className="w-9 h-9 text-blue-400" />
          </div>
          <div>
            <div className="text-[15px] font-black text-white uppercase italic tracking-tight">Nessuna scadenza</div>
            <div className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-widest mt-1 opacity-70">Aggiungi revisione, bollo, assicurazione e ti avvisiamo prima della scadenza</div>
          </div>
        </div>
      ) : (
        <div className="relative z-10 space-y-2.5">
          {sorted.map(d => {
            const Icon = TYPE_ICONS[d.type];
            const st = statusOf(d);
            const s = STATUS_STYLE[st];
            const dd = daysUntil(d.date);
            const label = d.label || DEADLINE_LABELS[d.type];
            const subtitle = st === 'overdue'
              ? `Scaduta da ${Math.abs(dd)} giorni`
              : dd === 0 ? 'Scade oggi'
              : dd === 1 ? 'Scade domani'
              : `Fra ${dd} giorni`;

            return (
              <div
                key={d.id}
                onClick={() => confirmDel === null && (setEditing(d), setOpen(true))}
                className={`flex items-center gap-3 p-4 rounded-[24px] border transition-all cursor-pointer active:scale-[0.99] ${s.bg} ${s.border} ${s.glow}`}
              >
                <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 border ${s.text} bg-black/30 border-white/5`}>
                  <Icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-[14px] font-black uppercase italic tracking-tight text-white truncate">{label}</div>
                    {st === 'overdue' && <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-red-500 text-white">Scaduta</span>}
                    {st === 'urgent' && <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">Urgente</span>}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-[#8e8e93] uppercase tracking-widest mt-0.5">
                    <span className="tabular-nums">{fmtDate(d.date)}</span>
                    <span className="opacity-40">•</span>
                    <span className={s.text}>{subtitle}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  {st === 'overdue' && d.recurrence !== 'none' && (
                    <button
                      onClick={e => { e.stopPropagation(); handleRenew(d); }}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 rounded-full text-[9px] font-black uppercase tracking-widest text-white border border-blue-400/40"
                    >Rinnova</button>
                  )}
                  {confirmDel === d.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={e => { e.stopPropagation(); handleDel(d.id); }} className="px-2 py-0.5 bg-red-500/20 rounded-full text-[9px] font-black uppercase tracking-widest text-red-400 border border-red-500/30">Sì</button>
                      <button onClick={e => { e.stopPropagation(); setConfirmDel(null); }} className="px-2 py-0.5 bg-white/5 rounded-full text-[9px] font-black uppercase tracking-widest text-[#8e8e93] border border-white/10">No</button>
                    </div>
                  ) : (
                    <button onClick={e => { e.stopPropagation(); setConfirmDel(d.id); }} className="w-7 h-7 rounded-full bg-white/5 hover:bg-red-500/15 flex items-center justify-center text-[#8e8e93] hover:text-red-400 border border-white/10 transition-all" aria-label="Elimina">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {open && (
          <DeadlineSheet
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

function DeadlineSheet({ carModel, existing, onClose, onSave }: {
  carModel: string;
  existing: Deadline | null;
  onClose: () => void;
  onSave: (d: Omit<Deadline, 'id'>) => void;
}) {
  const isEdit = !!existing;
  const today = new Date().toISOString().slice(0, 10);
  const [type, setType] = useState<DeadlineType>(existing?.type || 'revisione');
  const [label, setLabel] = useState(existing?.label || '');
  const [date, setDate] = useState(existing?.date || today);
  const [recurrence, setRecurrence] = useState<Deadline['recurrence']>(existing?.recurrence || DEFAULT_RECURRENCE[existing?.type || 'revisione']);
  const [notes, setNotes] = useState(existing?.notes || '');

  const handleTypeChange = (t: DeadlineType) => {
    setType(t);
    if (!existing) setRecurrence(DEFAULT_RECURRENCE[t]);
  };

  const canSave = !!date;

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
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">{isEdit ? 'Modifica' : 'Nuova Scadenza'}</div>
            <div className="text-xl font-black italic uppercase tracking-tighter text-white mt-0.5">{DEADLINE_LABELS[type]}</div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#8e8e93] border border-white/10">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5 relative">
          <div>
            <div className="text-[10px] font-black text-[#8e8e93] uppercase tracking-[0.3em] mb-2 ml-2">Tipo</div>
            <div className="grid grid-cols-5 gap-2">
              {(Object.keys(DEADLINE_LABELS) as DeadlineType[]).map(t => {
                const Icon = TYPE_ICONS[t];
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleTypeChange(t)}
                    className={`flex flex-col items-center gap-1 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                      type === t
                        ? 'bg-blue-600 text-white border-blue-400/40 shadow-[0_0_16px_rgba(37,99,235,0.4)]'
                        : 'bg-white/5 text-[#8e8e93] border-white/10 hover:text-white'
                    }`}
                  >
                    <Icon size={16} />
                    <span className="truncate w-full text-center">{DEADLINE_LABELS[t].slice(0, 5)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-black text-[#8e8e93] uppercase tracking-[0.3em] mb-2 ml-2">Data scadenza</div>
            <div className="bg-black/40 rounded-[20px] border border-white/5 px-4 py-3 focus-within:border-blue-500/40">
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full bg-transparent text-white text-[16px] font-bold tracking-tight outline-none tabular-nums"
                style={{ colorScheme: 'dark' }}
              />
            </div>
          </div>

          <div>
            <div className="text-[10px] font-black text-[#8e8e93] uppercase tracking-[0.3em] mb-2 ml-2">Rinnovo automatico</div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'none' as const, label: 'Mai' },
                { key: 'yearly' as const, label: '1 Anno' },
                { key: '2years' as const, label: '2 Anni' },
              ].map(o => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setRecurrence(o.key)}
                  className={`py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                    recurrence === o.key
                      ? 'bg-blue-600 text-white border-blue-400/40 shadow-[0_0_16px_rgba(37,99,235,0.4)]'
                      : 'bg-white/5 text-[#8e8e93] border-white/10 hover:text-white'
                  }`}
                >{o.label}</button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-black text-[#8e8e93] uppercase tracking-[0.3em] mb-2 ml-2">Etichetta (opzionale)</div>
            <div className="bg-black/40 rounded-[20px] border border-white/5 px-4 py-3 focus-within:border-blue-500/40">
              <input
                type="text"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder={DEADLINE_LABELS[type]}
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
                placeholder="Es. numero polizza, importo, scadenza tagliando..."
                className="w-full bg-transparent text-white text-[14px] font-bold tracking-tight outline-none placeholder:text-[#48484a]"
              />
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-[20px]">
            <AlertCircle size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] font-bold text-blue-300 leading-relaxed">
              Riceverai un avviso a 30, 7 e 1 giorno dalla scadenza (se le notifiche sono attive).
            </div>
          </div>

          <button
            type="button"
            onClick={() => canSave && onSave({ carModel, type, label: label.trim() || undefined, date, recurrence, notes: notes.trim() || undefined })}
            disabled={!canSave}
            className={`w-full py-4 rounded-full text-[12px] font-black uppercase tracking-widest transition-all border ${
              canSave
                ? 'bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white border-blue-400/40 shadow-[0_0_30px_rgba(37,99,235,0.4)]'
                : 'bg-white/5 text-[#48484a] border-white/5 cursor-not-allowed'
            }`}
          >{isEdit ? 'Salva Modifiche' : 'Aggiungi Scadenza'}</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

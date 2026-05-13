import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Fuel, Plus, X, Trash2, TrendingUp, TrendingDown, Calendar, Gauge, Euro, Droplet, Award } from 'lucide-react';
import type { Fillup, FuelType } from '../types';
import { addFillup, computeStats, fillupsForCar, removeFillup, defaultFuelType } from '../services/fillupService';

interface Props {
  carModel: string;
  carTags?: string;
  wltpKml?: number;
  tankLiters?: number;
}

const FUELS: FuelType[] = ['Benzina', 'Diesel', 'GPL', 'Metano'];

const fmtEUR = (n: number) => '€' + n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtKm = (n: number) => Math.round(n).toLocaleString('it-IT') + ' km';
const fmtL = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' L';
const fmtKml = (n: number) => n.toFixed(1) + ' km/L';
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
};

export function FillupTracker({ carModel, carTags, wltpKml, tankLiters }: Props) {
  const [fills, setFills] = useState<Fillup[]>(() => fillupsForCar(carModel));
  const [open, setOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  useEffect(() => {
    setFills(fillupsForCar(carModel));
    setConfirmDel(null);
  }, [carModel]);

  const stats = useMemo(() => computeStats(fills, wltpKml), [fills, wltpKml]);
  const sorted = useMemo(() => [...fills].sort((a, b) => b.odometer - a.odometer), [fills]);

  const handleAdd = (f: Omit<Fillup, 'id'>) => {
    const updated = addFillup(f);
    setFills(updated.filter(x => x.carModel === carModel).sort((a, b) => a.odometer - b.odometer));
    setOpen(false);
  };

  const handleDel = (id: string) => {
    const updated = removeFillup(id);
    setFills(updated.filter(x => x.carModel === carModel).sort((a, b) => a.odometer - b.odometer));
    setConfirmDel(null);
  };

  return (
    <div className="bg-[#0a0f1d] p-6 sm:p-8 rounded-[36px] sm:rounded-[48px] border border-blue-500/30 space-y-6 relative overflow-hidden shadow-2xl">
      <div className="absolute -top-20 -left-20 w-80 h-80 bg-blue-600/10 blur-[100px] pointer-events-none rounded-full" />

      <div className="flex items-center justify-between gap-3 relative z-10">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] animate-pulse" />
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500/90">Pieno Tracker</h2>
          </div>
          <h3 className="text-2xl sm:text-3xl font-black uppercase italic tracking-tighter text-white leading-none">
            Storico <span className="text-blue-500">Pieni</span>
          </h3>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 active:scale-95 rounded-full text-[11px] font-black uppercase tracking-widest text-white transition-all shadow-[0_0_24px_rgba(37,99,235,0.4)] border border-blue-400/30 flex-shrink-0"
        >
          <Plus size={16} strokeWidth={3} />
          <span className="hidden sm:inline">Nuovo</span>
        </button>
      </div>

      {fills.length === 0 ? (
        <div className="relative z-10 py-10 flex flex-col items-center text-center gap-4">
          <div className="w-20 h-20 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
            <Fuel className="w-9 h-9 text-blue-400" />
          </div>
          <div>
            <div className="text-[15px] font-black text-white uppercase italic tracking-tight">Nessun pieno registrato</div>
            <div className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-widest mt-1 opacity-70">Registra i tuoi rifornimenti per vedere consumo reale e spesa</div>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="mt-2 flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 active:scale-95 rounded-full text-[11px] font-black uppercase tracking-widest text-white transition-all shadow-[0_0_24px_rgba(37,99,235,0.4)] border border-blue-400/30"
          >
            <Plus size={14} strokeWidth={3} /> Registra primo pieno
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 relative z-10">
            <StatCell
              label="Consumo Reale"
              value={stats.realKml ? fmtKml(stats.realKml) : '—'}
              accent={stats.realKml && wltpKml ? (stats.realKml >= wltpKml ? 'good' : 'bad') : undefined}
              sub={stats.vsWltpPct != null ? (
                <span className={stats.vsWltpPct >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {stats.vsWltpPct >= 0 ? '+' : ''}{stats.vsWltpPct.toFixed(1)}% vs WLTP
                </span>
              ) : (wltpKml ? `Target ${fmtKml(wltpKml)}` : null)}
            />
            <StatCell
              label="Prezzo Medio"
              value={stats.avgPricePerL ? '€' + stats.avgPricePerL.toFixed(3) : '—'}
              sub={<span className="text-[#8e8e93]">€/L pagato</span>}
            />
            <StatCell
              label="Spesa Totale"
              value={fmtEUR(stats.totalCost)}
              sub={<span className="text-[#8e8e93]">{stats.count} pieni</span>}
            />
            <StatCell
              label="Km Percorsi"
              value={fmtKm(stats.kmDriven)}
              sub={stats.costPerKm != null ? <span className="text-[#8e8e93]">{fmtEUR(stats.costPerKm)}/km</span> : null}
            />
          </div>

          {stats.consumptionSeries.length >= 2 && (
            <div className="relative z-10 bg-black/40 backdrop-blur-xl p-5 sm:p-6 rounded-[24px] sm:rounded-[28px] border border-white/5 shadow-inner">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Trend Consumo</div>
                  <div className="text-[11px] font-bold text-[#8e8e93] mt-0.5">Pieno per pieno</div>
                </div>
                {stats.vsWltpPct != null && (
                  <div className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest ${stats.vsWltpPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {stats.vsWltpPct >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {stats.vsWltpPct >= 0 ? '+' : ''}{stats.vsWltpPct.toFixed(1)}%
                  </div>
                )}
              </div>
              <ConsumptionSpark data={stats.consumptionSeries} wltp={wltpKml} />
            </div>
          )}

          <div className="relative z-10 space-y-3">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8e8e93] px-2">Cronologia</div>
            <div className="space-y-2.5 max-h-[400px] overflow-y-auto no-scrollbar pr-1">
              {sorted.map((f, idx) => (
                <motion.div
                  key={f.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx, 6) * 0.03 }}
                  className="bg-black/40 backdrop-blur-xl p-4 rounded-[24px] border border-white/5 shadow-inner flex items-center gap-3 group"
                >
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 border ${f.full ? 'bg-blue-500/15 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/10 text-[#8e8e93]'}`}>
                    {f.full ? <Fuel size={18} /> : <Droplet size={18} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <div className="text-[14px] font-black italic text-white tracking-tight tabular-nums">{fmtL(f.liters)}</div>
                      <div className="text-[10px] font-black text-[#8e8e93] uppercase tracking-widest">@ €{f.pricePerLiter.toFixed(3)}</div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-[#8e8e93] uppercase tracking-widest mt-0.5">
                      <span>{fmtDate(f.date)}</span>
                      <span className="opacity-40">•</span>
                      <span className="tabular-nums">{fmtKm(f.odometer)}</span>
                      {f.stationName && <>
                        <span className="opacity-40">•</span>
                        <span className="truncate normal-case tracking-normal">{f.stationName}</span>
                      </>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[15px] font-black italic text-white tracking-tighter tabular-nums">{fmtEUR(f.total)}</div>
                    {confirmDel === f.id ? (
                      <div className="flex items-center gap-1 mt-1 justify-end">
                        <button
                          onClick={() => handleDel(f.id)}
                          className="px-2 py-0.5 bg-red-500/20 hover:bg-red-500/30 rounded-full text-[9px] font-black uppercase tracking-widest text-red-400 border border-red-500/30"
                        >Sì</button>
                        <button
                          onClick={() => setConfirmDel(null)}
                          className="px-2 py-0.5 bg-white/5 hover:bg-white/10 rounded-full text-[9px] font-black uppercase tracking-widest text-[#8e8e93] border border-white/10"
                        >No</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDel(f.id)}
                        className="mt-1 w-7 h-7 rounded-full bg-white/5 hover:bg-red-500/15 active:scale-90 flex items-center justify-center text-[#8e8e93] hover:text-red-400 border border-white/10 hover:border-red-500/30 transition-all ml-auto"
                        aria-label="Elimina"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </>
      )}

      <AnimatePresence>
        {open && (
          <AddFillupSheet
            carModel={carModel}
            defaultFuel={defaultFuelType(carTags)}
            tankLiters={tankLiters}
            lastOdo={fills.length ? fills[fills.length - 1].odometer : null}
            onClose={() => setOpen(false)}
            onSave={handleAdd}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCell({ label, value, sub, accent }: { label: string; value: string; sub?: React.ReactNode; accent?: 'good' | 'bad' }) {
  const accentColor = accent === 'good' ? 'text-emerald-400' : accent === 'bad' ? 'text-red-400' : 'text-white';
  return (
    <div className="bg-black/40 backdrop-blur-xl p-4 sm:p-5 rounded-[24px] sm:rounded-[28px] border border-white/5 shadow-inner min-w-0 overflow-hidden">
      <div className="text-[10px] font-black text-[#8e8e93] uppercase tracking-[0.2em] mb-1.5 truncate">{label}</div>
      <div className={`text-xl sm:text-2xl font-black italic tracking-tighter tabular-nums truncate ${accentColor}`}>{value}</div>
      {sub && <div className="text-[10px] font-bold uppercase tracking-widest mt-1 truncate">{sub}</div>}
    </div>
  );
}

function ConsumptionSpark({ data, wltp }: { data: { date: string; kml: number; odo: number }[]; wltp?: number }) {
  const W = 320, H = 90, P = 6;
  const vals = data.map(d => d.kml);
  if (wltp) vals.push(wltp);
  const lo = Math.min(...vals) * 0.95;
  const hi = Math.max(...vals) * 1.05;
  const span = hi - lo || 1;
  const x = (i: number) => P + (i / Math.max(1, data.length - 1)) * (W - P * 2);
  const y = (v: number) => H - P - ((v - lo) / span) * (H - P * 2);

  const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(2)} ${y(d.kml).toFixed(2)}`).join(' ');
  const areaPath = path + ` L ${x(data.length - 1).toFixed(2)} ${H - P} L ${P} ${H - P} Z`;
  const wltpY = wltp ? y(wltp) : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[90px]" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkfill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgb(59,130,246)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="rgb(59,130,246)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {wltpY != null && (
        <>
          <line x1={P} x2={W - P} y1={wltpY} y2={wltpY} stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="3 3" />
          <text x={W - P} y={wltpY - 4} fill="rgba(255,255,255,0.4)" fontSize="9" fontWeight="900" textAnchor="end" letterSpacing="0.1em">WLTP</text>
        </>
      )}
      <path d={areaPath} fill="url(#sparkfill)" />
      <path d={path} fill="none" stroke="rgb(96,165,250)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <circle key={i} cx={x(i)} cy={y(d.kml)} r={i === data.length - 1 ? 3.5 : 2} fill="rgb(96,165,250)" stroke="#0a0f1d" strokeWidth="1.5" />
      ))}
    </svg>
  );
}

function AddFillupSheet({ carModel, defaultFuel, tankLiters, lastOdo, onClose, onSave }: {
  carModel: string;
  defaultFuel: FuelType;
  tankLiters?: number;
  lastOdo: number | null;
  onClose: () => void;
  onSave: (f: Omit<Fillup, 'id'>) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [fuelType, setFuelType] = useState<FuelType>(defaultFuel);
  const [liters, setLiters] = useState<string>('');
  const [total, setTotal] = useState<string>('');
  const [pricePerLiter, setPricePerLiter] = useState<string>('');
  const [odometer, setOdometer] = useState<string>(lastOdo ? String(lastOdo) : '');
  const [full, setFull] = useState(true);
  const [stationName, setStationName] = useState('');
  type Field = 'l' | 't' | 'p';
  const [edits, setEdits] = useState<Field[]>(['t', 'l']);
  const onEdit = (f: Field) => setEdits(prev => [f, ...prev.filter(x => x !== f)].slice(0, 2));

  const litersN = parseFloat(liters.replace(',', '.')) || 0;
  const totalN = parseFloat(total.replace(',', '.')) || 0;
  const priceN = parseFloat(pricePerLiter.replace(',', '.')) || 0;

  useEffect(() => {
    const has = new Set(edits);
    const computed: Field = !has.has('l') ? 'l' : !has.has('t') ? 't' : 'p';
    if (computed === 'l' && totalN > 0 && priceN > 0) {
      const v = (totalN / priceN).toFixed(2);
      if (v !== liters) setLiters(v);
    } else if (computed === 't' && litersN > 0 && priceN > 0) {
      const v = (litersN * priceN).toFixed(2);
      if (v !== total) setTotal(v);
    } else if (computed === 'p' && litersN > 0 && totalN > 0) {
      const v = (totalN / litersN).toFixed(3);
      if (v !== pricePerLiter) setPricePerLiter(v);
    }
  }, [litersN, totalN, priceN, edits]);

  const odoN = parseFloat(odometer.replace(',', '.')) || 0;
  const odoError = lastOdo != null && odoN > 0 && odoN < lastOdo;
  const canSave = litersN > 0 && priceN > 0 && odoN > 0 && !odoError;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      date,
      carModel,
      fuelType,
      liters: litersN,
      pricePerLiter: priceN,
      total: totalN || priceN * litersN,
      odometer: odoN,
      full,
      stationName: stationName.trim() || undefined,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
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
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Nuovo Rifornimento</div>
            <div className="text-xl font-black italic uppercase tracking-tighter text-white mt-0.5">Pieno</div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#8e8e93] border border-white/10">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5 relative">
          <FieldRow icon={<Calendar size={16} />} label="Data">
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              max={today}
              className="w-full bg-transparent text-white text-[15px] font-bold tracking-tight outline-none tabular-nums"
              style={{ colorScheme: 'dark' }}
            />
          </FieldRow>

          <div>
            <div className="text-[10px] font-black text-[#8e8e93] uppercase tracking-[0.3em] mb-2 ml-2">Tipo Carburante</div>
            <div className="grid grid-cols-4 gap-2">
              {FUELS.map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFuelType(f)}
                  className={`py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                    fuelType === f
                      ? 'bg-blue-600 text-white border-blue-400/40 shadow-[0_0_16px_rgba(37,99,235,0.4)]'
                      : 'bg-white/5 text-[#8e8e93] border-white/10 hover:text-white'
                  }`}
                >
                  {f === 'Benzina' ? 'Benz' : f === 'Metano' ? 'Met' : f}
                </button>
              ))}
            </div>
          </div>

          <FieldRow icon={<Droplet size={16} />} label={`Litri${tankLiters ? ` (max ${tankLiters}L)` : ''}`}>
            <input
              inputMode="decimal"
              placeholder="0.00"
              value={liters}
              onChange={e => { setLiters(e.target.value); onEdit('l'); }}
              className="w-full bg-transparent text-white text-[15px] font-bold tracking-tight outline-none tabular-nums placeholder:text-[#48484a]"
            />
          </FieldRow>

          <div className="grid grid-cols-2 gap-3">
            <FieldRow icon={<Euro size={16} />} label="Totale (€)">
              <input
                inputMode="decimal"
                placeholder="0.00"
                value={total}
                onChange={e => { setTotal(e.target.value); onEdit('t'); }}
                className="w-full bg-transparent text-white text-[15px] font-bold tracking-tight outline-none tabular-nums placeholder:text-[#48484a]"
              />
            </FieldRow>
            <FieldRow icon={<Award size={16} />} label="€/L">
              <input
                inputMode="decimal"
                placeholder="0.000"
                value={pricePerLiter}
                onChange={e => { setPricePerLiter(e.target.value); onEdit('p'); }}
                className="w-full bg-transparent text-white text-[15px] font-bold tracking-tight outline-none tabular-nums placeholder:text-[#48484a]"
              />
            </FieldRow>
          </div>

          <FieldRow
            icon={<Gauge size={16} />}
            label={`Km totali${lastOdo ? ` (ultimo ${fmtKm(lastOdo)})` : ''}`}
            error={odoError ? `Inferiore al precedente (${fmtKm(lastOdo!)})` : undefined}
          >
            <input
              inputMode="numeric"
              placeholder="0"
              value={odometer}
              onChange={e => setOdometer(e.target.value)}
              className="w-full bg-transparent text-white text-[15px] font-bold tracking-tight outline-none tabular-nums placeholder:text-[#48484a]"
            />
          </FieldRow>

          <FieldRow icon={<Fuel size={16} />} label="Distributore (opzionale)">
            <input
              type="text"
              placeholder="Es. Eni Roma Sud"
              value={stationName}
              onChange={e => setStationName(e.target.value)}
              className="w-full bg-transparent text-white text-[15px] font-bold tracking-tight outline-none placeholder:text-[#48484a]"
            />
          </FieldRow>

          <button
            type="button"
            onClick={() => setFull(!full)}
            className="w-full flex items-center justify-between p-4 bg-black/40 rounded-[20px] border border-white/5 hover:border-blue-500/30 transition-all"
          >
            <div className="text-left">
              <div className="text-[13px] font-black text-white uppercase italic tracking-tight">Pieno Completo</div>
              <div className="text-[10px] font-bold text-[#8e8e93] uppercase tracking-widest opacity-70">Serve per consumo reale</div>
            </div>
            <div className={`relative w-12 h-7 rounded-full transition-colors ${full ? 'bg-blue-600' : 'bg-white/10'}`}>
              <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-lg transition-all ${full ? 'left-[22px]' : 'left-0.5'}`} />
            </div>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className={`w-full py-4 rounded-full text-[12px] font-black uppercase tracking-widest transition-all border ${
              canSave
                ? 'bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white border-blue-400/40 shadow-[0_0_30px_rgba(37,99,235,0.4)]'
                : 'bg-white/5 text-[#48484a] border-white/5 cursor-not-allowed'
            }`}
          >
            {canSave ? 'Salva Pieno' : 'Compila i campi'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function FieldRow({ icon, label, children, error }: { icon: React.ReactNode; label: string; children: React.ReactNode; error?: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 ml-2">
        <span className="text-blue-400">{icon}</span>
        <div className="text-[10px] font-black text-[#8e8e93] uppercase tracking-[0.3em]">{label}</div>
      </div>
      <div className={`bg-black/40 rounded-[20px] border px-4 py-3 ${error ? 'border-red-500/40' : 'border-white/5'} focus-within:border-blue-500/40 transition-colors`}>
        {children}
      </div>
      {error && <div className="text-[10px] font-bold text-red-400 mt-1 ml-3 uppercase tracking-widest">{error}</div>}
    </div>
  );
}

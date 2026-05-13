import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, TrendingUp, TrendingDown, MapPin, Navigation, Clock } from 'lucide-react';
import type { FuelStation, FuelType } from '../types';
import { getStationHistory } from '../services/stationHistoryService';

interface Props {
  station: FuelStation | null;
  fuel: FuelType;
  onClose: () => void;
}

const FUELS: FuelType[] = ['Benzina', 'Diesel', 'GPL', 'Metano'];
const fmt3 = (n: number) => '€' + n.toFixed(3);
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
};

export function StationHistoryModal({ station, fuel, onClose }: Props) {
  const [activeFuel, setActiveFuel] = useState<FuelType>(fuel);

  useEffect(() => { setActiveFuel(fuel); }, [fuel, station]);

  const view = useMemo(
    () => station ? getStationHistory(station.id, activeFuel) : null,
    [station, activeFuel]
  );

  const currentPrice = station?.prices.find(p => p.type === activeFuel)?.price || 0;

  return (
    <AnimatePresence>
      {station && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[2000] bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
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

            <div className="sticky top-0 z-10 bg-[#0a0f1d]/95 backdrop-blur-xl border-b border-white/5 px-6 py-5 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Distributore</div>
                <div className="text-xl font-black italic uppercase tracking-tighter text-white mt-0.5 truncate">{station.brand || station.name}</div>
                <div className="flex items-center gap-1 text-[11px] font-bold text-[#8e8e93] uppercase tracking-widest mt-0.5">
                  <MapPin size={10} />
                  <span className="truncate">{station.city}</span>
                </div>
              </div>
              <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#8e8e93] border border-white/10 flex-shrink-0">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5 relative">
              <div className="grid grid-cols-4 gap-2">
                {FUELS.map(f => {
                  const has = !!station.prices.find(p => p.type === f && p.price > 0);
                  return (
                    <button
                      key={f}
                      onClick={() => has && setActiveFuel(f)}
                      disabled={!has}
                      className={`py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                        activeFuel === f
                          ? 'bg-blue-600 text-white border-blue-400/40 shadow-[0_0_16px_rgba(37,99,235,0.4)]'
                          : has
                            ? 'bg-white/5 text-[#8e8e93] border-white/10 hover:text-white'
                            : 'bg-white/[0.02] text-[#48484a] border-white/5 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      {f === 'Benzina' ? 'Benz' : f === 'Metano' ? 'Met' : f}
                    </button>
                  );
                })}
              </div>

              <div className="bg-black/40 rounded-[28px] border border-white/5 p-5 shadow-inner">
                <div className="flex items-end justify-between gap-3 mb-1">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400 mb-1">Prezzo Attuale</div>
                    <div className="text-4xl sm:text-5xl font-black italic text-white tracking-tighter tabular-nums">
                      {currentPrice > 0 ? fmt3(currentPrice) : '—'}
                    </div>
                    <div className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-widest mt-1">{activeFuel} · €/L</div>
                  </div>
                  {view && view.pointCount >= 2 && (
                    <div className={`flex flex-col items-end gap-0.5 ${view.deltaPct < 0 ? 'text-emerald-400' : view.deltaPct > 0 ? 'text-red-400' : 'text-[#8e8e93]'}`}>
                      <div className="flex items-center gap-1 text-[14px] font-black italic tabular-nums">
                        {view.deltaPct < 0 ? <TrendingDown size={16} /> : view.deltaPct > 0 ? <TrendingUp size={16} /> : null}
                        {view.deltaPct >= 0 ? '+' : ''}{view.deltaPct.toFixed(2)}%
                      </div>
                      <div className="text-[9px] font-black text-[#8e8e93] uppercase tracking-widest">su {view.pointCount} giorni</div>
                    </div>
                  )}
                </div>
              </div>

              {view ? (
                <>
                  <div className="bg-black/40 rounded-[24px] border border-white/5 p-4 shadow-inner">
                    <div className="flex items-center justify-between mb-3 px-1">
                      <div className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Storico</div>
                      <div className="text-[10px] font-bold text-[#8e8e93] uppercase tracking-widest">
                        {fmtDate(view.series[0].d)} → {fmtDate(view.series[view.series.length - 1].d)}
                      </div>
                    </div>
                    <HistoryChart series={view.series} min={view.min} max={view.max} avg={view.avg} />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <MiniCell label="Min" value={fmt3(view.min)} accent="emerald" />
                    <MiniCell label="Media" value={fmt3(view.avg)} />
                    <MiniCell label="Max" value={fmt3(view.max)} accent="red" />
                  </div>
                </>
              ) : (
                <div className="bg-black/40 rounded-[24px] border border-white/5 p-8 text-center">
                  <Clock size={28} className="mx-auto text-[#48484a] mb-3" />
                  <div className="text-[12px] font-black text-white uppercase italic tracking-tight">Storico in costruzione</div>
                  <div className="text-[10px] font-bold text-[#8e8e93] uppercase tracking-widest mt-2 leading-relaxed max-w-xs mx-auto">
                    I prezzi vengono registrati ogni volta che apri l'app. Torna fra qualche giorno per vedere il trend.
                  </div>
                </div>
              )}

              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${station.location.lat},${station.location.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-4 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] rounded-full text-[11px] font-black uppercase tracking-widest text-white border border-blue-400/40 shadow-[0_0_24px_rgba(37,99,235,0.4)] transition-all"
              >
                <Navigation size={14} /> Naviga
              </a>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function HistoryChart({ series, min, max, avg }: { series: { d: string; p: number }[]; min: number; max: number; avg: number }) {
  const W = 320, H = 140, P = 10;
  const lo = min * 0.998;
  const hi = max * 1.002;
  const span = (hi - lo) || 1;
  const x = (i: number) => P + (i / Math.max(1, series.length - 1)) * (W - P * 2);
  const y = (v: number) => H - P - ((v - lo) / span) * (H - P * 2);
  const path = series.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(2)} ${y(d.p).toFixed(2)}`).join(' ');
  const area = path + ` L ${x(series.length - 1).toFixed(2)} ${H - P} L ${P} ${H - P} Z`;
  const avgY = y(avg);
  const last = series[series.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[140px]" preserveAspectRatio="none">
      <defs>
        <linearGradient id="histfill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgb(59,130,246)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="rgb(59,130,246)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1={P} x2={W - P} y1={avgY} y2={avgY} stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="3 3" />
      <text x={W - P} y={avgY - 4} fill="rgba(255,255,255,0.4)" fontSize="9" fontWeight="900" textAnchor="end" letterSpacing="0.1em">MEDIA</text>
      <path d={area} fill="url(#histfill)" />
      <path d={path} fill="none" stroke="rgb(96,165,250)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(series.length - 1)} cy={y(last.p)} r="4" fill="rgb(96,165,250)" stroke="#0a0f1d" strokeWidth="2" />
      <circle cx={x(series.length - 1)} cy={y(last.p)} r="7" fill="rgb(96,165,250)" fillOpacity="0.25" />
    </svg>
  );
}

function MiniCell({ label, value, accent }: { label: string; value: string; accent?: 'emerald' | 'red' }) {
  const c = accent === 'emerald' ? 'text-emerald-400' : accent === 'red' ? 'text-red-400' : 'text-white';
  return (
    <div className="bg-black/40 p-3 rounded-[18px] border border-white/5 min-w-0">
      <div className="text-[9px] font-black text-[#8e8e93] uppercase tracking-[0.2em] truncate">{label}</div>
      <div className={`text-[14px] font-black italic tracking-tighter tabular-nums truncate mt-1 ${c}`}>{value}</div>
    </div>
  );
}

import { useMemo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Car, TrendingUp, TrendingDown, Fuel, Gauge, Clock, MapPin } from 'lucide-react';
import { FillupTracker } from '../FillupTracker';
import { FuelCostCompare } from '../FuelCostCompare';
import { BudgetCard } from '../BudgetCard';
import { fillupsForCar, computeMonthlySpend, predictNextFillup, defaultFuelType, type MonthBucket } from '../../services/fillupService';
import type { FuelStation, FuelType } from '../../types';

interface Props {
  selectedCar: any;
  setTab: (t: any) => void;
  stations: FuelStation[];
  selectedFuel: FuelType;
  userLoc: { lat: number; lng: number } | null;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const fmtEUR = (n: number) => '€' + n.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtEURFine = (n: number) => '€' + n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function PienoTab({ selectedCar, setTab, stations, selectedFuel, userLoc }: Props) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [prefill, setPrefill] = useState<{ stationName?: string; pricePerLiter?: number; fuelType?: FuelType } | null>(null);
  const fills = useMemo(
    () => selectedCar ? fillupsForCar(selectedCar.model) : [],
    [selectedCar, refreshKey]
  );
  const months = useMemo(() => computeMonthlySpend(fills, 12), [fills]);
  const prediction = useMemo(
    () => selectedCar ? predictNextFillup(fills, selectedCar.kml, selectedCar.liters) : null,
    [fills, selectedCar]
  );

  const nearestStation = useMemo(() => {
    if (!userLoc || !stations.length) return null;
    const fuel: FuelType = defaultFuelType(selectedCar?.tags);
    let best: { st: FuelStation; dist: number; price: number } | null = null;
    for (const s of stations) {
      const pp = s.prices.find(p => p.type === fuel);
      if (!pp || !pp.price) continue;
      const d = haversineKm(userLoc.lat, userLoc.lng, s.location.lat, s.location.lng);
      if (d > 2) continue;
      if (!best || d < best.dist) best = { st: s, dist: d, price: pp.price };
    }
    return best;
  }, [userLoc, stations, selectedCar]);

  const handleQuickFillup = () => {
    if (!nearestStation) return;
    const fuel: FuelType = defaultFuelType(selectedCar?.tags);
    setPrefill({
      stationName: nearestStation.st.brand || nearestStation.st.name,
      pricePerLiter: nearestStation.price,
      fuelType: fuel,
    });
  };

  useEffect(() => {
    const handler = () => setRefreshKey(k => k + 1);
    window.addEventListener('storage', handler);
    window.addEventListener('mf-fillup-changed', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('mf-fillup-changed', handler);
    };
  }, []);

  if (!selectedCar) {
    return (
      <motion.div key="pieno-empty" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 pb-24">
        <header className="px-2 pt-2 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] animate-pulse" />
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500/90">Pieno Module</h2>
          </div>
          <h3 className="text-4xl font-black tracking-tighter text-white uppercase italic leading-none">Storico <span className="text-blue-500">Pieni</span></h3>
        </header>
        <div className="bg-[#0a0f1d] p-8 rounded-[36px] border border-blue-500/30 flex flex-col items-center text-center gap-4 relative overflow-hidden">
          <div className="absolute -top-20 -left-20 w-80 h-80 bg-blue-600/10 blur-[100px] pointer-events-none rounded-full" />
          <div className="w-20 h-20 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center relative z-10">
            <Car className="w-9 h-9 text-blue-400" />
          </div>
          <div className="relative z-10">
            <div className="text-[15px] font-black text-white uppercase italic tracking-tight">Seleziona un veicolo</div>
            <div className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-widest mt-1 opacity-70 max-w-xs">Il pieno tracker si attiva quando hai scelto il tuo veicolo in Garage</div>
          </div>
          <button
            onClick={() => setTab('veicolo')}
            className="relative z-10 mt-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 active:scale-95 rounded-full text-[11px] font-black uppercase tracking-widest text-white transition-all shadow-[0_0_24px_rgba(37,99,235,0.4)] border border-blue-400/30"
          >
            Vai al Garage
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div key="pieno" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="space-y-6 pb-24">
      <header className="px-2 pt-2 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] animate-pulse" />
          <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500/90">Pieno Module</h2>
        </div>
        <h3 className="text-4xl font-black tracking-tighter text-white uppercase italic leading-none">Storico <span className="text-blue-500">Pieni</span></h3>
      </header>

      {nearestStation && (
        <button
          onClick={handleQuickFillup}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 active:scale-[0.99] rounded-[28px] p-5 flex items-center gap-4 border border-blue-400/40 shadow-[0_0_40px_rgba(37,99,235,0.4)] transition-all text-left"
        >
          <div className="w-12 h-12 rounded-full bg-white/15 border border-white/20 flex items-center justify-center flex-shrink-0">
            <MapPin size={20} className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-100/90">Sei qui</div>
            <div className="text-[15px] font-black italic uppercase tracking-tighter text-white truncate">{nearestStation.st.brand || nearestStation.st.name}</div>
            <div className="text-[11px] font-bold text-blue-100/70 uppercase tracking-widest mt-0.5 tabular-nums">
              €{nearestStation.price.toFixed(3)}/L · {(nearestStation.dist * 1000).toFixed(0)} m
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-100/90">Pieno</div>
            <div className="text-[13px] font-black italic text-white">adesso →</div>
          </div>
        </button>
      )}

      {prediction && <NextFillupCard p={prediction} tankL={selectedCar.liters} />}

      <BudgetCard carModel={selectedCar.model} />

      <MonthlyChart months={months} />

      <FuelCostCompare stations={stations} carKml={selectedCar.kml} selectedFuel={selectedFuel} />

      <FillupTracker
        prefillNew={prefill}
        onPrefillConsumed={() => setPrefill(null)}
        carModel={selectedCar.model}
        carTags={selectedCar.tags}
        wltpKml={selectedCar.kml}
        tankLiters={selectedCar.liters}
      />
    </motion.div>
  );
}

function NextFillupCard({ p, tankL }: { p: NonNullable<ReturnType<typeof predictNextFillup>>; tankL: number }) {
  const pct = Math.round(p.tankPct * 100);
  const days = p.daysUntilEmpty != null ? Math.max(0, Math.round(p.daysUntilEmpty)) : null;
  const dateStr = p.predictedDate ? new Date(p.predictedDate).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) : null;
  const litersLeft = Math.round(p.litersLeftEst);
  const rangeLeft = p.rangeLeftKm ? Math.round(p.rangeLeftKm) : 0;
  const urgent = pct >= 75;
  const warning = pct >= 50 && pct < 75;
  const accent = urgent ? 'red' : warning ? 'amber' : 'blue';
  const accentMap = {
    red: { text: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/30', glow: 'shadow-[0_0_24px_rgba(239,68,68,0.25)]', bar: 'bg-red-500' },
    amber: { text: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30', glow: 'shadow-[0_0_24px_rgba(245,158,11,0.25)]', bar: 'bg-amber-500' },
    blue: { text: 'text-blue-400', bg: 'bg-blue-500/15', border: 'border-blue-500/30', glow: 'shadow-[0_0_24px_rgba(37,99,235,0.2)]', bar: 'bg-blue-500' },
  };
  const a = accentMap[accent];

  return (
    <div className={`bg-[#0a0f1d] p-6 sm:p-8 rounded-[36px] sm:rounded-[48px] border ${a.border} space-y-5 relative overflow-hidden ${a.glow}`}>
      <div className="absolute -top-20 -right-20 w-80 h-80 bg-blue-600/10 blur-[100px] pointer-events-none rounded-full" />

      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="min-w-0 flex-1">
          <div className={`flex items-center gap-2 ${a.text} mb-2`}>
            <Fuel size={14} />
            <div className="text-[10px] font-black uppercase tracking-[0.3em]">Prossimo Pieno</div>
          </div>
          <div className="text-3xl sm:text-4xl font-black italic tracking-tighter text-white tabular-nums">
            {days != null ? <>~{days}<span className="text-sm ml-1 text-[#8e8e93]">{days === 1 ? 'giorno' : 'giorni'}</span></> : '—'}
          </div>
          <div className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-widest mt-1">
            {dateStr ? `Stima: ${dateStr}` : 'Inserisci più pieni per stima'}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8e8e93]">Stimato usato</div>
          <div className={`text-3xl sm:text-4xl font-black italic tracking-tighter tabular-nums ${a.text}`}>
            {pct}<span className="text-sm text-[#8e8e93]">%</span>
          </div>
        </div>
      </div>

      <div className="relative z-10 space-y-2">
        <div className="h-2.5 bg-black/50 rounded-full overflow-hidden border border-white/5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className={`h-full ${a.bar} shadow-[0_0_12px_rgba(96,165,250,0.6)]`}
          />
        </div>
        <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-[#8e8e93]">
          <span className="tabular-nums">{tankL - litersLeft}L usati</span>
          <span className="tabular-nums">{litersLeft}L rimasti</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 relative z-10">
        <div className="bg-black/40 p-3.5 rounded-[18px] border border-white/5 min-w-0">
          <div className="flex items-center gap-1 mb-1"><Gauge size={11} className="text-[#8e8e93]" /><span className="text-[9px] font-black text-[#8e8e93] uppercase tracking-[0.2em] truncate">Autonomia</span></div>
          <div className="text-[14px] font-black italic text-white tracking-tighter tabular-nums truncate">~{rangeLeft} km</div>
        </div>
        <div className="bg-black/40 p-3.5 rounded-[18px] border border-white/5 min-w-0">
          <div className="flex items-center gap-1 mb-1"><Clock size={11} className="text-[#8e8e93]" /><span className="text-[9px] font-black text-[#8e8e93] uppercase tracking-[0.2em] truncate">Km/giorno</span></div>
          <div className="text-[14px] font-black italic text-white tracking-tighter tabular-nums truncate">{Math.round(p.kmPerDay)}</div>
        </div>
        <div className="bg-black/40 p-3.5 rounded-[18px] border border-white/5 min-w-0">
          <div className="flex items-center gap-1 mb-1"><Fuel size={11} className="text-[#8e8e93]" /><span className="text-[9px] font-black text-[#8e8e93] uppercase tracking-[0.2em] truncate">Da</span></div>
          <div className="text-[14px] font-black italic text-white tracking-tighter tabular-nums truncate">{Math.round(p.daysSinceLast)}gg</div>
        </div>
      </div>
    </div>
  );
}

function MonthlyChart({ months }: { months: MonthBucket[] }) {
  const totalAll = months.reduce((a, b) => a + b.total, 0);
  const litersAll = months.reduce((a, b) => a + b.liters, 0);
  const fillsAll = months.reduce((a, b) => a + b.count, 0);
  const maxV = Math.max(...months.map(m => m.total), 1);
  const last = months[months.length - 1];
  const prev = months[months.length - 2];
  const deltaPct = (last && prev && prev.total > 0)
    ? ((last.total - prev.total) / prev.total) * 100
    : null;
  const avg = months.filter(m => m.total > 0).length > 0
    ? totalAll / months.filter(m => m.total > 0).length
    : 0;

  return (
    <div className="bg-[#0a0f1d] p-6 sm:p-8 rounded-[36px] sm:rounded-[48px] border border-blue-500/30 space-y-6 relative overflow-hidden shadow-2xl">
      <div className="absolute -top-20 -right-20 w-80 h-80 bg-blue-600/10 blur-[100px] pointer-events-none rounded-full" />

      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400 mb-2">Spesa Mensile</div>
          <div className="text-3xl sm:text-4xl font-black italic tracking-tighter text-white tabular-nums">
            {fmtEUR(totalAll)}
          </div>
          <div className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-widest mt-1">
            Ultimi 12 mesi · {fillsAll} pieni · {litersAll.toFixed(0)}L
          </div>
        </div>
        {deltaPct != null && (
          <div className={`flex flex-col items-end gap-1 flex-shrink-0 ${deltaPct <= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            <div className="flex items-center gap-1.5 text-[12px] font-black uppercase tracking-widest tabular-nums">
              {deltaPct <= 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
              {deltaPct >= 0 ? '+' : ''}{deltaPct.toFixed(0)}%
            </div>
            <div className="text-[9px] font-bold text-[#8e8e93] uppercase tracking-widest">vs mese prec.</div>
          </div>
        )}
      </div>

      <MonthlyBars months={months} max={maxV} avg={avg} />

      <div className="grid grid-cols-3 gap-3 relative z-10">
        <MiniCell label="Media/mese" value={avg > 0 ? fmtEURFine(avg) : '—'} />
        <MiniCell label="Mese peggiore" value={maxV > 0 ? fmtEURFine(maxV) : '—'} />
        <MiniCell label="Ultimo" value={last && last.total > 0 ? fmtEURFine(last.total) : '—'} />
      </div>
    </div>
  );
}

function MonthlyBars({ months, max, avg }: { months: MonthBucket[]; max: number; avg: number }) {
  const W = 320, H = 140, P = 8, GAP = 4;
  const colW = (W - P * 2 - GAP * (months.length - 1)) / months.length;
  const barArea = H - 24;
  const avgY = avg > 0 ? P + (1 - avg / max) * (barArea - P * 2) : null;

  return (
    <div className="relative z-10 bg-black/40 backdrop-blur-xl p-5 rounded-[24px] border border-white/5 shadow-inner">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[140px]" preserveAspectRatio="none">
        <defs>
          <linearGradient id="barGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgb(59,130,246)" stopOpacity="1" />
            <stop offset="100%" stopColor="rgb(59,130,246)" stopOpacity="0.25" />
          </linearGradient>
          <linearGradient id="barLast" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgb(96,165,250)" stopOpacity="1" />
            <stop offset="100%" stopColor="rgb(96,165,250)" stopOpacity="0.5" />
          </linearGradient>
        </defs>

        {avgY != null && (
          <>
            <line x1={P} x2={W - P} y1={avgY} y2={avgY} stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="3 3" />
            <text x={W - P} y={avgY - 3} fill="rgba(255,255,255,0.4)" fontSize="8" fontWeight="900" textAnchor="end" letterSpacing="0.15em">MEDIA</text>
          </>
        )}

        {months.map((m, i) => {
          const x = P + i * (colW + GAP);
          const h = max > 0 ? (m.total / max) * (barArea - P) : 0;
          const y = barArea - h;
          const isLast = i === months.length - 1;
          const isEmpty = m.total === 0;
          const minH = isEmpty ? 2 : Math.max(h, 3);
          return (
            <g key={m.key}>
              <rect
                x={x}
                y={isEmpty ? barArea - 2 : y}
                width={colW}
                height={isEmpty ? 2 : minH}
                rx="3"
                fill={isEmpty ? 'rgba(255,255,255,0.08)' : isLast ? 'url(#barLast)' : 'url(#barGrad)'}
                stroke={isLast && !isEmpty ? 'rgba(96,165,250,0.6)' : 'none'}
                strokeWidth="1"
              />
              <text
                x={x + colW / 2}
                y={H - 6}
                fill={isLast ? 'rgb(96,165,250)' : 'rgba(255,255,255,0.4)'}
                fontSize="9"
                fontWeight="900"
                textAnchor="middle"
                letterSpacing="0.05em"
              >
                {m.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function MiniCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-black/40 p-3 rounded-[18px] border border-white/5 min-w-0">
      <div className="text-[9px] font-black text-[#8e8e93] uppercase tracking-[0.2em] truncate">{label}</div>
      <div className="text-[14px] font-black italic text-white tracking-tighter tabular-nums truncate mt-1">{value}</div>
    </div>
  );
}

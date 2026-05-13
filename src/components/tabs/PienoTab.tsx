import { useMemo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Car, TrendingUp, TrendingDown } from 'lucide-react';
import { FillupTracker } from '../FillupTracker';
import { fillupsForCar, computeMonthlySpend, type MonthBucket } from '../../services/fillupService';

interface Props {
  selectedCar: any;
  setTab: (t: any) => void;
}

const fmtEUR = (n: number) => '€' + n.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtEURFine = (n: number) => '€' + n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function PienoTab({ selectedCar, setTab }: Props) {
  const [refreshKey, setRefreshKey] = useState(0);
  const fills = useMemo(
    () => selectedCar ? fillupsForCar(selectedCar.model) : [],
    [selectedCar, refreshKey]
  );
  const months = useMemo(() => computeMonthlySpend(fills, 12), [fills]);

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

      <MonthlyChart months={months} />

      <FillupTracker
        carModel={selectedCar.model}
        carTags={selectedCar.tags}
        wltpKml={selectedCar.kml}
        tankLiters={selectedCar.liters}
      />
    </motion.div>
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

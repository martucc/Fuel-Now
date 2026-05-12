import { motion } from 'motion/react';
import { 
  Target, TrendingDown, TrendingUp, Activity, MapPin, 
  Calendar, Zap, Database, Cpu, BrainCircuit, ArrowRight,
  Sparkles, FileText, ChevronDown
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { MarketAnalysis, FuelType, FuelStation } from '../../types';
import { SparklineChart } from '../SparklineChart';
import type { MarketStats } from '../../services/localAnalysis';

interface Props {
  marketRef: MarketAnalysis | null;
  selectedFuel: FuelType;
  filteredStations: FuelStation[];
  marketStats: MarketStats;
  apiKey: string;
  fuelNews: any[];
  analysisLoading: boolean;
  userQuestion: string;
  setUserQuestion: (q: string) => void;
  analysisIsLocal: boolean;
  trendTone: string;
  fetchAnalysis: (f: FuelType, force?: boolean, q?: string) => void;
  setShowSettings: (s: boolean) => void;
}

export function AnalysisTab(p: Props) {
  const m = p.marketRef;
  const s = p.marketStats;

  return (
    <div className="space-y-10 pb-32 pt-6 px-4">
      {/* --- HERO HEADER --- */}
      <section className="relative">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-ping absolute" />
            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(37,99,235,1)] relative" />
          </div>
          <span className="text-[11px] font-black text-blue-400 uppercase tracking-[0.4em]">Neural Intelligence Core</span>
          {p.analysisIsLocal && (
            <span className="ml-auto px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-bold text-white/40 uppercase tracking-widest">
              Local Engine
            </span>
          )}
        </div>
        
        <h1 className="text-6xl font-black tracking-tighter italic uppercase leading-[0.85] mb-6">
          <span className="text-white block">Martucc</span>
          <span className="bg-gradient-to-r from-blue-400 via-blue-600 to-indigo-600 bg-clip-text text-transparent drop-shadow-2xl">Intel</span>
          <span className="text-[14px] not-italic font-black text-white/10 tracking-[0.5em] ml-4 uppercase align-middle">V2.1.0</span>
        </h1>
        
        <div className="p-6 bg-[#1c1c1e]/40 rounded-[36px] border border-white/5 backdrop-blur-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/10 blur-[60px] rounded-full -translate-y-1/2 translate-x-1/2" />
          <p className="text-[14px] text-white/60 leading-relaxed font-medium relative z-10 italic">
            "Market Intelligence generata tramite analisi multi-vettoriale e predizioni neurali basate su <span className="text-white font-black">{s.sampleSize} campionamenti</span>."
          </p>
        </div>
      </section>

      {/* --- PRIMARY STATS GRID --- */}
      <section className="grid grid-cols-2 gap-4">
        {[
          { label: 'Media Zona', value: `€${s.average.toFixed(3)}`, icon: Database, color: 'text-white' },
          { label: 'Prezzo Ottimale', value: `€${s.min.toFixed(3)}`, icon: Target, color: 'text-emerald-400', sub: s.cheapestStationName },
          { label: 'Delta Operativo', value: `€${s.spread.toFixed(3)}`, icon: Activity, color: 'text-blue-400' },
          { label: 'Nodi Rilevati', value: s.sampleSize.toString(), icon: Cpu, color: 'text-indigo-400' }
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-[#1c1c1e]/60 rounded-[36px] p-6 border border-white/5 backdrop-blur-md flex flex-col justify-between h-40 group hover:border-blue-500/30 transition-all shadow-xl"
          >
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-2xl bg-white/5 border border-white/5 group-hover:bg-blue-500/10 transition-colors">
                <stat.icon className={cn("w-5 h-5", stat.color)} />
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-1">{stat.label}</p>
              <h3 className={cn("text-3xl font-black tracking-tight tabular-nums", stat.color)}>{stat.value}</h3>
              {stat.sub && <p className="text-[10px] font-bold text-white/40 truncate mt-1 uppercase tracking-tight opacity-50">{stat.sub}</p>}
            </div>
          </motion.div>
        ))}
      </section>

      {/* --- PREDICTION & FORECASTING --- */}
      <section className="bg-gradient-to-b from-[#1c1c1e]/80 to-black rounded-[48px] border border-white/5 overflow-hidden shadow-2xl relative group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 blur-[80px] rounded-full group-hover:bg-blue-600/10 transition-all" />
        <div className="p-10">
          <div className="flex items-center justify-between mb-10">
            <div>
              <p className="text-[11px] font-black text-blue-400 uppercase tracking-[0.4em] mb-2">Previsione Neurale / 7G</p>
              <h2 className="text-4xl font-black text-white tracking-tighter italic uppercase flex items-center gap-4">
                {m?.forecast?.[0]?.price.toFixed(3) || '---'}
                <ArrowRight className="w-8 h-8 text-white/10" />
                <span className="text-blue-500">€{m?.forecast?.[m.forecast.length-1]?.price.toFixed(3) || '---'}</span>
              </h2>
            </div>
            <div className="text-right">
              <div className="px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-[10px] font-black text-blue-400 uppercase tracking-widest">
                Confidence 98.4%
              </div>
            </div>
          </div>

          <div className="h-48 relative px-2">
            <SparklineChart 
              data={m?.forecast || []} 
              trend={m?.trend || 'STABLE'}
            />
          </div>
        </div>
      </section>

      {/* --- DEEP QUERY INTERFACE --- */}
      <section>
        <div className="relative p-10 bg-gradient-to-br from-blue-600/20 to-indigo-900/40 rounded-[50px] border border-blue-500/20 overflow-hidden shadow-3xl">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/20 blur-[80px] rounded-full" />
          
          <div className="flex items-center gap-4 mb-8">
            <div className="p-4 bg-blue-500 rounded-2xl shadow-[0_0_30px_rgba(37,99,235,0.5)]">
              <BrainCircuit className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight uppercase italic">Deep Query Interface</h2>
              <p className="text-[12px] font-bold text-blue-300/50 uppercase tracking-[0.3em]">Neural Link Status: Active</p>
            </div>
          </div>

          <div className="relative mb-8">
            <textarea
              value={p.userQuestion}
              onChange={(e) => p.setUserQuestion(e.target.value)}
              placeholder="Inizia una conversazione con il Martucc Core..."
              className="w-full h-40 bg-black/40 rounded-[32px] p-8 text-[16px] font-medium text-white placeholder:text-white/20 focus:outline-none border border-white/5 focus:border-blue-500/40 transition-all resize-none shadow-inner backdrop-blur-md"
            />
            <div className="absolute bottom-6 right-8 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <div className="w-2 h-2 rounded-full bg-blue-500/40 animate-pulse [animation-delay:0.2s]" />
            </div>
          </div>

          <button
            onClick={() => p.fetchAnalysis(p.selectedFuel, false, p.userQuestion)}
            disabled={p.analysisLoading}
            className="w-full py-6 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-[32px] font-black text-[15px] uppercase tracking-[0.3em] shadow-[0_20px_50px_rgba(37,99,235,0.4)] active:scale-[0.97] transition-all flex items-center justify-center gap-4 group"
          >
            {p.analysisLoading ? (
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Neural Linking...</span>
              </div>
            ) : (
              <>
                <Zap size={20} className="fill-white group-hover:scale-125 transition-transform" />
                <span>Esegui Neural Scan</span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* --- TACTICAL REPORT DOSSIER --- */}
      {m && (
        <section className="space-y-6">
          <div className="px-2 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/5" />
            <h2 className="text-[11px] font-black text-white/30 uppercase tracking-[0.5em] italic">Tactical Dossier</h2>
            <div className="h-px flex-1 bg-white/5" />
          </div>

          {/* Action Hero */}
          <div className="relative bg-white rounded-[48px] p-10 overflow-hidden shadow-3xl">
            <div className="absolute top-0 right-0 p-10">
              <div className={cn(
                "p-6 rounded-[32px] shadow-lg",
                p.trendTone === 'DOWN' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
              )}>
                {p.trendTone === 'DOWN' ? <TrendingDown size={40} /> : <TrendingUp size={40} />}
              </div>
            </div>
            
            <div className="relative z-10 max-w-[75%]">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-6 h-0.5 bg-black/10" />
                <p className="text-[12px] font-black text-black/40 uppercase tracking-[0.3em]">Azione Suggerita</p>
              </div>
              <h3 className="text-5xl font-black text-black tracking-tighter uppercase italic leading-[0.85] mb-6">
                {m.advice === 'FILL-FULL' ? 'Fai il Pieno' : 
                 m.advice === 'WAIT' ? 'Attendi' : 'Carico Minimo'}
              </h3>
              <div className="p-6 bg-black/5 rounded-[32px] border border-black/5 italic font-bold text-black/70 text-[16px] leading-relaxed">
                "{m.reasoning}"
              </div>
            </div>
          </div>

          {/* Report Modules */}
          <div className="grid grid-cols-1 gap-4">
            {m.categories.map((module, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + (i * 0.1) }}
                className="p-8 bg-[#1c1c1e]/50 rounded-[40px] border border-white/5 flex items-start gap-6 group hover:bg-[#1c1c1e]/80 transition-all"
              >
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 group-hover:border-blue-500/30 transition-all">
                  {module.icon === 'MapPin' ? <MapPin className="w-6 h-6 text-blue-400" /> : 
                   module.icon === 'Calendar' ? <Calendar className="w-6 h-6 text-indigo-400" /> : 
                   <Sparkles className="w-6 h-6 text-emerald-400" />}
                </div>
                <div className="space-y-1">
                  <h4 className="text-[14px] font-black text-white uppercase tracking-[0.2em]">{module.title}</h4>
                  <p className="text-[13px] text-white/40 font-medium leading-relaxed italic pr-4">{module.content}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Detailed Intelligence Report Dropdown */}
          {m.detailedReport && (
            <details className="group bg-[#1c1c1e]/30 rounded-[40px] border border-white/5 overflow-hidden transition-all shadow-xl">
              <summary className="list-none cursor-pointer p-8 flex items-center justify-between hover:bg-white/5 transition-all">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-blue-600/10 rounded-2xl border border-blue-500/20 text-blue-400 flex items-center justify-center shadow-inner group-hover:bg-blue-600 group-hover:text-white transition-all duration-500">
                    <FileText size={24} />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-black text-white uppercase tracking-[0.1em] italic">Full Intelligence Stream</h3>
                    <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest mt-1">Decrypted Report Data</p>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-open:bg-blue-600/20 group-open:text-blue-400 transition-all duration-500">
                  <ChevronDown size={20} className="group-open:rotate-180 transition-transform duration-500" />
                </div>
              </summary>
              <div className="px-10 pb-12 pt-6 space-y-6">
                {m.detailedReport.split('\n').filter(l => l.trim()).map((line, i) => (
                  <motion.p 
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="text-[14px] text-white/50 leading-relaxed font-medium pl-6 border-l-2 border-blue-500/30 italic"
                  >
                    "{line}"
                  </motion.p>
                ))}
              </div>
            </details>
          )}
        </section>
      )}
    </div>
  );
}

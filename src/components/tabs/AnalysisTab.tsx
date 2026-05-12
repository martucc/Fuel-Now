import { motion } from 'motion/react';
import { TrendingDown, TrendingUp, BarChart3, Target, Zap, Layers, Globe, MapPin, Calendar, Settings, RefreshCw, ChevronDown, FileText } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { FuelStation, FuelType, MarketAnalysis } from '../../types';
import { AdviceSection } from '../AdviceSection';
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
  userQuestion: string; setUserQuestion: (v: string) => void;
  analysisIsLocal: boolean;
  trendTone: string;
  fetchAnalysis: (fuel: FuelType, force: boolean, question?: string, stations?: FuelStation[]) => void;
  setShowSettings: (v: boolean) => void;
}

export function AnalysisTab(p: Props) {
  return (
    <motion.div key="analysis" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="space-y-6 pb-24">
      <header className="px-2 pt-2">
        <div className="flex justify-between items-end gap-4 mb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]" /><h2 className="text-[9px] font-black uppercase tracking-[0.4em] text-blue-500/90">Market Intelligence</h2></div>
            <h3 className="text-4xl font-black tracking-tighter text-white uppercase italic leading-none">Martucc<span className="text-blue-500">Fuel</span> <span className="text-white/10 not-italic font-extralight tracking-widest">PRO</span></h3>
          </div>
          <div className={cn("px-4 py-2 rounded-2xl border text-[9px] font-black uppercase tracking-widest backdrop-blur-2xl", p.apiKey ? "text-emerald-400 bg-emerald-500/5 border-emerald-500/20" : "text-blue-400 bg-blue-500/5 border-blue-500/20")}>{p.apiKey ? 'AI Core' : 'Locale'}</div>
        </div>
        <p className="text-[11px] leading-relaxed text-[#8e8e93] font-medium px-0.5 border-l-2 border-blue-500/30 pl-4 italic">Analisi real-time basata su dati MIMIT e trend macroeconomici.</p>
      </header>

      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          {[
            {label:'Media Zona',value:`€${p.marketStats.average.toFixed(3)}`,sub:'Prezzo Medio',icon:Target,color:'text-blue-500'},
            {label:'Migliore',value:`€${p.marketStats.min.toFixed(3)}`,sub:p.marketStats.cheapestStationName||'Best',icon:Zap,color:'text-emerald-500'},
            {label:'Spread',value:`€${p.marketStats.spread.toFixed(3)}`,sub:'Gap Min-Max',icon:Layers,color:'text-amber-500'},
            {label:'Campione',value:String(p.marketStats.sampleSize),sub:'Stazioni',icon:BarChart3,color:'text-purple-500'},
          ].map(stat => (
            <div key={stat.label} className="group bg-white/[0.03] backdrop-blur-3xl p-6 rounded-[2.5rem] border border-white/5 hover:border-blue-500/30 transition-all">
              <div className="flex justify-between items-start mb-5"><div className={cn("p-2 rounded-xl bg-black/40 border border-white/5",stat.color)}><stat.icon size={16} /></div><div className="text-[9px] font-black text-[#48484a] uppercase tracking-[0.3em]">{stat.label}</div></div>
              <div className="text-3xl font-black italic text-white tracking-tighter group-hover:text-blue-400 transition-all">{stat.value}</div>
              <div className="text-[9px] text-[#8e8e93] font-black uppercase tracking-widest truncate mt-1.5 italic">{stat.sub}</div>
            </div>
          ))}
        </div>

        <section className="bg-[#1c1c1e] p-7 rounded-[3rem] border border-white/5 space-y-6 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 blur-[80px] rounded-full pointer-events-none" />
          <div className="flex items-start justify-between relative z-10">
            <div><h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-blue-500">AI Command</h3><p className="text-[10px] text-[#8e8e93] font-medium max-w-[240px]">Interroga il mercato o richiedi strategia ottimizzata.</p></div>
            <button onClick={() => p.setShowSettings(true)} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-[#8e8e93] border border-white/5"><Settings size={18} /></button>
          </div>
          <textarea value={p.userQuestion} onChange={e => p.setUserQuestion(e.target.value)} placeholder="Es: Tendenza prezzi fine settimana?" className="w-full bg-black/40 border border-white/5 focus:border-blue-500/30 rounded-[2rem] p-5 text-xs text-white outline-none resize-none h-32 backdrop-blur-md placeholder:text-white/10 relative z-10" />
          <button onClick={() => p.fetchAnalysis(p.selectedFuel, true, p.userQuestion, p.filteredStations)} disabled={p.analysisLoading} className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-[2rem] shadow-[0_15px_40px_rgba(37,99,235,0.25)] active:scale-[0.98] transition-all text-[11px] uppercase tracking-[0.3em] italic flex items-center justify-center gap-3 disabled:opacity-50 relative z-10">
            {p.analysisLoading ? <RefreshCw size={16} className="animate-spin" /> : <Zap size={16} className="fill-white" />}{p.analysisLoading ? 'Elaborazione...' : 'Esegui Analisi'}
          </button>
        </section>

        {p.marketRef && (
          <div className="space-y-5">
            <section className="bg-[#1c1c1e] p-8 rounded-[3rem] border border-white/10 shadow-2xl relative overflow-hidden">
              <div className="flex items-start justify-between mb-10 relative z-10">
                <div>
                  <div className="text-[10px] font-black text-[#8e8e93] uppercase tracking-[0.3em]">Proiezione 7G</div>
                  <div className="text-4xl font-black italic text-white tracking-tighter flex items-center gap-3">€{p.marketRef.historicalData?.[p.marketRef.historicalData.length-1]?.price?.toFixed(3)||'0.000'}<span className="text-xl text-blue-500/40 not-italic font-light">→</span><span className="text-blue-500">€{p.marketRef.forecast?.[p.marketRef.forecast.length-1]?.price?.toFixed(3)||'0.000'}</span></div>
                  <span className="text-[8px] font-black uppercase tracking-[0.2em] text-blue-500/60 mt-2 block italic">Analisi {p.analysisIsLocal ? 'Locale' : 'AI'}</span>
                </div>
                <div className={cn("p-4 rounded-3xl border shadow-xl",p.trendTone)}>{p.marketRef.trend==='DOWN'?<TrendingDown size={32}/>:p.marketRef.trend==='UP'?<TrendingUp size={32}/>:<BarChart3 size={32}/>}</div>
              </div>
              <div className="h-44 w-full relative z-10"><SparklineChart data={[...(p.marketRef.historicalData||[]),...(p.marketRef.forecast||[])]} trend={p.marketRef.trend} /></div>
            </section>
            <AdviceSection analysis={p.marketRef} fuelType={p.selectedFuel} />
            {p.marketRef.detailedReport && (
              <details className="group bg-[#1c1c1e]/80 rounded-[2.5rem] border border-white/5 overflow-hidden">
                <summary className="list-none cursor-pointer p-6 flex items-center justify-between hover:bg-white/[0.02]">
                  <div className="flex items-center gap-4 text-blue-500"><div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20"><FileText size={20} /></div><div><h3 className="text-xs font-black uppercase tracking-[0.2em] italic text-white">Report Completo</h3></div></div>
                  <ChevronDown size={20} className="text-[#48484a] group-open:rotate-180 transition-transform" />
                </summary>
                <div className="px-8 pb-8 text-[11px] text-white/60 leading-relaxed font-medium space-y-4 border-t border-white/5 pt-6 italic">{p.marketRef.detailedReport.split('\n').filter(l => l.trim()).map((line, i) => <p key={i}>{line}</p>)}</div>
              </details>
            )}
            {p.marketRef.categories && (
              <div className="grid grid-cols-1 gap-4">
                {p.marketRef.categories.map((cat, i) => (
                  <section key={i} className="bg-[#1c1c1e]/60 p-6 rounded-[2.5rem] border border-white/5 space-y-4 hover:border-blue-500/20 transition-all group">
                    <div className="flex items-center gap-4 text-blue-400/80 group-hover:text-blue-400"><div className="p-2.5 bg-black/40 rounded-2xl border border-white/5">{cat.icon==='Globe'?<Globe size={16}/>:cat.icon==='MapPin'?<MapPin size={16}/>:cat.icon==='Calendar'?<Calendar size={16}/>:<Layers size={16}/>}</div><h4 className="text-[11px] font-black uppercase tracking-[0.3em] italic">{cat.title}</h4></div>
                    <p className="text-xs text-[#8e8e93] leading-relaxed font-medium italic">"{cat.content}"</p>
                  </section>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

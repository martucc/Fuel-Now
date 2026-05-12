import React from 'react';
import { Droplets, Calculator, Wallet, TrendingUp, Fuel, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import type { MarketAnalysis, FuelType } from '../types';

export function AdviceSection({ analysis, fuelType }: { analysis: MarketAnalysis; fuelType: FuelType }) {
  const d = (() => {
    switch (analysis.advice) {
      case 'FILL-FULL': return { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: <Droplets />, text: 'Fai il Pieno', sub: 'Prezzo ottimale rilevato' };
      case 'WAIT': return { color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: <Calculator />, text: 'Attesa Strategica', sub: 'Trend in contrazione' };
      case 'TEN-EURO': return { color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20', icon: <Wallet />, text: 'Rifornimento Minimo', sub: 'Attendi calo imminente' };
      case 'URGENT': return { color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: <TrendingUp />, text: 'Azione Urgente', sub: 'Rincaro rilevato' };
      default: return { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: <Fuel />, text: 'Analisi Pronta', sub: 'Intel disponibile' };
    }
  })();

  return (
    <div className="relative group overflow-hidden bg-white/[0.02] backdrop-blur-3xl rounded-[3rem] p-8 border border-white/10 shadow-2xl transition-all hover:border-blue-500/30">
      <div className={cn("absolute -top-24 -right-24 w-64 h-64 opacity-[0.08] blur-[60px] rounded-full", d.bg)} />
      <div className="flex items-start justify-between relative z-10 mb-8">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", d.color.replace('text', 'bg'))} />
            <p className={cn("text-[9px] font-black uppercase tracking-[0.4em]", d.color)}>AI Tactical — {fuelType}</p>
          </div>
          <h3 className="text-4xl font-black italic tracking-tighter text-white uppercase leading-none">{d.text}</h3>
          <p className="text-[#8e8e93] font-bold text-xs uppercase tracking-[0.2em] mt-2 italic opacity-60">{d.sub}</p>
        </div>
        <div className={cn("p-5 rounded-[2rem] flex items-center justify-center border backdrop-blur-xl shadow-2xl", d.bg, d.border)}>
          {React.cloneElement(d.icon as React.ReactElement<any>, { size: 32, className: d.color })}
        </div>
      </div>
      <div className="p-6 bg-black/60 rounded-[2.5rem] border border-white/5 relative z-10">
        <p className="text-xs leading-relaxed text-[#8e8e93] font-medium italic">
          <span className="text-blue-500/50 mr-2">/</span> {analysis.reasoning}
        </p>
      </div>
      <div className="flex items-center gap-2 text-[10px] font-black text-blue-500 mt-6 cursor-pointer group/link relative z-10 uppercase tracking-[0.3em] italic">
        Dettagli Completi <ChevronRight size={14} className="group-hover/link:translate-x-2 transition-transform duration-500" />
      </div>
    </div>
  );
}

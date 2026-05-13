import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  TrendingDown, TrendingUp, ArrowUpRight, Send, ChevronRight,
  MapPin, Calendar, Sparkles, Activity, Brain, Zap, Newspaper, Lightbulb,
  Clock, History, ShieldCheck, RefreshCw, Target,
  ArrowRight, X, MessageSquare, Database, Maximize2, BarChart2, Radio,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { MarketAnalysis, FuelType, FuelStation } from '../../types';
import type { MarketStats } from '../../services/localAnalysis';
import {
  loadHistory, getSeries, rangeStats, pctDelta,
  type HistoryPoint, type Period,
} from '../../services/historyService';
import { PriceChart } from '../charts/PriceChart';
import { TickerTape } from '../charts/TickerTape';
import { PriceDistribution } from '../charts/PriceDistribution';

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
  setSelectedFuel?: (f: FuelType) => void;
  tankLiters: number;
  aiAnswer: { question: string; answer: string; ts: number; source: 'ai' | 'local' } | null;
  clearAiAnswer: () => void;
}

const PERIODS: Period[] = ['1M', '3M', '6M', '1Y', '5Y', 'MAX'];

const adviceLabel = (a?: string) => {
  switch (a) {
    case 'FILL-FULL': return 'Fai il pieno';
    case 'WAIT': return 'Aspetta';
    case 'TEN-EURO': return 'Carico minimo';
    case 'URGENT': return 'Azione urgente';
    default: return 'In valutazione';
  }
};

const adviceTint = (a?: string) =>
  a === 'FILL-FULL' ? 'text-emerald-400'
  : a === 'WAIT' ? 'text-blue-400'
  : a === 'TEN-EURO' ? 'text-amber-400'
  : 'text-orange-400';

const fmtTimeAgo = (iso?: string) => {
  if (!iso) return null;
  const ts = new Date(iso).getTime();
  if (!isFinite(ts)) return null;
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'ora';
  if (m < 60) return `${m} min fa`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h fa`;
  const d = Math.floor(h / 24);
  return `${d}g fa`;
};

export function AnalysisTab(p: Props) {
  const [history, setHistory] = useState<Record<string, HistoryPoint[]>>({});
  const [period, setPeriod] = useState<Period>('1Y');
  const [hover, setHover] = useState<HistoryPoint | null>(null);

  useEffect(() => { loadHistory().then(setHistory); }, []);

  const series = useMemo(() => getSeries(history, p.selectedFuel, period), [history, p.selectedFuel, period]);
  const stats = useMemo(() => rangeStats(series), [series]);
  const delta = useMemo(() => pctDelta(series), [series]);
  const last = series[series.length - 1];

  const series52w = useMemo(() => getSeries(history, p.selectedFuel, '1Y'), [history, p.selectedFuel]);
  const stats52w = useMemo(() => rangeStats(series52w), [series52w]);

  const todayBest = useMemo(() => {
    const prices = p.filteredStations
      .map(s => s.prices.find(pp => pp.type === p.selectedFuel)?.price || 0)
      .filter(v => v > 0.5);
    return prices.length ? Math.min(...prices) : null;
  }, [p.filteredStations, p.selectedFuel]);

  // === AI PULSE — intuitive verdict cockpit ===
  const aiPulse = useMemo(() => {
    const fc = p.marketRef?.forecast || [];
    if (fc.length < 2 && !todayBest) return null;
    const fStart = fc[0]?.price ?? todayBest ?? p.marketStats.average;
    const fEnd = fc[fc.length - 1]?.price ?? fStart;
    const fcDelta = fStart > 0 ? ((fEnd - fStart) / fStart) * 100 : 0;
    // Conviction tiered
    const mag = Math.min(1, Math.abs(fcDelta) / 3);
    const samp = Math.min(1, (p.marketStats.sampleSize || 0) / 80);
    const cons = Math.sign(fcDelta) === Math.sign(delta) && delta !== 0 ? 1 : 0.4;
    const score = (mag * 0.45 + samp * 0.25 + cons * 0.30) * 100;
    const convictionTier: 'Alta' | 'Media' | 'Bassa' = score >= 65 ? 'Alta' : score >= 35 ? 'Media' : 'Bassa';
    const convictionPct = Math.round(score);

    // Verdict: clear instruction
    let verdict: { label: string; action: string; tone: string; bg: string; icon: 'fill' | 'wait' | 'neutral' };
    if (fcDelta < -0.8) {
      verdict = { label: 'Aspetta', action: `il prezzo scende del ${Math.abs(fcDelta).toFixed(1)}% in 7 giorni`, tone: 'text-emerald-400', bg: 'bg-emerald-500/12 border-emerald-500/30', icon: 'wait' };
    } else if (fcDelta > 0.8) {
      verdict = { label: 'Fai pieno ora', action: `il prezzo sale del ${fcDelta.toFixed(1)}% in 7 giorni`, tone: 'text-red-400', bg: 'bg-red-500/12 border-red-500/30', icon: 'fill' };
    } else if (fcDelta < -0.2) {
      verdict = { label: 'Aspetta poco', action: 'lieve calo previsto', tone: 'text-emerald-300', bg: 'bg-emerald-500/8 border-emerald-500/20', icon: 'wait' };
    } else if (fcDelta > 0.2) {
      verdict = { label: 'Meglio adesso', action: 'lieve rialzo previsto', tone: 'text-red-300', bg: 'bg-red-500/8 border-red-500/20', icon: 'fill' };
    } else {
      verdict = { label: 'Indifferente', action: 'mercato stabile', tone: 'text-zinc-300', bg: 'bg-zinc-800/40 border-zinc-700', icon: 'neutral' };
    }

    const savings = (fStart - fEnd) * p.tankLiters;

    return { fcDelta, convictionTier, convictionPct, verdict, savings, fStart, fEnd, tank: p.tankLiters };
  }, [p.marketRef?.forecast, p.marketStats, delta, todayBest, p.tankLiters]);

  // === HISTORICAL COMPARE — from history.csv ===
  const historicalCompare = useMemo(() => {
    if (!last) return null;
    const all = history[p.selectedFuel.toLowerCase()] || [];
    if (all.length < 30) return null;
    const findClosest = (targetTs: number) => {
      let best: HistoryPoint | null = null;
      let bestDiff = Infinity;
      for (const pt of all) {
        const d = Math.abs(pt.ts - targetTs);
        if (d < bestDiff) { bestDiff = d; best = pt; }
      }
      return best;
    };
    const now = last.ts;
    const wk1 = findClosest(now - 7 * 86400000);
    const mo1 = findClosest(now - 30 * 86400000);
    const yr1 = findClosest(now - 365 * 86400000);
    const yr3 = findClosest(now - 365 * 3 * 86400000);
    const calc = (ref: HistoryPoint | null) => ref ? ((last.avg - ref.avg) / ref.avg) * 100 : null;
    return [
      { label: '1 settimana fa', price: wk1?.avg, delta: calc(wk1) },
      { label: '1 mese fa', price: mo1?.avg, delta: calc(mo1) },
      { label: '1 anno fa', price: yr1?.avg, delta: calc(yr1) },
      { label: '3 anni fa', price: yr3?.avg, delta: calc(yr3) },
    ].filter(x => x.price != null);
  }, [history, p.selectedFuel, last]);

  // === STRATEGY — best window (min point in forecast) ===
  const strategy = useMemo(() => {
    const fc = p.marketRef?.forecast || [];
    if (fc.length < 3) return null;
    let minIdx = 0;
    for (let i = 1; i < fc.length; i++) if (fc[i].price < fc[minIdx].price) minIdx = i;
    const minPt = fc[minIdx];
    const todayInForecast = fc[0].price;
    // forecast[0] = +1g (domani), forecast[6] = +7g
    const daysAhead = minIdx + 1;
    // Prova a parsare la data: ISO ('2026-05-17') oppure formato locale '+Ng'
    let targetDate: Date;
    const parsed = new Date(minPt.date);
    if (!isNaN(parsed.getTime()) && minPt.date.includes('-')) {
      targetDate = parsed;
    } else {
      targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + daysAhead);
    }
    const saved = (todayInForecast - minPt.price) * p.tankLiters;
    return {
      day: minIdx === 0 ? 'domani' : `tra ${daysAhead} giorni`,
      dayLabel: targetDate.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'short' }),
      price: minPt.price,
      saved,
      worthIt: saved > 1,
    };
  }, [p.marketRef?.forecast, p.tankLiters]);

  // === RISK FACTORS / TRUST ===
  const risks = useMemo(() => {
    type Item = { icon: any; label: string; status: 'good' | 'mid' | 'bad'; statusLabel: string; value: string; hint: string };
    const items: Item[] = [];
    const sample = p.marketStats.sampleSize;
    items.push({
      icon: Database,
      label: 'Dati zona',
      status: sample >= 50 ? 'good' : sample >= 15 ? 'mid' : 'bad',
      statusLabel: sample >= 50 ? 'Affidabile' : sample >= 15 ? 'Limitato' : 'Insufficiente',
      value: `${sample} stazioni`,
      hint: sample >= 50 ? 'Campione robusto, prezzi rappresentativi.'
        : sample >= 15 ? 'Pochi distributori, allarga il raggio per piu accuratezza.'
        : 'Troppe poche stazioni, prezzi poco affidabili in zona.',
    });
    const spread = p.marketStats.spread;
    items.push({
      icon: Maximize2,
      label: 'Spread',
      status: spread < 0.15 ? 'good' : spread < 0.30 ? 'mid' : 'bad',
      statusLabel: spread < 0.15 ? 'Compatto' : spread < 0.30 ? 'Ampio' : 'Estremo',
      value: `€${spread.toFixed(3)}`,
      hint: spread < 0.15 ? 'Differenze piccole, conviene la stazione vicina.'
        : spread < 0.30 ? 'Vale la pena cercare: differenze sensibili tra distributori.'
        : 'Forti anomalie zonali, controlla bene le stazioni piu economiche.',
    });
    items.push({
      icon: BarChart2,
      label: 'Volatilita',
      status: stats.vol < 0.02 ? 'good' : stats.vol < 0.05 ? 'mid' : 'bad',
      statusLabel: stats.vol < 0.02 ? 'Stabile' : stats.vol < 0.05 ? 'Mossa' : 'Turbolenta',
      value: `±${(stats.vol * 100).toFixed(1)}c`,
      hint: stats.vol < 0.02 ? 'Prezzi piatti nel periodo, forecast piu affidabile.'
        : stats.vol < 0.05 ? 'Oscillazioni normali, possibili rimbalzi giornalieri.'
        : 'Mercato agitato, forecast meno preciso del solito.',
    });
    const newsImpact = (p.fuelNews || []).filter(n => (n.impact || '').toLowerCase() === 'negative' || (n.impact || '').toLowerCase() === 'bad').length;
    items.push({
      icon: Radio,
      label: 'News',
      status: newsImpact === 0 ? 'good' : newsImpact === 1 ? 'mid' : 'bad',
      statusLabel: newsImpact === 0 ? 'Calme' : newsImpact === 1 ? 'Una negativa' : `${newsImpact} negative`,
      value: newsImpact === 0 ? 'Nessun rischio' : `${newsImpact} eventi`,
      hint: newsImpact === 0 ? 'Nessuna notizia che spinga il prezzo al rialzo.'
        : newsImpact === 1 ? 'Una notizia potenzialmente rialzista, monitora.'
        : 'Piu eventi rialzisti in agenda, possibile aumento a breve.',
    });
    // Overall verdict
    const goodCount = items.filter(i => i.status === 'good').length;
    const badCount = items.filter(i => i.status === 'bad').length;
    const overall = badCount >= 2 ? { status: 'bad' as const, label: 'Bassa', message: 'Dati limitati o turbolenza in corso — prendi le previsioni con cautela.' }
      : badCount === 1 || goodCount <= 1 ? { status: 'mid' as const, label: 'Media', message: 'Indicatori misti — l\'analisi è indicativa ma non perfetta.' }
      : { status: 'good' as const, label: 'Alta', message: 'Dati abbondanti e mercato stabile, l\'analisi è affidabile.' };
    return { items, overall };
  }, [p.marketStats, stats.vol, p.fuelNews]);

  // === AI BRIEF — paragrafo riassuntivo ===
  const aiBrief = useMemo(() => {
    if (!p.marketRef) return null;
    const m = p.marketRef;
    const avg = p.marketStats.average;
    const localFastFacts = [
      todayBest && `prezzo minimo zona €${todayBest.toFixed(3)}`,
      avg > 0 && `media €${avg.toFixed(3)}`,
      historicalCompare?.[2] && `1 anno fa ${historicalCompare[2].delta! > 0 ? '+' : ''}${historicalCompare[2].delta!.toFixed(1)}% vs oggi`,
    ].filter(Boolean).join(' · ');
    const sentimentLine = aiPulse?.verdict.label === 'Aspetta' || aiPulse?.verdict.label === 'Aspetta poco'
      ? "Trend favorevole all'acquirente."
      : aiPulse?.verdict.label === 'Fai pieno ora' || aiPulse?.verdict.label === 'Meglio adesso'
      ? 'Trend sfavorevole, conviene anticipare.'
      : 'Mercato stabile.';
    return {
      sentiment: sentimentLine,
      facts: localFastFacts,
      reasoning: m.reasoning,
    };
  }, [p.marketRef, p.marketStats, todayBest, historicalCompare, aiPulse]);

  const quickPrompts = useMemo(() => [
    'Conviene fare il pieno oggi?',
    `Storico ${p.selectedFuel.toLowerCase()} ultimi 3 mesi?`,
    'Cosa influisce sul prezzo questa settimana?',
    'Mi conviene aspettare lunedi?',
  ], [p.selectedFuel]);

  const news = useMemo(() => (p.fuelNews || []).slice(0, 3), [p.fuelNews]);

  const trend: 'UP' | 'DOWN' | 'STABLE' = delta > 0.05 ? 'UP' : delta < -0.05 ? 'DOWN' : 'STABLE';
  const trendUp = trend === 'UP';
  const trendDown = trend === 'DOWN';
  const tColor = trendDown ? 'text-emerald-400' : trendUp ? 'text-red-400' : 'text-zinc-400';
  const tBg = trendDown ? 'bg-emerald-400/10' : trendUp ? 'bg-red-400/10' : 'bg-zinc-800/60';

  const displayPrice = hover ? hover.avg : (last?.avg ?? p.marketStats.average);
  const displayDate = hover ? new Date(hover.ts) : (last ? new Date(last.ts) : null);
  const m = p.marketRef;
  const cacheAge = fmtTimeAgo(m?.generatedAt);

  return (
    <motion.div
      key="analysis"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="pb-28 space-y-5"
    >
      {/* Header */}
      <header className="pt-2 px-1 flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-zinc-500 tracking-widest uppercase mb-1">Intel · IT</p>
          <h1 className="text-[36px] sm:text-[42px] font-semibold tracking-tight text-white leading-none">Mercato</h1>
        </div>
        {p.analysisIsLocal && (
          <span className="px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] font-semibold text-zinc-400 flex-shrink-0 uppercase tracking-wider">
            Locale
          </span>
        )}
      </header>

      {/* Loading banner — Gemini generation */}
      {p.analysisLoading && p.apiKey.trim().length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 py-3 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center gap-3 shadow-[0_0_24px_rgba(59,130,246,0.18)]"
        >
          <div className="relative w-4 h-4 flex-shrink-0">
            <div className="absolute inset-0 rounded-full border-2 border-blue-500/25" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-400 animate-spin" />
          </div>
          <p className="text-[11px] font-black text-blue-300 uppercase tracking-widest">
            Gemini sta generando l'analisi...
          </p>
        </motion.div>
      )}

      {/* Ticker tape */}
      <TickerTape
        history={history}
        selected={p.selectedFuel}
        onSelect={p.setSelectedFuel}
      />

      {/* Hero price card */}
      <section className="relative bg-gradient-to-b from-zinc-900/70 to-black rounded-3xl border border-blue-500/25 overflow-hidden shadow-[0_0_60px_rgba(37,99,235,0.22)]">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-600/8 via-transparent to-transparent" />
        <div className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 bg-blue-500/15 blur-[80px] rounded-full" />
        <div className="relative px-5 sm:px-6 pt-5 pb-3 flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-zinc-500 font-medium mb-1 tracking-wide">
              {p.selectedFuel} · {hover ? 'storico' : 'ultimo dato'}
              {displayDate && <span className="text-zinc-600"> · {displayDate.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-[48px] sm:text-[56px] font-semibold tracking-tight text-white tabular-nums leading-none">
                {displayPrice ? displayPrice.toFixed(3) : '—'}
              </span>
              <span className="text-[13px] text-zinc-500 font-medium">€/L</span>
            </div>
          </div>
          <div className={cn("flex items-center gap-1 px-2.5 py-1 rounded-full flex-shrink-0 self-start", tBg)}>
            {trendDown ? <TrendingDown className={cn("w-3.5 h-3.5", tColor)} /> : trendUp ? <TrendingUp className={cn("w-3.5 h-3.5", tColor)} /> : <Activity className={cn("w-3.5 h-3.5", tColor)} />}
            <span className={cn("text-[12px] font-semibold tabular-nums", tColor)}>
              {delta > 0 ? '+' : ''}{delta.toFixed(2)}%
            </span>
          </div>
        </div>

        <div className="relative px-2 sm:px-3">
          <PriceChart data={series} trend={trend} height={210} onHover={setHover} />
        </div>

        <div className="relative px-3 sm:px-4 pb-3 pt-1">
          <div className="grid grid-cols-6 bg-zinc-900/70 rounded-full p-0.5 border border-zinc-800/70">
            {PERIODS.map(pr => (
              <button
                key={pr}
                onClick={() => setPeriod(pr)}
                className={cn(
                  'rounded-full py-1.5 text-[11px] font-semibold tracking-wider transition-all tabular-nums',
                  period === pr ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-white'
                )}
              >
                {pr}
              </button>
            ))}
          </div>
        </div>

        <div className="relative px-5 sm:px-6 pb-5 pt-3 border-t border-zinc-800/70">
          <div className="grid grid-cols-4 gap-2">
            <StatTiny label="High" value={stats.hi > 0 ? `€${stats.hi.toFixed(3)}` : '—'} tone="text-red-400" />
            <StatTiny label="Low" value={stats.lo < Infinity ? `€${stats.lo.toFixed(3)}` : '—'} tone="text-emerald-400" />
            <StatTiny label="Avg" value={stats.avg > 0 ? `€${stats.avg.toFixed(3)}` : '—'} />
            <StatTiny label="Vol" value={stats.vol > 0 ? `±${(stats.vol * 100).toFixed(1)}c` : '—'} mono />
          </div>
        </div>
      </section>

      {/* === AI PULSE — intuitive verdict cockpit === */}
      {aiPulse && (
        <section className="relative bg-gradient-to-b from-zinc-900/70 to-black rounded-3xl border border-blue-500/25 overflow-hidden shadow-[0_0_50px_rgba(37,99,235,0.18)]">
          <div className="pointer-events-none absolute -top-20 -right-20 w-60 h-60 bg-blue-500/15 blur-[80px] rounded-full" />
          <div className="relative p-5 sm:p-6">
            {/* Header with cache freshness */}
            <div className="flex items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                  <Brain className="w-4 h-4 text-blue-400" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[15px] font-semibold text-white truncate">Verdetto AI</h2>
                  <p className="text-[11px] text-zinc-500 font-medium truncate flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {cacheAge ? `Aggiornato ${cacheAge}` : 'cache locale di oggi'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => p.fetchAnalysis(p.selectedFuel, true)}
                disabled={p.analysisLoading}
                aria-label="Rigenera"
                className="w-8 h-8 rounded-full bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-all active:scale-95 flex-shrink-0 disabled:opacity-50"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", p.analysisLoading && "animate-spin")} />
              </button>
            </div>

            {/* BIG verdict */}
            <div className={cn("rounded-2xl border p-4 mb-4", aiPulse.verdict.bg)}>
              <div className="flex items-center gap-3 mb-1">
                {aiPulse.verdict.icon === 'fill' ? <Zap className={cn("w-5 h-5", aiPulse.verdict.tone)} />
                  : aiPulse.verdict.icon === 'wait' ? <Clock className={cn("w-5 h-5", aiPulse.verdict.tone)} />
                  : <Activity className={cn("w-5 h-5", aiPulse.verdict.tone)} />}
                <h3 className={cn("text-[26px] sm:text-[30px] font-semibold tracking-tight leading-none", aiPulse.verdict.tone)}>
                  {aiPulse.verdict.label}
                </h3>
              </div>
              <p className="text-[13px] text-zinc-300 ml-8 font-medium">{aiPulse.verdict.action}</p>
            </div>

            {/* Savings hero number */}
            <div className="bg-black/40 rounded-2xl p-4 border border-zinc-800/60 mb-4">
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] text-zinc-500 font-semibold uppercase tracking-wider mb-1">
                    {aiPulse.savings > 0 ? 'Risparmi se aspetti 7 giorni' : aiPulse.savings < 0 ? 'Perdi se aspetti 7 giorni' : 'Differenza in 7 giorni'}
                  </p>
                  <p className={cn("text-[34px] sm:text-[40px] font-semibold tabular-nums tracking-tight leading-none",
                    Math.abs(aiPulse.savings) < 0.5 ? 'text-white'
                    : aiPulse.savings > 0 ? 'text-emerald-400'
                    : 'text-red-400'
                  )}>
                    {aiPulse.savings > 0 ? '+' : aiPulse.savings < 0 ? '-' : ''}€{Math.abs(aiPulse.savings).toFixed(2)}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">su pieno</p>
                  <p className="text-[16px] font-semibold text-white tabular-nums">{aiPulse.tank}L</p>
                </div>
              </div>
            </div>

            {/* Today vs 7d projection */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 bg-zinc-900/60 rounded-2xl border border-zinc-800/60 p-3 min-w-0">
                <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mb-0.5">Oggi</p>
                <p className="text-[18px] font-semibold text-white tabular-nums truncate">€{aiPulse.fStart.toFixed(3)}</p>
              </div>
              <ArrowRight className={cn("w-4 h-4 flex-shrink-0",
                aiPulse.fcDelta < -0.2 ? 'text-emerald-400'
                : aiPulse.fcDelta > 0.2 ? 'text-red-400'
                : 'text-zinc-500'
              )} />
              <div className={cn("flex-1 rounded-2xl border p-3 min-w-0",
                aiPulse.fcDelta < -0.2 ? 'bg-emerald-500/8 border-emerald-500/25'
                : aiPulse.fcDelta > 0.2 ? 'bg-red-500/8 border-red-500/25'
                : 'bg-zinc-900/60 border-zinc-800/60'
              )}>
                <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mb-0.5">+7 giorni</p>
                <p className={cn("text-[18px] font-semibold tabular-nums truncate",
                  aiPulse.fcDelta < -0.2 ? 'text-emerald-400'
                  : aiPulse.fcDelta > 0.2 ? 'text-red-400'
                  : 'text-white'
                )}>€{aiPulse.fEnd.toFixed(3)}</p>
              </div>
            </div>

            {/* Conviction (tier label, not abstract %) */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <ShieldCheck className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                <span className="text-[12px] text-zinc-500 font-medium">Affidabilita previsione</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex gap-0.5">
                  {[1, 2, 3].map(i => {
                    const tierIdx = aiPulse.convictionTier === 'Bassa' ? 1 : aiPulse.convictionTier === 'Media' ? 2 : 3;
                    return <div key={i} className={cn("w-4 h-1.5 rounded-full",
                      i <= tierIdx
                        ? (tierIdx === 3 ? 'bg-emerald-400' : tierIdx === 2 ? 'bg-amber-400' : 'bg-zinc-500')
                        : 'bg-zinc-800'
                    )} />;
                  })}
                </div>
                <span className={cn("text-[12px] font-semibold",
                  aiPulse.convictionTier === 'Alta' ? 'text-emerald-400'
                  : aiPulse.convictionTier === 'Media' ? 'text-amber-400'
                  : 'text-zinc-400'
                )}>{aiPulse.convictionTier}</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* === ASK AI — moved up, right after AI Pulse === */}
      <section className="relative bg-zinc-900/60 rounded-3xl p-5 sm:p-6 border border-blue-500/20 overflow-hidden">
        <div className="pointer-events-none absolute -top-12 -right-12 w-48 h-48 bg-blue-500/10 blur-[60px] rounded-full" />
        <div className="relative">
          <div className="flex items-center justify-between mb-4 gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                <Brain className="w-4 h-4 text-blue-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold text-white truncate">Chiedi all'AI</h2>
                <p className="text-[11px] text-zinc-500 mt-0.5 truncate">
                  {p.apiKey ? 'Gemini · risposta personalizzata' : 'Motore locale — configura Gemini per AI'}
                </p>
              </div>
            </div>
          </div>

          {/* Quick prompts */}
          <div className="flex flex-wrap gap-2 mb-4">
            {quickPrompts.map((qp, i) => (
              <button
                key={i}
                onClick={() => p.setUserQuestion(qp)}
                className="px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/25 text-[11px] font-medium text-blue-300 hover:bg-blue-500/20 hover:border-blue-500/40 transition-all active:scale-95"
              >
                {qp}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="relative">
            <textarea
              value={p.userQuestion}
              onChange={(e) => p.setUserQuestion(e.target.value)}
              placeholder="Es. Conviene fare il pieno oggi?"
              className="w-full h-24 bg-black/40 rounded-2xl p-4 pr-14 text-[14px] text-white placeholder:text-zinc-600 focus:outline-none border border-zinc-800 focus:border-blue-500/50 transition-all resize-none"
            />
            <button
              onClick={() => {
                if (!p.userQuestion.trim()) return;
                p.fetchAnalysis(p.selectedFuel, false, p.userQuestion);
              }}
              disabled={p.analysisLoading || !p.userQuestion.trim()}
              aria-label="Invia"
              className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white flex items-center justify-center active:scale-95 transition-all shadow-lg shadow-blue-500/40 disabled:shadow-none"
            >
              {p.analysisLoading
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Send className="w-4 h-4" />}
            </button>
          </div>

          {/* Answer card */}
          {p.aiAnswer && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 bg-blue-500/8 rounded-2xl p-4 border border-blue-500/30 relative"
            >
              <button
                onClick={p.clearAiAnswer}
                aria-label="Chiudi risposta"
                className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center text-zinc-400 hover:text-white transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <div className="flex items-center gap-2 mb-2 pr-8">
                <MessageSquare className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                <p className="text-[11px] text-blue-300 font-semibold uppercase tracking-wider truncate">
                  Risposta {p.aiAnswer.source === 'ai' ? 'Gemini' : 'locale'}
                </p>
              </div>
              <p className="text-[12px] text-zinc-500 italic mb-2 pr-8 line-clamp-2">
                "{p.aiAnswer.question}"
              </p>
              <div className="text-[14px] text-white leading-relaxed whitespace-pre-wrap">
                {p.aiAnswer.answer}
              </div>
              <p className="text-[10px] text-zinc-600 mt-3 font-medium">
                Risposte alle domande non consumano la cache giornaliera.
              </p>
            </motion.div>
          )}

          {!p.apiKey && !p.aiAnswer && (
            <button
              onClick={() => p.setShowSettings(true)}
              className="mt-3 inline-flex items-center gap-1 text-[12px] text-blue-400 font-medium hover:text-blue-300 transition-colors"
            >
              Configura chiave Gemini
              <ArrowUpRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </section>

      {/* === AI DAILY BRIEF === */}
      {aiBrief && (
        <section className="relative bg-zinc-900/60 rounded-3xl p-5 sm:p-6 border border-blue-500/15 overflow-hidden">
          <div className="pointer-events-none absolute -bottom-16 -left-16 w-48 h-48 bg-blue-500/8 blur-[60px] rounded-full" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <h2 className="text-[12px] text-zinc-400 font-semibold uppercase tracking-wider">Brief mattutino</h2>
              <span className="ml-auto text-[10px] text-zinc-500 font-medium">{p.analysisIsLocal ? 'Locale' : 'Gemini'}</span>
            </div>
            <p className="text-[15px] text-white font-medium leading-relaxed mb-2">{aiBrief.sentiment}</p>
            {aiBrief.facts && <p className="text-[12px] text-zinc-400 mb-3 tabular-nums">{aiBrief.facts}</p>}
            <p className="text-[14px] text-zinc-300 leading-relaxed">{aiBrief.reasoning}</p>
          </div>
        </section>
      )}

      {/* === STRATEGY CARD — best window === */}
      {strategy && strategy.worthIt && (
        <section className="relative bg-gradient-to-br from-emerald-500/8 to-zinc-900/60 rounded-3xl p-5 sm:p-6 border border-emerald-500/25 overflow-hidden">
          <div className="pointer-events-none absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/12 blur-[60px] rounded-full" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-emerald-400" />
              <h2 className="text-[12px] text-emerald-300 font-semibold uppercase tracking-wider">Finestra ottimale</h2>
            </div>
            <div className="flex items-end justify-between gap-3 mb-4">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-zinc-500 font-semibold uppercase tracking-wider mb-1">Fai pieno {strategy.day}</p>
                <h3 className="text-[22px] sm:text-[26px] font-semibold text-white tracking-tight capitalize truncate">{strategy.dayLabel}</h3>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Prezzo</p>
                <p className="text-[20px] font-semibold text-emerald-400 tabular-nums">€{strategy.price.toFixed(3)}</p>
              </div>
            </div>
            <div className="bg-black/40 rounded-2xl p-3 border border-emerald-500/20">
              <p className="text-[13px] text-zinc-300">
                Risparmio stimato sul pieno da {p.tankLiters}L: <span className="text-emerald-400 font-semibold tabular-nums">€{strategy.saved.toFixed(2)}</span>
              </p>
            </div>
          </div>
        </section>
      )}

      {/* === HISTORICAL COMPARE === */}
      {historicalCompare && historicalCompare.length > 0 && last && (
        <section className="bg-zinc-900/60 rounded-3xl border border-zinc-800/70 p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-4 h-4 text-blue-400" />
            <h2 className="text-[12px] text-zinc-400 font-semibold uppercase tracking-wider">Stesso giorno, anni fa</h2>
          </div>
          {/* Today reference */}
          <div className="flex items-baseline justify-between gap-3 mb-3 pb-3 border-b border-zinc-800/70">
            <div className="min-w-0">
              <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider mb-0.5">Oggi</p>
              <p className="text-[11px] text-zinc-500 font-medium">{new Date(last.ts).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
            <p className="text-[22px] font-semibold text-white tabular-nums tracking-tight flex-shrink-0">€{last.avg.toFixed(3)}</p>
          </div>
          <div className="space-y-2">
            {historicalCompare.map((h, i) => (
              <div key={i} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-white font-medium">{h.label}</p>
                  <p className="text-[11px] text-zinc-500 tabular-nums">€{h.price!.toFixed(3)}</p>
                </div>
                <div className={cn("flex items-center gap-1 px-2.5 py-1 rounded-full flex-shrink-0",
                  h.delta! < 0 ? 'bg-emerald-500/10 text-emerald-400'
                  : h.delta! > 0 ? 'bg-red-500/10 text-red-400'
                  : 'bg-zinc-800/60 text-zinc-400'
                )}>
                  {h.delta! < 0
                    ? <TrendingDown className="w-3 h-3" />
                    : h.delta! > 0
                    ? <TrendingUp className="w-3 h-3" />
                    : <Activity className="w-3 h-3" />}
                  <span className="text-[12px] font-semibold tabular-nums">
                    {h.delta! > 0 ? '+' : ''}{h.delta!.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-zinc-500 mt-3 leading-snug">
            <span className="text-emerald-400 font-medium">Verde</span> = oggi piu economico di allora · <span className="text-red-400 font-medium">Rosso</span> = oggi piu caro di allora.
          </p>
        </section>
      )}

      {/* === TRUST / RISK FACTORS === */}
      <section className="bg-zinc-900/60 rounded-3xl border border-zinc-800/70 p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="w-4 h-4 text-blue-400" />
          <h2 className="text-[12px] text-zinc-400 font-semibold uppercase tracking-wider">Affidabilita dell'analisi</h2>
        </div>
        <p className="text-[12px] text-zinc-500 mb-4">Quanto puoi fidarti di previsioni e suggerimenti qui sopra.</p>

        {/* Overall verdict */}
        <div className={cn("rounded-2xl p-4 mb-4 border",
          risks.overall.status === 'good' ? 'bg-emerald-500/8 border-emerald-500/25'
          : risks.overall.status === 'mid' ? 'bg-amber-500/8 border-amber-500/25'
          : 'bg-red-500/8 border-red-500/25'
        )}>
          <div className="flex items-baseline justify-between gap-3 mb-1">
            <p className="text-[11px] text-zinc-500 font-semibold uppercase tracking-wider">Affidabilita complessiva</p>
            <p className={cn("text-[18px] font-semibold tracking-tight",
              risks.overall.status === 'good' ? 'text-emerald-400'
              : risks.overall.status === 'mid' ? 'text-amber-400'
              : 'text-red-400'
            )}>{risks.overall.label}</p>
          </div>
          <p className="text-[13px] text-zinc-300 leading-snug">{risks.overall.message}</p>
        </div>

        {/* Indicators */}
        <div className="space-y-2">
          {risks.items.map((r, i) => {
            const Icon = r.icon;
            return (
              <div key={i} className="bg-black/30 rounded-2xl p-3 sm:p-4 border border-zinc-800/40 flex items-start gap-3">
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
                  r.status === 'good' ? 'bg-emerald-500/15 text-emerald-400'
                  : r.status === 'mid' ? 'bg-amber-500/15 text-amber-400'
                  : 'bg-red-500/15 text-red-400'
                )}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-[13px] text-white font-semibold truncate">{r.label}</span>
                    <span className={cn("text-[11px] font-semibold uppercase tracking-wider flex-shrink-0",
                      r.status === 'good' ? 'text-emerald-400'
                      : r.status === 'mid' ? 'text-amber-400'
                      : 'text-red-400'
                    )}>{r.statusLabel}</span>
                  </div>
                  <p className="text-[12px] text-zinc-500 tabular-nums mb-1">{r.value}</p>
                  <p className="text-[12px] text-zinc-400 leading-snug">{r.hint}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* === 52w range bar === */}
      {stats52w.count > 0 && last && (() => {
        const span = stats52w.hi - stats52w.lo || 0.001;
        const pos = ((last.avg - stats52w.lo) / span) * 100;
        const verdict = pos < 25 ? { label: 'Buon momento per comprare', tone: 'text-emerald-400', explain: `Sei nel ${Math.round(pos)}% piu economico dell'ultimo anno.` }
          : pos < 50 ? { label: 'Sotto la mediana', tone: 'text-emerald-300', explain: `Prezzo migliore della meta dei giorni dell'ultimo anno.` }
          : pos < 75 ? { label: 'Sopra la mediana', tone: 'text-amber-400', explain: `Prezzo sopra la media degli ultimi 12 mesi.` }
          : { label: 'Vicino al massimo', tone: 'text-red-400', explain: `Sei nel ${Math.round(100 - pos)}% piu caro dell'ultimo anno.` };
        return (
          <section className="bg-zinc-900/60 rounded-3xl border border-zinc-800/70 p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-blue-400" />
              <h2 className="text-[12px] text-zinc-400 font-semibold uppercase tracking-wider">Range 52 settimane</h2>
            </div>
            <p className="text-[12px] text-zinc-500 mb-4">Dove si trova il prezzo di oggi rispetto a minimo e massimo dell'ultimo anno.</p>
            <div className="flex items-baseline justify-between gap-3 mb-4">
              <p className={cn("text-[20px] sm:text-[22px] font-semibold tracking-tight", verdict.tone)}>{verdict.label}</p>
              <p className="text-[11px] text-zinc-500 font-medium flex-shrink-0">{stats52w.count} osservazioni</p>
            </div>
            <RangeBar lo={stats52w.lo} hi={stats52w.hi} current={last.avg} />
            <p className="text-[12px] text-zinc-400 mt-3 leading-snug">{verdict.explain}</p>
          </section>
        );
      })()}

      {/* === Live distribution === */}
      {(() => {
        const allPrices = p.filteredStations
          .map(s => s.prices.find(pp => pp.type === p.selectedFuel)?.price || 0)
          .filter(v => v > 0.5)
          .sort((a, b) => a - b);
        const total = allPrices.length;
        let rank = 0, cheaperCount = 0, percentile = 0;
        if (todayBest && total > 0) {
          cheaperCount = allPrices.filter(v => v < todayBest).length;
          rank = cheaperCount + 1;
          percentile = (rank / total) * 100;
        }
        return (
          <section className="bg-zinc-900/60 rounded-3xl border border-zinc-800/70 p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-1">
              <BarChart2 className="w-4 h-4 text-blue-400" />
              <h2 className="text-[12px] text-zinc-400 font-semibold uppercase tracking-wider">Distribuzione zona</h2>
            </div>
            <p className="text-[12px] text-zinc-500 mb-4">Quante stazioni vendono a ogni fascia di prezzo nella tua zona. La barra verde e dove sei tu.</p>

            {todayBest && total > 0 && (
              <div className="flex items-baseline justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <p className={cn("text-[20px] sm:text-[22px] font-semibold tracking-tight",
                    percentile <= 10 ? 'text-emerald-400'
                    : percentile <= 30 ? 'text-emerald-300'
                    : percentile <= 60 ? 'text-amber-400'
                    : 'text-red-400'
                  )}>
                    {rank === 1 ? 'Sei al primo posto' : `Sei tra le ${rank} piu economiche`}
                  </p>
                  <p className="text-[12px] text-zinc-500 mt-0.5">su {total} stazioni totali in zona</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Il tuo</p>
                  <p className="text-[18px] font-semibold text-emerald-400 tabular-nums">€{todayBest.toFixed(3)}</p>
                </div>
              </div>
            )}

            <PriceDistribution stations={p.filteredStations} fuel={p.selectedFuel} current={todayBest ?? undefined} />

            {todayBest && total > 0 && (
              <p className="text-[12px] text-zinc-400 mt-3 leading-snug">
                {percentile <= 10 ? 'Stai prendendo uno dei migliori prezzi della tua zona.'
                  : percentile <= 30 ? 'Buon prezzo: meglio della maggioranza delle stazioni vicine.'
                  : percentile <= 60 ? 'Prezzo nella media. Controlla se piu lontano c\'e di meglio.'
                  : `Ci sono ${cheaperCount} stazioni piu economiche di te in zona — vale la pena cercare.`}
              </p>
            )}
          </section>
        );
      })()}

      {/* === Recommendation card === */}
      {m && (
        <section className="relative bg-zinc-900/60 rounded-3xl p-5 sm:p-6 border border-blue-500/15 overflow-hidden">
          <div className="pointer-events-none absolute -bottom-16 -left-16 w-48 h-48 bg-blue-500/8 blur-[60px] rounded-full" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3 gap-3">
              <p className="text-[12px] text-zinc-500 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-blue-400" /> Suggerimento
              </p>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-400/80">
                {p.analysisIsLocal ? 'Motore locale' : 'Powered by AI'}
              </span>
            </div>
            <h3 className={cn("text-[26px] font-semibold tracking-tight mb-3", adviceTint(m.advice))}>
              {adviceLabel(m.advice)}
            </h3>
            <p className="text-[14px] text-zinc-300 leading-relaxed">{m.reasoning}</p>
          </div>
        </section>
      )}

      {/* === AI Tips === */}
      {m?.tips && m.tips.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[12px] text-zinc-500 font-semibold uppercase tracking-wider px-1 mb-2 flex items-center gap-1.5">
            <Lightbulb className="w-3 h-3 text-amber-400" /> AI Tips
          </h2>
          <div className="bg-zinc-900/60 rounded-3xl border border-zinc-800/70 overflow-hidden divide-y divide-zinc-800/60">
            {m.tips.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.04 * i }}
                className="flex items-start gap-3 p-4 sm:p-5"
              >
                <div className={cn("w-1 self-stretch rounded-full flex-shrink-0",
                  t.impact === 'HIGH' ? 'bg-red-500'
                  : t.impact === 'MEDIUM' ? 'bg-amber-500'
                  : 'bg-blue-500'
                )} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-[14px] font-semibold text-white truncate">{t.title}</h4>
                    <span className={cn("text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded flex-shrink-0",
                      t.impact === 'HIGH' ? 'text-red-300 bg-red-500/15'
                      : t.impact === 'MEDIUM' ? 'text-amber-300 bg-amber-500/15'
                      : 'text-blue-300 bg-blue-500/15'
                    )}>
                      {t.impact === 'HIGH' ? 'Alto' : t.impact === 'MEDIUM' ? 'Medio' : 'Basso'}
                    </span>
                  </div>
                  <p className="text-[13px] text-zinc-400 leading-snug break-words">{t.text}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* === Insights === */}
      {m && m.categories?.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[12px] text-zinc-500 font-semibold uppercase tracking-wider px-1 mb-2">Approfondimenti</h2>
          <div className="bg-zinc-900/60 rounded-3xl border border-zinc-800/70 overflow-hidden divide-y divide-zinc-800/60">
            {m.categories.map((mod, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.04 * i }}
                className="flex items-start gap-3 p-4 sm:p-5"
              >
                <div className="w-9 h-9 rounded-xl bg-zinc-800/60 flex items-center justify-center flex-shrink-0">
                  {mod.icon === 'MapPin' ? <MapPin className="w-4 h-4 text-blue-400" /> :
                   mod.icon === 'Calendar' ? <Calendar className="w-4 h-4 text-indigo-400" /> :
                   <Sparkles className="w-4 h-4 text-emerald-400" />}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-[14px] font-semibold text-white mb-0.5">{mod.title}</h4>
                  <p className="text-[13px] text-zinc-400 leading-snug break-words">{mod.content}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* === AI News === */}
      {news.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[12px] text-zinc-500 font-semibold uppercase tracking-wider px-1 mb-2 flex items-center gap-1.5">
            <Newspaper className="w-3 h-3 text-blue-400" /> AI News Feed
          </h2>
          <div className="bg-zinc-900/60 rounded-3xl border border-zinc-800/70 overflow-hidden divide-y divide-zinc-800/60">
            {news.map((n, i) => {
              const impact = (n.impact || 'neutral').toLowerCase();
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.04 * i }}
                  className="flex items-start gap-3 p-4 sm:p-5"
                >
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
                    impact === 'negative' || impact === 'bad' ? 'bg-red-500/12 text-red-400'
                    : impact === 'positive' || impact === 'good' ? 'bg-emerald-500/12 text-emerald-400'
                    : 'bg-blue-500/12 text-blue-400'
                  )}>
                    {impact === 'negative' || impact === 'bad' ? <TrendingUp className="w-4 h-4" />
                    : impact === 'positive' || impact === 'good' ? <TrendingDown className="w-4 h-4" />
                    : <Activity className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className="text-[14px] font-semibold text-white truncate flex-1">{n.title || 'Aggiornamento'}</h4>
                      {n.source && <span className="text-[10px] text-zinc-500 font-medium flex-shrink-0">{n.source}</span>}
                    </div>
                    <p className="text-[13px] text-zinc-400 leading-snug break-words line-clamp-2">{n.summary || n.content || ''}</p>
                    {n.url && (
                      <a href={n.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-1 text-[11px] text-blue-400 font-medium hover:text-blue-300">
                        Leggi <ArrowUpRight className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {/* === Full report === */}
      {m?.detailedReport && (
        <details className="group bg-zinc-900/60 rounded-3xl border border-zinc-800/70 overflow-hidden">
          <summary className="list-none cursor-pointer flex items-center justify-between gap-3 p-5 hover:bg-zinc-800/40 transition-colors">
            <div className="min-w-0 flex-1">
              <h3 className="text-[14px] font-semibold text-white">Report completo</h3>
              <p className="text-[12px] text-zinc-500 mt-0.5 truncate">Analisi dettagliata del mercato</p>
            </div>
            <ChevronRight className="w-5 h-5 text-zinc-500 group-open:rotate-90 transition-transform flex-shrink-0" />
          </summary>
          <div className="px-5 pb-5 space-y-3">
            {m.detailedReport.split('\n').filter(l => l.trim()).map((line, i) => (
              <p key={i} className="text-[13px] text-zinc-400 leading-relaxed">{line}</p>
            ))}
          </div>
        </details>
      )}
    </motion.div>
  );
}

function StatTiny({ label, value, tone, mono }: { label: string; value: string; tone?: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider truncate mb-1">{label}</p>
      <p className={cn("text-[13px] font-semibold tabular-nums truncate", tone || 'text-white', mono && 'font-mono')}>{value}</p>
    </div>
  );
}

function RangeBar({ lo, hi, current }: { lo: number; hi: number; current: number }) {
  const span = hi - lo || 1;
  const pct = Math.min(100, Math.max(0, ((current - lo) / span) * 100));
  return (
    <div>
      <div className="relative h-2 rounded-full bg-zinc-800/70 overflow-hidden">
        <div className="absolute inset-y-0 left-0 right-0 bg-gradient-to-r from-emerald-500/50 via-zinc-500/30 to-red-500/50 rounded-full" />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-black shadow-lg"
          style={{ left: `calc(${pct}% - 6px)` }}
        />
      </div>
      <div className="flex justify-between mt-2 text-[11px] tabular-nums font-medium">
        <div>
          <span className="text-zinc-500">Low </span>
          <span className="text-emerald-400">€{lo.toFixed(3)}</span>
        </div>
        <div className="text-zinc-300 font-semibold">€{current.toFixed(3)}</div>
        <div>
          <span className="text-red-400">€{hi.toFixed(3)}</span>
          <span className="text-zinc-500"> High</span>
        </div>
      </div>
    </div>
  );
}

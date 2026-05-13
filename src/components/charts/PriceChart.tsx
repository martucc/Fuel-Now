import { useMemo, useState, useRef, useEffect } from 'react';
import type { HistoryPoint } from '../../services/historyService';
import { movingAverage } from '../../services/historyService';

interface Props {
  data: HistoryPoint[];
  trend: 'UP' | 'DOWN' | 'STABLE';
  height?: number;
  showRange?: boolean;
  showMA?: boolean;
  onHover?: (p: HistoryPoint | null) => void;
}

const fmtDate = (ts: number) => {
  const d = new Date(ts);
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: '2-digit' });
};

export function PriceChart({ data, trend, height = 200, showRange = true, showMA = true, onHover }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const W = 360;
  const H = height;
  const padL = 44, padR = 8, padT = 12, padB = 24;

  const { path, areaPath, rangePath, maPath, points, minV, maxV } = useMemo(() => {
    if (data.length < 2) return { path: '', areaPath: '', rangePath: '', maPath: '', points: [] as { x: number; y: number; d: HistoryPoint }[], minV: 0, maxV: 0 };

    const ma = showMA ? movingAverage(data, Math.min(20, Math.max(3, Math.floor(data.length / 8)))) : [];
    // Y-axis scaling: SOLO sulla linea trend (avg) + MA. Niente min/max grezzi MIMIT (outlier).
    const vals: number[] = [];
    for (const p of data) vals.push(p.avg);
    for (const v of ma) if (v != null) vals.push(v);

    let minV = Math.min(...vals);
    let maxV = Math.max(...vals);
    const pad = (maxV - minV) * 0.15 || 0.01;
    minV -= pad; maxV += pad;

    // Range band: clamp min/max grezzi a ±5% dell'avg cosi outlier non sballano il chart
    const clampMin = (m: number, avg: number) => Math.max(m, avg * 0.95);
    const clampMax = (M: number, avg: number) => Math.min(M, avg * 1.05);

    const xAt = (i: number) => padL + (i / (data.length - 1)) * (W - padL - padR);
    const yAt = (v: number) => padT + (1 - (v - minV) / (maxV - minV)) * (H - padT - padB);

    let pStr = '', aStr = '', rStr = '', mStr = '';
    const pts: { x: number; y: number; d: HistoryPoint }[] = [];

    for (let i = 0; i < data.length; i++) {
      const x = xAt(i), y = yAt(data[i].avg);
      pStr += (i === 0 ? 'M' : 'L') + x.toFixed(2) + ' ' + y.toFixed(2) + ' ';
      pts.push({ x, y, d: data[i] });
    }
    aStr = pStr + ` L ${xAt(data.length - 1).toFixed(2)} ${H - padB} L ${xAt(0).toFixed(2)} ${H - padB} Z`;

    if (showRange) {
      let top = '', bot = '';
      for (let i = 0; i < data.length; i++) {
        const x = xAt(i);
        top += (i === 0 ? 'M' : 'L') + x.toFixed(2) + ' ' + yAt(clampMax(data[i].max, data[i].avg)).toFixed(2) + ' ';
      }
      for (let i = data.length - 1; i >= 0; i--) {
        const x = xAt(i);
        bot += 'L' + x.toFixed(2) + ' ' + yAt(clampMin(data[i].min, data[i].avg)).toFixed(2) + ' ';
      }
      rStr = top + bot + 'Z';
    }

    if (showMA) {
      let started = false;
      for (let i = 0; i < ma.length; i++) {
        const v = ma[i];
        if (v == null) continue;
        const x = xAt(i), y = yAt(v);
        mStr += (started ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2) + ' ';
        started = true;
      }
    }

    return { path: pStr, areaPath: aStr, rangePath: rStr, maPath: mStr, points: pts, minV, maxV };
  }, [data, height, showRange, showMA]);

  let accent = '#3b82f6';
  if (trend === 'DOWN') accent = '#10b981';
  if (trend === 'UP') accent = '#ef4444';

  useEffect(() => { onHover?.(hoverIdx != null && points[hoverIdx] ? points[hoverIdx].d : null); }, [hoverIdx]);

  const handleMove = (clientX: number) => {
    const el = svgRef.current; if (!el || !points.length) return;
    const rect = el.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * W;
    let bestI = 0, bestD = Infinity;
    for (let i = 0; i < points.length; i++) {
      const dx = Math.abs(points[i].x - relX);
      if (dx < bestD) { bestD = dx; bestI = i; }
    }
    setHoverIdx(bestI);
  };

  const hover = hoverIdx != null ? points[hoverIdx] : null;

  if (data.length < 2) {
    return <div className="h-full w-full flex items-center justify-center text-[12px] text-zinc-600">Dati insufficienti</div>;
  }

  const tickIndices = data.length > 1
    ? Array.from({ length: 4 }, (_, k) => Math.round((k / 3) * (data.length - 1)))
    : [];

  return (
    <div className="w-full relative select-none" style={{ height }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-full touch-none"
        onMouseMove={e => handleMove(e.clientX)}
        onMouseLeave={() => setHoverIdx(null)}
        onTouchStart={e => { if (e.touches[0]) handleMove(e.touches[0].clientX); }}
        onTouchMove={e => { if (e.touches[0]) handleMove(e.touches[0].clientX); }}
        onTouchEnd={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="chartArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.22" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* horizontal gridlines + Y labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((r, i) => {
          const y = padT + r * (H - padT - padB);
          const v = maxV - r * (maxV - minV);
          return (
            <g key={i}>
              {r > 0 && r < 1 && (
                <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              )}
              <text
                x={padL - 6}
                y={y + 3}
                textAnchor="end"
                fontSize="9"
                fill="rgba(255,255,255,0.45)"
                fontFamily="ui-sans-serif, system-ui"
              >
                €{v.toFixed(2)}
              </text>
            </g>
          );
        })}

        {/* range band */}
        {showRange && rangePath && (
          <path d={rangePath} fill={accent} fillOpacity="0.07" />
        )}

        {/* area gradient */}
        <path d={areaPath} fill="url(#chartArea)" />

        {/* MA line */}
        {showMA && maPath && (
          <path d={maPath} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeDasharray="3 3" />
        )}

        {/* main line */}
        <path d={path} fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* X-axis ticks */}
        {tickIndices.map((idx, k) => {
          const pt = points[idx]; if (!pt) return null;
          return (
            <text
              key={k}
              x={pt.x}
              y={H - 6}
              textAnchor={k === 0 ? 'start' : k === tickIndices.length - 1 ? 'end' : 'middle'}
              fontSize="9"
              fill="rgba(255,255,255,0.35)"
              fontFamily="ui-sans-serif, system-ui"
            >
              {fmtDate(pt.d.ts)}
            </text>
          );
        })}

        {/* Crosshair */}
        {hover && (
          <>
            <line x1={hover.x} x2={hover.x} y1={padT} y2={H - padB} stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={hover.x} cy={hover.y} r="4.5" fill={accent} stroke="white" strokeWidth="2" />
          </>
        )}
      </svg>

      {hover && (
        <div
          className="absolute top-1 px-2.5 py-1.5 rounded-lg bg-black/85 backdrop-blur border border-white/10 text-[11px] text-white font-medium tabular-nums shadow-xl pointer-events-none whitespace-nowrap"
          style={{
            left: `${Math.min(Math.max((hover.x / W) * 100, 6), 76)}%`,
          }}
        >
          <div className="text-zinc-400 text-[10px]">{fmtDate(hover.d.ts)}</div>
          <div className="font-semibold">€{hover.d.avg.toFixed(3)}</div>
          <div className="text-zinc-500 text-[10px]">media nazionale</div>
        </div>
      )}
    </div>
  );
}

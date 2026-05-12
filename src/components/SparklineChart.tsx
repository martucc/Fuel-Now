export function SparklineChart({ data, trend }: { data: { date: string; price: number }[]; trend: string }) {
  const w = 320, h = 130, p = 14;
  if (!data || data.length < 2) return <div className="h-full flex items-center justify-center text-xs opacity-50">Dati insufficienti</div>;

  const values = data.map(d => d.price);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(0.001, max - min);
  const pts = values.map((val, idx) => {
    const x = p + (idx / (values.length - 1)) * (w - p * 2);
    const y = p + (1 - (val - min) / span) * (h - p * 2);
    return [x, y];
  });

  const path = pts.map((pt, idx) => `${idx === 0 ? 'M' : 'L'}${pt[0].toFixed(2)} ${pt[1].toFixed(2)}`).join(' ');
  const area = `${path} L${pts[pts.length - 1][0].toFixed(2)} ${h - p} L${pts[0][0].toFixed(2)} ${h - p} Z`;
  const last = pts[pts.length - 1];

  let accent = '#3b82f6';
  if (trend === 'DOWN') accent = '#10b981';
  if (trend === 'UP') accent = '#ef4444';

  return (
    <svg className="w-full h-full" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.34" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((ratio, i) => (
        <line key={i} x1={p} x2={w - p} y1={p + ratio * (h - p * 2)} y2={p + ratio * (h - p * 2)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="4 4" />
      ))}
      <path d={area} fill="url(#sparkGrad)" />
      <path d={path} fill="none" stroke={accent} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0].toFixed(2)} cy={last[1].toFixed(2)} r="5.2" fill={accent} stroke="white" strokeWidth="2" />
    </svg>
  );
}

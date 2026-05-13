import { useEffect, useMemo, useRef, useState } from 'react';
import { Locate, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { ITALIAN_CITIES } from '../data/italianCities';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  dot?: React.ReactNode;
  extraCities?: string[];
  onUseLocation?: () => void;
  isLocating?: boolean;
}

export function CityAutocomplete({
  value,
  onChange,
  placeholder = 'Citta',
  dot,
  extraCities = [],
  onUseLocation,
  isLocating = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const all = useMemo(() => {
    const set = new Set<string>();
    for (const c of ITALIAN_CITIES) set.add(c);
    for (const c of extraCities) if (c && c.trim()) set.add(c.trim());
    return Array.from(set);
  }, [extraCities]);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    const starts: string[] = [];
    const includes: string[] = [];
    for (const c of all) {
      const lc = c.toLowerCase();
      if (lc === q) continue;
      if (lc.startsWith(q)) starts.push(c);
      else if (lc.includes(q)) includes.push(c);
      if (starts.length + includes.length >= 24) break;
    }
    starts.sort((a, b) => a.length - b.length);
    return [...starts, ...includes].slice(0, 6);
  }, [value, all]);

  const showDropdown = open && focused && suggestions.length > 0;

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div ref={wrapRef} className="relative flex-1 min-w-0">
      <div className="flex items-center gap-3 px-5 py-4">
        {dot}
        <input
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => { setFocused(true); setOpen(true); }}
          placeholder={placeholder}
          className="bg-transparent text-[16px] text-white placeholder:text-zinc-600 outline-none w-full font-semibold tracking-tight"
          autoComplete="off"
          spellCheck={false}
        />
        {value && (
          <button
            onClick={() => { onChange(''); setOpen(false); }}
            aria-label="Cancella"
            className="text-zinc-500 hover:text-white active:scale-90 transition-all flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {onUseLocation && (
          <button
            onClick={(e) => { e.preventDefault(); onUseLocation(); setOpen(false); }}
            disabled={isLocating}
            aria-label="Usa la mia posizione"
            className={cn(
              'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all border',
              isLocating
                ? 'bg-blue-500/20 border-blue-500/40 text-blue-300 animate-pulse'
                : 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20 active:scale-90'
            )}
            title="Usa la mia posizione"
          >
            <Locate className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full mt-2 z-30 bg-[#0a0f1d] border border-blue-500/30 rounded-2xl shadow-[0_0_40px_rgba(37,99,235,0.25)] overflow-hidden">
          {suggestions.map((s, i) => (
            <button
              key={s}
              onClick={() => { onChange(s); setOpen(false); setFocused(false); }}
              className={cn(
                'w-full px-4 py-3 text-left text-[14px] font-semibold text-white hover:bg-blue-500/10 transition-colors',
                i !== suggestions.length - 1 ? 'border-b border-white/5' : ''
              )}
            >
              <HighlightMatch text={s} query={value} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return <>{text}</>;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + q.length);
  const after = text.slice(idx + q.length);
  return (
    <>
      {before}
      <span className="text-blue-400">{match}</span>
      {after}
    </>
  );
}

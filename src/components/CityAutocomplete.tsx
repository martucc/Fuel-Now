import { useEffect, useMemo, useRef, useState } from 'react';
import { Locate, X } from 'lucide-react';
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
          className="w-full border-none bg-transparent outline-none"
          style={{
            color: 'var(--mf-ink)',
            fontFamily: 'var(--mf-font-sans)',
            fontSize: 16,
            fontWeight: 500,
            letterSpacing: '-0.01em',
          }}
          autoComplete="off"
          spellCheck={false}
        />
        {value && (
          <button
            onClick={() => { onChange(''); setOpen(false); }}
            aria-label="Cancella"
            className="flex-shrink-0 transition-transform active:scale-90"
            style={{ color: 'var(--mf-muted)' }}
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {onUseLocation && (
          <button
            onClick={(e) => { e.preventDefault(); onUseLocation(); setOpen(false); }}
            disabled={isLocating}
            aria-label="Usa la mia posizione"
            title="Usa la mia posizione"
            className={`flex flex-shrink-0 items-center justify-center transition-transform active:scale-90 ${isLocating ? 'animate-pulse' : ''}`}
            style={{
              width: 30,
              height: 30,
              borderRadius: 'var(--mf-radius-pill)',
              background: 'var(--mf-ground)',
              border: '1px solid var(--mf-hairline)',
              color: 'var(--mf-accent)',
            }}
          >
            <Locate className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden"
          style={{
            background: 'var(--mf-surface-raised)',
            border: '1px solid var(--mf-hairline)',
            borderRadius: 'var(--mf-radius-md)',
            boxShadow: '0 18px 40px rgba(0,0,0,.45)',
          }}
        >
          {suggestions.map((s, i) => (
            <button
              key={s}
              onClick={() => { onChange(s); setOpen(false); setFocused(false); }}
              className="w-full px-4 py-3 text-left"
              style={{
                borderTop: i === 0 ? 'none' : '1px solid var(--mf-hairline)',
                color: 'var(--mf-ink)',
                fontFamily: 'var(--mf-font-sans)',
                fontSize: 14,
                fontWeight: 500,
              }}
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
      <span style={{ color: 'var(--mf-accent)' }}>{match}</span>
      {after}
    </>
  );
}

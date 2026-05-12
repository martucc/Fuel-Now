import { cn } from '../lib/utils';
import type { FuelType } from '../types';

const FUEL_TYPES: FuelType[] = ['Benzina', 'Diesel', 'GPL', 'Metano'];

export function FuelTypeSelector({ current, onSelect }: { current: FuelType; onSelect: (f: FuelType) => void }) {
  return (
    <div className="flex bg-white/5 p-1.5 rounded-[1.5rem] border border-white/5 backdrop-blur-xl">
      {FUEL_TYPES.map(t => (
        <button
          key={t}
          onClick={() => onSelect(t)}
          className={cn(
            "px-4 py-2 rounded-2xl text-[9px] font-black uppercase tracking-[0.15em] transition-all whitespace-nowrap outline-none",
            current === t ? "bg-blue-600 text-white shadow-xl shadow-blue-900/30" : "text-[#8e8e93] hover:text-[#f5f5f7]"
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

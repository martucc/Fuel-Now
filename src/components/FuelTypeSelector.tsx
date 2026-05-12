import { cn } from '../lib/utils';
import type { FuelType } from '../types';
import { Fuel, Droplets, Flame, Wind } from 'lucide-react';
import { motion } from 'motion/react';

const FUEL_TYPES: {id: FuelType, icon: any, label: string}[] = [
  {id: 'Benzina', icon: Fuel, label: 'Benzina'},
  {id: 'Diesel', icon: Droplets, label: 'Diesel'},
  {id: 'GPL', icon: Flame, label: 'GPL'},
  {id: 'Metano', icon: Wind, label: 'Metano'}
];

export function FuelTypeSelector({ current, onSelect }: { current: FuelType; onSelect: (f: FuelType) => void }) {
  return (
    <div className="flex bg-[#1c1c1e] p-1 rounded-full border border-white/5 w-full justify-between relative">
      {FUEL_TYPES.map(t => {
        const Icon = t.icon;
        const isActive = current === t.id;
        return (
          <motion.button
            key={t.id}
            onClick={() => onSelect(t.id)}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "relative flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-[11px] font-bold outline-none z-10",
              isActive ? "text-white" : "text-[#8e8e93] hover:text-white"
            )}
          >
            {isActive && (
              <motion.div
                layoutId="activeFuelTab"
                className="absolute inset-0 bg-blue-600 rounded-full shadow-md shadow-blue-500/20 -z-10"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <Icon size={14} className={isActive ? "text-white" : "text-[#8e8e93]"} />
            {t.label}
          </motion.button>
        );
      })}
    </div>
  );
}

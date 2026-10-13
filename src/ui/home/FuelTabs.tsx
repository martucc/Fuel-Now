import { motion } from 'motion/react';
import type { FuelKey } from '../../domain/raw';
import { FUEL_KEYS } from '../../domain/raw';
import { FUEL_LABEL } from '../../domain/fuel';

interface Props {
  value: FuelKey;
  onChange: (f: FuelKey) => void;
}

export function FuelTabs({ value, onChange }: Props) {
  return (
    <div className="flex items-end gap-6" style={{ fontFamily: 'var(--mf-font-sans)' }}>
      {FUEL_KEYS.map((k) => {
        const active = k === value;
        return (
          <button
            key={k}
            onClick={() => onChange(k)}
            className="relative pb-2 transition-opacity"
            style={{
              color: active ? 'var(--mf-ink)' : 'var(--mf-ink-2)',
              fontWeight: active ? 700 : 500,
              fontSize: 16,
              opacity: active ? 1 : 0.7,
            }}
          >
            {FUEL_LABEL[k]}
            {active && (
              <motion.span
                layoutId="mf-fuel-underline"
                className="absolute left-0 right-0 bottom-0"
                style={{ height: 2, background: 'var(--mf-accent)', borderRadius: 2 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

import { motion } from 'motion/react';
import { Home, Map as IconaMappa, Route, LineChart } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { triggerHaptic } from '../lib/haptics';

export type Scheda = 'home' | 'mappa' | 'viaggio' | 'mercato';

const SCHEDE: Array<{ id: Scheda; etichetta: string; icona: LucideIcon }> = [
  { id: 'home', etichetta: 'Vicino', icona: Home },
  { id: 'mappa', etichetta: 'Mappa', icona: IconaMappa },
  { id: 'viaggio', etichetta: 'Viaggio', icona: Route },
  { id: 'mercato', etichetta: 'Prezzi', icona: LineChart },
];

/**
 * La barra delle schede: una pillola di vetro che galleggia sopra i
 * contenuti, staccata dal bordo. La scheda attiva ha una pillola sua che
 * scivola da una voce all'altra, nel colore della zona (mai il blu, che
 * vuol dire «vai qui»).
 */
export function BarraSchede({ attiva, onCambia }: { attiva: Scheda; onCambia: (s: Scheda) => void }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[1000] px-4"
      style={{ paddingBottom: 'calc(var(--mf-safe-bottom) + var(--mf-tabbar-gap))' }}
    >
      <nav
        aria-label="Schede"
        className="mf-vetro pointer-events-auto mx-auto flex h-[var(--mf-tabbar-h)] max-w-md items-stretch rounded-full p-1.5"
      >
        {SCHEDE.map(({ id, etichetta, icona: Icona }) => {
          const attivo = id === attiva;
          return (
            <button
              key={id}
              type="button"
              aria-current={attivo ? 'page' : undefined}
              onClick={() => {
                if (!attivo) void triggerHaptic('selection');
                onCambia(id);
              }}
              className={`relative flex flex-1 flex-col items-center justify-center gap-[3px] rounded-full transition-colors duration-200 ${attivo ? 'text-mf-ink' : 'text-mf-ink-2'}`}
            >
              {attivo && (
                <motion.span
                  layoutId="scheda-attiva"
                  aria-hidden
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: 'linear-gradient(180deg, color-mix(in srgb, var(--mf-umore) 26%, transparent), color-mix(in srgb, var(--mf-umore-2) 14%, transparent))',
                    boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--mf-umore) 34%, transparent), 0 6px 18px -8px color-mix(in srgb, var(--mf-umore) 70%, transparent)',
                  }}
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <Icona
                size={22}
                strokeWidth={attivo ? 2.4 : 1.9}
                aria-hidden
                className="relative transition-transform duration-200"
                style={attivo ? { color: 'var(--mf-umore)', transform: 'translateY(-1px)' } : undefined}
              />
              <span className={`relative text-[11px] ${attivo ? 'font-semibold' : 'font-medium'}`}>{etichetta}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

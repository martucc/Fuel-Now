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
 * La barra delle schede, come su iOS: quattro voci, icona e parola, la
 * scheda attiva in blu. Fondo quasi pieno invece del vetro sfocato: la
 * sfocatura sopra una mappa WebGL costa fotogrammi su Android.
 */
export function BarraSchede({ attiva, onCambia }: { attiva: Scheda; onCambia: (s: Scheda) => void }) {
  return (
    <nav
      aria-label="Schede"
      className="fixed inset-x-0 bottom-0 z-[1000] border-t border-mf-hairline bg-[rgb(18_18_20/0.97)]"
      style={{ paddingBottom: 'var(--mf-safe-bottom)' }}
    >
      <div className="mx-auto flex h-[var(--mf-tabbar-h)] max-w-xl items-stretch">
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
              className={`flex flex-1 flex-col items-center justify-center gap-[3px] transition-colors ${attivo ? 'text-mf-accent' : 'text-mf-ink-3'}`}
            >
              <Icona size={23} strokeWidth={attivo ? 2.3 : 1.9} aria-hidden />
              <span className="text-[10.5px] font-medium tracking-[0.01em]">{etichetta}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

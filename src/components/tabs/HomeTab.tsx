import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SCHERMATA, BLOCCO } from '../../design/motion';
import { SlidersHorizontal, AlertTriangle, Home } from 'lucide-react';
import type { FuelKey } from '../../domain/raw';
import type { HomeModel } from '../../ui/home/homeModel';
import type { RankedStation } from '../../domain/ranking';
import { FuelTabs } from '../../ui/home/FuelTabs';
import { AnswerCard } from '../../ui/home/AnswerCard';
import { AdviceCard } from '../../ui/home/AdviceCard';
import { Tabellone } from '../../ui/home/Tabellone';
import { StationRowItem } from '../../ui/home/StationRowItem';
import { WhySheet } from '../../ui/home/WhySheet';
import { Toggle } from '../../design/primitives/Toggle';

interface Props {
  model: HomeModel | null;
  loading: boolean;
  fuel: FuelKey;
  setFuel: (f: FuelKey) => void;
  radius: number;
  setRadius: (v: number) => void;
  onOpenMap: () => void;
  onOpenFilters: () => void;
  onStationClick: (id: string) => void;
  /** Il commento del modello, solo se e davvero arrivato dall'IA. */
  aiNote?: string | null;
  /** Frase da mostrare quando i prezzi in mano non sono di questi giorni. */
  datiStantii?: string | null;
  /** Fa spiegare il conto a parole. Assente senza chiave. */
  onSpiega?: (s: RankedStation) => Promise<string>;
  onImpostazioni?: () => void;
  /** Modalità rientro verso casa */
  homeMode: boolean;
  setHomeMode: (v: boolean) => void;
  homeAddress: string;
  onOpenHomeAddressModal: () => void;
  onNavigateHome?: (station: RankedStation) => void;
}

export function HomeTab(p: Props) {
  const [showWhy, setShowWhy] = useState(false);

  const navigate = () => {
    const b = p.model?.best;
    if (!b) return;

    if (p.homeMode && p.model?.homeLocation && p.onNavigateHome) {
      p.onNavigateHome(b);
      return;
    }

    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${b.row.lat},${b.row.lng}`,
      '_blank',
      'noreferrer'
    );
  };

  return (
    <motion.div
      key="home"
      variants={SCHERMATA}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-5 pb-32"
    >
      <motion.div variants={BLOCCO} className="flex items-center justify-between px-1">
        <FuelTabs value={p.fuel} onChange={p.setFuel} />
        <button
          onClick={p.onOpenFilters}
          className="p-2 transition-transform active:scale-90"
          style={{ color: 'var(--mf-ink-2)' }}
          aria-label="Filtri"
        >
          <SlidersHorizontal size={18} />
        </button>
      </motion.div>

      {/* SELETTORE VERSO CASA / RIENTRO */}
      <motion.div
        variants={BLOCCO}
        className="flex flex-col gap-2 px-4 py-3.5"
        style={{
          background: p.homeMode ? 'rgba(56, 189, 248, 0.07)' : 'var(--mf-surface)',
          border: `1px solid ${p.homeMode ? 'var(--mf-accent)' : 'var(--mf-hairline)'}`,
          borderRadius: 'var(--mf-radius-md)',
          transition: 'all 0.2s ease',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="p-1.5 rounded-full"
              style={{
                background: p.homeMode ? 'var(--mf-accent)' : 'var(--mf-surface-raised)',
                color: p.homeMode ? 'var(--mf-accent-ink)' : 'var(--mf-ink-2)',
              }}
            >
              <Home size={15} />
            </div>
            <div>
              <span style={{ color: 'var(--mf-ink)', fontSize: 13.5, fontWeight: 600 }}>
                Direzione Casa
              </span>
              <span className="block" style={{ color: 'var(--mf-ink-2)', fontSize: 11 }}>
                Ottimizza il pieno lungo il rientro a casa
              </span>
            </div>
          </div>

          <Toggle
            on={p.homeMode}
            onChange={() => {
              if (!p.homeMode && !p.homeAddress) {
                p.onOpenHomeAddressModal();
              } else {
                p.setHomeMode(!p.homeMode);
              }
            }}
            ariaLabel="Direzione Casa"
          />
        </div>

        {p.homeMode && (
          <div
            className="mt-1 flex items-center justify-between pt-2 text-xs"
            style={{ borderTop: '1px solid var(--mf-hairline)' }}
          >
            <span className="truncate pr-2" style={{ color: 'var(--mf-ink-2)' }}>
              Destinazione:{' '}
              <strong style={{ color: 'var(--mf-ink)' }}>
                {p.homeAddress || 'Non impostata'}
              </strong>
            </span>
            <button
              onClick={p.onOpenHomeAddressModal}
              className="flex-shrink-0 font-medium transition-opacity active:scale-95"
              style={{ color: 'var(--mf-accent)' }}
            >
              Modifica ✏️
            </button>
          </div>
        )}
      </motion.div>

      {/* Prezzi vecchi dichiarati */}
      {p.datiStantii && (
        <motion.div
          variants={BLOCCO}
          className="flex items-start gap-2.5 px-4 py-3"
          style={{
            background: 'var(--mf-surface)',
            border: '1px solid var(--mf-price-high)',
            borderRadius: 'var(--mf-radius-md)',
          }}
        >
          <AlertTriangle size={16} style={{ color: 'var(--mf-price-high)', flexShrink: 0, marginTop: 1 }} />
          <p style={{ color: 'var(--mf-ink-2)', fontSize: 12.5, lineHeight: 1.5 }}>
            <span style={{ color: 'var(--mf-ink)' }}>{p.datiStantii}.</span>{' '}
            Connettiti un momento e li aggiorno.
          </p>
        </motion.div>
      )}

      {p.model ? (
        <>
          <motion.div variants={BLOCCO}>
            <AnswerCard
              model={p.model}
              onNavigate={navigate}
              onWhy={() => setShowWhy(true)}
              radius={p.radius}
              onWiden={() => p.setRadius(Math.min(100, p.radius * 2))}
            />
          </motion.div>

          <motion.div variants={BLOCCO}>
            <AdviceCard model={p.model} aiNote={p.aiNote} />
          </motion.div>

          <motion.div
            variants={BLOCCO}
            className="px-4 py-4"
            style={{
              background: 'var(--mf-surface)',
              borderRadius: 'var(--mf-radius-md)',
              border: '1px solid var(--mf-hairline)',
            }}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="mf-label" style={{ color: 'var(--mf-ink-2)', fontSize: 10 }}>
                raggio
              </span>
              <span className="mf-num" style={{ color: 'var(--mf-accent)', fontSize: 12 }}>
                {p.radius} km
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              value={p.radius}
              onChange={(e) => p.setRadius(Number(e.target.value))}
              className="w-full"
              style={{ accentColor: 'var(--mf-accent)' }}
            />
          </motion.div>

          <motion.div variants={BLOCCO}>
            <Tabellone model={p.model} onOpen={p.onOpenMap} />
          </motion.div>

          <motion.div
            variants={BLOCCO}
            className="px-4"
            style={{
              background: 'var(--mf-surface)',
              borderRadius: 'var(--mf-radius-md)',
              border: '1px solid var(--mf-hairline)',
            }}
          >
            <div className="flex items-center justify-between py-4">
              <span className="mf-label" style={{ color: 'var(--mf-ink-2)', fontSize: 10 }}>
                {p.homeMode ? 'altri impianti lungo la rotta' : 'altri impianti'}
              </span>
              <span className="mf-num" style={{ color: 'var(--mf-ink-2)', fontSize: 11 }}>
                {p.model.eligibleCount} confrontati
              </span>
            </div>
            {p.model.list.slice(0, 40).map((item) => (
              <StationRowItem key={item.id} item={item} onClick={p.onStationClick} />
            ))}
            {p.model.list.length === 0 && (
              <p className="py-10 text-center" style={{ color: 'var(--mf-ink-2)', fontSize: 13 }}>
                Nessun impianto in questo raggio.
              </p>
            )}
          </motion.div>
        </>
      ) : (
        <div className="py-20 text-center" style={{ color: 'var(--mf-ink-2)', fontSize: 13 }}>
          {p.loading ? 'Carico i prezzi…' : 'Serve la posizione per dire dove conviene.'}
        </div>
      )}

      <AnimatePresence>
        {showWhy && p.model?.best && (
          <WhySheet
            station={p.model.best}
            onClose={() => setShowWhy(false)}
            onSpiega={p.onSpiega}
            onImpostazioni={p.onImpostazioni}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

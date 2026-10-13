import { motion } from 'motion/react';
import type { CSSProperties } from 'react';
import { EyeOff, Flag, X } from 'lucide-react';

interface Props {
  stationName: string;
  onHide: () => void;
  onReport: () => void;
  onClose: () => void;
}

const ACTION: CSSProperties = {
  display: 'flex',
  width: '100%',
  alignItems: 'center',
  gap: 12,
  padding: 16,
  borderRadius: 'var(--mf-radius-md)',
  border: '1px solid var(--mf-hairline)',
  background: 'var(--mf-surface)',
  color: 'var(--mf-ink)',
  fontFamily: 'var(--mf-font-sans)',
  fontWeight: 600,
  fontSize: 15,
  textAlign: 'left',
};

/**
 * Sostituisce confirm(), che nella WebView Capacitor blocca il thread e
 * costringeva a leggere «[OK] nascondi / [ANNULLA] segnala»: due azioni
 * diverse travestite da conferma.
 */
export function BlockSheet({ stationName, onHide, onReport, onClose }: Props) {
  return (
    <motion.div
      className="fixed inset-0 z-[3000] flex items-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ background: 'rgba(0,0,0,.6)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full space-y-3 p-6"
        style={{
          background: 'var(--mf-surface-raised)',
          borderTopLeftRadius: 'var(--mf-radius-lg)',
          borderTopRightRadius: 'var(--mf-radius-lg)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)',
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <h2
            className="min-w-0 truncate"
            style={{ fontFamily: 'var(--mf-font-sans)', fontWeight: 700, fontSize: 17, color: 'var(--mf-ink)' }}
          >
            {stationName}
          </h2>
          <button onClick={onClose} aria-label="Chiudi" className="flex-shrink-0" style={{ color: 'var(--mf-ink-2)' }}>
            <X size={20} />
          </button>
        </div>

        <button onClick={onHide} style={ACTION}>
          <EyeOff size={18} style={{ color: 'var(--mf-ink-2)', flexShrink: 0 }} />
          <span>
            Nascondi solo per me
            <span className="block" style={{ color: 'var(--mf-ink-2)', fontSize: 11, fontWeight: 400 }}>
              sparisce dai tuoi risultati
            </span>
          </span>
        </button>

        <button onClick={onReport} style={ACTION}>
          <Flag size={18} style={{ color: 'var(--mf-ink-2)', flexShrink: 0 }} />
          <span>
            Segnala alla community
            <span className="block" style={{ color: 'var(--mf-ink-2)', fontSize: 11, fontWeight: 400 }}>
              la nascondo e apro una segnalazione per tutti
            </span>
          </span>
        </button>
      </motion.div>
    </motion.div>
  );
}

import { useState } from 'react';
import { Sparkles, RefreshCw, KeyRound } from 'lucide-react';
import type { RankedStation } from '../../domain/ranking';
import { whyRows } from './why';
import { Sheet } from '../../design/primitives/Sheet';
import { Button } from '../../design/primitives/Button';

interface Props {
  station: RankedStation;
  onClose: () => void;
  /**
   * Chiede al modello di spiegare a parole questo conto. Assente quando non
   * c'e una chiave: i numeri qui sotto bastano comunque a se stessi.
   */
  onSpiega?: (station: RankedStation) => Promise<string>;
  onImpostazioni?: () => void;
}

type Stato = { fase: 'fermo' } | { fase: 'attesa' } | { fase: 'detta'; testo: string } | { fase: 'guasto'; testo: string };

export function WhySheet({ station, onClose, onSpiega, onImpostazioni }: Props) {
  const rows = whyRows(station);
  const [stato, setStato] = useState<Stato>({ fase: 'fermo' });

  const spiega = async () => {
    if (!onSpiega) return;
    setStato({ fase: 'attesa' });
    try {
      const testo = await onSpiega(station);
      setStato({ fase: 'detta', testo });
    } catch (e: any) {
      setStato({ fase: 'guasto', testo: e?.message || 'Non sono riuscito a chiederlo.' });
    }
  };

  return (
    <Sheet title="Come è venuto il conto" onClose={onClose}>
      <div className="pb-2">
        <div className="flex flex-col">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-center justify-between gap-4 py-3"
              style={{ borderTop: '1px solid var(--mf-hairline)' }}
            >
              <span style={{ color: 'var(--mf-ink-2)', fontSize: 13, fontFamily: 'var(--mf-font-sans)' }}>
                {r.label}
              </span>
              <span
                className="mf-num flex-shrink-0"
                style={{
                  color: 'var(--mf-ink)',
                  fontSize: r.emphasis ? 18 : 14,
                  fontWeight: r.emphasis ? 600 : 500,
                }}
              >
                {r.value}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-4" style={{ color: 'var(--mf-ink-2)', fontSize: 11.5, lineHeight: 1.55 }}>
          La distanza è in linea d’aria e il viaggio è contato andata e ritorno. Con l’auto scelta nel
          Garage i litri e il consumo diventano i tuoi.
        </p>

        {/* La spiegazione a parole: i numeri sopra restano la verita, questa
            e solo un'altra voce che li racconta. */}
        <div className="mt-6 pt-5" style={{ borderTop: '1px solid var(--mf-hairline)' }}>
          {!onSpiega ? (
            <div className="flex items-start gap-3">
              <KeyRound size={16} style={{ color: 'var(--mf-muted)', flexShrink: 0, marginTop: 2 }} />
              <div className="min-w-0 flex-1">
                <p style={{ color: 'var(--mf-ink-2)', fontSize: 12.5, lineHeight: 1.55 }}>
                  Con una chiave Gemini nelle impostazioni posso raccontarti questo conto a parole,
                  invece di lasciarti solo le cifre.
                </p>
                {onImpostazioni && (
                  <div className="mt-3">
                    <Button size="sm" tone="ghost" onClick={onImpostazioni}>Impostazioni</Button>
                  </div>
                )}
              </div>
            </div>
          ) : stato.fase === 'detta' ? (
            <>
              <div className="mb-2 flex items-center gap-1.5">
                <Sparkles size={12} style={{ color: 'var(--mf-accent)' }} />
                <span className="mf-label" style={{ fontSize: 9 }}>spiegato dall’analisi</span>
              </div>
              <p className="whitespace-pre-wrap" style={{ color: 'var(--mf-ink)', fontSize: 13.5, lineHeight: 1.65 }}>
                {stato.testo}
              </p>
            </>
          ) : stato.fase === 'guasto' ? (
            <>
              <p style={{ color: 'var(--mf-price-high)', fontSize: 12.5, lineHeight: 1.55 }}>{stato.testo}</p>
              <p className="mt-1" style={{ color: 'var(--mf-ink-2)', fontSize: 12 }}>
                I numeri qui sopra restano validi: sono calcolati sul telefono.
              </p>
              <div className="mt-3">
                <Button size="sm" tone="quiet" onClick={spiega}>Riprova</Button>
              </div>
            </>
          ) : (
            <Button
              full
              size="md"
              tone="ghost"
              disabled={stato.fase === 'attesa'}
              icon={
                stato.fase === 'attesa'
                  ? <RefreshCw size={15} className="animate-spin" />
                  : <Sparkles size={15} />
              }
              onClick={spiega}
            >
              {stato.fase === 'attesa' ? 'Ci sto pensando…' : 'Spiegamelo a parole'}
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}

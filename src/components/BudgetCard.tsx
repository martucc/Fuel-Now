import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, Pencil } from 'lucide-react';
import { computeBudget, loadBudget, saveBudget, type BudgetView } from '../services/budgetService';
import { Card, Stat, Empty } from '../design/primitives/Surface';
import { Button } from '../design/primitives/Button';
import { Sheet } from '../design/primitives/Sheet';
import { Toggle } from '../design/primitives/Toggle';
import { euro } from '../lib/formato';

interface Props {
  carModel: string;
}

export function BudgetCard({ carModel }: Props) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [view, setView] = useState<BudgetView | null>(() => computeBudget(carModel));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setView(computeBudget(carModel));
  }, [carModel, refreshKey]);

  useEffect(() => {
    const h = () => setRefreshKey((k) => k + 1);
    window.addEventListener('mf-fillup-changed', h);
    window.addEventListener('mf-expenses-changed', h);
    window.addEventListener('mf-budget-changed', h);
    return () => {
      window.removeEventListener('mf-fillup-changed', h);
      window.removeEventListener('mf-expenses-changed', h);
      window.removeEventListener('mf-budget-changed', h);
    };
  }, []);

  if (!view) {
    return (
      <>
        <Card pad="md">
          <Empty
            icon={<Wallet size={20} />}
            title="Nessun tetto di spesa"
            hint="Dai un limite al mese e ti dico ogni giorno quanto ti resta."
            action={<Button size="sm" onClick={() => setEditing(true)}>Imposta</Button>}
          />
        </Card>
        <AnimatePresence>{editing && <FoglioBudget onClose={() => setEditing(false)} />}</AnimatePresence>
      </>
    );
  }

  const colore =
    view.status === 'over' ? 'var(--mf-price-worst)'
      : view.status === 'warn' ? 'var(--mf-price-high)'
        : 'var(--mf-price-best)';

  const usato = Math.min(100, view.pct);
  const sforo = view.pct > 100 ? Math.min(40, view.pct - 100) : 0;
  const resta = view.budget - view.spent;
  const proiezioneSopra = view.projection > view.budget;
  const alGiorno = view.daysLeft > 0 ? resta / view.daysLeft : null;

  return (
    <>
      <Card pad="lg">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mf-label" style={{ fontSize: 9 }}>speso questo mese</div>
            <div
              className="mf-num mt-2"
              style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.045em', color: 'var(--mf-ink)', lineHeight: 1 }}
            >
              {euro(view.spent)}
            </div>
            <p className="mf-num mt-1.5" style={{ color: 'var(--mf-ink-2)', fontSize: 12 }}>
              su {euro(view.budget, 0)}
              {view.includeOther && ` · ${euro(view.spentFuel)} di carburante`}
            </p>
          </div>
          <button
            onClick={() => setEditing(true)}
            aria-label="Modifica il budget"
            className="flex flex-shrink-0 items-center justify-center"
            style={{
              width: 38, height: 38, borderRadius: 'var(--mf-radius-pill)',
              background: 'var(--mf-ground)', border: '1px solid var(--mf-hairline)', color: 'var(--mf-ink-2)',
            }}
          >
            <Pencil size={15} />
          </button>
        </div>

        {/* La barra: piena fino a quanto hai speso, il rosso oltre e lo sforamento. */}
        <div
          className="relative mt-6 overflow-hidden"
          style={{ height: 8, borderRadius: 'var(--mf-radius-pill)', background: 'var(--mf-ground)' }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${usato}%` }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            style={{ height: '100%', background: colore, borderRadius: 'var(--mf-radius-pill)' }}
          />
          {sforo > 0 && (
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${sforo}%` }}
              transition={{ duration: 0.55, delay: 0.15, ease: 'easeOut' }}
              className="absolute right-0 top-0"
              style={{ height: '100%', background: 'var(--mf-price-worst)', opacity: 0.75 }}
            />
          )}
        </div>

        <div className="mf-num mt-2 flex justify-between" style={{ fontSize: 11 }}>
          <span style={{ color: colore }}>{Math.round(view.pct)}% usato</span>
          <span style={{ color: 'var(--mf-muted)' }}>{view.daysLeft} giorni al mese nuovo</span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <Stat
            label="ti restano"
            value={euro(Math.max(0, resta))}
            color={resta < 0 ? 'var(--mf-price-worst)' : 'var(--mf-ink)'}
            sub={alGiorno != null ? `${euro(Math.max(0, alGiorno))} al giorno` : undefined}
          />
          <Stat
            label="a fine mese"
            value={euro(view.projection)}
            color={proiezioneSopra ? 'var(--mf-price-worst)' : 'var(--mf-price-best)'}
            sub={
              proiezioneSopra
                ? `${euro(view.projection - view.budget)} oltre`
                : `${euro(view.budget - view.projection)} di margine`
            }
          />
        </div>

        <p className="mt-5" style={{ color: 'var(--mf-ink-2)', fontSize: 11, lineHeight: 1.5 }}>
          {proiezioneSopra
            ? 'Al ritmo di adesso sfori. Un pieno in meno, o uno più economico, rientra.'
            : 'Al ritmo di adesso chiudi il mese dentro il budget.'}
        </p>
      </Card>

      <AnimatePresence>{editing && <FoglioBudget onClose={() => setEditing(false)} />}</AnimatePresence>
    </>
  );
}

const PRESET = [100, 150, 200, 300];

function FoglioBudget({ onClose }: { onClose: () => void }) {
  const corrente = loadBudget();
  const [importo, setImporto] = useState(corrente.monthly > 0 ? String(corrente.monthly) : '');
  const [altreSpese, setAltreSpese] = useState(corrente.includeOther);

  const valore = parseFloat(importo.replace(',', '.')) || 0;

  return (
    <Sheet title="Quanto vuoi spendere al mese" onClose={onClose}>
      <div className="pb-2">
        <div
          className="px-5 py-5"
          style={{ background: 'var(--mf-ground)', borderRadius: 'var(--mf-radius-md)', border: '1px solid var(--mf-hairline)' }}
        >
          <div className="mf-label" style={{ fontSize: 9 }}>tetto mensile</div>
          <div className="mt-2 flex items-baseline gap-2">
            <input
              inputMode="decimal"
              value={importo}
              onChange={(e) => setImporto(e.target.value)}
              placeholder="200"
              autoFocus
              className="mf-num w-full min-w-0 border-none bg-transparent outline-none"
              style={{ color: 'var(--mf-ink)', fontSize: 40, fontWeight: 700, letterSpacing: '-0.045em' }}
            />
            <span className="mf-num flex-shrink-0" style={{ color: 'var(--mf-ink-2)', fontSize: 24 }}>€</span>
          </div>
          <div className="mt-4 flex gap-2">
            {PRESET.map((v) => {
              const attivo = valore === v;
              return (
                <button
                  key={v}
                  onClick={() => setImporto(String(v))}
                  className="mf-num flex-1 py-2"
                  style={{
                    borderRadius: 'var(--mf-radius-pill)',
                    fontSize: 12,
                    background: attivo ? 'var(--mf-accent)' : 'transparent',
                    color: attivo ? 'var(--mf-accent-ink)' : 'var(--mf-ink-2)',
                    border: `1px solid ${attivo ? 'var(--mf-accent)' : 'var(--mf-hairline)'}`,
                  }}
                >
                  {v} €
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div style={{ fontFamily: 'var(--mf-font-sans)', fontWeight: 600, fontSize: 14, color: 'var(--mf-ink)' }}>
              Conta anche bollo e officina
            </div>
            <p className="mt-0.5" style={{ color: 'var(--mf-ink-2)', fontSize: 12 }}>
              Se spento, il budget vale solo per il carburante.
            </p>
          </div>
          <Toggle on={altreSpese} onChange={() => setAltreSpese((v) => !v)} ariaLabel="Includi le altre spese" />
        </div>

        <p className="mt-5" style={{ color: 'var(--mf-muted)', fontSize: 11, lineHeight: 1.5 }}>
          Ti avviso al 75%, al 90% e quando sfori — se hai lasciato attive le notifiche.
        </p>

        <div className="mt-6 flex gap-3">
          {corrente.monthly > 0 && (
            <Button
              tone="danger"
              size="md"
              onClick={() => {
                saveBudget({ monthly: 0, includeOther: false });
                onClose();
              }}
            >
              Togli
            </Button>
          )}
          <div className="flex-1">
            <Button
              full
              size="md"
              disabled={valore <= 0}
              onClick={() => {
                saveBudget({ monthly: Math.max(0, valore), includeOther: altreSpese });
                onClose();
              }}
            >
              Salva
            </Button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

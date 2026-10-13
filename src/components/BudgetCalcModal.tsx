import { useState, useMemo } from 'react';
import { AnimatePresence } from 'motion/react';
import type { FuelType } from '../types';
import { Sheet } from '../design/primitives/Sheet';
import { Stat } from '../design/primitives/Surface';
import { Field, Input } from '../design/primitives/Field';
import { numero as num, prezzoEuro } from '../lib/formato';

interface Props {
  show: boolean;
  onClose: () => void;
  fuel: FuelType;
  defaultPrice: number;
  carKml?: number;
  tankL?: number;
}

const IMPORTI = [10, 20, 30, 50];

export function BudgetCalcModal({ show, onClose, fuel, defaultPrice, carKml, tankL }: Props) {
  const [importo, setImporto] = useState('20');
  const [prezzoManuale, setPrezzoManuale] = useState('');

  const prezzo = useMemo(() => {
    const p = parseFloat(prezzoManuale.replace(',', '.'));
    if (isFinite(p) && p > 0) return p;
    return defaultPrice > 0 && isFinite(defaultPrice) ? defaultPrice : 1.8;
  }, [prezzoManuale, defaultPrice]);

  const spesa = useMemo(() => parseFloat(importo.replace(',', '.')) || 0, [importo]);

  const litri = prezzo > 0 ? spesa / prezzo : 0;
  const km = carKml ? litri * carKml : null;
  const quotaSerbatoio = tankL ? Math.min(1, litri / tankL) : null;

  return (
    <AnimatePresence>
      {show && (
        <Sheet title={`Se metto tot di ${fuel.toLowerCase()}`} onClose={onClose}>
          <div className="space-y-5 pb-2">
            <Field label="quanto spendi">
              <div className="flex items-baseline gap-2">
                <Input value={importo} onChange={setImporto} placeholder="20" inputMode="decimal" mono big />
                <span className="mf-num flex-shrink-0" style={{ color: 'var(--mf-ink-2)', fontSize: 18 }}>€</span>
              </div>
            </Field>

            <div className="flex gap-2">
              {IMPORTI.map((v) => {
                const attivo = spesa === v;
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

            {/* Il risultato, grande: e l'unica cosa per cui si apre questa schermata. */}
            <div
              className="px-5 py-6 text-center"
              style={{
                background: 'var(--mf-ground)',
                border: '1px solid var(--mf-hairline)',
                borderRadius: 'var(--mf-radius-md)',
              }}
            >
              <div className="mf-label" style={{ fontSize: 9 }}>ti danno</div>
              <div
                className="mf-num mt-2"
                style={{ fontSize: 46, fontWeight: 700, letterSpacing: '-0.05em', color: 'var(--mf-ink)', lineHeight: 1 }}
              >
                {num(litri, 1)}
                <span style={{ fontSize: 20, color: 'var(--mf-ink-2)', marginLeft: 6 }}>litri</span>
              </div>
              {km != null && (
                <p className="mt-3" style={{ color: 'var(--mf-ink-2)', fontSize: 13 }}>
                  circa <span className="mf-num" style={{ color: 'var(--mf-ink)' }}>{num(km, 0)} km</span> con la tua auto
                </p>
              )}
            </div>

            {quotaSerbatoio != null && (
              <div>
                <div className="mf-label mb-2 flex justify-between" style={{ fontSize: 9 }}>
                  <span>quanto serbatoio riempi</span>
                  <span className="mf-num">{Math.round(quotaSerbatoio * 100)}%</span>
                </div>
                <div style={{ height: 8, borderRadius: 'var(--mf-radius-pill)', background: 'var(--mf-ground)' }}>
                  <div
                    style={{
                      width: `${quotaSerbatoio * 100}%`,
                      height: '100%',
                      borderRadius: 'var(--mf-radius-pill)',
                      background: 'var(--mf-accent)',
                      transition: 'width 260ms ease-out',
                    }}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Stat label="prezzo usato" value={prezzoEuro(prezzo)} sub={prezzoManuale ? 'tuo' : 'il migliore in zona'} />
              <Stat label="al chilometro" value={carKml ? `${num(prezzo / carKml, 3)} €` : '—'} />
            </div>

            <Field label="prezzo diverso" hint="Lascialo vuoto e uso il prezzo del distributore consigliato.">
              <Input value={prezzoManuale} onChange={setPrezzoManuale} placeholder={num(prezzo, 3)} inputMode="decimal" mono />
            </Field>
          </div>
        </Sheet>
      )}
    </AnimatePresence>
  );
}

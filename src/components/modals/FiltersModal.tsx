import { AnimatePresence } from 'motion/react';
import { Check } from 'lucide-react';
import { Sheet } from '../../design/primitives/Sheet';
import { Button } from '../../design/primitives/Button';
import { Toggle } from '../../design/primitives/Toggle';
import { BrandLogo } from '../../design/primitives/BrandLogo';

interface Props {
  show: boolean; setShow: (v: boolean) => void;
  selectedBrands: string[]; setSelectedBrands: (v: string[]) => void;
  selectedServices: string[]; setSelectedServices: (v: string[]) => void;
  h24: boolean; setH24: (v: boolean) => void;
  noHighway: boolean; setNoHighway: (v: boolean) => void;
  hideAnomalies: boolean; setHideAnomalies: (v: boolean) => void;
  radius: number; setRadius: (v: number) => void;
  brands: string[];
}

const SERVIZI = ['Self-Service', 'Bar', 'Autolavaggio', 'Officina'];

export function FiltersModal(p: Props) {
  const attivi =
    p.selectedBrands.length + p.selectedServices.length + (p.h24 ? 1 : 0) + (p.noHighway ? 1 : 0) + (p.hideAnomalies ? 1 : 0);

  return (
    <AnimatePresence>
      {p.show && (
        <Sheet title="Filtri" onClose={() => p.setShow(false)}>
          <div className="space-y-7 pb-4">
            {/* Raggio */}
            <section>
              <div className="flex items-baseline justify-between gap-3">
                <div className="mf-label" style={{ fontSize: 9 }}>fin dove cerchi</div>
                <span className="mf-num" style={{ color: 'var(--mf-accent)', fontSize: 13 }}>{p.radius} km</span>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                value={p.radius}
                onChange={(e) => p.setRadius(parseInt(e.target.value))}
                className="mt-3 w-full"
                style={{ accentColor: 'var(--mf-accent)' }}
              />
              <p className="mt-2" style={{ color: 'var(--mf-ink-2)', fontSize: 11.5, lineHeight: 1.5 }}>
                Più allarghi, più distributori entrano nel confronto — ma il carburante per arrivarci
                pesa già nel calcolo, quindi allargare non sposta quasi mai il consiglio.
              </p>
            </section>

            {/* Marchi */}
            {p.brands.length > 0 && (
              <section>
                <div className="mf-label mb-3" style={{ fontSize: 9 }}>solo questi marchi</div>
                <div className="flex flex-wrap gap-2">
                  {p.brands.map((b) => {
                    const attivo = p.selectedBrands.includes(b);
                    return (
                      <button
                        key={b}
                        onClick={() =>
                          p.setSelectedBrands(attivo ? p.selectedBrands.filter((x) => x !== b) : [...p.selectedBrands, b])
                        }
                        className="flex items-center gap-2 py-1.5 pl-1.5 pr-3.5"
                        style={{
                          borderRadius: 'var(--mf-radius-pill)',
                          background: attivo ? 'var(--mf-accent)' : 'transparent',
                          color: attivo ? 'var(--mf-accent-ink)' : 'var(--mf-ink-2)',
                          border: `1px solid ${attivo ? 'var(--mf-accent)' : 'var(--mf-hairline)'}`,
                          fontSize: 12.5,
                          fontFamily: 'var(--mf-font-sans)',
                          fontWeight: attivo ? 600 : 500,
                        }}
                      >
                        <BrandLogo brand={b} size={22} />
                        {b}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Servizi */}
            <section>
              <div className="mf-label mb-3" style={{ fontSize: 9 }}>deve avere</div>
              <div className="flex flex-wrap gap-2">
                {SERVIZI.map((s) => {
                  const attivo = p.selectedServices.includes(s);
                  return (
                    <button
                      key={s}
                      onClick={() =>
                        p.setSelectedServices(attivo ? p.selectedServices.filter((x) => x !== s) : [...p.selectedServices, s])
                      }
                      className="flex items-center gap-1.5 px-3.5 py-2"
                      style={{
                        borderRadius: 'var(--mf-radius-pill)',
                        background: attivo ? 'var(--mf-accent)' : 'transparent',
                        color: attivo ? 'var(--mf-accent-ink)' : 'var(--mf-ink-2)',
                        border: `1px solid ${attivo ? 'var(--mf-accent)' : 'var(--mf-hairline)'}`,
                        fontSize: 12.5,
                        fontFamily: 'var(--mf-font-sans)',
                        fontWeight: attivo ? 600 : 500,
                      }}
                    >
                      {attivo && <Check size={13} />}
                      {s}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Interruttori */}
            <section className="space-y-4">
              <div className="mf-label" style={{ fontSize: 9 }}>escludi</div>

              <Interruttore
                titolo="Solo aperti 24 ore"
                nota="Utile di notte, inutile di giorno: taglia parecchi distributori."
                on={p.h24}
                onChange={() => p.setH24(!p.h24)}
              />
              <Interruttore
                titolo="Niente autostrada"
                nota="In autostrada si paga il servizio, non il carburante."
                on={p.noHighway}
                onChange={() => p.setNoHighway(!p.noHighway)}
              />
              <Interruttore
                titolo="Nascondi i prezzi sospetti"
                nota="Quelli troppo bassi per essere veri: spesso sono errori di comunicazione."
                on={p.hideAnomalies}
                onChange={() => p.setHideAnomalies(!p.hideAnomalies)}
              />
            </section>

            <div className="flex gap-3 pt-1">
              <Button
                tone="quiet"
                size="md"
                disabled={attivi === 0 && p.radius === 20}
                onClick={() => {
                  p.setSelectedBrands([]);
                  p.setSelectedServices([]);
                  p.setH24(false);
                  p.setNoHighway(false);
                  p.setHideAnomalies(false);
                  p.setRadius(20);
                }}
              >
                Azzera
              </Button>
              <div className="flex-1">
                <Button full size="md" onClick={() => p.setShow(false)}>
                  {attivi > 0 ? `Applica ${attivi} filtri` : 'Chiudi'}
                </Button>
              </div>
            </div>
          </div>
        </Sheet>
      )}
    </AnimatePresence>
  );
}

function Interruttore({
  titolo, nota, on, onChange,
}: {
  titolo: string;
  nota: string;
  on: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div style={{ fontFamily: 'var(--mf-font-sans)', fontWeight: 600, fontSize: 14, color: 'var(--mf-ink)' }}>
          {titolo}
        </div>
        <p className="mt-0.5" style={{ color: 'var(--mf-ink-2)', fontSize: 11.5, lineHeight: 1.45 }}>
          {nota}
        </p>
      </div>
      <Toggle on={on} onChange={onChange} ariaLabel={titolo} />
    </div>
  );
}

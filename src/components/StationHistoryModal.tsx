import { useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Navigation, EyeOff } from 'lucide-react';
import type { FuelStation, FuelType } from '../types';
import { getStationHistory } from '../services/stationHistoryService';
import { Sheet } from '../design/primitives/Sheet';
import { Button } from '../design/primitives/Button';
import { Stat } from '../design/primitives/Surface';
import { BrandLogo } from '../design/primitives/BrandLogo';
import { prezzoEuro, numero } from '../lib/formato';

interface Props {
  station: FuelStation | null;
  fuel: FuelType;
  onClose: () => void;
  onBlock?: (s: FuelStation) => void;
}

const FUELS: FuelType[] = ['Benzina', 'Diesel', 'GPL', 'Metano'];

const eur = prezzoEuro;
const giorno = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });

function quandoAggiornato(valore?: string) {
  if (!valore) return null;
  try {
    const [data, ora] = valore.split(' ');
    const [a, m, g] = data.split('-');
    return `${g}/${m}/${a}${ora ? ` alle ${ora}` : ''}`;
  } catch {
    return valore;
  }
}

export function StationHistoryModal({ station, fuel, onClose, onBlock }: Props) {
  const [attivo, setAttivo] = useState<FuelType>(fuel);

  // Aprendo un altro impianto, o cambiando carburante nella Home, la scheda
  // riparte da quel carburante. Fatto in resa e non in un effetto: cosi non
  // si vede il vecchio prezzo per un fotogramma prima che si corregga.
  const [ultimo, setUltimo] = useState<{ fuel: FuelType; id: string | null }>({
    fuel,
    id: station?.id ?? null,
  });
  if (ultimo.fuel !== fuel || ultimo.id !== (station?.id ?? null)) {
    setUltimo({ fuel, id: station?.id ?? null });
    setAttivo(fuel);
  }

  const vista = useMemo(() => (station ? getStationHistory(station.id, attivo) : null), [station, attivo]);

  if (!station) return <AnimatePresence />;

  const disponibili = FUELS.filter((f) => station.prices.some((p) => p.type === f && p.price > 0));
  const prezzo = station.prices.find((p) => p.type === attivo);
  const aggiornato = quandoAggiornato(prezzo?.lastUpdated);

  const posto = [station.address, station.city].filter(Boolean).join(', ');

  return (
    <AnimatePresence>
      {station && (
        <Sheet
          onClose={onClose}
          title={station.name || station.brand || 'Distributore'}
          sottotitolo={posto || undefined}
          azioni={
            /* I due pulsanti stanno attaccati in fondo e non scorrono: prima
               erano in coda allo storico, e per premerli bisognava scorrere
               tutta la scheda. */
            <div className="space-y-2.5">
              <Button
                full
                size="lg"
                tone="primary"
                icon={<Navigation size={16} />}
                onClick={() => {
                  const { lat, lng } = station.location;
                  window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
                }}
              >
                Portami qui
              </Button>

              {onBlock && (
                <button
                  onClick={() => { onBlock(station); onClose(); }}
                  className="flex w-full items-center justify-center gap-1.5 py-1.5 active:scale-95"
                  style={{ color: 'var(--mf-muted)', fontSize: 12, transition: 'transform .12s ease' }}
                >
                  <EyeOff size={13} /> Non mostrarmi più questo
                </button>
              )}
            </div>
          }
        >
          <div>
            {/* Carburanti: si cambia qui, e il prezzo sotto segue. */}
            {disponibili.length > 1 && (
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {disponibili.map((f) => {
                  const acceso = f === attivo;
                  return (
                    <button
                      key={f}
                      onClick={() => setAttivo(f)}
                      className="flex-shrink-0 px-3.5 py-2 active:scale-95"
                      style={{
                        borderRadius: 'var(--mf-radius-pill)',
                        fontSize: 12.5,
                        fontFamily: 'var(--mf-font-sans)',
                        fontWeight: acceso ? 600 : 500,
                        background: acceso ? 'var(--mf-accent)' : 'transparent',
                        color: acceso ? 'var(--mf-accent-ink)' : 'var(--mf-ink-2)',
                        border: `1px solid ${acceso ? 'var(--mf-accent)' : 'var(--mf-hairline)'}`,
                        transition: 'transform .12s ease',
                      }}
                    >
                      {f}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Il prezzo, col marchio accanto: il nome sta gia in testa alla
                scheda, qui serve solo riconoscere l'insegna a colpo d'occhio. */}
            <div
              className={disponibili.length > 1 ? 'mt-4 flex items-center gap-4 px-5 py-4' : 'flex items-center gap-4 px-5 py-4'}
              style={{ background: 'var(--mf-ground)', border: '1px solid var(--mf-hairline)', borderRadius: 'var(--mf-radius-md)' }}
            >
              <BrandLogo brand={station.brand} name={station.name} size={44} />
              <div className="min-w-0 flex-1">
                <div className="mf-label" style={{ fontSize: 9 }}>{attivo.toLowerCase()} adesso</div>
                <div
                  className="mf-num mt-1"
                  style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.05em', color: 'var(--mf-ink)', lineHeight: 1 }}
                >
                  {prezzo?.price ? eur(prezzo.price) : '—'}
                </div>
              </div>
              {station.distance != null && (
                <div className="flex-shrink-0 text-right">
                  <div className="mf-num" style={{ fontSize: 15, fontWeight: 600, color: 'var(--mf-ink)' }}>
                    {numero(station.distance, 1)}
                  </div>
                  <div className="mf-label" style={{ fontSize: 9 }}>km da qui</div>
                </div>
              )}
            </div>

            <p className="mt-2.5" style={{ color: 'var(--mf-ink-2)', fontSize: 11.5, lineHeight: 1.5 }}>
              {prezzo?.isSelf ? 'Servito da te' : 'Servito dal gestore'}
              {aggiornato ? ` · comunicato il ${aggiornato}` : ''}
            </p>

            {/* Storico osservato */}
            {vista && vista.pointCount >= 2 ? (
              <div className="mt-6">
                <div className="mf-label mb-3" style={{ fontSize: 9 }}>
                  come si è mosso qui — {vista.pointCount} rilevazioni
                </div>

                <Sparkline serie={vista.series} min={vista.min} max={vista.max} />

                <div className="mt-4 grid grid-cols-3 gap-3">
                  <Stat label="minimo visto" value={eur(vista.min)} color="var(--mf-price-best)" />
                  <Stat label="media" value={eur(vista.avg)} />
                  <Stat label="massimo visto" value={eur(vista.max)} color="var(--mf-price-worst)" />
                </div>

                <p className="mt-4" style={{ color: 'var(--mf-ink-2)', fontSize: 12, lineHeight: 1.55 }}>
                  {Math.abs(vista.deltaPct) < 0.3
                    ? 'Da quando lo seguiamo il prezzo qui non si è praticamente mosso.'
                    : vista.deltaPct < 0
                      ? `Da quando lo seguiamo è sceso del ${numero(Math.abs(vista.deltaPct), 1)}%.`
                      : `Da quando lo seguiamo è salito del ${numero(vista.deltaPct, 1)}%.`}
                </p>
              </div>
            ) : (
              /* Riga sobria e non il riquadro vuoto grande: in un foglio che
                 si adatta al contenuto, centoquaranta pixel di niente fanno
                 sembrare rotta la scheda invece che nuova la stazione. */
              <div
                className="mt-5 px-4 py-3.5"
                style={{
                  background: 'var(--mf-ground)',
                  border: '1px dashed var(--mf-hairline)',
                  borderRadius: 'var(--mf-radius-md)',
                }}
              >
                <p style={{ color: 'var(--mf-ink-2)', fontSize: 12, lineHeight: 1.5 }}>
                  <span style={{ color: 'var(--mf-ink)', fontWeight: 600 }}>Ancora senza storico.</span>{' '}
                  Registro i prezzi che vedo a ogni apertura: fra qualche giorno qui compare
                  come si muove questo distributore.
                </p>
              </div>
            )}
          </div>
        </Sheet>
      )}
    </AnimatePresence>
  );
}

/** Linea semplice: qui interessa la forma, non i valori puntuali. */
function Sparkline({ serie, min, max }: { serie: { d: string; p: number }[]; min: number; max: number }) {
  const W = 320;
  const H = 78;
  const span = max - min || 0.001;

  const punti = serie.map((punto, i) => ({
    x: (i / Math.max(1, serie.length - 1)) * W,
    y: H - ((punto.p - min) / span) * (H - 8) - 4,
    d: punto.d,
  }));

  const linea = punti.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const ultimo = punti[punti.length - 1];
  const primo = punti[0];
  const sceso = serie[serie.length - 1].p <= serie[0].p;
  const colore = sceso ? 'var(--mf-price-best)' : 'var(--mf-price-worst)';

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: H }}>
        <path d={`${linea} L${W} ${H} L0 ${H} Z`} style={{ fill: colore, fillOpacity: 0.1 }} />
        <path d={linea} fill="none" style={{ stroke: colore }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {ultimo && <circle cx={ultimo.x} cy={ultimo.y} r="3.5" style={{ fill: colore }} />}
      </svg>
      <div className="mf-num mt-1 flex justify-between" style={{ fontSize: 10, color: 'var(--mf-muted)' }}>
        <span>{primo && giorno(primo.d)}</span>
        <span>{ultimo && giorno(ultimo.d)}</span>
      </div>
    </div>
  );
}

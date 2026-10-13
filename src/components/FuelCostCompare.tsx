import { useMemo } from 'react';
import type { FuelStation, FuelType } from '../types';
import { Card, Section } from '../design/primitives/Surface';
import { euro, numero, prezzoEuro } from '../lib/formato';

interface Props {
  stations: FuelStation[];
  carKml?: number;
  selectedFuel: FuelType;
}

const FUELS: FuelType[] = ['Benzina', 'Diesel', 'GPL', 'Metano'];

/** Quanto rende un carburante rispetto alla benzina, a parita di auto. */
const RESA: Record<FuelType, number> = {
  Benzina: 1.0,
  Diesel: 1.3,
  GPL: 0.85,
  Metano: 1.4,
};

function media(valori: number[]): number {
  if (!valori.length) return 0;
  return valori.reduce((a, b) => a + b, 0) / valori.length;
}

export function FuelCostCompare({ stations, carKml, selectedFuel }: Props) {
  const base = carKml || 15;

  const righe = useMemo(
    () =>
      FUELS.map((f) => {
        const prezzi = stations
          .map((s) => s.prices.find((p) => p.type === f)?.price)
          .filter((p): p is number => !!p && p > 0);
        const prezzo = media(prezzi);
        const kml = base * RESA[f];
        return {
          fuel: f,
          prezzo,
          kml,
          per100: prezzo > 0 && kml > 0 ? (100 / kml) * prezzo : 0,
        };
      }),
    [stations, base]
  );

  const valide = righe.filter((r) => r.per100 > 0);
  if (valide.length < 2) return null;

  const piuEconomico = valide.reduce((a, b) => (a.per100 < b.per100 ? a : b));
  const peggiore = valide.reduce((a, b) => (a.per100 > b.per100 ? a : b));
  const attuale = righe.find((r) => r.fuel === selectedFuel);
  const risparmio =
    attuale && attuale.per100 > 0 ? attuale.per100 - piuEconomico.per100 : 0;

  return (
    <Section title="Costo per 100 km">
      <Card pad="md">
        <div className="space-y-2.5">
          {righe.map((r) => {
            const vuota = r.per100 === 0;
            const migliore = r.fuel === piuEconomico.fuel;
            const attivo = r.fuel === selectedFuel;
            // La barra e proporzionale al costo: si vede la differenza prima di leggerla.
            const larghezza = vuota ? 0 : (r.per100 / peggiore.per100) * 100;
            const colore = migliore
              ? 'var(--mf-price-best)'
              : r.per100 === peggiore.per100
                ? 'var(--mf-price-worst)'
                : 'var(--mf-price-normal)';

            return (
              <div key={r.fuel} style={{ opacity: vuota ? 0.35 : 1 }}>
                <div className="flex items-baseline justify-between gap-3">
                  <span
                    style={{
                      fontFamily: 'var(--mf-font-sans)',
                      fontWeight: attivo ? 700 : 500,
                      fontSize: 14,
                      color: 'var(--mf-ink)',
                    }}
                  >
                    {r.fuel}
                    {attivo && (
                      <span className="mf-label ml-2" style={{ fontSize: 9 }}>
                        il tuo
                      </span>
                    )}
                  </span>
                  <span
                    className="mf-num"
                    style={{ fontSize: 15, fontWeight: 600, color: vuota ? 'var(--mf-muted)' : colore }}
                  >
                    {vuota ? '—' : euro(r.per100)}
                  </span>
                </div>
                <div
                  className="mt-1.5"
                  style={{ height: 6, borderRadius: 'var(--mf-radius-pill)', background: 'var(--mf-ground)' }}
                >
                  <div
                    style={{
                      width: `${larghezza}%`,
                      height: '100%',
                      borderRadius: 'var(--mf-radius-pill)',
                      background: colore,
                      transition: 'width 320ms ease-out',
                    }}
                  />
                </div>
                <div className="mf-num mt-1" style={{ fontSize: 10, color: 'var(--mf-muted)' }}>
                  {vuota ? 'non disponibile in zona' : `${prezzoEuro(r.prezzo)}/L · ${numero(r.kml, 1)} km/L`}
                </div>
              </div>
            );
          })}
        </div>

        {risparmio > 0.5 && attuale && (
          <p className="mt-5" style={{ color: 'var(--mf-ink-2)', fontSize: 12, lineHeight: 1.55 }}>
            Ogni 100 km, {piuEconomico.fuel} ti costa{' '}
            <span className="mf-num" style={{ color: 'var(--mf-price-best)' }}>
              {euro(risparmio)}
            </span>{' '}
            in meno di {attuale.fuel}. Su 15.000 km all&apos;anno fanno{' '}
            <span className="mf-num">{euro(risparmio * 150, 0)}</span>.
          </p>
        )}

        <p className="mt-4" style={{ color: 'var(--mf-muted)', fontSize: 11, lineHeight: 1.5 }}>
          {carKml
            ? `Calcolato sui ${numero(carKml, 1)} km/L della tua auto e sui prezzi medi in zona.`
            : 'Consumi stimati per categoria: scegli l’auto nel Garage per numeri tuoi.'}
        </p>
      </Card>
    </Section>
  );
}

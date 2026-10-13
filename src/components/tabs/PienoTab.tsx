import { useMemo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Car, TrendingUp, TrendingDown, MapPin } from 'lucide-react';
import { FillupTracker } from '../FillupTracker';
import { Risparmio } from '../../ui/pieno/Risparmio';
import { FuelCostCompare } from '../FuelCostCompare';
import { BudgetCard } from '../BudgetCard';
import { fillupsForCar, computeMonthlySpend, defaultFuelType, type MonthBucket } from '../../services/fillupService';
import type { FuelStation, FuelType } from '../../types';
import { Card, Stat, Empty } from '../../design/primitives/Surface';
import { Button } from '../../design/primitives/Button';
import { haversineKm } from '../../domain/geo';
import { PageTitle } from '../../ui/chrome/PageTitle';

interface Props {
  selectedCar: any;
  setTab: (t: any) => void;
  stations: FuelStation[];
  selectedFuel: FuelType;
  userLoc: { lat: number; lng: number } | null;
  /** Dentro la scheda Auto il titolo lo mette chi compone. */
  embedded?: boolean;
}

const euro = (n: number, dec = 2) =>
  `${n.toLocaleString('it-IT', { minimumFractionDigits: dec, maximumFractionDigits: dec })} €`;

export function PienoTab({ selectedCar, setTab, stations, selectedFuel, userLoc, embedded }: Props) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [prefill, setPrefill] = useState<{ stationName?: string; pricePerLiter?: number; fuelType?: FuelType } | null>(null);

  const fills = useMemo(
    () => (selectedCar ? fillupsForCar(selectedCar.model) : []),
    [selectedCar, refreshKey]
  );
  const months = useMemo(() => computeMonthlySpend(fills, 12), [fills]);

  const nearestStation = useMemo(() => {
    if (!userLoc || !stations.length) return null;
    const fuel: FuelType = defaultFuelType(selectedCar?.tags);
    let best: { st: FuelStation; dist: number; price: number } | null = null;
    for (const s of stations) {
      const pp = s.prices.find((p) => p.type === fuel);
      if (!pp || !pp.price) continue;
      const d = haversineKm(userLoc, { lat: s.location.lat, lng: s.location.lng });
      if (d > 2) continue;
      if (!best || d < best.dist) best = { st: s, dist: d, price: pp.price };
    }
    return best;
  }, [userLoc, stations, selectedCar]);

  useEffect(() => {
    const handler = () => setRefreshKey((k) => k + 1);
    window.addEventListener('storage', handler);
    window.addEventListener('mf-fillup-changed', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('mf-fillup-changed', handler);
    };
  }, []);

  if (!selectedCar) {
    // Dentro Auto il selettore dell'auto sta gia sopra: qui non serve dirlo.
    if (embedded) return null;
    return (
      <motion.div
        key="pieno-empty"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-5 pb-32"
      >
        <PageTitle eyebrow="pieno" title="I tuoi rifornimenti" />
        <Card>
          <Empty
            icon={<Car size={28} />}
            title="Prima scegli l'auto"
            hint="Con il modello sappiamo serbatoio e consumo: da lì nascono la previsione del prossimo pieno e la spesa mensile."
            action={
              <Button tone="primary" onClick={() => setTab('veicolo')}>
                Vai al Garage
              </Button>
            }
          />
        </Card>
      </motion.div>
    );
  }

  const contenuto = (
    <>
      {nearestStation && (
        <Card
          pad="md"
          onClick={() =>
            setPrefill({
              stationName: nearestStation.st.brand || nearestStation.st.name,
              pricePerLiter: nearestStation.price,
              fuelType: defaultFuelType(selectedCar?.tags),
            })
          }
        >
          <div className="flex items-center gap-3">
            <span
              className="flex flex-shrink-0 items-center justify-center"
              style={{
                width: 42, height: 42, borderRadius: 'var(--mf-radius-pill)',
                background: 'color-mix(in srgb, var(--mf-accent) 14%, transparent)',
                color: 'var(--mf-accent)',
              }}
            >
              <MapPin size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="mf-label" style={{ fontSize: 9 }}>sei qui</div>
              <div
                className="truncate"
                style={{ fontFamily: 'var(--mf-font-sans)', fontWeight: 700, fontSize: 15, color: 'var(--mf-ink)' }}
              >
                {nearestStation.st.brand || nearestStation.st.name}
              </div>
              <div className="mf-num" style={{ color: 'var(--mf-ink-2)', fontSize: 11 }}>
                {nearestStation.price.toFixed(3).replace('.', ',')} €/L · {(nearestStation.dist * 1000).toFixed(0)} m
              </div>
            </div>
            <span
              className="flex-shrink-0"
              style={{ color: 'var(--mf-accent)', fontFamily: 'var(--mf-font-sans)', fontWeight: 700, fontSize: 13 }}
            >
              Segna pieno →
            </span>
          </div>
        </Card>
      )}

      <Risparmio carModel={selectedCar.model} />

      <BudgetCard carModel={selectedCar.model} />

      <MonthlySpend months={months} />

      <FuelCostCompare stations={stations} carKml={selectedCar.kml} selectedFuel={selectedFuel} />

      <FillupTracker
        prefillNew={prefill}
        onPrefillConsumed={() => setPrefill(null)}
        carModel={selectedCar.model}
        carTags={selectedCar.tags}
        wltpKml={selectedCar.kml}
        tankLiters={selectedCar.liters}
      />
    </>
  );

  if (embedded) return contenuto;

  return (
    <motion.div
      key="pieno"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="space-y-5 pb-32"
    >
      <PageTitle eyebrow="pieno" title="I tuoi rifornimenti" sub={selectedCar.model} />
      {contenuto}
    </motion.div>
  );
}

function MonthlySpend({ months }: { months: MonthBucket[] }) {
  const totalAll = months.reduce((a, b) => a + b.total, 0);
  const litersAll = months.reduce((a, b) => a + b.liters, 0);
  const fillsAll = months.reduce((a, b) => a + b.count, 0);
  const maxV = Math.max(...months.map((m) => m.total), 1);
  const last = months[months.length - 1];
  const prev = months[months.length - 2];
  const deltaPct = last && prev && prev.total > 0 ? ((last.total - prev.total) / prev.total) * 100 : null;
  const mesiPieni = months.filter((m) => m.total > 0);
  const avg = mesiPieni.length > 0 ? totalAll / mesiPieni.length : 0;

  if (fillsAll === 0) {
    return (
      <Card>
        <Empty title="Nessun pieno registrato" hint="Segna il primo rifornimento: da lì parte la spesa mensile e la previsione." />
      </Card>
    );
  }

  return (
    <Card pad="lg">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mf-label" style={{ fontSize: 9 }}>spesa in carburante</div>
          <div
            className="mf-num mt-2"
            style={{ fontSize: 34, fontWeight: 600, color: 'var(--mf-ink)', letterSpacing: '-0.03em', lineHeight: 1 }}
          >
            {euro(totalAll, 0)}
          </div>
          <div className="mf-num mt-1" style={{ color: 'var(--mf-ink-2)', fontSize: 11 }}>
            12 mesi · {fillsAll} pieni · {litersAll.toFixed(0)} L
          </div>
        </div>
        {deltaPct != null && (
          <div className="flex-shrink-0 text-right">
            <div className="mf-label" style={{ fontSize: 9 }}>sul mese prima</div>
            <div
              className="mf-num mt-2 flex items-center justify-end gap-1.5"
              style={{ color: deltaPct <= 0 ? 'var(--mf-price-best)' : 'var(--mf-price-worst)', fontSize: 18, fontWeight: 600 }}
            >
              {deltaPct <= 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
              {deltaPct >= 0 ? '+' : ''}
              {deltaPct.toFixed(0)}%
            </div>
          </div>
        )}
      </div>

      <MonthlyBars months={months} max={maxV} avg={avg} />

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Stat label="media al mese" value={avg > 0 ? euro(avg) : '—'} />
        <Stat label="mese peggiore" value={maxV > 0 ? euro(maxV) : '—'} />
        <Stat label="ultimo mese" value={last && last.total > 0 ? euro(last.total) : '—'} />
      </div>
    </Card>
  );
}

function MonthlyBars({ months, max, avg }: { months: MonthBucket[]; max: number; avg: number }) {
  const W = 320, H = 132, P = 6, GAP = 4;
  const colW = (W - P * 2 - GAP * (months.length - 1)) / months.length;
  const barArea = H - 22;
  const avgY = avg > 0 ? P + (1 - avg / max) * (barArea - P * 2) : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 132 }} preserveAspectRatio="none">
      {avgY != null && (
        <>
          <line x1={P} x2={W - P} y1={avgY} y2={avgY} stroke="var(--mf-hairline)" strokeWidth="1" strokeDasharray="3 3" />
          <text x={W - P} y={avgY - 4} fill="var(--mf-muted)" fontSize="8" textAnchor="end" letterSpacing="0.12em">
            MEDIA
          </text>
        </>
      )}
      {months.map((m, i) => {
        const x = P + i * (colW + GAP);
        const h = max > 0 ? (m.total / max) * (barArea - P) : 0;
        const isLast = i === months.length - 1;
        const isEmpty = m.total === 0;
        return (
          <g key={m.key}>
            <rect
              x={x}
              y={isEmpty ? barArea - 2 : barArea - Math.max(h, 3)}
              width={colW}
              height={isEmpty ? 2 : Math.max(h, 3)}
              rx="3"
              fill={isEmpty ? 'var(--mf-hairline)' : isLast ? 'var(--mf-accent)' : 'var(--mf-muted)'}
            />
            <text
              x={x + colW / 2}
              y={H - 5}
              fill={isLast ? 'var(--mf-accent)' : 'var(--mf-muted)'}
              fontSize="8.5"
              textAnchor="middle"
            >
              {m.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

import type { Spectrum } from './homeModel';
import { formatEuro } from '../../design/primitives/PriceText';

const SOURCE_LABEL: Record<string, string> = {
  'province-road': 'provincia',
  'province-highway': 'provincia, autostrada',
  'segment-road': 'strade ordinarie',
  'segment-highway': 'autostrade',
  national: 'Italia',
};

/**
 * Gli stop cadono sui centri delle cinque fasce di livello, che sulla scala
 * z ∈ [-2, +2] stanno a 6,25 / 25 / 50 / 75 / 93,75 per cento. Cosi il
 * colore sotto il segno e sempre il colore del livello annunciato accanto.
 */
const GRADIENT =
  'linear-gradient(90deg,' +
  ' var(--mf-price-best) 6.25%,' +
  ' var(--mf-price-good) 25%,' +
  ' var(--mf-price-normal) 50%,' +
  ' var(--mf-price-high) 75%,' +
  ' var(--mf-price-worst) 93.75%)';

export function SpectrumBar({ spectrum }: { spectrum: Spectrum }) {
  const pct = `${(spectrum.position * 100).toFixed(1)}%`;
  return (
    <div className="w-full">
      <div
        className="relative h-2 w-full"
        style={{ borderRadius: 'var(--mf-radius-pill)', background: GRADIENT }}
      >
        <span
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            left: pct,
            width: 3,
            height: 16,
            borderRadius: 2,
            background: 'var(--mf-ink)',
            boxShadow: '0 0 6px rgba(0,0,0,.8)',
          }}
        />
      </div>
      <div
        className="mt-2 flex items-center justify-between gap-2"
        style={{ color: 'var(--mf-ink-2)', fontSize: 11 }}
      >
        <span className="mf-num">{formatEuro(spectrum.lo)}</span>
        <span className="mf-label truncate">
          {SOURCE_LABEL[spectrum.source] ?? spectrum.source} · {spectrum.n} impianti
          {!spectrum.reliable && ' · stima larga'}
        </span>
        <span className="mf-num">{formatEuro(spectrum.hi)}</span>
      </div>
    </div>
  );
}

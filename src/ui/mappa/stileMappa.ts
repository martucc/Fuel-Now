import type { PriceLevel } from '../../domain/pricing';
import { HEX, HEX_LIVELLO } from '../kit/livelli';

/**
 * Lo stile della mappa: OpenFreeMap «dark» (niente chiavi, tessere, font e
 * sprite tutti in casa), ripulito di tutto quello che non serve a trovare
 * un distributore.
 */
export const STILE_SCURO = 'https://tiles.openfreemap.org/styles/dark';
export const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
export const FONT_GRASSETTO = ['Noto Sans Bold'];
export const FONT_NORMALE = ['Noto Sans Regular'];

/*
  Il ripiego se le tessere vettoriali non arrivano: ArcGIS, spento ma senza
  chiave e senza filigrane. I font restano quelli di OpenFreeMap: se manca
  anche lui spariscono le scritte ma i pallini restano.
*/
export const STILE_RIPIEGO = {
  version: 8 as const,
  glyphs: GLYPHS,
  sources: {
    base: {
      type: 'raster' as const,
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: '© Esri',
    },
  },
  layers: [{ id: 'base', type: 'raster' as const, source: 'base' }],
};

/** Strati dello stile di base da spegnere: punti d'interesse, numeri civici, edifici. */
export function daNascondere(id: string, sourceLayer: string | undefined): boolean {
  return (
    sourceLayer === 'poi' ||
    sourceLayer === 'housenumber' ||
    sourceLayer === 'aerodrome_label' ||
    sourceLayer === 'mountain_peak' ||
    /poi|housenumber|building-3d|aeroway|mountain|peak/i.test(id)
  );
}

/** Le tinte di fondo, accordate al nero dell'app. */
export const TINTE_BASE: Record<string, string> = {
  background: '#07090d',
  water: '#0a1826',
};

/* ── Le targhette ───────────────────────────────────────────────────── */

export type TipoTarghetta = PriceLevel | 'spento' | 'consigliato' | 'scelto';

interface AspettoTarghetta {
  fondo: string;
  bordo: string;
}

export const ASPETTO: Record<TipoTarghetta, AspettoTarghetta> = {
  best: { fondo: HEX.surface, bordo: HEX_LIVELLO.best },
  good: { fondo: HEX.surface, bordo: HEX_LIVELLO.good },
  normal: { fondo: HEX.surface, bordo: 'rgba(255,255,255,0.28)' },
  high: { fondo: HEX.surface, bordo: HEX_LIVELLO.high },
  worst: { fondo: HEX.surface, bordo: HEX_LIVELLO.worst },
  spento: { fondo: '#12151b', bordo: 'rgba(255,255,255,0.12)' },
  consigliato: { fondo: HEX.accent, bordo: '#ffffff' },
  scelto: { fondo: '#ffffff', bordo: '#ffffff' },
};

export const TESTO_TARGHETTA: Record<TipoTarghetta, string> = {
  best: HEX_LIVELLO.best,
  good: HEX_LIVELLO.good,
  normal: HEX_LIVELLO.normal,
  high: HEX_LIVELLO.high,
  worst: HEX_LIVELLO.worst,
  spento: HEX.stale,
  consigliato: '#ffffff',
  scelto: '#000000',
};

/** Misure della targhetta, in pixel logici. */
const L = 40;
const H = 26;
const R = 13;
const BORDO = 1.5;
const RAPPORTO = 2;

/**
 * Disegna una targhetta allungabile: MapLibre la stira attorno al testo
 * (icon-text-fit) usando solo la parte centrale, cosi gli angoli restano
 * tondi qualunque sia la lunghezza del prezzo.
 */
export function disegnaTarghetta(t: TipoTarghetta): { data: ImageData; opzioni: object } | null {
  if (typeof document === 'undefined') return null;
  const w = L * RAPPORTO;
  const h = H * RAPPORTO;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (!g) return null;
  const a = ASPETTO[t];
  const b = BORDO * RAPPORTO;
  const r = R * RAPPORTO;
  g.beginPath();
  g.roundRect(b / 2, b / 2, w - b, h - b, r - b / 2);
  g.fillStyle = a.fondo;
  g.fill();
  g.lineWidth = b;
  g.strokeStyle = a.bordo;
  g.stroke();
  return {
    data: g.getImageData(0, 0, w, h),
    opzioni: {
      pixelRatio: RAPPORTO,
      stretchX: [[r, w - r]],
      stretchY: [[r - 1, r + 1]],
      content: [r * 0.7, 4, w - r * 0.7, h - 4],
    },
  };
}

export const TIPI_TARGHETTA: TipoTarghetta[] = ['best', 'good', 'normal', 'high', 'worst', 'spento', 'consigliato', 'scelto'];

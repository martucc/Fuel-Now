import type { FuelKey, RawDataset } from './raw';
import type { PriceLevel } from './pricing';

/** Spec § 6.4: sotto questa confidenza si tace. */
export const MIN_FORECAST_CONFIDENCE = 0.3;

/** Sotto questa frazione di serbatoio l'utente è in riserva. */
export const RESERVE_PCT = 0.15;

/** Soglia per fidarsi di una discesa e comprare il minimo. */
const TRUST_DOWN = 0.5;

export interface ForecastView {
  direction: 'up' | 'down' | 'flat';
  deltaC: number;
  daysAhead: number;
  confidence: number;
  usable: boolean;
}

export function readForecast(d: RawDataset, fuel: FuelKey): ForecastView | null {
  const f = d.forecast?.[fuel];
  if (!f) return null;
  return {
    direction: f.direction,
    deltaC: f.delta_c,
    daysAhead: f.days_ahead,
    confidence: f.confidence,
    usable: f.confidence >= MIN_FORECAST_CONFIDENCE,
  };
}

export type Advice = 'FILL-FULL' | 'TEN-EURO' | 'URGENT' | 'PRICE-ONLY';

export interface AdviceInput {
  bestLevel: PriceLevel | null;
  forecast: ForecastView | null;
  /** Frazione di serbatoio residua, null se ignota. */
  tankPct: number | null;
}

/** Spec § 6.5. La riserva ha la precedenza su tutto. */
export function adviceOfTheDay(i: AdviceInput): { advice: Advice; reason: string } {
  if (i.tankPct !== null && i.tankPct <= RESERVE_PCT) {
    return { advice: 'URGENT', reason: 'Sei in riserva: conta arrivarci, non risparmiare.' };
  }

  const f = i.forecast && i.forecast.usable ? i.forecast : null;

  if (f && f.direction === 'down' && f.confidence >= TRUST_DOWN) {
    return {
      advice: 'TEN-EURO',
      reason: `Prezzi attesi in calo di ${Math.abs(f.deltaC).toFixed(1)} cent entro ${f.daysAhead} giorni: metti il minimo e aspetta.`,
    };
  }

  if (f && f.direction === 'up') {
    return {
      advice: 'FILL-FULL',
      reason: `Prezzi attesi in salita di ${Math.abs(f.deltaC).toFixed(1)} cent entro ${f.daysAhead} giorni: conviene fare il pieno ora.`,
    };
  }

  if (i.bestLevel === 'best') {
    return { advice: 'FILL-FULL', reason: "Vicino a te c'è un prezzo ben sotto la media della zona: approfittane." };
  }

  if (!f) {
    return {
      advice: 'PRICE-ONLY',
      reason: 'Previsione non disponibile — segnale insufficiente. Il consiglio guarda solo il prezzo di oggi.',
    };
  }

  return { advice: 'PRICE-ONLY', reason: 'Prezzi stabili: rifornisci quando ti serve, scegliendo il netto migliore.' };
}

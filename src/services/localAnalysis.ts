import type { FuelStation, FuelType, MarketAnalysis } from '../types';
import { seriesFromDataset } from '../ui/home/series';
import { readForecast } from '../domain/forecast';
import { toFuelKey } from '../domain/fuel';
import { getRawDataset } from './dataService';

export interface MarketStats {
  average: number;
  min: number;
  max: number;
  spread: number;
  sampleSize: number;
  cheapestStationName?: string;
  cheapestStationAddress?: string;
  latestUpdated?: string;
}

const FALLBACK_AVERAGE: Record<FuelType, number> = {
  Benzina: 1.9,
  Diesel: 2.02,
  GPL: 0.82,
  Metano: 1.55,
};

function round(value: number, decimals = 3) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function getFuelEntries(stations: FuelStation[], fuelType: FuelType) {
  return stations.flatMap((station) =>
    station.prices
      .filter(
        (price) => price.type === fuelType && Number.isFinite(price.price) && price.price > 0
      )
      .map((price) => ({ station, price }))
  );
}

export function calculateMarketStats(stations: FuelStation[], fuelType: FuelType): MarketStats {
  const allEntries = getFuelEntries(stations, fuelType);
  if (allEntries.length === 0) {
    const fallback = FALLBACK_AVERAGE[fuelType] || 1.8;
    return { average: fallback, min: fallback, max: fallback, spread: 0, sampleSize: 0 };
  }

  // Pre-calculate raw average to identify anomalies
  const rawAvg = allEntries.reduce((s, e) => s + e.price.price, 0) / allEntries.length;
  
  // Filter out anomalies (below 90% of average)
  const entries = allEntries.filter(e => e.price.price >= rawAvg * 0.90);
  
  if (entries.length === 0) {
    return { average: rawAvg, min: rawAvg, max: rawAvg, spread: 0, sampleSize: 0 };
  }

  const sorted = entries.map((e) => e.price.price).sort((a, b) => a - b);
  const trim = Math.floor(sorted.length * 0.05);
  const trimmed = sorted.slice(trim, sorted.length - trim || sorted.length);
  const values = trimmed.length > 0 ? trimmed : sorted;
  const average = values.reduce((s, v) => s + v, 0) / values.length;
  const cheapest = entries.reduce((best, cur) =>
    cur.price.price < best.price.price ? cur : best
  );
  const latestUpdated = entries
    .map((e) => e.price.lastUpdated)
    .filter(Boolean)
    .sort()
    .at(-1);

  return {
    average: round(average),
    min: round(sorted[0]),
    max: round(sorted[sorted.length - 1]),
    spread: round(sorted[sorted.length - 1] - sorted[0]),
    sampleSize: entries.length,
    cheapestStationName: cheapest.station.brand || cheapest.station.name,
    cheapestStationAddress: cheapest.station.address,
    latestUpdated,
  };
}

/**
 * Storico e previsione presi dal backend. Prima erano generati:
 *  per lo storico e una pendenza scelta da
 * euristiche sul prezzo medio per la previsione — quattordici punti che non
 * erano mai esistiti, disegnati come misure. Senza dataset le serie restano
 * vuote e i grafici spariscono, che e la risposta onesta.
 */
function buildSeries(fuelType: FuelType) {
  const d = getRawDataset();
  if (!d) return { historicalData: [], forecast: [] };
  return seriesFromDataset(d, toFuelKey(fuelType));
}

/**
 * Il trend viene dal forecast di backend, che e calcolato sulla serie
 * storica nazionale. L'euristica di prima ("spread alto -> in calo, prezzo
 * medio alto -> in salita") era un'invenzione travestita da previsione.
 * Senza un forecast affidabile si dichiara STABLE invece di indovinare.
 */
function pickTrend(fuelType: FuelType): MarketAnalysis['trend'] {
  const d = getRawDataset();
  if (!d) return 'STABLE';
  const f = readForecast(d, toFuelKey(fuelType));
  if (!f || !f.usable) return 'STABLE';
  return f.direction === 'up' ? 'UP' : f.direction === 'down' ? 'DOWN' : 'STABLE';
}

function pickAdvice(stats: MarketStats, trend: MarketAnalysis['trend']): MarketAnalysis['advice'] {
  if (stats.sampleSize === 0) return 'WAIT';
  
  // Consistency logic:
  if (trend === 'UP') return 'FILL-FULL'; // If prices are going up, buy now
  if (trend === 'DOWN' && stats.spread < 0.05) return 'WAIT'; // If falling and prices are similar, wait
  
  // Tactical logic for stable or high-spread markets
  if (stats.min <= stats.average - 0.040) return 'FILL-FULL'; // Found a deal? Fill up.
  if (stats.average >= 2.10) return 'TEN-EURO'; // Extreme price? Just enough to survive.
  
  return 'WAIT';
}

export function buildLocalMarketAnalysis(
  fuelType: FuelType,
  stations: FuelStation[],
  question?: string
): MarketAnalysis {
  const stats = calculateMarketStats(stations, fuelType);
  const trend = pickTrend(fuelType);
  const advice = pickAdvice(stats, trend);
  const { historicalData, forecast } = buildSeries(fuelType);
  const bestStation = stats.cheapestStationName || 'la stazione più economica';
  const questionText = question?.trim()
    ? `\n\nRisposta: "${question.trim()}". Con i dati locali, la scelta migliore è confrontare il prezzo medio con il minimo in zona: se trovi ${fuelType} vicino a €${stats.min.toFixed(3)}/L, conviene fermarsi.`
    : '';

  return {
    advice,
    source: 'local',
    generatedAt: new Date().toISOString(),
    reasoning:
      stats.sampleSize > 0
        ? `Analisi locale su ${stats.sampleSize} prezzi ${fuelType}: media €${stats.average.toFixed(3)}/L, minimo €${stats.min.toFixed(3)}/L da ${bestStation}.`
        : `Dati ${fuelType} insufficienti nella zona: allarga il raggio di ricerca.`,
    detailedReport:
      `Analisi basata sui prezzi reali dal dataset MIMIT. Per ${fuelType}, la media locale è circa €${stats.average.toFixed(3)}/L, con un minimo a €${stats.min.toFixed(3)}/L e uno spread di €${stats.spread.toFixed(3)}/L. ` +
      `Quando lo spread è alto conviene scegliere attivamente il distributore. Quando è basso, privilegia distanza e comodità. ` +
      `Questa analisi locale resta disponibile senza chiave Gemini: l'AI aggiunge lettura macroeconomica, ma i dati di base sono sempre reali.${questionText}`,
    stats: {
      averagePrice: stats.average,
      minPrice: stats.min,
      maxPrice: stats.max,
      spread: stats.spread,
      sampleSize: stats.sampleSize,
      cheapestStationName: stats.cheapestStationName,
      latestUpdated: stats.latestUpdated,
    },
    categories: [
      {
        title: 'Zona',
        icon: 'MapPin',
        content:
          stats.sampleSize > 0
            ? `${stats.sampleSize} prezzi letti nella zona corrente. Miglior riferimento: ${bestStation}.`
            : 'Allarga il raggio o sposta la mappa per caricare più stazioni.',
      },
      {
        title: 'Convenienza',
        icon: 'Globe',
        content:
          stats.spread >= 0.12
            ? 'Lo spread è ampio: scegliere bene la pompa conta più della piccola deviazione.'
            : 'Prezzi abbastanza compatti: valuta il distributore più vicino.',
      },
      {
        title: 'Prossimi giorni',
        icon: 'Calendar',
        content:
          trend === 'DOWN'
            ? 'Stima leggermente favorevole: puoi evitare il pieno se non sei in riserva.'
            : trend === 'UP'
              ? 'Stima prudente: meglio non arrivare troppo basso.'
              : 'Scenario stabile: rifornisci quando trovi un prezzo sotto la media.',
      },
    ],
    tips: [
      {
        title: 'Usa il minimo come ancora',
        text: `Sotto €${stats.average.toFixed(3)}/L sei già meglio della media; vicino a €${stats.min.toFixed(3)}/L è un buon prezzo.`,
        impact: 'HIGH',
      },
      {
        title: 'Evita deviazioni inutili',
        text: 'Se il risparmio stimato non supera il costo della deviazione, scegli la stazione più comoda.',
        impact: 'MEDIUM',
      },
      {
        title: 'Confronta self e servito',
        text: 'Il self-service è spesso il valore più utile per decidere rapidamente.',
        impact: 'LOW',
      },
    ],
    trend,
    historicalData,
    forecast,
  };
}

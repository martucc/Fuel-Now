import type { FuelStation, FuelType, MarketAnalysis } from '../types';

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
  'Super+': 2.05,
};

function round(value: number, decimals = 3) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function getFuelEntries(stations: FuelStation[], fuelType: FuelType) {
  return stations.flatMap((station) =>
    station.prices
      .filter((price) => price.type === fuelType && Number.isFinite(price.price) && price.price > 0)
      .map((price) => ({ station, price }))
  );
}

export function calculateMarketStats(stations: FuelStation[], fuelType: FuelType): MarketStats {
  const entries = getFuelEntries(stations, fuelType);
  if (entries.length === 0) {
    const fallback = FALLBACK_AVERAGE[fuelType] || 1.8;
    return {
      average: fallback,
      min: fallback,
      max: fallback,
      spread: 0,
      sampleSize: 0,
    };
  }

  const sorted = entries.map((entry) => entry.price.price).sort((a, b) => a - b);
  const trim = Math.floor(sorted.length * 0.05);
  const trimmed = sorted.slice(trim, sorted.length - trim || sorted.length);
  const values = trimmed.length > 0 ? trimmed : sorted;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const cheapest = entries.reduce((best, current) =>
    current.price.price < best.price.price ? current : best
  );
  const latestUpdated = entries
    .map((entry) => entry.price.lastUpdated)
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

function buildSeries(basePrice: number, trend: MarketAnalysis['trend']) {
  const trendStep = trend === 'DOWN' ? -0.006 : trend === 'UP' ? 0.007 : 0.001;
  const historicalData = Array.from({ length: 7 }, (_, index) => {
    const dayOffset = 6 - index;
    const drift = trendStep * -dayOffset;
    const wave = Math.sin(index + basePrice) * 0.004;
    return {
      date: `${dayOffset === 0 ? 'Oggi' : `-${dayOffset}g`}`,
      price: round(Math.max(0.1, basePrice + drift + wave)),
    };
  });
  const forecast = Array.from({ length: 7 }, (_, index) => ({
    date: `+${index + 1}g`,
    price: round(Math.max(0.1, basePrice + trendStep * (index + 1))),
  }));
  return { historicalData, forecast };
}

function pickTrend(stats: MarketStats): MarketAnalysis['trend'] {
  if (stats.sampleSize === 0) return 'STABLE';
  if (stats.spread >= 0.18) return 'DOWN';
  if (stats.average >= 2.08) return 'UP';
  return 'STABLE';
}

function pickAdvice(stats: MarketStats): MarketAnalysis['advice'] {
  if (stats.sampleSize === 0) return 'WAIT';
  if (stats.min <= stats.average - 0.045) return 'FILL-FULL';
  if (stats.average >= 2.08) return 'TEN-EURO';
  if (stats.spread <= 0.035) return 'WAIT';
  return 'FILL-FULL';
}

export function buildLocalMarketAnalysis(
  fuelType: FuelType,
  stations: FuelStation[],
  question?: string
): MarketAnalysis {
  const stats = calculateMarketStats(stations, fuelType);
  const trend = pickTrend(stats);
  const advice = pickAdvice(stats);
  const { historicalData, forecast } = buildSeries(stats.average, trend);
  const bestStation = stats.cheapestStationName || 'la stazione più economica disponibile';
  const questionText = question?.trim()
    ? `\n\nRisposta rapida alla tua domanda: "${question.trim()}". Con i dati locali disponibili, la scelta migliore e confrontare il prezzo medio con il minimo in zona: se trovi ${fuelType} vicino a €${stats.min.toFixed(3)}/L, conviene fermarsi; se sei sopra €${stats.average.toFixed(3)}/L, cerca alternative entro pochi chilometri.`
    : '';

  return {
    advice,
    source: 'local',
    generatedAt: new Date().toISOString(),
    reasoning:
      stats.sampleSize > 0
        ? `Analisi locale su ${stats.sampleSize} prezzi ${fuelType}: media €${stats.average.toFixed(3)}/L, minimo €${stats.min.toFixed(3)}/L da ${bestStation}.`
        : `Non ho ancora abbastanza prezzi ${fuelType} nella zona selezionata: mantengo una stima prudente e ti consiglio di allargare il raggio.`,
    detailedReport:
      `FuelWise sta usando i prezzi reali caricati dal dataset MIMIT/Fuel Now e costruisce una lettura operativa della tua zona. Per ${fuelType}, la media locale e circa €${stats.average.toFixed(3)}/L, con un minimo a €${stats.min.toFixed(3)}/L e uno spread di €${stats.spread.toFixed(3)}/L. ` +
      `Quando lo spread e alto conviene scegliere attivamente il distributore, perche il risparmio su un pieno puo diventare visibile subito. Quando lo spread e basso, invece, ha piu senso privilegiare distanza, affidabilita e comodita. ` +
      `Questa modalita locale resta disponibile anche senza chiave Gemini: l'AI generativa serve per aggiungere lettura macroeconomica e risposte piu discorsive, ma la base decisionale rimane agganciata ai prezzi veri dell'app.${questionText}`,
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
            : 'Allarga il raggio o sposta la mappa per caricare piu stazioni confrontabili.',
      },
      {
        title: 'Convenienza',
        icon: 'Globe',
        content:
          stats.spread >= 0.12
            ? 'Lo spread e ampio: scegliere bene la pompa conta piu della piccola deviazione.'
            : 'Prezzi abbastanza compatti: valuta il distributore piu vicino o quello con servizi migliori.',
      },
      {
        title: 'Prossimi giorni',
        icon: 'Calendar',
        content:
          trend === 'DOWN'
            ? 'Stima locale leggermente favorevole: puoi evitare il pieno se non sei in riserva.'
            : trend === 'UP'
              ? 'Stima prudente: meglio non arrivare troppo basso di carburante.'
              : 'Scenario stabile: rifornisci quando trovi un prezzo sotto la media locale.',
      },
    ],
    tips: [
      {
        title: 'Usa il minimo come ancora',
        text: `Sotto €${stats.average.toFixed(3)}/L sei gia meglio della media; vicino a €${stats.min.toFixed(3)}/L e un buon prezzo.`,
        impact: 'HIGH',
      },
      {
        title: 'Evita deviazioni inutili',
        text: 'Se il risparmio stimato non supera il costo della deviazione, scegli la stazione piu comoda.',
        impact: 'MEDIUM',
      },
      {
        title: 'Confronta self e servito',
        text: 'Quando disponibile, il self-service e spesso il valore piu utile per decidere rapidamente.',
        impact: 'LOW',
      },
    ],
    trend,
    historicalData,
    forecast,
  };
}

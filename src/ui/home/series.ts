import type { FuelKey, RawDataset } from '../../domain/raw';
import { readForecast } from '../../domain/forecast';

export interface SeriesPoint {
  date: string;
  price: number;
}

export interface Series {
  historicalData: SeriesPoint[];
  forecast: SeriesPoint[];
}

const GIORNI_STORICO = 30;

function etichetta(iso: string): string {
  const [, m, g] = iso.split('-');
  return g && m ? `${g}/${m}` : iso;
}

/**
 * Storico e previsione presi dal backend. Prima venivano generati con
 * `Math.sin(i + basePrice) * 0.004` e una pendenza scelta da euristiche sul
 * prezzo medio: sette punti di storico e sette di previsione che non erano
 * mai esistiti, disegnati come se fossero misure.
 *
 * Se la previsione non e affidabile l'array resta vuoto: il grafico sparisce
 * e nessuno legge una riga che non significa nulla.
 */
export function seriesFromDataset(d: RawDataset, fuel: FuelKey): Series {
  const storico = d.history?.[fuel] ?? [];
  const historicalData = storico
    .slice(-GIORNI_STORICO)
    .map((p) => ({ date: etichetta(p.date), price: p.avg }));

  const f = readForecast(d, fuel);
  const ultimo = historicalData[historicalData.length - 1];

  if (!f || !f.usable || !ultimo || f.daysAhead <= 0) {
    return { historicalData, forecast: [] };
  }

  // Il delta e in centesimi al litro sull'intero orizzonte: si distribuisce
  // sui giorni, senza aggiungere ondulazioni che il backend non dichiara.
  const passo = f.deltaC / 100 / f.daysAhead;
  const forecast = Array.from({ length: f.daysAhead }, (_, i) => ({
    date: `+${i + 1}g`,
    // Niente arrotondamento qui: lo storico ha quattro decimali e tagliarne
    // uno spostava l'arrivo dal delta dichiarato. Si arrotonda a schermo.
    price: ultimo.price + passo * (i + 1),
  }));

  return { historicalData, forecast };
}

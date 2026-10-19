export type FuelKey = 'benzina' | 'diesel' | 'gpl' | 'metano';

export const FUEL_KEYS: readonly FuelKey[] = ['benzina', 'diesel', 'gpl', 'metano'];

/** `[self, servito]`. Entrambi possono essere null, mai tutti e due insieme. */
export type RawPricePair = [number | null, number | null];

export interface RawStation {
  id: number;
  name: string;
  brand: string;
  operator: string;
  /** "Stradale" | "Autostradale" | "Pompe Bianche" | "" */
  type: string;
  is_highway: boolean;
  address: string;
  city: string;
  /** Sigla a due lettere, ma il MIMIT ci infila anche indirizzi: va validato. */
  prov: string;
  lat: number;
  lng: number;
  p: Partial<Record<FuelKey, RawPricePair>>;
  /** "YYYY-MM-DD HH:MM", ora locale italiana, senza fuso. */
  updated: string;
}

export interface RawStats {
  avg: number;
  min: number;
  n: number;
  std: number;
  /** Solo in `national`. */
  max?: number;
  p10?: number;
  p90?: number;
}

export interface RawForecast {
  direction: 'up' | 'down' | 'flat';
  delta_c: number;
  days_ahead: number;
  confidence: number;
}

export interface RawHistoryPoint {
  date: string;
  avg: number;
}

/** Da dove arrivano i prezzi e a che ora: il backend lo dice, mostrarlo e gratis. */
export interface RawSource {
  kind?: string;
  name?: string;
  /** ISO UTC di quando la pipeline ha girato. */
  generated_at?: string;
  /** "YYYY-MM-DD HH:MM" del prezzo piu recente nel lotto. */
  latest_price_at?: string;
  station_count?: number;
}

export interface RawDataset {
  extracted_at: string;
  source?: RawSource;
  fuels: FuelKey[];
  national: Partial<Record<FuelKey, RawStats | null>>;
  by_province: Record<string, Partial<Record<FuelKey, RawStats>>>;
  history: Partial<Record<FuelKey, RawHistoryPoint[]>>;
  forecast: Partial<Record<FuelKey, RawForecast>>;
  stations: RawStation[];
}

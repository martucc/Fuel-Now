export type FuelType = 'Benzina' | 'Diesel' | 'GPL' | 'Metano' | 'Super+';

export interface FuelPrice {
  type: FuelType;
  price: number;
  lastUpdated: string;
  isSelf: boolean;
}

export interface FuelStation {
  id: string;
  name: string;
  brand: string;
  address: string;
  distance?: number;
  services: string[];
  location: {
    lat: number;
    lng: number;
  };
  prices: FuelPrice[];
  isHighway?: boolean;
}

export type AdviceType = 'FILL-FULL' | 'FAILL-FULL' | 'WAIT' | 'TEN-EURO' | 'URGENT';

export interface Alert {
  id: string;
  fuelType: FuelType;
  threshold: number;
  stationId?: string;
  active: boolean;
}

export interface MarketAnalysis {
  advice: AdviceType;
  source?: 'ai' | 'local';
  generatedAt?: string;
  reasoning: string;
  detailedReport: string;
  stats?: {
    averagePrice: number;
    minPrice: number;
    maxPrice: number;
    spread: number;
    sampleSize: number;
    cheapestStationName?: string;
    latestUpdated?: string;
  };
  categories: {
    title: string;
    content: string;
    icon?: string;
  }[];
  tips: {
    title: string;
    text: string;
    impact: 'HIGH' | 'MEDIUM' | 'LOW';
  }[];
  trend: 'UP' | 'DOWN' | 'STABLE';
  historicalData: {
    date: string;
    price: number;
  }[];
  forecast: {
    date: string;
    price: number;
  }[];
}

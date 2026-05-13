export type FuelType = 'Benzina' | 'Diesel' | 'GPL' | 'Metano';

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
  city: string;
  distance?: number;
  services: string[];
  location: {
    lat: number;
    lng: number;
  };
  prices: FuelPrice[];
}

export type AdviceType = 'FILL-FULL' | 'WAIT' | 'TEN-EURO' | 'URGENT';

export interface Alert {
  id: string;
  fuelType: FuelType;
  threshold: number;
  stationId?: string;
  active: boolean;
}

export type DeadlineType = 'revisione' | 'bollo' | 'assicurazione' | 'tagliando' | 'altro';

export interface Deadline {
  id: string;
  carModel: string;
  type: DeadlineType;
  label?: string;
  date: string;
  recurrence: 'none' | 'yearly' | '2years';
  notes?: string;
}

export type ExpenseType = 'manutenzione' | 'bollo' | 'assicurazione' | 'multa' | 'pedaggio' | 'altro';

export interface Expense {
  id: string;
  carModel: string;
  type: ExpenseType;
  date: string;
  amount: number;
  label?: string;
  notes?: string;
}

export interface Fillup {
  id: string;
  date: string;
  carModel: string;
  fuelType: FuelType;
  liters: number;
  pricePerLiter: number;
  total: number;
  odometer: number;
  full: boolean;
  stationName?: string;
  notes?: string;
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

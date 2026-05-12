import React, { useState, useEffect, useRef } from 'react';
import { 
  Fuel, 
  MapPin, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  Droplets,
  ChevronRight,
  Filter,
  Heart,
  Settings,
  Bell,
  X,
  Map as MapIcon,
  Home,
  BarChart3,
  Search as SearchIcon,
  Info as InfoIcon,
  Car,
  ChevronDown,
  Layers,
  Zap,
  Target,
  BellOff,
  Calculator,
  Wallet,
  Route,
  Globe,
  Calendar,
  RefreshCw,
  AlertTriangle,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from './lib/utils';
import type { FuelStation, MarketAnalysis, FuelType, Alert } from './types';
import { getStations } from './services/dataService';
import { analyzeFuelMarket } from './services/geminiService';
import { buildLocalMarketAnalysis, calculateMarketStats } from './services/localAnalysis';
import { BottomSheet } from './components/BottomSheet';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// @ts-ignore
import markerIcon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom Marker Helper for Leaflet
function MapUpdater({ onMove }: { onMove: (center: { lat: number, lng: number }) => void }) {
  useMapEvents({
    moveend: (e: any) => {
      const center = e.target.getCenter();
      onMove({ lat: center.lat, lng: center.lng });
    },
  });
  return null;
}

function CenterMapButton({ userLoc }: { userLoc: { lat: number, lng: number } | null }) {
  const map = useMap();
  if (!userLoc) return null;
  return (
    <button 
      onClick={() => map.setView([userLoc.lat, userLoc.lng], 15)}
      className="absolute bottom-6 right-6 z-[500] p-4 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-900/30 active:scale-95 transition-all outline-none"
    >
      <Target size={24} />
    </button>
  );
}

function SparklineChart({ data, trend }: { data: { date: string, price: number }[], trend: string }) {
  const w = 320;
  const h = 130;
  const p = 14;
  if (!data || data.length < 2) return <div className="h-full flex items-center justify-center text-xs opacity-50">Dati insufficienti</div>;

  const values = data.map(d => d.price);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(0.001, max - min);
  const pts = values.map((val, idx) => {
    const x = p + (idx / (values.length - 1)) * (w - p * 2);
    const y = p + (1 - (val - min) / span) * (h - p * 2);
    return [x, y];
  });
  
  const path = pts.map((pt, idx) => `${idx === 0 ? 'M' : 'L'}${pt[0].toFixed(2)} ${pt[1].toFixed(2)}`).join(' ');
  const area = `${path} L${pts[pts.length - 1][0].toFixed(2)} ${h - p} L${pts[0][0].toFixed(2)} ${h - p} Z`;
  const last = pts[pts.length - 1];

  let accent = '#3b82f6';
  if (trend === 'DOWN') accent = '#10b981';
  if (trend === 'UP') accent = '#ef4444';

  return (
    <svg className="w-full h-full" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.34" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((ratio, i) => (
        <line key={i} x1={p} x2={w - p} y1={p + ratio * (h - p * 2)} y2={p + ratio * (h - p * 2)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="4 4" />
      ))}
      <path d={area} fill="url(#sparkGrad)" />
      <path d={path} fill="none" stroke={accent} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0].toFixed(2)} cy={last[1].toFixed(2)} r="5.2" fill={accent} stroke="white" strokeWidth="2" />
    </svg>
  );
}

function normalizeFuelNews(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.events)) {
    return raw.events.map((event: any) => ({
      title: event.title || event.headline || 'Aggiornamento carburanti',
      summary: event.summary || event.content || event.description || '',
      content: event.content || event.summary || '',
      impact: event.impact || 'neutral',
      source: event.source || 'Fuel Now',
      url: event.url || event.link,
      date: event.date || event.published_at || raw.generated_at,
    }));
  }
  return [];
}

async function loadFuelNews(): Promise<any[]> {
  const endpoints = ['/api/news', '/news.json'];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      if (!response.ok) continue;
      const type = response.headers.get('content-type') || '';
      if (!type.includes('application/json')) continue;
      const data = normalizeFuelNews(await response.json());
      if (data.length > 0 || endpoint === '/news.json') return data;
    } catch {
      // Try the next endpoint.
    }
  }
  return [];
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'map' | 'veicolo' | 'analysis' | 'alerts' | 'trip'>('home');
  const [userLoc, setUserLoc] = useState<{ lat: number, lng: number } | null>(null);
  const [stations, setStations] = useState<FuelStation[]>([]);
  const [marketRef, setMarketRef] = useState<MarketAnalysis | null>(null);
  const [selectedFuel, setSelectedFuel] = useState<FuelType>('Benzina');
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const [radius, setRadius] = useState<number>(20);
  const [h24, setH24] = useState<boolean>(false);
  const [noHighway, setNoHighway] = useState<boolean>(false);
  const [hideAnomalies, setHideAnomalies] = useState<boolean>(false);
  const [tripStart, setTripStart] = useState('Milano Centrale');
  const [tripEnd, setTripEnd] = useState('Roma Termini');
  const [tripDist, setTripDist] = useState(575);
  const [tripKml, setTripKml] = useState(15);
  const [tripUnit, setTripUnit] = useState<'kml' | 'l100'>('kml');
  const [tankLiters, setTankLiters] = useState(50);
  const [tripRoute, setTripRoute] = useState<any>(null);
  const [tripStops, setTripStops] = useState<any[]>([]);
  const [tripStatus, setTripStatus] = useState('');
  const [tripStrategy, setTripStrategy] = useState<'balanced' | 'save' | 'fast'>('balanced');
  const [tripCalculated, setTripCalculated] = useState(false);
  
  const [sortMode, setSortMode] = useState<'priceAsc' | 'priceDesc' | 'distAsc'>('priceAsc');

  const [fuelNews, setFuelNews] = useState<any[]>([]);
  const [cars, setCars] = useState<any[]>([]);
  const [selectedCar, setSelectedCar] = useState<any>(null);
  const [carSearchQuery, setCarSearchQuery] = useState('');

  // API Management
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState(localStorage.getItem('martucc_fuel_api_key') || '');
  const [apiModel, setApiModel] = useState(localStorage.getItem('martucc_fuel_api_model') || 'gemini-1.5-flash');
  const [aiError, setAiError] = useState<string | null>(null);
  const [userQuestion, setUserQuestion] = useState('');
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [driveMode, setDriveMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('drive');
    if (requested === '1' || requested === 'on') localStorage.setItem('martucc_fuel_drive', 'on');
    if (requested === '0' || requested === 'off') localStorage.setItem('martucc_fuel_drive', 'off');
    return localStorage.getItem('martucc_fuel_drive') === 'on';
  });
  const initialLoadComplete = useRef(false);

  const fetchAnalysisWithCache = async (
    fuel: FuelType,
    force: boolean = false,
    question?: string,
    stationSource: FuelStation[] = stations
  ) => {
    const today = new Date().toISOString().split('T')[0];
    const hasApiKey = apiKey.trim().length > 0;
    const cacheKey = `martucc_fuel_analysis_${fuel}_${apiModel}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (hasApiKey && !force && !question && cached) {
      const parsed = JSON.parse(cached);
      // Check if format is new (has categories) and date is today
      if (parsed.date === today && parsed.analysis?.categories) {
        setMarketRef({ ...parsed.analysis, source: parsed.analysis.source || 'ai' });
        return;
      }
    }

    setAnalysisLoading(true);
    try {
      if (!hasApiKey) {
        const localAnalysis = buildLocalMarketAnalysis(fuel, stationSource, question);
        setMarketRef(localAnalysis);
        setAiError(null);
        return;
      }

      const analysis = await analyzeFuelMarket(apiKey, apiModel, fuel, question);
      setMarketRef({ ...analysis, source: 'ai', generatedAt: new Date().toISOString() });
      // Only cache if it's a standard daily refresh (no custom question)
      if (!question) {
        localStorage.setItem(cacheKey, JSON.stringify({ date: today, analysis: { ...analysis, source: 'ai' } }));
      }
    } catch (e: any) {
      const fallbackAnalysis = buildLocalMarketAnalysis(fuel, stationSource, question);
      setMarketRef(fallbackAnalysis);
      setAiError(e.message === 'MISSING_KEY'
        ? null
        : 'Gemini non disponibile: sto usando l\'analisi locale Martucc Fuel.'
      );
    } finally {
      setAnalysisLoading(false);
    }
  };

  useEffect(() => {
    if (driveMode) {
      document.documentElement.dataset.drive = 'on';
    } else {
      delete document.documentElement.dataset.drive;
    }
  }, [driveMode]);

  const toggleDriveMode = () => {
    setDriveMode((current) => {
      const next = !current;
      localStorage.setItem('martucc_fuel_drive', next ? 'on' : 'off');
      const url = new URL(window.location.href);
      if (next) url.searchParams.set('drive', '1');
      else url.searchParams.delete('drive');
      window.history.replaceState({}, '', url);
      return next;
    });
  };

  useEffect(() => {
    if (!userLoc || !initialLoadComplete.current) return;
    fetchAnalysisWithCache(selectedFuel, false, undefined, stations);
  }, [selectedFuel, userLoc]);

  useEffect(() => {
    const fetchDependencies = async () => {
      try {
        const [newsData, carsRes] = await Promise.all([
          loadFuelNews(),
          fetch('/cars.json').catch(() => ({ json: async () => [] as any[] }))
        ]);
        const carsData = await carsRes.json();
        setFuelNews(newsData);
        setCars(Array.isArray(carsData) ? carsData : []);

        // Load saved car from local storage
        const savedCarId = localStorage.getItem('martucc_fuel_selected_car_id');
        if (savedCarId && Array.isArray(carsData)) {
          const car = carsData.find((c: any) => c.model === savedCarId);
          if (car) {
            setSelectedCar(car);
            if (car.liters) setTankLiters(car.liters);
            if (car.kml) setTripKml(car.kml);
          }
        }
      } catch (error) {
        console.error("Error fetching dependencies:", error);
      }
    };
    fetchDependencies();

    const loadInitialData = async (loc: { lat: number, lng: number }) => {
      setLoading(true);
      setAiError(null);
      try {
        const data = await getStations(loc);
        setStations(data);
        await fetchAnalysisWithCache(selectedFuel, false, undefined, data);
      } catch (error) {
        console.error("Initial load error:", error);
      } finally {
        initialLoadComplete.current = true;
        setLoading(false);
      }
    };

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLoc(loc);
          loadInitialData(loc);
        },
        (err) => {
          console.warn("Geolocation error:", err.message);
          const defaultLoc = { lat: 45.4642, lng: 9.1900 };
          setUserLoc(defaultLoc);
          loadInitialData(defaultLoc);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      const defaultLoc = { lat: 45.4642, lng: 9.1900 };
      setUserLoc(defaultLoc);
      loadInitialData(defaultLoc);
    }

    // Load local state
    const savedFavs = localStorage.getItem('martucc_fuel_favs');
    if (savedFavs) setFavorites(JSON.parse(savedFavs));
    const savedAlerts = localStorage.getItem('martucc_fuel_alerts');
    if (savedAlerts) setAlerts(JSON.parse(savedAlerts));
  }, []);

  useEffect(() => {
    localStorage.setItem('martucc_fuel_favs', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem('martucc_fuel_alerts', JSON.stringify(alerts));
  }, [alerts]);

  const handleMapMove = async (center: { lat: number, lng: number }) => {
    const data = await getStations(center);
    setStations(data);
    if (!apiKey.trim()) {
      setMarketRef(buildLocalMarketAnalysis(selectedFuel, data));
    }
  };

  const toggleFavorite = (id: string) => {
    setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  const geocodePlace = async (query: string) => {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
    const data = await res.json();
    if (!data.length) throw new Error(`Località non trovata: ${query}`);
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), label: data[0].display_name };
  };

  const fetchRoute = async (start: any, end: any) => {
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`);
    const data = await res.json();
    if (!data.routes.length) throw new Error('Percorso non trovato');
    return {
      distanceKm: data.routes[0].distance / 1000,
      durationMin: data.routes[0].duration / 60,
      coords: data.routes[0].geometry.coordinates,
      start,
      end
    };
  };

  const calculateTripRoute = async () => {
    if (!tripStart || !tripEnd) {
      setTripStatus('Inserisci partenza e arrivo');
      return;
    }
    setTripStatus('Calcolo percorso...');
    try {
      const startLoc = await geocodePlace(tripStart);
      const endLoc = await geocodePlace(tripEnd);
      const route = await fetchRoute(startLoc, endLoc);
      
      setTripRoute(route);
      setTripDist(Math.round(route.distanceKm));
      setTripStatus('');
      
      const kmPerLiter = tripUnit === 'kml' ? tripKml : (100 / tripKml);
      const tankCapacity = tankLiters || 50;
      const practicalRange = tankCapacity * kmPerLiter * 0.8; 
      const stopsNeeded = Math.max(0, Math.ceil((route.distanceKm - practicalRange) / practicalRange));
      
      const weights = {
        save: { price: 1.35, detour: 0.85 },
        fast: { price: 0.75, detour: 1.65 },
        balanced: { price: 1, detour: 1 },
      }[tripStrategy];

      const stops: any[] = [];
      if (stopsNeeded > 0 && stations.length > 0) {
        for (let i = 1; i <= stopsNeeded; i++) {
           const targetKm = Math.min(practicalRange * i, route.distanceKm - 20);
           
           // Find best station for this stop
           const candidates = stations.map(s => {
             const distToStart = calculateDistance(startLoc.lat, startLoc.lng, s.location.lat, s.location.lng);
             const distToEnd = calculateDistance(endLoc.lat, endLoc.lng, s.location.lat, s.location.lng);
             
             // This is a simplification: assume route is a straight line for "detour" check
             // In a real app we'd check distance to the polyline
             const detourDist = Math.abs((distToStart + distToEnd) - route.distanceKm); 
             
             const price = s.prices.find((p: any) => p.type === selectedFuel)?.price || 1.8;
             const progressPenalty = Math.abs(distToStart - targetKm) / 100;
             const score = (price * weights.price) + progressPenalty + (detourDist / 8 * weights.detour);
             
             return { station: s, score, distToStart };
           }).sort((a, b) => a.score - b.score);

           if (candidates[0]) {
             stops.push({ ...candidates[0].station, routeProgressKm: candidates[0].distToStart });
           }
        }
      }
      setTripStops(stops.sort((a, b) => a.routeProgressKm - b.routeProgressKm));
      setTripCalculated(true);
    } catch (e: any) {
      setTripStatus(e.message);
    }
  };

  const handleSelectCar = (car: any) => {
    setSelectedCar(car);
    if (car.liters) setTankLiters(car.liters);
    if (car.kml) setTripKml(car.kml);
    localStorage.setItem('martucc_fuel_selected_car_id', car.model);
  };

  const validPrices = stations
    .map(s => s.prices.find(p => p.type === selectedFuel)?.price)
    .filter(p => p && p > 0) as number[];
  const averagePrice = validPrices.length > 0 ? validPrices.reduce((a, b) => a + b, 0) / validPrices.length : Infinity;

  const filteredStations = stations.filter(station => {
    const currentPrice = station.prices.find(p => p.type === selectedFuel)?.price || 0;
    const isAnomalous = currentPrice > 0 && averagePrice !== Infinity && currentPrice < averagePrice * 0.85;
    const hasFuel = station.prices.some(p => p.type === selectedFuel);
    const matchesBrand = selectedBrands.length === 0 || selectedBrands.includes(station.brand);
    const matchesServices = selectedServices.length === 0 || selectedServices.every(s => station.services.includes(s));
    const inRadius = station.distance === undefined || station.distance <= radius;
    const matchesH24 = !h24 || station.services.includes('H24');
    const matchesNoHighway = !noHighway || (!station.services.includes('Autostrada') && !station.address.toLowerCase().includes('a1') && !station.address.toLowerCase().includes('autostrada'));
    const matchesAnomalyFilter = !hideAnomalies || !isAnomalous;
    return hasFuel && matchesBrand && matchesServices && inRadius && matchesH24 && matchesNoHighway && matchesAnomalyFilter;
  }).sort((a, b) => {    const priceA = a.prices.find(p => p.type === selectedFuel)?.price || Infinity;
    const priceB = b.prices.find(p => p.type === selectedFuel)?.price || Infinity;
    
    if (sortMode === 'priceAsc') return priceA - priceB;
    if (sortMode === 'priceDesc') return priceB - priceA;
    if (sortMode === 'distAsc') return (a.distance || 0) - (b.distance || 0);
    return 0;
  });

  const cheapestPrice = filteredStations.length > 0 
    ? Math.min(...filteredStations.map(s => s.prices.find(p => p.type === selectedFuel)?.price || Infinity))
    : Infinity;

  const visibleStations = filteredStations.slice(0, 40);
  const mapStations = filteredStations.slice(0, 250);
  const marketStats = calculateMarketStats(filteredStations, selectedFuel);
  const analysisIsLocal = marketRef?.source !== 'ai';
  const trendTone = marketRef?.trend === 'DOWN'
    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    : marketRef?.trend === 'UP'
      ? 'text-red-400 bg-red-500/10 border-red-500/20'
      : 'text-blue-400 bg-blue-500/10 border-blue-500/20';

  return (
    <div className="min-h-screen bg-black text-[#f5f5f7] font-sans selection:bg-blue-900/30 overflow-hidden relative">
      {/* Background Map Layer */}
      <div className="fixed inset-0 z-0">
        <MapContainer
          center={[userLoc?.lat || 45.4642, userLoc?.lng || 9.1900]}
          zoom={13}
          className="h-full w-full grayscale-[0.8] contrast-[1.2] invert-[0.05]"
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          />
          <MapUpdater onMove={handleMapMove} />
          <CenterMapButton userLoc={userLoc} />

          {userLoc && (
            <>
              <Marker
                position={[userLoc.lat, userLoc.lng]}
                icon={L.divIcon({
                  className: 'user-location-div-icon',
                  html: '<div class="user-location-marker" aria-hidden="true"><span></span></div>',
                  iconSize: [30, 30],
                  iconAnchor: [15, 15],
                })}
              >
                <Popup className="bg-[#1c1c1e] text-white">Base Operativa</Popup>
              </Marker>
              {/* @ts-ignore */}
              <Circle
                center={[userLoc.lat, userLoc.lng]}
                radius={radius * 1000}
                pathOptions={{ color: '#3b82f6', weight: 1, fillColor: '#3b82f6', fillOpacity: 0.03, dashArray: '5, 5' }}
              />
            </>
          )}

          {mapStations.map(s => {
            const currentPrice = s.prices.find(p => p.type === selectedFuel)?.price || 0;
            const isCheapestInRange = currentPrice === cheapestPrice && cheapestPrice !== Infinity;
            const isAnomalous = currentPrice > 0 && averagePrice !== Infinity && currentPrice < averagePrice * 0.85;

            let bgColor = 'bg-[#1c1c1e]/80';
            let borderColor = 'border-white/20';
            let textColor = 'text-white';
            let glow = '';

            if (isAnomalous) {
              bgColor = 'bg-gray-700/80';
              borderColor = 'border-gray-500';
              textColor = 'text-gray-300';
            } else if (isCheapestInRange) {
              bgColor = 'bg-blue-600';
              borderColor = 'border-blue-400';
              glow = 'shadow-[0_0_15px_rgba(59,130,246,0.6)]';
            } else if (currentPrice > 0 && averagePrice !== Infinity) {
              if (currentPrice > averagePrice + 0.015) {
                borderColor = 'border-red-500/50';
                bgColor = 'bg-red-500/10';
                textColor = 'text-red-400';
              } else if (currentPrice < averagePrice - 0.015) {
                borderColor = 'border-emerald-500/50';
                bgColor = 'bg-emerald-500/10';
                textColor = 'text-emerald-400';
              } else {
                borderColor = 'border-yellow-500/50';
                bgColor = 'bg-yellow-500/10';
                textColor = 'text-yellow-400';
              }
            }

            const customDivIcon = L.divIcon({
              className: 'custom-div-icon',
              html: `<div class="px-3 py-1.5 rounded-2xl border ${borderColor} text-[10px] font-black ${glow} ${textColor} ${bgColor} backdrop-blur-md whitespace-nowrap transition-all hover:scale-110">€${currentPrice.toFixed(3)}</div>`,
              iconSize: [60, 24],
              iconAnchor: [30, 12]
            });

            return (
              <Marker key={s.id} position={[s.location.lat, s.location.lng]} icon={customDivIcon}>
                <Popup className="premium-popup">
                  <div className="p-2 space-y-3 min-w-[200px]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600/10 rounded-xl flex items-center justify-center text-blue-500 font-black text-xs shadow-inner border border-blue-500/20">{s.brand[0]}</div>
                        <div className="font-black text-sm uppercase italic text-black tracking-tight">{s.brand}</div>
                      </div>
                      {isAnomalous && <div className="p-1 bg-red-500/10 text-red-600 rounded-lg"><AlertTriangle size={14} /></div>}
                    </div>
                    
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter flex items-center gap-1">
                        <MapPin size={10} /> {s.address}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <div className="text-2xl font-black text-blue-600 tracking-tighter italic">€{currentPrice.toFixed(3)}</div>
                        <div className="text-[9px] font-black uppercase text-gray-400 tracking-widest">/ Liter</div>
                      </div>
                    </div>

                    {isAnomalous && (
                      <div className="p-2 bg-gray-100 rounded-xl border border-gray-200 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" />
                        <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest leading-tight">Anomalia Prezzo: Impianto forse chiuso</div>
                      </div>
                    )}
                    
                    <button className="w-full py-2 bg-black text-white rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all hover:bg-blue-600 active:scale-[0.98]">
                      Naviga Ora
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* Floating Header */}
      <header className="fixed top-0 left-0 right-0 z-[60] bg-black/40 backdrop-blur-2xl px-6 py-5 flex items-center justify-between border-b border-white/10 shadow-2xl">
        <div className="absolute inset-0 bg-blue-600/[0.02] pointer-events-none" />
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-[0_8px_30px_rgba(37,99,235,0.4)] border border-blue-400/20">
            <Fuel size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black italic tracking-tighter text-white uppercase leading-none">
              Martucc<span className="text-blue-500">Fuel</span>
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[9px] text-[#8e8e93] uppercase font-black tracking-[0.2em] italic">{userLoc ? "Signal Active" : "Scanning..."}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 relative z-10">
          {loading && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="text-blue-500"
            >
              <RefreshCw size={18} />
            </motion.div>
          )}
          <button
            onClick={toggleDriveMode}
            aria-pressed={driveMode}
            title="Modalita guida"
            className={cn(
              "w-10 h-10 flex items-center justify-center rounded-xl transition-all border group",
              driveMode
                ? "bg-blue-600 text-white border-blue-400 shadow-xl shadow-blue-900/30"
                : "bg-white/5 text-[#8e8e93] hover:bg-white/10 border-white/5"
            )}
          >
            <Car size={20} className="transition-colors" />
          </button>
          <button
            onClick={() => setShowNotificationCenter(true)}
            className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5 relative group"
          >
            <Bell size={20} className="text-[#8e8e93] group-hover:text-white transition-colors" />
            {alerts.length > 0 && <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-blue-500 rounded-full border-2 border-black" />}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5 group"
          >
            <Settings size={20} className="text-[#8e8e93] group-hover:text-white transition-colors" />
          </button>
        </div>
      </header>

      <BottomSheet 
        title={activeTab === 'home' ? 'Signals' : activeTab === 'analysis' ? 'Intel' : activeTab === 'trip' ? 'Path' : activeTab === 'veicolo' ? 'Garage' : 'Radar'} 
        isOpen={activeTab !== 'map'} 
        onToggle={(open) => !open && setActiveTab('map')}
      >
        <main className="max-w-md mx-auto px-2 space-y-10">
          <AnimatePresence mode="wait">
            {activeTab === 'home' && (
              <motion.div
                key="home"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="space-y-10 pb-32"
              >
                {/* Premium Home Header */}
                <div className="flex items-center justify-between px-2 pt-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                      <Droplets className="text-white" size={20} />
                    </div>
                    <div className="space-y-0.5">
                      <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500/80 leading-none">Status Operativo</h2>
                      <p className="text-[9px] font-bold text-[#48484a] uppercase tracking-widest leading-none">Oggi, {new Date().getHours()}:{new Date().getMinutes().toString().padStart(2, '0')}</p>
                    </div>
                  </div>
                  <div className="flex -space-x-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="w-8 h-8 rounded-full border-2 border-black bg-[#1c1c1e] flex items-center justify-center text-[10px] font-black text-blue-500">
                        {i === 3 ? '+' : ''}
                      </div>
                    ))}
                  </div>
                </div>

                {aiError && (
                  <div className="p-6 bg-red-500/5 border border-red-500/10 rounded-[2.5rem] flex items-center justify-between group backdrop-blur-md">
                     <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-red-500/10 flex items-center justify-center">
                          <AlertCircle className="text-red-500" size={20} />
                        </div>
                        <p className="text-[11px] font-black text-red-500 uppercase tracking-widest">{aiError}</p>
                     </div>
                     <button onClick={() => setShowSettings(true)} className="p-2.5 bg-red-500/10 rounded-xl text-red-500 transition-all hover:bg-red-500/20">
                       <Settings size={14} />
                     </button>
                  </div>
                )}

                {/* News & AI Pulse */}
                <div className="space-y-4">
                  {fuelNews && fuelNews.length > 0 ? (
                    <div className="grid gap-4">
                      {fuelNews.slice(0, 1).map((news: any, i: number) => (
                        <motion.div
                          key={i}
                          className={cn(
                            "p-6 rounded-[2.5rem] border border-white/5 relative overflow-hidden backdrop-blur-xl transition-all hover:border-white/10 shadow-2xl",
                            news.impact === 'positive' ? "bg-emerald-500/[0.03]" : news.impact === 'negative' ? "bg-red-500/[0.03]" : "bg-white/[0.02]"
                          )}
                        >
                          <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                            <Globe size={80} />
                          </div>
                          <div className="flex items-center gap-4 mb-3 relative z-10">
                            <div className={cn(
                              "w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg",
                              news.impact === 'positive' ? "bg-emerald-500/10 text-emerald-500 shadow-emerald-500/5" : 
                              news.impact === 'negative' ? "bg-red-500/10 text-red-500 shadow-red-500/5" : 
                              "bg-blue-500/10 text-blue-500 shadow-blue-500/5"
                            )}>
                              {news.impact === 'positive' ? <TrendingDown size={20} /> : news.impact === 'negative' ? <TrendingUp size={20} /> : <InfoIcon size={20} />}
                            </div>
                            <div className="space-y-0.5">
                              <span className="text-[8px] font-black uppercase tracking-[0.3em] text-[#48484a]">Flash Intel</span>
                              <h4 className="font-black text-xs text-white uppercase italic tracking-tight leading-tight line-clamp-1">{news.title}</h4>
                            </div>
                          </div>
                          <p className="text-[11px] text-[#8e8e93] leading-relaxed line-clamp-2 font-medium relative z-10 pl-14 italic border-l border-white/5 ml-5">
                            "{news.summary || news.content}"
                          </p>
                        </motion.div>
                      ))}
                      {marketRef && <AdviceSection analysis={marketRef} fuelType={selectedFuel} />}
                    </div>
                  ) : marketRef ? <AdviceSection analysis={marketRef} fuelType={selectedFuel} /> : (
                    <div className="w-full h-32 bg-[#1c1c1e]/40 animate-pulse rounded-[2.5rem] border border-white/5 flex items-center justify-center">
                      <div className="text-center space-y-3">
                        <div className="relative mx-auto w-8 h-8">
                          <BarChart3 size={24} className="text-blue-500 opacity-20" />
                          <div className="absolute inset-0 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                        <div className="text-[9px] font-black text-[#48484a] uppercase tracking-[0.3em]">AI Engine Sync...</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Favorites - Horizontal Stock Ticker Style */}
                {favorites.length > 0 && (
                  <section className="space-y-4 pt-2">
                    <div className="flex items-center gap-3 px-2">
                      <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#48484a]">Watchlist</h2>
                      <div className="h-px flex-1 bg-white/5" />
                      <Heart size={12} className="text-red-500 animate-pulse" />
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar px-1">
                      {stations.filter(s => favorites.includes(s.id)).map(s => (
                        <div key={s.id} className="min-w-[190px] bg-[#1c1c1e]/60 backdrop-blur-md p-6 rounded-[2.5rem] border border-white/5 space-y-4 hover:border-blue-500/20 transition-all shadow-xl">
                          <div className="flex justify-between items-start">
                            <div className="space-y-0.5">
                              <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">{s.brand}</span>
                              <div className="text-[8px] font-bold text-[#48484a] uppercase tracking-tighter truncate max-w-[100px]">{s.name}</div>
                            </div>
                            <div className="w-8 h-8 bg-red-500/5 rounded-xl flex items-center justify-center">
                              <Heart size={14} className="text-red-500 fill-red-500/20" />
                            </div>
                          </div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black italic text-white tracking-tighter">€{s.prices.find(p => p.type === selectedFuel)?.price.toFixed(3) || '-'}</span>
                            <span className="text-[9px] font-black text-[#48484a] uppercase">/L</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[9px] text-[#8e8e93] font-black uppercase tracking-widest bg-black/20 p-2 rounded-xl border border-white/5">
                             <MapPin size={10} className="text-blue-500" /> {s.distance || '0.5'} KM
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Nearest Cheapest */}
                <section className="space-y-6 pt-2">
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                      <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-white italic">Asset List</h2>
                    </div>
                    <div className="flex items-center gap-3 bg-black/40 p-1.5 rounded-2xl border border-white/5 backdrop-blur-md shadow-inner">
                      <button
                        onClick={() => setShowFilters(true)}
                        className={cn(
                          "p-2.5 rounded-xl transition-all duration-300",
                          (selectedBrands.length > 0 || selectedServices.length > 0) ? "text-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/5" : "text-[#48484a] hover:text-white"
                        )}
                      >
                        <Filter size={16} />
                      </button>
                      <div className="w-px h-4 bg-white/10" />
                      <FuelTypeSelector current={selectedFuel} onSelect={setSelectedFuel} />
                    </div>
                  </div>

                  <div className="space-y-5">
                    {stations.length === 0 && loading ? (
                      [...Array(3)].map((_, i) => (
                        <div key={i} className="h-44 bg-[#1c1c1e]/40 animate-pulse rounded-[3rem] border border-white/5" />
                      ))
                    ) : filteredStations.length > 0 ? (
                      visibleStations.map((s, idx) => {
                        const currentPrice = s.prices.find(p => p.type === selectedFuel)?.price;
                        const isCheapest = currentPrice === cheapestPrice && cheapestPrice !== Infinity;
                        return (
                            <StationCard
                              key={s.id}
                              station={s}
                              fuelType={selectedFuel}
                              index={idx}
                              isFavorite={favorites.includes(s.id)}
                              onToggleFavorite={toggleFavorite}
                              isCheapest={isCheapest}
                              tankLiters={tankLiters}
                              averagePrice={averagePrice}
                            />
                        );
                      })
                    ) : (
                      <div className="text-center py-20 bg-[#1c1c1e]/30 rounded-[3.5rem] border border-white/5 border-dashed space-y-5">
                        <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center mx-auto">
                          <MapIcon size={30} className="text-[#48484a]" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-black uppercase italic text-white tracking-widest">No Signals Detected</p>
                          <p className="text-[10px] text-[#48484a] font-bold uppercase tracking-widest">Adjust filters to scan again</p>
                        </div>
                        <button onClick={() => { setSelectedBrands([]); setSelectedServices([]); }} className="px-6 py-3 bg-blue-600/10 text-blue-500 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border border-blue-500/20 hover:bg-blue-600 hover:text-white transition-all">Reset All Parameters</button>
                      </div>
                    )}
                  </div>
                </section>
              </motion.div>
            )}
            {/* Other tabs follow ... */}
          {activeTab === 'map' && (
            <motion.div
              key="map"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="fixed inset-0 z-10 pointer-events-none"
            >
              {/* Floating Command Center Overlay */}
              <div className="absolute top-24 left-6 right-6 flex flex-col gap-4 z-[500] pointer-events-auto">
                <div className="flex gap-3">
                   <div className="flex-1 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-[2rem] flex items-center px-5 py-4 gap-4 shadow-2xl">
                      <SearchIcon size={18} className="text-blue-500" />
                      <input
                        type="text"
                        placeholder="Scan location..."
                        className="bg-transparent border-none outline-none text-white w-full text-xs font-black uppercase tracking-widest placeholder:text-[#48484a]"
                      />
                   </div>
                </div>

                <div className="flex flex-wrap gap-2 bg-black/40 backdrop-blur-md p-2 rounded-[2rem] border border-white/5 w-fit shadow-xl">
                  {[10, 20, 50, 100].map((r) => (
                    <button
                      key={r}
                      onClick={() => setRadius(r)}
                      className={cn(
                        "px-6 py-2.5 rounded-[1.5rem] text-[9px] font-black uppercase tracking-[0.2em] transition-all",
                        radius === r ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30" : "text-[#8e8e93] hover:bg-white/5"
                      )}
                    >
                      {r}KM
                    </button>
                  ))}
                </div>
              </div>

              {/* Bottom Market Snap */}
              <div className="absolute bottom-32 left-8 right-8 z-[500] pointer-events-auto">
                <div className="bg-[#1c1c1e]/90 backdrop-blur-3xl p-6 rounded-[3rem] border border-white/10 shadow-2xl flex items-center justify-between max-w-lg mx-auto">
                   <div className="flex items-center gap-5">
                      <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                         <Zap size={22} className="fill-emerald-500/20" />
                      </div>
                      <div className="space-y-1">
                         <div className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] leading-none">Market Signal</div>
                         <div className="text-xl font-black italic text-white tracking-tighter leading-none">BEST €{cheapestPrice.toFixed(3)}</div>
                      </div>
                   </div>
                   <button 
                     onClick={() => setActiveTab('analysis')}
                     className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-white border border-white/10 transition-all"
                   >
                      Dettagli
                   </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'trip' && (
            <motion.div
              key="trip"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6 pb-24"
            >
              <header className="px-2 pt-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <Route className="text-white" size={20} />
                  </div>
                  <div className="space-y-0.5">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500/80 leading-none">Mission Control</h2>
                    <h3 className="text-4xl font-black tracking-tighter text-white uppercase italic leading-none">Route <span className="text-blue-500">Plan</span></h3>
                  </div>
                </div>
              </header>

              <div className="bg-[#1c1c1e] p-8 rounded-[3.5rem] border border-white/5 space-y-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/5 blur-[60px] pointer-events-none" />

                <div className="space-y-4 relative z-10">
                  <div className="bg-black/40 backdrop-blur-md rounded-[2.5rem] p-6 border border-white/5 space-y-4 shadow-inner">
                    <div className="space-y-2">
                      <label className="text-[9px] text-[#48484a] font-black uppercase tracking-[0.3em] ml-2">Origin</label>
                      <input 
                        value={tripStart} 
                        onChange={e => setTripStart(e.target.value)} 
                        placeholder="Scan starting point..." 
                        className="bg-transparent w-full text-white font-black italic text-xl outline-none placeholder:text-white/5 px-2"
                      />
                    </div>
                    <div className="h-px bg-white/5 mx-2" />
                    <div className="space-y-2">
                      <label className="text-[9px] text-[#48484a] font-black uppercase tracking-[0.3em] ml-2">Destination</label>
                      <input 
                        value={tripEnd} 
                        onChange={e => setTripEnd(e.target.value)} 
                        placeholder="Target coordinates..." 
                        className="bg-transparent w-full text-white font-black italic text-xl outline-none placeholder:text-white/5 px-2"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-black/40 rounded-[2.5rem] p-6 border border-white/5 space-y-2">
                      <label className="text-[9px] text-[#48484a] font-black uppercase tracking-[0.3em] flex justify-between">
                         Consumption 
                         <span className="flex gap-2">
                            <button onClick={() => setTripUnit('kml')} className={cn(tripUnit === 'kml' ? "text-blue-500" : "text-[#48484a]")}>KML</button>
                            <button onClick={() => setTripUnit('l100')} className={cn(tripUnit === 'l100' ? "text-blue-500" : "text-[#48484a]")}>L100</button>
                         </span>
                      </label>
                      <input 
                        type="number" 
                        step="0.1" 
                        value={tripKml} 
                        onChange={e => setTripKml(parseFloat(e.target.value || '0'))} 
                        className="bg-transparent w-full text-white font-black italic text-2xl outline-none"
                      />
                    </div>
                    <div className="bg-black/40 rounded-[2.5rem] p-6 border border-white/5 space-y-2">
                      <label className="text-[9px] text-[#48484a] font-black uppercase tracking-[0.3em]">Fuel Capacity</label>
                      <input 
                        type="number" 
                        value={tankLiters} 
                        onChange={e => setTankLiters(parseInt(e.target.value || '0'))} 
                        className="bg-transparent w-full text-white font-black italic text-2xl outline-none"
                      />
                    </div>
                  </div>

                  <div className="bg-black/40 rounded-[2.5rem] p-6 border border-white/5 space-y-4">
                    <label className="text-[9px] text-[#48484a] font-black uppercase tracking-[0.3em] ml-2">Optimization Strategy</label>
                    <div className="grid grid-cols-3 gap-3">
                       {[
                         { id: 'balanced', label: 'Balanced' },
                         { id: 'save', label: 'Save' },
                         { id: 'fast', label: 'Fast' }
                       ].map(s => (
                         <button
                           key={s.id}
                           onClick={() => setTripStrategy(s.id as any)}
                           className={cn(
                             "py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest border transition-all",
                             tripStrategy === s.id ? "bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-900/40" : "bg-white/5 text-[#48484a] border-white/5 hover:bg-white/10"
                           )}
                         >
                           {s.label}
                         </button>
                       ))}
                    </div>
                  </div>

                  <button 
                    onClick={calculateTripRoute}
                    className="w-full py-6 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-[2.5rem] shadow-[0_20px_50px_rgba(37,99,235,0.3)] active:scale-[0.98] transition-all text-xs uppercase tracking-[0.4em] italic flex items-center justify-center gap-3"
                  >
                    <Zap size={18} className="fill-white" />
                    Engage Navigation
                  </button>
                  {tripStatus && <p className="text-center text-[10px] font-black text-blue-400 uppercase tracking-widest animate-pulse">{tripStatus}</p>}
                </div>
              </div>

              {tripCalculated && tripRoute && (
                <div className="space-y-6 pb-10 animate-in fade-in slide-in-from-bottom-5 duration-700">
                  <div className="h-96 w-full bg-[#1c1c1e] border border-white/10 rounded-[3.5rem] overflow-hidden relative z-10 shadow-2xl">
                    <div className="absolute inset-0 bg-blue-600/5 pointer-events-none z-20" />
                    <MapContainer 
                      center={[tripRoute.start.lat, tripRoute.start.lng]} 
                      zoom={6} 
                      className="h-full w-full grayscale-[0.8] contrast-[1.2]"
                      zoomControl={false}
                    >
                      <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                      <Marker position={[tripRoute.start.lat, tripRoute.start.lng]}>
                        <Popup>Launch Point</Popup>
                      </Marker>
                      <Marker position={[tripRoute.end.lat, tripRoute.end.lng]}>
                        <Popup>Target Point</Popup>
                      </Marker>
                      {/* @ts-ignore */}
                      <Polyline positions={tripRoute.coords.map(c => [c[1], c[0]])} color="#3b82f6" weight={5} opacity={0.6} dashArray="1, 10" />
                      {tripStops.map((s, i) => (
                        <Marker key={i} position={[s.location.lat, s.location.lng]}>
                          <Popup>Refuel {i+1}: {s.brand}</Popup>
                        </Marker>
                      ))}
                    </MapContainer>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: 'Total Distance', value: `${tripDist}KM`, color: 'text-white' },
                        { label: 'Est. Fuel Cost', value: `€${((tripDist / (tripUnit === 'kml' ? tripKml : (100 / tripKml))) * (cheapestPrice !== Infinity ? cheapestPrice : 1.8)).toFixed(2)}`, color: 'text-emerald-400' },
                        { label: 'Burn Rate', value: `${(tripDist / (tripUnit === 'kml' ? tripKml : (100 / tripKml))).toFixed(1)}L`, color: 'text-blue-400' },
                        { label: 'Refuel Needed', value: `${Math.ceil((tripDist / (tripUnit === 'kml' ? tripKml : (100 / tripKml))) / tankLiters)} Units`, color: 'text-purple-400' }
                      ].map((m, i) => (
                        <div key={i} className="bg-[#1c1c1e]/80 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white/5 shadow-xl">
                           <div className="text-[9px] font-black text-[#48484a] uppercase tracking-[0.3em] mb-2">{m.label}</div>
                           <div className={cn("text-2xl font-black italic tracking-tighter", m.color)}>{m.value}</div>
                        </div>
                      ))}
                  </div>

                  <div className="bg-[#1c1c1e] p-8 rounded-[3.5rem] border border-white/5 space-y-6 shadow-2xl">
                    <div className="flex items-center gap-3 px-2">
                       <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                       <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-white italic">Supply Chain Optimized</h3>
                    </div>
                    <div className="space-y-4">
                       {tripStops.length > 0 ? tripStops.map((s, i) => (
                         <div key={i} className="group bg-black/40 backdrop-blur-md p-6 rounded-[2.5rem] border border-white/5 flex items-center justify-between hover:border-blue-500/30 transition-all shadow-inner">
                            <div className="flex items-center gap-5">
                               <div className="w-12 h-12 bg-blue-600 text-white rounded-[1.5rem] flex items-center justify-center font-black text-lg shadow-lg group-hover:scale-110 transition-transform">{i+1}</div>
                               <div>
                                  <div className="font-black uppercase italic text-white text-sm tracking-tight">{s.brand}</div>
                                  <div className="text-[10px] text-[#48484a] font-black uppercase tracking-widest mt-0.5">{s.address.split(',')[0]}</div>
                               </div>
                            </div>
                            <div className="text-right">
                               <div className="text-lg font-black text-blue-500 italic tracking-tighter group-hover:text-blue-400 transition-colors">€{s.prices.find((p: any) => p.type === selectedFuel)?.price.toFixed(3)}</div>
                               <div className="text-[8px] text-[#48484a] font-black uppercase tracking-[0.2em]">Alpha Rate</div>
                            </div>
                         </div>
                       )) : (
                         <div className="p-10 text-center bg-black/20 rounded-[2.5rem] border border-white/5 border-dashed">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#48484a]">Direct Flight — No Refuel Required</p>
                         </div>
                       )}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'veicolo' && (
            <motion.div 
              key="veicolo"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-6 pb-24"
            >
              <header className="px-2 pt-2 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                  <h2 className="text-[9px] font-black uppercase tracking-[0.4em] text-blue-500/90">Garage Module</h2>
                </div>
                <h3 className="text-4xl font-black tracking-tight text-white uppercase italic leading-none">Vehicle <span className="text-blue-500">Spec</span></h3>
              </header>

              {selectedCar ? (
                <div className="bg-[#1c1c1e] p-8 rounded-[3.5rem] border border-white/5 space-y-8 relative overflow-hidden shadow-2xl">
                   <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 blur-[70px] pointer-events-none" />

                   <div className="flex justify-between items-start relative z-10">
                      <div className="space-y-1">
                         <div className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500 mb-2">Active Blueprint</div>
                         <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white">{selectedCar.model}</h3>
                         <div className="text-[10px] font-bold text-[#48484a] uppercase tracking-widest">{selectedCar.tags}</div>
                      </div>
                      <button 
                        onClick={() => setSelectedCar(null)}
                        className="px-4 py-2 bg-white/5 hover:bg-red-500/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-[#8e8e93] hover:text-red-500 transition-all border border-white/5"
                      >
                         Decommission
                      </button>
                   </div>

                   <div className="grid grid-cols-2 gap-4 relative z-10">
                      <div className="bg-black/40 backdrop-blur-md p-6 rounded-[2.5rem] border border-white/5 shadow-inner">
                         <div className="text-[9px] font-black text-[#48484a] uppercase tracking-[0.3em] mb-2">Tank Capacity</div>
                         <div className="text-3xl font-black italic text-white">{selectedCar.liters}<span className="text-sm ml-1 text-blue-500">L</span></div>
                      </div>
                      <div className="bg-black/40 backdrop-blur-md p-6 rounded-[2.5rem] border border-white/5 shadow-inner">
                         <div className="text-[9px] font-black text-[#48484a] uppercase tracking-[0.3em] mb-2">Burn Rate</div>
                         <div className="text-3xl font-black italic text-white">{selectedCar.kml}<span className="text-sm ml-1 text-blue-500">KM/L</span></div>
                      </div>
                   </div>

                   <div className="pt-6 border-t border-white/5 relative z-10">
                      <div className="flex justify-between items-center p-6 bg-blue-600/10 rounded-[2.5rem] border border-blue-500/20 shadow-lg">
                         <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-xl">
                               <Zap size={22} className="fill-white" />
                            </div>
                            <div className="space-y-0.5">
                               <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">Efficiency Index</div>
                               <div className="text-xs font-black text-white uppercase italic">Optimal Range Mapping</div>
                            </div>
                         </div>
                         <div className="text-right">
                            <div className="text-2xl font-black italic text-white">{selectedCar.kml}</div>
                            <div className="text-[8px] font-black text-blue-500/60 uppercase tracking-widest leading-none">KM Per Liter</div>
                         </div>
                      </div>
                   </div>
                </div>
              ) : (
                <div className="space-y-6">
                   <div className="flex flex-col gap-4 px-2 mb-4">
                     <div className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-5 flex items-center gap-4 shadow-2xl">
                       <SearchIcon size={20} className="text-blue-500" />
                       <input 
                         type="text"
                         placeholder="Active Scan: Search Model..."
                         value={carSearchQuery}
                         onChange={(e) => setCarSearchQuery(e.target.value)}
                         className="bg-transparent border-none outline-none text-white w-full text-sm font-black uppercase tracking-[0.2em] placeholder:text-[#48484a]"
                       />
                     </div>
                     <div className="text-[9px] font-black uppercase tracking-[0.4em] text-[#48484a] ml-4 italic">{cars.length} Models in database</div>
                   </div>

                   <div className="grid grid-cols-1 gap-4 max-h-[50vh] overflow-y-auto no-scrollbar scroll-smooth px-1">
                      {cars.length > 0 ? cars.filter(car => car.model.toLowerCase().includes(carSearchQuery.toLowerCase()) || car.tags.toLowerCase().includes(carSearchQuery.toLowerCase())).map((car, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSelectCar(car)}
                          className="flex items-center justify-between p-6 bg-[#1c1c1e] hover:bg-blue-600/[0.04] rounded-[2.5rem] border border-white/5 transition-all group text-left active:scale-[0.98] shadow-lg hover:border-blue-500/20"
                        >
                           <div className="flex items-center gap-5">
                              <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-[#48484a] group-hover:bg-blue-600/10 group-hover:text-blue-500 transition-all border border-transparent group-hover:border-blue-500/20 shadow-inner">
                                 <Car size={24} />
                              </div>
                              <div className="space-y-1">
                                 <div className="font-black uppercase tracking-tight text-white text-sm group-hover:text-blue-400 transition-colors italic">{car.model}</div>
                                 <div className="text-[9px] font-black text-[#48484a] uppercase tracking-widest group-hover:text-[#8e8e93] transition-colors">{car.liters}L TANK • {car.kml} KM/L</div>
                              </div>
                           </div>
                           <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-[#48484a] group-hover:text-blue-500 transition-all">
                             <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                           </div>
                        </button>
                      )) : (
                        <div className="py-24 text-center space-y-6 bg-[#1c1c1e]/40 rounded-[3.5rem] border border-white/5 border-dashed">
                           <div className="relative mx-auto w-12 h-12">
                              <div className="absolute inset-0 border-4 border-blue-500/10 rounded-full" />
                              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="absolute inset-0 border-4 border-t-blue-500 rounded-full" />
                           </div>
                           <div className="text-[10px] font-black uppercase tracking-[0.4em] text-[#48484a] animate-pulse">Syncing Database...</div>
                        </div>
                      )}
                   </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'analysis' && (
            <motion.div
              key="analysis"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-6 pb-24"
            >
              {/* Premium Dashboard Header */}
              <header className="px-2 pt-2">
                <div className="flex justify-between items-end gap-4 mb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                      <h2 className="text-[9px] font-black uppercase tracking-[0.4em] text-blue-500/90">Market Intelligence</h2>
                    </div>
                    <h3 className="text-4xl font-black tracking-tighter text-white uppercase italic leading-none">
                      Martucc<span className="text-blue-500">Fuel</span> <span className="text-white/10 not-italic font-extralight tracking-widest">PRO</span>
                    </h3>
                  </div>
                  <div className={cn(
                    "px-4 py-2 rounded-2xl border text-[9px] font-black uppercase tracking-widest backdrop-blur-2xl transition-all shadow-2xl",
                    apiKey ? "text-emerald-400 bg-emerald-500/5 border-emerald-500/20 shadow-emerald-500/5" : "text-blue-400 bg-blue-500/5 border-blue-500/20 shadow-blue-500/5"
                  )}>
                    {apiKey ? 'AI Core Active' : 'Local Analysis'}
                  </div>
                </div>
                <p className="text-[11px] leading-relaxed text-[#8e8e93] font-medium px-0.5 border-l-2 border-blue-500/30 pl-4 italic">
                  Integrazione dati real-time. Analisi operativa basata su campionamento zonale e trend macroeconomici.
                </p>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                {/* Left Column: Metrics & Intel */}
                <div className="md:col-span-5 space-y-5">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      {label: 'Zona Avg', value: `€${marketStats.average.toFixed(3)}`, sub: 'Prezzo Medio', icon: Target, color: 'text-blue-500', glow: 'shadow-blue-500/20'},
                      {label: 'Alpha Deal', value: `€${marketStats.min.toFixed(3)}`, sub: marketStats.cheapestStationName || 'Migliore', icon: Zap, color: 'text-emerald-500', glow: 'shadow-emerald-500/20'},
                      {label: 'Volatility', value: `€${marketStats.spread.toFixed(3)}`, sub: 'Min-Max Gap', icon: Layers, color: 'text-amber-500', glow: 'shadow-amber-500/20'},
                      {label: 'Dataset', value: marketStats.sampleSize.toString(), sub: 'Punti Mappa', icon: BarChart3, color: 'text-purple-500', glow: 'shadow-purple-500/20'},
                      ].map((stat) => (
                      <div key={stat.label} className={cn(
                        "group bg-white/[0.03] backdrop-blur-3xl p-6 rounded-[2.5rem] border border-white/5 hover:border-blue-500/30 transition-all hover:-translate-y-1 duration-500",
                        stat.glow
                      )}>
                        <div className="flex justify-between items-start mb-5">
                          <div className={cn("p-2 rounded-xl bg-black/40 border border-white/5", stat.color)}>
                            <stat.icon size={16} className="opacity-80 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className="text-[9px] font-black text-[#48484a] uppercase tracking-[0.3em]">{stat.label}</div>
                        </div>
                        <div className="text-3xl font-black italic text-white tracking-tighter group-hover:text-blue-400 transition-all duration-500">{stat.value}</div>
                        <div className="text-[9px] text-[#8e8e93] font-black uppercase tracking-widest truncate mt-1.5 italic">{stat.sub}</div>
                      </div>
                      ))}                  </div>

                  <section className="bg-[#1c1c1e]/40 backdrop-blur-md p-6 rounded-[2.5rem] border border-white/5 space-y-5 relative overflow-hidden">
                    <div className="flex items-center justify-between relative z-10">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500">Global Intel</h3>
                      <div className="w-8 h-px bg-white/5" />
                    </div>
                    <div className="space-y-3 relative z-10">
                      {fuelNews.length > 0 ? fuelNews.slice(0, 3).map((news: any, i: number) => (
                        <a key={i} href={news.url || '#'} target="_blank" rel="noreferrer" className="block group">
                          <div className="bg-black/20 group-hover:bg-white/[0.04] p-4 rounded-2xl border border-white/5 transition-all flex items-start gap-3">
                            <div className={cn("mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0", news.impact === 'positive' ? 'bg-emerald-500' : news.impact === 'negative' ? 'bg-red-500' : 'bg-blue-500')} />
                            <div className="space-y-1">
                              <div className="flex justify-between items-center w-full">
                                <span className="text-[8px] font-black text-[#8e8e93] uppercase tracking-widest">{news.source || 'Intel'}</span>
                                <span className="text-[8px] text-[#48484a] font-bold">{news.date || 'Oggi'}</span>
                              </div>
                              <h4 className="text-[11px] font-black text-white/90 leading-tight group-hover:text-blue-400 transition-colors uppercase italic">{news.title}</h4>
                            </div>
                          </div>
                        </a>
                      )) : (
                        <div className="py-10 text-center opacity-30">
                          <p className="text-[9px] font-black uppercase tracking-widest text-white italic">Scanning markets...</p>
                        </div>
                      )}
                    </div>
                  </section>
                </div>

                {/* Right Column: AI & Analysis */}
                <div className="md:col-span-7 space-y-5">
                  <section className="bg-[#1c1c1e] p-7 rounded-[3rem] border border-white/5 space-y-6 relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 blur-[80px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                    <div className="flex items-start justify-between relative z-10">
                      <div className="space-y-1">
                        <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-blue-500">AI Command</h3>
                        <p className="text-[10px] text-[#8e8e93] font-medium leading-relaxed max-w-[240px]">
                          Esegui interrogazioni dirette sul mercato o richiedi una strategia di rifornimento ottimizzata.
                        </p>
                      </div>
                      <button onClick={() => setShowSettings(true)} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-[#8e8e93] transition-all border border-white/5 shadow-inner">
                        <Settings size={18} />
                      </button>
                    </div>

                    <div className="relative z-10">
                      <textarea
                        value={userQuestion}
                        onChange={(e) => setUserQuestion(e.target.value)}
                        placeholder="Interroga il sistema (es: Tendenza prezzi fine settimana?)"
                        className="w-full bg-black/40 border border-white/5 focus:border-blue-500/30 rounded-[2rem] p-5 text-xs text-white outline-none transition-all resize-none h-32 backdrop-blur-md placeholder:text-white/10 font-medium"
                      />
                    </div>

                    <button
                      onClick={() => fetchAnalysisWithCache(selectedFuel, true, userQuestion, filteredStations)}
                      disabled={analysisLoading}
                      className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-[2rem] shadow-[0_15px_40px_rgba(37,99,235,0.25)] active:scale-[0.98] transition-all text-[11px] uppercase tracking-[0.3em] italic flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                      {analysisLoading ? <RefreshCw size={16} className="animate-spin" /> : <Zap size={16} className="fill-white" />}
                      {analysisLoading ? 'Processing Query...' : 'Execute Analysis'}
                    </button>
                  </section>

                  {!marketRef && analysisLoading ? (
                    <div className="py-32 text-center space-y-6 bg-[#1c1c1e]/40 rounded-[3rem] border border-white/5">
                       <div className="relative mx-auto w-14 h-14">
                          <div className="absolute inset-0 border-4 border-blue-500/10 rounded-full" />
                          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="absolute inset-0 border-4 border-t-blue-500 rounded-full" />
                       </div>
                       <div className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500 animate-pulse italic">Aggregazione dati...</div>
                    </div>
                  ) : !marketRef ? (
                    <div className="py-20 text-center space-y-4 bg-[#1c1c1e]/30 rounded-[3rem] border border-white/5 opacity-50 border-dashed">
                       <BarChart3 className="mx-auto text-white/10" size={50} />
                       <div className="text-[10px] font-black uppercase tracking-widest text-[#8e8e93]">In attesa di dati operativi</div>
                    </div>
                  ) : (
                    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-5 duration-700">
                      {/* Integrated Visual Projection */}
                      <section className="bg-[#1c1c1e] p-8 rounded-[3rem] border border-white/10 shadow-2xl relative overflow-hidden">
                        <div className="flex items-start justify-between mb-10 relative z-10">
                          <div className="space-y-1">
                            <div className="text-[10px] font-black text-[#8e8e93] uppercase tracking-[0.3em]">Projection 7D</div>
                            <div className="text-4xl font-black italic text-white tracking-tighter flex items-center gap-3">
                              €{marketRef.historicalData?.[marketRef.historicalData.length - 1]?.price?.toFixed(3) || '0.000'}
                              <span className="text-xl text-blue-500/40 not-italic font-light">→</span>
                              <span className="text-blue-500">€{marketRef.forecast?.[marketRef.forecast.length - 1]?.price?.toFixed(3) || '0.000'}</span>
                            </div>
                            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-blue-500/60 mt-2 block italic">Sintesi Algoritmica {analysisIsLocal ? 'Locale' : 'AI'}</span>
                          </div>
                          <div className={cn("p-4 rounded-3xl border shadow-xl transition-colors duration-500", trendTone)}>
                            {marketRef.trend === 'DOWN' ? <TrendingDown size={32} /> : marketRef.trend === 'UP' ? <TrendingUp size={32} /> : <BarChart3 size={32} />}
                          </div>
                        </div>

                        <div className="h-44 w-full relative z-10">
                          <SparklineChart data={[...(marketRef.historicalData || []), ...(marketRef.forecast || [])]} trend={marketRef.trend} />
                        </div>
                      </section>

                      {/* Strategic Hub Insights */}
                      <AdviceSection analysis={marketRef} fuelType={selectedFuel} />

                      {/* Expandable Technical Report */}
                      {marketRef.detailedReport && (
                        <details className="group bg-[#1c1c1e]/80 backdrop-blur-md rounded-[2.5rem] border border-white/5 overflow-hidden transition-all">
                          <summary className="list-none cursor-pointer p-6 flex items-center justify-between hover:bg-white/[0.02]">
                            <div className="flex items-center gap-4 text-blue-500">
                              <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                                <FileText size={20} />
                              </div>
                              <div>
                                <h3 className="text-xs font-black uppercase tracking-[0.2em] italic text-white">Full Report</h3>
                                <p className="text-[9px] text-[#48484a] font-black uppercase mt-0.5">Dettagli tecnici di mercato</p>
                              </div>
                            </div>
                            <ChevronDown size={20} className="text-[#48484a] group-open:rotate-180 transition-transform" />
                          </summary>
                          <div className="px-8 pb-8 text-[11px] text-white/60 leading-relaxed font-medium space-y-4 border-t border-white/5 pt-6 italic">
                            {marketRef.detailedReport.split('\n').filter(l => l.trim()).map((line, idx) => (
                              <p key={idx}>{line}</p>
                            ))}
                          </div>
                        </details>
                      )}

                      {/* Market Categorization Cards */}
                      {marketRef.categories && (
                        <div className="grid grid-cols-1 gap-4">
                          {marketRef.categories.map((cat, i) => (
                            <section key={i} className="bg-[#1c1c1e]/60 p-6 rounded-[2.5rem] border border-white/5 space-y-4 hover:border-blue-500/20 transition-all group">
                              <div className="flex items-center gap-4 text-blue-400/80 group-hover:text-blue-400">
                                  <div className="p-2.5 bg-black/40 rounded-2xl border border-white/5 group-hover:border-blue-500/20 transition-all">
                                    {cat.icon === 'Globe' && <Globe size={16} />}
                                    {cat.icon === 'MapPin' && <MapPin size={16} />}
                                    {cat.icon === 'Calendar' && <Calendar size={16} />}
                                    {!['Globe', 'MapPin', 'Calendar'].includes(cat.icon || '') && <Layers size={16} />}
                                  </div>
                                  <h4 className="text-[11px] font-black uppercase tracking-[0.3em] italic">{cat.title}</h4>
                              </div>
                              <p className="text-xs text-[#8e8e93] leading-relaxed font-medium italic">"{cat.content}"</p>
                            </section>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'alerts' && (
            <motion.div
              key="alerts"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-8 pb-24"
            >
              <header className="px-2 pt-2 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                  <h2 className="text-[9px] font-black uppercase tracking-[0.4em] text-blue-500/90">Notification Center</h2>
                </div>
                <h3 className="text-4xl font-black tracking-tight text-white uppercase italic leading-none">Guard<span className="text-blue-500">IAN</span></h3>
              </header>

              <div className="bg-[#1c1c1e] p-8 rounded-[3.5rem] border border-white/5 space-y-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[50px] pointer-events-none" />
                <div className="space-y-2 relative z-10">
                   <h4 className="text-lg font-black uppercase italic tracking-tight text-white">Smart Monitor</h4>
                   <p className="text-xs text-[#8e8e93] font-medium leading-relaxed">Configura una soglia di prezzo. Verrai notificato istantaneamente non appena il mercato intercetta il tuo target.</p>
                </div>

                <div className="space-y-6 relative z-10">
                   <div className="flex bg-black/40 backdrop-blur-md rounded-[2.5rem] p-6 justify-between items-center border border-white/5 shadow-inner">
                      <div className="flex items-center gap-4">
                         <div className="w-14 h-14 bg-blue-500/10 rounded-[1.5rem] flex items-center justify-center text-blue-500 border border-blue-500/20 font-black text-xl shadow-lg">
                            {selectedFuel[0]}
                         </div>
                         <div className="space-y-0.5">
                            <span className="font-black uppercase italic tracking-tighter text-white">{selectedFuel}</span>
                            <div className="text-[8px] font-black text-blue-500/60 uppercase tracking-widest">Active Fuel</div>
                         </div>
                      </div>
                      <div className="text-right">
                         <div className="text-[8px] text-[#48484a] font-black uppercase tracking-widest mb-1">Target Price €/L</div>
                         <input 
                           type="number" 
                           step="0.001" 
                           placeholder="1.750" 
                           className="bg-transparent text-3xl font-black text-blue-500 w-28 text-right outline-none focus:scale-105 transition-transform placeholder:text-blue-900/30"
                         />
                      </div>
                   </div>
                   <button 
                     onClick={() => {
                        const newAlert: Alert = { id: Math.random().toString(36).substr(2, 9), fuelType: selectedFuel, threshold: 1.75, active: true };
                        setAlerts(prev => [...prev, newAlert]);
                     }}
                     className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-[2.5rem] shadow-[0_15px_40px_rgba(37,99,235,0.2)] active:scale-95 transition-all text-xs uppercase tracking-[0.3em] italic"
                   >
                    Inizia Monitoraggio
                   </button>
                </div>
              </div>

              <div className="space-y-6 px-2">
                 <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#48484a]">Sentinel Queue</h3>
                    <div className="h-px flex-1 bg-white/5 ml-4" />
                 </div>

                 {alerts.length === 0 ? (
                    <div className="p-16 text-center space-y-4 bg-[#1c1c1e]/40 rounded-[3rem] border border-white/5 opacity-40 italic">
                       <BellOff size={40} className="mx-auto text-[#48484a]" />
                       <p className="text-[10px] font-black uppercase tracking-widest text-[#48484a]">Nessun processo attivo</p>
                    </div>
                 ) : (
                    <div className="grid gap-4">
                       {alerts.map(a => (
                          <div key={a.id} className="group bg-[#1c1c1e] p-6 rounded-[2.5rem] border border-white/5 hover:border-blue-500/20 transition-all flex items-center justify-between shadow-lg">
                             <div className="flex items-center gap-5">
                                <div className={cn(
                                  "w-3 h-3 rounded-full transition-all duration-500", 
                                  a.active ? "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]" : "bg-[#48484a]"
                                )} />
                                <div>
                                   <div className="text-sm font-black text-white uppercase italic tracking-tight group-hover:text-blue-400 transition-colors">{a.fuelType}</div>
                                   <div className="text-[10px] text-[#8e8e93] font-bold uppercase tracking-widest mt-0.5 italic">Target: <span className="text-white">€{a.threshold.toFixed(3)}</span></div>
                                </div>
                             </div>
                             <div className="flex items-center gap-2">
                                <div className="text-[8px] font-black text-[#48484a] uppercase tracking-widest mr-4 group-hover:text-emerald-500/40 transition-colors">Monitoring...</div>
                                <button
                                  onClick={() => setAlerts(prev => prev.filter(al => al.id !== a.id))}
                                  className="p-3 bg-white/5 hover:bg-red-500/10 rounded-2xl transition-all text-[#48484a] hover:text-red-500 border border-transparent hover:border-red-500/20"
                                >
                                   <X size={18} />
                                </button>
                             </div>
                          </div>
                       ))}
                    </div>
                 )}
              </div>
            </motion.div>
          )}        </AnimatePresence>
      </main>
    </BottomSheet>

      {/* Tab Bar */}
      <nav className="fixed bottom-8 left-6 right-6 h-20 bg-black/40 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] flex items-center justify-around px-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[100] transition-all">
        <div className="absolute inset-0 bg-blue-600/[0.01] rounded-[2.5rem] pointer-events-none" />
        {[
          { id: 'home', icon: Home, label: 'Signals' },
          { id: 'map', icon: MapIcon, label: 'Map' },
          { id: 'trip', icon: Route, label: 'Path' },
          { id: 'veicolo', icon: Car, label: 'Garage' },
          { id: 'analysis', icon: BarChart3, label: 'Intel' },
          { id: 'alerts', icon: Bell, label: 'Radar' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 w-14 h-14 rounded-2xl transition-all relative outline-none",
              activeTab === tab.id ? "text-blue-500" : "text-[#48484a] hover:text-[#8e8e93]"
            )}
          >
            <div className={cn(
              "transition-all duration-500 ease-out", 
              activeTab === tab.id ? "scale-110 -translate-y-1.5" : "scale-100"
            )}>
               <tab.icon 
                 size={20} 
                 strokeWidth={activeTab === tab.id ? 2.5 : 2}
                 className={cn(
                   "transition-all duration-500",
                   activeTab === tab.id && "drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]"
                 )} 
               />
            </div>
            <span className={cn(
              "text-[7px] font-black uppercase tracking-[0.15em] transition-all duration-500",
              activeTab === tab.id ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
            )}>
              {tab.label}
            </span>
            {activeTab === tab.id && (
              <motion.div 
                 layoutId="activeTabIndicator"
                 className="absolute -bottom-1 w-6 h-1 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,1)]"
                 transition={{ type: "spring", damping: 30, stiffness: 400 }}
              />
            )}
          </button>
        ))}
      </nav>

      {/* Popups */}
      <AnimatePresence>
        {showNotificationCenter && (
           <motion.div 
             initial={{ y: '100%' }}
             animate={{ y: 0 }}
             exit={{ y: '100%' }}
             transition={{ type: 'spring', damping: 25, stiffness: 200 }}
             className="fixed inset-0 z-[60] flex items-end justify-center"
           >
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowNotificationCenter(false)} />
              <div className="w-full max-w-md bg-[#1c1c1e] rounded-t-[3rem] border-t border-white/10 p-8 pt-4 space-y-6 relative z-10">
                 <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto" />
                 <div className="flex justify-between items-center text-white">
                    <h3 className="text-2xl font-black italic uppercase italic tracking-tighter">Box Ricezione</h3>
                    <button onClick={() => setShowNotificationCenter(false)} className="p-3 bg-white/5 rounded-full"><X size={20} /></button>
                 </div>
                 <div className="space-y-4 max-h-[60vh] overflow-y-auto no-scrollbar pb-10">
                    <div className="bg-white/5 p-6 rounded-[2rem] space-y-2 border border-white/5">
                       <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-black italic text-blue-500 uppercase tracking-widest bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">Market Alert</span>
                          <span className="text-[10px] text-[#8e8e93] font-bold uppercase">ORA</span>
                       </div>
                       <p className="text-sm font-black leading-tight uppercase italic text-white/90">Tendenza ribassista rilevata. Ottimo momento per pianificare rifornimento.</p>
                    </div>
                 </div>
              </div>
           </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFilters && (
           <motion.div 
             initial={{ y: '100%' }}
             animate={{ y: 0 }}
             exit={{ y: '100%' }}
             transition={{ type: 'spring', damping: 25, stiffness: 200 }}
             className="fixed inset-0 z-[60] flex items-end justify-center"
           >
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowFilters(false)} />
              <div className="w-full max-w-md bg-[#1c1c1e] rounded-t-[3rem] border-t border-white/10 p-8 pt-4 space-y-8 relative z-10">
                 <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto" />
                 <div className="flex justify-between items-center">
                    <h3 className="text-2xl font-black italic uppercase italic tracking-tighter text-white">Preferenze</h3>
                    <button onClick={() => setShowFilters(false)} className="p-3 bg-white/5 rounded-full text-white"><X size={20} /></button>
                 </div>

                 <div className="space-y-8">
                    <section className="space-y-4">
                       <h4 className="text-[11px] font-black text-[#8e8e93] uppercase tracking-[0.2em] px-1">Ordinamento</h4>
                       <div className="grid grid-cols-2 gap-2">
                         {[
                           { id: 'priceAsc', label: 'Più Economici' },
                           { id: 'priceDesc', label: 'Più Cari' },
                           { id: 'distAsc', label: 'Più Vicini' }
                         ].map(sortOpt => (
                            <button
                              key={sortOpt.id}
                              onClick={() => setSortMode(sortOpt.id as any)}
                              className={cn(
                                "px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border text-center",
                                sortMode === sortOpt.id ? "bg-blue-600 text-white border-blue-500 shadow-xl shadow-blue-900/20" : "bg-white/5 text-[#8e8e93] border-white/5"
                              )}
                            >
                               {sortOpt.label}
                            </button>
                         ))}
                       </div>
                    </section>

                    <section className="space-y-4">
                       <h4 className="text-[11px] font-black text-[#8e8e93] uppercase tracking-[0.2em] px-1">Network Carburanti</h4>                       <div className="flex flex-wrap gap-2">
                          {['Eni', 'IP', 'Q8', 'Esso', 'Tamoil', 'Nessun Brand'].map(brand => (
                             <button
                               key={brand}
                               onClick={() => setSelectedBrands(prev => prev.includes(brand) ? prev.filter(b => b !== brand) : [...prev, brand])}
                               className={cn(
                                 "px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border",
                                 selectedBrands.includes(brand) ? "bg-blue-600 text-white border-blue-500 shadow-xl shadow-blue-900/20" : "bg-white/5 text-[#8e8e93] border-white/5"
                               )}
                             >
                                {brand}
                             </button>
                          ))}
                       </div>
                    </section>

                    <section className="space-y-4">
                       <h4 className="text-[11px] font-black text-[#8e8e93] uppercase tracking-[0.2em] px-1">Servizi Extra</h4>
                       <div className="flex flex-wrap gap-2">
                          {['Self-Service', 'Bar', 'Autolavaggio', 'Officina'].map(service => (
                             <button
                               key={service}
                               onClick={() => setSelectedServices(prev => prev.includes(service) ? prev.filter(s => s !== service) : [...prev, service])}
                               className={cn(
                                 "px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border",
                                 selectedServices.includes(service) ? "bg-blue-600 text-white border-blue-500 shadow-xl shadow-blue-900/20" : "bg-white/5 text-[#8e8e93] border-white/5"
                               )}
                             >
                                {service}
                             </button>
                          ))}
                       </div>
                    </section>

                    <section className="space-y-4">
                       <h4 className="text-[11px] font-black text-[#8e8e93] uppercase tracking-[0.2em] px-1">Filtri Martucc Fuel</h4>
                       <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => setH24(prev => !prev)}
                            className={cn(
                              "px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border",
                              h24 ? "bg-blue-600 text-white border-blue-500 shadow-xl shadow-blue-900/20" : "bg-white/5 text-[#8e8e93] border-white/5"
                            )}
                          >
                             H24
                          </button>
                          <button
                            onClick={() => setNoHighway(prev => !prev)}
                            className={cn(
                              "px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border",
                              noHighway ? "bg-blue-600 text-white border-blue-500 shadow-xl shadow-blue-900/20" : "bg-white/5 text-[#8e8e93] border-white/5"
                            )}
                          >
                             Evita Autostrada
                          </button>
                          <button
                            onClick={() => setHideAnomalies(prev => !prev)}
                            className={cn(
                              "px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border",
                              hideAnomalies ? "bg-amber-600 text-white border-amber-500 shadow-xl shadow-amber-900/20" : "bg-white/5 text-[#8e8e93] border-white/5"
                            )}
                          >
                             Nascondi Anomalie
                          </button>
                       </div>
                       <div className="mt-4 px-1">
                         <label className="text-[10px] font-black text-[#8e8e93] uppercase tracking-widest flex justify-between">
                           Distanza Max <span>{radius} KM</span>
                         </label>
                         <input 
                           type="range" 
                           min="1" max="100" 
                           value={radius} 
                           onChange={e => setRadius(parseInt(e.target.value))} 
                           className="w-full mt-2 accent-blue-500"
                         />
                       </div>
                    </section>

                    <div className="flex gap-4 pt-4 pb-10">
                       <button onClick={() => { setSelectedBrands([]); setSelectedServices([]); setH24(false); setNoHighway(false); setRadius(20); }} className="flex-1 py-5 bg-white/5 text-[#8e8e93] font-black rounded-3xl text-xs uppercase tracking-widest">Resetta</button>
                       <button onClick={() => setShowFilters(false)} className="flex-[2] py-5 bg-blue-600 text-white font-black rounded-3xl shadow-2xl shadow-blue-900/30 active:scale-95 transition-all text-xs uppercase tracking-widest">Applica</button>
                    </div>
                 </div>
              </div>
           </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && (
           <motion.div 
             initial={{ y: '100%' }}
             animate={{ y: 0 }}
             exit={{ y: '100%' }}
             transition={{ type: 'spring', damping: 25, stiffness: 200 }}
             className="fixed inset-0 z-[60] flex items-end justify-center"
           >
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSettings(false)} />
              <div className="w-full max-w-md bg-[#1c1c1e] rounded-t-[3rem] border-t border-white/10 p-8 pt-4 space-y-8 relative z-10">
                 <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto" />
                 <div className="flex justify-between items-center">
                    <h3 className="text-2xl font-black italic uppercase italic tracking-tighter text-white">Configurazione AI</h3>
                    <button onClick={() => setShowSettings(false)} className="p-3 bg-white/5 rounded-full text-white"><X size={20} /></button>
                 </div>

                 <div className="space-y-8">
                    <section className="space-y-4">
                       <div className="flex items-center justify-between px-1">
                          <h4 className="text-[11px] font-black text-[#8e8e93] uppercase tracking-[0.2em]">Google Gemini Key</h4>
                          {apiKey ? <span className="text-[8px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">CONFIGURATA</span> : <span className="text-[8px] font-black text-red-500 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">MANCANTE</span>}
                       </div>
                       <div className="relative">
                          <input 
                            type="password"
                            value={apiKey}
                            onChange={(e) => {
                               const val = e.target.value;
                               setApiKey(val);
                               localStorage.setItem('martucc_fuel_api_key', val);
                            }}
                            placeholder="Inserisci la tua API Key..." 
                            className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm text-white focus:border-blue-500 outline-none transition-all pr-12"
                          />
                          <Zap size={18} className="absolute right-4 top-4 text-[#3a3a3c]" />
                       </div>
                       
                       <div className="bg-blue-600/5 border border-blue-500/20 rounded-2xl p-4 space-y-3">
                          <div className="flex items-center gap-2 text-blue-400">
                             <InfoIcon size={14} />
                             <span className="text-[10px] font-black uppercase tracking-widest">Come ottenere la chiave?</span>
                          </div>
                          <ol className="text-[10px] text-[#8e8e93] font-medium space-y-1 ml-4 list-decimal">
                             <li>Vai su <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-blue-500 underline">Google AI Studio</a></li>
                             <li>Accedi con il tuo account Google</li>
                             <li>Clicca su "Get API key" nella barra laterale</li>
                             <li>Crea una chiave e incollala qui sopra</li>
                          </ol>
                       </div>
                    </section>

                    <section className="space-y-4">
                       <h4 className="text-[11px] font-black text-[#8e8e93] uppercase tracking-[0.2em] px-1">Seleziona Modello</h4>
                       <div className="grid grid-cols-1 gap-2 max-h-[30vh] overflow-y-auto no-scrollbar">
                          {[
                             { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', speed: 'Compatibile' },
                             { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', speed: 'Consigliato' },
                             { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', speed: 'Analisi profonda' },
                             { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite', speed: 'Rapido e leggero' },
                             { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', speed: 'Compatibile' },
                             { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash-Lite', speed: 'Economico' }
                          ].map(model => (
                             <button
                               key={model.id}
                               onClick={() => {
                                  setApiModel(model.id);
                                  localStorage.setItem('martucc_fuel_api_model', model.id);
                               }}
                               className={cn(
                                 "flex items-center justify-between p-4 rounded-2xl text-xs font-bold transition-all border text-left",
                                 apiModel === model.id ? "bg-blue-600/10 text-white border-blue-500/30" : "bg-white/5 text-[#8e8e93] border-white/5 hover:bg-white/10"
                               )}
                             >
                                <div className="flex-1">
                                   <div className="font-black italic uppercase tracking-tight truncate max-w-[180px]">{model.label}</div>
                                   <div className="text-[9px] opacity-60 font-bold">{model.speed}</div>
                                </div>
                                {apiModel === model.id && <Zap size={14} className="text-blue-500 flex-shrink-0" />}
                             </button>
                          ))}
                       </div>
                    </section>

                    <div className="flex gap-4 pt-4 pb-12">
                       <button onClick={() => {
                          setApiKey('');
                          setApiModel('gemini-2.5-flash');
                          localStorage.removeItem('martucc_fuel_api_key');
                          localStorage.removeItem('martucc_fuel_api_model');
                       }} className="flex-1 py-5 bg-white/5 text-red-500 font-black rounded-3xl text-xs uppercase tracking-widest">Reset</button>
                       <button onClick={() => {
                          setShowSettings(false);
                          window.location.reload(); // Refresh to apply new settings
                       }} className="flex-[2] py-5 bg-blue-600 text-white font-black rounded-3xl shadow-2xl shadow-blue-900/30 active:scale-95 transition-all text-xs uppercase tracking-widest">Salva e Ricarica</button>
                    </div>
                 </div>
              </div>
           </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

 function StationCard({ station, fuelType, index, isFavorite, onToggleFavorite, isCheapest, tankLiters, averagePrice }: {
     station: FuelStation,
     fuelType: FuelType,
     index: number,
     isFavorite: boolean,
     onToggleFavorite: (id: string) => void,
     isCheapest?: boolean,
     tankLiters: number,
     averagePrice: number
   }) {
     const priceObj = station.prices.find(p => p.type === fuelType);
     const price = priceObj?.price || 0;
     const isAnomalous = price > 0 && averagePrice !== Infinity && price < averagePrice * 0.85;
 
     const fullTankCost = price > 0 ? (price * tankLiters).toFixed(2) : null;
     
     return (
     <motion.div
       initial={{ opacity: 0, y: 10 }}
       animate={{ opacity: 1, y: 0 }}
       transition={{ delay: index * 0.03 }}
       className={cn(
         "group relative flex items-center gap-4 p-4 rounded-[2rem] border transition-all cursor-pointer overflow-hidden backdrop-blur-md",
         isAnomalous 
           ? "bg-gray-500/5 border-gray-500/10 grayscale-[0.5]" 
           : isCheapest 
             ? "bg-blue-600/10 border-blue-500/30 shadow-xl shadow-blue-500/5" 
             : "bg-white/[0.03] border-white/5 hover:bg-white/[0.05] hover:border-white/10"
       )}
     >
       {/* Background Accent */}
       <div className={cn(
         "absolute -right-8 -top-8 w-24 h-24 rounded-full blur-[40px] opacity-[0.05] transition-opacity group-hover:opacity-[0.1]",
         isCheapest ? "bg-blue-500" : "bg-white"
       )} />

       <div className="relative flex-shrink-0">
         <div className={cn(
           "w-12 h-12 rounded-2xl flex items-center justify-center font-black transition-all border shadow-inner",
           isCheapest ? "bg-blue-600 text-white border-blue-400" : "bg-black text-[#8e8e93] border-white/5"
         )}>
           {station.brand.charAt(0)}
         </div>
         <button
           onClick={(e) => { e.stopPropagation(); onToggleFavorite(station.id); }}
           className="absolute -top-1.5 -right-1.5 p-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10 z-10 transition-transform hover:scale-110"
         >
           <Heart size={10} className={cn("transition-colors", isFavorite ? "text-red-500 fill-red-500" : "text-white/20 hover:text-white/40")} />
         </button>
       </div>

       <div className="flex-1 min-w-0">
         <div className="flex items-center gap-2">
           <h4 className="font-black text-white italic uppercase tracking-tight text-xs truncate group-hover:text-blue-400 transition-colors">
             {station.brand || station.name}
           </h4>
           {isCheapest && <span className="px-1.5 py-0.5 bg-blue-600 rounded text-[6px] font-black text-white uppercase tracking-widest animate-pulse">Alpha</span>}
           {isAnomalous && <AlertTriangle size={12} className="text-amber-500" />}
         </div>
         
         <div className="flex items-center gap-2 mt-0.5">
           <span className="text-[9px] font-bold text-[#8e8e93] uppercase tracking-wider truncate flex items-center gap-1">
             <MapPin size={8} className="text-blue-500/50" /> {station.address.split(',')[0]}
           </span>
           <span className="text-[9px] font-black text-blue-500/40 uppercase tracking-widest italic">{station.distance || '0.5'} KM</span>
         </div>

         {isAnomalous ? (
           <div className="mt-1.5 flex items-center gap-1.5">
             <div className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
             <span className="text-[8px] font-black text-amber-500/80 uppercase tracking-widest italic">Signal Anomaly Detected</span>
           </div>
         ) : (
           <div className="flex gap-1 mt-2">
             {station.services.slice(0, 2).map((service, sIdx) => (
               <span key={sIdx} className="text-[7px] font-black text-[#48484a] bg-black/30 px-1.5 py-0.5 rounded-lg border border-white/5 uppercase tracking-widest group-hover:border-blue-500/20 transition-colors">
                 {service}
               </span>
             ))}
             {station.services.length > 2 && <span className="text-[7px] font-black text-[#48484a] px-1 py-0.5">+</span>}
           </div>
         )}
       </div>

       <div className="flex flex-col items-end gap-0.5">
         <div className={cn(
           "text-xl font-black italic tracking-tighter flex items-baseline gap-0.5",
           isAnomalous ? "text-gray-500 line-through" : isCheapest ? "text-blue-400" : "text-white"
         )}>
           <span className="text-[10px] not-italic mr-0.5 opacity-40 italic">€</span>
           {price.toFixed(3)}
         </div>
         {fullTankCost && !isAnomalous && (
           <div className="text-[8px] font-black text-[#48484a] uppercase tracking-[0.15em] italic">
             Tank: <span className="text-emerald-500/60">€{fullTankCost}</span>
           </div>
         )}
       </div>
     </motion.div>
   );
 }

function FuelTypeSelector({ current, onSelect }: { current: FuelType, onSelect: (f: FuelType) => void }) {
  const types: FuelType[] = ['Benzina', 'Diesel', 'GPL', 'Metano'];
  return (
    <div className="flex bg-white/5 p-1.5 rounded-[1.5rem] border border-white/5 backdrop-blur-xl">
      {types.map(t => (
        <button
          key={t}
          onClick={() => onSelect(t)}
          className={cn(
            "px-4 py-2 rounded-2xl text-[9px] font-black uppercase tracking-[0.15em] transition-all whitespace-nowrap outline-none",
            current === t ? "bg-blue-600 text-white shadow-xl shadow-blue-900/30" : "text-[#8e8e93] hover:text-[#f5f5f7]"
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function AdviceSection({ analysis, fuelType }: { analysis: MarketAnalysis, fuelType: FuelType }) {
  const getAdviceDetails = () => {
    switch (analysis.advice) {
      case 'FILL-FULL':
      case 'FAILL-FULL':
        return { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: <Droplets />, text: 'Fai il Pieno', subtext: 'Prezzo ottimale rilevato' };
      case 'WAIT': return { color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: <Calculator />, text: 'Attesa Strategica', subtext: 'Trend in contrazione' };
      case 'TEN-EURO': return { color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20', icon: <Wallet />, text: 'Rifornimento Minimo', subtext: 'Attendi calo imminente' };
      case 'URGENT': return { color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: <TrendingUp />, text: 'Azione Urgente', subtext: 'Rincaro rilevato' };
      default: return { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: <Fuel />, text: 'Asset Analizzato', subtext: 'Intel Pronta' };
    }
  };

  const details = getAdviceDetails();

  return (
    <div className="relative group overflow-hidden bg-white/[0.02] backdrop-blur-3xl rounded-[3rem] p-8 border border-white/10 shadow-2xl transition-all hover:border-blue-500/30">
      <div className={cn("absolute -top-24 -right-24 w-64 h-64 opacity-[0.08] blur-[60px] transition-transform group-hover:scale-110 duration-1000 rounded-full", details.bg)} />
      
      <div className="flex items-start justify-between relative z-10 mb-8">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", details.color.replace('text', 'bg'))} />
            <p className={cn("text-[9px] font-black uppercase tracking-[0.4em]", details.color)}>AI Tactical — {fuelType}</p>
          </div>
          <h3 className="text-4xl font-black italic tracking-tighter text-white uppercase leading-none">
            {details.text}
          </h3>
          <p className="text-[#8e8e93] font-bold text-xs uppercase tracking-[0.2em] mt-2 italic opacity-60">{details.subtext}</p>
        </div>
        <div className={cn("p-5 rounded-[2rem] text-white flex items-center justify-center border backdrop-blur-xl shadow-2xl", details.bg, details.border)}>
          {React.cloneElement(details.icon as React.ReactElement<any>, { size: 32, className: details.color })}
        </div>
      </div>
      
      <div className="p-6 bg-black/60 rounded-[2.5rem] border border-white/5 relative z-10 transition-all group-hover:border-blue-500/20 shadow-inner">
        <p className="text-xs leading-relaxed text-[#8e8e93] font-medium italic">
          <span className="text-blue-500/50 mr-2">/</span> {analysis.reasoning}
        </p>
      </div>
      
      <div className="flex items-center gap-2 text-[10px] font-black text-blue-500 mt-6 cursor-pointer group/link relative z-10 uppercase tracking-[0.3em] italic">
        Access Full Protocol <ChevronRight size={14} className="group-hover/link:translate-x-2 transition-transform duration-500" />
      </div>
    </div>
  );
}

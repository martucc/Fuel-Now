import { useState, useEffect, useRef, useMemo } from 'react';
import { Preferences } from '@capacitor/preferences';
import { MapPin, Bell, Settings, Home, BarChart3, Car, Target, Route, Calculator, Layers, MapPinned } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { FuelStation, MarketAnalysis, FuelType, Alert } from './types';
import { getStations } from './services/dataService';
import { analyzeFuelMarket } from './services/geminiService';
import { buildLocalMarketAnalysis, calculateMarketStats } from './services/localAnalysis';
import { loadHistory } from './services/historyService';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
// @ts-ignore
import markerIcon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

import { HomeTab } from './components/tabs/HomeTab';
import { TripTab } from './components/tabs/TripTab';
import { VehicleTab } from './components/tabs/VehicleTab';
import { PienoTab } from './components/tabs/PienoTab';
import { checkPriceThresholds, checkDailyTrend, checkBestDeal, checkPienoReminder, checkDeadlines, checkBudget, permissionState, requestPermission, loadPrefs, savePrefs } from './services/notificationService';
import { BudgetCalcModal } from './components/BudgetCalcModal';
import { InstallPwaButton } from './components/InstallPwaButton';
import { StationHistoryModal } from './components/StationHistoryModal';
import { recordObservation } from './services/stationHistoryService';
import { AnalysisTab } from './components/tabs/AnalysisTab';
import { AlertsTab } from './components/tabs/AlertsTab';
import { FiltersModal } from './components/modals/FiltersModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { SplashScreen } from './components/SplashScreen';
import { BottomNav } from './components/BottomNav';
import { getBrandLogo } from './lib/brandLogos';

const DefaultIcon = L.icon({ iconUrl: markerIcon, shadowUrl: markerShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

type TabType = 'home'|'map'|'veicolo'|'analysis'|'alerts'|'trip'|'pieno';
const tabOrder: TabType[] = ['home', 'map', 'trip', 'veicolo', 'analysis', 'pieno', 'alerts'];

const pageVariants = {
  initial: (direction: number) => ({
    x: direction > 0 ? 100 : -100,
    scale: 0.96,
    opacity: 0,
  }),
  animate: {
    x: 0,
    scale: 1,
    opacity: 1,
    transition: {
      x: { type: "spring" as const, stiffness: 350, damping: 32, mass: 0.8 },
      scale: { type: "spring" as const, stiffness: 350, damping: 32, mass: 0.8 },
      opacity: { duration: 0.25, ease: "easeOut" as const }
    },
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -100 : 100,
    scale: 0.96,
    opacity: 0,
    transition: {
      x: { type: "spring" as const, stiffness: 350, damping: 32, mass: 0.8 },
      scale: { type: "spring" as const, stiffness: 350, damping: 32, mass: 0.8 },
      opacity: { duration: 0.18, ease: "easeIn" as const }
    },
  }),
};

function MapUpdater({ onMove, onZoom }: { onMove: (c: { lat: number; lng: number }) => void; onZoom?: (z: number) => void }) {
  useMapEvents({
    moveend: (e: any) => { const c = e.target.getCenter(); onMove({ lat: c.lat, lng: c.lng }); onZoom?.(e.target.getZoom()); },
    zoomend: (e: any) => { onZoom?.(e.target.getZoom()); },
  });
  return null;
}
function CenterBtn({ loc }: { loc: { lat: number; lng: number } | null }) {
  const map = useMap();
  if (!loc) return null;
  return <button onClick={() => map.setView([loc.lat, loc.lng], 15)} className="absolute bottom-6 right-6 z-[500] p-4 bg-blue-600 text-white rounded-2xl shadow-xl active:scale-95 transition-all outline-none"><Target size={24} /></button>;
}

function HeatmapToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`absolute top-4 right-4 z-[500] w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl active:scale-95 transition-all border ${
        active
          ? 'bg-blue-600 text-white border-blue-400/40 shadow-[0_0_24px_rgba(37,99,235,0.5)]'
          : 'bg-black/85 text-white border-white/15 backdrop-blur-md'
      }`}
      title={active ? 'Vista pin' : 'Vista heatmap'}
      aria-label="Toggle heatmap"
    >
      {active ? <MapPinned size={20} /> : <Layers size={20} />}
    </button>
  );
}

function priceToHeatColor(price: number, avg: number): string {
  if (!price || !avg || !isFinite(avg)) return 'hsl(200, 50%, 50%)';
  const delta = (price - avg) / avg;
  const t = Math.max(-1, Math.min(1, delta / 0.035));
  const hue = 120 * (1 - (t + 1) / 2);
  return `hsl(${Math.round(hue)}, 80%, 50%)`;
}

function normalizeFuelNews(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.events)) return raw.events.map((e: any) => ({ title: e.title || 'Aggiornamento', summary: e.summary || e.content || '', content: e.content || e.summary || '', impact: e.impact || 'neutral', source: e.source || 'Fuel Now', url: e.url || e.link, date: e.date || raw.generated_at }));
  return [];
}

// @ts-ignore - utility per nome breve veicolo, riservata per usi futuri
// Estrae nome breve veicolo (es. "BMW Serie 3 320d (Diesel)" -> "BMW Serie 3")
function shortCarName(m: string): string {
  if (!m) return '';
  let s = m.split('(')[0].trim();
  const cutRe = /\s+(\d+\.\d+|\d{2,3}(?!cc\b)[a-z]+|[BDT]\d(?:\/[BDT]\d)+|[BDT][2-9]|TSI|TDI|TFSI|JTDm?|MultiJet|BlueHDi|EcoBoost|EcoBlue|dCi|TCe|SkyActiv[-\s]?[A-Z]?|T-Jet|T-GDi|CRDi|PureTech|FireFly|e-Hybrid|e:HEV|Hybrid|MHEV|PHEV|FHEV|TGI|G-Tec|Eco-G|Turbo|Plug-in|sDrive\w*|xDrive\w*|DIG-T|IG-T|VVT-i|e-Tech|e-POWER|BoosterJet|DDiS|HDi|CDTi|cdti|BiTurbo|GPL|Metano|Diesel|Benzina|Mild|Full)\b.*$/i;
  s = s.replace(cutRe, '');
  // Standalone digit at end (codici Audi/Mercedes "25", "180") - non tagliare se preceduto da "Serie"/"Classe"
  if (!/\b(Serie|Classe)\s+\w+$/i.test(s)) s = s.replace(/\s+\d{1,3}$/, '');
  return s.trim();
}

const WEATHER_MAP: Record<number, { icon: string; desc: string }> = {
  0: { icon: "☀️", desc: "Soleggiato" },
  1: { icon: "⛅", desc: "Poco Nuvoloso" },
  2: { icon: "⛅", desc: "Poco Nuvoloso" },
  3: { icon: "☁️", desc: "Coperto" },
  45: { icon: "🌫️", desc: "Nebbia" },
  48: { icon: "🌫️", desc: "Nebbia" },
  51: { icon: "🌧️", desc: "Pioggerella" },
  53: { icon: "🌧️", desc: "Pioggerella" },
  55: { icon: "🌧️", desc: "Pioggerella" },
  61: { icon: "🌧️", desc: "Pioggia" },
  63: { icon: "🌧️", desc: "Pioggia" },
  65: { icon: "🌧️", desc: "Forte Pioggia" },
  71: { icon: "❄️", desc: "Neve" },
  73: { icon: "❄️", desc: "Neve" },
  75: { icon: "❄️", desc: "Fitta Neve" },
  80: { icon: "🌧️", desc: "Rovesci" },
  81: { icon: "🌧️", desc: "Rovesci" },
  82: { icon: "🌧️", desc: "Rovesci" },
  95: { icon: "⚡", desc: "Temporale" },
  96: { icon: "⚡", desc: "Temporale" },
  99: { icon: "⚡", desc: "Temporale" }
};

async function updateWidgetData(stations: FuelStation[], fuelType: FuelType, loc: { lat: number; lng: number } | null) {
  try {
    if (loc) {
      await Preferences.set({ key: "mf_widget_user_lat", value: String(loc.lat) });
      await Preferences.set({ key: "mf_widget_user_lng", value: String(loc.lng) });
    }
    await Preferences.set({ key: "mf_widget_fuel_type", value: fuelType });

    // 1. Filter stations by location if available (limit to 20 km)
    let localStations = stations;
    if (loc) {
      localStations = stations.filter(s => (s.distance ?? 999) <= 20);
      // Fallback: if no stations within 20km, search up to 40km or use all
      if (localStations.length === 0) {
        localStations = stations.filter(s => (s.distance ?? 999) <= 40);
      }
      if (localStations.length === 0) {
        localStations = stations;
      }
    }

    let cheapest: FuelStation | null = null;
    let minPrice = Infinity;
    
    for (const s of localStations) {
      const p = s.prices.find(pr => pr.type === fuelType);
      if (p && p.price && p.price < minPrice) {
        minPrice = p.price;
        cheapest = s;
      }
    }

    if (cheapest) {
      const brandName = cheapest.brand && cheapest.brand !== "Indipendente" ? cheapest.brand : cheapest.name;
      const distText = cheapest.distance !== undefined ? ` · ${cheapest.distance.toFixed(1)} km` : "";
      const stationText = `${brandName}${distText}`;
      const priceText = `${minPrice.toFixed(3)} €/L`;
      
      await Preferences.set({ key: "mf_widget_cheapest_name", value: stationText });
      await Preferences.set({ key: "mf_widget_cheapest_price", value: priceText });
    } else {
      await Preferences.set({ key: "mf_widget_cheapest_name", value: "Apri l'app..." });
      await Preferences.set({ key: "mf_widget_cheapest_price", value: "--- €/L" });
    }

    let aiTip = "💡 Risparmia su Martucc Fuel";
    if (localStations.length > 0 && cheapest) {
      const allPrices = localStations.flatMap(s => s.prices.filter(p => p.type === fuelType).map(p => p.price)).filter(p => p > 0);
      if (allPrices.length > 0) {
        const avg = allPrices.reduce((a, b) => a + b, 0) / allPrices.length;
        const diff = avg - minPrice;
        if (diff > 0.05) {
          aiTip = `💡 Risparmio: -${Math.round(diff * 100)}¢ vs media!`;
        } else {
          aiTip = "💡 Prezzi stabili. Fai rifornimento.";
        }
      }
    }
    await Preferences.set({ key: "mf_widget_ai_tip", value: aiTip });

    // CALCOLA IL DISTRIBUTORE PIU VICINO ENTRO 20 KM
    let closest: FuelStation | null = null;
    let minDistance = Infinity;

    for (const s of localStations) {
      const p = s.prices.find(pr => pr.type === fuelType);
      if (p && p.price) {
        const dist = s.distance ?? 999;
        if (dist < minDistance) {
          minDistance = dist;
          closest = s;
        }
      }
    }

    if (closest) {
      const brandName = closest.brand && closest.brand !== "Indipendente" ? closest.brand : closest.name;
      const distText = closest.distance !== undefined ? ` · ${closest.distance.toFixed(1)} km` : "";
      const stationText = `${brandName}${distText}`;
      const closestPrice = closest.prices.find(pr => pr.type === fuelType)?.price || 0;
      const priceText = `${closestPrice.toFixed(3)} €/L`;
      
      await Preferences.set({ key: "mf_widget_closest_name", value: stationText });
      await Preferences.set({ key: "mf_widget_closest_price", value: priceText });

      let closestAiTip = "💡 Più vicino a te";
      if (cheapest && closest.id === cheapest.id) {
        closestAiTip = "⭐ Più economico e vicino!";
      } else if (cheapest) {
        const diff = closestPrice - minPrice;
        if (diff > 0) {
          closestAiTip = `💡 +${Math.round(diff * 100)}¢ rispetto al min`;
        }
      }
      await Preferences.set({ key: "mf_widget_closest_ai_tip", value: closestAiTip });
    } else {
      await Preferences.set({ key: "mf_widget_closest_name", value: "Apri l'app..." });
      await Preferences.set({ key: "mf_widget_closest_price", value: "--- €/L" });
      await Preferences.set({ key: "mf_widget_closest_ai_tip", value: "💡 Apri Martucc Fuel" });
    }

    // SALVA LE TOP 5 STAZIONI PIU VICINE PER IL MAP/RADAR WIDGET
    const sortedByDist = [...localStations]
      .filter(s => s.prices.some(pr => pr.type === fuelType && pr.price > 0))
      .sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999))
      .slice(0, 5);

    const nearbyData = sortedByDist.map(s => {
      const p = s.prices.find(pr => pr.type === fuelType)?.price || 0;
      return {
        id: s.id,
        name: s.brand && s.brand !== "Indipendente" ? s.brand : s.name,
        lat: s.location.lat,
        lng: s.location.lng,
        distance: s.distance ?? 0,
        price: p
      };
    });

    await Preferences.set({ key: "mf_widget_nearby_stations", value: JSON.stringify(nearbyData) });

    if (loc) {
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lng}&current_weather=true`);
        if (res.ok) {
          const wData = await res.json();
          const cw = wData.current_weather;
          if (cw) {
            const tempText = `${Math.round(cw.temperature)}°C`;
            const code = cw.weathercode ?? 0;
            const wMapped = WEATHER_MAP[code] || { icon: "☀️", desc: "Soleggiato" };
            
            await Preferences.set({ key: "mf_widget_weather_icon", value: wMapped.icon });
            await Preferences.set({ key: "mf_widget_weather_temp", value: tempText });
            await Preferences.set({ key: "mf_widget_weather_desc", value: wMapped.desc });
          }
        }
      } catch (err) {
        console.error("Widget Weather Fetch error:", err);
      }
    }
  } catch (err) {
    console.error("Error updating widget preferences:", err);
  }
}

export default function App() {
  const [tab, setTab] = useState<TabType>(() => {
    const p = new URLSearchParams(window.location.search);
    const t = p.get('tab') as TabType | null;
    const valid: TabType[] = ['home','map','veicolo','analysis','alerts','trip','pieno'];
    return t && valid.includes(t) ? t : 'home';
  });
  const [userLoc, setUserLoc] = useState<{lat:number;lng:number}|null>(null);
  const [stations, setStations] = useState<FuelStation[]>([]);
  const [nationalStats, setNationalStats] = useState<any>({});
  const [marketAnalyses, setMarketAnalyses] = useState<Record<string, MarketAnalysis>>({});
  const [fuel, setFuel] = useState<FuelType>(() => {
    const p = new URLSearchParams(window.location.search);
    const valid: FuelType[] = ['Benzina','Diesel','GPL','Metano'];
    const fromUrl = p.get('fuel');
    if (fromUrl && (valid as string[]).includes(fromUrl)) return fromUrl as FuelType;
    const stored = localStorage.getItem('mf_fuel');
    if (stored && (valid as string[]).includes(stored)) return stored as FuelType;
    return 'Benzina';
  });
  useEffect(() => { localStorage.setItem('mf_fuel', fuel); }, [fuel]);
  const [loading, setLoading] = useState(true);
  const [favs, setFavs] = useState<string[]>([]);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showBudget, setShowBudget] = useState(false);
  const [stationDetail, setStationDetail] = useState<FuelStation | null>(null);
  const [heatmapOn, setHeatmapOn] = useState<boolean>(() => localStorage.getItem('mf_heatmap') === '1');
  useEffect(() => { localStorage.setItem('mf_heatmap', heatmapOn ? '1' : '0'); }, [heatmapOn]);
  const [brands, setBrands] = useState<string[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [radius, setRadius] = useState(20);
  const [h24, setH24] = useState(false);
  const [noHwy, setNoHwy] = useState(false);
  const [hideAnom, setHideAnom] = useState(false);
  const [tripStart, setTripStart] = useState('Milano');
  const [tripEnd, setTripEnd] = useState('Roma');
  const [tripDist, setTripDist] = useState(575);
  const [tripKml, setTripKml] = useState(15);
  const [tripUnit, setTripUnit] = useState<'kml'|'l100'>('kml');
  const [tripCurrentFuel, setTripCurrentFuel] = useState<number | null>(null);
  const [tripToll, setTripToll] = useState(true);
  const [tankL, setTankL] = useState(50);
  const [tripRoute, setTripRoute] = useState<any>(null);
  const [tripStops, setTripStops] = useState<any[]>([]);
  const [tripNearby, setTripNearby] = useState<any[]>([]);
  const [tripStatus, setTripStatus] = useState('');
  const [tripStrat, setTripStrat] = useState<'balanced'|'save'|'fast'>('balanced');
  const [tripCalc, setTripCalc] = useState(false);
  const [fuelNews, setFuelNews] = useState<any[]>([]);
  const [cars, setCars] = useState<any[]>([]);
  const [selCar, setSelCar] = useState<any>(null);
  const [carQ, setCarQ] = useState('');
  const [apiKey, setApiKey] = useState(localStorage.getItem('martucc_fuel_api_key')||'');
  const [apiModel, setApiModel] = useState(localStorage.getItem('martucc_fuel_api_model')||'gemini-2.5-flash');
  const [aiErr, setAiErr] = useState<string|null>(null);
  const [userQ, setUserQ] = useState('');
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [direction, setDirection] = useState(0);
  const [showSplash, setShowSplash] = useState(true);
  const [mapZoom, setMapZoom] = useState(13);
  const [aiAnswer, setAiAnswer] = useState<{ question: string; answer: string; ts: number; source: 'ai' | 'local' } | null>(null);
  const [driveMode] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('drive')==='1') localStorage.setItem('mf_drive','on');
    if (p.get('drive')==='0') localStorage.setItem('mf_drive','off');
    return localStorage.getItem('mf_drive')==='on';
  });
  const initDone = useRef(false);
  const [showBottomNav, setShowBottomNav] = useState(true);
  const lastScrollY = useRef(0);

  const fuels: FuelType[] = ['Benzina', 'Diesel', 'GPL', 'Metano'];
  const allAverages = fuels.reduce((acc, f) => {
    const vp = stations.map(s => s.prices.find(p => p.type === f)?.price).filter(p => p && p > 0.5) as number[];
    if (vp.length === 0) {
      acc[f] = Infinity;
    } else {
      vp.sort((a, b) => a - b);
      const trim = Math.floor(vp.length * 0.15);
      const trimmed = vp.slice(trim, vp.length - trim || vp.length);
      acc[f] = (trimmed.reduce((a, b) => a + b, 0) / trimmed.length) || (vp.reduce((a, b) => a + b, 0) / vp.length);
    }
    return acc;
  }, {} as Record<FuelType, number>);

  const isPriceAnom = (s: FuelStation, f: FuelType) => {
    const p = s.prices.find(pp => pp.type === f)?.price || 0;
    const jsonKey = f.toLowerCase();
    const natAvg = nationalStats[jsonKey]?.avg;
    const avg = natAvg || allAverages[f];
    
    // An anomaly is a price <= 0, or < 93% of average, or < 0.5 EUR, or > 3.0 EUR, or > 15% above average
    if (p <= 0) return true;
    if (p < 0.5 || p > 3.0) return true;
    if (avg !== Infinity && (p < avg * 0.93 || p > avg * 1.15)) return true;
    return false;
  };

  const activeStations = useMemo(() => {
    return stations.filter(s => {
      const isBlocked = blockedIds.includes(s.id);
      const anom = isPriceAnom(s, fuel);
      return !isBlocked && !anom;
    });
  }, [stations, fuel, blockedIds, nationalStats]);

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => setShowSplash(false), 150);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (tab === 'map') {
      if (!showBottomNav) setShowBottomNav(true);
      return;
    }
    const currentScrollY = e.currentTarget.scrollTop;
    const diff = currentScrollY - lastScrollY.current;
    
    // ignore tiny scrolls to avoid flickering
    if (Math.abs(diff) < 8) return;
    
    if (currentScrollY > lastScrollY.current && currentScrollY > 60) {
      // Scrolling down - hide BottomNav
      setShowBottomNav(false);
    } else {
      // Scrolling up - show BottomNav
      setShowBottomNav(true);
    }
    lastScrollY.current = currentScrollY;
  };

  const handleTabChange = (newTab: TabType) => {
    const currentIndex = tabOrder.indexOf(tab);
    const newIndex = tabOrder.indexOf(newTab);
    setDirection(newIndex > currentIndex ? 1 : -1);
    setTab(newTab);
    setShowBottomNav(true); // Reset BottomNav visibility on tab change!
  };
  const fetchAnalysis = async (f: FuelType, force=false, q?: string, src: FuelStation[] = stations) => {
    const today = new Date().toISOString().split('T')[0];
    const hasKey = apiKey.trim().length > 0;
    const ck = `mf_analysis_${f}_${apiModel}_${hasKey ? 'ai' : 'local'}`;

    if (force && !q) localStorage.removeItem(ck);

    if (!force && !q) {
      const c = localStorage.getItem(ck);
      if (c) {
        const p = JSON.parse(c);
        if (p.date === today && p.analysis?.categories) {
          setMarketAnalyses(pr => ({ ...pr, [f]: { ...p.analysis, source: p.analysis.source || (hasKey ? 'ai' : 'local') } }));
          return;
        }
      }
    }

    setAnalysisLoading(true);
    let activeSrc = src;
    try {
      if (force && !q) {
        try {
          console.log('Force-refreshing stations from github raw before regenerating analysis...');
          const loc = userLoc || { lat: 45.4642, lng: 9.19 };
          const { stations: d, nationalStats: ns } = await getStations(loc);
          if (d && d.length > 0) {
            setStations(d);
            setNationalStats(ns);
            localStorage.setItem('mf_last_fetch_time', String(Date.now()));
            activeSrc = d;
          }
        } catch (e) {
          console.error('Failed to force-refresh stations during manual refresh:', e);
        }
      }

      const mStats = calculateMarketStats(activeSrc, f);
      const lCtx = `Media: €${mStats.average}, Minimo: €${mStats.min}, Spread: €${mStats.spread}`;

      let analysis: MarketAnalysis;
      if (!hasKey) {
        analysis = buildLocalMarketAnalysis(f, activeSrc, q);
        setAiErr(null);
      } else {
        // grounding: passa al modello la storia reale e le news fresche
        const fuelKey = f.toLowerCase();
        const history = await loadHistory();
        const recentHist = (history[fuelKey] || []).slice(-30).map(p => ({ date: p.date, price: p.avg }));
        analysis = await analyzeFuelMarket(apiKey, apiModel, f, q, lCtx, recentHist, fuelNews);
      }

      if (q) {
        // domanda one-off: rotta verso aiAnswer separato, non sovrascrivere analisi giornaliera
        const answerText = analysis.detailedReport?.trim() || analysis.reasoning?.trim() || 'Nessuna risposta disponibile.';
        setAiAnswer({ question: q, answer: answerText, ts: Date.now(), source: (hasKey ? 'ai' : 'local') });
        return;
      }

      const enriched = { ...analysis, source: (hasKey ? 'ai' : 'local') as any, generatedAt: new Date().toISOString() };
      setMarketAnalyses(pr => ({ ...pr, [f]: enriched }));
      localStorage.setItem(ck, JSON.stringify({ date: today, analysis: enriched }));
    } catch (e: any) {
      console.error('Analysis error:', e);
      if (q) {
        setAiAnswer({ question: q, answer: `Errore: ${e.message || 'AI non disponibile'}. Riprova tra qualche secondo.`, ts: Date.now(), source: hasKey ? 'ai' : 'local' });
      } else if (hasKey) {
        // API key configurata: NON fare fallback locale. Mostra errore e lascia che l'utente ritenti.
        setAiErr(e.message === 'MISSING_KEY' ? null : 'Gemini non disponibile. Riprova oppure controlla la API key.');
      } else {
        // No API key: usa l'analisi locale come prima
        const fallback = buildLocalMarketAnalysis(f, activeSrc, q);
        setMarketAnalyses(pr => ({ ...pr, [f]: { ...fallback, source: 'local' } }));
        setAiErr(null);
      }
    } finally {
      setAnalysisLoading(false);
    }
  };

  useEffect(() => { driveMode ? document.documentElement.dataset.drive='on' : delete document.documentElement.dataset.drive; }, [driveMode]);
  useEffect(() => { if (!userLoc || !initDone.current) return; fetchAnalysis(fuel, false, undefined, stations); }, [fuel, userLoc]);

  useEffect(() => {
    (async () => { try { const [nR, cR] = await Promise.all([fetch('news.json').then(r=>r.ok?r.json():[]).catch(()=>[]), fetch('cars.json').then(r=>r.json()).catch(()=>[])]); setFuelNews(normalizeFuelNews(nR)); const cd = Array.isArray(cR)?cR:[]; setCars(cd); const sid = localStorage.getItem('mf_car'); if (sid && cd.length) { const c = cd.find((x:any)=>x.model===sid); if (c) { setSelCar(c); if(c.liters) setTankL(c.liters); if(c.kml) setTripKml(c.kml); } } } catch {} })();
    const load = async (loc:{lat:number;lng:number}) => { 
      setLoading(true); 
      setAiErr(null); 
      try { 
        const {stations: d, nationalStats: ns} = await getStations(loc); 
        setStations(d); 
        setNationalStats(ns); 
        // Set loading false as soon as stations are ready to show UI quickly
        setLoading(false);
        initDone.current=true;
        
        // Fire off analysis in the background
        const fuels: FuelType[]=['Benzina','Diesel','GPL','Metano']; 
        Promise.all(fuels.map(f=>fetchAnalysis(f, false, undefined, d))); 
      } catch {
        setLoading(false);
        initDone.current=true;
      }
    };
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(p => { const l={lat:p.coords.latitude,lng:p.coords.longitude}; setUserLoc(l); load(l); }, () => { const l={lat:45.4642,lng:9.19}; setUserLoc(l); load(l); }, {enableHighAccuracy:true,timeout:10000});
    } else { const l={lat:45.4642,lng:9.19}; setUserLoc(l); load(l); }
    
    // Prompt per permessi notifiche all'avvio se non ancora impostato
    (async () => {
      try {
        const currentPerm = permissionState();
        if (currentPerm === 'default') {
          const res = await requestPermission();
          if (res === 'granted') {
            const currentPrefs = loadPrefs();
            currentPrefs.enabled = true;
            savePrefs(currentPrefs);
          }
        }
      } catch (err) {
        console.error('Error requesting startup notification permission:', err);
      }
    })();

    const sf = localStorage.getItem('mf_favs'); if (sf) setFavs(JSON.parse(sf));
    const sb = localStorage.getItem('mf_blocked'); if (sb) setBlockedIds(JSON.parse(sb));
    const sa = localStorage.getItem('mf_alerts'); if (sa) setAlerts(JSON.parse(sa));
  }, []);

  // Auto-refresh prices periodically and on resume/foreground
  useEffect(() => {
    const checkAndRefresh = async () => {
      if (!initDone.current || !userLoc) return;
      const lastFetch = localStorage.getItem('mf_last_fetch_time');
      const now = Date.now();
      const sixHours = 6 * 60 * 60 * 1000;
      
      if (!lastFetch || (now - Number(lastFetch)) > sixHours) {
        console.log('Background auto-refreshing prices (6h elapsed)...');
        try {
          const { stations: d, nationalStats: ns } = await getStations(userLoc);
          if (d && d.length > 0) {
            setStations(d);
            setNationalStats(ns);
            localStorage.setItem('mf_last_fetch_time', String(Date.now()));
            // Silently fetch analysis for current fuel
            fetchAnalysis(fuel, true, undefined, d);
          }
        } catch (e) {
          console.error('Background auto-refresh failed:', e);
        }
      }
    };

    // On resume (foreground visibility)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkAndRefresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    // Also check every 5 minutes in case the app is kept open
    const interval = setInterval(checkAndRefresh, 5 * 60 * 1000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [userLoc, fuel]);

  useEffect(() => { localStorage.setItem('mf_favs', JSON.stringify(favs)); }, [favs]);
  useEffect(() => { localStorage.setItem('mf_blocked', JSON.stringify(blockedIds)); }, [blockedIds]);
  useEffect(() => { localStorage.setItem('mf_alerts', JSON.stringify(alerts)); }, [alerts]);

  useEffect(() => {
    if (!stations.length) return;
    recordObservation(stations);
    checkPriceThresholds(alerts, stations);
  }, [stations, alerts]);

  useEffect(() => {
    if (!stations.length) return;
    updateWidgetData(activeStations, fuel, userLoc);
  }, [activeStations, fuel, userLoc]);

  useEffect(() => {
    const a = marketAnalyses[fuel];
    if (!a) return;
    checkDailyTrend(fuel, a);
  }, [marketAnalyses, fuel]);

  useEffect(() => {
    if (!stations.length) return;
    const allPrices = stations.flatMap(s => s.prices.filter(p => p.type === fuel).map(p => p.price)).filter(p => p > 0);
    if (!allPrices.length) return;
    const avg = allPrices.reduce((a, b) => a + b, 0) / allPrices.length;
    checkBestDeal(fuel, stations, avg);
  }, [stations, fuel]);

  useEffect(() => {
    if (!selCar) return;
    checkPienoReminder(selCar.model, selCar.kml, selCar.liters);
    checkDeadlines(selCar.model);
    checkBudget(selCar.model);
  }, [selCar]);

  const handleMapMove = async (c:{lat:number;lng:number}) => { const {stations: d, nationalStats: ns} = await getStations(c); setStations(d); setNationalStats(ns); if (!apiKey.trim()) setMarketAnalyses(pr=>({...pr, [fuel]: buildLocalMarketAnalysis(fuel, d)})); };
  const toggleFav = (id:string) => setFavs(p => p.includes(id) ? p.filter(f=>f!==id) : [...p,id]);
  const blockStation = (s: FuelStation) => {
    const choice = confirm(`Cosa vuoi fare per "${s.city || s.name}"?\n\n[OK] Nascondi solo per me\n[ANNULLA] Segnala alla Community (per tutti)`);
    setBlockedIds(prev => prev.includes(s.id) ? prev : [...prev, s.id]);
    if (!choice) {
      const body = encodeURIComponent(`ID Stazione: ${s.id}\nNome: ${s.name}\nCittà: ${s.city}\nIndirizzo: ${s.address}\n\nMotivo: Segnalata come CHIUSA o ERRATA dal proprietario.`);
      window.open(`https://github.com/martucc/Fuel-Now/issues/new?title=%5BBLOCCHIAMO%5D+Stazione+${s.id}&body=${body}`, '_blank');
    }
  };
  const handleSelectCar = (car:any) => { setSelCar(car); if(car.liters) setTankL(car.liters); if(car.kml) setTripKml(car.kml); localStorage.setItem('mf_car', car.model); };

  const geocode = async (q:string) => { const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&countrycodes=it&accept-language=it`); const d = await r.json(); if (!d.length) throw new Error(`Non trovato: ${q}`); return {lat:parseFloat(d[0].lat),lng:parseFloat(d[0].lon),label:d[0].display_name}; };
  const calcTrip = async () => {
    if (!tripStart||!tripEnd) { setTripStatus('Inserisci partenza e arrivo'); return; }
    setTripStatus('Calcolo percorso...');
    try {
      const s = await geocode(tripStart), e = await geocode(tripEnd);
      const rr = await fetch(`https://router.project-osrm.org/route/v1/driving/${s.lng},${s.lat};${e.lng},${e.lat}?overview=full&geometries=geojson`);
      const rd = await rr.json(); if (!rd.routes?.length) throw new Error('Percorso non trovato');
      const coords: [number, number][] = rd.routes[0].geometry.coordinates; // [lng, lat]
      const route = {distanceKm:rd.routes[0].distance/1000, durationMin:rd.routes[0].duration/60, coords, start:s, end:e};
      setTripRoute(route); setTripDist(Math.round(route.distanceKm)); setTripStatus('');

      const kpl = tripUnit==='kml' ? tripKml : 100/tripKml;
      const fullRange = tankL * kpl * 0.8;
      const startLiters = tripCurrentFuel == null ? tankL : Math.max(0, Math.min(tankL, tripCurrentFuel));
      const initRange = Math.max(startLiters * kpl * 0.8, 5);
      const remaining = route.distanceKm - initRange;
      const nStops = remaining > 0 ? Math.ceil(remaining / fullRange) : 0;
      const pRange = fullRange; // riusato sotto come step normale

      const stops: any[] = [];
      let enriched: { st: any; dist: number; progress: number; price: number }[] = [];
      if (activeStations.length > 0) {
        // Haversine raw (no rounding)
        const hav = (lat1: number, lng1: number, lat2: number, lng2: number) => {
          const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180;
          const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
          return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        };

        // Sample percorso (max ~200 punti) con progresso cumulato
        const stride = Math.max(1, Math.floor(coords.length / 200));
        const samples: { lat: number; lng: number; progressKm: number }[] = [];
        let acc = 0, lastLat = coords[0][1], lastLng = coords[0][0];
        samples.push({ lat: lastLat, lng: lastLng, progressKm: 0 });
        for (let i = 1; i < coords.length; i++) {
          const [lng, lat] = coords[i];
          acc += hav(lastLat, lastLng, lat, lng);
          lastLat = lat; lastLng = lng;
          if (i % stride === 0) samples.push({ lat, lng, progressKm: acc });
        }

        // Bounding box (con padding) per filtro veloce
        let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
        for (const sm of samples) {
          if (sm.lat < minLat) minLat = sm.lat;
          if (sm.lat > maxLat) maxLat = sm.lat;
          if (sm.lng < minLng) minLng = sm.lng;
          if (sm.lng > maxLng) maxLng = sm.lng;
        }
        const pad = 0.1; // ~10km
        minLat -= pad; maxLat += pad; minLng -= pad; maxLng += pad;

        // Per ogni stazione nel BB, calcola distFromRoute + progressKm
        for (const st of activeStations) {
          const lat = st.location.lat, lng = st.location.lng;
          if (lat < minLat || lat > maxLat || lng < minLng || lng > maxLng) continue;
          const pr = st.prices.find(pp => pp.type === fuel)?.price || 0;
          if (pr <= 0) continue;
          let bestD = Infinity, bestProg = 0;
          for (const sm of samples) {
            const d = hav(sm.lat, sm.lng, lat, lng);
            if (d < bestD) { bestD = d; bestProg = sm.progressKm; }
          }
          if (bestD > 3) continue; // max 3km dal tragitto
          enriched.push({ st, dist: bestD, progress: bestProg, price: pr });
        }
      }

      if (nStops > 0 && enriched.length > 0) {
        // Pesi per strategia
        const w = tripStrat === 'save'
          ? { price: 8, detour: 1.2, off: 0.5 }
          : tripStrat === 'fast'
          ? { price: 1.2, detour: 4, off: 1.8 }
          : { price: 4, detour: 2.2, off: 0.9 }; // balanced

        const used = new Set<string>();
        for (let i = 1; i <= nStops; i++) {
          const tgt = Math.min(initRange + pRange * (i - 1), route.distanceKm - 30);
          const tgtMin = tgt - pRange * 0.35;
          const tgtMax = tgt + pRange * 0.15;

          let pool = enriched.filter(x => !used.has(x.st.id) && x.progress >= tgtMin && x.progress <= tgtMax);
          if (pool.length === 0) pool = enriched.filter(x => !used.has(x.st.id));
          if (pool.length === 0) break;

          pool.sort((a, b) =>
            (a.price * w.price + a.dist * w.detour + Math.abs(a.progress - tgt)/Math.max(pRange,1) * w.off) -
            (b.price * w.price + b.dist * w.detour + Math.abs(b.progress - tgt)/Math.max(pRange,1) * w.off)
          );
          const pick = pool[0];
          used.add(pick.st.id);
          stops.push({ ...pick.st, routeProgressKm: pick.progress, routeDetourKm: pick.dist });
        }
      }
      setTripStops(stops.sort((a, b) => a.routeProgressKm - b.routeProgressKm));

      const nearbyArr = enriched
        .map(x => ({ ...x.st, routeProgressKm: x.progress, routeDetourKm: x.dist }))
        .sort((a, b) => a.routeProgressKm - b.routeProgressKm);
      setTripNearby(nearbyArr);

      setTripCalc(true);
    } catch (e:any) { setTripStatus(e.message); }
  };



  const avgP = allAverages[fuel];
  
  const filtered = stations.filter(s => {
    const cp = s.prices.find(p => p.type === fuel)?.price || 0;
    const brandMatch = brands.length === 0 || brands.includes(s.brand);
    const serviceMatch = services.length === 0 || services.every(sv => s.services.includes(sv));
    const distMatch = s.distance === undefined || s.distance <= radius;
    const h24Match = !h24 || s.services.includes('H24');
    const hwyMatch = !noHwy || !s.services.includes('Autostrada');
    const isBlocked = blockedIds.includes(s.id);
    const anomMatch = !isPriceAnom(s, fuel);
    
    return cp > 0 && !isBlocked && brandMatch && serviceMatch && distMatch && h24Match && hwyMatch && anomMatch;
  }).sort((a, b) => (a.prices.find(p => p.type === fuel)?.price || Infinity) - (b.prices.find(p => p.type === fuel)?.price || Infinity));

  const validPrices = filtered
    .filter(s => !isPriceAnom(s, fuel))
    .map(s => s.prices.find(p => p.type === fuel)?.price || Infinity)
    .filter(p => p !== Infinity);
  const cheapP = validPrices.length > 0 ? Math.min(...validPrices) : Infinity;
  const mStats = calculateMarketStats(filtered, fuel);
  const marketRef = marketAnalyses[fuel] || null;
  const isLocal = marketRef?.source !== 'ai';
  const tTone = marketRef?.trend==='DOWN' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : marketRef?.trend==='UP' ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-blue-400 bg-blue-500/10 border-blue-500/20';
  const allBrands = [...new Set(stations.map(s=>s.brand))].filter(Boolean).sort();
  // Declutter mappa: meno zoom -> meno marker, sempre i piu economici
  const zoomLimit = mapZoom >= 15 ? 250 : mapZoom >= 13 ? 80 : mapZoom >= 11 ? 25 : mapZoom >= 9 ? 8 : mapZoom >= 7 ? 4 : mapZoom >= 5 ? 2 : 1;
  const mapSt = filtered.slice(0, zoomLimit);

  // @ts-ignore - tabs is intended for future menu expansions or logging
  const tabs: {id:TabType;icon:any;label:string}[] = [{id:'home',icon:Home,label:'Home'},{id:'map',icon:MapPin,label:'Mappa'},{id:'trip',icon:Route,label:'Trip'},{id:'veicolo',icon:Car,label:'Garage'},{id:'analysis',icon:BarChart3,label:'Intel'},{id:'pieno',icon:Target,label:'Pieno'}];

  return (
    <div className="min-h-screen bg-black text-[#f5f5f7] font-sans">
      <AnimatePresence>
        {showSplash && <SplashScreen key="splash" />}
      </AnimatePresence>
      {/* Header / Top Bar */}
      <header className="fixed top-0 left-0 right-0 z-[1000] bg-black/80 backdrop-blur-3xl px-6 pb-4 flex items-center justify-between border-b border-white/5 shadow-2xl" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}>
        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-1">
            <h1 className="text-xl font-black italic tracking-tighter text-white uppercase">
              Martucc<span className="text-blue-500">Fuel</span>
            </h1>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse ml-1" />
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <InstallPwaButton />
          <button
            onClick={() => setShowBudget(true)}
            className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-full border border-white/10 transition-all active:scale-95"
            aria-label="Calcolatore budget"
          >
            <Calculator size={18} className="text-[#8e8e93]" />
          </button>
          <button
            onClick={() => setTab('alerts')}
            className="relative w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-full border border-white/10 transition-all active:scale-95"
            aria-label="Allerte"
          >
            <Bell size={18} className={alerts.filter(a => a.active).length > 0 ? "text-blue-400" : "text-[#8e8e93]"} />
            {alerts.filter(a => a.active).length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-500 text-white text-[9px] font-black flex items-center justify-center shadow-[0_0_8px_rgba(59,130,246,0.6)] border border-black">
                {alerts.filter(a => a.active).length}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-full border border-white/10 transition-all active:scale-95"
          >
            <Settings size={20} className="text-[#8e8e93]" />
          </button>
        </div>
      </header>
 
      {/* Content Area */}
      <div className="min-h-screen overflow-y-auto no-scrollbar" onScroll={handleScroll} style={{ paddingTop: 'calc(env(safe-area-inset-top) + 80px)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 90px)' }}>
        <AnimatePresence mode="wait" custom={direction}>
          {tab === 'map' ? (
            <motion.div
              key="map"
              custom={direction}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="fixed inset-0 z-[10]"
              style={{ top: 'calc(env(safe-area-inset-top) + 80px)', bottom: 'calc(env(safe-area-inset-bottom) + 80px)' }}
            >
              <MapContainer center={[userLoc?.lat||45.4642,userLoc?.lng||9.19]} zoom={13} className="h-full w-full" zoomControl={false} scrollWheelZoom={true}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>' />
                <MapUpdater onMove={handleMapMove} onZoom={setMapZoom} />
                <CenterBtn loc={userLoc} />
                <HeatmapToggle active={heatmapOn} onToggle={() => setHeatmapOn(v => !v)} />
                {userLoc && (
                  <>
                    <Marker 
                      position={[userLoc.lat, userLoc.lng]} 
                      icon={L.divIcon({
                        className: 'user-location-div-icon',
                        html: '<div class="user-location-marker"><span></span></div>',
                        iconSize: [30, 30],
                        iconAnchor: [15, 15]
                      })}
                    >
                      <Popup>Base Operativa</Popup>
                    </Marker>
                  </>
                )}
                {heatmapOn && mapSt.map(s => {
                  const cp = s.prices.find(p => p.type === fuel)?.price || 0;
                  if (!cp || isPriceAnom(s, fuel)) return null;
                  const color = priceToHeatColor(cp, avgP === Infinity ? cp : avgP);
                  const radius = mapZoom >= 14 ? 250 : mapZoom >= 12 ? 500 : mapZoom >= 10 ? 1000 : 1800;
                  return (
                    <Circle
                      key={`heat-${s.id}`}
                      center={[s.location.lat, s.location.lng]}
                      radius={radius}
                      pathOptions={{ color, fillColor: color, fillOpacity: 0.32, opacity: 0.4, weight: 1 }}
                      eventHandlers={{ click: () => setStationDetail(s) }}
                    />
                  );
                })}
                {!heatmapOn && mapSt.map(s => {
                  const cp = s.prices.find(p => p.type === fuel)?.price || 0;
                  const best = cp === cheapP && cheapP !== Infinity;
                  const anom = isPriceAnom(s, fuel);
                  let bg = 'bg-[#1c1c1e]', bc = 'border-white/20', tc = 'text-white', gl = '', extra = ' ', arrowBorder = 'border-t-[#1c1c1e]';
                  
                  if (anom) {
                    bg = 'bg-black/60'; bc = 'border-gray-600/50'; tc = 'text-gray-500'; extra = 'grayscale opacity-60'; arrowBorder = 'border-t-black/60';
                  } else if (best) {
                    bg = 'bg-blue-600'; bc = 'border-blue-400'; tc = 'text-white'; gl = 'alpha-glow'; extra = 'scale-110 z-50'; arrowBorder = 'border-t-blue-600';
                  } else if (cp > 0 && avgP !== Infinity) {
                    if (cp > avgP + 0.015) {
                      bg = 'bg-red-500'; bc = 'border-red-400'; tc = 'text-white'; gl = 'shadow-[0_0_15px_rgba(239,68,68,0.6)]'; arrowBorder = 'border-t-red-500';
                    } else if (cp < avgP - 0.015) {
                      bg = 'bg-emerald-500'; bc = 'border-emerald-300'; tc = 'text-black'; gl = 'shadow-[0_0_15px_rgba(16,185,129,0.6)]'; arrowBorder = 'border-t-emerald-500';
                    } else {
                      bg = 'bg-amber-500'; bc = 'border-amber-300'; tc = 'text-black'; gl = 'shadow-[0_0_15px_rgba(245,158,11,0.6)]'; arrowBorder = 'border-t-amber-500';
                    }
                  }

                  const logo = getBrandLogo(s.brand || s.name || '');
                  const markerLogoHtml = `<div class="absolute -top-6 -right-3 w-8 h-8 rounded-full bg-black border border-white/20 flex items-center justify-center overflow-hidden shadow-lg z-[100] grayscale-0"><img src="${logo}" class="w-full h-full object-contain scale-[0.9]" /></div>`;

                  const htmlStr = `<div class="marker-pop flex flex-col items-center justify-center relative cursor-pointer ${extra}">${markerLogoHtml}<div class="px-2.5 py-1.5 rounded-[12px] border-2 ${bc} text-xs font-black tracking-tight ${gl} ${tc} ${bg} backdrop-blur-md whitespace-nowrap shadow-xl">€${cp.toFixed(3)}</div><div class="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-transparent ${arrowBorder} drop-shadow-md -mt-[2px]"></div></div>`;
                  
                  return (
                    <Marker
                      key={s.id}
                      position={[s.location.lat, s.location.lng]}
                      icon={L.divIcon({ className: 'custom-div-icon', html: htmlStr, iconSize: [60, 40], iconAnchor: [30, 40] })}
                      eventHandlers={{ click: () => setStationDetail(s) }}
                    />
                  );
                })}
              </MapContainer>
            </motion.div>
          ) : (
            <motion.div
              key={tab}
              custom={direction}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <main className="max-w-md mx-auto px-4 pt-4 relative overflow-hidden">
                {tab==='home' && <HomeTab stations={stations} filteredStations={filtered} selectedFuel={fuel} setSelectedFuel={setFuel} favorites={favs} toggleFavorite={toggleFav} marketRef={marketRef} loading={loading} cheapestPrice={cheapP} averagePrice={avgP} tankLiters={tankL} fuelNews={fuelNews} aiError={aiErr} setShowSettings={setShowSettings} setShowFilters={setShowFilters} selectedBrands={brands} selectedServices={services} setSelectedBrands={setBrands} setSelectedServices={setServices} setAlerts={setAlerts} selectedCar={selCar} analysisLoading={analysisLoading} fetchAnalysis={fetchAnalysis} isPriceAnom={isPriceAnom} radius={radius} setRadius={setRadius} hasApiKey={apiKey.trim().length > 0} onStationClick={setStationDetail}/>}
                {tab==='trip' && <TripTab tripStart={tripStart} setTripStart={setTripStart} tripEnd={tripEnd} setTripEnd={setTripEnd} tripKml={tripKml} setTripKml={setTripKml} tripUnit={tripUnit} setTripUnit={setTripUnit} tankLiters={tankL} setTankLiters={setTankL} tripStrategy={tripStrat} setTripStrategy={setTripStrat} tripStatus={tripStatus} tripDist={tripDist} tripCalculated={tripCalc} tripRoute={tripRoute} tripStops={tripStops} selectedFuel={fuel} cheapestPrice={cheapP} calculateTripRoute={calcTrip} userLoc={userLoc} stations={activeStations} tripCurrentFuel={tripCurrentFuel} setTripCurrentFuel={setTripCurrentFuel} tripToll={tripToll} setTripToll={setTripToll} tripNearby={tripNearby} onStationClick={setStationDetail}/>}
                {tab==='veicolo' && <VehicleTab cars={cars} selectedCar={selCar} setSelectedCar={setSelCar} carSearchQuery={carQ} setCarSearchQuery={setCarQ} handleSelectCar={handleSelectCar}/>}
                {tab==='analysis' && <AnalysisTab marketRef={marketRef} selectedFuel={fuel} setSelectedFuel={setFuel} filteredStations={filtered} marketStats={mStats} apiKey={apiKey} fuelNews={fuelNews} analysisLoading={analysisLoading} userQuestion={userQ} setUserQuestion={setUserQ} analysisIsLocal={isLocal} trendTone={tTone} fetchAnalysis={fetchAnalysis} setShowSettings={setShowSettings} tankLiters={tankL} aiAnswer={aiAnswer} clearAiAnswer={() => setAiAnswer(null)}/>}
                {tab==='alerts' && <AlertsTab selectedFuel={fuel} alerts={alerts} setAlerts={setAlerts}/>}
                {tab==='pieno' && <PienoTab selectedCar={selCar} setTab={setTab} stations={activeStations} selectedFuel={fuel} userLoc={userLoc}/>}
              </main>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tab Bar */}
      <BottomNav activeTab={tab} onTabChange={handleTabChange} visible={showBottomNav} />

      <FiltersModal show={showFilters} setShow={setShowFilters} selectedBrands={brands} setSelectedBrands={setBrands} selectedServices={services} setSelectedServices={setServices} h24={h24} setH24={setH24} noHighway={noHwy} setNoHighway={setNoHwy} hideAnomalies={hideAnom} setHideAnomalies={setHideAnom} radius={radius} setRadius={setRadius} brands={allBrands}/>
      <SettingsModal show={showSettings} setShow={setShowSettings} apiKey={apiKey} setApiKey={setApiKey} apiModel={apiModel} setApiModel={setApiModel}/>
      <BudgetCalcModal show={showBudget} onClose={() => setShowBudget(false)} fuel={fuel} defaultPrice={avgP === Infinity ? 0 : avgP} carKml={selCar?.kml} tankL={selCar?.liters || tankL}/>
      <StationHistoryModal station={stationDetail} fuel={fuel} onClose={() => setStationDetail(null)} onBlock={blockStation}/>
    </div>
  );
}

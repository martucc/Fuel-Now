import { useState, useEffect, useRef } from 'react';
import { MapPin, Bell, Settings, Home, BarChart3, Car, Target, Route, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { FuelStation, MarketAnalysis, FuelType, Alert } from './types';
import { getStations } from './services/dataService';
import { analyzeFuelMarket } from './services/geminiService';
import { buildLocalMarketAnalysis, calculateMarketStats } from './services/localAnalysis';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
// @ts-ignore
import markerIcon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

import { HomeTab } from './components/tabs/HomeTab';
import { TripTab } from './components/tabs/TripTab';
import { VehicleTab } from './components/tabs/VehicleTab';
import { AnalysisTab } from './components/tabs/AnalysisTab';
import { AlertsTab } from './components/tabs/AlertsTab';
import { FiltersModal } from './components/modals/FiltersModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { SplashScreen } from './components/SplashScreen';
import { BottomNav } from './components/BottomNav';
import { getBrandLogo } from './lib/brandLogos';

const DefaultIcon = L.icon({ iconUrl: markerIcon, shadowUrl: markerShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

type TabType = 'home'|'map'|'veicolo'|'analysis'|'alerts'|'trip';
const tabOrder: TabType[] = ['home', 'map', 'trip', 'veicolo', 'analysis', 'alerts'];

const pageVariants = {
  initial: (direction: number) => ({
    x: direction > 0 ? 30 : -30,
    opacity: 0,
  }),
  animate: {
    x: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 800, damping: 50 },
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -30 : 30,
    opacity: 0,
    transition: { duration: 0.05 },
  }),
};

function MapUpdater({ onMove }: { onMove: (c: { lat: number; lng: number }) => void }) {
  useMapEvents({ moveend: (e: any) => { const c = e.target.getCenter(); onMove({ lat: c.lat, lng: c.lng }); } });
  return null;
}
function CenterBtn({ loc }: { loc: { lat: number; lng: number } | null }) {
  const map = useMap();
  if (!loc) return null;
  return <button onClick={() => map.setView([loc.lat, loc.lng], 15)} className="absolute bottom-6 right-6 z-[500] p-4 bg-blue-600 text-white rounded-2xl shadow-xl active:scale-95 transition-all outline-none"><Target size={24} /></button>;
}

function normalizeFuelNews(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.events)) return raw.events.map((e: any) => ({ title: e.title || 'Aggiornamento', summary: e.summary || e.content || '', content: e.content || e.summary || '', impact: e.impact || 'neutral', source: e.source || 'Fuel Now', url: e.url || e.link, date: e.date || raw.generated_at }));
  return [];
}

function calcDist(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * 10) / 10;
}

export default function App() {
  const [tab, setTab] = useState<TabType>('home');
  const [userLoc, setUserLoc] = useState<{lat:number;lng:number}|null>(null);
  const [stations, setStations] = useState<FuelStation[]>([]);
  const [nationalStats, setNationalStats] = useState<any>({});
  const [marketAnalyses, setMarketAnalyses] = useState<Record<string, MarketAnalysis>>({});
  const [fuel, setFuel] = useState<FuelType>('Benzina');
  const [loading, setLoading] = useState(true);
  const [favs, setFavs] = useState<string[]>([]);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
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
  const [tankL, setTankL] = useState(50);
  const [tripRoute, setTripRoute] = useState<any>(null);
  const [tripStops, setTripStops] = useState<any[]>([]);
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
  const [driveMode] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('drive')==='1') localStorage.setItem('mf_drive','on');
    if (p.get('drive')==='0') localStorage.setItem('mf_drive','off');
    return localStorage.getItem('mf_drive')==='on';
  });
  const initDone = useRef(false);

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => setShowSplash(false), 150);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  const handleTabChange = (newTab: TabType) => {
    const currentIndex = tabOrder.indexOf(tab);
    const newIndex = tabOrder.indexOf(newTab);
    setDirection(newIndex > currentIndex ? 1 : -1);
    setTab(newTab);
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
    try {
      const mStats = calculateMarketStats(src, f);
      const lCtx = `Media: €${mStats.average}, Minimo: €${mStats.min}, Spread: €${mStats.spread}`;
      
      let analysis: MarketAnalysis;
      if (!hasKey) {
        analysis = buildLocalMarketAnalysis(f, src, q);
        setAiErr(null);
      } else {
        analysis = await analyzeFuelMarket(apiKey, apiModel, f, q, lCtx);
      }

      const enriched = { ...analysis, source: (hasKey ? 'ai' : 'local') as any, generatedAt: new Date().toISOString() };
      setMarketAnalyses(pr => ({ ...pr, [f]: enriched }));
      
      if (!q) {
        localStorage.setItem(ck, JSON.stringify({ date: today, analysis: enriched }));
      }
    } catch (e: any) {
      console.error('Analysis error:', e);
      const fallback = buildLocalMarketAnalysis(f, src, q);
      setMarketAnalyses(pr => ({ ...pr, [f]: { ...fallback, source: 'local' } }));
      setAiErr(hasKey && e.message !== 'MISSING_KEY' ? 'Gemini non disponibile: analisi locale attiva.' : null);
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
    const sf = localStorage.getItem('mf_favs'); if (sf) setFavs(JSON.parse(sf));
    const sb = localStorage.getItem('mf_blocked'); if (sb) setBlockedIds(JSON.parse(sb));
    const sa = localStorage.getItem('mf_alerts'); if (sa) setAlerts(JSON.parse(sa));
  }, []);

  useEffect(() => { localStorage.setItem('mf_favs', JSON.stringify(favs)); }, [favs]);
  useEffect(() => { localStorage.setItem('mf_blocked', JSON.stringify(blockedIds)); }, [blockedIds]);
  useEffect(() => { localStorage.setItem('mf_alerts', JSON.stringify(alerts)); }, [alerts]);

  const handleMapMove = async (c:{lat:number;lng:number}) => { const {stations: d, nationalStats: ns} = await getStations(c); setStations(d); setNationalStats(ns); if (!apiKey.trim()) setMarketAnalyses(pr=>({...pr, [fuel]: buildLocalMarketAnalysis(fuel, d)})); };
  const toggleFav = (id:string) => setFavs(p => p.includes(id) ? p.filter(f=>f!==id) : [...p,id]);
  const blockStation = (s: FuelStation) => {
    const choice = confirm(`Cosa vuoi fare per "${s.city || s.name}"?\n\n[OK] Nascondi solo per me\n[ANNULLA] Segnala alla Community (per tutti)`);
    if (choice) {
      setBlockedIds(prev => [...prev, s.id]);
    } else {
      const body = encodeURIComponent(`ID Stazione: ${s.id}\nNome: ${s.name}\nCittà: ${s.city}\nIndirizzo: ${s.address}\n\nMotivo: Segnalata come CHIUSA o ERRATA dal proprietario.`);
      window.open(`https://github.com/martucc/Fuel-Now/issues/new?title=%5BBLOCCHIAMO%5D+Stazione+${s.id}&body=${body}`, '_blank');
    }
  };
  const handleSelectCar = (car:any) => { setSelCar(car); if(car.liters) setTankL(car.liters); if(car.kml) setTripKml(car.kml); localStorage.setItem('mf_car', car.model); };

  const geocode = async (q:string) => { const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`); const d = await r.json(); if (!d.length) throw new Error(`Non trovato: ${q}`); return {lat:parseFloat(d[0].lat),lng:parseFloat(d[0].lon),label:d[0].display_name}; };
  const calcTrip = async () => {
    if (!tripStart||!tripEnd) { setTripStatus('Inserisci partenza e arrivo'); return; }
    setTripStatus('Calcolo percorso...');
    try {
      const s = await geocode(tripStart), e = await geocode(tripEnd);
      const rr = await fetch(`https://router.project-osrm.org/route/v1/driving/${s.lng},${s.lat};${e.lng},${e.lat}?overview=full&geometries=geojson`);
      const rd = await rr.json(); if (!rd.routes?.length) throw new Error('Percorso non trovato');
      const route = {distanceKm:rd.routes[0].distance/1000, durationMin:rd.routes[0].duration/60, coords:rd.routes[0].geometry.coordinates, start:s, end:e};
      setTripRoute(route); setTripDist(Math.round(route.distanceKm)); setTripStatus('');
      const kpl = tripUnit==='kml' ? tripKml : 100/tripKml;
      const pRange = tankL * kpl * 0.8;
      const nStops = Math.max(0, Math.ceil((route.distanceKm - pRange) / pRange));
      const stops: any[] = [];
      if (nStops > 0 && stations.length > 0) {
        for (let i = 1; i <= nStops; i++) {
          const tgt = Math.min(pRange*i, route.distanceKm-20);
          const cands = stations.map(st => {
            const dS = calcDist(s.lat,s.lng,st.location.lat,st.location.lng);
            const pr = st.prices.find(p=>p.type===fuel)?.price||1.8;
            return {station:st, score:pr+Math.abs(dS-tgt)/100, distToStart:dS};
          }).sort((a,b)=>a.score-b.score);
          if (cands[0]) stops.push({...cands[0].station, routeProgressKm:cands[0].distToStart});
        }
      }
      setTripStops(stops.sort((a,b)=>a.routeProgressKm-b.routeProgressKm));
      setTripCalc(true);
    } catch (e:any) { setTripStatus(e.message); }
  };

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
    
    // An anomaly is a price < 93% of average (national if available) or < 0.5 EUR
    return p > 0 && ((avg !== Infinity && p < avg * 0.93) || p < 0.5);
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
  const mapSt = filtered.slice(0,250);

  // @ts-ignore - tabs is intended for future menu expansions or logging
  const tabs: {id:TabType;icon:any;label:string}[] = [{id:'home',icon:Home,label:'Home'},{id:'map',icon:MapPin,label:'Mappa'},{id:'trip',icon:Route,label:'Trip'},{id:'veicolo',icon:Car,label:'Garage'},{id:'analysis',icon:BarChart3,label:'Intel'},{id:'alerts',icon:Bell,label:'Alert'}];

  return (
    <div className="min-h-screen bg-black text-[#f5f5f7] font-sans">
      <AnimatePresence>
        {showSplash && <SplashScreen key="splash" />}
      </AnimatePresence>
      {/* Header / Top Bar */}
      <header className="fixed top-0 left-0 right-0 z-[60] bg-black/80 backdrop-blur-3xl px-6 py-4 flex items-center justify-between border-b border-white/5 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-1">
            <h1 className="text-xl font-black italic tracking-tighter text-white uppercase">
              Martucc<span className="text-blue-500">Fuel</span>
            </h1>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse ml-1" />
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {selCar && (
            <button 
              onClick={() => setTab('veicolo')}
              className="flex items-center gap-2 px-4 py-1.5 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all active:scale-95"
            >
              <Car size={14} className="text-[#8e8e93]" />
              <span className="text-[11px] font-bold text-white uppercase tracking-wider">{selCar.model}</span>
            </button>
          )}
          <button 
            onClick={() => setShowSettings(true)} 
            className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-full border border-white/10 transition-all active:scale-95"
          >
            <Settings size={20} className="text-[#8e8e93]" />
          </button>
        </div>
      </header>

      {/* Content Area */}
      <div className="pt-[80px] pb-[90px] min-h-screen overflow-y-auto no-scrollbar">
        {/* Map Tab - Full area map */}
        {tab === 'map' && (
          <div className="fixed inset-0 top-[80px] bottom-[80px] z-[10]">
            <MapContainer center={[userLoc?.lat||45.4642,userLoc?.lng||9.19]} zoom={13} className="h-full w-full" zoomControl={false} scrollWheelZoom={true}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>' />
              <MapUpdater onMove={handleMapMove} />
              <CenterBtn loc={userLoc} />
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
              {mapSt.map(s => {
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
                  <Marker key={s.id} position={[s.location.lat, s.location.lng]} icon={L.divIcon({ className: 'custom-div-icon', html: htmlStr, iconSize: [60, 40], iconAnchor: [30, 40] })}>
                    <Popup>
                      <div className="p-3 min-w-[200px] flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-black border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0 grayscale-0 shadow-sm">
                            <img src={logo} alt={s.brand} className="w-full h-full object-contain scale-[0.9]" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-black text-[13px] text-black uppercase italic truncate leading-tight">{s.brand || s.name}</div>
                            <div className="text-[9px] text-gray-400 flex items-center gap-1 truncate"><MapPin size={9}/>{s.address}</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between mt-1 bg-blue-50 p-2 rounded-xl">
                          <div className="text-[10px] font-bold text-blue-900/50 uppercase tracking-widest">Prezzo</div>
                          <div className="text-xl font-black text-blue-600 tabular-nums">€{cp.toFixed(3)}</div>
                        </div>

                        {anom && <div className="text-[9px] text-red-600 font-black mt-0.5 uppercase tracking-widest flex items-center gap-1 bg-red-50 p-1.5 rounded-lg border border-red-100"><AlertTriangle size={10}/> Anomalia Rilevata</div>}
                        
                        <a href={`https://www.google.com/maps/dir/?api=1&destination=${s.location.lat},${s.location.lng}`} target="_blank" rel="noreferrer" className="block w-full py-2.5 bg-black text-white rounded-xl text-center text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-600 transition-all active:scale-95 shadow-lg mt-1">
                          Naviga Ora
                        </a>

                        <button 
                          onClick={() => blockStation(s)}
                          className="block w-full py-2 bg-red-50 text-red-600 rounded-lg text-center text-[8px] font-black uppercase tracking-wider hover:bg-red-100 transition-all border border-red-100 mt-1"
                        >
                          Segnala Chiuso / Errato
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
        )}

        {/* Other Tabs - Scrollable content */}
        {tab !== 'map' && (
          <main className="max-w-md mx-auto px-4 pt-4 relative overflow-hidden">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={tab}
                custom={direction}
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                {tab==='home' && <HomeTab stations={stations} filteredStations={filtered} selectedFuel={fuel} setSelectedFuel={setFuel} favorites={favs} toggleFavorite={toggleFav} marketRef={marketRef} loading={loading} cheapestPrice={cheapP} averagePrice={avgP} tankLiters={tankL} fuelNews={fuelNews} aiError={aiErr} setShowSettings={setShowSettings} setShowFilters={setShowFilters} selectedBrands={brands} selectedServices={services} setSelectedBrands={setBrands} setSelectedServices={setServices} setAlerts={setAlerts} selectedCar={selCar} analysisLoading={analysisLoading} fetchAnalysis={fetchAnalysis} isPriceAnom={isPriceAnom} radius={radius} setRadius={setRadius}/>}
                {tab==='trip' && <TripTab tripStart={tripStart} setTripStart={setTripStart} tripEnd={tripEnd} setTripEnd={setTripEnd} tripKml={tripKml} setTripKml={setTripKml} tripUnit={tripUnit} setTripUnit={setTripUnit} tankLiters={tankL} setTankLiters={setTankL} tripStrategy={tripStrat} setTripStrategy={setTripStrat} tripStatus={tripStatus} tripDist={tripDist} tripCalculated={tripCalc} tripRoute={tripRoute} tripStops={tripStops} selectedFuel={fuel} cheapestPrice={cheapP} calculateTripRoute={calcTrip}/>}
                {tab==='veicolo' && <VehicleTab cars={cars} selectedCar={selCar} setSelectedCar={setSelCar} carSearchQuery={carQ} setCarSearchQuery={setCarQ} handleSelectCar={handleSelectCar}/>}
                {tab==='analysis' && <AnalysisTab marketRef={marketRef} selectedFuel={fuel} filteredStations={filtered} marketStats={mStats} apiKey={apiKey} fuelNews={fuelNews} analysisLoading={analysisLoading} userQuestion={userQ} setUserQuestion={setUserQ} analysisIsLocal={isLocal} trendTone={tTone} fetchAnalysis={fetchAnalysis} setShowSettings={setShowSettings}/>}
                {tab==='alerts' && <AlertsTab selectedFuel={fuel} alerts={alerts} setAlerts={setAlerts}/>}
              </motion.div>
            </AnimatePresence>
          </main>
        )}
      </div>

      {/* Tab Bar */}
      <BottomNav activeTab={tab} onTabChange={handleTabChange} />

      <FiltersModal show={showFilters} setShow={setShowFilters} selectedBrands={brands} setSelectedBrands={setBrands} selectedServices={services} setSelectedServices={setServices} h24={h24} setH24={setH24} noHighway={noHwy} setNoHighway={setNoHwy} hideAnomalies={hideAnom} setHideAnomalies={setHideAnom} radius={radius} setRadius={setRadius} brands={allBrands}/>
      <SettingsModal show={showSettings} setShow={setShowSettings} apiKey={apiKey} setApiKey={setApiKey} apiModel={apiModel} setApiModel={setApiModel}/>
    </div>
  );
}

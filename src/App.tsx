import React, { useState, useEffect, useRef } from 'react';
import { Fuel, MapPin, Bell, Settings, X, Home, BarChart3, Car, Target, RefreshCw, Route, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import type { FuelStation, MarketAnalysis, FuelType, Alert } from './types';
import { getStations } from './services/dataService';
import { analyzeFuelMarket } from './services/geminiService';
import { buildLocalMarketAnalysis, calculateMarketStats } from './services/localAnalysis';
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
import { AnalysisTab } from './components/tabs/AnalysisTab';
import { AlertsTab } from './components/tabs/AlertsTab';
import { FiltersModal } from './components/modals/FiltersModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { FuelTypeSelector } from './components/FuelTypeSelector';

const DefaultIcon = L.icon({ iconUrl: markerIcon, shadowUrl: markerShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

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
  type Tab = 'home'|'map'|'veicolo'|'analysis'|'alerts'|'trip';
  const [tab, setTab] = useState<Tab>('home');
  const [userLoc, setUserLoc] = useState<{lat:number;lng:number}|null>(null);
  const [stations, setStations] = useState<FuelStation[]>([]);
  const [marketAnalyses, setMarketAnalyses] = useState<Record<string, MarketAnalysis>>({});
  const [fuel, setFuel] = useState<FuelType>('Benzina');
  const [loading, setLoading] = useState(true);
  const [favs, setFavs] = useState<string[]>([]);
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
  const [driveMode, setDriveMode] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('drive')==='1') localStorage.setItem('mf_drive','on');
    if (p.get('drive')==='0') localStorage.setItem('mf_drive','off');
    return localStorage.getItem('mf_drive')==='on';
  });
  const initDone = useRef(false);

  const fetchAnalysis = async (f: FuelType, force=false, q?: string, src: FuelStation[] = stations) => {
    const today = new Date().toISOString().split('T')[0];
    const hasKey = apiKey.trim().length > 0;
    const ck = `mf_analysis_${f}_${apiModel}`;
    if (force && !q) localStorage.removeItem(ck);
    if (hasKey && !force && !q) { const c = localStorage.getItem(ck); if (c) { const p = JSON.parse(c); if (p.date===today && p.analysis?.categories) { setMarketAnalyses(pr=>({...pr, [f]: {...p.analysis, source: p.analysis.source||'ai'}})); return; } } }
    setAnalysisLoading(true);
    try {
      const mStats = calculateMarketStats(src, f);
      const lCtx = `Media: €${mStats.average}, Minimo: €${mStats.min}, Spread: €${mStats.spread}`;
      if (!hasKey) { setMarketAnalyses(pr=>({...pr, [f]: buildLocalMarketAnalysis(f, src, q)})); setAiErr(null); return; }
      const a = await analyzeFuelMarket(apiKey, apiModel, f, q, lCtx);
      const enriched = {...a, source:'ai', generatedAt: new Date().toISOString()};
      setMarketAnalyses(pr=>({...pr, [f]: enriched}));
      if (!q) localStorage.setItem(ck, JSON.stringify({date:today, analysis:enriched}));
    } catch (e: any) {
      setMarketAnalyses(pr=>({...pr, [f]: buildLocalMarketAnalysis(f, src, q)}));
      setAiErr(e.message==='MISSING_KEY' ? null : 'Gemini non disponibile: analisi locale attiva.');
    } finally { setAnalysisLoading(false); }
  };

  useEffect(() => { driveMode ? document.documentElement.dataset.drive='on' : delete document.documentElement.dataset.drive; }, [driveMode]);
  useEffect(() => { if (!userLoc || !initDone.current) return; fetchAnalysis(fuel, false, undefined, stations); }, [fuel, userLoc]);

  useEffect(() => {
    (async () => { try { const [nR, cR] = await Promise.all([fetch('/news.json').then(r=>r.ok?r.json():[]).catch(()=>[]), fetch('/cars.json').then(r=>r.json()).catch(()=>[])]); setFuelNews(normalizeFuelNews(nR)); const cd = Array.isArray(cR)?cR:[]; setCars(cd); const sid = localStorage.getItem('mf_car'); if (sid && cd.length) { const c = cd.find((x:any)=>x.model===sid); if (c) { setSelCar(c); if(c.liters) setTankL(c.liters); if(c.kml) setTripKml(c.kml); } } } catch {} })();
    const load = async (loc:{lat:number;lng:number}) => { setLoading(true); setAiErr(null); try { const d = await getStations(loc); setStations(d); const fuels: FuelType[]=['Benzina','Diesel','GPL','Metano']; await Promise.all(fuels.map(f=>fetchAnalysis(f, false, undefined, d))); } catch {} finally { initDone.current=true; setLoading(false); } };
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(p => { const l={lat:p.coords.latitude,lng:p.coords.longitude}; setUserLoc(l); load(l); }, () => { const l={lat:45.4642,lng:9.19}; setUserLoc(l); load(l); }, {enableHighAccuracy:true,timeout:10000});
    } else { const l={lat:45.4642,lng:9.19}; setUserLoc(l); load(l); }
    const sf = localStorage.getItem('mf_favs'); if (sf) setFavs(JSON.parse(sf));
    const sa = localStorage.getItem('mf_alerts'); if (sa) setAlerts(JSON.parse(sa));
  }, []);

  useEffect(() => { localStorage.setItem('mf_favs', JSON.stringify(favs)); }, [favs]);
  useEffect(() => { localStorage.setItem('mf_alerts', JSON.stringify(alerts)); }, [alerts]);

  const handleMapMove = async (c:{lat:number;lng:number}) => { const d = await getStations(c); setStations(d); if (!apiKey.trim()) setMarketAnalyses(pr=>({...pr, [fuel]: buildLocalMarketAnalysis(fuel, d)})); };
  const toggleFav = (id:string) => setFavs(p => p.includes(id) ? p.filter(f=>f!==id) : [...p,id]);
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

  const vp = stations.map(s=>s.prices.find(p=>p.type===fuel)?.price).filter(p=>p&&p>0) as number[];
  const avgP = vp.length>0 ? vp.reduce((a,b)=>a+b,0)/vp.length : Infinity;
  const isAnom = (p: number) => p > 0 && avgP !== Infinity && p < avgP * 0.91;
  const filtered = stations.filter(s => {
    const cp = s.prices.find(p=>p.type===fuel)?.price||0;
    const anom = isAnom(cp);
    return s.prices.some(p=>p.type===fuel) && (brands.length===0||brands.includes(s.brand)) && (services.length===0||services.every(sv=>s.services.includes(sv))) && (s.distance===undefined||s.distance<=radius) && (!h24||s.services.includes('H24')) && (!noHwy||!s.services.includes('Autostrada')) && (!hideAnom||!anom);
  }).sort((a,b)=>(a.prices.find(p=>p.type===fuel)?.price||Infinity)-(b.prices.find(p=>p.type===fuel)?.price||Infinity));
  const validPrices = filtered.map(s=>s.prices.find(p=>p.type===fuel)?.price||Infinity).filter(p=>p!==Infinity && !isAnom(p));
  const cheapP = validPrices.length>0 ? Math.min(...validPrices) : Infinity;
  const mStats = calculateMarketStats(filtered, fuel);
  const marketRef = marketAnalyses[fuel] || null;
  const isLocal = marketRef?.source !== 'ai';
  const tTone = marketRef?.trend==='DOWN' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : marketRef?.trend==='UP' ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-blue-400 bg-blue-500/10 border-blue-500/20';
  const allBrands = [...new Set(stations.map(s=>s.brand))].filter(Boolean).sort();
  const mapSt = filtered.slice(0,250);

  const tabs: {id:Tab;icon:any;label:string}[] = [{id:'home',icon:Home,label:'Home'},{id:'map',icon:MapPin,label:'Mappa'},{id:'trip',icon:Route,label:'Trip'},{id:'veicolo',icon:Car,label:'Garage'},{id:'analysis',icon:BarChart3,label:'Intel'},{id:'alerts',icon:Bell,label:'Alert'}];

  return (
    <div className="min-h-screen bg-black text-[#f5f5f7] font-sans">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-[60] bg-black/90 backdrop-blur-2xl px-6 py-5 flex items-center justify-between border-b border-white/10 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-[0_8px_30px_rgba(37,99,235,0.4)] border border-blue-400/20"><Fuel size={24}/></div>
          <div><h1 className="text-2xl font-black italic tracking-tighter text-white uppercase leading-none">Martucc<span className="text-blue-500">Fuel</span></h1><div className="flex items-center gap-2 mt-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/><p className="text-[9px] text-[#8e8e93] uppercase font-black tracking-[0.2em] italic">{userLoc?"Signal Active":"Scanning..."}</p></div></div>
        </div>
        <div className="flex items-center gap-4">
          {loading && <motion.div animate={{rotate:360}} transition={{repeat:Infinity,duration:1.5,ease:"linear"}} className="text-blue-500"><RefreshCw size={18}/></motion.div>}
          <button onClick={() => { setDriveMode(d => { const n=!d; localStorage.setItem('mf_drive',n?'on':'off'); return n; }); }} className={cn("w-10 h-10 flex items-center justify-center rounded-xl transition-all border", driveMode?"bg-blue-600 text-white border-blue-400 shadow-xl":"bg-white/5 text-[#8e8e93] border-white/5")}><Car size={20}/></button>
          <button onClick={()=>setShowSettings(true)} className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl border border-white/5"><Settings size={20} className="text-[#8e8e93]"/></button>
        </div>
      </header>

      {/* Content Area */}
      <div className="pt-[100px] pb-[90px] min-h-screen overflow-y-auto no-scrollbar">
        {/* Map Tab - Full area map */}
        {tab === 'map' && (
          <div className="fixed inset-0 top-[100px] bottom-[80px] z-[10]">
            <MapContainer center={[userLoc?.lat||45.4642,userLoc?.lng||9.19]} zoom={13} className="h-full w-full grayscale-[0.8] contrast-[1.2]" zoomControl={false}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>' />
              <MapUpdater onMove={handleMapMove} />
              <CenterBtn loc={userLoc} />
              {userLoc && (<><Marker position={[userLoc.lat,userLoc.lng]} icon={L.divIcon({className:'user-location-div-icon',html:'<div class="user-location-marker"><span></span></div>',iconSize:[30,30],iconAnchor:[15,15]})}><Popup>Base Operativa</Popup></Marker>{/* @ts-ignore */}<Circle center={[userLoc.lat,userLoc.lng]} radius={radius*1000} pathOptions={{color:'#3b82f6',weight:1,fillColor:'#3b82f6',fillOpacity:0.03,dashArray:'5,5'}} /></>)}
              {mapSt.map(s => {
                const cp=s.prices.find(p=>p.type===fuel)?.price||0; const best=cp===cheapP&&cheapP!==Infinity; const anom=isAnom(cp);
                let bg='bg-[#1c1c1e]', bc='border-white/20', tc='text-white', gl='', extra=' ';
                if (anom) {
                  bg='bg-black/60'; bc='border-gray-600/50'; tc='text-gray-500'; extra='line-through grayscale opacity-60';
                } else if (best) {
                  bg='bg-blue-600'; bc='border-blue-400'; tc='text-white'; gl='shadow-[0_0_20px_rgba(59,130,246,0.9)]'; extra='scale-110 z-50';
                } else if (cp > 0 && avgP !== Infinity) {
                  if (cp > avgP + 0.015) {
                    bg='bg-red-500'; bc='border-red-400'; tc='text-white'; gl='shadow-[0_0_15px_rgba(239,68,68,0.6)]';
                  } else if (cp < avgP - 0.015) {
                    bg='bg-emerald-500'; bc='border-emerald-300'; tc='text-black'; gl='shadow-[0_0_15px_rgba(16,185,129,0.6)]';
                  } else {
                    bg='bg-amber-500'; bc='border-amber-300'; tc='text-black'; gl='shadow-[0_0_15px_rgba(245,158,11,0.6)]';
                  }
                }
                return <Marker key={s.id} position={[s.location.lat,s.location.lng]} icon={L.divIcon({className:'custom-div-icon',html:`<div class="px-3 py-1.5 rounded-2xl border-2 ${bc} text-[11px] font-black tracking-tight ${gl} ${tc} ${bg} backdrop-blur-md whitespace-nowrap hover:scale-125 transition-all ${extra}">€${cp.toFixed(3)}</div>`,iconSize:[60,24],iconAnchor:[30,12]})}><Popup><div className="p-2 min-w-[180px]"><div className="font-black text-sm text-black uppercase italic">{s.brand}</div><div className="text-[10px] text-gray-400 flex items-center gap-1"><MapPin size={10}/>{s.address}</div><div className="text-2xl font-black text-blue-600 mt-1">€{cp.toFixed(3)}</div>{anom&&<div className="text-[10px] text-red-600 font-black mt-1 uppercase tracking-wider">⚠ Potrebbe essere chiuso</div>}<a href={`https://www.google.com/maps/dir/?api=1&destination=${s.location.lat},${s.location.lng}`} target="_blank" rel="noreferrer" className="block w-full mt-2 py-2 bg-black text-white rounded-xl text-center text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 transition-colors">Naviga</a></div></Popup></Marker>;
              })}
            </MapContainer>
          </div>
        )}

        {/* Other Tabs - Scrollable content */}
        {tab !== 'map' && (
          <main className="max-w-md mx-auto px-4 pt-4">
            <AnimatePresence mode="wait">
              {tab==='home' && <HomeTab stations={stations} filteredStations={filtered} selectedFuel={fuel} setSelectedFuel={setFuel} favorites={favs} toggleFavorite={toggleFav} marketRef={marketRef} loading={loading} cheapestPrice={cheapP} averagePrice={avgP} tankLiters={tankL} fuelNews={fuelNews} aiError={aiErr} setShowSettings={setShowSettings} setShowFilters={setShowFilters} selectedBrands={brands} selectedServices={services} setSelectedBrands={setBrands} setSelectedServices={setServices} setAlerts={setAlerts} selectedCar={selCar}/>}
              {tab==='trip' && <TripTab tripStart={tripStart} setTripStart={setTripStart} tripEnd={tripEnd} setTripEnd={setTripEnd} tripKml={tripKml} setTripKml={setTripKml} tripUnit={tripUnit} setTripUnit={setTripUnit} tankLiters={tankL} setTankLiters={setTankL} tripStrategy={tripStrat} setTripStrategy={setTripStrat} tripStatus={tripStatus} tripDist={tripDist} tripCalculated={tripCalc} tripRoute={tripRoute} tripStops={tripStops} selectedFuel={fuel} cheapestPrice={cheapP} calculateTripRoute={calcTrip}/>}
              {tab==='veicolo' && <VehicleTab cars={cars} selectedCar={selCar} setSelectedCar={setSelCar} carSearchQuery={carQ} setCarSearchQuery={setCarQ} handleSelectCar={handleSelectCar}/>}
              {tab==='analysis' && <AnalysisTab marketRef={marketRef} selectedFuel={fuel} filteredStations={filtered} marketStats={mStats} apiKey={apiKey} fuelNews={fuelNews} analysisLoading={analysisLoading} userQuestion={userQ} setUserQuestion={setUserQ} analysisIsLocal={isLocal} trendTone={tTone} fetchAnalysis={fetchAnalysis} setShowSettings={setShowSettings}/>}
              {tab==='alerts' && <AlertsTab selectedFuel={fuel} alerts={alerts} setAlerts={setAlerts}/>}
            </AnimatePresence>
          </main>
        )}
      </div>

      {/* Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-[55] bg-black/90 backdrop-blur-2xl border-t border-white/5 px-2 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-md mx-auto flex items-center justify-around py-3">
          {tabs.map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)} className={cn("flex flex-col items-center gap-1 p-2 rounded-2xl transition-all min-w-[56px]", tab===t.id?"text-blue-500":"text-[#48484a] hover:text-white")}>
              <t.icon size={22} className={cn(tab===t.id&&"drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]")}/>
              <span className="text-[8px] font-black uppercase tracking-widest">{t.label}</span>
              {tab===t.id && <div className="w-1 h-1 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]"/>}
            </button>
          ))}
        </div>
      </nav>

      <FiltersModal show={showFilters} setShow={setShowFilters} selectedBrands={brands} setSelectedBrands={setBrands} selectedServices={services} setSelectedServices={setServices} h24={h24} setH24={setH24} noHighway={noHwy} setNoHighway={setNoHwy} hideAnomalies={hideAnom} setHideAnomalies={setHideAnom} radius={radius} setRadius={setRadius} brands={allBrands}/>
      <SettingsModal show={showSettings} setShow={setShowSettings} apiKey={apiKey} setApiKey={setApiKey} apiModel={apiModel} setApiModel={setApiModel}/>
    </div>
  );
}

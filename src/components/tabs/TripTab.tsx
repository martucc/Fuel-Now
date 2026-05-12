import { motion } from 'motion/react';
import { Route, Zap, Fuel } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { FuelType } from '../../types';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { getBrandLogo } from '../../lib/brandLogos';

interface Props {
  tripStart: string; setTripStart: (v: string) => void;
  tripEnd: string; setTripEnd: (v: string) => void;
  tripKml: number; setTripKml: (v: number) => void;
  tripUnit: 'kml'|'l100'; setTripUnit: (v: 'kml'|'l100') => void;
  tankLiters: number; setTankLiters: (v: number) => void;
  tripStrategy: string; setTripStrategy: (v: any) => void;
  tripStatus: string;
  tripDist: number;
  tripCalculated: boolean;
  tripRoute: any;
  tripStops: any[];
  selectedFuel: FuelType;
  cheapestPrice: number;
  calculateTripRoute: () => void;
}

export function TripTab(p: Props) {
  return (
    <motion.div key="trip" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6 pb-24">
      <header className="px-2 pt-2">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center border border-blue-400/30 shadow-[0_0_20px_rgba(37,99,235,0.3)]">
            <Route className="text-white" size={26} />
          </div>
          <div>
            <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-blue-400 mb-1">Mission Control</h2>
            <h3 className="text-4xl font-black tracking-tighter text-white uppercase italic leading-none">Route <span className="text-blue-500">Plan</span></h3>
          </div>
        </div>
      </header>

      <div className="bg-[#0a0f1d] p-8 rounded-[40px] border border-blue-500/30 space-y-8 shadow-[0_0_50px_rgba(37,99,235,0.15)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 blur-[100px] pointer-events-none rounded-full" />
        <div className="space-y-6 relative z-10">
          <div className="bg-black/40 backdrop-blur-xl rounded-[32px] p-6 border border-white/5 space-y-6 shadow-inner">
            <div className="space-y-1">
              <label className="text-[10px] text-[#8e8e93] font-black uppercase tracking-[0.2em] ml-2">Partenza</label>
              <input value={p.tripStart} onChange={e => p.setTripStart(e.target.value)} placeholder="Es. Milano..." className="bg-transparent w-full text-white font-black text-2xl outline-none placeholder:text-white/5 px-2 tracking-tight" />
            </div>
            <div className="h-px bg-white/5 mx-2" />
            <div className="space-y-1">
              <label className="text-[10px] text-[#8e8e93] font-black uppercase tracking-[0.2em] ml-2">Arrivo</label>
              <input value={p.tripEnd} onChange={e => p.setTripEnd(e.target.value)} placeholder="Es. Roma..." className="bg-transparent w-full text-white font-black text-2xl outline-none placeholder:text-white/5 px-2 tracking-tight" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-black/40 backdrop-blur-xl rounded-[32px] p-6 border border-white/5 space-y-4 shadow-inner">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] text-[#8e8e93] font-black uppercase tracking-[0.2em]">Consumo</label>
                <div className="flex bg-white/5 p-1 rounded-full border border-white/10">
                  <button onClick={() => p.setTripUnit('kml')} className={cn("px-2.5 py-1 rounded-full text-[9px] font-black transition-all", p.tripUnit === 'kml' ? "bg-blue-600 text-white shadow-lg" : "text-[#8e8e93]")}>KM/L</button>
                  <button onClick={() => p.setTripUnit('l100')} className={cn("px-2.5 py-1 rounded-full text-[9px] font-black transition-all", p.tripUnit === 'l100' ? "bg-blue-600 text-white shadow-lg" : "text-[#8e8e93]")}>L/100</button>
                </div>
              </div>
              <input type="number" step="0.1" value={p.tripKml} onChange={e => p.setTripKml(parseFloat(e.target.value || '0'))} className="bg-transparent w-full text-white font-black text-3xl outline-none px-1 tracking-tighter" />
            </div>
            <div className="bg-black/40 backdrop-blur-xl rounded-[32px] p-6 border border-white/5 space-y-4 shadow-inner">
              <label className="text-[10px] text-[#8e8e93] font-black uppercase tracking-[0.2em] px-1">Serbatoio (L)</label>
              <input type="number" value={p.tankLiters} onChange={e => p.setTankLiters(parseInt(e.target.value || '0'))} className="bg-transparent w-full text-white font-black text-3xl outline-none px-1 tracking-tighter" />
            </div>
          </div>

          <div className="bg-black/40 backdrop-blur-xl rounded-[32px] p-6 border border-white/5 space-y-5 shadow-inner">
            <label className="text-[10px] text-[#8e8e93] font-black uppercase tracking-[0.2em] px-1">Strategia Viaggio</label>
            <div className="flex bg-white/5 p-1.5 rounded-full border border-white/10">
              {[{id:'balanced',label:'Balance'},{id:'save',label:'Economy'},{id:'fast',label:'Express'}].map(s => (
                <button 
                  key={s.id} 
                  onClick={() => p.setTripStrategy(s.id)} 
                  className={cn("flex-1 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all", p.tripStrategy === s.id ? "bg-blue-600 text-white shadow-2xl" : "text-[#8e8e93] hover:text-white")}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <button 
            onClick={p.calculateTripRoute} 
            className="w-full py-5 bg-white text-black font-black rounded-full shadow-[0_20px_40px_rgba(255,255,255,0.2)] active:scale-95 transition-all text-[14px] uppercase tracking-[0.2em] flex items-center justify-center gap-3"
          >
            <Zap size={20} className="fill-black" />
            Calcola Missione
          </button>
          
          {p.tripStatus && <p className="text-center text-[12px] font-black text-blue-400 uppercase tracking-[0.3em] animate-pulse">{p.tripStatus}</p>}
        </div>
      </div>

      {p.tripCalculated && p.tripRoute && (
        <div className="space-y-6 pb-10">
          <div className="h-96 w-full bg-[#0a0f1d] border border-white/10 rounded-[40px] overflow-hidden relative z-10 shadow-2xl">
            <MapContainer center={[p.tripRoute.start.lat, p.tripRoute.start.lng]} zoom={6} className="h-full w-full" zoomControl={false} scrollWheelZoom={true}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
              <Marker position={[p.tripRoute.start.lat, p.tripRoute.start.lng]}><Popup>Partenza</Popup></Marker>
              <Marker position={[p.tripRoute.end.lat, p.tripRoute.end.lng]}><Popup>Arrivo</Popup></Marker>
              {/* @ts-ignore */}
              <Polyline positions={p.tripRoute.coords.map((c: number[]) => [c[1], c[0]])} color="#3b82f6" weight={5} opacity={1} />
              {p.tripStops.map((s: any, i: number) => <Marker key={i} position={[s.location.lat, s.location.lng]}><Popup>Sosta {i+1}: {s.brand}</Popup></Marker>)}
            </MapContainer>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              {label:'Distanza',value:`${p.tripDist} KM`,color:'text-white'},
              {label:'Costo Stimato',value:`€${((p.tripDist/(p.tripUnit==='kml'?p.tripKml:(100/p.tripKml)))*(p.cheapestPrice!==Infinity?p.cheapestPrice:1.8)).toFixed(2)}`,color:'text-[#4ade80]'},
              {label:'Litri Richiesti',value:`${(p.tripDist/(p.tripUnit==='kml'?p.tripKml:(100/p.tripKml))).toFixed(1)} L`,color:'text-blue-400'},
              {label:'Soste Previste',value:`${Math.ceil((p.tripDist/(p.tripUnit==='kml'?p.tripKml:(100/p.tripKml)))/p.tankLiters)}`,color:'text-purple-400'}
            ].map((m,i) => (
              <div key={i} className="bg-[#0a0f1d] p-7 rounded-[32px] border border-white/5 shadow-2xl">
                <div className="text-[11px] font-black text-[#8e8e93] uppercase tracking-[0.2em] mb-2">{m.label}</div>
                <div className={cn("text-2xl font-black tracking-tighter", m.color)}>{m.value}</div>
              </div>
            ))}
          </div>

          {p.tripStops.length > 0 && (
            <div className="bg-[#0a0f1d] p-8 rounded-[40px] border border-blue-500/30 space-y-8 shadow-2xl">
              <h3 className="text-[12px] font-black uppercase tracking-[0.4em] text-white italic px-2">Soste Ottimizzate</h3>
              <div className="space-y-4">
                {p.tripStops.map((s: any, i: number) => {
                  const logo = getBrandLogo(s.brand || s.name || '');
                  return (
                    <div key={i} className="bg-black/40 backdrop-blur-xl p-5 rounded-[28px] border border-white/5 flex items-center justify-between shadow-inner">
                      <div className="flex items-center gap-5">
                        <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center font-black border border-white/10 shadow-lg overflow-hidden grayscale-0">
                          <img src={logo} alt={s.brand} className="w-full h-full object-contain scale-[0.9]" />
                        </div>
                        <div>
                          <div className="font-black text-white text-[15px] uppercase italic">{s.brand}</div>
                          <div className="text-[11px] text-[#8e8e93] font-bold mt-0.5 tracking-tight">{s.address?.split(',')[0]}</div>
                        </div>
                      </div>
                      <div className="text-xl font-black text-[#4ade80] tabular-nums tracking-tighter">€{s.prices?.find((pp: any) => pp.type === p.selectedFuel)?.price?.toFixed(3)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

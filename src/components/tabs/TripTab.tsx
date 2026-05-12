import { motion } from 'motion/react';
import { Route, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { FuelType } from '../../types';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';

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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20"><Route className="text-white" size={20} /></div>
          <div><h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500/80">Mission Control</h2><h3 className="text-4xl font-black tracking-tighter text-white uppercase italic leading-none">Route <span className="text-blue-500">Plan</span></h3></div>
        </div>
      </header>

      <div className="bg-[#1c1c1e] p-8 rounded-[3.5rem] border border-white/5 space-y-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/5 blur-[60px] pointer-events-none" />
        <div className="space-y-4 relative z-10">
          <div className="bg-black/40 backdrop-blur-md rounded-[2.5rem] p-6 border border-white/5 space-y-4">
            <div className="space-y-2"><label className="text-[9px] text-[#48484a] font-black uppercase tracking-[0.3em] ml-2">Partenza</label><input value={p.tripStart} onChange={e => p.setTripStart(e.target.value)} placeholder="Es. Milano..." className="bg-transparent w-full text-white font-black italic text-xl outline-none placeholder:text-white/5 px-2" /></div>
            <div className="h-px bg-white/5 mx-2" />
            <div className="space-y-2"><label className="text-[9px] text-[#48484a] font-black uppercase tracking-[0.3em] ml-2">Arrivo</label><input value={p.tripEnd} onChange={e => p.setTripEnd(e.target.value)} placeholder="Es. Roma..." className="bg-transparent w-full text-white font-black italic text-xl outline-none placeholder:text-white/5 px-2" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-black/40 rounded-[2.5rem] p-6 border border-white/5 space-y-2">
              <label className="text-[9px] text-[#48484a] font-black uppercase tracking-[0.3em] flex justify-between">Consumo<span className="flex gap-2"><button onClick={() => p.setTripUnit('kml')} className={cn(p.tripUnit === 'kml' ? "text-blue-500" : "text-[#48484a]")}>KML</button><button onClick={() => p.setTripUnit('l100')} className={cn(p.tripUnit === 'l100' ? "text-blue-500" : "text-[#48484a]")}>L100</button></span></label>
              <input type="number" step="0.1" value={p.tripKml} onChange={e => p.setTripKml(parseFloat(e.target.value || '0'))} className="bg-transparent w-full text-white font-black italic text-2xl outline-none" />
            </div>
            <div className="bg-black/40 rounded-[2.5rem] p-6 border border-white/5 space-y-2">
              <label className="text-[9px] text-[#48484a] font-black uppercase tracking-[0.3em]">Serbatoio (L)</label>
              <input type="number" value={p.tankLiters} onChange={e => p.setTankLiters(parseInt(e.target.value || '0'))} className="bg-transparent w-full text-white font-black italic text-2xl outline-none" />
            </div>
          </div>
          <div className="bg-black/40 rounded-[2.5rem] p-6 border border-white/5 space-y-4">
            <label className="text-[9px] text-[#48484a] font-black uppercase tracking-[0.3em] ml-2">Strategia</label>
            <div className="grid grid-cols-3 gap-3">
              {[{id:'balanced',label:'Bilanciata'},{id:'save',label:'Risparmio'},{id:'fast',label:'Veloce'}].map(s => (
                <button key={s.id} onClick={() => p.setTripStrategy(s.id)} className={cn("py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest border transition-all", p.tripStrategy === s.id ? "bg-blue-600 text-white border-blue-500 shadow-lg" : "bg-white/5 text-[#48484a] border-white/5")}>{s.label}</button>
              ))}
            </div>
          </div>
          <button onClick={p.calculateTripRoute} className="w-full py-6 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-[2.5rem] shadow-[0_20px_50px_rgba(37,99,235,0.3)] active:scale-[0.98] transition-all text-xs uppercase tracking-[0.4em] italic flex items-center justify-center gap-3"><Zap size={18} className="fill-white" />Calcola Viaggio</button>
          {p.tripStatus && <p className="text-center text-[10px] font-black text-blue-400 uppercase tracking-widest animate-pulse">{p.tripStatus}</p>}
        </div>
      </div>

      {p.tripCalculated && p.tripRoute && (
        <div className="space-y-6 pb-10">
          <div className="h-96 w-full bg-[#1c1c1e] border border-white/10 rounded-[3.5rem] overflow-hidden relative z-10 shadow-2xl">
            <MapContainer center={[p.tripRoute.start.lat, p.tripRoute.start.lng]} zoom={6} className="h-full w-full grayscale-[0.8] contrast-[1.2]" zoomControl={false}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
              <Marker position={[p.tripRoute.start.lat, p.tripRoute.start.lng]}><Popup>Partenza</Popup></Marker>
              <Marker position={[p.tripRoute.end.lat, p.tripRoute.end.lng]}><Popup>Arrivo</Popup></Marker>
              {/* @ts-ignore */}
              <Polyline positions={p.tripRoute.coords.map((c: number[]) => [c[1], c[0]])} color="#3b82f6" weight={5} opacity={0.6} dashArray="1, 10" />
              {p.tripStops.map((s: any, i: number) => <Marker key={i} position={[s.location.lat, s.location.lng]}><Popup>Sosta {i+1}: {s.brand}</Popup></Marker>)}
            </MapContainer>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              {label:'Distanza',value:`${p.tripDist}KM`,color:'text-white'},
              {label:'Costo Stim.',value:`€${((p.tripDist/(p.tripUnit==='kml'?p.tripKml:(100/p.tripKml)))*(p.cheapestPrice!==Infinity?p.cheapestPrice:1.8)).toFixed(2)}`,color:'text-emerald-400'},
              {label:'Litri Neces.',value:`${(p.tripDist/(p.tripUnit==='kml'?p.tripKml:(100/p.tripKml))).toFixed(1)}L`,color:'text-blue-400'},
              {label:'Soste',value:`${Math.ceil((p.tripDist/(p.tripUnit==='kml'?p.tripKml:(100/p.tripKml)))/p.tankLiters)}`,color:'text-purple-400'}
            ].map((m,i) => (
              <div key={i} className="bg-[#1c1c1e]/80 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white/5 shadow-xl">
                <div className="text-[9px] font-black text-[#48484a] uppercase tracking-[0.3em] mb-2">{m.label}</div>
                <div className={cn("text-2xl font-black italic tracking-tighter",m.color)}>{m.value}</div>
              </div>
            ))}
          </div>
          {p.tripStops.length > 0 && (
            <div className="bg-[#1c1c1e] p-8 rounded-[3.5rem] border border-white/5 space-y-6 shadow-2xl">
              <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-white italic px-2">Soste Ottimizzate</h3>
              {p.tripStops.map((s: any, i: number) => (
                <div key={i} className="group bg-black/40 p-6 rounded-[2.5rem] border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-blue-600 text-white rounded-[1.5rem] flex items-center justify-center font-black text-lg shadow-lg">{i+1}</div>
                    <div><div className="font-black uppercase italic text-white text-sm">{s.brand}</div><div className="text-[10px] text-[#48484a] font-black uppercase tracking-widest mt-0.5">{s.address?.split(',')[0]}</div></div>
                  </div>
                  <div className="text-lg font-black text-blue-500 italic tracking-tighter">€{s.prices?.find((pp: any) => pp.type === p.selectedFuel)?.price?.toFixed(3)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowDownUp, Navigation2, MapPin, Fuel, Wallet, Milestone, Route } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { FuelStation, FuelType } from '../../types';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { LatLngBoundsExpression } from 'leaflet';
import { getBrandLogo } from '../../lib/brandLogos';
import { CityAutocomplete } from '../CityAutocomplete';

const startIcon = L.divIcon({
  className: 'trip-pin-wrap',
  html: '<div class="trip-pin-start"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});
const endIcon = L.divIcon({
  className: 'trip-pin-wrap',
  html: '<div class="trip-pin-end"></div>',
  iconSize: [28, 36],
  iconAnchor: [14, 34],
});
const stopIcon = (n: number) =>
  L.divIcon({
    className: 'trip-pin-wrap',
    html: `<div class="trip-pin-stop">${n}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

const nearbyIcon = (price: number, isCheapest: boolean) =>
  L.divIcon({
    className: 'trip-pin-wrap',
    html: `<div class="trip-pin-nearby ${isCheapest ? 'is-cheap' : ''}"><span>€${price.toFixed(3)}</span></div>`,
    iconSize: [56, 22],
    iconAnchor: [28, 11],
  });

function FitBounds({ bounds }: { bounds: LatLngBoundsExpression }) {
  const map = useMap();
  useEffect(() => {
    try { map.fitBounds(bounds, { padding: [40, 40] }); } catch { /* ignora */ }
  }, [bounds, map]);
  return null;
}

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
  userLoc: { lat: number; lng: number } | null;
  stations: FuelStation[];
  tripCurrentFuel: number | null;
  setTripCurrentFuel: (v: number | null) => void;
  tripToll: boolean;
  setTripToll: (v: boolean) => void;
  tripNearby?: any[];
  onStationClick?: (s: FuelStation) => void;
}

const STRATEGIES = [
  { id: 'balanced', label: 'Bilanciato' },
  { id: 'save', label: 'Economico' },
  { id: 'fast', label: 'Veloce' },
] as const;

export function TripTab(p: Props) {
  const swap = () => { const a = p.tripStart; p.setTripStart(p.tripEnd); p.setTripEnd(a); };
  const kpl = p.tripUnit === 'kml' ? p.tripKml : (p.tripKml > 0 ? 100 / p.tripKml : 0);
  const liters = kpl > 0 ? p.tripDist / kpl : 0;
  const cost = liters * (p.cheapestPrice !== Infinity ? p.cheapestPrice : 1.8);

  // Stima pedaggio: % autostrada in base alla distanza × tariffa media IT
  const highwayShare = p.tripDist < 50 ? 0 : p.tripDist < 100 ? 0.3 : p.tripDist < 300 ? 0.55 : 0.7;
  const highwayKm = p.tripDist * highwayShare;
  const tollCost = p.tripToll ? highwayKm * 0.077 : 0;
  const totalCost = cost + tollCost;

  const currentFuel = p.tripCurrentFuel == null ? p.tankLiters : Math.max(0, Math.min(p.tankLiters, p.tripCurrentFuel));
  const litersAfterCurrent = Math.max(0, liters - currentFuel);
  const stops = p.tankLiters > 0 ? Math.max(0, Math.ceil(litersAfterCurrent / p.tankLiters)) : 0;
  const filled = p.tripStart.trim().length > 0 && p.tripEnd.trim().length > 0;

  const [locating, setLocating] = useState(false);
  const autoFillRef = useRef(false);
  const [nearbySort, setNearbySort] = useState<'price'|'detour'|'progress'>('price');

  const nearbyMinPrice = (() => {
    if (!p.tripNearby || p.tripNearby.length === 0) return null;
    let min = Infinity;
    for (const s of p.tripNearby) {
      const v = s.prices?.find((pp: any) => pp.type === p.selectedFuel)?.price || 0;
      if (v > 0 && v < min) min = v;
    }
    return min === Infinity ? null : min;
  })();

  const sortedNearby = (() => {
    if (!p.tripNearby) return [];
    const arr = p.tripNearby.map(s => ({
      ...s,
      _price: s.prices?.find((pp: any) => pp.type === p.selectedFuel)?.price || 0,
    }));
    if (nearbySort === 'price') arr.sort((a, b) => (a._price || Infinity) - (b._price || Infinity));
    else if (nearbySort === 'detour') arr.sort((a, b) => a.routeDetourKm - b.routeDetourKm);
    else arr.sort((a, b) => a.routeProgressKm - b.routeProgressKm);
    return arr;
  })();

  const extraCities = useMemo(
    () => Array.from(new Set(p.stations.map(s => (s.city || '').trim()).filter(Boolean))),
    [p.stations]
  );

  const reverseGeocode = async () => {
    if (!p.userLoc) return;
    setLocating(true);
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${p.userLoc.lat}&lon=${p.userLoc.lng}&zoom=12&accept-language=it`
      );
      const d = await r.json();
      const a = d.address || {};
      const city = a.city || a.town || a.village || a.municipality || a.county || d.name;
      if (city) p.setTripStart(city);
    } catch { /* ignora */ }
    finally { setLocating(false); }
  };

  // Auto-fill partenza con citta utente al primo mount se vuota o default
  useEffect(() => {
    if (autoFillRef.current) return;
    if (!p.userLoc) return;
    const cur = p.tripStart.trim();
    if (cur && cur !== 'Milano') { autoFillRef.current = true; return; }
    autoFillRef.current = true;
    reverseGeocode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.userLoc]);

  return (
    <motion.div
      key="trip"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="pb-32 space-y-6"
    >
      {/* Header — glow blu in linea con Home */}
      <header className="pt-2 px-1">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse" />
          <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">Itinerario</span>
        </div>
        <h1 className="text-[34px] sm:text-[40px] font-black tracking-tighter text-white leading-none italic uppercase">
          Pianifica<br/>il viaggio
        </h1>
        <p className="text-[13px] text-zinc-400 mt-3 font-medium">Trova il percorso piu conveniente con soste mirate</p>
      </header>

      {/* Directions card — glow blu quando hai entrambi i campi */}
      <section
        className={cn(
          'relative z-40 rounded-[32px] bg-[#0a0f1d] backdrop-blur-xl transition-all duration-300',
          filled
            ? 'border border-blue-500/30 shadow-[0_0_60px_rgba(37,99,235,0.25)]'
            : 'border border-white/5 shadow-2xl'
        )}
      >
        <div className={cn('absolute inset-0 rounded-[32px] pointer-events-none', filled ? 'bg-gradient-to-br from-blue-600/5 to-transparent' : '')} />
        <div className="relative z-10 flex items-stretch">
          <div className="flex-1 min-w-0 divide-y divide-white/5">
            <CityAutocomplete
              value={p.tripStart}
              onChange={p.setTripStart}
              placeholder="Partenza"
              dot={<div className="w-2.5 h-2.5 rounded-full bg-zinc-500 flex-shrink-0 ring-2 ring-zinc-700/50" />}
              extraCities={extraCities}
              onUseLocation={reverseGeocode}
              isLocating={locating}
            />
            <CityAutocomplete
              value={p.tripEnd}
              onChange={p.setTripEnd}
              placeholder="Arrivo"
              dot={<div className="w-2.5 h-2.5 rounded-sm bg-blue-500 flex-shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />}
              extraCities={extraCities}
            />
          </div>
          <button
            onClick={swap}
            aria-label="Inverti partenza e arrivo"
            className="px-4 border-l border-white/5 text-zinc-400 hover:text-blue-400 hover:bg-white/5 active:scale-95 transition-all flex-shrink-0"
          >
            <ArrowDownUp className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Vehicle card */}
      <section className="bg-[#09090b]/50 backdrop-blur-xl rounded-[32px] border border-white/5 p-5 sm:p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
            <h2 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Veicolo</h2>
          </div>
          <div className="inline-flex bg-white/5 rounded-full p-0.5 border border-white/5">
            <button
              onClick={() => p.setTripUnit('kml')}
              className={cn(
                'px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider transition-all',
                p.tripUnit === 'kml' ? 'bg-blue-500/20 text-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.3)] border border-blue-500/30' : 'text-zinc-400'
              )}
            >
              KM/L
            </button>
            <button
              onClick={() => p.setTripUnit('l100')}
              className={cn(
                'px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider transition-all',
                p.tripUnit === 'l100' ? 'bg-blue-500/20 text-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.3)] border border-blue-500/30' : 'text-zinc-400'
              )}
            >
              L/100
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-white/[0.03] rounded-2xl p-4 min-w-0 overflow-hidden border border-white/5">
            <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mb-1">Consumo</p>
            <div className="flex items-baseline gap-1.5">
              <input
                type="number"
                step="0.1"
                value={p.tripKml}
                onChange={e => p.setTripKml(parseFloat(e.target.value || '0'))}
                className="bg-transparent w-full text-[26px] font-black text-white tabular-nums outline-none tracking-tighter"
              />
              <span className="text-[11px] text-zinc-500 font-bold flex-shrink-0">{p.tripUnit === 'kml' ? 'km/L' : 'L/100'}</span>
            </div>
          </div>
          <div className="bg-white/[0.03] rounded-2xl p-4 min-w-0 overflow-hidden border border-white/5">
            <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mb-1">Serbatoio</p>
            <div className="flex items-baseline gap-1.5">
              <input
                type="number"
                value={p.tankLiters}
                onChange={e => p.setTankLiters(parseInt(e.target.value || '0'))}
                className="bg-transparent w-full text-[26px] font-black text-white tabular-nums outline-none tracking-tighter"
              />
              <span className="text-[11px] text-zinc-500 font-bold flex-shrink-0">L</span>
            </div>
          </div>
        </div>

        {/* Autonomia attuale */}
        <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest">Carburante ora</p>
            <div className="text-[11px] text-zinc-300 font-bold tabular-nums">
              <span className="text-blue-300">{currentFuel.toFixed(0)}L</span>
              <span className="text-zinc-500"> / {p.tankLiters}L</span>
              <span className="text-zinc-500"> · ~{Math.round(currentFuel * kpl * 0.8)} km</span>
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={p.tankLiters || 1}
            step={1}
            value={currentFuel}
            onChange={e => p.setTripCurrentFuel(parseInt(e.target.value))}
            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Vuoto</span>
            <button
              onClick={() => p.setTripCurrentFuel(p.tankLiters)}
              className="text-[9px] text-blue-400 font-black uppercase tracking-widest hover:text-blue-300"
            >
              Pieno
            </button>
          </div>
        </div>
      </section>

      {/* Strategy — chip blu glow su attivo */}
      <section className="bg-[#09090b]/50 backdrop-blur-xl rounded-[32px] border border-white/5 p-5 sm:p-6 shadow-2xl">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
          <h2 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Strategia</h2>
        </div>
        <div className="inline-flex w-full bg-white/5 rounded-full p-0.5 border border-white/5 mb-4">
          {STRATEGIES.map(s => (
            <button
              key={s.id}
              onClick={() => p.setTripStrategy(s.id)}
              className={cn(
                'flex-1 py-2 rounded-full text-[12px] font-black uppercase tracking-wider transition-all',
                p.tripStrategy === s.id
                  ? 'bg-blue-500/20 text-blue-300 shadow-[0_0_18px_rgba(59,130,246,0.35)] border border-blue-500/30'
                  : 'text-zinc-400 hover:text-white'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Toggle pedaggio */}
        <button
          onClick={() => p.setTripToll(!p.tripToll)}
          className="w-full flex items-center justify-between gap-3 bg-white/[0.03] rounded-2xl p-3 border border-white/5 hover:border-white/10 transition-all"
        >
          <div className="text-left">
            <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest">Pedaggio autostrada</p>
            <p className="text-[10px] text-zinc-500 font-medium mt-0.5">Stima: ~{Math.round(highwayKm)} km a €0.077/km</p>
          </div>
          <div className={cn('relative w-11 h-6 rounded-full transition-all flex-shrink-0', p.tripToll ? 'bg-blue-500' : 'bg-white/10')}>
            <div className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow', p.tripToll ? 'left-[22px]' : 'left-0.5')} />
          </div>
        </button>
      </section>

      {/* Live estimate preview */}
      {p.tripDist > 0 && (
        <section className="bg-[#09090b]/50 backdrop-blur-xl rounded-[32px] border border-white/5 p-5 sm:p-6 shadow-2xl">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            <p className="text-[10px] text-white font-black uppercase tracking-[0.2em]">Stima rapida</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Distanza" value={`${p.tripDist} km`} />
            <Stat label="Carburante" value={`€${cost.toFixed(2)}`} />
            <Stat label={p.tripToll ? 'Totale' : 'Litri'} value={p.tripToll ? `€${totalCost.toFixed(2)}` : `${liters.toFixed(1)} L`} />
          </div>
        </section>
      )}

      {/* Calculate button — primary blue glow potente */}
      <button
        onClick={p.calculateTripRoute}
        disabled={!filled}
        className={cn(
          'w-full py-4 active:scale-[0.98] transition-all rounded-full font-black text-[15px] uppercase tracking-widest flex items-center justify-center gap-2.5',
          filled
            ? 'bg-blue-500 hover:bg-blue-400 text-white shadow-[0_0_40px_rgba(37,99,235,0.45)]'
            : 'bg-white/5 text-zinc-500 cursor-not-allowed'
        )}
      >
        <Navigation2 className="w-5 h-5" />
        Calcola percorso
      </button>

      {p.tripStatus && (
        <p className="text-center text-[12px] text-zinc-400 font-medium tracking-wide">{p.tripStatus}</p>
      )}

      {/* Result */}
      {p.tripCalculated && p.tripRoute && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-4"
        >
          <div className="relative h-80 sm:h-96 w-full rounded-[32px] overflow-hidden border border-blue-500/30 shadow-[0_0_60px_rgba(37,99,235,0.25)]">
            {(() => {
              const coords: [number, number][] = p.tripRoute.coords.map((c: number[]) => [c[1], c[0]]);
              const lats = coords.map(c => c[0]).concat(p.tripRoute.start.lat, p.tripRoute.end.lat);
              const lngs = coords.map(c => c[1]).concat(p.tripRoute.start.lng, p.tripRoute.end.lng);
              const bounds: LatLngBoundsExpression = [
                [Math.min(...lats), Math.min(...lngs)],
                [Math.max(...lats), Math.max(...lngs)],
              ];
              return (
                <MapContainer
                  center={[p.tripRoute.start.lat, p.tripRoute.start.lng]}
                  zoom={6}
                  className="h-full w-full"
                  zoomControl={false}
                  scrollWheelZoom={true}
                >
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution=""
                  />
                  <FitBounds bounds={bounds} />

                  {/* Route shadow (halo scuro) */}
                  <Polyline
                    positions={coords}
                    pathOptions={{ color: '#000000', weight: 12, opacity: 0.45, lineCap: 'round', lineJoin: 'round' }}
                  />
                  {/* Route glow esterno */}
                  <Polyline
                    positions={coords}
                    pathOptions={{ color: '#3b82f6', weight: 10, opacity: 0.25, lineCap: 'round', lineJoin: 'round' }}
                  />
                  {/* Route main */}
                  <Polyline
                    positions={coords}
                    pathOptions={{ color: '#60a5fa', weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round' }}
                  />
                  {/* Inner highlight */}
                  <Polyline
                    positions={coords}
                    pathOptions={{ color: '#dbeafe', weight: 1.5, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }}
                  />

                  <Marker position={[p.tripRoute.start.lat, p.tripRoute.start.lng]} icon={startIcon}>
                    <Popup className="trip-popup">PARTENZA</Popup>
                  </Marker>
                  <Marker position={[p.tripRoute.end.lat, p.tripRoute.end.lng]} icon={endIcon}>
                    <Popup className="trip-popup">ARRIVO</Popup>
                  </Marker>
                  {(p.tripNearby || []).map((st: any) => {
                    if (p.tripStops.some(s => s.id === st.id)) return null;
                    const price = st.prices?.find((pp: any) => pp.type === p.selectedFuel)?.price || 0;
                    const isCheap = nearbyMinPrice !== null && price === nearbyMinPrice;
                    return (
                      <Marker
                        key={`near-${st.id}`}
                        position={[st.location.lat, st.location.lng]}
                        icon={nearbyIcon(price, isCheap)}
                        eventHandlers={p.onStationClick ? { click: () => p.onStationClick!(st) } : undefined}
                      />
                    );
                  })}
                  {p.tripStops.map((s: any, i: number) => (
                    <Marker
                      key={i}
                      position={[s.location.lat, s.location.lng]}
                      icon={stopIcon(i + 1)}
                      eventHandlers={p.onStationClick ? { click: () => p.onStationClick!(s) } : undefined}
                    >
                      <Popup className="trip-popup">Sosta {i + 1} · {s.brand}</Popup>
                    </Marker>
                  ))}
                </MapContainer>
              );
            })()}
          </div>

          <section className="relative bg-[#0a0f1d] rounded-[32px] border border-blue-500/30 shadow-[0_0_60px_rgba(37,99,235,0.25)] p-5 sm:p-6 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-transparent pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <Route className="w-4 h-4 text-blue-400" />
                <h2 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Risultato</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <BigStat icon={<Milestone className="w-3.5 h-3.5 text-zinc-400" />} label="Distanza" value={`${p.tripDist} km`} />
                <BigStat icon={<Fuel className="w-3.5 h-3.5 text-blue-400" />} label="Litri" value={`${liters.toFixed(1)} L`} />
                <BigStat icon={<Wallet className="w-3.5 h-3.5 text-emerald-400" />} label="Carburante" value={`€${cost.toFixed(2)}`} valueClass="text-emerald-400" />
                {p.tripToll && (
                  <BigStat icon={<Wallet className="w-3.5 h-3.5 text-amber-400" />} label="Pedaggio (stima)" value={`€${tollCost.toFixed(2)}`} valueClass="text-amber-400" />
                )}
                <BigStat icon={<MapPin className="w-3.5 h-3.5 text-orange-400" />} label="Soste" value={`${stops}`} />
                <BigStat icon={<Wallet className="w-3.5 h-3.5 text-emerald-400" />} label="Totale" value={`€${totalCost.toFixed(2)}`} valueClass="text-emerald-400" />
              </div>
            </div>
          </section>

          {p.tripStops.length > 0 && (
            <section>
              <div className="flex items-center gap-2 px-1 mb-3">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                <h2 className="text-[10px] text-white font-black uppercase tracking-[0.2em]">Soste consigliate</h2>
              </div>
              <div className="bg-[#09090b]/50 backdrop-blur-xl rounded-[32px] border border-white/5 overflow-hidden divide-y divide-white/5 shadow-2xl">
                {p.tripStops.map((st: any, i: number) => {
                  const logo = getBrandLogo(st.brand || st.name || '');
                  const price = st.prices?.find((pp: any) => pp.type === p.selectedFuel)?.price;
                  return (
                    <div key={i} className="flex items-center gap-3 p-4 sm:p-5">
                      <div className="w-11 h-11 rounded-full bg-black border border-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        <img src={logo} alt={st.brand} className="w-full h-full object-contain scale-[0.9]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-bold text-white truncate">{st.brand || st.name}</p>
                        <p className="text-[12px] text-zinc-500 truncate font-medium">{st.address?.split(',')[0]}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[15px] font-black text-emerald-400 tabular-nums">
                          €{price ? price.toFixed(3) : '—'}
                        </p>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">sosta {i+1}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {sortedNearby.length > 0 && (
            <section>
              <div className="flex items-center justify-between gap-2 px-1 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                  <h2 className="text-[10px] text-white font-black uppercase tracking-[0.2em]">Stazioni lungo il percorso</h2>
                  <span className="text-[9px] font-black text-[#48484a] uppercase tracking-widest tabular-nums">{sortedNearby.length}</span>
                </div>
              </div>
              <div className="flex gap-1.5 mb-3">
                {[
                  { id: 'price' as const, label: 'Prezzo' },
                  { id: 'detour' as const, label: 'Deviazione' },
                  { id: 'progress' as const, label: 'Tappa' },
                ].map(o => (
                  <button
                    key={o.id}
                    onClick={() => setNearbySort(o.id)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                      nearbySort === o.id
                        ? 'bg-blue-600 text-white border-blue-400/40 shadow-[0_0_12px_rgba(37,99,235,0.4)]'
                        : 'bg-white/5 text-[#8e8e93] border-white/10 hover:text-white'
                    }`}
                  >{o.label}</button>
                ))}
              </div>
              <div className="bg-[#09090b]/50 backdrop-blur-xl rounded-[32px] border border-white/5 overflow-hidden divide-y divide-white/5 shadow-2xl max-h-[480px] overflow-y-auto no-scrollbar">
                {sortedNearby.map((st: any) => {
                  const logo = getBrandLogo(st.brand || st.name || '');
                  const isCheapest = nearbyMinPrice !== null && st._price === nearbyMinPrice;
                  const isStop = p.tripStops.some(s => s.id === st.id);
                  return (
                    <div
                      key={st.id}
                      onClick={() => p.onStationClick?.(st)}
                      className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/[0.03] active:scale-[0.99] transition-all"
                    >
                      <div className={`w-10 h-10 rounded-full bg-black border flex items-center justify-center flex-shrink-0 overflow-hidden ${isCheapest ? 'border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.4)]' : 'border-white/10'}`}>
                        <img src={logo} alt={st.brand} className="w-full h-full object-contain scale-[0.9]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-[13px] font-black uppercase italic tracking-tight text-white truncate">{st.brand || st.name}</p>
                          {isCheapest && <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex-shrink-0">Min</span>}
                          {isStop && <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex-shrink-0">Sosta</span>}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-[#8e8e93] uppercase tracking-widest mt-0.5 tabular-nums">
                          <span>{st.routeProgressKm.toFixed(0)} km</span>
                          <span className="opacity-40">•</span>
                          <span>+{(st.routeDetourKm * 2).toFixed(1)} km dev.</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-[15px] font-black tabular-nums tracking-tighter ${isCheapest ? 'text-emerald-400' : 'text-white'}`}>
                          €{st._price ? st._price.toFixed(3) : '—'}
                        </p>
                        <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">{p.selectedFuel}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1 truncate">{label}</p>
      <p className="text-[15px] font-black text-white tabular-nums truncate tracking-tight">{value}</p>
    </div>
  );
}

function BigStat({ icon, label, value, valueClass }: { icon: React.ReactNode; label: string; value: string; valueClass?: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest truncate">{label}</p>
      </div>
      <p className={cn('text-[22px] font-black tabular-nums tracking-tighter truncate text-white', valueClass)}>{value}</p>
    </div>
  );
}

import { useEffect, useMemo, memo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { FuelStation, FuelType } from '../types';

interface Props {
  tripRoute: any;
  tripStops: any[];
  tripNearby?: any[];
  selectedFuel: FuelType;
  mapStyle?: 'dark' | 'voyager';
  onStationClick?: (s: FuelStation) => void;
}

function TripFitBounds({ coords, start, end }: { coords: [number, number][]; start: any; end: any }) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
    if (!coords || coords.length === 0) return;
    const lats = coords.map((c) => c[0]).concat(start.lat, end.lat);
    const lngs = coords.map((c) => c[1]).concat(start.lng, end.lng);
    const bounds: L.LatLngBoundsExpression = [
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)],
    ];
    try {
      map.fitBounds(bounds, { padding: [40, 40] });
    } catch {
      // ignora
    }
    const t = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(t);
  }, [coords, start, end, map]);

  return null;
}

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

export const NativeLeafletTripMap = memo(function NativeLeafletTripMap({
  tripRoute,
  tripStops,
  tripNearby,
  selectedFuel,
  mapStyle = 'dark',
  onStationClick,
}: Props) {
  const coords: [number, number][] = useMemo(() => {
    if (!tripRoute || !tripRoute.coords) return [];
    return tripRoute.coords.map((c: number[]) => [c[1], c[0]]);
  }, [tripRoute]);

  const baseTileUrl = mapStyle === 'voyager'
    ? 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'
    : 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';

  const refTileUrl = mapStyle === 'voyager'
    ? 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}'
    : 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}';

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#0c0c0e' }}>
      <MapContainer
        center={[tripRoute.start.lat, tripRoute.start.lng]}
        zoom={6}
        className="h-full w-full"
        zoomControl={false}
        scrollWheelZoom={true}
        preferCanvas={true}
        style={{ width: '100%', height: '100%', background: '#0c0c0e' }}
      >
        <TileLayer key={`base-${mapStyle}`} url={baseTileUrl} maxZoom={19} maxNativeZoom={16} attribution="" />
        <TileLayer key={`ref-${mapStyle}`} url={refTileUrl} maxZoom={19} maxNativeZoom={16} attribution="" />
        <TripFitBounds coords={coords} start={tripRoute.start} end={tripRoute.end} />

        <Polyline positions={coords} pathOptions={{ color: '#000', weight: 11, opacity: 0.5, lineCap: 'round', lineJoin: 'round' }} />
        <Polyline positions={coords} pathOptions={{ color: '#3b82f6', weight: 4.5, opacity: 1, lineCap: 'round', lineJoin: 'round' }} />

        <Marker position={[tripRoute.start.lat, tripRoute.start.lng]} icon={startIcon}>
          <Popup className="trip-popup">Partenza</Popup>
        </Marker>

        <Marker position={[tripRoute.end.lat, tripRoute.end.lng]} icon={endIcon}>
          <Popup className="trip-popup">Arrivo</Popup>
        </Marker>

        {tripStops.map((s: any, i: number) => {
          const stopIcon = L.divIcon({
            className: 'trip-pin-wrap',
            html: `<div class="trip-stop-marker">${i + 1}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
          });
          return (
            <Marker
              key={`stop-${s.id || i}`}
              position={[s.location.lat, s.location.lng]}
              icon={stopIcon}
              eventHandlers={onStationClick ? { click: () => onStationClick(s) } : undefined}
            >
              <Popup className="trip-popup">Sosta {i + 1} · {s.brand}</Popup>
            </Marker>
          );
        })}

        {(tripNearby || []).map((st: any) => {
          if (tripStops.some((s) => s.id === st.id)) return null;
          const price = st.prices?.find((pp: any) => pp.type === selectedFuel)?.price || 0;
          if (price <= 0) return null;

          const nearIcon = L.divIcon({
            className: 'trip-pin-wrap',
            html: `<div style="background:#131317;color:#fff;border:1px solid rgba(255,255,255,0.25);border-radius:999px;padding:2px 6px;font:600 10px monospace;white-space:nowrap;display:inline-flex;transform:translate(-50%,-50%);box-shadow:0 1px 4px rgba(0,0,0,0.6);">€${price.toFixed(3).replace('.', ',')}</div>`,
            iconSize: [0, 0],
          });

          return (
            <Marker
              key={`near-${st.id}`}
              position={[st.location.lat, st.location.lng]}
              icon={nearIcon}
              eventHandlers={onStationClick ? { click: () => onStationClick(st) } : undefined}
            />
          );
        })}
      </MapContainer>
    </div>
  );
});

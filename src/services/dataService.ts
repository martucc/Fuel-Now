import type { FuelStation, FuelType } from '../types';

export async function getStations(userLocation?: { lat: number, lng: number }): Promise<FuelStation[]> {
  try {
    const response = await fetch('/stations.json');
    if (!response.ok) throw new Error('Failed to fetch stations.json');
    const data = await response.json();
    const rawStations = Array.isArray(data) ? data : data.stations;
    
    if (Array.isArray(rawStations)) {
      let parsedStations = rawStations.map((s: any) => {
        const prices: FuelStation['prices'] = [];
        if (s.p) {
          const fuelMap: Record<FuelType, string> = {
            Benzina: 'benzina',
            Diesel: 'diesel',
            GPL: 'gpl',
            Metano: 'metano',
            'Super+': 'benzina',
          };

          (Object.keys(fuelMap) as FuelType[]).forEach(ft => {
            const jsonKey = fuelMap[ft];
            const pArray = s.p[jsonKey];
            if (pArray && Array.isArray(pArray)) {
              if (pArray[0] != null) prices.push({ type: ft, price: pArray[0], lastUpdated: s.updated, isSelf: true });
              if (pArray[1] != null) prices.push({ type: ft, price: pArray[1], lastUpdated: s.updated, isSelf: false });
            }
          });
        }
        
        const services: string[] = [];
        if (s.p && Object.values(s.p).some((p: any) => Array.isArray(p) && p[0] != null)) services.push('Self-Service');
        if (s.is_highway) services.push('Autostrada');
        if (s.h24 || s.open_24h) services.push('H24');
        
        return {
          id: String(s.id || `${s.lat},${s.lng}`),
          name: s.name || s.brand || 'Distributore',
          brand: s.brand || 'Indipendente',
          address: [s.address, s.city, s.prov].filter(Boolean).join(', '),
          distance: userLocation ? calculateDistance(userLocation.lat, userLocation.lng, s.lat, s.lng) : undefined,
          services,
          location: { lat: s.lat, lng: s.lng },
          prices,
          isHighway: Boolean(s.is_highway),
        };
      }).filter((station: FuelStation) => Number.isFinite(station.location.lat) && Number.isFinite(station.location.lng) && station.prices.length > 0);

      if (userLocation) {
        parsedStations = parsedStations.filter((s: FuelStation) => s.distance !== undefined && s.distance < 100);
        parsedStations.sort((a: FuelStation, b: FuelStation) => (a.distance || 0) - (b.distance || 0));
      }
      
      return parsedStations;
    }
  } catch (error) {
    console.error("Error fetching real stations.json data:", error);
  }

  return [];
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

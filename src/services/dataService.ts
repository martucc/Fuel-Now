import type { FuelStation } from '../types';

export async function getStations(userLocation?: { lat: number; lng: number }): Promise<{ stations: FuelStation[]; nationalStats: any }> {
  try {
    const response = await fetch('stations.json');
    if (!response.ok) throw new Error('Failed to fetch stations.json');
    const data = await response.json();

    if (data.stations && Array.isArray(data.stations)) {
      let parsedStations = data.stations.map((s: any) => {
        const prices: any[] = [];
        if (s.p) {
          const fuelMap: Record<string, string> = {
            Benzina: 'benzina',
            Diesel: 'diesel',
            GPL: 'gpl',
            Metano: 'metano',
          };

          Object.keys(fuelMap).forEach((ft) => {
            const jsonKey = fuelMap[ft];
            const pArray = s.p[jsonKey];
            if (pArray && Array.isArray(pArray)) {
              if (pArray[0] != null)
                prices.push({ type: ft, price: pArray[0], lastUpdated: s.updated, isSelf: true });
              if (pArray[1] != null)
                prices.push({ type: ft, price: pArray[1], lastUpdated: s.updated, isSelf: false });
            }
          });
        }

        const services: string[] = [];
        if (s.p && Object.values(s.p).some((p: any) => Array.isArray(p) && p[0] != null))
          services.push('Self-Service');
        if (s.is_highway) services.push('Autostrada');

        return {
          id: String(s.id),
          name: s.name,
          brand: s.brand || 'Indipendente',
          address: s.address + (s.city ? `, ${s.city}` : ''),
          distance: userLocation
            ? calculateDistance(userLocation.lat, userLocation.lng, s.lat, s.lng)
            : undefined,
          services,
          location: { lat: s.lat, lng: s.lng },
          prices,
        };
      });

      const now = new Date();
      parsedStations = parsedStations.filter((s: any) => {
        if (!s.prices || s.prices.length === 0) return false;
        const lastUp = s.prices[0].lastUpdated;
        if (!lastUp) return false;
        
        // Handle "YYYY-MM-DD HH:MM" format
        const [datePart] = lastUp.split(' ');
        const [y, m, d] = datePart.split('-').map(Number);
        const upDate = new Date(y, m - 1, d);
        const diffDays = (now.getTime() - upDate.getTime()) / (1000 * 60 * 60 * 24);
        
        return diffDays < 7; // Ignore if older than 7 days
      });

      if (userLocation) {
        parsedStations = parsedStations.filter(
          (s: FuelStation) => s.distance !== undefined && s.distance < 50
        );
        parsedStations.sort(
          (a: FuelStation, b: FuelStation) => (a.distance || 0) - (b.distance || 0)
        );
      }

      return {
        stations: parsedStations,
        nationalStats: data.national || {}
      };
    }
  } catch (error) {
    console.error('Error fetching stations data:', error);
  }

  return { stations: [], nationalStats: {} };
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

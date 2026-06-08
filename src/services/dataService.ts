import type { FuelStation } from '../types';
import { Preferences } from '@capacitor/preferences';

let inMemoryStations: any[] = [];
let inMemoryNationalStats: any = {};
let isInMemoryLoaded = false;

export async function getStations(
  userLocation?: { lat: number; lng: number },
  forceRefresh = false
): Promise<{ stations: FuelStation[]; nationalStats: any }> {
  if (isInMemoryLoaded && !forceRefresh) {
    let resultStations = inMemoryStations;
    if (userLocation) {
      // 1. Fast bounding box filter: ~66km lat, ~65-90km lng
      const bboxLat = 0.6;
      const bboxLng = 0.8;
      const candidates = resultStations.filter(
        (s: any) => Math.abs(s.location.lat - userLocation.lat) < bboxLat &&
                   Math.abs(s.location.lng - userLocation.lng) < bboxLng
      );
      
      // 2. Precise distance mapping
      resultStations = candidates.map((s: any) => ({
        ...s,
        distance: calculateDistance(userLocation.lat, userLocation.lng, s.location.lat, s.location.lng)
      }));

      // 3. Filter distance < 50km and sort
      resultStations = resultStations.filter(
        (s: FuelStation) => s.distance !== undefined && s.distance < 50
      );
      resultStations.sort(
        (a: FuelStation, b: FuelStation) => (a.distance || 0) - (b.distance || 0)
      );
    }
    return {
      stations: resultStations,
      nationalStats: inMemoryNationalStats
    };
  }

  try {
    const OFFLINE_CACHE_NAME = 'stations-offline-cache';
    const GITHUB_URL = 'https://raw.githubusercontent.com/martucc/Fuel-Now/main/public/stations.json';
    const cacheBust = Math.floor(Date.now() / 3600000); // Hourly cache bust to bypass CDN & browser cache
    const FETCH_URL = `${GITHUB_URL}?t=${cacheBust}`;
    let response;
    let fetchedFromGithub = false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      response = await fetch(FETCH_URL, {
        signal: controller.signal,
        cache: 'no-cache'
      });
      clearTimeout(timeoutId);

      if (response && response.ok) {
        fetchedFromGithub = true;
        try {
          const cache = await caches.open(OFFLINE_CACHE_NAME);
          // Store under static clean URL for offline retrieval
          await cache.put(GITHUB_URL, response.clone());
        } catch (cacheErr) {
          console.warn('Failed to save to Cache Storage:', cacheErr);
        }
        try {
          const text = await response.clone().text();
          await Preferences.set({ key: 'mf_offline_stations_backup', value: text });
          console.log('Saved secondary stations backup to Capacitor Preferences');
        } catch (prefErr) {
          console.warn('Failed to save to Capacitor Preferences:', prefErr);
        }
      }
    } catch (e) {
      console.log('Fetching live data from GitHub failed, checking offline cache:', e);
    }

    if (!fetchedFromGithub) {
      try {
        const cache = await caches.open(OFFLINE_CACHE_NAME);
        const cachedResponse = await cache.match(GITHUB_URL);
        if (cachedResponse && cachedResponse.ok) {
          console.log('Successfully retrieved fresh daily stations.json from offline Cache Storage!');
          response = cachedResponse;
        }
      } catch (cacheErr) {
        console.warn('Failed to retrieve from Cache Storage:', cacheErr);
      }
      
      // Fallback a doppio livello: prova a caricare dalle preferenze persistenti
      if (!response || !response.ok) {
        try {
          const backup = await Preferences.get({ key: 'mf_offline_stations_backup' });
          if (backup && backup.value) {
            console.log('Successfully retrieved stations.json from secondary Capacitor Preferences fallback!');
            response = new Response(backup.value);
          }
        } catch (prefErr) {
          console.warn('Failed to retrieve from Capacitor Preferences fallback:', prefErr);
        }
      }
    }

    if (!response || !response.ok) {
      response = await fetch('stations.json');
      if (!response.ok) throw new Error('Failed to fetch stations.json');
    }
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
          address: s.address,
          city: s.city || '',
          distance: userLocation
            ? calculateDistance(userLocation.lat, userLocation.lng, s.lat, s.lng)
            : undefined,
          services,
          location: { lat: s.lat, lng: s.lng },
          prices,
        };
      });

      const now = new Date();
      let communityBlocked: string[] = [];
      try {
        const cbRes = await fetch('community_blocked.json');
        if (cbRes.ok) communityBlocked = await cbRes.json();
      } catch {}

      let finalStations = parsedStations.filter((s: any) => {
        if (communityBlocked.includes(String(s.id))) return false;
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

      if (finalStations.length === 0) {
        console.log('No stations found within 7 days. Relaxing filter to 30 days to avoid blank screen.');
        finalStations = parsedStations.filter((s: any) => {
          if (communityBlocked.includes(String(s.id))) return false;
          if (!s.prices || s.prices.length === 0) return false;
          const lastUp = s.prices[0].lastUpdated;
          const [datePart] = lastUp.split(' ');
          const [y, m, d] = datePart.split('-').map(Number);
          const upDate = new Date(y, m - 1, d);
          const diffDays = (now.getTime() - upDate.getTime()) / (1000 * 60 * 60 * 24);
          
          return diffDays < 30;
        });
      }

      parsedStations = finalStations;

      // Cache the full valid parsed stations and stats in memory
      inMemoryStations = parsedStations;
      inMemoryNationalStats = data.national || {};
      isInMemoryLoaded = true;

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
        nationalStats: inMemoryNationalStats
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

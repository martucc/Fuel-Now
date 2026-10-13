import type { LatLng } from '../domain/geo';

export interface Luogo extends LatLng {
  nome: string;
  dettaglio: string;
}

interface RispostaNominatim {
  lat: string;
  lon: string;
  display_name?: string;
  name?: string;
  address?: Record<string, string>;
}

/**
 * Cerca un luogo in Italia con Nominatim (OpenStreetMap). Senza chiave, ma
 * con una regola: niente raffiche. Chi chiama aspetta che l'utente smetta di
 * scrivere prima di cercare.
 */
export async function cercaLuoghi(testo: string, signal?: AbortSignal): Promise<Luogo[]> {
  const q = testo.trim();
  if (q.length < 3) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&countrycodes=it&accept-language=it&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const dati = (await res.json()) as RispostaNominatim[];
  const visti = new Set<string>();
  const out: Luogo[] = [];
  for (const d of Array.isArray(dati) ? dati : []) {
    const lat = Number(d.lat);
    const lng = Number(d.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const a = d.address ?? {};
    const nome = d.name || a.city || a.town || a.village || a.municipality || (d.display_name ?? '').split(',')[0] || q;
    const dettaglio = [a.county || a.province, a.state].filter(Boolean).join(', ');
    const chiave = `${nome}|${dettaglio}`;
    if (visti.has(chiave)) continue;
    visti.add(chiave);
    out.push({ lat, lng, nome, dettaglio });
  }
  return out;
}

export interface LatLng {
  lat: number;
  lng: number;
}

const R_KM = 6371;
const RAD = Math.PI / 180;

/** Distanza in linea d'aria. Sottostima la strada: vedi assunzioni della spec § 6.3. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLng = (b.lng - a.lng) * RAD;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

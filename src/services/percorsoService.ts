import type { LatLng } from '../domain/geo';
import type { Percorso } from '../domain/corridoio';

/**
 * Il percorso stradale verso casa, chiesto allo stesso router che gia usa
 * la scheda Viaggio.
 *
 * Serve alla modalita rientro: senza, la deviazione si stima col triangolo
 * in linea d'aria, che su strade curve o con un fiume in mezzo sbaglia di
 * chilometri. Se il router non risponde non e un guaio — la Home ripiega
 * sulla stima e lo dichiara — quindi qui nessun errore viene rilanciato.
 */

const OSRM = 'https://router.project-osrm.org/route/v1/driving';

/** Un solo percorso in memoria: quello che serve e sempre l'ultimo. */
let cache: { chiave: string; percorso: Percorso } | null = null;

/**
 * Le coordinate del GPS ballano di qualche metro anche da fermi. Arrotondate
 * a tre decimali (circa cento metri) la chiave resta stabile e non si
 * ribatte al router a ogni respiro del segnale.
 */
function chiaveDi(da: LatLng, a: LatLng): string {
  const r = (n: number) => n.toFixed(3);
  return `${r(da.lat)},${r(da.lng)}->${r(a.lat)},${r(a.lng)}`;
}

export function percorsoInCache(da: LatLng, a: LatLng): Percorso | null {
  if (!cache) return null;
  return cache.chiave === chiaveDi(da, a) ? cache.percorso : null;
}

export async function chiediPercorso(
  da: LatLng,
  a: LatLng,
  segnale?: AbortSignal
): Promise<Percorso | null> {
  const chiave = chiaveDi(da, a);
  if (cache && cache.chiave === chiave) return cache.percorso;

  try {
    const url = `${OSRM}/${da.lng},${da.lat};${a.lng},${a.lat}?overview=full&geometries=geojson`;
    const risposta = await fetch(url, { signal: segnale });
    if (!risposta.ok) return null;

    const dati = await risposta.json();
    const rotta = dati?.routes?.[0];
    const coordinate = rotta?.geometry?.coordinates;
    if (!Array.isArray(coordinate) || coordinate.length < 2) return null;

    // OSRM parla in [lng, lat]; il resto dell'app in {lat, lng}.
    const punti: LatLng[] = coordinate
      .filter((c: unknown): c is [number, number] => Array.isArray(c) && c.length >= 2)
      .map(([lng, lat]) => ({ lat, lng }));
    if (punti.length < 2) return null;

    const km = typeof rotta.distance === 'number' ? rotta.distance / 1000 : 0;
    if (!(km > 0)) return null;

    const percorso: Percorso = { punti, km };
    cache = { chiave, percorso };
    return percorso;
  } catch {
    // Offline, router giu, richiesta annullata: la Home sa cavarsela senza.
    return null;
  }
}

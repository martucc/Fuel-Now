import type { LatLng } from '../domain/geo';

/**
 * Il percorso stradale della scheda Viaggio, chiesto al router OSRM.
 */

const OSRM = 'https://router.project-osrm.org/route/v1/driving';

/**
 * Le coordinate del GPS ballano di qualche metro anche da fermi. Arrotondate
 * a tre decimali (circa cento metri) la chiave resta stabile e non si
 * ribatte al router a ogni respiro del segnale.
 */
function chiaveDi(da: LatLng, a: LatLng): string {
  const r = (n: number) => n.toFixed(3);
  return `${r(da.lat)},${r(da.lng)}->${r(a.lat)},${r(a.lng)}`;
}

/** La prima rotta di una risposta OSRM, o null se non ce n'e una valida. */
function leggiRotta(dati: unknown): PercorsoViaggio | null {
  type Rotta = { distance?: unknown; duration?: unknown; geometry?: { coordinates?: unknown } };
  const rotta = (dati as { routes?: Rotta[] } | null)?.routes?.[0];
  const coordinate = rotta?.geometry?.coordinates;
  if (!rotta || !Array.isArray(coordinate) || coordinate.length < 2) return null;

  // OSRM parla in [lng, lat]; il resto dell'app in {lat, lng}.
  const punti: LatLng[] = coordinate
    .filter((c: unknown): c is [number, number] => Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]))
    .map(([lng, lat]) => ({ lat, lng }));
  if (punti.length < 2) return null;

  const km = typeof rotta.distance === 'number' ? rotta.distance / 1000 : 0;
  if (!(km > 0)) return null;
  const minuti = typeof rotta.duration === 'number' && rotta.duration > 0 ? rotta.duration / 60 : 0;
  return { punti, km, minuti };
}

/** Un percorso da A a B qualunque, con la durata stimata dal router. */
export interface PercorsoViaggio {
  /** Punti della spezzata, dalla partenza all'arrivo. */
  punti: LatLng[];
  /** Lunghezza stradale complessiva in km, dal router. */
  km: number;
  /** Minuti di guida secondo il router: senza traffico, quindi un minimo. */
  minuti: number;
}

/** «rete»: router irraggiungibile o occupato. «nessuno»: fra i due punti non c'e strada. */
export type MotivoErrorePercorso = 'rete' | 'nessuno';

export class ErrorePercorso extends Error {
  readonly motivo: MotivoErrorePercorso;
  constructor(motivo: MotivoErrorePercorso) {
    super(motivo === 'nessuno' ? 'Nessuna strada fra i due punti' : 'Router non raggiungibile');
    this.name = 'ErrorePercorso';
    this.motivo = motivo;
  }
}

/**
 * Gli ultimi viaggi chiesti: tornare a una meta appena vista o scambiare due
 * volte partenza e arrivo non riscarica niente. Una risposta di mille km
 * pesa un megabyte: ne bastano pochi.
 */
const viaggi = new Map<string, PercorsoViaggio>();
const VIAGGI_IN_MEMORIA = 6;

export function viaggioInCache(da: LatLng, a: LatLng): PercorsoViaggio | null {
  return viaggi.get(chiaveDi(da, a)) ?? null;
}

/**
 * Il percorso stradale da `da` ad `a`. Un errore si rilancia: la scheda
 * Viaggio non ha un ripiego, deve dire cosa e andato storto e lasciar
 * riprovare.
 */
export async function chiediViaggio(da: LatLng, a: LatLng, segnale?: AbortSignal): Promise<PercorsoViaggio> {
  const chiave = chiaveDi(da, a);
  const gia = viaggi.get(chiave);
  if (gia) {
    // In fondo alla coda: e il piu recente.
    viaggi.delete(chiave);
    viaggi.set(chiave, gia);
    return gia;
  }

  const url = `${OSRM}/${da.lng},${da.lat};${a.lng},${a.lat}?overview=full&geometries=geojson`;
  let risposta: Response;
  let dati: unknown;
  try {
    risposta = await fetch(url, { signal: segnale });
    dati = await risposta.json().catch(() => null);
  } catch (e) {
    if (segnale?.aborted) throw e;
    throw new ErrorePercorso('rete');
  }
  if (segnale?.aborted) throw new DOMException('Richiesta annullata', 'AbortError');

  // OSRM risponde con un errore anche quando un punto e in mezzo al mare:
  // non e un guasto della rete, e riprovare non serve.
  const codice = (dati as { code?: unknown } | null)?.code;
  if (codice === 'NoRoute' || codice === 'NoSegment') throw new ErrorePercorso('nessuno');
  if (!risposta.ok) throw new ErrorePercorso('rete');

  const percorso = leggiRotta(dati);
  if (!percorso) throw new ErrorePercorso('nessuno');

  viaggi.set(chiave, percorso);
  if (viaggi.size > VIAGGI_IN_MEMORIA) {
    const vecchio = viaggi.keys().next().value;
    if (vecchio !== undefined) viaggi.delete(vecchio);
  }
  return percorso;
}

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

    const rotta = leggiRotta(await risposta.json());
    if (!rotta) return null;

    const percorso: Percorso = { punti: rotta.punti, km: rotta.km };
    cache = { chiave, percorso };
    return percorso;
  } catch {
    // Offline, router giu, richiesta annullata: la Home sa cavarsela senza.
    return null;
  }
}

/* ── Il viaggio della scheda Viaggio ─────────────────────────────────── */

/** Un percorso da A a B qualunque, con la durata stimata dal router. */
export interface PercorsoViaggio extends Percorso {
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
 * Gli ultimi viaggi chiesti, tenuti a parte da quello della Home: tornare a
 * una meta appena vista o scambiare due volte partenza e arrivo non
 * riscarica niente. Una risposta di mille km pesa un megabyte: ne bastano pochi.
 */
const viaggi = new Map<string, PercorsoViaggio>();
const VIAGGI_IN_MEMORIA = 6;

export function viaggioInCache(da: LatLng, a: LatLng): PercorsoViaggio | null {
  return viaggi.get(chiaveDi(da, a)) ?? null;
}

/**
 * Il percorso stradale da `da` ad `a`. A differenza di `chiediPercorso`,
 * qui un errore si rilancia: la scheda Viaggio non ha un ripiego, deve dire
 * cosa e andato storto e lasciar riprovare.
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

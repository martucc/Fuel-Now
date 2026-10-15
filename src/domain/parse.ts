import type { FuelKey, RawStation } from './raw';
import { FUEL_KEYS } from './raw';
import { isPlausible, selectPrice } from './fuel';
import { haversineKm } from './geo';

export interface StationRow {
  id: string;
  name: string;
  brand: string;
  operator: string;
  /** null quando il campo a monte non è una sigla di provincia. */
  prov: string | null;
  city: string;
  address: string;
  isHighway: boolean;
  lat: number;
  lng: number;
  /** Prezzi confrontabili, già passati da selectPrice: sono quelli delle statistiche. */
  prices: Partial<Record<FuelKey, number>>;
  /**
   * Prezzo servito, se plausibile. Mai usato per le statistiche; quando per
   * un carburante manca il self, è il prezzo che si paga (prezzoAllaPompa).
   */
  servito: Partial<Record<FuelKey, number>>;
  updated: string | null;
}

const PROV_RE = /^[A-Z]{2}$/;

export function isValidProv(p: string): boolean {
  return PROV_RE.test(p);
}

export function parseStation(raw: RawStation): StationRow | null {
  if (!Number.isFinite(raw.lat) || !Number.isFinite(raw.lng)) return null;

  const prices: Partial<Record<FuelKey, number>> = {};
  const servito: Partial<Record<FuelKey, number>> = {};
  for (const f of FUEL_KEYS) {
    const pair = raw.p?.[f];
    const price = selectPrice(pair, f);
    if (price !== null) prices[f] = price;
    const s = pair?.[1];
    if (s !== null && s !== undefined && isPlausible(s, f)) servito[f] = s;
  }
  // Una pompa che per il diesel ha solo il servito resta: fuori dalle
  // statistiche, che per diesel e benzina usano il self, ma dentro la lista,
  // al prezzo che si paga davvero. Prima spariva del tutto.
  if (Object.keys(prices).length === 0 && Object.keys(servito).length === 0) return null;

  const prov = typeof raw.prov === 'string' && isValidProv(raw.prov) ? raw.prov : null;

  return {
    id: String(raw.id),
    name: raw.name || 'Distributore',
    brand: raw.brand || 'Indipendente',
    operator: raw.operator || '',
    prov,
    city: raw.city || '',
    address: raw.address || '',
    isHighway: raw.is_highway === true,
    lat: raw.lat,
    lng: raw.lng,
    prices,
    servito,
    updated: raw.updated || null,
  };
}

/**
 * Il prezzo che si paga per quel carburante: il self quando c'è, altrimenti
 * il servito, dichiarato come tale. Per GPL e metano `prices` contiene già
 * il servito quando manca il self (regola della pipeline), quindi qui il
 * servito compare solo per diesel e benzina senza self.
 */
export function prezzoAllaPompa(row: StationRow, fuel: FuelKey): { prezzo: number; alServito: boolean } | null {
  const self = row.prices[fuel];
  if (self !== undefined) return { prezzo: self, alServito: false };
  const servito = row.servito[fuel];
  return servito !== undefined ? { prezzo: servito, alServito: true } : null;
}

export function parseStations(raw: RawStation[]): StationRow[] {
  const out: StationRow[] = [];
  for (const r of raw) {
    const row = parseStation(r);
    if (row) out.push(row);
  }
  return out;
}

/** Mediana: l'unica media che quattro righe sbagliate non spostano. */
function mediana(valori: number[]): number {
  const ordinati = [...valori].sort((a, b) => a - b);
  const meta = ordinati.length >> 1;
  return ordinati.length % 2 ? ordinati[meta]! : (ordinati[meta - 1]! + ordinati[meta]!) / 2;
}

/** Sotto questo numero di impianti la provincia non fa statistica su se stessa. */
const MIN_PER_PROVINCIA = 8;
/** Nessuna provincia italiana e cosi larga: sotto questa soglia non si accusa nessuno. */
const RAGGIO_MINIMO_KM = 25;
/** Quante volte il raggio tipico della provincia prima di gridare all'errore. */
const FATTORE = 8;

/**
 * Righe le cui coordinate non stanno in piedi.
 *
 * Due controlli, entrambi ricavati dai dati stessi e senza tabelle esterne:
 *
 * 1. Due impianti nello stesso identico punto ma in due province diverse.
 *    Quel punto e il ripiego di un geocodificatore che ha fallito, non un
 *    luogo, e non si puo sapere quale delle due righe sia quella giusta.
 * 2. Un impianto lontanissimo dal cuore della sua provincia, misurato sulla
 *    larghezza della provincia stessa: cosi il Salento allungato resta
 *    intero e un impianto di Nuoro trovato a Milano no.
 *
 * Conta perche la distanza entra nel calcolo del netto: un impianto piazzato
 * per sbaglio a un metro dall'utente ha costo strada zero, quindi vince il
 * confronto e diventa il consiglio. Nel dataset di oggi sono quarantaquattro
 * righe su ventunomila.
 *
 * Il prezzo pero e vero: si tolgono dalle scelte, non dalle statistiche di
 * provincia, che restano allineate a quelle calcolate a monte.
 */
/**
 * Il risultato si ricorda per array: buildHomeModel gira due volte a ogni
 * cambio di carburante o di raggio — una per la Home e una per la mappa — e
 * la scansione e su ventunomila righe che non cambiano fra le due.
 */
const memoria = new WeakMap<StationRow[], StationRow[]>();

export function dropMisgeocoded(rows: StationRow[]): StationRow[] {
  const gia = memoria.get(rows);
  if (gia) return gia;

  const sospetti = new Set<string>();

  // 1. stesso punto, province diverse
  const perPunto = new Map<string, StationRow[]>();
  for (const r of rows) {
    const k = `${r.lat},${r.lng}`;
    const gruppo = perPunto.get(k);
    if (gruppo) gruppo.push(r);
    else perPunto.set(k, [r]);
  }
  for (const gruppo of perPunto.values()) {
    if (gruppo.length < 2) continue;
    const province = new Set(gruppo.map((r) => r.prov).filter((p): p is string => p !== null));
    if (province.size > 1) for (const r of gruppo) sospetti.add(r.id);
  }

  // 2. troppo lontano dal cuore della propria provincia
  const perProvincia = new Map<string, StationRow[]>();
  for (const r of rows) {
    if (r.prov === null) continue;
    const gruppo = perProvincia.get(r.prov);
    if (gruppo) gruppo.push(r);
    else perProvincia.set(r.prov, [r]);
  }
  for (const gruppo of perProvincia.values()) {
    if (gruppo.length < MIN_PER_PROVINCIA) continue;
    const centro = {
      lat: mediana(gruppo.map((r) => r.lat)),
      lng: mediana(gruppo.map((r) => r.lng)),
    };
    const raggi = gruppo.map((r) => haversineKm(centro, r));
    const soglia = Math.max(RAGGIO_MINIMO_KM, mediana(raggi) * FATTORE);
    for (let i = 0; i < gruppo.length; i++) {
      if (raggi[i]! > soglia) sospetti.add(gruppo[i]!.id);
    }
  }

  const puliti = sospetti.size === 0 ? rows : rows.filter((r) => !sospetti.has(r.id));
  memoria.set(rows, puliti);
  return puliti;
}

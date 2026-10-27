import type { StationRow } from '../parse';
import type { LatLng } from '../geo';
import type { FuelKey } from '../raw';

/**
 * Dati finti per i test che devono valere con QUALUNQUE stations.json
 * (LEGGIMI § 5). Le coorti si costruiscono con righe messe lontanissimo
 * dall'utente (0° N, 0° E: in mare), cosi pesano nelle statistiche ma non
 * entrano mai fra i candidati di un ranking centrato sull'utente.
 */

/** Il «now» di tutti i test: mezzogiorno del 13 ottobre 2026, ora locale. */
export const ADESSO = new Date(2026, 9, 13, 12, 0);

/** Timestamp nel formato della pipeline, `ore` prima di ADESSO. */
export function oreFa(ore: number): string {
  const t = new Date(ADESSO.getTime() - ore * 3_600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())} ${p(t.getHours())}:${p(t.getMinutes())}`;
}

export const UTENTE: LatLng = { lat: 44.0, lng: 12.0 };

/** Un punto a `est` km a est e `nord` km a nord di `da`. Esatto entro il metro su pochi km. */
export function aKm(est: number, nord = 0, da: LatLng = UTENTE): LatLng {
  return {
    lat: da.lat + nord / 111.32,
    lng: da.lng + est / (111.32 * Math.cos((da.lat * Math.PI) / 180)),
  };
}

let seq = 0;

/** Un impianto stradale a 1 km a est dell'utente, diesel a 2,00, prezzo di due ore fa. */
export function riga(over: Partial<StationRow> = {}): StationRow {
  seq++;
  return {
    id: `s${seq}`,
    name: `Impianto ${seq}`,
    brand: 'Marchio',
    operator: '',
    prov: 'RA',
    city: '',
    address: '',
    isHighway: false,
    ...aKm(1),
    prices: { diesel: 2.0 },
    servito: {},
    updated: oreFa(2),
    ...over,
  };
}

/**
 * Una coorte con media esatta `media` e `n` prezzi equispaziati di `passo`:
 * con 41 prezzi e passo 0,005 lo scarto tipo e ≈ 0,059.
 */
export function coorte(
  prov: string,
  fuel: FuelKey,
  media: number,
  opts: { passo?: number; n?: number; autostrada?: boolean } = {}
): StationRow[] {
  const n = opts.n ?? 41;
  const passo = opts.passo ?? 0.005;
  const meta = (n - 1) / 2;
  return Array.from({ length: n }, (_, i) =>
    riga({
      id: `coorte-${prov}-${fuel}-${opts.autostrada ? 'a' : 's'}-${i}`,
      prov,
      isHighway: opts.autostrada ?? false,
      lat: 0,
      lng: 0,
      prices: { [fuel]: Math.round((media + (i - meta) * passo) * 10000) / 10000 },
    })
  );
}

/** Generatore deterministico (mulberry32): «casuale» ma uguale a ogni run. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Una citta finta: `n` impianti entro `raggioKm`, prezzi intorno a `media` ± `ampiezza`, eta fino a 40 h. */
export function cittaFinta(seed: number, n = 40, raggioKm = 12, media = 2.0, ampiezza = 0.08): StationRow[] {
  const r = rng(seed);
  return Array.from({ length: n }, (_, i) => {
    const ang = r() * 2 * Math.PI;
    const d = Math.sqrt(r()) * raggioKm;
    return riga({
      id: `citta-${seed}-${i}`,
      ...aKm(d * Math.cos(ang), d * Math.sin(ang)),
      prices: { diesel: Math.round((media + (r() - 0.5) * 2 * ampiezza) * 1000) / 1000 },
      updated: oreFa(r() * 40),
    });
  });
}

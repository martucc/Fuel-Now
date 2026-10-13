import type { FuelKey, RawDataset } from './raw';
import type { StationRow } from './parse';
import type { CohortIndex } from './market';
import { MIN_COHORT_N } from './market';
import { ageHours } from './freshness';
import { nomeProvincia } from './province';

/**
 * I numeri di oggi nella scheda Prezzi: la media italiana, quella della tua
 * provincia, e quanti prezzi sono davvero di oggi.
 *
 * La media di provincia e quella della coorte stradale di `market.ts`, la
 * stessa con cui la Home colora i prezzi: se qui dicesse un numero diverso,
 * «sotto la media» vorrebbe dire due cose.
 */

export interface MediaNazionale {
  media: number;
  campione: number;
}

export interface MediaProvincia {
  sigla: string;
  nome: string;
  media: number;
  campione: number;
  /** Centesimi rispetto alla media italiana: negativo = la provincia costa meno. */
  deltaC: number | null;
}

/**
 * Quanto sono freschi i prezzi in tutta Italia, con le soglie di
 * `freshness.ts`: entro un giorno il prezzo vale pieno, oltre tre e vecchio.
 */
export interface Freschezza {
  ultimoGiorno: number;
  entroTreGiorni: number;
  piuVecchi: number;
  /** Righe senza data: vecchie per definizione, contate a parte per onesta. */
  senzaData: number;
  totale: number;
}

export interface QuadroOggi {
  nazionale: MediaNazionale | null;
  provincia: MediaProvincia | null;
  freschezza: Freschezza;
}

export interface QuadroInput {
  rows: readonly StationRow[];
  cohorts: CohortIndex;
  dataset: RawDataset;
  fuel: FuelKey;
  now: Date;
  /** La sigla della provincia dove si trova l'utente, null se non si sa. */
  provincia: string | null;
}

/**
 * La provincia di chi guarda: quella del distributore piu vicino. Non vale
 * una geocodifica inversa, e i vicini arrivano gia ripuliti dalla Home.
 */
export function provinciaPiuVicina(
  vicini: ReadonlyArray<{ id: string; distanceKm: number }>,
  perId: ReadonlyMap<string, StationRow>,
): string | null {
  let migliore: { prov: string; km: number } | null = null;
  for (const v of vicini) {
    const prov = perId.get(v.id)?.prov;
    if (!prov) continue;
    if (!migliore || v.distanceKm < migliore.km) migliore = { prov, km: v.distanceKm };
  }
  return migliore?.prov ?? null;
}

export function mediaNazionale(dataset: RawDataset, cohorts: CohortIndex, fuel: FuelKey): MediaNazionale | null {
  // Quella del backend prima: e la stessa che pubblica il Ministero. Le
  // coorti sono il ripiego per un file che non la porta.
  const n = dataset.national?.[fuel];
  if (n && n.avg > 0) return { media: n.avg, campione: n.n };
  const c = cohorts.byFuel.get(fuel);
  return c && c.n > 0 ? { media: c.avg, campione: c.n } : null;
}

export function mediaProvincia(
  cohorts: CohortIndex,
  sigla: string | null,
  fuel: FuelKey,
  nazionale: MediaNazionale | null,
): MediaProvincia | null {
  if (!sigla) return null;
  const s = cohorts.byProv.get(`${sigla}|road|${fuel}`);
  // Sotto la soglia delle coorti la provincia non fa media: la Home la
  // giudica col paese, e qui si tace invece di mostrare tre impianti.
  if (!s || s.n < MIN_COHORT_N) return null;
  return {
    sigla,
    nome: nomeProvincia(sigla),
    media: s.avg,
    campione: s.n,
    deltaC: nazionale ? (s.avg - nazionale.media) * 100 : null,
  };
}

export function freschezza(rows: readonly StationRow[], fuel: FuelKey, now: Date): Freschezza {
  const f: Freschezza = { ultimoGiorno: 0, entroTreGiorni: 0, piuVecchi: 0, senzaData: 0, totale: 0 };
  // Migliaia di impianti condividono lo stesso orario: si legge una volta.
  const eta = new Map<string, number | null>();
  for (const r of rows) {
    if (r.prices[fuel] === undefined) continue;
    f.totale++;
    const chiave = r.updated ?? '';
    let h = eta.get(chiave);
    if (h === undefined) {
      h = ageHours(r.updated, now);
      eta.set(chiave, h);
    }
    if (h === null) f.senzaData++;
    else if (h <= 24) f.ultimoGiorno++;
    else if (h <= 72) f.entroTreGiorni++;
    else f.piuVecchi++;
  }
  return f;
}

export function quadroOggi(i: QuadroInput): QuadroOggi {
  const nazionale = mediaNazionale(i.dataset, i.cohorts, i.fuel);
  return {
    nazionale,
    provincia: mediaProvincia(i.cohorts, i.provincia, i.fuel, nazionale),
    freschezza: freschezza(i.rows, i.fuel, i.now),
  };
}

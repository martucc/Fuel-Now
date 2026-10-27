import { parseUpdatedAt } from './freshness';
import { FUEL_KEYS } from './raw';
import type { FuelKey, RawDataset, RawPricePair, RawStation, RawStats } from './raw';

/**
 * Il piano B dei prezzi: quando il file su GitHub resta fermo, il telefono
 * chiede i prezzi direttamente al Ministero (la stessa API live che usa
 * `fetch_stations.py`) e li cuce sull'anagrafica che ha già.
 *
 * Il telefono è in Italia e il Ministero non lo blocca, i server di GitHub
 * a volte sì: a metà ottobre 2026 il sito dei CSV ha smesso di rispondere
 * a GitHub e l'app è rimasta con prezzi di giorni prima.
 *
 * Le regole sono quelle dello script, così i due file si somigliano: stessi
 * limiti di prezzo, stesse medie (self per benzina e diesel, il primo
 * prezzo che c'è per GPL e metano).
 */

/** Gli id carburante dell'API live. */
export const CARBURANTE_DA_ID: Readonly<Record<number, FuelKey>> = {
  1: 'benzina',
  2: 'diesel',
  3: 'metano',
  4: 'gpl',
};

/** Fuori da questi limiti il prezzo è un errore di battitura del gestore. */
export const LIMITI_PREZZO: Readonly<Record<FuelKey, readonly [number, number]>> = {
  diesel: [1.0, 3.5],
  benzina: [1.0, 3.5],
  gpl: [0.3, 2.0],
  metano: [0.5, 4.0],
};

/** Prezzi del file più vecchi di così: il telefono prova a chiederli da sé. */
export const PIANO_B_DOPO_ORE = 12;

/** Quello che l'API dice di un impianto, già ripulito. */
export interface ImpiantoMinistero {
  id: number;
  name: string;
  brand: string;
  address: string;
  lat: number | null;
  lng: number | null;
  p: Partial<Record<FuelKey, RawPricePair>>;
  /** "YYYY-MM-DD HH:MM", come `RawStation.updated`. */
  updated: string | null;
}

function numeroOppure(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function testo(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** "2026-10-26T08:15:00+01:00" → "2026-10-26 08:15", l'ora così come la scrive il Ministero. */
export function oraMinistero(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(v);
  return m ? `${m[1]} ${m[2]}` : null;
}

/**
 * I `results` di `search/area`, di una o più regioni, in un impianto per
 * id. Un impianto che compare due volte (ai confini di regione succede)
 * tiene i prezzi di entrambe le risposte e l'ora più recente.
 */
export function leggiRisultati(risultati: readonly unknown[]): Map<number, ImpiantoMinistero> {
  const perId = new Map<number, ImpiantoMinistero>();
  for (const r of risultati) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const id = numeroOppure(o.id);
    if (id === null || !Number.isInteger(id) || id <= 0) continue;

    let imp = perId.get(id);
    if (!imp) {
      const pos = (o.location && typeof o.location === 'object' ? o.location : {}) as Record<string, unknown>;
      imp = {
        id,
        name: testo(o.name),
        brand: testo(o.brand),
        address: testo(o.address),
        lat: numeroOppure(pos.lat),
        lng: numeroOppure(pos.lng),
        p: {},
        updated: null,
      };
      perId.set(id, imp);
    }

    for (const f of Array.isArray(o.fuels) ? o.fuels : []) {
      if (!f || typeof f !== 'object') continue;
      const fo = f as Record<string, unknown>;
      const idCarburante = numeroOppure(fo.fuelId);
      const chiave = idCarburante === null ? undefined : CARBURANTE_DA_ID[idCarburante];
      const prezzo = numeroOppure(fo.price);
      if (!chiave || prezzo === null) continue;
      const [min, max] = LIMITI_PREZZO[chiave];
      if (prezzo < min || prezzo > max) continue;
      const coppia: RawPricePair = imp.p[chiave] ?? [null, null];
      coppia[fo.isSelf ? 0 : 1] = prezzo;
      imp.p[chiave] = coppia;
    }

    const ora = oraMinistero(o.insertDate);
    if (ora && (!imp.updated || ora > imp.updated)) imp.updated = ora;
  }
  return perId;
}

function haPrezzi(p: Partial<Record<FuelKey, RawPricePair>>): boolean {
  return Object.values(p).some((c) => c && (c[0] !== null || c[1] !== null));
}

function nelRiquadroItalia(lat: number, lng: number): boolean {
  return lat > 35 && lat < 48 && lng > 6 && lng < 19;
}

/* ── Statistiche, come in fetch_stations.py ──────────────────────────── */

const SOLO_SELF: ReadonlySet<FuelKey> = new Set(['diesel', 'benzina']);

function prezzoDiRiferimento(chiave: FuelKey, coppia: RawPricePair | undefined): number | null {
  if (!coppia) return null;
  return SOLO_SELF.has(chiave) ? coppia[0] : coppia[0] ?? coppia[1];
}

const arrotonda = (v: number, cifre: number) => Number(v.toFixed(cifre));

function media(v: readonly number[]): number {
  let s = 0;
  for (const x of v) s += x;
  return s / v.length;
}

/** Deviazione standard della popolazione, come `statistics.pstdev`. */
function scarto(v: readonly number[], m: number): number {
  let s = 0;
  for (const x of v) s += (x - m) ** 2;
  return Math.sqrt(s / v.length);
}

/** Quantile con interpolazione lineare, come `quantile` dello script. */
function quantile(ordinati: readonly number[], q: number): number {
  const pos = (ordinati.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, ordinati.length - 1);
  return ordinati[lo] + (ordinati[hi] - ordinati[lo]) * (pos - lo);
}

export function statistiche(stazioni: readonly RawStation[]): Pick<RawDataset, 'national' | 'by_province'> {
  const national: RawDataset['national'] = {};
  for (const chiave of FUEL_KEYS) {
    const v: number[] = [];
    for (const s of stazioni) {
      const p = prezzoDiRiferimento(chiave, s.p[chiave]);
      if (p !== null) v.push(p);
    }
    if (!v.length) {
      national[chiave] = null;
      continue;
    }
    const ordinati = [...v].sort((a, b) => a - b);
    const m = media(v);
    national[chiave] = {
      avg: arrotonda(m, 4),
      min: arrotonda(ordinati[0], 3),
      max: arrotonda(ordinati[ordinati.length - 1], 3),
      n: v.length,
      p10: arrotonda(quantile(ordinati, 0.1), 3),
      p90: arrotonda(quantile(ordinati, 0.9), 3),
      std: v.length > 1 ? arrotonda(scarto(v, m), 4) : 0,
    };
  }

  const perProvincia = new Map<string, Map<FuelKey, number[]>>();
  for (const s of stazioni) {
    if (!s.prov) continue;
    for (const chiave of FUEL_KEYS) {
      const p = prezzoDiRiferimento(chiave, s.p[chiave]);
      if (p === null) continue;
      let prov = perProvincia.get(s.prov);
      if (!prov) perProvincia.set(s.prov, (prov = new Map()));
      let v = prov.get(chiave);
      if (!v) prov.set(chiave, (v = []));
      v.push(p);
    }
  }
  const by_province: RawDataset['by_province'] = {};
  for (const [prov, carburanti] of perProvincia) {
    const riga: Partial<Record<FuelKey, RawStats>> = {};
    for (const [chiave, v] of carburanti) {
      if (v.length < 3) continue; // con meno di tre distributori non è una media
      const m = media(v);
      riga[chiave] = {
        avg: arrotonda(m, 4),
        min: arrotonda(Math.min(...v), 3),
        n: v.length,
        std: v.length > 1 ? arrotonda(scarto(v, m), 4) : 0,
      };
    }
    by_province[prov] = riga;
  }
  return { national, by_province };
}

/* ── Cucitura ────────────────────────────────────────────────────────── */

function dataLocale(d: Date): string {
  const due = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`;
}

/**
 * Il file che si ha, con i prezzi del Ministero sopra.
 *
 * - Un impianto che il Ministero conosce prende i suoi prezzi e la sua ora,
 *   tutti insieme: mescolare un diesel di oggi con una benzina di dieci
 *   giorni fa sotto l'ora di oggi farebbe sembrare fresca la benzina.
 * - Un impianto che il Ministero non nomina resta com'è: la sua ora vecchia
 *   lo fa già trattare come tale.
 * - Un impianto nuovo entra con quel che dice l'API: senza comune e senza
 *   provincia, come fa lo script quando manca l'anagrafica.
 * - Storico e previsione restano quelli del file: sono serie di GitHub.
 */
export function cuciPrezzi(
  base: RawDataset,
  ministero: ReadonlyMap<number, ImpiantoMinistero>,
  generatoIl: Date,
): RawDataset {
  const visti = new Set<number>();
  const stations: RawStation[] = base.stations.map((s) => {
    const m = ministero.get(s.id);
    if (!m) return s;
    visti.add(s.id);
    if (!haPrezzi(m.p)) return s;
    return { ...s, p: m.p, updated: m.updated ?? s.updated };
  });

  for (const m of ministero.values()) {
    if (visti.has(m.id) || !haPrezzi(m.p) || m.lat === null || m.lng === null) continue;
    if (!nelRiquadroItalia(m.lat, m.lng) || !m.updated) continue;
    stations.push({
      id: m.id,
      name: m.name,
      brand: m.brand,
      operator: '',
      type: '',
      is_highway: false,
      address: m.address,
      city: '',
      prov: '',
      lat: arrotonda(m.lat, 6),
      lng: arrotonda(m.lng, 6),
      p: m.p,
      updated: m.updated,
    });
  }

  let ultimo: string | null = null;
  for (const m of ministero.values()) {
    if (m.updated && haPrezzi(m.p) && (!ultimo || m.updated > ultimo)) ultimo = m.updated;
  }

  return {
    ...base,
    extracted_at: dataLocale(generatoIl),
    source: {
      kind: 'telefono',
      name: 'MIMIT Osservaprezzi, chiesti dal telefono',
      generated_at: generatoIl.toISOString(),
      latest_price_at: ultimo ?? base.source?.latest_price_at,
      station_count: stations.length,
    },
    ...statistiche(stations),
    stations,
  };
}

/** Quando è stato pubblicato il prezzo più recente del file (ms), o null se non si sa. */
export function ultimoPrezzoIl(d: RawDataset): number | null {
  return parseUpdatedAt(d.source?.latest_price_at)?.getTime() ?? null;
}

/**
 * Il file è fermo: il prezzo più recente è più vecchio di `PIANO_B_DOPO_ORE`.
 * Lo script gira sei volte al giorno e di giorno qualche gestore cambia
 * sempre prezzo, quindi in condizioni normali il distacco è di poche ore.
 */
export function prezziFermi(d: RawDataset, adesso: number): boolean {
  const t = ultimoPrezzoIl(d);
  return t !== null && adesso - t > PIANO_B_DOPO_ORE * 3_600_000;
}

/** I prezzi a schermo arrivano dal telefono e non da GitHub. */
export function presiDalTelefono(d: RawDataset | null | undefined): boolean {
  return d?.source?.kind === 'telefono';
}

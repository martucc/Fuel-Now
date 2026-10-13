# Fase 2 — Home + Mappa sopra il dominio

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Far vedere all'utente il dominio della fase 1: la Home risponde «dove conviene davvero» col risparmio netto invece del prezzo minimo, e la Mappa colora gli impianti con la scala di livello dichiarando quanti ne sta raggruppando.

**Architecture:** Il dominio (`src/domain/`) è già scritto, testato e non si tocca. La fase 2 costruisce tre strati sopra di esso: `src/data/` che porta `stations.json` dentro `StationRow[]` senza più buttare via i dati vecchi; `src/ui/home/homeModel.ts` e `src/ui/map/cluster.ts`, **funzioni pure** che trasformano righe + coorti nel modello esatto che la schermata mostra; e i componenti React, che diventano renderer sottili senza aritmetica dentro. Le tab non ancora migrate (Trip, Analisi, Garage, Pieno, Allerte) continuano a ricevere `FuelStation[]` da un adattatore, così l'app resta intera a ogni commit.

**Tech Stack:** React 19 + TypeScript, Vite, Tailwind v4, motion/react, react-leaflet, Vitest 4 (environment `node`).

**Spec:** `docs/superpowers/specs/2026-08-19-martuccfuel-redesign-design.md` — in particolare § 6 (algoritmi), § 7 (dati), § 9 (la Home), § 10 (cosa viene rimosso).

**Piano precedente:** `docs/superpowers/plans/2026-08-19-martuccfuel-fase1-fondamenta.md`

---

## Global Constraints

1. **Il dominio non si modifica.** `src/domain/**` è congelato: 87 test lo fissano. Se una schermata ha bisogno di un calcolo che non esiste, si aggiunge una funzione **nuova** con i suoi test, non si cambia una esistente.
2. **Nessun numero nasce nella UI.** Ogni cifra mostrata all'utente viene da `src/domain/` o da un modello puro testato. In un `.tsx` non si scrive aritmetica sui prezzi. `toFixed` per formattare è consentito; `a - b` su due prezzi non lo è.
3. **Il ciano non significa risparmio.** `--mf-accent` è solo per l'azione. Il prezzo si colora **esclusivamente** con `LEVEL_VAR` / `priceColor()`. (Fissato dai test in `src/design/primitives/primitives.test.ts`.)
4. **Token con prefisso `--mf-`.** Tailwind v4 definisce `--font-sans`, `--font-mono`, `--radius-*` nel proprio `@theme`, che vince sul nostro `:root`. Usare sempre e solo `var(--mf-…)`.
5. **Prezzi all'italiana:** tre decimali con la virgola, via `formatEuro()`. Mai `toFixed(3)` scritto a mano in un componente.
6. **Niente `confirm()`, `alert()`, `prompt()`.** La WebView Capacitor li rende male e bloccano il thread.
7. **Vitest gira in `environment: node`** e raccoglie `src/**/*.test.ts` — **non** `.tsx`. Questa fase **non** introduce jsdom né Testing Library: la logica va estratta in moduli `.ts` puri e testata lì; i componenti restano renderer senza decisioni. Vedi «Perché nessun test di componente» qui sotto.
8. **`npm run typecheck:domain` deve restare pulito** e va esteso a `src/data` e ai modelli `src/ui/**/*Model.ts` (Task 1). Regime severo: `strict` + `noUncheckedIndexedAccess`.
9. **Commit in italiano**, formato Conventional Commits, uno per task.
10. **L'app deve restare avviabile a ogni commit.** `npm run build` verde è parte della definizione di «task finito».

### Perché nessun test di componente

Il progetto oggi non ha alcun test di rendering, e introdurre jsdom + Testing Library in questa fase significherebbe aggiungere tre dipendenze e una seconda configurazione di Vitest prima di aver scritto una riga di UI nuova. La scelta alternativa — e quella che questo piano adotta — è **spostare tutto ciò che può sbagliare fuori dai componenti**: `buildHomeModel()` decide chi è il migliore, che colore ha, cosa dice il verdetto e cosa c'è scritto nel velo del tabellone; il `.tsx` non fa che disporre quei valori. Un test di rendering avrebbe verificato che il numero giusto compare in un nodo del DOM; qui il numero giusto è verificato direttamente, sul dataset reale. Ciò che resta non testato è la disposizione visiva, che va comunque guardata con gli occhi (verifica manuale in Task 16).

---

## Struttura dei file

**Nuovi:**

| File | Responsabilità |
|---|---|
| `src/data/adapter.ts` | `StationRow` → `FuelStation` per le tab non migrate |
| `src/data/dataset.ts` | Scarica/recupera `stations.json`, tiene il `RawDataset` in memoria |
| `src/ui/home/homeModel.ts` | Funzione pura: righe + coorti + contesto → modello della Home |
| `src/ui/home/why.ts` | Le righe del conto «Perché?» |
| `src/ui/home/FuelTabs.tsx` | Tab carburante con sottolineatura ciano |
| `src/ui/home/AnswerCard.tsx` | La risposta: verdetto, prezzo 58px, netto, azioni |
| `src/ui/home/Spectrum.tsx` | Barra a gradiente sul range della coorte |
| `src/ui/home/WhySheet.tsx` | Foglio del conto riga per riga |
| `src/ui/home/Tabellone.tsx` | Widget minimappa con velo di riepilogo |
| `src/ui/home/StationRowItem.tsx` | Riga della lista |
| `src/ui/map/cluster.ts` | Raggruppamento dichiarato dei marker |
| `src/ui/chrome/TopBar.tsx` | Barra superiore con marchio e pillola della posizione |
| `src/ui/chrome/NavPill.tsx` | Navigazione flottante in vetro |
| `src/ui/sheets/BlockSheet.tsx` | Foglio «nascondi / segnala», al posto di `confirm()` |

**Modificati:**

| File | Modifica |
|---|---|
| `src/services/dataService.ts` | Riscritto sopra `data/dataset.ts` + `domain/parse.ts`; **via il filtro a 7 giorni** |
| `src/App.tsx:928-937` | `Math.min(...validPrices)` → `pickBest(rankStations(...))` |
| `src/App.tsx:951-972` | `zoomLimit` → `clusterStations()` |
| `src/App.tsx:793` | `confirm()` → `BlockSheet` |
| `src/App.tsx:983-1021` | `<header>` → `<TopBar/>`; `BottomNav` → `NavPill` |
| `src/components/tabs/HomeTab.tsx` | Riscritto come composizione dei componenti `src/ui/home/` |
| `src/components/modals/SettingsModal.tsx` | Accoglie i due bottoni tolti dalla barra |
| `tsconfig.domain.json` | `include` esteso a `src/data` e `src/ui/**/*Model.ts` |

**Cancellati:** `src/services/localAnalysis.ts` (Task 15).

---

## Task 1: Il ponte verso le tab non migrate

Il dominio parla `StationRow` e `FuelKey` (`'benzina'`); il resto dell'app parla `FuelStation` e `FuelType` (`'Benzina'`). `toFuelKey`/`toFuelType` esistono già in `src/domain/fuel.ts`. Manca la conversione della riga intera, che è ciò che tiene in piedi Trip, Analisi, Garage e Pieno mentre la Home passa al dominio.

**Files:**
- Create: `src/data/adapter.ts`
- Test: `src/data/adapter.test.ts`
- Modify: `tsconfig.domain.json`

**Interfaces:**
- Consumes: `StationRow` (`src/domain/parse.ts`), `FUEL_KEYS`/`FuelKey` (`src/domain/raw.ts`), `toFuelType` (`src/domain/fuel.ts`), `haversineKm`/`LatLng` (`src/domain/geo.ts`), `FuelStation`/`FuelPrice` (`src/types.ts`)
- Produces: `toFuelStation(row: StationRow, user?: LatLng): FuelStation`, `toFuelStations(rows: StationRow[], user?: LatLng): FuelStation[]`

- [ ] **Step 1: Estendere il type-check severo ai file nuovi**

In `tsconfig.domain.json`, sostituire il campo `include`:

```json
  "include": ["src/domain", "src/data", "src/ui/**/*Model.ts", "src/ui/map/cluster.ts", "src/ui/home/why.ts"]
```

- [ ] **Step 2: Scrivere il test che fallisce**

Creare `src/data/adapter.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { toFuelStation, toFuelStations } from './adapter';
import type { StationRow } from '../domain/parse';

const row: StationRow = {
  id: '42',
  name: 'Stazione Prova',
  brand: 'Q8',
  operator: 'Tizio',
  prov: 'RM',
  city: 'Roma',
  address: 'Via Prova 1',
  isHighway: false,
  lat: 41.9,
  lng: 12.5,
  prices: { benzina: 1.879, diesel: 1.759 },
  servito: { benzina: 2.049 },
  updated: '2026-08-18 10:00',
};

describe('toFuelStation', () => {
  it('traduce le chiavi carburante nelle etichette che usano le tab vecchie', () => {
    const s = toFuelStation(row);
    const tipi = s.prices.map((p) => p.type).sort();
    expect(tipi).toEqual(['Benzina', 'Benzina', 'Diesel']);
  });

  it('marca self e servito distintamente', () => {
    const s = toFuelStation(row);
    const self = s.prices.filter((p) => p.isSelf);
    const servito = s.prices.filter((p) => !p.isSelf);
    expect(self.map((p) => p.price).sort()).toEqual([1.759, 1.879]);
    expect(servito.map((p) => p.price)).toEqual([2.049]);
  });

  it('mette il prezzo confrontabile per primo, perche le tab vecchie leggono prices.find()', () => {
    const s = toFuelStation(row);
    const primaBenzina = s.prices.find((p) => p.type === 'Benzina');
    expect(primaBenzina?.price).toBe(1.879);
    expect(primaBenzina?.isSelf).toBe(true);
  });

  it('dichiara i servizi che i filtri esistenti si aspettano', () => {
    expect(toFuelStation(row).services).toContain('Self-Service');
    expect(toFuelStation({ ...row, isHighway: true }).services).toContain('Autostrada');
    expect(toFuelStation(row).services).not.toContain('Autostrada');
  });

  it('calcola la distanza solo se sa dov e l utente', () => {
    expect(toFuelStation(row).distance).toBeUndefined();
    const s = toFuelStation(row, { lat: 41.9, lng: 12.5 });
    expect(s.distance).toBe(0);
  });

  it('riporta la distanza in km con un decimale', () => {
    const s = toFuelStation(row, { lat: 41.8, lng: 12.5 });
    expect(s.distance).toBeCloseTo(11.1, 1);
    expect(String(s.distance)).toMatch(/^\d+(\.\d)?$/);
  });

  it('propaga la data di aggiornamento su ogni prezzo', () => {
    for (const p of toFuelStation(row).prices) expect(p.lastUpdated).toBe('2026-08-18 10:00');
  });

  it('non perde stazioni nella conversione in blocco', () => {
    expect(toFuelStations([row, { ...row, id: '43' }])).toHaveLength(2);
  });
});
```

- [ ] **Step 3: Lanciare il test e vederlo fallire**

Run: `npx vitest run src/data/adapter.test.ts`
Expected: FAIL — `Failed to resolve import "./adapter"`.

- [ ] **Step 4: Scrivere l'implementazione minima**

Creare `src/data/adapter.ts`:

```ts
import type { StationRow } from '../domain/parse';
import type { LatLng } from '../domain/geo';
import { haversineKm } from '../domain/geo';
import { FUEL_KEYS } from '../domain/raw';
import { toFuelType } from '../domain/fuel';
import type { FuelPrice, FuelStation } from '../types';

/**
 * Ponte verso le schermate non ancora migrate (Trip, Analisi, Garage, Pieno,
 * Allerte). Il prezzo confrontabile viene messo prima del servito perche
 * quelle schermate leggono `prices.find(p => p.type === fuel)` e si aspettano
 * di trovare il prezzo su cui si decide.
 */
export function toFuelStation(row: StationRow, user?: LatLng): FuelStation {
  const prices: FuelPrice[] = [];
  const updated = row.updated ?? '';

  for (const k of FUEL_KEYS) {
    const self = row.prices[k];
    if (self !== undefined) prices.push({ type: toFuelType(k), price: self, lastUpdated: updated, isSelf: true });
  }
  for (const k of FUEL_KEYS) {
    const srv = row.servito[k];
    if (srv !== undefined) prices.push({ type: toFuelType(k), price: srv, lastUpdated: updated, isSelf: false });
  }

  const services: string[] = [];
  if (prices.some((p) => p.isSelf)) services.push('Self-Service');
  if (row.isHighway) services.push('Autostrada');

  const distance = user
    ? Math.round(haversineKm(user, { lat: row.lat, lng: row.lng }) * 10) / 10
    : undefined;

  return {
    id: row.id,
    name: row.name,
    brand: row.brand || 'Indipendente',
    address: row.address,
    city: row.city,
    distance,
    services,
    location: { lat: row.lat, lng: row.lng },
    prices,
  };
}

export function toFuelStations(rows: StationRow[], user?: LatLng): FuelStation[] {
  return rows.map((r) => toFuelStation(r, user));
}
```

- [ ] **Step 5: Lanciare il test e vederlo passare**

Run: `npx vitest run src/data/adapter.test.ts`
Expected: PASS, 8 test.

- [ ] **Step 6: Verificare il type-check severo**

Run: `npm run typecheck:domain`
Expected: nessun output, uscita 0.

- [ ] **Step 7: Commit**

```bash
git add src/data/adapter.ts src/data/adapter.test.ts tsconfig.domain.json
git commit -m "feat(data): ponte StationRow -> FuelStation per le schermate non migrate"
```

---

## Task 2: Il caricatore del dataset — la cache per prima

`dataService.ts` mescola tre cose: da dove prendere il file, come interpretarlo, e cosa filtrare. Separare la prima è la premessa per buttare via le altre due. Il caricatore restituisce il `RawDataset` intero e lo tiene in memoria: le coorti provinciali hanno bisogno di **tutte** le stazioni, non di quelle entro 50 km.

**L'ordine delle sorgenti è il punto di questo task.** Spec § 7: «si parte **immediatamente** dalla cache (Cache Storage, con Capacitor Preferences come secondo livello). Il download da 7 MB parte dietro e non blocca nulla; quando arriva, i dati si aggiornano senza far sparire la schermata.» Chiedere prima la rete significa, sul telefono in 3G, fino a otto secondi di schermata vuota con i dati di ieri già sul dispositivo. Quindi: si legge la cache, si mostra, e il download parte dietro e avvisa quando ha finito.

**Files:**
- Create: `src/data/dataset.ts`
- Test: `src/data/dataset.test.ts`

**Interfaces:**
- Consumes: `RawDataset` (`src/domain/raw.ts`)
- Produces: `loadDataset(opts?: { force?: boolean }): Promise<RawDataset | null>`, `refreshDataset(): Promise<RawDataset | null>`, `onDatasetUpdate(cb: (d: RawDataset) => void): () => void`, `cachedDataset(): RawDataset | null`, `resetDatasetCache(): void`, `DATASET_URL`, `FETCH_TIMEOUT_MS`

- [ ] **Step 1: Scrivere il test che fallisce**

Creare `src/data/dataset.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { loadDataset, refreshDataset, onDatasetUpdate, cachedDataset, resetDatasetCache } from './dataset';
import type { RawDataset } from '../domain/raw';

function dataset(nome: string): RawDataset {
  return {
    stations: [{ id: 1, name: nome, brand: '', operator: '', prov: 'RM', city: '', address: '',
                 lat: 41.9, lng: 12.5, is_highway: false, p: {}, updated: '2026-08-19 08:00' }],
    national: {}, by_province: {}, forecast: {}, history: {},
  } as unknown as RawDataset;
}

const DA_CACHE = dataset('cache');
const DA_RETE = dataset('rete');

function jsonResponse(body: unknown) {
  const r: any = {
    ok: true,
    clone() { return jsonResponse(body); },
    async json() { return body; },
    async text() { return JSON.stringify(body); },
  };
  return r;
}

/** Cache Storage finta: `match` risponde, `put` non fa nulla. */
function stubCaches(body: unknown | null) {
  vi.stubGlobal('caches', {
    async open() {
      return {
        async match() { return body === null ? undefined : jsonResponse(body); },
        async put() { /* niente */ },
      };
    },
  });
}

beforeEach(() => {
  resetDatasetCache();
  stubCaches(null);
});

afterEach(() => { vi.unstubAllGlobals(); });

describe('loadDataset — spec § 7, la cache per prima', () => {
  it('se la cache ha i dati NON aspetta la rete', async () => {
    stubCaches(DA_CACHE);
    let reteChiamata = false;
    vi.stubGlobal('fetch', vi.fn(async () => {
      reteChiamata = true;
      return jsonResponse(DA_RETE);
    }));

    const d = await loadDataset();
    expect(d?.stations[0]?.name).toBe('cache');
    // Che la rete parta dietro va bene; che il risultato l'abbia attesa no.
    expect(d?.stations[0]?.name).not.toBe('rete');
    void reteChiamata;
  });

  it('senza cache scarica dalla rete', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(DA_RETE)));
    const d = await loadDataset();
    expect(d?.stations[0]?.name).toBe('rete');
  });

  it('il rinfresco dietro aggiorna e avvisa chi ascolta', async () => {
    stubCaches(DA_CACHE);
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(DA_RETE)));

    const visti: string[] = [];
    onDatasetUpdate((d) => { visti.push(String(d.stations[0]?.name)); });

    await loadDataset();
    await refreshDataset();

    expect(visti).toContain('rete');
    expect(cachedDataset()?.stations[0]?.name).toBe('rete');
  });

  it('la seconda chiamata non ricarica: il file pesa 7 MB', async () => {
    const f = vi.fn(async () => jsonResponse(DA_RETE));
    vi.stubGlobal('fetch', f);
    await loadDataset();
    await loadDataset();
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('force ricarica', async () => {
    const f = vi.fn(async () => jsonResponse(DA_RETE));
    vi.stubGlobal('fetch', f);
    await loadDataset();
    await loadDataset({ force: true });
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('se la rete cade ripiega sul file del bundle', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).startsWith('http')) throw new Error('offline');
      return jsonResponse(DA_RETE);
    }));
    expect(await loadDataset()).not.toBeNull();
  });

  it('se nessuna sorgente risponde restituisce null invece di lanciare', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect(await loadDataset()).toBeNull();
  });

  it('scarta una risposta senza array stations: meglio niente che un dataset finto', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ national: {} })));
    expect(await loadDataset()).toBeNull();
  });

  it('un rinfresco fallito NON cancella i dati buoni gia mostrati', async () => {
    stubCaches(DA_CACHE);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    await loadDataset();
    await refreshDataset();
    expect(cachedDataset()?.stations[0]?.name).toBe('cache');
  });

  it('cachedDataset espone quello gia in memoria senza attendere', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(DA_RETE)));
    expect(cachedDataset()).toBeNull();
    await loadDataset();
    expect(cachedDataset()).not.toBeNull();
  });

  it('disiscriversi ferma gli avvisi', async () => {
    stubCaches(DA_CACHE);
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(DA_RETE)));
    let n = 0;
    const off = onDatasetUpdate(() => { n++; });
    off();
    await loadDataset();
    await refreshDataset();
    expect(n).toBe(0);
  });
});
```

- [ ] **Step 2: Lanciare il test e vederlo fallire**

Run: `npx vitest run src/data/dataset.test.ts`
Expected: FAIL — `Failed to resolve import "./dataset"`.

- [ ] **Step 3: Scrivere l'implementazione**

Creare `src/data/dataset.ts`:

```ts
import { Preferences } from '@capacitor/preferences';
import type { RawDataset } from '../domain/raw';

export const DATASET_URL =
  'https://raw.githubusercontent.com/martucc/Fuel-Now/main/public/stations.json';
export const FETCH_TIMEOUT_MS = 8000;

const CACHE_NAME = 'stations-offline-cache';
const BACKUP_KEY = 'mf_offline_stations_backup';

let cache: RawDataset | null = null;
let inFlight: Promise<RawDataset | null> | null = null;
const listeners = new Set<(d: RawDataset) => void>();

export function cachedDataset(): RawDataset | null {
  return cache;
}

export function resetDatasetCache(): void {
  cache = null;
  inFlight = null;
  listeners.clear();
}

/** Avvisa quando il rinfresco dietro ha portato dati nuovi. Restituisce come disiscriversi. */
export function onDatasetUpdate(cb: (d: RawDataset) => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function publish(d: RawDataset): void {
  cache = d;
  for (const cb of listeners) {
    try { cb(d); } catch { /* un ascoltatore rotto non ferma gli altri */ }
  }
}

function isDataset(v: unknown): v is RawDataset {
  return !!v && typeof v === 'object' && Array.isArray((v as RawDataset).stations);
}

async function persist(res: Response): Promise<void> {
  try {
    if (typeof caches !== 'undefined') {
      const c = await caches.open(CACHE_NAME);
      await c.put(DATASET_URL, res.clone());
    }
  } catch { /* la cache e un lusso, non una condizione */ }
  try {
    await Preferences.set({ key: BACKUP_KEY, value: await res.clone().text() });
  } catch { /* idem */ }
}

async function fromNetwork(): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const bust = Math.floor(Date.now() / 3600000);
    const res = await fetch(`${DATASET_URL}?t=${bust}`, { signal: controller.signal, cache: 'no-cache' });
    if (!res || !res.ok) return null;
    const body = await res.clone().json();
    void persist(res);
    return body;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fromCacheStorage(): Promise<unknown | null> {
  try {
    if (typeof caches === 'undefined') return null;
    const c = await caches.open(CACHE_NAME);
    const hit = await c.match(DATASET_URL);
    return hit && hit.ok ? await hit.json() : null;
  } catch {
    return null;
  }
}

async function fromPreferences(): Promise<unknown | null> {
  try {
    const b = await Preferences.get({ key: BACKUP_KEY });
    return b?.value ? JSON.parse(b.value) : null;
  } catch {
    return null;
  }
}

async function fromBundle(): Promise<unknown | null> {
  try {
    const res = await fetch('stations.json');
    return res && res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/**
 * Il download vero. Un fallimento non tocca `cache`: i dati vecchi valgono
 * piu di una schermata vuota, e la loro eta e gia visibile su ogni riga.
 */
export async function refreshDataset(): Promise<RawDataset | null> {
  const v = await fromNetwork();
  if (isDataset(v)) {
    publish(v);
    return v;
  }
  return null;
}

/** Ordine della spec § 7: cache, poi backup, poi bundle. La rete arriva dietro. */
async function firstAvailable(): Promise<RawDataset | null> {
  for (const src of [fromCacheStorage, fromPreferences]) {
    const v = await src();
    if (isDataset(v)) return v;
  }
  const rete = await fromNetwork();
  if (isDataset(rete)) return rete;
  const bundle = await fromBundle();
  return isDataset(bundle) ? bundle : null;
}

export async function loadDataset(opts?: { force?: boolean }): Promise<RawDataset | null> {
  if (opts?.force) return refreshDataset();
  if (cache) return cache;
  if (inFlight) return inFlight;

  inFlight = firstAvailable().then((d) => {
    inFlight = null;
    if (d) cache = d;
    return d;
  });
  return inFlight;
}
```

Nota sul `force`: `refreshDataset()` va in rete e basta. Se la rete non c'è, restituisce `null` e `cache` resta quella buona — chi ha chiesto il rinfresco vede che non è arrivato nulla, non vede sparire i dati.

Nota su chi chiama il rinfresco: `loadDataset()` **non** lo avvia da sé, così resta una funzione con un solo effetto e i test non devono inseguire promesse in volo. È `dataService` (Task 3) a chiamare `refreshDataset()` dopo aver servito la cache.

- [ ] **Step 4: Lanciare il test e vederlo passare**

Run: `npx vitest run src/data/dataset.test.ts`
Expected: PASS, 11 test.

- [ ] **Step 5: Verificare il type-check e la suite intera**

Run: `npm run typecheck:domain && npm test -- --run`
Expected: nessun errore; tutti i test passano.

- [ ] **Step 6: Commit**

```bash
git add src/data/dataset.ts src/data/dataset.test.ts
git commit -m "feat(data): caricatore unico del dataset con ricaduta su cache e bundle"
```

---

## Task 3: Via il filtro a 7 giorni

Spec § 7: «Gli impianti vecchi restano visibili con l'età in evidenza. Il filtro rigido a 7 giorni di `dataService.ts:175` viene rimosso: la penalizzazione avviene nell'algoritmo, non nascondendo dati.» Il coefficiente di fiducia di `freshness.ts` esiste proprio per questo — nasconderli sarebbe applicare la penalità due volte, e la seconda in modo invisibile.

**Files:**
- Modify: `src/services/dataService.ts` (riscrittura completa, 233 → ~60 righe)
- Test: `src/services/dataService.test.ts`

**Interfaces:**
- Consumes: `loadDataset` (Task 2), `toFuelStations` (Task 1), `parseStations` (`src/domain/parse.ts`)
- Produces: firma invariata `getStations(userLocation?, forceRefresh?): Promise<{ stations: FuelStation[]; nationalStats: any }>` più `getRows(): StationRow[]` e `getRawDataset(): RawDataset | null`

- [ ] **Step 1: Scrivere il test che fallisce**

Creare `src/services/dataService.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getStations, getRows } from './dataService';
import { resetDatasetCache } from '../data/dataset';

const OGGI = '2026-08-19 08:00';
const VENTI_GIORNI_FA = '2026-07-30 08:00';

const dataset = {
  stations: [
    { id: 1, name: 'Recente', brand: 'Eni', operator: 'x', prov: 'RM', city: 'Roma',
      address: 'Via A', lat: 41.90, lng: 12.50, is_highway: false,
      p: { benzina: [1.879, null] }, updated: OGGI },
    { id: 2, name: 'Vecchia', brand: 'Q8', operator: 'y', prov: 'RM', city: 'Roma',
      address: 'Via B', lat: 41.91, lng: 12.51, is_highway: false,
      p: { benzina: [1.799, null] }, updated: VENTI_GIORNI_FA },
  ],
  national: {}, by_province: {}, forecast: {}, history: {},
};

beforeEach(() => {
  resetDatasetCache();
  vi.stubGlobal('caches', undefined);
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (String(url).includes('community_blocked')) {
      return { ok: true, async json() { return []; } };
    }
    return {
      ok: true,
      clone() { return this; },
      async json() { return dataset; },
      async text() { return JSON.stringify(dataset); },
    };
  }));
});

afterEach(() => { vi.unstubAllGlobals(); });

describe('getStations — spec § 7', () => {
  it('NON nasconde una stazione vecchia di 20 giorni', async () => {
    const { stations } = await getStations();
    expect(stations.map((s) => s.name).sort()).toEqual(['Recente', 'Vecchia']);
  });

  it("conserva la data di aggiornamento, cosi l'eta puo essere mostrata", async () => {
    const { stations } = await getStations();
    const vecchia = stations.find((s) => s.name === 'Vecchia');
    expect(vecchia?.prices[0]?.lastUpdated).toBe(VENTI_GIORNI_FA);
  });

  it('espone le righe di dominio non filtrate: le coorti hanno bisogno di tutte', async () => {
    await getStations({ lat: 45.0, lng: 9.0 });
    expect(getRows()).toHaveLength(2);
  });

  it('con una posizione ordina per distanza crescente', async () => {
    const { stations } = await getStations({ lat: 41.90, lng: 12.50 });
    expect(stations[0]?.name).toBe('Recente');
    expect(stations[0]?.distance).toBeLessThanOrEqual(stations[1]?.distance ?? Infinity);
  });
});
```

- [ ] **Step 2: Lanciare il test e vederlo fallire**

Run: `npx vitest run src/services/dataService.test.ts`
Expected: FAIL — `getRows is not a function`, e il primo test fallisce perché «Vecchia» viene filtrata.

- [ ] **Step 3: Riscrivere `src/services/dataService.ts`**

Sostituire **l'intero contenuto** del file con:

```ts
import type { FuelStation } from '../types';
import type { StationRow } from '../domain/parse';
import type { RawDataset } from '../domain/raw';
import { parseStations } from '../domain/parse';
import { loadDataset, refreshDataset, cachedDataset } from '../data/dataset';
import { toFuelStations } from '../data/adapter';

/** Raggio oltre il quale una stazione non e piu un'alternativa realistica. */
const NEARBY_KM = 50;
/** Spec § 7: si rinfresca alla ripresa se sono passate piu di sei ore. */
const REFRESH_AFTER_MS = 6 * 60 * 60 * 1000;

let rows: StationRow[] = [];
let blocked: string[] = [];
let servedAt = 0;

export function getRows(): StationRow[] {
  return rows;
}

export function getRawDataset(): RawDataset | null {
  return cachedDataset();
}

async function loadCommunityBlocked(): Promise<void> {
  if (blocked.length > 0) return;
  try {
    const res = await fetch('community_blocked.json');
    if (res.ok) blocked = await res.json();
  } catch { /* la lista e opzionale */ }
}

export async function getStations(
  userLocation?: { lat: number; lng: number },
  forceRefresh = false
): Promise<{ stations: FuelStation[]; nationalStats: any }> {
  const data = await loadDataset({ force: forceRefresh });
  if (!data) return { stations: [], nationalStats: {} };

  // I dati sono gia serviti; il download vero parte adesso e non blocca
  // nessuno. Chi vuole i dati nuovi si iscrive con onDatasetUpdate.
  if (!forceRefresh && Date.now() - servedAt > REFRESH_AFTER_MS) {
    servedAt = Date.now();
    void refreshDataset();
  }

  await loadCommunityBlocked();

  // Le coorti provinciali hanno bisogno del dataset intero: si conserva
  // tutto, e la vista vicina si ricava per selezione.
  rows = parseStations(data.stations).filter((r) => !blocked.includes(r.id));

  let stations = toFuelStations(rows, userLocation);
  if (userLocation) {
    stations = stations
      .filter((s) => s.distance !== undefined && s.distance < NEARBY_KM)
      .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
  }

  return { stations, nationalStats: data.national ?? {} };
}
```

- [ ] **Step 4: Lanciare il test e vederlo passare**

Run: `npx vitest run src/services/dataService.test.ts`
Expected: PASS, 4 test.

- [ ] **Step 5: Verificare che l'app compili ancora**

Run: `npm run build`
Expected: build completata. `getStations` ha la stessa firma, quindi `App.tsx` non cambia.

- [ ] **Step 6: Commit**

```bash
git add src/services/dataService.ts src/services/dataService.test.ts
git commit -m "feat(data): rimosso il filtro a 7 giorni, l'eta penalizza nell'algoritmo"
```

---

## Task 4: Il modello della Home

Qui muore `Math.min`. Una funzione pura riceve righe, coorti e contesto e restituisce **tutto** ciò che la Home mostra: la risposta, il verdetto, lo spettro, le righe della lista, il riepilogo del tabellone. Nessun componente farà un conto.

**Files:**
- Create: `src/ui/home/homeModel.ts`
- Test: `src/ui/home/homeModel.test.ts`

**Interfaces:**
- Consumes: `StationRow`, `CohortIndex`, `rankStations`/`pickBest`/`RankedStation`/`RankContext`, `readForecast`/`adviceOfTheDay`/`ForecastView`/`Advice`, `LEVEL_LABEL`/`PriceLevel`, `describeAge`, `RawDataset`
- Produces: `HomeModel`, `ListItem`, `BoardSummary`, `buildHomeModel(input: HomeInput): HomeModel`, `HomeInput`

- [ ] **Step 1: Scrivere il test che fallisce**

Creare `src/ui/home/homeModel.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildHomeModel } from './homeModel';
import { realDataset } from '../../domain/__fixtures__/dataset';
import { parseStations } from '../../domain/parse';
import { buildCohorts } from '../../domain/market';

const data = realDataset();
const rows = parseStations(data.stations);
const cohorts = buildCohorts(rows);
const ROMA = { lat: 41.9028, lng: 12.4964 };

function model(over: Partial<Parameters<typeof buildHomeModel>[0]> = {}) {
  return buildHomeModel({
    rows, cohorts, dataset: data, fuel: 'benzina', user: ROMA,
    now: new Date('2026-08-19T10:00:00'), liters: 38, kml: 15,
    blocked: new Set<string>(), radiusKm: 15, tankPct: null,
    ...over,
  });
}

describe('buildHomeModel — la risposta', () => {
  it('trova un migliore fra le stazioni romane', () => {
    const m = model();
    expect(m.best).not.toBeNull();
    expect(m.best!.distanceKm).toBeLessThanOrEqual(15);
  });

  it('il migliore NON e sempre il prezzo piu basso: conta il netto', () => {
    // Su tutta l'Italia, con raggio ampio, la stazione col prezzo minimo
    // assoluto e quasi sempre lontanissima. Il migliore per netto no.
    const m = model({ radiusKm: 300 });
    const minimo = Math.min(...m.list.map((i) => i.price));
    expect(m.best!.price).toBeGreaterThanOrEqual(minimo);
    expect(m.best!.distanceKm).toBeLessThan(300);
  });

  it('la lista e ordinata per netto decrescente', () => {
    const nets = model().list.map((i) => i.net);
    for (let i = 1; i < nets.length; i++) expect(nets[i - 1]!).toBeGreaterThanOrEqual(nets[i]!);
  });

  it('la posizione del migliore e dichiarata: "1 di N"', () => {
    const m = model();
    expect(m.bestRank).toBe(1);
    expect(m.eligibleCount).toBe(m.list.filter((i) => i.eligible).length);
  });

  it('ogni riga porta la differenza rispetto al migliore', () => {
    const m = model();
    const primo = m.list.find((i) => i.id === m.best!.row.id);
    expect(primo?.deltaVsBest).toBe(0);
    const altro = m.list.find((i) => i.id !== m.best!.row.id);
    expect(altro?.deltaVsBest).toBeCloseTo(altro!.price - m.best!.price, 6);
  });

  it('rispetta il raggio', () => {
    for (const i of model({ radiusKm: 5 }).list) expect(i.distanceKm).toBeLessThanOrEqual(5);
  });

  it('una stazione bloccata non puo essere la risposta', () => {
    const m = model();
    const id = m.best!.row.id;
    const m2 = model({ blocked: new Set([id]) });
    expect(m2.best?.row.id).not.toBe(id);
  });
});

describe('buildHomeModel — lo spettro', () => {
  it('colloca il prezzo del migliore dentro il range della sua coorte', () => {
    const s = model().spectrum!;
    expect(s.position).toBeGreaterThanOrEqual(0);
    expect(s.position).toBeLessThanOrEqual(1);
    expect(s.min).toBeLessThanOrEqual(s.max);
  });

  it('dichiara da dove viene la coorte e quanti impianti la compongono', () => {
    const s = model().spectrum!;
    expect(s.n).toBeGreaterThanOrEqual(8);
    expect(s.source).toMatch(/province|segment|national/);
  });
});

describe('buildHomeModel — il verdetto', () => {
  it('produce sempre un consiglio con la sua motivazione', () => {
    const m = model();
    expect(m.advice).toBeTruthy();
    expect(m.adviceReason.length).toBeGreaterThan(10);
  });

  it('in riserva il consiglio e URGENT, qualunque cosa dica il prezzo', () => {
    expect(model({ tankPct: 0.05 }).advice).toBe('URGENT');
  });

  it('senza forecast affidabile lo dichiara invece di inventare', () => {
    const senza = { ...data, forecast: {} } as typeof data;
    const m = model({ dataset: senza });
    expect(m.advice).toBe('PRICE-ONLY');
    expect(m.adviceReason).toContain('segnale insufficiente');
  });
});

describe('buildHomeModel — il tabellone', () => {
  it('riassume quanti impianti, il migliore e il peggiore in vista', () => {
    const b = model().board;
    expect(b.count).toBe(model().list.length);
    expect(b.best).toBeLessThanOrEqual(b.worst);
  });

  it('con zero stazioni non si rompe e non inventa numeri', () => {
    const m = model({ user: { lat: 0, lng: 0 }, radiusKm: 1 });
    expect(m.best).toBeNull();
    expect(m.list).toEqual([]);
    expect(m.board.count).toBe(0);
    expect(m.board.best).toBeNull();
    expect(m.spectrum).toBeNull();
  });
});
```

- [ ] **Step 2: Lanciare il test e vederlo fallire**

Run: `npx vitest run src/ui/home/homeModel.test.ts`
Expected: FAIL — `Failed to resolve import "./homeModel"`.

- [ ] **Step 3: Scrivere l'implementazione**

Creare `src/ui/home/homeModel.ts`:

```ts
import type { StationRow } from '../../domain/parse';
import type { CohortIndex, CohortSource } from '../../domain/market';
import type { FuelKey, RawDataset } from '../../domain/raw';
import type { LatLng } from '../../domain/geo';
import type { PriceLevel } from '../../domain/pricing';
import type { RankedStation } from '../../domain/ranking';
import type { Advice, ForecastView } from '../../domain/forecast';
import { rankStations, pickBest } from '../../domain/ranking';
import { readForecast, adviceOfTheDay } from '../../domain/forecast';
import { LEVEL_LABEL } from '../../domain/pricing';
import { describeAge } from '../../domain/freshness';

export interface HomeInput {
  rows: StationRow[];
  cohorts: CohortIndex;
  dataset: RawDataset;
  fuel: FuelKey;
  user: LatLng;
  now: Date;
  liters: number;
  kml: number;
  blocked: Set<string>;
  radiusKm: number;
  /** Frazione di serbatoio residua, null se ignota. */
  tankPct: number | null;
}

export interface ListItem {
  id: string;
  name: string;
  brand: string;
  city: string;
  lat: number;
  lng: number;
  price: number;
  level: PriceLevel;
  levelLabel: string;
  reliable: boolean;
  distanceKm: number;
  ageLabel: string;
  net: number;
  /** Quanto costa in piu al litro rispetto al migliore. 0 per il migliore. */
  deltaVsBest: number;
  eligible: boolean;
}

export interface Spectrum {
  min: number;
  max: number;
  avg: number;
  price: number;
  /** Posizione del prezzo nel range, da 0 (minimo) a 1 (massimo). */
  position: number;
  n: number;
  source: CohortSource;
  reliable: boolean;
}

export interface BoardSummary {
  count: number;
  best: number | null;
  worst: number | null;
}

export interface HomeModel {
  best: RankedStation | null;
  bestRank: number | null;
  eligibleCount: number;
  list: ListItem[];
  spectrum: Spectrum | null;
  board: BoardSummary;
  forecast: ForecastView | null;
  advice: Advice;
  adviceReason: string;
}

function toItem(r: RankedStation, bestPrice: number | null): ListItem {
  return {
    id: r.row.id,
    name: r.row.name,
    brand: r.row.brand,
    city: r.row.city,
    lat: r.row.lat,
    lng: r.row.lng,
    price: r.price,
    level: r.level,
    levelLabel: LEVEL_LABEL[r.level],
    reliable: r.reliable,
    distanceKm: r.distanceKm,
    ageLabel: describeAge(r.ageH),
    net: r.net.net,
    deltaVsBest: bestPrice === null ? 0 : r.price - bestPrice,
    eligible: r.eligible,
  };
}

export function buildHomeModel(i: HomeInput): HomeModel {
  const ranked = rankStations(i.rows, {
    fuel: i.fuel, user: i.user, cohorts: i.cohorts, now: i.now,
    liters: i.liters, kml: i.kml, blocked: i.blocked,
  }).filter((r) => r.distanceKm <= i.radiusKm);

  const best = pickBest(ranked);
  const list = ranked.map((r) => toItem(r, best ? best.price : null));

  const bestRank = best ? ranked.findIndex((r) => r.row.id === best.row.id) + 1 : null;
  const eligibleCount = ranked.filter((r) => r.eligible).length;

  const spectrum: Spectrum | null = best
    ? {
        min: best.cohort.min,
        max: best.cohort.max,
        avg: best.cohort.avg,
        price: best.price,
        position:
          best.cohort.max > best.cohort.min
            ? clamp01((best.price - best.cohort.min) / (best.cohort.max - best.cohort.min))
            : 0,
        n: best.cohort.n,
        source: best.cohort.source,
        reliable: best.reliable,
      }
    : null;

  const prices = list.map((x) => x.price);
  const board: BoardSummary = {
    count: list.length,
    best: prices.length ? Math.min(...prices) : null,
    worst: prices.length ? Math.max(...prices) : null,
  };

  const forecast = readForecast(i.dataset, i.fuel);
  const { advice, reason } = adviceOfTheDay({
    bestLevel: best ? best.level : null,
    forecast,
    tankPct: i.tankPct,
  });

  return { best, bestRank, eligibleCount, list, spectrum, board, forecast, advice, adviceReason: reason };
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
```

Nota: `board.best`/`board.worst` usano `Math.min`/`Math.max` per **descrivere** il range mostrato nel velo del tabellone, non per scegliere. La scelta resta `pickBest`.

- [ ] **Step 4: Lanciare il test e vederlo passare**

Run: `npx vitest run src/ui/home/homeModel.test.ts`
Expected: PASS, 13 test.

- [ ] **Step 5: Verificare il type-check severo**

Run: `npm run typecheck:domain`
Expected: nessun errore.

- [ ] **Step 6: Commit**

```bash
git add src/ui/home/homeModel.ts src/ui/home/homeModel.test.ts
git commit -m "feat(ui): modello della Home, il migliore per netto e non per prezzo minimo"
```

---

## Task 5: Il conto del «Perché?»

Spec § 6.3: «Il bottone "Perché?" apre il conto riga per riga con i numeri dell'utente: litri, media provinciale, risparmio lordo, km, consumo, costo strada, età del dato, coefficiente, netto. Nessuna scatola nera.» Le righe vanno costruite dal `NetBreakdown` già calcolato, non ricalcolate: se il foglio rifacesse i conti potrebbe mostrare un totale diverso da quello su cui si è deciso.

**Files:**
- Create: `src/ui/home/why.ts`
- Test: `src/ui/home/why.test.ts`

**Interfaces:**
- Consumes: `RankedStation` (`src/domain/ranking.ts`), `describeAge` (`src/domain/freshness.ts`)
- Produces: `WhyRow { label: string; value: string; emphasis?: boolean }`, `whyRows(r: RankedStation): WhyRow[]`

- [ ] **Step 1: Scrivere il test che fallisce**

Creare `src/ui/home/why.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { whyRows } from './why';
import type { RankedStation } from '../../domain/ranking';
import { netSaving } from '../../domain/ranking';

const cohort = { avg: 1.95, std: 0.04, min: 1.82, max: 2.10, n: 120, source: 'province-road' as const, reliable: true };
const net = netSaving({ price: 1.879, cohortAvg: 1.95, liters: 38, distanceKm: 3.2, kml: 15, confidence: 0.9 });

const r: RankedStation = {
  row: { id: '1', name: 'X', brand: 'Eni', operator: '', prov: 'RM', city: 'Roma', address: '',
         isHighway: false, lat: 41.9, lng: 12.5, prices: { benzina: 1.879 }, servito: {}, updated: '2026-08-19 08:00' },
  price: 1.879, distanceKm: 3.2, cohort, z: -1.775, level: 'best', reliable: true,
  ageH: 6, confidence: 0.9, net, eligible: true,
};

describe('whyRows', () => {
  it('mostra ogni ingresso del conto, in ordine', () => {
    const etichette = whyRows(r).map((x) => x.label);
    expect(etichette).toEqual([
      'Litri considerati',
      'Media della zona',
      'Prezzo qui',
      'Risparmio lordo',
      'Distanza (andata e ritorno)',
      'Consumo stimato',
      'Costo del viaggio',
      "Eta del dato",
      'Coefficiente di fiducia',
      'In tasca',
    ]);
  });

  it('il netto e quello gia calcolato, non uno ricalcolato dal foglio', () => {
    const riga = whyRows(r).find((x) => x.label === 'In tasca');
    expect(riga?.value).toContain(net.net.toFixed(2).replace('.', ','));
    expect(riga?.emphasis).toBe(true);
  });

  it('la distanza dichiara che e andata e ritorno', () => {
    const riga = whyRows(r).find((x) => x.label.startsWith('Distanza'));
    expect(riga?.value).toContain('6,4');
  });

  it("l'eta e scritta a parole, non in ore grezze", () => {
    const riga = whyRows(r).find((x) => x.label.startsWith('Eta'));
    expect(riga?.value).not.toMatch(/^\d+$/);
  });

  it('nessuna riga resta vuota: una scatola nera parziale e sempre una scatola nera', () => {
    for (const x of whyRows(r)) expect(x.value.trim().length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Lanciare il test e vederlo fallire**

Run: `npx vitest run src/ui/home/why.test.ts`
Expected: FAIL — modulo inesistente.

- [ ] **Step 3: Scrivere l'implementazione**

Creare `src/ui/home/why.ts`:

```ts
import type { RankedStation } from '../../domain/ranking';
import { describeAge } from '../../domain/freshness';

export interface WhyRow {
  label: string;
  value: string;
  emphasis?: boolean;
}

function euro(v: number): string {
  return `${v.toFixed(2).replace('.', ',')} €`;
}

function litri(v: number): string {
  return `${v.toFixed(3).replace('.', ',')} €/L`;
}

function km(v: number): string {
  return `${v.toFixed(1).replace('.', ',')} km`;
}

/** Il conto e costruito dal NetBreakdown gia usato per decidere: mai rifatto. */
export function whyRows(r: RankedStation): WhyRow[] {
  const n = r.net;
  return [
    { label: 'Litri considerati', value: `${n.liters.toFixed(0)} L` },
    { label: 'Media della zona', value: litri(n.cohortAvg) },
    { label: 'Prezzo qui', value: litri(n.price) },
    { label: 'Risparmio lordo', value: euro(n.gross) },
    { label: 'Distanza (andata e ritorno)', value: km(n.distanceKm * 2) },
    { label: 'Consumo stimato', value: `${n.kml.toFixed(1).replace('.', ',')} km/L` },
    { label: 'Costo del viaggio', value: `− ${euro(n.roadCost)}` },
    { label: 'Eta del dato', value: describeAge(r.ageH) },
    { label: 'Coefficiente di fiducia', value: `× ${n.confidence.toFixed(2).replace('.', ',')}` },
    { label: 'In tasca', value: euro(n.net), emphasis: true },
  ];
}
```

- [ ] **Step 4: Lanciare il test e vederlo passare**

Run: `npx vitest run src/ui/home/why.test.ts`
Expected: PASS, 5 test.

- [ ] **Step 5: Commit**

```bash
git add src/ui/home/why.ts src/ui/home/why.test.ts
git commit -m "feat(ui): il conto del \"Perche?\" riga per riga dal netto gia calcolato"
```

---

## Task 6: Il raggruppamento dichiarato dei marker

Spec § 10: «`zoomLimit` come cap silenzioso sui marker — sostituito da un clustering che dichiara quanti impianti sta raggruppando». Oggi `App.tsx:952` mostra 2 marker a zoom basso e tace sugli altri: l'utente crede che in Lombardia ci siano due distributori.

**Files:**
- Create: `src/ui/map/cluster.ts`
- Test: `src/ui/map/cluster.test.ts`

**Interfaces:**
- Consumes: `ListItem` (Task 4), `PriceLevel`
- Produces: `Cluster`, `clusterStations(items: ListItem[], zoom: number): Cluster[]`, `cellSizeForZoom(zoom: number): number`

- [ ] **Step 1: Scrivere il test che fallisce**

Creare `src/ui/map/cluster.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { clusterStations, cellSizeForZoom } from './cluster';
import type { ListItem } from '../home/homeModel';

function item(id: string, lat: number, lng: number, price: number, level: ListItem['level'] = 'normal'): ListItem {
  return {
    id, name: `S${id}`, brand: 'Eni', city: 'Roma', lat, lng, price, level,
    levelLabel: 'Nella media', reliable: true, distanceKm: 1, ageLabel: 'oggi',
    net: 0, deltaVsBest: 0, eligible: true,
  };
}

describe('cellSizeForZoom', () => {
  it('a zoom alto le celle sono piu piccole', () => {
    expect(cellSizeForZoom(16)).toBeLessThan(cellSizeForZoom(8));
  });

  it('e sempre positiva', () => {
    for (const z of [1, 5, 8, 10, 12, 14, 16, 18, 20]) expect(cellSizeForZoom(z)).toBeGreaterThan(0);
  });
});

describe('clusterStations', () => {
  it('a zoom massimo ogni stazione resta sola', () => {
    const items = [item('a', 41.900, 12.500, 1.8), item('b', 41.901, 12.501, 1.9)];
    const cs = clusterStations(items, 18);
    expect(cs).toHaveLength(2);
    expect(cs.every((c) => c.count === 1)).toBe(true);
  });

  it('a zoom basso stazioni vicine finiscono in un solo gruppo', () => {
    const items = [item('a', 41.90, 12.50, 1.8), item('b', 41.91, 12.51, 1.9), item('c', 41.92, 12.52, 2.0)];
    const cs = clusterStations(items, 6);
    expect(cs).toHaveLength(1);
    expect(cs[0]!.count).toBe(3);
  });

  it('NON perde nessuna stazione: il totale dei gruppi eguaglia il totale in ingresso', () => {
    const items = Array.from({ length: 200 }, (_, i) =>
      item(String(i), 41 + (i % 20) * 0.05, 12 + Math.floor(i / 20) * 0.05, 1.7 + (i % 7) * 0.02));
    for (const z of [4, 8, 11, 14, 17]) {
      const tot = clusterStations(items, z).reduce((s, c) => s + c.count, 0);
      expect(tot).toBe(200);
    }
  });

  it('il gruppo dichiara il prezzo migliore che contiene', () => {
    const items = [item('a', 41.90, 12.50, 1.999), item('b', 41.91, 12.51, 1.799)];
    const c = clusterStations(items, 6)[0]!;
    expect(c.bestPrice).toBe(1.799);
    expect(c.bestId).toBe('b');
  });

  it('il gruppo prende il livello del suo membro migliore, cosi il colore non mente', () => {
    const items = [item('a', 41.90, 12.50, 1.999, 'worst'), item('b', 41.91, 12.51, 1.799, 'best')];
    expect(clusterStations(items, 6)[0]!.level).toBe('best');
  });

  it('il gruppo si posa sul suo membro migliore, non su un baricentro inventato', () => {
    const items = [item('a', 41.90, 12.50, 1.999), item('b', 41.95, 12.55, 1.799)];
    const c = clusterStations(items, 6)[0]!;
    expect(c.lat).toBe(41.95);
    expect(c.lng).toBe(12.55);
  });

  it('con nessuna stazione restituisce nessun gruppo', () => {
    expect(clusterStations([], 12)).toEqual([]);
  });
});
```

- [ ] **Step 2: Lanciare il test e vederlo fallire**

Run: `npx vitest run src/ui/map/cluster.test.ts`
Expected: FAIL — modulo inesistente.

- [ ] **Step 3: Scrivere l'implementazione**

Creare `src/ui/map/cluster.ts`:

```ts
import type { ListItem } from '../home/homeModel';
import type { PriceLevel } from '../../domain/pricing';

export interface Cluster {
  /** Id del membro migliore: e lui a dare posizione, prezzo e colore. */
  bestId: string;
  lat: number;
  lng: number;
  bestPrice: number;
  level: PriceLevel;
  /** Quante stazioni rappresenta. 1 = marker singolo. */
  count: number;
  members: ListItem[];
}

/**
 * Lato della cella in gradi. A zoom 18 e sotto la distanza fra due impianti
 * distinti; a zoom 4 copre mezza regione. Non e una proiezione esatta —
 * serve solo a decidere chi sta con chi.
 */
export function cellSizeForZoom(zoom: number): number {
  const z = Math.max(1, Math.min(20, zoom));
  return 180 / Math.pow(2, z);
}

export function clusterStations(items: ListItem[], zoom: number): Cluster[] {
  const cell = cellSizeForZoom(zoom);
  const buckets = new Map<string, ListItem[]>();

  for (const it of items) {
    const key = `${Math.floor(it.lat / cell)}|${Math.floor(it.lng / cell)}`;
    const b = buckets.get(key);
    if (b) b.push(it);
    else buckets.set(key, [it]);
  }

  const out: Cluster[] = [];
  for (const members of buckets.values()) {
    let best = members[0]!;
    for (const m of members) if (m.price < best.price) best = m;
    out.push({
      bestId: best.id,
      lat: best.lat,
      lng: best.lng,
      bestPrice: best.price,
      level: best.level,
      count: members.length,
      members,
    });
  }

  out.sort((a, b) => a.bestPrice - b.bestPrice);
  return out;
}
```

- [ ] **Step 4: Lanciare il test e vederlo passare**

Run: `npx vitest run src/ui/map/cluster.test.ts`
Expected: PASS, 8 test.

- [ ] **Step 5: Verificare il type-check severo**

Run: `npm run typecheck:domain`
Expected: nessun errore.

- [ ] **Step 6: Commit**

```bash
git add src/ui/map/cluster.ts src/ui/map/cluster.test.ts
git commit -m "feat(ui): raggruppamento dei marker che dichiara quanti impianti nasconde"
```

---

## Task 7: Innestare il dominio in `App.tsx`

Il momento in cui `Math.min(...validPrices)` sparisce dall'app. `App.tsx` costruisce le coorti una volta sola e chiama `buildHomeModel`; le tab vecchie continuano a ricevere quello che ricevevano.

**Files:**
- Modify: `src/App.tsx` (import in testa; blocco 911-972)

**Interfaces:**
- Consumes: `buildHomeModel`/`HomeModel` (Task 4), `buildCohorts` (`src/domain/market.ts`), `getRows`/`getRawDataset` (Task 3), `toFuelKey` (`src/domain/fuel.ts`), `litersFor`/`kmlFor` (`src/domain/units.ts`), `clusterStations` (Task 6)
- Produces: le variabili `homeModel`, `cohorts`, `clusters` disponibili nel corpo di `App`

- [ ] **Step 1: Aggiungere gli import**

In `src/App.tsx`, subito dopo la riga 8 (`import { buildLocalMarketAnalysis, calculateMarketStats } from './services/localAnalysis';`), inserire:

```ts
import { getRows, getRawDataset } from './services/dataService';
import { buildCohorts } from './domain/market';
import { toFuelKey } from './domain/fuel';
import { litersFor, kmlFor } from './domain/units';
import { buildHomeModel } from './ui/home/homeModel';
import { clusterStations } from './ui/map/cluster';
```

Nota: la riga 6 importa già `getStations` da `./services/dataService`; unire i due import in uno solo per non avere due `import` dallo stesso modulo.

- [ ] **Step 2: Costruire le coorti e il modello**

Sostituire il blocco `src/App.tsx:928-937` (le due `useMemo` `validPrices` e `cheapP`) con:

```ts
  // Le coorti si costruiscono sul dataset intero: una stazione di Bolzano
  // serve a dire se un prezzo di Bolzano e caro, anche se l'utente e a Roma.
  const cohorts = useMemo(() => buildCohorts(getRows()), [stations]);

  const homeModel = useMemo(() => {
    const data = getRawDataset();
    const rows = getRows();
    if (!data || rows.length === 0 || !userLoc) return null;
    return buildHomeModel({
      rows,
      cohorts,
      dataset: data,
      fuel: toFuelKey(fuel),
      user: userLoc,
      now: new Date(),
      liters: litersFor(selCar),
      kml: kmlFor(selCar, toFuelKey(fuel), null),
      blocked: new Set(blockedIds),
      radiusKm: radius,
      tankPct: null,
    });
  }, [cohorts, stations, fuel, userLoc, selCar, blockedIds, radius]);

  // Il migliore e quello col netto piu alto, non col prezzo piu basso.
  const cheapP = homeModel?.best?.price ?? Infinity;
```

Se il nome della variabile di posizione in `App.tsx` non è `userLoc`, usare quello effettivo (cercarlo con `grep -n "userLoc\|useState.*lat" src/App.tsx`) e adattare; `homeModel` resta `null` finché la posizione non c'è.

- [ ] **Step 3: Sostituire `zoomLimit` col raggruppamento**

Sostituire il blocco `src/App.tsx:951-972` (`zoomLimit`, `visibleStations`, `mapSt`) con:

```ts
  const visibleStations = useMemo(() => {
    if (!mapBounds) return filtered;
    const sw = mapBounds.getSouthWest();
    const ne = mapBounds.getNorthEast();
    const latPad = (ne.lat - sw.lat) * 0.1;
    const lngPad = (ne.lng - sw.lng) * 0.1;
    return filtered.filter(
      (s) =>
        s.location.lat >= sw.lat - latPad && s.location.lat <= ne.lat + latPad &&
        s.location.lng >= sw.lng - lngPad && s.location.lng <= ne.lng + lngPad
    );
  }, [filtered, mapBounds]);

  // Niente piu cap silenzioso: ogni impianto finisce in un gruppo, e il
  // gruppo dichiara quanti ne contiene.
  const clusters = useMemo(() => {
    const inView = new Set(visibleStations.map((s) => s.id));
    const items = (homeModel?.list ?? []).filter((i) => inView.has(i.id));
    return clusterStations(items, mapZoom);
  }, [visibleStations, homeModel, mapZoom]);

  const mapSt = visibleStations;
```

- [ ] **Step 4: Verificare che compili e che la suite regga**

Run: `npm run build && npm test -- --run`
Expected: build completata; 40+ test verdi.

- [ ] **Step 5: Verificare a occhio che l'app parta**

Run: `npm run dev`, aprire `http://localhost:5173`, concedere la posizione.
Expected: la Home carica; il prezzo grande può essere diverso da prima — è il punto: ora è il migliore per netto. Chiudere il server con:
`Get-NetTCPConnection -LocalPort 5173 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): il migliore e il netto piu alto, i marker non spariscono piu in silenzio"
```

---

## Task 8: Tab carburante con sottolineatura

Spec § 9.2: «testo con sottolineatura ciano, non chip».

**Files:**
- Create: `src/ui/home/FuelTabs.tsx`

**Interfaces:**
- Consumes: `FuelKey`/`FUEL_KEYS` (`src/domain/raw.ts`), `FUEL_LABEL` (`src/domain/fuel.ts`)
- Produces: `<FuelTabs value={FuelKey} onChange={(f: FuelKey) => void} />`

- [ ] **Step 1: Scrivere il componente**

Creare `src/ui/home/FuelTabs.tsx`:

```tsx
import { motion } from 'motion/react';
import type { FuelKey } from '../../domain/raw';
import { FUEL_KEYS } from '../../domain/raw';
import { FUEL_LABEL } from '../../domain/fuel';

interface Props {
  value: FuelKey;
  onChange: (f: FuelKey) => void;
}

export function FuelTabs({ value, onChange }: Props) {
  return (
    <div className="flex items-end gap-6" style={{ fontFamily: 'var(--mf-font-sans)' }}>
      {FUEL_KEYS.map((k) => {
        const active = k === value;
        return (
          <button
            key={k}
            onClick={() => onChange(k)}
            className="relative pb-2 transition-opacity"
            style={{
              color: active ? 'var(--mf-ink)' : 'var(--mf-ink-2)',
              fontWeight: active ? 700 : 500,
              fontSize: 16,
              opacity: active ? 1 : 0.7,
            }}
          >
            {FUEL_LABEL[k]}
            {active && (
              <motion.span
                layoutId="mf-fuel-underline"
                className="absolute left-0 right-0 bottom-0"
                style={{ height: 2, background: 'var(--mf-accent)', borderRadius: 2 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verificare che compili**

Run: `npm run build`
Expected: build completata.

- [ ] **Step 3: Commit**

```bash
git add src/ui/home/FuelTabs.tsx
git commit -m "feat(ui): tab carburante con sottolineatura ciano"
```

---

## Task 9: Lo spettro e la risposta

Il cuore visivo della Home: la barra a gradiente col segno bianco sulla propria posizione, e la card che dà la risposta.

**Files:**
- Create: `src/ui/home/Spectrum.tsx`, `src/ui/home/AnswerCard.tsx`

**Interfaces:**
- Consumes: `Spectrum`/`HomeModel` (Task 4), `PriceText` e `formatEuro` (`src/design/primitives/PriceText.tsx`), `Pill` (`src/design/primitives/Pill.tsx`), `LEVEL_LABEL` (`src/domain/pricing.ts`), `describeAge` (`src/domain/freshness.ts`)
- Produces: `<SpectrumBar spectrum={Spectrum} />`, `<AnswerCard model={HomeModel} onNavigate={() => void} onWhy={() => void} />`

- [ ] **Step 1: Scrivere `Spectrum.tsx`**

Creare `src/ui/home/Spectrum.tsx`:

```tsx
import type { Spectrum } from './homeModel';
import { formatEuro } from '../../design/primitives/PriceText';

const SOURCE_LABEL: Record<string, string> = {
  'province-road': 'provincia',
  'province-highway': 'provincia, autostrada',
  'segment-road': 'strade ordinarie',
  'segment-highway': 'autostrade',
  national: 'Italia',
};

export function SpectrumBar({ spectrum }: { spectrum: Spectrum }) {
  const pct = `${(spectrum.position * 100).toFixed(1)}%`;
  return (
    <div className="w-full">
      <div
        className="relative h-2 w-full overflow-hidden"
        style={{
          borderRadius: 'var(--mf-radius-pill)',
          background:
            'linear-gradient(90deg, var(--mf-price-best), var(--mf-price-good), var(--mf-price-normal), var(--mf-price-high), var(--mf-price-worst))',
        }}
      >
        <span
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
          style={{
            left: pct,
            width: 3,
            height: 16,
            borderRadius: 2,
            background: 'var(--mf-ink)',
            boxShadow: '0 0 6px rgba(0,0,0,.6)',
          }}
        />
      </div>
      <div
        className="mf-label mt-2 flex items-center justify-between"
        style={{ color: 'var(--mf-ink-2)', fontSize: 11 }}
      >
        <span>{formatEuro(spectrum.min)}</span>
        <span>
          {SOURCE_LABEL[spectrum.source] ?? spectrum.source} · {spectrum.n} impianti
          {!spectrum.reliable && ' · stima larga'}
        </span>
        <span>{formatEuro(spectrum.max)}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Scrivere `AnswerCard.tsx`**

Creare `src/ui/home/AnswerCard.tsx`:

```tsx
import { Navigation, HelpCircle } from 'lucide-react';
import type { HomeModel } from './homeModel';
import { SpectrumBar } from './Spectrum';
import { PriceText } from '../../design/primitives/PriceText';
import { Pill } from '../../design/primitives/Pill';
import { LEVEL_LABEL } from '../../domain/pricing';
import { describeAge } from '../../domain/freshness';

interface Props {
  model: HomeModel;
  onNavigate: () => void;
  onWhy: () => void;
}

export function AnswerCard({ model, onNavigate, onWhy }: Props) {
  const best = model.best;
  if (!best) {
    return (
      <div
        className="p-6 text-center"
        style={{
          background: 'var(--mf-surface)',
          borderRadius: 'var(--mf-radius-lg)',
          border: '1px solid var(--mf-hairline)',
          color: 'var(--mf-ink-2)',
        }}
      >
        Nessun impianto confrontabile in questo raggio.
      </div>
    );
  }

  return (
    <div
      className="p-6"
      style={{
        background: 'var(--mf-surface)',
        borderRadius: 'var(--mf-radius-lg)',
        border: '1px solid var(--mf-hairline)',
      }}
    >
      <Pill tone="accent">
        miglior scelta netta · {model.bestRank} di {model.eligibleCount}
      </Pill>

      <div className="mt-4">
        <div style={{ fontFamily: 'var(--mf-font-sans)', fontWeight: 700, fontSize: 18, color: 'var(--mf-ink)' }}>
          {best.row.brand} · {best.row.city || best.row.name}
        </div>
        <div className="mf-num mt-1" style={{ color: 'var(--mf-ink-2)', fontSize: 12 }}>
          {best.distanceKm.toFixed(1).replace('.', ',')} km · {describeAge(best.ageH)}
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        <PriceText price={best.price} level={best.level} hero />
        <div className="text-right">
          <div className="mf-label" style={{ color: 'var(--mf-ink-2)', fontSize: 10 }}>
            in tasca
          </div>
          <div className="mf-num" style={{ color: 'var(--mf-ink)', fontSize: 20, fontWeight: 600 }}>
            {best.net.net.toFixed(2).replace('.', ',')} €
          </div>
        </div>
      </div>

      <div className="mf-label mt-1" style={{ color: 'var(--mf-ink-2)', fontSize: 11 }}>
        {LEVEL_LABEL[best.level]}
        {!best.reliable && ' · pochi confronti in zona'}
      </div>

      {model.spectrum && (
        <div className="mt-5">
          <SpectrumBar spectrum={model.spectrum} />
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <button
          onClick={onNavigate}
          className="flex flex-1 items-center justify-center gap-2 py-4 active:scale-95 transition-transform"
          style={{
            background: 'var(--mf-accent)',
            color: 'var(--mf-accent-ink)',
            borderRadius: 'var(--mf-radius-pill)',
            fontFamily: 'var(--mf-font-sans)',
            fontWeight: 700,
          }}
        >
          <Navigation size={18} /> Portami lì
        </button>
        <button
          onClick={onWhy}
          className="flex items-center justify-center gap-2 px-5 py-4 active:scale-95 transition-transform"
          style={{
            background: 'transparent',
            color: 'var(--mf-ink-2)',
            border: '1px solid var(--mf-hairline)',
            borderRadius: 'var(--mf-radius-pill)',
            fontFamily: 'var(--mf-font-sans)',
            fontWeight: 600,
          }}
        >
          <HelpCircle size={18} /> Perché?
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificare che compili**

Run: `npm run build`
Expected: build completata.

- [ ] **Step 4: Commit**

```bash
git add src/ui/home/Spectrum.tsx src/ui/home/AnswerCard.tsx
git commit -m "feat(ui): la risposta della Home con spettro della coorte e netto in tasca"
```

---

## Task 10: Il foglio «Perché?» e la riga della lista

**Files:**
- Create: `src/ui/home/WhySheet.tsx`, `src/ui/home/StationRowItem.tsx`

**Interfaces:**
- Consumes: `whyRows` (Task 5), `ListItem` (Task 4), `PriceText`, `priceColor`
- Produces: `<WhySheet station={RankedStation} onClose={() => void} />`, `<StationRowItem item={ListItem} onClick={(id: string) => void} />`

- [ ] **Step 1: Scrivere `WhySheet.tsx`**

Creare `src/ui/home/WhySheet.tsx`:

```tsx
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import type { RankedStation } from '../../domain/ranking';
import { whyRows } from './why';

interface Props {
  station: RankedStation;
  onClose: () => void;
}

export function WhySheet({ station, onClose }: Props) {
  const rows = whyRows(station);
  return (
    <motion.div
      className="fixed inset-0 z-[3000] flex items-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ background: 'rgba(0,0,0,.6)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full p-6"
        style={{
          background: 'var(--mf-surface-raised)',
          borderTopLeftRadius: 'var(--mf-radius-lg)',
          borderTopRightRadius: 'var(--mf-radius-lg)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)',
        }}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 style={{ fontFamily: 'var(--mf-font-sans)', fontWeight: 700, fontSize: 18, color: 'var(--mf-ink)' }}>
            Come è venuto il conto
          </h2>
          <button onClick={onClose} aria-label="Chiudi" style={{ color: 'var(--mf-ink-2)' }}>
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-center justify-between py-3"
              style={{ borderTop: '1px solid var(--mf-hairline)' }}
            >
              <span style={{ color: 'var(--mf-ink-2)', fontSize: 13, fontFamily: 'var(--mf-font-sans)' }}>
                {r.label}
              </span>
              <span
                className="mf-num"
                style={{
                  color: 'var(--mf-ink)',
                  fontSize: r.emphasis ? 18 : 14,
                  fontWeight: r.emphasis ? 600 : 500,
                }}
              >
                {r.value}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-4" style={{ color: 'var(--mf-ink-2)', fontSize: 11, lineHeight: 1.5 }}>
          La distanza è in linea d'aria e il viaggio è contato andata e ritorno. Con l'auto scelta nel
          Garage i litri e il consumo diventano i tuoi.
        </p>
      </motion.div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Scrivere `StationRowItem.tsx`**

Creare `src/ui/home/StationRowItem.tsx`:

```tsx
import type { ListItem } from './homeModel';
import { PriceText, formatEuro } from '../../design/primitives/PriceText';

interface Props {
  item: ListItem;
  onClick?: (id: string) => void;
}

export function StationRowItem({ item, onClick }: Props) {
  return (
    <button
      onClick={() => onClick?.(item.id)}
      className="flex w-full items-center justify-between gap-3 py-4 text-left"
      style={{ borderTop: '1px solid var(--mf-hairline)' }}
    >
      <div className="min-w-0 flex-1">
        <div
          className="truncate"
          style={{ fontFamily: 'var(--mf-font-sans)', fontWeight: 600, fontSize: 15, color: 'var(--mf-ink)' }}
        >
          {item.brand} · {item.city || item.name}
        </div>
        <div className="mf-num mt-0.5 truncate" style={{ color: 'var(--mf-ink-2)', fontSize: 11 }}>
          {item.distanceKm.toFixed(1).replace('.', ',')} km · {item.ageLabel} · {item.levelLabel}
        </div>
      </div>
      <div className="flex-shrink-0 text-right">
        <PriceText price={item.price} level={item.level} />
        {item.deltaVsBest > 0 && (
          <div className="mf-num" style={{ color: 'var(--mf-ink-2)', fontSize: 11 }}>
            +{formatEuro(item.deltaVsBest)}
          </div>
        )}
      </div>
    </button>
  );
}
```

- [ ] **Step 3: Verificare che compili**

Run: `npm run build`
Expected: build completata.

- [ ] **Step 4: Commit**

```bash
git add src/ui/home/WhySheet.tsx src/ui/home/StationRowItem.tsx
git commit -m "feat(ui): foglio del conto e riga della lista con differenza dal migliore"
```

---

## Task 11: Il Tabellone

Spec § 9.4: «più pin leggibili possibile, colorati dalla scala, il migliore acceso; velo in basso con "8 impianti in vista · migliore 1,879 · peggiore 2,079" e l'icona per aprire; tocco ovunque apre la mappa intera».

**Files:**
- Create: `src/ui/home/Tabellone.tsx`

**Interfaces:**
- Consumes: `HomeModel`/`ListItem` (Task 4), `priceColor`/`formatEuro`
- Produces: `<Tabellone model={HomeModel} onOpen={() => void} />`

- [ ] **Step 1: Scrivere il componente**

Creare `src/ui/home/Tabellone.tsx`:

```tsx
import { useMemo } from 'react';
import { Maximize2 } from 'lucide-react';
import type { HomeModel, ListItem } from './homeModel';
import { priceColor, formatEuro } from '../../design/primitives/PriceText';

/** Quanti pin stanno leggibili in un riquadro di 180px. */
const MAX_PINS = 24;

interface Props {
  model: HomeModel;
  onOpen: () => void;
}

interface Pin {
  item: ListItem;
  x: number;
  y: number;
  isBest: boolean;
}

export function Tabellone({ model, onOpen }: Props) {
  const pins = useMemo<Pin[]>(() => {
    const items = model.list.slice(0, MAX_PINS);
    if (items.length === 0) return [];

    const lats = items.map((i) => i.lat);
    const lngs = items.map((i) => i.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const dLat = maxLat - minLat || 1;
    const dLng = maxLng - minLng || 1;
    const bestId = model.best?.row.id;

    return items.map((item) => ({
      item,
      x: 8 + ((item.lng - minLng) / dLng) * 84,
      y: 8 + (1 - (item.lat - minLat) / dLat) * 76,
      isBest: item.id === bestId,
    }));
  }, [model]);

  return (
    <button
      onClick={onOpen}
      className="relative block w-full overflow-hidden text-left"
      style={{
        height: 180,
        background: 'var(--mf-surface)',
        borderRadius: 'var(--mf-radius-lg)',
        border: '1px solid var(--mf-hairline)',
      }}
    >
      {pins.map((p) => (
        <span
          key={p.item.id}
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.isBest ? 14 : 8,
            height: p.isBest ? 14 : 8,
            background: priceColor(p.item.level),
            opacity: p.isBest ? 1 : 0.75,
            boxShadow: p.isBest ? `0 0 14px ${priceColor(p.item.level)}` : 'none',
            border: p.isBest ? '2px solid var(--mf-ink)' : 'none',
          }}
        />
      ))}

      <div
        className="absolute inset-x-0 bottom-0 flex items-center justify-between px-4 py-3"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,.85), transparent)' }}
      >
        <span className="mf-num" style={{ color: 'var(--mf-ink)', fontSize: 11 }}>
          {model.board.count === 0
            ? 'nessun impianto in vista'
            : `${model.board.count} impianti in vista · migliore ${formatEuro(model.board.best!)} · peggiore ${formatEuro(model.board.worst!)}`}
        </span>
        <Maximize2 size={16} style={{ color: 'var(--mf-ink-2)' }} />
      </div>

      {model.list.length > MAX_PINS && (
        <span
          className="mf-label absolute right-3 top-3"
          style={{ color: 'var(--mf-ink-2)', fontSize: 10 }}
        >
          +{model.list.length - MAX_PINS} fuori riquadro
        </span>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Verificare che compili**

Run: `npm run build`
Expected: build completata.

- [ ] **Step 3: Commit**

```bash
git add src/ui/home/Tabellone.tsx
git commit -m "feat(ui): widget Tabellone con pin colorati dalla scala e velo di riepilogo"
```

---

## Task 12: Barra superiore e navigazione

Spec § 9.1: «marchio, pillola con la posizione». Spec § 9.7: «pillola flottante in vetro, con sfumatura sopra». Oggi l'header di `App.tsx:983-1021` ha quattro bottoni tondi e nessuna indicazione di dove si trovi l'utente — il dato da cui dipende ogni numero della schermata. La barra e la navigazione si fanno insieme perché sono le due cornici fisse: cambiarne una sola lascia l'app visibilmente a metà.

**Files:**
- Create: `src/ui/chrome/TopBar.tsx`, `src/ui/chrome/NavPill.tsx`
- Modify: `src/App.tsx` (header righe ~983-1021; il montaggio di `BottomNav`)

**Interfaces:**
- Consumes: `Pill` (`src/design/primitives/Pill.tsx`)
- Produces: `<TopBar place={string|null} onSettings={() => void} onAlerts={() => void} alertCount={number} />`, `<NavPill tabs={NavItem[]} current={string} onSelect={(id: string) => void} />` con `NavItem = { id: string; icon: LucideIcon; label: string }`

- [ ] **Step 1: Scrivere `TopBar.tsx`**

Creare `src/ui/chrome/TopBar.tsx`:

```tsx
import { Bell, MapPin, Settings } from 'lucide-react';
import { Pill } from '../../design/primitives/Pill';

interface Props {
  /** Comune dell'utente, null finche la posizione non c'e. */
  place: string | null;
  onSettings: () => void;
  onAlerts: () => void;
  alertCount: number;
}

export function TopBar({ place, onSettings, onAlerts, alertCount }: Props) {
  return (
    <header
      className="fixed inset-x-0 top-0 z-[1000] flex items-center justify-between px-5 pb-3"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top) + 12px)',
        background: 'color-mix(in srgb, var(--mf-ground) 80%, transparent)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--mf-hairline)',
      }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <h1
          className="flex-shrink-0"
          style={{ fontFamily: 'var(--mf-font-sans)', fontWeight: 800, fontSize: 18, color: 'var(--mf-ink)', letterSpacing: '-0.02em' }}
        >
          Martucc<span style={{ color: 'var(--mf-accent)' }}>Fuel</span>
        </h1>
        <Pill tone="ghost">
          <MapPin size={12} />
          <span className="max-w-[120px] truncate">{place ?? 'posizione…'}</span>
        </Pill>
      </div>

      <div className="flex flex-shrink-0 items-center gap-1">
        <button onClick={onAlerts} className="relative p-2 active:scale-90 transition-transform" aria-label="Allerte">
          <Bell size={18} style={{ color: alertCount > 0 ? 'var(--mf-accent)' : 'var(--mf-ink-2)' }} />
          {alertCount > 0 && (
            <span
              className="mf-num absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center px-1"
              style={{
                borderRadius: 'var(--mf-radius-pill)',
                background: 'var(--mf-accent)',
                color: 'var(--mf-accent-ink)',
                fontSize: 9,
                fontWeight: 700,
              }}
            >
              {alertCount}
            </span>
          )}
        </button>
        <button onClick={onSettings} className="p-2 active:scale-90 transition-transform" aria-label="Impostazioni">
          <Settings size={18} style={{ color: 'var(--mf-ink-2)' }} />
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Scrivere `NavPill.tsx`**

Creare `src/ui/chrome/NavPill.tsx`:

```tsx
import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  id: string;
  icon: LucideIcon;
  label: string;
}

interface Props {
  tabs: NavItem[];
  current: string;
  onSelect: (id: string) => void;
}

export function NavPill({ tabs, current, onSelect }: Props) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[1000] flex justify-center pt-10"
      style={{
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)',
        background: 'linear-gradient(to top, var(--mf-ground) 40%, transparent)',
      }}
    >
      <nav
        className="pointer-events-auto flex items-center gap-1 px-2 py-2"
        style={{
          borderRadius: 'var(--mf-radius-pill)',
          background: 'color-mix(in srgb, var(--mf-surface-raised) 75%, transparent)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid var(--mf-hairline)',
          boxShadow: '0 8px 32px rgba(0,0,0,.45)',
        }}
      >
        {tabs.map((t) => {
          const active = t.id === current;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              aria-label={t.label}
              className="relative px-4 py-2 active:scale-90 transition-transform"
            >
              {active && (
                <motion.span
                  layoutId="mf-nav-active"
                  className="absolute inset-0"
                  style={{ borderRadius: 'var(--mf-radius-pill)', background: 'var(--mf-accent)' }}
                />
              )}
              <Icon
                size={20}
                className="relative"
                style={{ color: active ? 'var(--mf-accent-ink)' : 'var(--mf-ink-2)' }}
              />
            </button>
          );
        })}
      </nav>
    </div>
  );
}
```

- [ ] **Step 3: Montarli in `App.tsx`**

Sostituire l'intero `<header>` (righe ~983-1021) con:

```tsx
      <TopBar
        place={userCity}
        onSettings={() => setShowSettings(true)}
        onAlerts={() => setTab('alerts')}
        alertCount={alerts.filter((a) => a.active).length}
      />
```

`userCity` è il nome del comune dell'utente. Se `App.tsx` non ce l'ha già (verificare con `grep -n "userCity\|reverseGeo\|comune" src/App.tsx`), ricavarlo senza chiamate di rete nuove: la città della stazione più vicina è una buona approssimazione ed è già in memoria —

```tsx
  const userCity = homeModel?.list[0]?.city ?? null;
```

Poi sostituire il montaggio di `<BottomNav …/>` con:

```tsx
      <NavPill
        tabs={tabs}
        current={tab}
        onSelect={(id) => setTab(id as TabType)}
      />
```

`tabs` è già dichiarato a `src/App.tsx:975` con la forma `{id, icon, label}[]`: togliere il `// @ts-ignore` sopra, ora che è usato davvero.

Il vecchio `InstallPwaButton` e il bottone calcolatore escono dalla barra: spostarli dentro le Impostazioni (`SettingsModal`) in coda alla lista, così nessuna funzione sparisce.

- [ ] **Step 4: Verificare**

Run: `npm run build`
Expected: build completata.

Poi `npm run dev`: la barra mostra il comune; la pillola di navigazione fluttua sopra il contenuto con la sfumatura; l'indicatore ciano scivola fra le voci. Verificare che il contenuto non finisca sotto la pillola (il `paddingBottom` del contenitore a `src/App.tsx:1024` deve restare ≥ 90px).

- [ ] **Step 5: Commit**

```bash
git add src/ui/chrome/TopBar.tsx src/ui/chrome/NavPill.tsx src/App.tsx src/components/modals/SettingsModal.tsx
git commit -m "feat(ui): barra con la posizione e navigazione a pillola in vetro"
```

---

## Task 13: La nuova Home

`HomeTab.tsx` viene riscritto: da 387 righe che calcolano a una composizione che dispone. Non riceve più `cheapestPrice`/`averagePrice`/`marketRef`, ma il `HomeModel`.

**Files:**
- Modify: `src/components/tabs/HomeTab.tsx` (riscrittura completa), `src/App.tsx` (riga 1085, i props passati a `HomeTab`)

**Interfaces:**
- Consumes: `HomeModel` (Task 4), `FuelTabs` (Task 8), `AnswerCard` (Task 9), `Tabellone` (Task 11), `StationRowItem` + `WhySheet` (Task 10)
- Produces: `<HomeTab model={HomeModel|null} loading={boolean} fuel={FuelKey} setFuel={(f: FuelKey) => void} radius={number} setRadius={(v: number) => void} onOpenMap={() => void} onOpenFilters={() => void} onStationClick={(id: string) => void} />`

- [ ] **Step 1: Riscrivere `src/components/tabs/HomeTab.tsx`**

Sostituire **l'intero contenuto** del file con:

```tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SlidersHorizontal } from 'lucide-react';
import type { FuelKey } from '../../domain/raw';
import type { HomeModel } from '../../ui/home/homeModel';
import { FuelTabs } from '../../ui/home/FuelTabs';
import { AnswerCard } from '../../ui/home/AnswerCard';
import { Tabellone } from '../../ui/home/Tabellone';
import { StationRowItem } from '../../ui/home/StationRowItem';
import { WhySheet } from '../../ui/home/WhySheet';

interface Props {
  model: HomeModel | null;
  loading: boolean;
  fuel: FuelKey;
  setFuel: (f: FuelKey) => void;
  radius: number;
  setRadius: (v: number) => void;
  onOpenMap: () => void;
  onOpenFilters: () => void;
  onStationClick: (id: string) => void;
}

export function HomeTab(p: Props) {
  const [showWhy, setShowWhy] = useState(false);

  const navigate = () => {
    const b = p.model?.best;
    if (!b) return;
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${b.row.lat},${b.row.lng}`,
      '_blank',
      'noreferrer'
    );
  };

  return (
    <motion.div
      key="home"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ type: 'spring', damping: 26, stiffness: 220 }}
      className="space-y-5 pb-32"
    >
      <div className="flex items-center justify-between px-1">
        <FuelTabs value={p.fuel} onChange={p.setFuel} />
        <button
          onClick={p.onOpenFilters}
          className="p-2 active:scale-90 transition-transform"
          style={{ color: 'var(--mf-ink-2)' }}
          aria-label="Filtri"
        >
          <SlidersHorizontal size={18} />
        </button>
      </div>

      {p.model ? (
        <>
          <AnswerCard model={p.model} onNavigate={navigate} onWhy={() => setShowWhy(true)} />

          <div
            className="px-4 py-4"
            style={{
              background: 'var(--mf-surface)',
              borderRadius: 'var(--mf-radius-md)',
              border: '1px solid var(--mf-hairline)',
            }}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="mf-label" style={{ color: 'var(--mf-ink-2)', fontSize: 10 }}>
                raggio
              </span>
              <span className="mf-num" style={{ color: 'var(--mf-accent)', fontSize: 12 }}>
                {p.radius} km
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              value={p.radius}
              onChange={(e) => p.setRadius(Number(e.target.value))}
              className="w-full"
              style={{ accentColor: 'var(--mf-accent)' }}
            />
          </div>

          <Tabellone model={p.model} onOpen={p.onOpenMap} />

          <div
            className="px-4"
            style={{
              background: 'var(--mf-surface)',
              borderRadius: 'var(--mf-radius-md)',
              border: '1px solid var(--mf-hairline)',
            }}
          >
            <div className="flex items-center justify-between py-4">
              <span className="mf-label" style={{ color: 'var(--mf-ink-2)', fontSize: 10 }}>
                {p.model.adviceReason}
              </span>
            </div>
            {p.model.list.slice(0, 40).map((item) => (
              <StationRowItem key={item.id} item={item} onClick={p.onStationClick} />
            ))}
            {p.model.list.length === 0 && (
              <p className="py-10 text-center" style={{ color: 'var(--mf-ink-2)', fontSize: 13 }}>
                Nessun impianto in questo raggio.
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="py-20 text-center" style={{ color: 'var(--mf-ink-2)', fontSize: 13 }}>
          {p.loading ? 'Carico i prezzi…' : 'Serve la posizione per dire dove conviene.'}
        </div>
      )}

      <AnimatePresence>
        {showWhy && p.model?.best && (
          <WhySheet station={p.model.best} onClose={() => setShowWhy(false)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
```

- [ ] **Step 2: Aggiornare la chiamata in `App.tsx`**

Sostituire la riga 1085 di `src/App.tsx` (il montaggio di `<HomeTab …/>`) con:

```tsx
                {tab==='home' && (
                  <HomeTab
                    model={homeModel}
                    loading={loading}
                    fuel={toFuelKey(fuel)}
                    setFuel={(k) => setFuel(toFuelType(k))}
                    radius={radius}
                    setRadius={setRadius}
                    onOpenMap={() => setTab('map')}
                    onOpenFilters={() => setShowFilters(true)}
                    onStationClick={(id) => {
                      const s = stations.find((x) => x.id === id);
                      if (s) setStationDetail(s);
                    }}
                  />
                )}
```

Aggiungere `toFuelType` all'import da `./domain/fuel` in testa al file.

- [ ] **Step 3: Rimuovere gli avanzi**

Il type-check segnalerà variabili ora inutilizzate in `App.tsx` (per esempio `avgP`, `mStats`, `tTone`, `isLocal`). Cancellare quelle che nessun'altra tab usa; **non** cancellare `mStats` se `AnalysisTab` la riceve ancora (verificarlo con `grep -n "marketStats\|mStats" src/App.tsx`).

Run: `npx tsc -b --noEmit` (o `npm run build`)
Expected: nessun errore, nessun avviso di simbolo inutilizzato.

- [ ] **Step 4: Provare sul dev server**

Run: `npm run dev`, aprire, concedere la posizione, cambiare carburante, muovere il raggio, aprire «Perché?».
Expected: la risposta cambia col carburante; il conto del foglio torna con quanto mostrato nella card; nessun errore in console.

Chiudere: `Get-NetTCPConnection -LocalPort 5173 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`

- [ ] **Step 5: Commit**

```bash
git add src/components/tabs/HomeTab.tsx src/App.tsx
git commit -m "feat(ui): nuova Home che dispone il modello invece di calcolare"
```

---

## Task 14: La mappa e il foglio di blocco

Due cose insieme perché toccano lo stesso blocco di `App.tsx`: i marker prendono il colore dalla scala e dichiarano il raggruppamento; `confirm()` diventa un foglio.

**Files:**
- Create: `src/ui/sheets/BlockSheet.tsx`
- Modify: `src/App.tsx` (riga 793 `confirm()`; il blocco dei `<Marker>` intorno alle righe 1050-1075)

**Interfaces:**
- Consumes: `clusterStations`/`Cluster` (Task 6), `priceColor`/`formatEuro`
- Produces: `<BlockSheet stationName={string} onHide={() => void} onReport={() => void} onClose={() => void} />`

- [ ] **Step 1: Scrivere `BlockSheet.tsx`**

Creare `src/ui/sheets/BlockSheet.tsx`:

```tsx
import { motion } from 'motion/react';
import { EyeOff, Flag, X } from 'lucide-react';

interface Props {
  stationName: string;
  onHide: () => void;
  onReport: () => void;
  onClose: () => void;
}

const ACTION = {
  display: 'flex',
  width: '100%',
  alignItems: 'center',
  gap: 12,
  padding: '16px',
  borderRadius: 'var(--mf-radius-md)',
  border: '1px solid var(--mf-hairline)',
  background: 'var(--mf-surface)',
  color: 'var(--mf-ink)',
  fontFamily: 'var(--mf-font-sans)',
  fontWeight: 600,
  fontSize: 15,
  textAlign: 'left' as const,
};

export function BlockSheet({ stationName, onHide, onReport, onClose }: Props) {
  return (
    <motion.div
      className="fixed inset-0 z-[3000] flex items-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ background: 'rgba(0,0,0,.6)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full space-y-3 p-6"
        style={{
          background: 'var(--mf-surface-raised)',
          borderTopLeftRadius: 'var(--mf-radius-lg)',
          borderTopRightRadius: 'var(--mf-radius-lg)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)',
        }}
      >
        <div className="flex items-center justify-between">
          <h2
            className="truncate"
            style={{ fontFamily: 'var(--mf-font-sans)', fontWeight: 700, fontSize: 17, color: 'var(--mf-ink)' }}
          >
            {stationName}
          </h2>
          <button onClick={onClose} aria-label="Chiudi" style={{ color: 'var(--mf-ink-2)' }}>
            <X size={20} />
          </button>
        </div>

        <button onClick={onHide} style={ACTION}>
          <EyeOff size={18} style={{ color: 'var(--mf-ink-2)' }} />
          <span>
            Nascondi solo per me
            <span className="mf-label block" style={{ color: 'var(--mf-ink-2)', fontSize: 11, fontWeight: 400 }}>
              sparisce dai tuoi risultati
            </span>
          </span>
        </button>

        <button onClick={onReport} style={ACTION}>
          <Flag size={18} style={{ color: 'var(--mf-ink-2)' }} />
          <span>
            Segnala alla community
            <span className="mf-label block" style={{ color: 'var(--mf-ink-2)', fontSize: 11, fontWeight: 400 }}>
              il prezzo risulta sbagliato a tutti
            </span>
          </span>
        </button>
      </motion.div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Sostituire `confirm()` in `App.tsx`**

Alla riga 793 c'è `const choice = confirm(...)`. Sostituire la funzione che lo contiene con una che apre il foglio. Aggiungere accanto agli altri `useState` (intorno alla riga 473):

```ts
  const [blockTarget, setBlockTarget] = useState<FuelStation | null>(null);
```

Rendere `blockStation` un semplice `setBlockTarget(s)`, e portare i due rami del vecchio `confirm` in due funzioni separate — quella del ramo `[OK]` diventa `hideForMe(s)`, quella del ramo `[ANNULLA]` diventa `reportToCommunity(s)` — conservandone il corpo esistente **senza modifiche**. Poi montare il foglio accanto agli altri overlay, dentro l'`<AnimatePresence>` di primo livello:

```tsx
      <AnimatePresence>
        {blockTarget && (
          <BlockSheet
            stationName={blockTarget.city || blockTarget.name}
            onHide={() => { hideForMe(blockTarget); setBlockTarget(null); }}
            onReport={() => { reportToCommunity(blockTarget); setBlockTarget(null); }}
            onClose={() => setBlockTarget(null)}
          />
        )}
      </AnimatePresence>
```

- [ ] **Step 3: Colorare i marker e mostrare i gruppi**

Nel blocco dei `<Marker>` (righe ~1050-1075), sostituire l'iterazione su `mapSt` con una su `clusters` (già disponibile da Task 7). Ogni marker usa `priceColor(c.level)` come colore e, quando `c.count > 1`, mostra il conteggio invece del prezzo:

```tsx
              {clusters.map((c) => (
                <Marker
                  key={c.bestId}
                  position={[c.lat, c.lng]}
                  icon={L.divIcon({
                    className: '',
                    html: c.count > 1
                      ? `<div style="background:${priceColor(c.level)};color:#000;border-radius:999px;padding:4px 9px;font:600 12px var(--mf-font-mono),monospace;border:2px solid #fff;white-space:nowrap">${c.count}</div>`
                      : `<div style="background:${priceColor(c.level)};color:#000;border-radius:999px;padding:4px 8px;font:500 11px var(--mf-font-mono),monospace;white-space:nowrap">${formatEuro(c.bestPrice)}</div>`,
                    iconSize: [0, 0],
                  })}
                  eventHandlers={{ click: () => {
                    const s = stations.find((x) => x.id === c.bestId);
                    if (s) setStationDetail(s);
                  } }}
                />
              ))}
```

`L` è già importato a `src/App.tsx:11` (`import L from 'leaflet'`) e le icone esistenti usano `L.divIcon` (righe 38 e 201): mantenere quella forma. `priceColor` e `formatEuro` vanno importati da `./design/primitives/PriceText`.

Il vecchio marker mostrava il prezzo con `toFixed(3)` e un colore fisso; adesso il colore **è** l'informazione, e il numero dentro il pallino di gruppo è il conteggio, non un prezzo — un gruppo che mostrasse «1,879» farebbe credere che quello sia il prezzo di un impianto solo.

- [ ] **Step 4: Verificare**

Run: `npm run build && npm test -- --run`
Expected: build completata; tutti i test verdi.

Poi `npm run dev`: aprire la Mappa, allontanare lo zoom fino a vedere i pallini col numero, verificare che il numero cambi rimpicciolendo, e che nessuna area resti vuota dove prima c'erano stazioni. Aprire il foglio di blocco da una scheda stazione e verificare che le due azioni funzionino come prima.

- [ ] **Step 5: Commit**

```bash
git add src/ui/sheets/BlockSheet.tsx src/App.tsx
git commit -m "feat(ui): marker colorati dal livello, gruppi dichiarati, foglio al posto di confirm()"
```

---

## Task 15: Via `localAnalysis.ts`

Spec § 10: «`src/services/localAnalysis.ts` — sostituito interamente da `domain/`» e «`buildSeries()` e la generazione sinusoidale di storico e forecast». È il difetto originale che ha motivato tutto il redesign: finché il file esiste, qualcuno può richiamarlo.

**Files:**
- Delete: `src/services/localAnalysis.ts`
- Modify: `src/App.tsx`, `src/components/tabs/AnalysisTab.tsx`

- [ ] **Step 1: Vedere chi lo usa ancora**

Run: `grep -rn "localAnalysis\|buildLocalMarketAnalysis\|calculateMarketStats\|buildSeries" src/`
Expected: `src/App.tsx` (import e chiamate) e `src/components/tabs/AnalysisTab.tsx:12` (solo un `import type { MarketStats }`).

- [ ] **Step 2: Spostare il tipo `MarketStats`**

`AnalysisTab` importa solo un tipo. Copiare la dichiarazione di `MarketStats` da `src/services/localAnalysis.ts` in fondo a `src/types.ts` così com'è, e in `src/components/tabs/AnalysisTab.tsx:12` cambiare l'import in:

```ts
import type { MarketStats } from '../../types';
```

- [ ] **Step 3: Togliere le chiamate da `App.tsx`**

Rimuovere l'import di `localAnalysis` (riga 8). Rimuovere la `useMemo` `mStats` (righe ~939-941) e ogni chiamata a `buildLocalMarketAnalysis` (riga ~790 in `handleMapMove` e ovunque `grep` la trovi). Dove `mStats` era passata a `AnalysisTab`, passare `null` — la fase 3 rifà quella tab sul motore deterministico; qui basta che l'app compili e le altre tab restino intatte.

Se `AnalysisTab` non accetta `null`, ampliarne il tipo del prop a `MarketStats | null` e proteggere gli usi con `?.`. **Non** inventare statistiche per riempirlo: mostrare meno è corretto, mostrare numeri finti no.

- [ ] **Step 4: Cancellare il file**

```bash
git rm src/services/localAnalysis.ts
```

- [ ] **Step 5: Verificare che non resti traccia**

Run: `grep -rn "localAnalysis\|buildSeries\|Math.sin" src/`
Expected: nessun risultato.

Run: `npm run build && npm test -- --run`
Expected: build completata; tutti i test verdi.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: rimosso localAnalysis.ts, storico e previsioni non si inventano piu"
```

---

## Task 16: Verifica finale della fase

Nessun codice nuovo: si controlla che la fase abbia mantenuto quello che prometteva.

- [ ] **Step 1: Suite completa e type-check**

```bash
npm test -- --run
npm run typecheck:domain
npm run build
```
Expected: tutto verde.

- [ ] **Step 2: Verificare che i difetti della spec siano davvero spariti**

```bash
grep -rn "Math.sin" src/          # atteso: nessun risultato
grep -rn "diffDays < 7" src/      # atteso: nessun risultato
grep -rn "confirm(" src/          # atteso: nessun risultato
grep -rn "zoomLimit" src/         # atteso: nessun risultato
grep -rn "Math.min(...validPrices" src/  # atteso: nessun risultato
```

- [ ] **Step 3: Prova sul telefono**

Spec § 12: «Ogni fase termina con un'app funzionante e installabile.»

```bash
npm run build
npx cap sync android
```

Aprire l'app sul telefono (o `npm run dev -- --host` e collegarsi dall'IP locale) e verificare, sulla Home: il prezzo grande è colorato dal livello e non è ciano; «Perché?» apre un conto che torna; il tabellone dichiara quanti impianti mostra; la mappa a zoom basso mostra i gruppi col numero. Annotare qualunque discrepanza nel documento del piano sotto una sezione «Deviazione emersa in esecuzione», come fatto in fase 1.

- [ ] **Step 4: Chiudere il branch**

**REQUIRED SUB-SKILL:** `superpowers:finishing-a-development-branch`

---

## Cosa questa fase lascia scritto per dopo

- **`AnalysisTab` resta col vecchio impianto** e riceve `mStats = null`: la fase 3 la ricostruisce sul motore deterministico. È l'unico punto in cui l'app mostra meno di prima, ed è deliberato — mostrava numeri generati con `Math.sin`.
- **`tankPct` è sempre `null`** in `buildHomeModel`: il livello del serbatoio arriva dal Pieno, che è fase 4. Fino ad allora il consiglio `URGENT` non può scattare, ed è corretto: senza il dato, dichiararlo è meglio che indovinarlo.
- **`kmlFor(selCar, fuel, null)`** passa `null` come consumo reale: il calcolo dai rifornimenti registrati è in `fillupService` e va collegato in fase 4.
- **La distanza resta in linea d'aria.** Dichiarato nel foglio «Perché?». Se emergesse come problema reale, la distanza stradale è un cambio confinato a `geo.ts` e al suo test.
- **Le altre tab (Trip, Garage, Pieno, Allerte) girano ancora su `FuelStation`** tramite `src/data/adapter.ts`. L'adattatore è il debito che la fase 4 estingue; finché esiste, `FuelStation` e `StationRow` vanno tenuti allineati a mano.
- **L'occhiello dell'analisi (spec § 9.5: «provenienza e confidenza, poi una frase in italiano») è coperto solo a metà**: la Home mostra `adviceReason`, che è deterministico e vero, ma non la riga di provenienza — quella dipende dal pannello provider, che è fase 3.
- **`src/components/BottomNav.tsx` resta nel repo ma non è più montato** dopo il Task 12. Non lo cancello in questa fase perché `AlertsTab` e `VehicleTab` potrebbero ancora riferirsi ai suoi tipi; la fase 4, che tocca quelle tab, lo rimuove verificando.
- **Nessun test di rendering.** Vedi «Perché nessun test di componente» in testa: la disposizione visiva si verifica a mano (Task 16, Step 3). Se in fase 3 o 4 la UI acquisisse logica condizionale non estraibile in un modello puro, quello sarà il momento di introdurre jsdom e Testing Library — non prima.
- **`onDatasetUpdate` è esposto ma nessuno lo ascolta** alla fine della fase 2: `App.tsx` mostra i dati serviti e il rinfresco dietro aggiorna la cache per il caricamento successivo. Collegarlo a un `setState` — così i prezzi si aggiornano sotto gli occhi senza far sparire la schermata, come chiede la spec § 7 — è un innesto di poche righe che ha senso fare quando la Home avrà uno stato stabile.

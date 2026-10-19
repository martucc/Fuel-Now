# MartuccFuel — Fase 1 «Fondamenta» · Piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Costruire `src/domain/` — la logica pura che calcola livello del prezzo, freschezza, coorti, risparmio netto e previsione — verificata con test sui dati reali di `public/stations.json`, più `src/design/tokens.css`.

**Architecture:** Tutto ciò che si aggiunge è **additivo**: nessun file esistente viene modificato in questa fase, quindi l'app continua a funzionare esattamente come oggi. `src/domain/` non importa React né esegue rete: prende in ingresso il dataset già scaricato e restituisce numeri. I test girano su Node contro il file `public/stations.json` vero, non su fixture inventate. Il collegamento del dominio alle schermate è fase 2.

**Tech Stack:** TypeScript 6 · Vite 8 · Vitest (da installare) · nessuna dipendenza runtime nuova salvo i font self-hosted.

**Spec:** `docs/superpowers/specs/2026-08-19-martuccfuel-redesign-design.md`

---

## Global Constraints

Valgono per **ogni** task. Non ripetuti nei singoli step.

1. **Selezione del prezzo — identica alla pipeline.** `fetch_stations.py:420-431` stabilisce: `diesel` e `benzina` usano **solo** il self (`p[fuel][0]`); `gpl` e `metano` usano `p[fuel][0]` se presente, altrimenti il servito `p[fuel][1]`. Il client deve applicare la stessa regola, altrimenti confronta prezzi contro una media costruita in un altro modo e lo z-score è privo di significato. Nessuna eccezione.
2. **Le coorti si costruiscono sul dataset INTERO, mai sulle stazioni visibili.** Il difetto originale che questo redesign elimina è proprio «media delle stazioni caricate in quel momento». Ogni funzione che riceve una lista di stazioni per costruire statistiche riceve *tutte* le 21.576, non il risultato di un filtro per distanza o per bounding box.
3. **Il client non genera mai un forecast.** Si legge `stations.json → forecast[carburante]`. Se `confidence < 0.3` non si mostra previsione.
4. **`verbatimModuleSyntax: true`** è attivo in `tsconfig.app.json`: ogni import di soli tipi va scritto `import type { X } from './y'`, altrimenti la build fallisce.
5. **Import senza estensione** (`from './fuel'`), come tutto il codice esistente.
6. **Nessun file di dominio supera le ~200 righe.**
7. **Limiti fisici di prezzo** — copiati verbatim da `fetch_stations.py:39-44`: `diesel` 1.0–3.5 · `benzina` 1.0–3.5 · `gpl` 0.3–2.0 · `metano` 0.5–4.0.
8. **Soglia numerosità coorte:** `MIN_COHORT_N = 8` (spec § 6.1). **Soglia confidenza forecast:** `0.3` (spec § 6.4).
9. **Deviazione standard di popolazione** (divisore `n`, non `n-1`), perché la pipeline usa `statistics.pstdev`. Usare la campionaria farebbe divergere il client dai valori di `by_province`.
10. **Commit dopo ogni task.** Messaggi in italiano, prefisso conventional (`feat:`, `test:`, `chore:`).

---

## Cosa ho trovato nei dati e cambia il piano

Tre scoperte fatte leggendo `public/stations.json` e `fetch_stations.py`. Sono deviazioni consapevoli dalla spec, non dimenticanze.

**A. `by_province` non distingue autostrada da città — e non può.** La spec § 6.1 pretende la coorte segmentata. La pipeline calcola `by_province[prov][fuel]` su tutti gli impianti della provincia insieme. Peggio: gli impianti autostradali sono 518 su 21.576, distribuiti su 78 province, con mediana **5 impianti per provincia** e 55 province sotto gli 8 richiesti. Una coorte autostradale provinciale quindi quasi non esiste.
→ **Le coorti si calcolano nel client**, in un'unica passata sul dataset completo, segmentate `road` / `highway`. La catena di ricaduta per un impianto autostradale resta **dentro l'autostrada**: `provincia+autostrada` → `nazionale+autostrada` → `nazionale`. Ricadere sulla coorte provinciale mista sarebbe l'errore esatto che la spec vuole evitare.
→ `by_province` non viene buttato: diventa **l'oracolo dei test**. Se la media combinata road+highway calcolata dal client non coincide con `by_province[prov][fuel].avg`, significa che la regola di selezione del prezzo del client diverge dalla pipeline. È il test più prezioso di tutta la fase (Task 5).

**B. La ricaduta regionale della spec non è implementabile, e la scorciatoia sarebbe peggio del problema.** La spec § 6.1 prevede `provincia → regione → nazione`. In `stations.json` **non esiste alcun campo regione**: le stazioni hanno solo `prov`. L'unico modo per averla nel client sarebbe scrivere a mano una tabella di 107 province → regione — cioè fabbricare dati a memoria, la stessa classe di errore che questo redesign esiste per eliminare.
→ **Il passo regionale viene rimosso.** La catena è `provincia+segmento (n≥8)` → `nazionale+segmento` → `nazionale`. Se in seguito il passo regionale servisse davvero (l'unico caso plausibile è il metano, n=11 in provincia di Chieti), il posto giusto per aggiungerlo è `fetch_stations.py`, che ha già i dati ISTAT a monte e può emettere un `by_region`. Va registrato come lavoro di pipeline, non di client.

**C. I dati a monte sono sporchi e il parser deve saperlo.** `by_province` ha 113 chiavi, di cui **6 sono indirizzi** (`'Via Vestina 408 65015'`, `'Via dei Martiri 255 41059'`, …): il campo `Provincia` del MIMIT contiene talvolta l'indirizzo. Lo stesso vale su 10 valori di `station.prov`, stringa vuota inclusa. E `station.type` ha 32 valori vuoti e 9 `'Pompe Bianche'` oltre a `Stradale`/`Autostradale`.
→ Il parser valida `prov` con `/^[A-Z]{2}$/` e mette `null` quando fallisce. Una stazione con `prov: null` resta visibile e classificabile — ricade sulla coorte nazionale del suo segmento — ma non inquina nessuna coorte provinciale.

Altre due cose viste in giro, da sapere: **non esiste alcun test runner** nel progetto (Task 1 lo installa); e `history.metano` ha 24 punti contro i 348 degli altri carburanti, quindi ogni grafico storico deve reggere serie corte.

---

## Struttura dei file

Tutti **nuovi**. Nessuno esistente viene toccato in fase 1.

| File | Responsabilità |
|---|---|
| `src/domain/raw.ts` | I tipi del file su disco: `RawDataset`, `RawStation`, `RawStats`. Descrizione, non logica. |
| `src/domain/fuel.ts` | Chiavi carburante, regola di selezione del prezzo, limiti fisici, conversione da/verso `FuelType` dell'app. |
| `src/domain/parse.ts` | `RawStation` → `StationRow` normalizzata; validazione `prov`; scarto degli impianti inutilizzabili. |
| `src/domain/freshness.ts` | Parsing di `updated`, età in ore, coefficiente di fiducia. |
| `src/domain/market.ts` | Costruzione delle coorti segmentate e catena di ricaduta. |
| `src/domain/pricing.ts` | z-score → uno dei cinque livelli, con etichetta e variabile CSS. |
| `src/domain/geo.ts` | Haversine. |
| `src/domain/units.ts` | Litri e consumi: default, auto da `cars.json`, consumo reale dai rifornimenti. |
| `src/domain/ranking.ts` | Risparmio netto, guardie, ordinamento, scelta del migliore. |
| `src/domain/forecast.ts` | Lettura del forecast di backend e consiglio del giorno. |
| `src/domain/__fixtures__/dataset.ts` | Caricatore del `public/stations.json` reale per i test. |
| `src/design/tokens.css` | Variabili CSS di colore, tipografia, superfici. |
| `src/design/primitives/PriceText.tsx` | Il prezzo scritto: colore dal livello, cifre tabulari, formato italiano. |
| `src/design/primitives/Pill.tsx` | La pillola: verdetto, posizione, tab. |
| `tsconfig.domain.json` | Type-check severo limitato a `src/domain/`. |

**Sulle primitive:** la spec § 5 elenca `Pill, Card, Row, Sparkline, PriceText`. In fase 1 se ne costruiscono **due**, `PriceText` e `Pill`, perché sono le uniche il cui comportamento è deciso dal dominio (livello → colore) e non da un impaginato che ancora non esiste. `Card`, `Row` e `Sparkline` sono forme, non logica: costruirle prima di avere la schermata che le contiene significa indovinare margini e proporzioni e poi rifarle. Nascono in fase 2 insieme alla Home che le usa.

---

## Task 1: Vitest e lo schema dei dati fissato da un test

Il progetto non ha test. Prima di scrivere dominio serve poterlo verificare, e serve che lo schema di `stations.json` sia scritto una volta sola in un posto solo.

**Files:**
- Modify: `package.json` (script `test`, `test:watch`, `typecheck:domain`; devDependency `vitest`)
- Create: `vitest.config.ts`
- Create: `tsconfig.domain.json`
- Modify: `tsconfig.app.json` (escludere i test dalla build)
- Create: `src/domain/raw.ts`
- Create: `src/domain/__fixtures__/dataset.ts`
- Test: `src/domain/raw.test.ts`

**Interfaces:**
- Consumes: niente.
- Produces: `RawDataset`, `RawStation`, `RawStats`, `RawForecast`, `RawPricePair`, `FUEL_KEYS`, `realDataset(): RawDataset`.

- [ ] **Step 1: Installare vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: Configurare vitest**

Creare `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Aggiungere gli script in `package.json`**

Dentro `"scripts"`, accanto a quelli esistenti:

```json
"test": "vitest run",
"test:watch": "vitest",
"typecheck:domain": "tsc -p tsconfig.domain.json --noEmit"
```

- [ ] **Step 4: Escludere i test dalla build e creare il type-check severo del dominio**

In `tsconfig.app.json`, aggiungere in coda all'oggetto, dopo `"include"`:

```json
"exclude": ["src/**/*.test.ts", "src/domain/__fixtures__/**"]
```

Creare `tsconfig.domain.json`:

```json
{
  "compilerOptions": {
    "target": "es2023",
    "lib": ["ES2023"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "types": ["node"],
    "skipLibCheck": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src/domain"]
}
```

`strict` non è attivo nel resto del progetto e attivarlo ovunque romperebbe centinaia di righe esistenti. Qui è limitato al dominio, che nasce oggi e può permetterselo.

- [ ] **Step 5: Scrivere i tipi grezzi**

Creare `src/domain/raw.ts`:

```ts
export type FuelKey = 'benzina' | 'diesel' | 'gpl' | 'metano';

export const FUEL_KEYS: readonly FuelKey[] = ['benzina', 'diesel', 'gpl', 'metano'];

/** `[self, servito]`. Entrambi possono essere null, mai tutti e due insieme. */
export type RawPricePair = [number | null, number | null];

export interface RawStation {
  id: number;
  name: string;
  brand: string;
  operator: string;
  /** "Stradale" | "Autostradale" | "Pompe Bianche" | "" */
  type: string;
  is_highway: boolean;
  address: string;
  city: string;
  /** Sigla a due lettere, ma il MIMIT ci infila anche indirizzi: va validato. */
  prov: string;
  lat: number;
  lng: number;
  p: Partial<Record<FuelKey, RawPricePair>>;
  /** "YYYY-MM-DD HH:MM", ora locale italiana, senza fuso. */
  updated: string;
}

export interface RawStats {
  avg: number;
  min: number;
  n: number;
  std: number;
  /** Solo in `national`. */
  max?: number;
  p10?: number;
  p90?: number;
}

export interface RawForecast {
  direction: 'up' | 'down' | 'flat';
  delta_c: number;
  days_ahead: number;
  confidence: number;
}

export interface RawHistoryPoint {
  date: string;
  avg: number;
}

export interface RawDataset {
  extracted_at: string;
  fuels: FuelKey[];
  national: Partial<Record<FuelKey, RawStats | null>>;
  by_province: Record<string, Partial<Record<FuelKey, RawStats>>>;
  history: Partial<Record<FuelKey, RawHistoryPoint[]>>;
  forecast: Partial<Record<FuelKey, RawForecast>>;
  stations: RawStation[];
}
```

- [ ] **Step 6: Scrivere il caricatore del dataset reale**

Creare `src/domain/__fixtures__/dataset.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RawDataset } from '../raw';

let cached: RawDataset | null = null;

/** Il vero `public/stations.json`, letto una volta sola per run. ~7 MB. */
export function realDataset(): RawDataset {
  if (!cached) {
    const path = resolve(process.cwd(), 'public/stations.json');
    cached = JSON.parse(readFileSync(path, 'utf8')) as RawDataset;
  }
  return cached;
}
```

- [ ] **Step 7: Scrivere il test che fissa lo schema**

Creare `src/domain/raw.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { FUEL_KEYS } from './raw';
import { realDataset } from './__fixtures__/dataset';

const PROV_RE = /^[A-Z]{2}$/;

describe('schema di stations.json', () => {
  const d = realDataset();

  it('espone le chiavi di primo livello attese', () => {
    expect(Object.keys(d).sort()).toEqual(
      ['by_province', 'extracted_at', 'forecast', 'fuels', 'history', 'national', 'source', 'stations'].sort()
    );
  });

  it('dichiara i quattro carburanti', () => {
    expect([...d.fuels].sort()).toEqual([...FUEL_KEYS].sort());
  });

  it('ha statistiche nazionali complete per ogni carburante', () => {
    for (const f of FUEL_KEYS) {
      const s = d.national[f];
      expect(s, f).toBeTruthy();
      expect(s!.n).toBeGreaterThan(1000);
      expect(s!.std).toBeGreaterThan(0);
      expect(s!.avg).toBeGreaterThan(0);
    }
  });

  it('ha un forecast per ogni carburante con confidenza in [0,1]', () => {
    for (const f of FUEL_KEYS) {
      const fc = d.forecast[f];
      expect(fc, f).toBeTruthy();
      expect(['up', 'down', 'flat']).toContain(fc!.direction);
      expect(fc!.confidence).toBeGreaterThanOrEqual(0);
      expect(fc!.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('ha almeno 100 province valide, e le chiavi sporche sono poche', () => {
    const keys = Object.keys(d.by_province);
    const valid = keys.filter((k) => PROV_RE.test(k));
    const dirty = keys.filter((k) => !PROV_RE.test(k));
    expect(valid.length).toBeGreaterThanOrEqual(100);
    // Il MIMIT infila indirizzi nel campo Provincia. Se un giorno smette, questo
    // test continua a passare; se peggiora, fallisce e va guardato.
    expect(dirty.length).toBeLessThan(20);
  });

  it('ogni prezzo è una coppia [self, servito] con almeno un valore', () => {
    for (const s of d.stations) {
      for (const key of Object.keys(s.p) as (keyof typeof s.p)[]) {
        const pair = s.p[key]!;
        expect(Array.isArray(pair), `${s.id}/${key}`).toBe(true);
        expect(pair.length, `${s.id}/${key}`).toBe(2);
        expect(pair[0] !== null || pair[1] !== null, `${s.id}/${key}`).toBe(true);
      }
    }
  });

  it('ogni stazione ha coordinate dentro il rettangolo Italia e un timestamp', () => {
    for (const s of d.stations) {
      expect(s.lat > 35 && s.lat < 48, String(s.id)).toBe(true);
      expect(s.lng > 6 && s.lng < 19, String(s.id)).toBe(true);
      expect(s.updated, String(s.id)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    }
  });

  it('gli impianti autostradali esistono ma sono pochi e concentrati', () => {
    const hw = d.stations.filter((s) => s.is_highway);
    expect(hw.length).toBeGreaterThan(300);
    expect(hw.length / d.stations.length).toBeLessThan(0.1);
  });
});
```

- [ ] **Step 8: Eseguire i test**

Run: `npm test`
Expected: PASS, 7 test verdi.

Se il test sulle chiavi di primo livello fallisce lamentando `source`, è perché `source` non è nel tipo `RawDataset` — è voluto, non lo usiamo; il test lo elenca lo stesso perché descrive il file.

- [ ] **Step 9: Verificare che la build non si sia rotta**

Run: `npm run build`
Expected: successo, come prima.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tsconfig.domain.json tsconfig.app.json src/domain/
git commit -m "test: vitest e schema di stations.json fissato da test sui dati reali"
```

---

## Task 2: `fuel.ts` — la regola di selezione del prezzo

Il pezzo più importante di tutta la fase. Se questo diverge dalla pipeline, ogni z-score a valle è spazzatura plausibile.

**Files:**
- Create: `src/domain/fuel.ts`
- Test: `src/domain/fuel.test.ts`

**Interfaces:**
- Consumes: `FuelKey`, `RawPricePair`, `FUEL_KEYS` da `raw.ts`.
- Produces:
  - `selectPrice(pair: RawPricePair | undefined, fuel: FuelKey): number | null`
  - `isPlausible(price: number, fuel: FuelKey): boolean`
  - `PRICE_LIMITS: Record<FuelKey, readonly [number, number]>`
  - `toFuelKey(t: FuelType): FuelKey` / `toFuelType(k: FuelKey): FuelType`
  - `FUEL_LABEL: Record<FuelKey, string>`

- [ ] **Step 1: Scrivere il test che fallisce**

Creare `src/domain/fuel.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { selectPrice, isPlausible, toFuelKey, toFuelType, PRICE_LIMITS } from './fuel';
import { FUEL_KEYS } from './raw';
import { realDataset } from './__fixtures__/dataset';

describe('selectPrice', () => {
  it('per diesel e benzina usa solo il self, mai il servito', () => {
    expect(selectPrice([1.899, 1.999], 'diesel')).toBe(1.899);
    expect(selectPrice([null, 1.999], 'diesel')).toBeNull();
    expect(selectPrice([null, 1.999], 'benzina')).toBeNull();
  });

  it('per gpl e metano ricade sul servito quando il self manca', () => {
    expect(selectPrice([0.769, null], 'gpl')).toBe(0.769);
    expect(selectPrice([null, 0.799], 'gpl')).toBe(0.799);
    expect(selectPrice([null, 1.599], 'metano')).toBe(1.599);
  });

  it('restituisce null quando il carburante non è erogato', () => {
    expect(selectPrice(undefined, 'diesel')).toBeNull();
  });

  it('scarta i prezzi fuori dai limiti fisici', () => {
    expect(selectPrice([0.4, null], 'diesel')).toBeNull();
    expect(selectPrice([9.99, null], 'benzina')).toBeNull();
    expect(selectPrice([3.2, null], 'gpl')).toBeNull();
  });

  it('lascia passare i prezzi reali del dataset', () => {
    const d = realDataset();
    let kept = 0;
    for (const s of d.stations) {
      for (const f of FUEL_KEYS) {
        if (selectPrice(s.p[f], f) !== null) kept++;
      }
    }
    // La pipeline conta 20.176 diesel + 20.192 benzina + 4.581 gpl + 1.517 metano.
    const expected = FUEL_KEYS.reduce((acc, f) => acc + (d.national[f]?.n ?? 0), 0);
    expect(kept).toBe(expected);
  });
});

describe('isPlausible', () => {
  it('rispetta i limiti di fetch_stations.py', () => {
    expect(PRICE_LIMITS.diesel).toEqual([1.0, 3.5]);
    expect(PRICE_LIMITS.metano).toEqual([0.5, 4.0]);
    expect(isPlausible(1.0, 'diesel')).toBe(true);
    expect(isPlausible(3.5, 'diesel')).toBe(true);
    expect(isPlausible(3.51, 'diesel')).toBe(false);
    expect(isPlausible(0.29, 'gpl')).toBe(false);
  });
});

describe('conversione con i tipi dell\'app', () => {
  it('va e torna', () => {
    expect(toFuelKey('Diesel')).toBe('diesel');
    expect(toFuelKey('GPL')).toBe('gpl');
    expect(toFuelType('metano')).toBe('Metano');
    for (const f of FUEL_KEYS) expect(toFuelKey(toFuelType(f))).toBe(f);
  });
});
```

Il test «lascia passare i prezzi reali» è il vero collaudo: confronta il conteggio del client con `national[f].n`, che la pipeline ha scritto applicando la sua regola. Se coincidono su ~46.000 righe, le due regole sono la stessa regola.

- [ ] **Step 2: Eseguire il test per vederlo fallire**

Run: `npm test -- fuel`
Expected: FAIL, `Failed to resolve import "./fuel"`.

- [ ] **Step 3: Implementare**

Creare `src/domain/fuel.ts`:

```ts
import type { FuelKey, RawPricePair } from './raw';
import type { FuelType } from '../types';

/** Verbatim da fetch_stations.py:39-44. */
export const PRICE_LIMITS: Record<FuelKey, readonly [number, number]> = {
  diesel: [1.0, 3.5],
  benzina: [1.0, 3.5],
  gpl: [0.3, 2.0],
  metano: [0.5, 4.0],
};

/** fetch_stations.py:420 — per questi due la statistica usa solo il self. */
const SELF_ONLY: readonly FuelKey[] = ['diesel', 'benzina'];

export const FUEL_LABEL: Record<FuelKey, string> = {
  benzina: 'Benzina',
  diesel: 'Diesel',
  gpl: 'GPL',
  metano: 'Metano',
};

export function isPlausible(price: number, fuel: FuelKey): boolean {
  const [lo, hi] = PRICE_LIMITS[fuel];
  return Number.isFinite(price) && price >= lo && price <= hi;
}

/**
 * Il prezzo confrontabile di un impianto per un carburante, con la stessa
 * regola della pipeline: self puro per diesel e benzina, self-o-servito per
 * gpl e metano (il 95% delle pompe GPL è servito).
 * Restituisce null se il carburante non c'è o il prezzo è implausibile.
 */
export function selectPrice(pair: RawPricePair | undefined, fuel: FuelKey): number | null {
  if (!pair) return null;
  const self = pair[0];
  const servito = pair[1];
  const chosen = SELF_ONLY.includes(fuel) ? self : (self ?? servito);
  if (chosen === null || chosen === undefined) return null;
  return isPlausible(chosen, fuel) ? chosen : null;
}

const KEY_BY_TYPE: Record<FuelType, FuelKey> = {
  Benzina: 'benzina',
  Diesel: 'diesel',
  GPL: 'gpl',
  Metano: 'metano',
};

const TYPE_BY_KEY: Record<FuelKey, FuelType> = {
  benzina: 'Benzina',
  diesel: 'Diesel',
  gpl: 'GPL',
  metano: 'Metano',
};

export function toFuelKey(t: FuelType): FuelKey {
  return KEY_BY_TYPE[t];
}

export function toFuelType(k: FuelKey): FuelType {
  return TYPE_BY_KEY[k];
}
```

- [ ] **Step 4: Eseguire i test**

Run: `npm test -- fuel`
Expected: PASS.

Se il conteggio non coincide con `national[f].n`, **non aggiustare il numero atteso**: significa che la regola diverge. Rileggere `fetch_stations.py:420-433` e allineare l'implementazione.

- [ ] **Step 5: Type-check del dominio**

Run: `npm run typecheck:domain`
Expected: nessun errore.

- [ ] **Step 6: Commit**

```bash
git add src/domain/fuel.ts src/domain/fuel.test.ts
git commit -m "feat(domain): selezione del prezzo allineata alla pipeline"
```

---

## Task 3: `parse.ts` — dalla riga grezza alla riga di dominio

**Files:**
- Create: `src/domain/parse.ts`
- Test: `src/domain/parse.test.ts`

**Interfaces:**
- Consumes: `selectPrice` da `fuel.ts`; `RawStation`, `RawDataset`, `FUEL_KEYS`.
- Produces:
  - `interface StationRow { id, name, brand, operator, prov, city, address, isHighway, lat, lng, prices, servito, updated }`
  - `parseStation(raw: RawStation): StationRow | null`
  - `parseStations(raw: RawStation[]): StationRow[]`
  - `isValidProv(p: string): boolean`

- [ ] **Step 1: Scrivere il test che fallisce**

Creare `src/domain/parse.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseStation, parseStations, isValidProv } from './parse';
import type { RawStation } from './raw';
import { realDataset } from './__fixtures__/dataset';

const base: RawStation = {
  id: 1, name: 'Eni Test', brand: 'Agip Eni', operator: 'ACME',
  type: 'Stradale', is_highway: false, address: 'Via Roma 1', city: 'PESCARA',
  prov: 'PE', lat: 42.46, lng: 14.21,
  p: { benzina: [1.899, 1.999], diesel: [2.029, null] },
  updated: '2026-06-08 10:04',
};

describe('isValidProv', () => {
  it('accetta solo due maiuscole', () => {
    expect(isValidProv('PE')).toBe(true);
    expect(isValidProv('pe')).toBe(false);
    expect(isValidProv('')).toBe(false);
    expect(isValidProv('Via Vestina 408 65015')).toBe(false);
  });
});

describe('parseStation', () => {
  it('normalizza i campi e applica la regola di selezione', () => {
    const r = parseStation(base)!;
    expect(r.id).toBe('1');
    expect(r.prov).toBe('PE');
    expect(r.isHighway).toBe(false);
    expect(r.prices.benzina).toBe(1.899);
    expect(r.prices.diesel).toBe(2.029);
    expect(r.servito.benzina).toBe(1.999);
    expect(r.servito.diesel).toBeUndefined();
  });

  it('mette prov a null quando il campo contiene spazzatura', () => {
    const r = parseStation({ ...base, prov: 'Via Vestina 408 65015' })!;
    expect(r.prov).toBeNull();
  });

  it('conserva la stazione anche se un solo carburante è utilizzabile', () => {
    const r = parseStation({ ...base, p: { gpl: [null, 0.799] } })!;
    expect(r.prices.gpl).toBe(0.799);
  });

  it('scarta la stazione senza alcun prezzo utilizzabile', () => {
    // Solo servito su un carburante self-only: nulla di confrontabile.
    expect(parseStation({ ...base, p: { diesel: [null, 2.19] } })).toBeNull();
  });

  it('scarta la stazione con coordinate non finite', () => {
    expect(parseStation({ ...base, lat: NaN })).toBeNull();
  });

  it('usa "Indipendente" quando la bandiera è vuota', () => {
    expect(parseStation({ ...base, brand: '' })!.brand).toBe('Indipendente');
  });
});

describe('parseStations sul dataset reale', () => {
  const rows = parseStations(realDataset().stations);

  it('conserva la grande maggioranza degli impianti', () => {
    expect(rows.length).toBeGreaterThan(20000);
  });

  it('non lascia passare nessuna prov invalida', () => {
    for (const r of rows) {
      if (r.prov !== null) expect(isValidProv(r.prov)).toBe(true);
    }
  });

  it('lascia qualche riga senza provincia, senza scartarla', () => {
    const orphans = rows.filter((r) => r.prov === null);
    expect(orphans.length).toBeGreaterThan(0);
    expect(orphans.length).toBeLessThan(100);
  });

  it('ogni riga conservata ha almeno un prezzo', () => {
    for (const r of rows) {
      expect(Object.keys(r.prices).length, r.id).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Eseguire il test per vederlo fallire**

Run: `npm test -- parse`
Expected: FAIL, import non risolto.

- [ ] **Step 3: Implementare**

Creare `src/domain/parse.ts`:

```ts
import type { FuelKey, RawStation } from './raw';
import { FUEL_KEYS } from './raw';
import { selectPrice } from './fuel';

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
  /** Prezzi confrontabili, già passati da selectPrice. */
  prices: Partial<Record<FuelKey, number>>;
  /** Prezzo servito, tenuto solo per mostrarlo. Mai usato per le statistiche. */
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
    if (s !== null && s !== undefined) servito[f] = s;
  }
  if (Object.keys(prices).length === 0) return null;

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

export function parseStations(raw: RawStation[]): StationRow[] {
  const out: StationRow[] = [];
  for (const r of raw) {
    const row = parseStation(r);
    if (row) out.push(row);
  }
  return out;
}
```

- [ ] **Step 4: Eseguire i test**

Run: `npm test -- parse`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/parse.ts src/domain/parse.test.ts
git commit -m "feat(domain): parsing delle stazioni con validazione della provincia"
```

---

## Task 4: `freshness.ts` — quanto vale un dato vecchio

**Files:**
- Create: `src/domain/freshness.ts`
- Test: `src/domain/freshness.test.ts`

**Interfaces:**
- Consumes: niente.
- Produces:
  - `parseUpdatedAt(s: string | null | undefined): Date | null`
  - `ageHours(updated: string | null | undefined, now: Date): number | null`
  - `confidenceFor(ageH: number | null): number`
  - `describeAge(ageH: number | null): string`

**Assunzione dichiarata:** `updated` è ora locale italiana senza fuso. Viene interpretata nel fuso del dispositivo. Su un telefono italiano è esatto; su un telefono in un altro fuso l'età sbaglia di poche ore e può spostare il coefficiente di una fascia. Accettabile: l'app è per l'Italia e l'età viene comunque mostrata in chiaro all'utente.

- [ ] **Step 1: Scrivere il test che fallisce**

Creare `src/domain/freshness.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseUpdatedAt, ageHours, confidenceFor, describeAge } from './freshness';

const NOW = new Date(2026, 5, 8, 12, 0); // 8 giugno 2026, 12:00 locali

describe('parseUpdatedAt', () => {
  it('legge il formato della pipeline', () => {
    const d = parseUpdatedAt('2026-06-08 10:04')!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(8);
    expect(d.getHours()).toBe(10);
    expect(d.getMinutes()).toBe(4);
  });

  it('restituisce null su input assente o malformato', () => {
    expect(parseUpdatedAt(null)).toBeNull();
    expect(parseUpdatedAt('')).toBeNull();
    expect(parseUpdatedAt('ieri')).toBeNull();
    expect(parseUpdatedAt('2026-13-45 99:99')).toBeNull();
  });
});

describe('ageHours', () => {
  it('conta le ore trascorse', () => {
    expect(ageHours('2026-06-08 10:00', NOW)).toBe(2);
    expect(ageHours('2026-06-07 12:00', NOW)).toBe(24);
  });

  it('azzera le età negative da orologio sfasato', () => {
    expect(ageHours('2026-06-09 12:00', NOW)).toBe(0);
  });

  it('restituisce null se il timestamp manca', () => {
    expect(ageHours(null, NOW)).toBeNull();
  });
});

describe('confidenceFor', () => {
  it('applica la tabella della spec ai bordi', () => {
    expect(confidenceFor(0)).toBe(1.0);
    expect(confidenceFor(24)).toBe(1.0);
    expect(confidenceFor(24.1)).toBe(0.9);
    expect(confidenceFor(48)).toBe(0.9);
    expect(confidenceFor(48.1)).toBe(0.75);
    expect(confidenceFor(72)).toBe(0.75);
    expect(confidenceFor(72.1)).toBe(0.5);
    expect(confidenceFor(120)).toBe(0.5);
    expect(confidenceFor(120.1)).toBe(0.3);
    expect(confidenceFor(10000)).toBe(0.3);
  });

  it('tratta il dato senza data come il più vecchio possibile', () => {
    expect(confidenceFor(null)).toBe(0.3);
  });
});

describe('describeAge', () => {
  it('parla italiano', () => {
    expect(describeAge(0)).toBe('adesso');
    expect(describeAge(2)).toBe('2h fa');
    expect(describeAge(30)).toBe('1 giorno fa');
    expect(describeAge(120)).toBe('5 giorni fa');
    expect(describeAge(null)).toBe('data ignota');
  });
});
```

- [ ] **Step 2: Eseguire il test per vederlo fallire**

Run: `npm test -- freshness`
Expected: FAIL, import non risolto.

- [ ] **Step 3: Implementare**

Creare `src/domain/freshness.ts`:

```ts
const TS_RE = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/;

/** "YYYY-MM-DD HH:MM" nel fuso del dispositivo. Vedi assunzione nel piano. */
export function parseUpdatedAt(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = TS_RE.exec(s);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  if (Number.isNaN(date.getTime())) return null;
  // new Date(2026, 12, ...) trabocca invece di fallire: verifichiamo il ritorno.
  if (date.getMonth() !== Number(mo) - 1 || date.getDate() !== Number(d)) return null;
  return date;
}

export function ageHours(updated: string | null | undefined, now: Date): number | null {
  const at = parseUpdatedAt(updated);
  if (!at) return null;
  const h = (now.getTime() - at.getTime()) / 3_600_000;
  return h < 0 ? 0 : h;
}

/** Spec § 6.2. Un dato senza data vale quanto il più vecchio. */
export function confidenceFor(ageH: number | null): number {
  if (ageH === null) return 0.3;
  if (ageH <= 24) return 1.0;
  if (ageH <= 48) return 0.9;
  if (ageH <= 72) return 0.75;
  if (ageH <= 120) return 0.5;
  return 0.3;
}

export function describeAge(ageH: number | null): string {
  if (ageH === null) return 'data ignota';
  if (ageH < 1) return 'adesso';
  if (ageH < 24) return `${Math.round(ageH)}h fa`;
  const days = Math.round(ageH / 24);
  return days === 1 ? '1 giorno fa' : `${days} giorni fa`;
}
```

- [ ] **Step 4: Eseguire i test**

Run: `npm test -- freshness`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/freshness.ts src/domain/freshness.test.ts
git commit -m "feat(domain): eta del dato e coefficiente di fiducia"
```

---

## Task 5: `market.ts` — le coorti, e la prova che sono giuste

Il task che risolve la scoperta **A**: coorti segmentate autostrada/città calcolate nel client, con `by_province` usato come oracolo.

**Files:**
- Create: `src/domain/market.ts`
- Test: `src/domain/market.test.ts`

**Interfaces:**
- Consumes: `StationRow` da `parse.ts`; `FuelKey`, `FUEL_KEYS`.
- Produces:
  - `type Segment = 'road' | 'highway'`
  - `type CohortSource = 'province-road' | 'province-highway' | 'national-road' | 'national-highway' | 'national'`
  - `interface Stats { avg; std; min; max; n }`
  - `interface Cohort extends Stats { source: CohortSource; reliable: boolean }`
  - `interface CohortIndex` (opaco, prodotto da `buildCohorts`)
  - `buildCohorts(rows: StationRow[]): CohortIndex`
  - `cohortFor(row: StationRow, fuel: FuelKey, idx: CohortIndex): Cohort | null`
  - `MIN_COHORT_N = 8`

- [ ] **Step 1: Scrivere il test che fallisce**

Creare `src/domain/market.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildCohorts, cohortFor, MIN_COHORT_N } from './market';
import { parseStations } from './parse';
import type { StationRow } from './parse';
import { FUEL_KEYS } from './raw';
import { realDataset } from './__fixtures__/dataset';

const d = realDataset();
const rows = parseStations(d.stations);
const idx = buildCohorts(rows);

function row(over: Partial<StationRow>): StationRow {
  return {
    id: 'x', name: 'n', brand: 'b', operator: '', prov: 'PE', city: '', address: '',
    isHighway: false, lat: 42, lng: 14, prices: { diesel: 2.0 }, servito: {}, updated: null,
    ...over,
  };
}

describe('buildCohorts contro l\'oracolo by_province', () => {
  it('la media road+highway di ogni provincia coincide con quella della pipeline', () => {
    let checked = 0;
    for (const [prov, fuels] of Object.entries(d.by_province)) {
      if (!/^[A-Z]{2}$/.test(prov)) continue;
      for (const f of FUEL_KEYS) {
        const oracle = fuels[f];
        if (!oracle) continue;
        const mine = rows.filter((r) => r.prov === prov && r.prices[f] !== undefined);
        expect(mine.length, `${prov}/${f} numerosità`).toBe(oracle.n);
        const avg = mine.reduce((a, r) => a + r.prices[f]!, 0) / mine.length;
        expect(avg, `${prov}/${f} media`).toBeCloseTo(oracle.avg, 3);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(300);
  });
});

describe('cohortFor', () => {
  it('un impianto cittadino in provincia popolosa usa la coorte provinciale stradale', () => {
    const c = cohortFor(row({ prov: 'MI', isHighway: false }), 'diesel', idx)!;
    expect(c.source).toBe('province-road');
    expect(c.reliable).toBe(true);
    expect(c.n).toBeGreaterThanOrEqual(MIN_COHORT_N);
  });

  it('un impianto autostradale non ricade MAI sulla coorte cittadina', () => {
    let sawNationalHighway = false;
    for (const r of rows.filter((x) => x.isHighway)) {
      const c = cohortFor(r, 'diesel', idx);
      if (!c) continue;
      expect(['province-highway', 'national-highway', 'national']).toContain(c.source);
      expect(c.source).not.toBe('province-road');
      expect(c.source).not.toBe('national-road');
      if (c.source === 'national-highway') sawNationalHighway = true;
    }
    // La mediana è 5 impianti autostradali per provincia: la ricaduta nazionale
    // autostradale deve scattare spesso, altrimenti la catena è rotta.
    expect(sawNationalHighway).toBe(true);
  });

  it('la coorte autostradale nazionale è più cara di quella stradale nazionale', () => {
    const hw = cohortFor(row({ prov: 'ZZ', isHighway: true }), 'diesel', idx)!;
    const rd = cohortFor(row({ prov: 'ZZ', isHighway: false }), 'diesel', idx)!;
    expect(hw.avg).toBeGreaterThan(rd.avg);
  });

  it('una stazione senza provincia ricade sulla coorte nazionale del suo segmento', () => {
    const c = cohortFor(row({ prov: null, isHighway: false }), 'diesel', idx)!;
    expect(c.source).toBe('national-road');
    expect(c.reliable).toBe(false);
  });

  it('marca inaffidabile ogni coorte che non sia quella provinciale del segmento', () => {
    const c = cohortFor(row({ prov: 'ZZ', isHighway: false }), 'metano', idx)!;
    expect(c.reliable).toBe(false);
  });

  it('non restituisce mai una coorte con std nulla o n sotto la soglia quando ne esiste una migliore', () => {
    for (const f of FUEL_KEYS) {
      const c = cohortFor(row({ prov: 'ZZ' }), f, idx)!;
      expect(c.n).toBeGreaterThanOrEqual(MIN_COHORT_N);
      expect(c.std).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Eseguire il test per vederlo fallire**

Run: `npm test -- market`
Expected: FAIL, import non risolto.

- [ ] **Step 3: Implementare**

Creare `src/domain/market.ts`:

```ts
import type { FuelKey } from './raw';
import { FUEL_KEYS } from './raw';
import type { StationRow } from './parse';

export const MIN_COHORT_N = 8;

export type Segment = 'road' | 'highway';

export type CohortSource =
  | 'province-road'
  | 'province-highway'
  | 'national-road'
  | 'national-highway'
  | 'national';

export interface Stats {
  avg: number;
  std: number;
  min: number;
  max: number;
  n: number;
}

export interface Cohort extends Stats {
  source: CohortSource;
  /** true solo per la coorte provinciale del proprio segmento. */
  reliable: boolean;
}

export interface CohortIndex {
  /** chiave `${prov}|${segment}|${fuel}` */
  byProv: Map<string, Stats>;
  /** chiave `${segment}|${fuel}` */
  bySegment: Map<string, Stats>;
  byFuel: Map<FuelKey, Stats>;
}

/** Deviazione standard di popolazione, come statistics.pstdev della pipeline. */
function statsOf(values: number[]): Stats {
  const n = values.length;
  const avg = values.reduce((a, v) => a + v, 0) / n;
  const variance = values.reduce((a, v) => a + (v - avg) ** 2, 0) / n;
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { avg, std: Math.sqrt(variance), min, max, n };
}

function push(bucket: Map<string, number[]>, key: string, value: number): void {
  const arr = bucket.get(key);
  if (arr) arr.push(value);
  else bucket.set(key, [value]);
}

/**
 * Costruisce tutte le coorti in una passata sola.
 * VINCOLO: `rows` deve essere il dataset INTERO, mai un sottoinsieme filtrato
 * per distanza o per riquadro di mappa (vedi Global Constraint 2).
 */
export function buildCohorts(rows: StationRow[]): CohortIndex {
  const prov = new Map<string, number[]>();
  const segment = new Map<string, number[]>();
  const fuel = new Map<string, number[]>();

  for (const r of rows) {
    const seg: Segment = r.isHighway ? 'highway' : 'road';
    for (const f of FUEL_KEYS) {
      const p = r.prices[f];
      if (p === undefined) continue;
      if (r.prov) push(prov, `${r.prov}|${seg}|${f}`, p);
      push(segment, `${seg}|${f}`, p);
      push(fuel, f, p);
    }
  }

  const byProv = new Map<string, Stats>();
  for (const [k, v] of prov) byProv.set(k, statsOf(v));
  const bySegment = new Map<string, Stats>();
  for (const [k, v] of segment) bySegment.set(k, statsOf(v));
  const byFuel = new Map<FuelKey, Stats>();
  for (const [k, v] of fuel) byFuel.set(k as FuelKey, statsOf(v));

  return { byProv, bySegment, byFuel };
}

/**
 * La coorte contro cui giudicare questo impianto per questo carburante.
 * Un impianto autostradale resta nell'autostrada per tutta la catena: la
 * ricaduta sulla coorte cittadina lo dipingerebbe rosso per sempre.
 */
export function cohortFor(row: StationRow, fuel: FuelKey, idx: CohortIndex): Cohort | null {
  const seg: Segment = row.isHighway ? 'highway' : 'road';
  const provSource: CohortSource = seg === 'highway' ? 'province-highway' : 'province-road';
  const segSource: CohortSource = seg === 'highway' ? 'national-highway' : 'national-road';

  const chain: Array<[CohortSource, Stats | undefined]> = [
    [provSource, row.prov ? idx.byProv.get(`${row.prov}|${seg}|${fuel}`) : undefined],
    [segSource, idx.bySegment.get(`${seg}|${fuel}`)],
    ['national', idx.byFuel.get(fuel)],
  ];

  for (let i = 0; i < chain.length; i++) {
    const entry = chain[i]!;
    const stats = entry[1];
    if (stats && stats.n >= MIN_COHORT_N && stats.std > 0) {
      return { ...stats, source: entry[0], reliable: i === 0 };
    }
  }

  const last = idx.byFuel.get(fuel);
  return last ? { ...last, source: 'national', reliable: false } : null;
}
```

- [ ] **Step 4: Eseguire i test**

Run: `npm test -- market`
Expected: PASS.

Il test dell'oracolo è quello che conta. Se fallisce sulla numerosità, la regola di selezione del prezzo diverge dalla pipeline (tornare al Task 2). Se fallisce solo sulla media a numerosità corretta, il colpevole è l'arrotondamento: `by_province.avg` è arrotondato a 4 decimali, per questo si confronta con `toBeCloseTo(..., 3)`.

- [ ] **Step 5: Commit**

```bash
git add src/domain/market.ts src/domain/market.test.ts
git commit -m "feat(domain): coorti segmentate autostrada/citta verificate contro by_province"
```

---

## Task 6: `pricing.ts` — z-score e i cinque livelli

**Files:**
- Create: `src/domain/pricing.ts`
- Test: `src/domain/pricing.test.ts`

**Interfaces:**
- Consumes: `Cohort` da `market.ts`.
- Produces:
  - `type PriceLevel = 'best' | 'good' | 'normal' | 'high' | 'worst'`
  - `zScore(price: number, cohort: Cohort): number | null`
  - `levelForZ(z: number | null): PriceLevel`
  - `priceLevel(price, cohort): { level: PriceLevel; z: number | null; reliable: boolean }`
  - `LEVEL_LABEL: Record<PriceLevel, string>`
  - `LEVEL_VAR: Record<PriceLevel, string>`
  - `Z_ABSURD = 4`

- [ ] **Step 1: Scrivere il test che fallisce**

Creare `src/domain/pricing.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { zScore, levelForZ, priceLevel, LEVEL_LABEL, LEVEL_VAR } from './pricing';
import type { Cohort } from './market';

const c: Cohort = { avg: 2.0, std: 0.05, min: 1.8, max: 2.3, n: 100, source: 'province-road', reliable: true };

describe('zScore', () => {
  it('misura in scarti tipo', () => {
    expect(zScore(2.0, c)).toBe(0);
    expect(zScore(1.95, c)).toBeCloseTo(-1, 6);
    expect(zScore(2.1, c)).toBeCloseTo(2, 6);
  });

  it('restituisce null se la coorte non ha dispersione', () => {
    expect(zScore(2.0, { ...c, std: 0 })).toBeNull();
  });
});

describe('levelForZ — i confini della spec § 6.1', () => {
  it('mappa ogni fascia', () => {
    expect(levelForZ(-2)).toBe('best');
    expect(levelForZ(-1.5)).toBe('best');
    expect(levelForZ(-1.49)).toBe('good');
    expect(levelForZ(-0.5)).toBe('good');
    expect(levelForZ(-0.49)).toBe('normal');
    expect(levelForZ(0)).toBe('normal');
    expect(levelForZ(0.49)).toBe('normal');
    expect(levelForZ(0.5)).toBe('high');
    expect(levelForZ(1.49)).toBe('high');
    expect(levelForZ(1.5)).toBe('worst');
    expect(levelForZ(9)).toBe('worst');
  });

  it('senza z il livello è "nella media"', () => {
    expect(levelForZ(null)).toBe('normal');
  });
});

describe('priceLevel', () => {
  it('propaga l\'affidabilità della coorte', () => {
    expect(priceLevel(1.9, c).reliable).toBe(true);
    expect(priceLevel(1.9, { ...c, reliable: false }).reliable).toBe(false);
    expect(priceLevel(1.9, { ...c, std: 0 }).reliable).toBe(false);
  });

  it('restituisce livello, z e affidabilità insieme', () => {
    const r = priceLevel(1.9, c);
    expect(r.level).toBe('best');
    expect(r.z).toBeCloseTo(-2, 6);
  });
});

describe('etichette e variabili CSS', () => {
  it('coprono tutti e cinque i livelli con i nomi della spec', () => {
    expect(LEVEL_LABEL.best).toBe('Affarone');
    expect(LEVEL_LABEL.good).toBe('Conviene');
    expect(LEVEL_LABEL.normal).toBe('Nella media');
    expect(LEVEL_LABEL.high).toBe('Caro');
    expect(LEVEL_LABEL.worst).toBe('Salasso');
    expect(LEVEL_VAR.best).toBe('--price-best');
    expect(Object.keys(LEVEL_VAR)).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Eseguire il test per vederlo fallire**

Run: `npm test -- pricing`
Expected: FAIL, import non risolto.

- [ ] **Step 3: Implementare**

Creare `src/domain/pricing.ts`:

```ts
import type { Cohort } from './market';

export type PriceLevel = 'best' | 'good' | 'normal' | 'high' | 'worst';

/** Oltre questo scarto il dato è quasi certamente errato (spec § 6.3). */
export const Z_ABSURD = 4;

export const LEVEL_LABEL: Record<PriceLevel, string> = {
  best: 'Affarone',
  good: 'Conviene',
  normal: 'Nella media',
  high: 'Caro',
  worst: 'Salasso',
};

export const LEVEL_VAR: Record<PriceLevel, string> = {
  best: '--price-best',
  good: '--price-good',
  normal: '--price-normal',
  high: '--price-high',
  worst: '--price-worst',
};

export function zScore(price: number, cohort: Cohort): number | null {
  if (!(cohort.std > 0)) return null;
  return (price - cohort.avg) / cohort.std;
}

export function levelForZ(z: number | null): PriceLevel {
  if (z === null) return 'normal';
  if (z <= -1.5) return 'best';
  if (z <= -0.5) return 'good';
  if (z < 0.5) return 'normal';
  if (z < 1.5) return 'high';
  return 'worst';
}

export function priceLevel(
  price: number,
  cohort: Cohort
): { level: PriceLevel; z: number | null; reliable: boolean } {
  const z = zScore(price, cohort);
  return { level: levelForZ(z), z, reliable: cohort.reliable && z !== null };
}
```

- [ ] **Step 4: Eseguire i test**

Run: `npm test -- pricing`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/pricing.ts src/domain/pricing.test.ts
git commit -m "feat(domain): scala del prezzo a cinque livelli su z-score"
```

---

## Task 7: `geo.ts` e `units.ts` — distanza, litri, consumi

**Files:**
- Create: `src/domain/geo.ts`
- Create: `src/domain/units.ts`
- Test: `src/domain/geo.test.ts`
- Test: `src/domain/units.test.ts`

**Interfaces:**
- Consumes: `FuelKey`.
- Produces:
  - `haversineKm(a: LatLng, b: LatLng): number`, `interface LatLng { lat: number; lng: number }`
  - `DEFAULT_KML: Record<FuelKey, number>`, `DEFAULT_TANK_L = 45`, `TANK_FILL_FACTOR = 0.85`
  - `interface CarSpec { model: string; liters: number; kml: number }`
  - `litersFor(car: CarSpec | null): number`
  - `kmlFor(car: CarSpec | null, fuel: FuelKey, realKml: number | null): number`

- [ ] **Step 1: Scrivere i test che falliscono**

Creare `src/domain/geo.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { haversineKm } from './geo';

describe('haversineKm', () => {
  it('è zero sullo stesso punto', () => {
    expect(haversineKm({ lat: 42.46, lng: 14.21 }, { lat: 42.46, lng: 14.21 })).toBe(0);
  });

  it('misura Pescara–Chieti attorno ai 15 km', () => {
    const km = haversineKm({ lat: 42.4643, lng: 14.2142 }, { lat: 42.3512, lng: 14.1682 });
    expect(km).toBeGreaterThan(12);
    expect(km).toBeLessThan(16);
  });

  it('misura Milano–Roma attorno ai 480 km', () => {
    const km = haversineKm({ lat: 45.4642, lng: 9.19 }, { lat: 41.9028, lng: 12.4964 });
    expect(km).toBeGreaterThan(455);
    expect(km).toBeLessThan(500);
  });

  it('è simmetrica', () => {
    const a = { lat: 45.46, lng: 9.19 };
    const b = { lat: 41.9, lng: 12.5 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 9);
  });
});
```

Creare `src/domain/units.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { litersFor, kmlFor, DEFAULT_KML, DEFAULT_TANK_L } from './units';

const panda = { model: 'Fiat Panda 1.0 Hybrid (Benzina)', liters: 38, kml: 19 };

describe('litersFor', () => {
  it('riempie l\'85% del serbatoio dell\'auto scelta', () => {
    expect(litersFor(panda)).toBeCloseTo(32.3, 6);
  });

  it('senza auto usa il serbatoio di riferimento da 45 litri', () => {
    expect(litersFor(null)).toBeCloseTo(DEFAULT_TANK_L * 0.85, 6);
  });

  it('ignora un serbatoio dichiarato assurdo', () => {
    expect(litersFor({ ...panda, liters: 0 })).toBeCloseTo(DEFAULT_TANK_L * 0.85, 6);
  });
});

describe('kmlFor', () => {
  it('preferisce il consumo reale quando c\'è', () => {
    expect(kmlFor(panda, 'benzina', 15.2)).toBe(15.2);
  });

  it('poi il dato di targa dell\'auto', () => {
    expect(kmlFor(panda, 'benzina', null)).toBe(19);
  });

  it('infine il default del carburante', () => {
    expect(kmlFor(null, 'diesel', null)).toBe(DEFAULT_KML.diesel);
    expect(kmlFor(null, 'metano', null)).toBe(DEFAULT_KML.metano);
  });

  it('scarta consumi non plausibili', () => {
    expect(kmlFor(panda, 'benzina', 0)).toBe(19);
    expect(kmlFor(panda, 'benzina', 300)).toBe(19);
    expect(kmlFor({ ...panda, kml: -1 }, 'benzina', null)).toBe(DEFAULT_KML.benzina);
  });

  it('applica i default della spec § 6.3', () => {
    expect(DEFAULT_KML).toEqual({ benzina: 15, diesel: 18, gpl: 11, metano: 14 });
  });
});
```

- [ ] **Step 2: Eseguire i test per vederli fallire**

Run: `npm test -- geo units`
Expected: FAIL, import non risolti.

- [ ] **Step 3: Implementare `geo.ts`**

```ts
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
```

- [ ] **Step 4: Implementare `units.ts`**

```ts
import type { FuelKey } from './raw';

/** Spec § 6.3. Metano in km/kg, coerente con il prezzo in €/kg. */
export const DEFAULT_KML: Record<FuelKey, number> = {
  benzina: 15,
  diesel: 18,
  gpl: 11,
  metano: 14,
};

export const DEFAULT_TANK_L = 45;
export const TANK_FILL_FACTOR = 0.85;

export interface CarSpec {
  model: string;
  liters: number;
  kml: number;
}

function sane(v: number | null | undefined, lo: number, hi: number): boolean {
  return typeof v === 'number' && Number.isFinite(v) && v > lo && v < hi;
}

/** Litri di un pieno tipico: l'85% del serbatoio, 45 L se l'auto non è nota. */
export function litersFor(car: CarSpec | null): number {
  const tank = car && sane(car.liters, 5, 200) ? car.liters : DEFAULT_TANK_L;
  return tank * TANK_FILL_FACTOR;
}

/** Consumo reale dai rifornimenti > targa dell'auto > default del carburante. */
export function kmlFor(car: CarSpec | null, fuel: FuelKey, realKml: number | null): number {
  if (sane(realKml, 1, 100)) return realKml as number;
  if (car && sane(car.kml, 1, 100)) return car.kml;
  return DEFAULT_KML[fuel];
}
```

- [ ] **Step 5: Eseguire i test**

Run: `npm test -- geo units`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/geo.ts src/domain/units.ts src/domain/geo.test.ts src/domain/units.test.ts
git commit -m "feat(domain): distanza haversine, litri e consumi con ricaduta sui default"
```

---

## Task 8: `ranking.ts` — il migliore per davvero

Sostituisce `Math.min(...validPrices)` di `App.tsx:935`. In fase 1 vive accanto senza essere collegato.

**Files:**
- Create: `src/domain/ranking.ts`
- Test: `src/domain/ranking.test.ts`

**Interfaces:**
- Consumes: `StationRow`; `CohortIndex`, `Cohort`, `cohortFor`; `priceLevel`, `Z_ABSURD`; `haversineKm`, `LatLng`; `ageHours`, `confidenceFor`.
- Produces:
  - `interface NetInput { price; cohortAvg; liters; distanceKm; kml; confidence }`
  - `interface NetBreakdown { liters; cohortAvg; price; gross; confidence; roadCost; net; distanceKm; kml }`
  - `netSaving(i: NetInput): NetBreakdown`
  - `interface RankContext { fuel; user; cohorts; now; liters; kml; blocked }`
  - `interface RankedStation { row; price; distanceKm; cohort; z; level; ageH; confidence; net; eligible; reason }`
  - `rankStations(rows: StationRow[], ctx: RankContext): RankedStation[]`
  - `pickBest(ranked: RankedStation[]): RankedStation | null`
  - `TIE_EURO = 0.15`

- [ ] **Step 1: Scrivere il test che fallisce**

Creare `src/domain/ranking.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { netSaving, rankStations, pickBest, TIE_EURO } from './ranking';
import type { RankContext } from './ranking';
import { buildCohorts } from './market';
import { parseStations } from './parse';
import type { StationRow } from './parse';
import { realDataset } from './__fixtures__/dataset';

describe('netSaving', () => {
  it('calcola la formula della spec § 6.3 riga per riga', () => {
    const b = netSaving({
      price: 1.9, cohortAvg: 2.0, liters: 38.25, distanceKm: 5, kml: 18, confidence: 1,
    });
    expect(b.gross).toBeCloseTo(3.825, 6);          // (2.00 − 1.90) × 38,25
    expect(b.roadCost).toBeCloseTo(1.0555, 3);      // (2 × 5 / 18) × 1,90
    expect(b.net).toBeCloseTo(2.7695, 3);
  });

  it('sconta il lordo con la fiducia, non il costo della strada', () => {
    const fresh = netSaving({ price: 1.9, cohortAvg: 2.0, liters: 40, distanceKm: 10, kml: 20, confidence: 1 });
    const stale = netSaving({ price: 1.9, cohortAvg: 2.0, liters: 40, distanceKm: 10, kml: 20, confidence: 0.5 });
    expect(stale.roadCost).toBeCloseTo(fresh.roadCost, 9);
    expect(stale.net).toBeCloseTo(fresh.gross * 0.5 - fresh.roadCost, 9);
  });

  it('diventa negativo quando l\'impianto è troppo lontano', () => {
    const b = netSaving({ price: 1.97, cohortAvg: 2.0, liters: 38, distanceKm: 60, kml: 15, confidence: 1 });
    expect(b.net).toBeLessThan(0);
  });
});

function row(over: Partial<StationRow>): StationRow {
  return {
    id: 'x', name: 'n', brand: 'b', operator: '', prov: 'MI', city: '', address: '',
    isHighway: false, lat: 45.4642, lng: 9.19, prices: { diesel: 2.0 }, servito: {},
    updated: '2026-06-08 10:00', ...over,
  };
}

const d = realDataset();
const allRows = parseStations(d.stations);
const cohorts = buildCohorts(allRows);

const ctx: RankContext = {
  fuel: 'diesel',
  user: { lat: 45.4642, lng: 9.19 },
  cohorts,
  now: new Date(2026, 5, 8, 12, 0),
  liters: 38.25,
  kml: 18,
  blocked: new Set<string>(),
};

describe('rankStations', () => {
  it('preferisce il vicino leggermente più caro al lontano leggermente più economico', () => {
    const near = row({ id: 'vicino', prices: { diesel: 1.98 }, lat: 45.4642, lng: 9.19 });
    const far = row({ id: 'lontano', prices: { diesel: 1.95 }, lat: 45.9, lng: 9.19 });
    const best = pickBest(rankStations([near, far], ctx))!;
    expect(best.row.id).toBe('vicino');
  });

  it('a parità di netto entro 15 centesimi vince il più vicino', () => {
    const a = row({ id: 'a', prices: { diesel: 1.95 }, lat: 45.4642, lng: 9.19 });
    const b = row({ id: 'b', prices: { diesel: 1.95 }, lat: 45.474, lng: 9.19 });
    const ranked = rankStations([b, a], ctx);
    expect(Math.abs(ranked[0]!.net.net - ranked[1]!.net.net)).toBeLessThanOrEqual(TIE_EURO);
    expect(pickBest(ranked)!.row.id).toBe('a');
  });

  it('esclude l\'impianto bloccato', () => {
    const blocked = row({ id: 'bloccato', prices: { diesel: 1.5 } });
    const ok = row({ id: 'ok', prices: { diesel: 1.99 } });
    const best = pickBest(rankStations([blocked, ok], { ...ctx, blocked: new Set(['bloccato']) }))!;
    expect(best.row.id).toBe('ok');
  });

  it('esclude il prezzo assurdo invece di premiarlo', () => {
    const absurd = row({ id: 'assurdo', prices: { diesel: 1.02 } });
    const ok = row({ id: 'ok', prices: { diesel: 1.98 } });
    const ranked = rankStations([absurd, ok], ctx);
    expect(ranked.find((r) => r.row.id === 'assurdo')!.eligible).toBe(false);
    expect(ranked.find((r) => r.row.id === 'assurdo')!.reason).toBe('prezzo-assurdo');
    expect(pickBest(ranked)!.row.id).toBe('ok');
  });

  it('declassa il dato vecchio senza nasconderlo', () => {
    const old = row({ id: 'vecchio', prices: { diesel: 1.93 }, updated: '2026-05-20 08:00' });
    const fresh = row({ id: 'fresco', prices: { diesel: 1.95 } });
    const ranked = rankStations([old, fresh], ctx);
    expect(ranked.find((r) => r.row.id === 'vecchio')!.confidence).toBe(0.3);
    expect(ranked.some((r) => r.row.id === 'vecchio')).toBe(true);
    expect(pickBest(ranked)!.row.id).toBe('fresco');
  });

  it('salta le stazioni che non erogano il carburante scelto', () => {
    const gplOnly = row({ id: 'solo-gpl', prices: { gpl: 0.75 } });
    expect(rankStations([gplOnly], ctx)).toHaveLength(0);
  });

  it('regge il dataset reale e produce un migliore sensato', () => {
    const milan = { lat: 45.4642, lng: 9.19 };
    const near = allRows.filter((r) => Math.abs(r.lat - milan.lat) < 0.2 && Math.abs(r.lng - milan.lng) < 0.2);
    const ranked = rankStations(near, { ...ctx, user: milan });
    const best = pickBest(ranked)!;
    expect(best).toBeTruthy();
    expect(best.net.net).toBeGreaterThan(0);
    expect(best.eligible).toBe(true);
    expect(best.distanceKm).toBeLessThan(40);
  });

  it('non elegge un impianto autostradale solo perché la coorte cittadina è più bassa', () => {
    const hw = allRows.filter((r) => r.isHighway && r.prices.diesel !== undefined);
    const ranked = rankStations(hw.slice(0, 200), ctx);
    for (const r of ranked) {
      expect(['province-highway', 'national-highway', 'national']).toContain(r.cohort.source);
    }
  });
});
```

- [ ] **Step 2: Eseguire il test per vederlo fallire**

Run: `npm test -- ranking`
Expected: FAIL, import non risolto.

- [ ] **Step 3: Implementare**

Creare `src/domain/ranking.ts`:

```ts
import type { FuelKey } from './raw';
import type { StationRow } from './parse';
import type { Cohort, CohortIndex } from './market';
import { cohortFor } from './market';
import type { PriceLevel } from './pricing';
import { priceLevel, Z_ABSURD } from './pricing';
import type { LatLng } from './geo';
import { haversineKm } from './geo';
import { ageHours, confidenceFor } from './freshness';

/** Sotto questo scarto di netto due impianti sono pari e decide la distanza. */
export const TIE_EURO = 0.15;

export interface NetInput {
  price: number;
  cohortAvg: number;
  liters: number;
  distanceKm: number;
  kml: number;
  confidence: number;
}

export interface NetBreakdown extends NetInput {
  gross: number;
  roadCost: number;
  net: number;
}

/**
 * Spec § 6.3. Per il metano kml è km/kg e il prezzo €/kg: la formula regge.
 * Il costo strada assume andata e ritorno dedicati — prudente per scelta.
 */
export function netSaving(i: NetInput): NetBreakdown {
  const gross = (i.cohortAvg - i.price) * i.liters;
  const roadCost = ((2 * i.distanceKm) / i.kml) * i.price;
  return { ...i, gross, roadCost, net: gross * i.confidence - roadCost };
}

export type IneligibleReason = 'bloccato' | 'prezzo-assurdo';

export interface RankContext {
  fuel: FuelKey;
  user: LatLng;
  cohorts: CohortIndex;
  now: Date;
  liters: number;
  kml: number;
  blocked: Set<string>;
}

export interface RankedStation {
  row: StationRow;
  price: number;
  distanceKm: number;
  cohort: Cohort;
  z: number | null;
  level: PriceLevel;
  reliable: boolean;
  ageH: number | null;
  confidence: number;
  net: NetBreakdown;
  eligible: boolean;
  reason?: IneligibleReason;
}

export function rankStations(rows: StationRow[], ctx: RankContext): RankedStation[] {
  const out: RankedStation[] = [];

  for (const row of rows) {
    const price = row.prices[ctx.fuel];
    if (price === undefined) continue;

    const cohort = cohortFor(row, ctx.fuel, ctx.cohorts);
    if (!cohort) continue;

    const { level, z, reliable } = priceLevel(price, cohort);
    const distanceKm = haversineKm(ctx.user, { lat: row.lat, lng: row.lng });
    const ageH = ageHours(row.updated, ctx.now);
    const confidence = confidenceFor(ageH);

    let reason: IneligibleReason | undefined;
    if (ctx.blocked.has(row.id)) reason = 'bloccato';
    else if (z !== null && Math.abs(z) > Z_ABSURD) reason = 'prezzo-assurdo';

    out.push({
      row, price, distanceKm, cohort, z, level, reliable, ageH, confidence,
      net: netSaving({
        price, cohortAvg: cohort.avg, liters: ctx.liters,
        distanceKm, kml: ctx.kml, confidence,
      }),
      eligible: reason === undefined,
      reason,
    });
  }

  out.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    return b.net.net - a.net.net;
  });
  return out;
}

/**
 * Il migliore: netto più alto, ma fra tutti quelli che gli stanno entro
 * TIE_EURO vince il più vicino. Fatto in due passaggi e non nel comparatore,
 * perché un confronto con tolleranza non è un ordinamento totale e darebbe
 * risultati dipendenti dall'ordine di partenza.
 */
export function pickBest(ranked: RankedStation[]): RankedStation | null {
  const eligible = ranked.filter((r) => r.eligible);
  const leader = eligible[0];
  if (!leader) return null;
  let best = leader;
  for (const r of eligible) {
    if (leader.net.net - r.net.net > TIE_EURO) break;
    if (r.distanceKm < best.distanceKm) best = r;
  }
  return best;
}
```

- [ ] **Step 4: Eseguire i test**

Run: `npm test -- ranking`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/ranking.ts src/domain/ranking.test.ts
git commit -m "feat(domain): risparmio netto con costo di deviazione al posto di Math.min"
```

---

## Task 9: `forecast.ts` — leggere la previsione e dare il consiglio

**Files:**
- Create: `src/domain/forecast.ts`
- Test: `src/domain/forecast.test.ts`

**Interfaces:**
- Consumes: `RawDataset`, `FuelKey`; `PriceLevel` da `pricing.ts`.
- Produces:
  - `MIN_FORECAST_CONFIDENCE = 0.3`
  - `interface ForecastView { direction; deltaC; daysAhead; confidence; usable }`
  - `readForecast(d: RawDataset, fuel: FuelKey): ForecastView | null`
  - `type Advice = 'FILL-FULL' | 'TEN-EURO' | 'URGENT' | 'PRICE-ONLY'`
  - `adviceOfTheDay(i: AdviceInput): { advice: Advice; reason: string }`

- [ ] **Step 1: Scrivere il test che fallisce**

Creare `src/domain/forecast.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readForecast, adviceOfTheDay, MIN_FORECAST_CONFIDENCE } from './forecast';
import type { ForecastView } from './forecast';
import { realDataset } from './__fixtures__/dataset';

const d = realDataset();

describe('readForecast', () => {
  it('legge la previsione di backend senza toccarla', () => {
    const f = readForecast(d, 'benzina')!;
    expect(f.direction).toBe(d.forecast.benzina!.direction);
    expect(f.deltaC).toBe(d.forecast.benzina!.delta_c);
    expect(f.daysAhead).toBe(d.forecast.benzina!.days_ahead);
    expect(f.confidence).toBe(d.forecast.benzina!.confidence);
  });

  it('marca inutilizzabile la previsione sotto soglia', () => {
    // Nel dataset reale il diesel ha confidence 0,07 e il metano 0,03.
    expect(readForecast(d, 'diesel')!.usable).toBe(false);
    expect(readForecast(d, 'metano')!.usable).toBe(false);
    expect(readForecast(d, 'benzina')!.usable).toBe(true);
    expect(MIN_FORECAST_CONFIDENCE).toBe(0.3);
  });

  it('restituisce null se il carburante non ha previsione', () => {
    expect(readForecast({ ...d, forecast: {} }, 'diesel')).toBeNull();
  });
});

const usable = (over: Partial<ForecastView>): ForecastView => ({
  direction: 'flat', deltaC: 0, daysAhead: 7, confidence: 0.9, usable: true, ...over,
});

describe('adviceOfTheDay', () => {
  it('in riserva dice di rifornire, comunque vada la previsione', () => {
    const r = adviceOfTheDay({ bestLevel: 'worst', forecast: usable({ direction: 'down' }), tankPct: 0.08 });
    expect(r.advice).toBe('URGENT');
  });

  it('previsione in calo e confidenza sufficiente: metti il minimo', () => {
    const r = adviceOfTheDay({ bestLevel: 'normal', forecast: usable({ direction: 'down', confidence: 0.6 }), tankPct: 0.5 });
    expect(r.advice).toBe('TEN-EURO');
  });

  it('previsione in calo ma confidenza sotto 0,5: non si azzarda', () => {
    const r = adviceOfTheDay({ bestLevel: 'normal', forecast: usable({ direction: 'down', confidence: 0.4 }), tankPct: 0.5 });
    expect(r.advice).not.toBe('TEN-EURO');
  });

  it('previsione in salita: fai il pieno', () => {
    const r = adviceOfTheDay({ bestLevel: 'normal', forecast: usable({ direction: 'up', confidence: 0.8 }), tankPct: 0.5 });
    expect(r.advice).toBe('FILL-FULL');
  });

  it('affarone disponibile: fai il pieno anche senza previsione', () => {
    const r = adviceOfTheDay({ bestLevel: 'best', forecast: null, tankPct: 0.5 });
    expect(r.advice).toBe('FILL-FULL');
  });

  it('senza previsione utilizzabile lo dichiara', () => {
    const r = adviceOfTheDay({ bestLevel: 'high', forecast: usable({ usable: false }), tankPct: 0.5 });
    expect(r.advice).toBe('PRICE-ONLY');
    expect(r.reason).toContain('segnale insufficiente');
  });

  it('senza livello serbatoio non inventa la riserva', () => {
    const r = adviceOfTheDay({ bestLevel: 'normal', forecast: usable({ direction: 'up' }), tankPct: null });
    expect(r.advice).toBe('FILL-FULL');
  });
});
```

- [ ] **Step 2: Eseguire il test per vederlo fallire**

Run: `npm test -- forecast`
Expected: FAIL, import non risolto.

- [ ] **Step 3: Implementare**

Creare `src/domain/forecast.ts`:

```ts
import type { FuelKey, RawDataset } from './raw';
import type { PriceLevel } from './pricing';

/** Spec § 6.4: sotto questa confidenza si tace. */
export const MIN_FORECAST_CONFIDENCE = 0.3;

/** Sotto questa frazione di serbatoio l'utente è in riserva. */
export const RESERVE_PCT = 0.15;

/** Soglia per fidarsi di una discesa e comprare il minimo. */
const TRUST_DOWN = 0.5;

export interface ForecastView {
  direction: 'up' | 'down' | 'flat';
  deltaC: number;
  daysAhead: number;
  confidence: number;
  usable: boolean;
}

export function readForecast(d: RawDataset, fuel: FuelKey): ForecastView | null {
  const f = d.forecast?.[fuel];
  if (!f) return null;
  return {
    direction: f.direction,
    deltaC: f.delta_c,
    daysAhead: f.days_ahead,
    confidence: f.confidence,
    usable: f.confidence >= MIN_FORECAST_CONFIDENCE,
  };
}

export type Advice = 'FILL-FULL' | 'TEN-EURO' | 'URGENT' | 'PRICE-ONLY';

export interface AdviceInput {
  bestLevel: PriceLevel | null;
  forecast: ForecastView | null;
  /** Frazione di serbatoio residua, null se ignota. */
  tankPct: number | null;
}

/** Spec § 6.5. La riserva ha la precedenza su tutto. */
export function adviceOfTheDay(i: AdviceInput): { advice: Advice; reason: string } {
  if (i.tankPct !== null && i.tankPct <= RESERVE_PCT) {
    return { advice: 'URGENT', reason: 'Sei in riserva: conta arrivarci, non risparmiare.' };
  }

  const f = i.forecast && i.forecast.usable ? i.forecast : null;

  if (f && f.direction === 'down' && f.confidence >= TRUST_DOWN) {
    return {
      advice: 'TEN-EURO',
      reason: `Prezzi attesi in calo di ${Math.abs(f.deltaC).toFixed(1)} cent entro ${f.daysAhead} giorni: metti il minimo e aspetta.`,
    };
  }

  if (f && f.direction === 'up') {
    return {
      advice: 'FILL-FULL',
      reason: `Prezzi attesi in salita di ${Math.abs(f.deltaC).toFixed(1)} cent entro ${f.daysAhead} giorni: conviene fare il pieno ora.`,
    };
  }

  if (i.bestLevel === 'best') {
    return { advice: 'FILL-FULL', reason: 'Vicino a te c\'è un prezzo ben sotto la media della zona: approfittane.' };
  }

  if (!f) {
    return {
      advice: 'PRICE-ONLY',
      reason: 'Previsione non disponibile — segnale insufficiente. Il consiglio guarda solo il prezzo di oggi.',
    };
  }

  return { advice: 'PRICE-ONLY', reason: 'Prezzi stabili: rifornisci quando ti serve, scegliendo il netto migliore.' };
}
```

- [ ] **Step 4: Eseguire i test**

Run: `npm test -- forecast`
Expected: PASS.

- [ ] **Step 5: Eseguire tutta la suite e il type-check**

Run: `npm test && npm run typecheck:domain && npm run build`
Expected: tutto verde.

- [ ] **Step 6: Commit**

```bash
git add src/domain/forecast.ts src/domain/forecast.test.ts
git commit -m "feat(domain): lettura del forecast di backend e consiglio del giorno"
```

---

## Task 10: `tokens.css` e i caratteri

Ultimo pezzo di fondamenta. Il file viene creato e importato, ma nessun componente esistente lo usa ancora: l'aspetto dell'app non cambia in fase 1.

> **Deviazione emersa in esecuzione — ogni token porta il prefisso `--mf-`.**
> I nomi nudi di questa sezione (`--font-sans`, `--font-mono`, `--radius-sm|md|lg`) collidono con il blocco `@theme` di Tailwind v4, che `src/index.css` importa **dopo** `tokens.css`: a parità di specificità vinceva Tailwind, quindi `var(--font-sans)` avrebbe restituito Inter e non Bricolage, in silenzio. Verificato leggendo il CSS costruito, dove entrambe le definizioni comparivano e la seconda prevaleva.
> Invertire l'ordine di import non è la soluzione: farebbe passare tutta l'app a Bricolage adesso, mentre l'adozione dei caratteri Notte è una decisione della fase 2. Quindi il sistema Notte prende un suo spazio di nomi: `--mf-ground`, `--mf-accent`, `--mf-price-best`, `--mf-font-sans`, … e le classi diventano `.mf-num` e `.mf-label`. `LEVEL_VAR` in `pricing.ts` (Task 6) restituisce di conseguenza `--mf-price-*`, e il suo test lo verifica.

**Files:**
- Create: `src/design/tokens.css`
- Modify: `src/index.css` (una riga di import in testa)
- Modify: `package.json` (due devDependency di font)

- [ ] **Step 1: Installare i caratteri self-hosted**

```bash
npm install @fontsource-variable/bricolage-grotesque @fontsource/dm-mono
```

Self-hosted e non Google Fonts perché l'app gira anche come APK Capacitor e offline: un `<link>` a `fonts.googleapis.com` lascerebbe l'interfaccia senza caratteri proprio nei casi che questa app deve coprire (in auto, senza campo).

- [ ] **Step 2: Scrivere i token**

Creare `src/design/tokens.css`:

```css
/* Design system "Notte" — spec § 4. Unica fonte di verità dei colori. */
@import '@fontsource-variable/bricolage-grotesque';
@import '@fontsource/dm-mono/400.css';
@import '@fontsource/dm-mono/500.css';

:root {
  /* Superfici e testo */
  --ground: #08090b;
  --surface: #101418;
  --surface-raised: #171c21;
  --hairline: #222a31;
  --ink: #f2f5f4;
  --ink-2: #a5aeb4;
  --muted: #646e75;
  --accent: #40dce6;
  --accent-ink: #02171a;

  /* Scala semantica del prezzo — solo per i prezzi, mai per la grafica.
     L'accento non significa mai "risparmio". */
  --price-best: #2fe0a8;
  --price-good: #9be07b;
  --price-normal: #f2f5f4;
  --price-high: #f2b33c;
  --price-worst: #f2645a;

  /* Il filo di luce sul bordo alto: è questo che rende materiali
     le superfici su fondo scuro. */
  --edge-light: inset 0 1px 0 rgb(255 255 255 / 0.05);

  /* Tipografia */
  --font-sans: 'Bricolage Grotesque Variable', 'Bricolage Grotesque',
    system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-mono: 'DM Mono', ui-monospace, 'SF Mono', 'Cascadia Mono', monospace;

  --price-hero-size: 58px;
  --price-hero-weight: 800;
  --price-hero-tracking: -0.06em;

  /* Spazio e raggi */
  --gap-1: 4px;
  --gap-2: 8px;
  --gap-3: 12px;
  --gap-4: 16px;
  --gap-5: 24px;
  --gap-6: 32px;
  --radius-sm: 10px;
  --radius-md: 16px;
  --radius-lg: 24px;
  --radius-pill: 999px;
}

/* Ogni cifra mostrata all'utente passa da qui: mono tabulare, sempre. */
.num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
}

/* Micro-etichette maiuscole: mono, spaziate, mai in tondo umano. */
.label {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}
```

- [ ] **Step 3: Importare i token**

In `src/index.css`, come **prima** riga del file (prima di qualunque direttiva Tailwind, così i token sono disponibili ovunque):

```css
@import './design/tokens.css';
```

- [ ] **Step 4: Verificare che i caratteri arrivino davvero nel bundle**

Run: `npm run build`
Expected: successo, e in `dist/assets/` compaiono file `.woff2` dei due caratteri.

Controllo: `ls dist/assets/*.woff2 | head`

- [ ] **Step 5: Verificare a occhio che nulla sia cambiato**

Run: `npm run dev`
Aprire `http://localhost:5173`. L'app deve apparire **identica a prima**: in fase 1 i token esistono ma nessun componente li usa. Se qualcosa cambia aspetto, un selettore globale è entrato per sbaglio in `tokens.css` — vanno lasciate solo variabili e le due classi di utilità.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/design/tokens.css src/index.css
git commit -m "feat(design): token del sistema Notte e caratteri self-hosted"
```

---

## Task 11: `PriceText` e `Pill` — le due primitive che il dominio decide

`PriceText` è il punto in cui la regola «il colore è il dato» smette di essere una frase della spec e diventa codice: il livello calcolato da `pricing.ts` sceglie la variabile CSS, e nessun componente potrà più colorare un prezzo a mano.

**Files:**
- Create: `src/design/primitives/PriceText.tsx`
- Create: `src/design/primitives/Pill.tsx`
- Test: `src/design/primitives/primitives.test.ts`

**Interfaces:**
- Consumes: `PriceLevel`, `LEVEL_VAR` da `domain/pricing.ts`.
- Produces:
  - `priceColor(level: PriceLevel): string`
  - `formatEuro(price: number): string`
  - `PriceText({ price, level, hero?, className? })`
  - `type PillTone = 'accent' | 'neutral' | 'ghost'`
  - `pillStyle(tone: PillTone): CSSProperties`
  - `Pill({ tone?, children, className? })`

I test girano in ambiente Node su ciò che ha logica — colore, formato, tono — senza montare nulla: aggiungere jsdom e una libreria di rendering per verificare due `<span>` senza rami condizionali sarebbe impalcatura più pesante di ciò che regge. Il rendering vero si guarda a occhio nello Step 5.

- [ ] **Step 1: Scrivere il test che fallisce**

Creare `src/design/primitives/primitives.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { priceColor, formatEuro } from './PriceText';
import { pillStyle } from './Pill';
import type { PriceLevel } from '../../domain/pricing';

const LEVELS: PriceLevel[] = ['best', 'good', 'normal', 'high', 'worst'];

describe('priceColor', () => {
  it('rimanda alla variabile della scala del prezzo', () => {
    expect(priceColor('best')).toBe('var(--price-best)');
    expect(priceColor('normal')).toBe('var(--price-normal)');
    expect(priceColor('worst')).toBe('var(--price-worst)');
  });

  it('non usa MAI l\'accento: il ciano non significa risparmio', () => {
    for (const l of LEVELS) expect(priceColor(l)).not.toContain('accent');
  });

  it('copre tutti e cinque i livelli', () => {
    expect(new Set(LEVELS.map(priceColor)).size).toBe(5);
  });
});

describe('formatEuro', () => {
  it('scrive tre decimali con la virgola', () => {
    expect(formatEuro(1.9)).toBe('1,900');
    expect(formatEuro(2.03)).toBe('2,030');
    expect(formatEuro(0.799)).toBe('0,799');
  });
});

describe('pillStyle', () => {
  it('solo il tono accento usa --accent', () => {
    expect(pillStyle('accent').background).toBe('var(--accent)');
    expect(String(pillStyle('neutral').background)).not.toContain('accent');
    expect(String(pillStyle('ghost').background)).not.toContain('accent');
  });

  it('il testo sull\'accento usa il suo inchiostro dedicato', () => {
    expect(pillStyle('accent').color).toBe('var(--accent-ink)');
  });
});
```

- [ ] **Step 2: Eseguire il test per vederlo fallire**

Run: `npm test -- primitives`
Expected: FAIL, import non risolti.

- [ ] **Step 3: Implementare `PriceText.tsx`**

```tsx
import type { CSSProperties } from 'react';
import type { PriceLevel } from '../../domain/pricing';
import { LEVEL_VAR } from '../../domain/pricing';

export function priceColor(level: PriceLevel): string {
  return `var(${LEVEL_VAR[level]})`;
}

/** Prezzo all'italiana: tre decimali, virgola. */
export function formatEuro(price: number): string {
  return price.toFixed(3).replace('.', ',');
}

interface PriceTextProps {
  price: number;
  level: PriceLevel;
  /** Il prezzo grande della Home: 58px, peso 800, sans. */
  hero?: boolean;
  className?: string;
}

export function PriceText({ price, level, hero = false, className }: PriceTextProps) {
  const style: CSSProperties = {
    color: priceColor(level),
    fontFamily: hero ? 'var(--font-sans)' : 'var(--font-mono)',
    fontVariantNumeric: 'tabular-nums',
    ...(hero
      ? {
          fontSize: 'var(--price-hero-size)',
          fontWeight: 800,
          letterSpacing: 'var(--price-hero-tracking)',
          lineHeight: 1,
        }
      : { fontWeight: 500 }),
  };
  return (
    <span className={className} style={style}>
      {formatEuro(price)}
    </span>
  );
}
```

- [ ] **Step 4: Implementare `Pill.tsx`**

```tsx
import type { CSSProperties, ReactNode } from 'react';

export type PillTone = 'accent' | 'neutral' | 'ghost';

const TONE: Record<PillTone, { background: string; color: string; border: string }> = {
  accent: { background: 'var(--accent)', color: 'var(--accent-ink)', border: '1px solid transparent' },
  neutral: { background: 'var(--surface-raised)', color: 'var(--ink)', border: '1px solid var(--hairline)' },
  ghost: { background: 'transparent', color: 'var(--ink-2)', border: '1px solid var(--hairline)' },
};

export function pillStyle(tone: PillTone): CSSProperties {
  const t = TONE[tone];
  return {
    background: t.background,
    color: t.color,
    border: t.border,
    borderRadius: 'var(--radius-pill)',
    padding: '6px 12px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--gap-2)',
    fontFamily: 'var(--font-sans)',
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
  };
}

interface PillProps {
  tone?: PillTone;
  children: ReactNode;
  className?: string;
}

export function Pill({ tone = 'neutral', children, className }: PillProps) {
  return (
    <span className={className} style={pillStyle(tone)}>
      {children}
    </span>
  );
}
```

- [ ] **Step 5: Eseguire i test e la build**

Run: `npm test -- primitives && npm run build`
Expected: PASS e build riuscita. Nessuna schermata usa ancora queste primitive: l'app resta identica.

- [ ] **Step 6: Commit**

```bash
git add src/design/primitives/
git commit -m "feat(design): primitive PriceText e Pill guidate dal livello del prezzo"
```

---

## Chiusura di fase

- [ ] **Suite completa verde:** `npm test` — 11 file di test.
- [ ] **Type-check severo del dominio:** `npm run typecheck:domain`.
- [ ] **Build dell'app:** `npm run build`.
- [ ] **L'app gira ed è identica a prima:** `npm run dev`.

Alla fine di questa fase esiste un dominio calcolabile e verificato contro dati veri, ma **ancora nessuna schermata lo usa**. È voluto: la fase 2 sostituisce Home e Mappa appoggiandosi a queste funzioni, e in quel momento `Math.min(...validPrices)`, `localAnalysis.ts` e il filtro rigido a 7 giorni di `dataService.ts:175` escono di scena.

---

## Lavoro che questa fase lascia scritto per dopo

- **`fetch_stations.py` dovrebbe emettere `by_region`** (e, già che c'è, `by_province_highway`). Ha i dati a monte; il client no. Solo così il passo regionale della spec § 6.1 diventa implementabile senza inventare una tabella di 107 province.
- **Il campo `Provincia` del MIMIT contiene indirizzi** su una decina di impianti. La pipeline potrebbe scartarli invece di propagarli; il client per ora si difende da solo.
- **`history.metano` ha 24 punti** contro i 348 degli altri: ogni grafico storico di fase 2 deve reggere serie corte senza sembrare rotto.

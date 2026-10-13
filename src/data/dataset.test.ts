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
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(DA_RETE)));

    const d = await loadDataset();
    expect(d?.stations[0]?.name).toBe('cache');
    expect(d?.stations[0]?.name).not.toBe('rete');
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

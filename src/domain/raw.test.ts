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

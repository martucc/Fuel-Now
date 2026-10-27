import { describe, it, expect } from 'vitest';
import { comeVibrare, LIVELLI_VIBRAZIONE } from './vibrazione';
import type { Tocco } from './vibrazione';

const TOCCHI: Tocco[] = ['light', 'medium', 'heavy', 'selection', 'success', 'error'];

describe('comeVibrare', () => {
  it('spenta non vibra mai', () => {
    for (const t of TOCCHI) expect(comeVibrare('spenta', t)).toBeNull();
  });

  it('leggera usa sempre il tocco di sistema, e il cambio scheda è lo scatto più corto', () => {
    for (const t of TOCCHI) expect(comeVibrare('leggera', t)?.via).toBe('sistema');
    expect(comeVibrare('leggera', 'selection')).toEqual({ via: 'sistema', tipo: 'scatto' });
  });

  it('decisa non usa mai la selezione del plugin, quella da 100 ms', () => {
    expect(comeVibrare('decisa', 'selection')).toEqual({ via: 'plugin', tipo: 'impatto-leggero' });
  });

  it('ogni livello ha una risposta per ogni tocco', () => {
    for (const l of LIVELLI_VIBRAZIONE) for (const t of TOCCHI) expect(() => comeVibrare(l, t)).not.toThrow();
  });
});

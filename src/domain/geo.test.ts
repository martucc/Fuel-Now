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

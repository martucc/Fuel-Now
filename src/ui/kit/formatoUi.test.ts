import { describe, it, expect } from 'vitest';
import { distanza } from './formatoUi';

describe('distanza', () => {
  it('sotto il km in metri, arrotondati ai 50', () => {
    expect(distanza(0.04)).toBe('50 m');
    expect(distanza(0.85)).toBe('850 m');
    expect(distanza(0.97)).toBe('950 m');
  });

  it('mai «1000 m»: da lì in km', () => {
    expect(distanza(0.99)).toBe('1,0 km');
    expect(distanza(1)).toBe('1,0 km');
    expect(distanza(1.4)).toBe('1,4 km');
    expect(distanza(14.2)).toBe('14 km');
  });
});

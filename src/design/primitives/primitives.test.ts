import { describe, it, expect } from 'vitest';
import { priceColor, formatEuro } from './PriceText';
import { pillStyle } from './Pill';
import type { PriceLevel } from '../../domain/pricing';

const LEVELS: PriceLevel[] = ['best', 'good', 'normal', 'high', 'worst'];

describe('priceColor', () => {
  it('rimanda alla variabile della scala del prezzo', () => {
    expect(priceColor('best')).toBe('var(--mf-price-best)');
    expect(priceColor('normal')).toBe('var(--mf-price-normal)');
    expect(priceColor('worst')).toBe('var(--mf-price-worst)');
  });

  it("non usa MAI l'accento: il ciano non significa risparmio", () => {
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
  it('solo il tono accento usa --mf-accent', () => {
    expect(pillStyle('accent').background).toBe('var(--mf-accent)');
    expect(String(pillStyle('neutral').background)).not.toContain('accent');
    expect(String(pillStyle('ghost').background)).not.toContain('accent');
  });

  it("il testo sull'accento usa il suo inchiostro dedicato", () => {
    expect(pillStyle('accent').color).toBe('var(--mf-accent-ink)');
  });
});

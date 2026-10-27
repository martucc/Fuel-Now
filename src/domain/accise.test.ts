import { describe, it, expect } from 'vitest';
import { scomponiPrezzo, effettoSulPrezzo, ACCISA, IVA } from './accise';

describe('scomponiPrezzo', () => {
  it('rimette insieme i pezzi e ritrova il prezzo di partenza', () => {
    // La prova del nove: (prodotto + accisa) x 1,22 deve tornare il prezzo.
    const s = scomponiPrezzo(2.031, 'benzina')!;
    expect((s.prodotto + s.accisa) * (1 + IVA)).toBeCloseTo(2.031, 6);
    expect(s.prodotto + s.accisa + s.iva).toBeCloseTo(2.031, 6);
  });

  it('calcola l IVA sul totale, non sul prodotto', () => {
    // Sbagliare qui e l'errore classico: l'IVA si paga anche sull'accisa.
    const s = scomponiPrezzo(2.031, 'benzina')!;
    expect(s.iva).toBeCloseTo(2.031 - 2.031 / 1.22, 6);
    expect(s.iva).toBeGreaterThan(0.36);
  });

  it('dice che piu di meta del prezzo della benzina e tassa', () => {
    const s = scomponiPrezzo(2.031, 'benzina')!;
    expect(s.quotaTasse).toBeGreaterThan(0.5);
    expect(s.quotaTasse).toBeLessThan(0.6);
  });

  it('usa l accisa giusta per il gasolio', () => {
    const s = scomponiPrezzo(2.118, 'diesel')!;
    expect(s.accisa).toBe(ACCISA.diesel);
    expect(s.prodotto).toBeGreaterThan(0);
  });

  it('tace su gpl e metano invece di inventare un accisa al litro', () => {
    expect(scomponiPrezzo(0.755, 'gpl')).toBeNull();
    expect(scomponiPrezzo(1.643, 'metano')).toBeNull();
  });

  it('rifiuta i prezzi che non stanno in piedi', () => {
    expect(scomponiPrezzo(0, 'benzina')).toBeNull();
    expect(scomponiPrezzo(-1, 'benzina')).toBeNull();
    expect(scomponiPrezzo(NaN, 'benzina')).toBeNull();
    // Sotto la sola accisa piu IVA non e un prezzo, e un dato rotto.
    expect(scomponiPrezzo(0.5, 'benzina')).toBeNull();
  });
});

describe('effettoSulPrezzo', () => {
  it('sul prodotto cade solo l IVA, l accisa non si muove', () => {
    // Dieci centesimi di greggio in piu diventano 12,2 alla pompa.
    expect(effettoSulPrezzo(0.1)).toBeCloseTo(0.122, 6);
  });
});

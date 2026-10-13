import { describe, it, expect } from 'vitest';
import { ritmoSettimanale, SOGLIA_AMPIEZZA_C } from './settimana';
import { realDataset } from './__fixtures__/dataset';

/** Genera n giorni consecutivi partendo da un lunedi. */
function serie(n: number, prezzo: (i: number, giorno: number) => number) {
  const inizio = Date.UTC(2025, 0, 6); // 6 gennaio 2025 e un lunedi
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(inizio + i * 86400_000);
    return { date: d.toISOString().slice(0, 10), avg: prezzo(i, d.getUTCDay()) };
  });
}

describe('ritmoSettimanale', () => {
  it('non si pronuncia su uno storico troppo corto', () => {
    const r = ritmoSettimanale(serie(20, () => 1.9));
    expect(r.significativo).toBe(false);
    expect(r.migliore).toBeNull();
  });

  it('su prezzi piatti non trova nessun giorno migliore', () => {
    const r = ritmoSettimanale(serie(200, () => 1.9));
    expect(r.ampiezzaC).toBeCloseTo(0, 6);
    expect(r.significativo).toBe(false);
  });

  it('trova il giorno che costa meno quando esiste davvero', () => {
    // Il lunedi (1) sta due centesimi sotto tutti gli altri.
    const r = ritmoSettimanale(serie(280, (_, g) => (g === 1 ? 1.88 : 1.9)));
    expect(r.migliore!.giorno).toBe(1);
    expect(r.migliore!.nome).toBe('lunedì');
    expect(r.significativo).toBe(true);
    expect(r.ampiezzaC).toBeGreaterThan(SOGLIA_AMPIEZZA_C);
  });

  it('non si fa ingannare da un anno di prezzi in salita', () => {
    // Senza togliere la tendenza, il sabato risulterebbe piu caro del lunedi
    // solo perche in ogni settimana arriva dopo.
    const r = ritmoSettimanale(serie(280, (i) => 1.7 + i * 0.001));
    expect(r.ampiezzaC).toBeLessThan(SOGLIA_AMPIEZZA_C);
    expect(r.significativo).toBe(false);
  });

  it('vede il giorno buono anche sotto una tendenza forte', () => {
    const r = ritmoSettimanale(serie(280, (i, g) => 1.7 + i * 0.001 - (g === 3 ? 0.02 : 0)));
    expect(r.migliore!.giorno).toBe(3);
    expect(r.significativo).toBe(true);
  });

  it('salta le settimane con un buco invece di confrontarle con giorni non contigui', () => {
    const piena = serie(280, (_, g) => (g === 1 ? 1.88 : 1.9));
    const bucata = piena.filter((_, i) => i % 11 !== 0);
    const r = ritmoSettimanale(bucata);
    // Resta un risultato onesto, su meno punti.
    expect(r.migliore!.giorno).toBe(1);
    expect(r.giorni.every((g) => g.campione > 0)).toBe(true);
  });

  it('sul dataset vero produce sette giorni e numeri credibili', () => {
    const d = realDataset();
    const r = ritmoSettimanale(d.history.benzina ?? []);
    expect(r.giorni).toHaveLength(7);
    for (const g of r.giorni) {
      expect(g.campione, g.nome).toBeGreaterThan(5);
      // Uno scarto di piu di cinque centesimi per giorno della settimana
      // non e un ritmo, e un errore di calcolo.
      expect(Math.abs(g.scartoC), g.nome).toBeLessThan(5);
    }
    expect(r.ampiezzaC).toBeGreaterThanOrEqual(0);
  });
});

describe('ritmoSettimanale: quando non si deve pronunciare', () => {
  it('non chiama significativo un giorno che sta a un passo dal rumore', () => {
    // Un ritmo largo ma pieno di sobbalzi: la media dice mercoledi, ma
    // l'errore standard e piu grande dello scarto.
    const rumoroso = serie(280, (i, g) => {
      const salto = ((i * 2654435761) % 1000) / 1000 - 0.5; // pseudo-caso ripetibile
      return 1.9 + salto * 0.2 - (g === 3 ? 0.004 : 0);
    });
    const r = ritmoSettimanale(rumoroso);
    expect(r.significativo).toBe(false);
  });

  it('sul dataset vero risponde senza inventare', () => {
    const d = realDataset();
    for (const f of ['benzina', 'diesel'] as const) {
      const r = ritmoSettimanale(d.history[f] ?? []);
      if (!r.significativo) continue;
      // Se si pronuncia, il giorno migliore deve reggere il proprio errore.
      expect(Math.abs(r.migliore!.scartoC), f).toBeGreaterThanOrEqual(2 * r.migliore!.erroreC);
      expect(r.ampiezzaC, f).toBeGreaterThanOrEqual(SOGLIA_AMPIEZZA_C);
    }
  });
});

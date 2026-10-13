import { describe, it, expect, vi } from 'vitest';
import { creaNegozioDataset } from './dataset';
import type { DipendenzeDataset } from './dataset';
import type { Archivio, CopiaSalvata } from './archivio';

function file(nome: string, n = 3): string {
  const stations = Array.from({ length: n }, (_, i) => ({
    id: i + 1, name: `${nome}-${i}`, brand: '', operator: '', type: '', is_highway: false,
    address: '', city: '', prov: 'RM', lat: 41.9, lng: 12.5, p: {}, updated: '2026-10-13 08:00',
  }));
  return JSON.stringify({ extracted_at: '2026-10-13', fuels: [], national: {}, by_province: {}, history: {}, forecast: {}, stations });
}

function archivio(iniziale: CopiaSalvata | null = null) {
  let copia = iniziale;
  const a: Archivio & { copia: () => CopiaSalvata | null } = {
    leggi: vi.fn(async () => copia),
    scrivi: vi.fn(async (v: CopiaSalvata) => { copia = v; }),
    copia: () => copia,
  };
  return a;
}

const ORA = new Date(2026, 9, 13, 9, 0).getTime();

function dipendenze(over: Partial<DipendenzeDataset> = {}): DipendenzeDataset {
  let t = ORA;
  return {
    archivio: archivio(),
    scarica: vi.fn(async () => file('rete')),
    pacchetto: vi.fn(async () => file('pacchetto')),
    adesso: () => (t += 1000),
    attendi: async () => {},
    minStazioni: 2,
    ...over,
  };
}

const nome = (s: { dati: { stations: { name: string }[] } | null }) => s.dati?.stations[0]?.name;

describe('il negozio dei prezzi', () => {
  it('all’avvio mostra subito la copia salvata e poi la sostituisce con quella scaricata', async () => {
    let rilascia!: () => void;
    const rete = new Promise<void>((r) => { rilascia = r; });
    const dip = dipendenze({
      archivio: archivio({ testo: file('salvata'), scaricatoIl: ORA - 10 * 86_400_000 }),
      scarica: vi.fn(async () => { await rete; return file('rete'); }),
    });
    const n = creaNegozioDataset(dip);
    const visti: string[] = [];
    n.iscriviti(() => { const x = nome(n.stato()); if (x && visti.at(-1) !== x) visti.push(x); });

    await n.avvia();
    expect(nome(n.stato())).toBe('salvata-0');
    expect(n.stato().fase).toBe('aggiorno');

    rilascia();
    await n.aggiorna('manuale'); // aspetta il download gia partito
    expect(nome(n.stato())).toBe('rete-0');
    expect(n.stato().origine).toBe('rete');
    expect(n.stato().fase).toBe('pronto');
    expect(visti).toEqual(['salvata-0', 'rete-0']);
  });

  it('il download riuscito viene salvato per il prossimo avvio', async () => {
    const a = archivio();
    const n = creaNegozioDataset(dipendenze({ archivio: a }));
    await n.avvia();
    expect(a.copia()?.testo).toContain('rete-0');
    expect(a.copia()?.scaricatoIl).toBe(n.stato().scaricatoIl);
  });

  it('senza copia salvata aspetta la rete prima di finire l’avvio', async () => {
    const n = creaNegozioDataset(dipendenze());
    await n.avvia();
    expect(nome(n.stato())).toBe('rete-0');
  });

  it('senza rete e senza copia ripiega sui prezzi inclusi nell’app, dichiarandolo', async () => {
    const n = creaNegozioDataset(dipendenze({ scarica: vi.fn(async () => { throw new Error('offline'); }) }));
    await n.avvia();
    expect(nome(n.stato())).toBe('pacchetto-0');
    expect(n.stato().origine).toBe('pacchetto');
    expect(n.stato().scaricatoIl).toBeNull();
    expect(n.stato().fase).toBe('errore');
  });

  it('un download fallito non cancella i dati gia mostrati', async () => {
    const n = creaNegozioDataset(dipendenze({
      archivio: archivio({ testo: file('salvata'), scaricatoIl: ORA - 3600_000 }),
      scarica: vi.fn(async () => { throw new Error('offline'); }),
    }));
    await n.avvia();
    await n.aggiorna('manuale');
    expect(nome(n.stato())).toBe('salvata-0');
    expect(n.stato().fase).toBe('errore');
  });

  it('riprova una volta all’apertura: la rete del telefono spesso arriva un attimo dopo', async () => {
    let chiamate = 0;
    const scarica = vi.fn(async () => {
      chiamate++;
      if (chiamate === 1) throw new Error('rete non ancora pronta');
      return file('rete');
    });
    const n = creaNegozioDataset(dipendenze({ scarica }));
    await n.avvia();
    expect(scarica).toHaveBeenCalledTimes(2);
    expect(nome(n.stato())).toBe('rete-0');
  });

  it('scarta un file troncato o senza impianti invece di mostrarlo', async () => {
    const n = creaNegozioDataset(dipendenze({
      archivio: archivio({ testo: file('salvata'), scaricatoIl: ORA }),
      scarica: vi.fn(async () => file('troncato', 1)),
    }));
    await n.avvia();
    await n.aggiorna('manuale');
    expect(nome(n.stato())).toBe('salvata-0');
  });

  it('scarta JSON rotto', async () => {
    const n = creaNegozioDataset(dipendenze({ scarica: vi.fn(async () => '{"stations": [') }));
    await n.avvia();
    expect(n.stato().origine).toBe('pacchetto');
  });

  it('una copia salvata rotta non blocca l’avvio', async () => {
    const n = creaNegozioDataset(dipendenze({
      archivio: { leggi: async () => { throw new Error('idb'); }, scrivi: async () => {} },
    }));
    await n.avvia();
    expect(nome(n.stato())).toBe('rete-0');
  });

  it('avvia due volte non scarica due volte', async () => {
    const dip = dipendenze();
    const n = creaNegozioDataset(dip);
    await Promise.all([n.avvia(), n.avvia()]);
    expect(dip.scarica).toHaveBeenCalledTimes(1);
  });

  it('richieste contemporanee condividono lo stesso download', async () => {
    const dip = dipendenze();
    const n = creaNegozioDataset(dip);
    await n.avvia();
    await Promise.all([n.aggiorna('manuale'), n.aggiorna('ripresa'), n.aggiorna('manuale')]);
    expect(dip.scarica).toHaveBeenCalledTimes(2); // avvio + uno solo
  });

  it('alla ripresa riscarica, ma non due volte nello stesso minuto', async () => {
    let t = ORA;
    const dip = dipendenze({ adesso: () => t });
    const n = creaNegozioDataset(dip);
    await n.avvia();
    t += 30_000;
    expect(await n.aggiorna('ripresa')).toBe(false);
    t += 60_000;
    expect(await n.aggiorna('ripresa')).toBe(true);
    expect(dip.scarica).toHaveBeenCalledTimes(2);
  });

  it('la versione cresce a ogni dataset nuovo', async () => {
    const n = creaNegozioDataset(dipendenze({
      archivio: archivio({ testo: file('salvata'), scaricatoIl: ORA }),
    }));
    await n.avvia();
    await n.aggiorna('manuale'); // si aggancia al download dell'avvio
    await n.aggiorna('manuale');
    expect(n.stato().versione).toBe(3); // salvata, rete all'avvio, rete manuale
  });
});

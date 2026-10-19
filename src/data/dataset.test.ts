import { describe, it, expect, vi } from 'vitest';
import { creaNegozioDataset } from './dataset';
import type { DipendenzeDataset } from './dataset';
import type { Archivio, CopiaSalvata } from './archivio';

/** Un file finto: `ora` e l'ora a cui la pipeline l'ha prodotto. */
function file(nome: string, ora = 8, n = 3): string {
  const stations = Array.from({ length: n }, (_, i) => ({
    id: i + 1, name: `${nome}-${i}`, brand: '', operator: '', type: '', is_highway: false,
    address: '', city: '', prov: 'RM', lat: 41.9, lng: 12.5, p: {}, updated: '2026-10-13 08:00',
  }));
  return JSON.stringify({
    extracted_at: '2026-10-13',
    source: { generated_at: `2026-10-13T${String(ora).padStart(2, '0')}:00:00Z` },
    fuels: [], national: {}, by_province: {}, history: {}, forecast: {}, stations,
  });
}

function archivio(iniziale: CopiaSalvata | null = null) {
  let copia = iniziale;
  let verifica: number | null = null;
  const a: Archivio & { copia: () => CopiaSalvata | null; verifica: () => number | null } = {
    leggi: vi.fn(async () => copia),
    scrivi: vi.fn(async (v: CopiaSalvata) => { copia = v; }),
    segnaVerifica: vi.fn(async (t: number) => { verifica = t; }),
    copia: () => copia,
    verifica: () => verifica,
  };
  return a;
}

const ORA = new Date(2026, 9, 13, 9, 0).getTime();

function dipendenze(over: Partial<DipendenzeDataset> = {}): DipendenzeDataset {
  let t = ORA;
  return {
    archivio: archivio(),
    scarica: vi.fn(async () => file('rete', 10)),
    pacchetto: vi.fn(async () => file('pacchetto', 1)),
    adesso: () => (t += 1000),
    attendi: async () => {},
    minStazioni: 2,
    attesaPrimoAvvioMs: 2500,
    ...over,
  };
}

const nome = (s: { dati: { stations: { name: string }[] } | null }) => s.dati?.stations[0]?.name;
const offline = () => vi.fn(async () => { throw new Error('offline'); });

describe('il negozio dei prezzi', () => {
  it('all’avvio mostra subito la copia salvata e poi la sostituisce con quella scaricata', async () => {
    let rilascia!: () => void;
    const rete = new Promise<void>((r) => { rilascia = r; });
    const n = creaNegozioDataset(dipendenze({
      archivio: archivio({ testo: file('salvata', 6), scaricatoIl: ORA - 10 * 86_400_000 }),
      scarica: vi.fn(async () => { await rete; return file('rete', 10); }),
    }));
    const visti: string[] = [];
    n.iscriviti(() => { const x = nome(n.stato()); if (x && visti.at(-1) !== x) visti.push(x); });

    await n.avvia();
    expect(nome(n.stato())).toBe('salvata-0');
    expect(n.stato().fase).toBe('aggiorno');

    rilascia();
    await n.aggiorna('manuale'); // si aggancia al download gia partito
    expect(nome(n.stato())).toBe('rete-0');
    expect(n.stato().origine).toBe('rete');
    expect(n.stato().fase).toBe('pronto');
    expect(visti).toEqual(['salvata-0', 'rete-0']);
  });

  it('il download nuovo viene salvato per il prossimo avvio', async () => {
    const a = archivio();
    const n = creaNegozioDataset(dipendenze({ archivio: a }));
    await n.avvia();
    expect(a.copia()?.testo).toContain('rete-0');
    expect(a.copia()?.scaricatoIl).toBe(n.stato().verificatoIl);
  });

  it('un file identico non ricalcola niente: aggiorna solo l’ora del controllo', async () => {
    const a = archivio({ testo: file('salvata', 8), scaricatoIl: ORA - 3600_000 });
    const n = creaNegozioDataset(dipendenze({ archivio: a, scarica: vi.fn(async () => file('salvata', 8)) }));
    await n.avvia();
    await n.aggiorna('manuale');
    expect(n.stato().versione).toBe(1);
    expect(n.stato().verificatoIl).toBeGreaterThan(ORA - 3600_000);
    expect(a.scrivi).not.toHaveBeenCalled();
    expect(a.verifica()).toBe(n.stato().verificatoIl);
  });

  it('un file piu vecchio di quello a schermo non lo sostituisce (CDN in ritardo)', async () => {
    const n = creaNegozioDataset(dipendenze({
      archivio: archivio({ testo: file('salvata', 10), scaricatoIl: ORA }),
      scarica: vi.fn(async () => file('vecchio', 6)),
    }));
    await n.avvia();
    await n.aggiorna('manuale');
    expect(nome(n.stato())).toBe('salvata-0');
  });

  it('senza copia salvata aspetta la rete prima di finire l’avvio, se arriva presto', async () => {
    // L'attesa di cortesia non scade mai: deve vincere la rete.
    const n = creaNegozioDataset(dipendenze({ attendi: (ms) => (ms >= 2500 ? new Promise(() => {}) : Promise.resolve()) }));
    await n.avvia();
    expect(nome(n.stato())).toBe('rete-0');
    expect(n.stato().origine).toBe('rete');
  });

  it('primo avvio con rete lenta: dopo l’attesa mostra i prezzi inclusi, poi li sostituisce', async () => {
    let rilascia!: () => void;
    const rete = new Promise<void>((r) => { rilascia = r; });
    const n = creaNegozioDataset(dipendenze({ scarica: vi.fn(async () => { await rete; return file('rete', 10); }) }));
    await n.avvia();
    expect(nome(n.stato())).toBe('pacchetto-0');
    expect(n.stato().origine).toBe('pacchetto');
    expect(n.stato().fase).toBe('aggiorno');
    rilascia();
    await n.aggiorna('manuale');
    expect(nome(n.stato())).toBe('rete-0');
  });

  it('i prezzi inclusi vengono sostituiti anche se il file in rete e «piu vecchio» di loro', async () => {
    const n = creaNegozioDataset(dipendenze({
      scarica: vi.fn(async () => file('rete', 0)),
      pacchetto: vi.fn(async () => file('pacchetto', 23)),
      attesaPrimoAvvioMs: 0,
    }));
    await n.avvia();
    await n.aggiorna('manuale');
    expect(n.stato().origine).toBe('rete');
  });

  it('senza rete e senza copia ripiega sui prezzi inclusi nell’app, dichiarandolo', async () => {
    const n = creaNegozioDataset(dipendenze({ scarica: offline() }));
    await n.avvia();
    await n.aggiorna('manuale'); // aspetta che il download in corso fallisca
    expect(nome(n.stato())).toBe('pacchetto-0');
    expect(n.stato().origine).toBe('pacchetto');
    expect(n.stato().verificatoIl).toBeNull();
    expect(n.stato().fase).toBe('errore');
  });

  it('un download fallito non cancella i dati gia mostrati', async () => {
    const n = creaNegozioDataset(dipendenze({
      archivio: archivio({ testo: file('salvata'), scaricatoIl: ORA - 3600_000 }),
      scarica: offline(),
    }));
    await n.avvia();
    await n.aggiorna('manuale');
    expect(nome(n.stato())).toBe('salvata-0');
    expect(n.stato().fase).toBe('errore');
  });

  it('all’apertura riprova fino a tre volte', async () => {
    let chiamate = 0;
    const scarica = vi.fn(async () => {
      chiamate++;
      if (chiamate < 3) throw new Error('rete non ancora pronta');
      return file('rete');
    });
    const n = creaNegozioDataset(dipendenze({ scarica }));
    await n.avvia();
    await n.aggiorna('manuale'); // si aggancia ai tentativi in corso
    expect(scarica).toHaveBeenCalledTimes(3);
    expect(nome(n.stato())).toBe('rete-0');
  });

  it('il controllo periodico non insiste', async () => {
    const scarica = offline();
    let t = ORA;
    const n = creaNegozioDataset(dipendenze({ scarica, adesso: () => t, archivio: archivio({ testo: file('s'), scaricatoIl: ORA - 86_400_000 }) }));
    await n.avvia();
    await n.aggiorna('manuale'); // aspetta l'avvio
    scarica.mockClear();
    t += 60 * 60_000;
    await n.aggiorna('intervallo');
    expect(scarica).toHaveBeenCalledTimes(1);
  });

  it('scarta un file troncato invece di mostrarlo', async () => {
    const n = creaNegozioDataset(dipendenze({
      archivio: archivio({ testo: file('salvata'), scaricatoIl: ORA }),
      scarica: vi.fn(async () => file('troncato', 23, 1)),
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
      archivio: { leggi: async () => { throw new Error('idb'); }, scrivi: async () => {}, segnaVerifica: async () => {} },
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

  it('alla ripresa ricontrolla, ma non due volte nello stesso minuto', async () => {
    let t = ORA;
    const dip = dipendenze({ adesso: () => t });
    const n = creaNegozioDataset(dip);
    await n.avvia();
    t += 30_000;
    expect(await n.aggiorna('ripresa')).toBe(false);
    expect(dip.scarica).toHaveBeenCalledTimes(1);
    t += 60_000;
    await n.aggiorna('ripresa');
    expect(dip.scarica).toHaveBeenCalledTimes(2);
  });

  it('quando torna la rete dopo un fallimento riprova subito', async () => {
    let t = ORA;
    let su = false;
    const scarica = vi.fn(async () => { if (!su) throw new Error('offline'); return file('rete', 11); });
    const n = creaNegozioDataset(dipendenze({ adesso: () => t, scarica, archivio: archivio({ testo: file('s', 8), scaricatoIl: ORA - 86_400_000 }) }));
    await n.avvia();
    await n.aggiorna('manuale');
    expect(n.stato().fase).toBe('errore');
    t += 5_000;
    su = true;
    await n.aggiorna('rete');
    expect(nome(n.stato())).toBe('rete-0');
  });
});

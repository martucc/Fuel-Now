import { describe, it, expect } from 'vitest';
import {
  serveAggiornare, descriviStatoDati, quando, confronta, generatoIl, attesePerTentativo,
  PAUSA_MINIMA_RIPRESA_MS, INTERVALLO_CONTROLLO_MS, DATI_VECCHI_MS,
} from './aggiornamento';
import type { RawDataset } from './raw';
import type { StatoAggiornamento } from './aggiornamento';

const ADESSO = new Date(2026, 9, 13, 9, 30).getTime();

function stato(over: Partial<StatoAggiornamento> = {}): StatoAggiornamento {
  return { ultimoSuccesso: null, ultimoTentativo: null, ultimoEsito: null, inCorso: false, ...over };
}

describe('serveAggiornare', () => {
  it("all'avvio aggiorna sempre, anche se l'ultimo download e di un minuto fa", () => {
    expect(serveAggiornare('avvio', stato({ ultimoSuccesso: ADESSO - 60_000 }), ADESSO)).toBe(true);
  });

  it('alla ripresa aggiorna: e il caso «riapro l’app dal launcher»', () => {
    const s = stato({ ultimoSuccesso: ADESSO - 10 * 24 * 3600_000, ultimoTentativo: ADESSO - 3600_000 });
    expect(serveAggiornare('ripresa', s, ADESSO)).toBe(true);
  });

  it('due riprese ravvicinate non riscaricano', () => {
    const s = stato({ ultimoTentativo: ADESSO - PAUSA_MINIMA_RIPRESA_MS + 1000 });
    expect(serveAggiornare('ripresa', s, ADESSO)).toBe(false);
  });

  it('alla ripresa senza tentativi precedenti aggiorna', () => {
    expect(serveAggiornare('ripresa', stato(), ADESSO)).toBe(true);
  });

  it("l'intervallo aspetta mezz'ora dall'ultimo successo", () => {
    expect(serveAggiornare('intervallo', stato({ ultimoSuccesso: ADESSO - 60_000 }), ADESSO)).toBe(false);
    expect(serveAggiornare('intervallo', stato({ ultimoSuccesso: ADESSO - INTERVALLO_CONTROLLO_MS }), ADESSO)).toBe(true);
  });

  it('mai due download insieme', () => {
    for (const m of ['avvio', 'ripresa', 'intervallo', 'manuale'] as const) {
      expect(serveAggiornare(m, stato({ inCorso: true }), ADESSO)).toBe(false);
    }
  });

  it('il manuale aggiorna sempre', () => {
    expect(serveAggiornare('manuale', stato({ ultimoTentativo: ADESSO - 1000 }), ADESSO)).toBe(true);
  });
});

describe('quando', () => {
  it('oggi dice l’ora', () => {
    expect(quando(new Date(2026, 9, 13, 8, 5).getTime(), ADESSO)).toBe('alle 08:05');
  });
  it('ieri lo dice', () => {
    expect(quando(new Date(2026, 9, 12, 18, 3).getTime(), ADESSO)).toBe('ieri alle 18:03');
  });
  it('prima di ieri dice la data', () => {
    expect(quando(new Date(2026, 9, 3, 18, 3).getTime(), ADESSO)).toBe('il 3 ottobre');
  });
});

describe('descriviStatoDati', () => {
  it('durante il download lo dice', () => {
    expect(descriviStatoDati('aggiorno', ADESSO - 3600_000, ADESSO).testo).toBe('Aggiorno i prezzi…');
  });

  it('dopo un download di oggi non avvisa', () => {
    const d = descriviStatoDati('pronto', ADESSO - 20 * 60_000, ADESSO);
    expect(d.testo).toBe('Aggiornato alle 09:10');
    expect(d.avviso).toBe(false);
  });

  it('senza rete dice da quando sono i prezzi e avvisa', () => {
    const d = descriviStatoDati('errore', new Date(2026, 9, 3, 8, 0).getTime(), ADESSO);
    expect(d.testo).toBe('Senza rete: prezzi controllati il 3 ottobre');
    expect(d.avviso).toBe(true);
  });

  it('con i soli prezzi inclusi nell’app avvisa sempre', () => {
    expect(descriviStatoDati('pronto', null, ADESSO).avviso).toBe(true);
    expect(descriviStatoDati('errore', null, ADESSO).testo).toContain('Senza rete');
  });

  it('un download riuscito ma vecchio avvisa', () => {
    expect(descriviStatoDati('pronto', ADESSO - DATI_VECCHI_MS - 1, ADESSO).avviso).toBe(true);
  });
});

describe('serveAggiornare — la rete che torna', () => {
  it('dopo un fallimento riprova subito, senza aspettare il minuto', () => {
    const s = stato({ ultimoTentativo: ADESSO - 5_000, ultimoEsito: 'errore' });
    expect(serveAggiornare('rete', s, ADESSO)).toBe(true);
  });
  it('dopo un successo recente non riscarica', () => {
    const s = stato({ ultimoTentativo: ADESSO - 5_000, ultimoEsito: 'ok' });
    expect(serveAggiornare('rete', s, ADESSO)).toBe(false);
  });
});

describe('attesePerTentativo', () => {
  it('all’apertura tre tentativi, il controllo periodico uno', () => {
    expect(attesePerTentativo('avvio')).toHaveLength(3);
    expect(attesePerTentativo('ripresa')[0]).toBe(0);
    expect(attesePerTentativo('intervallo')).toEqual([0]);
  });
});

function ds(generated: string | undefined, extracted = '2026-10-13', n = 3): RawDataset {
  return {
    extracted_at: extracted,
    source: generated ? { generated_at: generated } : undefined,
    stations: Array.from({ length: n }, () => ({})),
  } as unknown as RawDataset;
}

describe('confronta', () => {
  it('senza dati a schermo e sempre nuovo', () => {
    expect(confronta(ds('2026-10-13T06:00:00Z'), null)).toBe('nuovo');
  });
  it('decide sull’ora in cui la pipeline ha prodotto il file', () => {
    const a = ds('2026-10-13T06:00:00Z');
    expect(confronta(ds('2026-10-13T08:00:00Z'), a)).toBe('nuovo');
    expect(confronta(ds('2026-10-13T06:00:00Z'), a)).toBe('uguale');
    expect(confronta(ds('2026-10-12T18:00:00Z'), a)).toBe('piu-vecchio');
  });
  it('senza generated_at ripiega sulla data di estrazione', () => {
    expect(generatoIl(ds(undefined, '2026-10-12'))).toBe(Date.parse('2026-10-12'));
    expect(confronta(ds(undefined, '2026-10-13'), ds(undefined, '2026-10-12'))).toBe('nuovo');
  });
});

describe('descriviStatoDati — prezzi inclusi', () => {
  it('dice di che giorno sono', () => {
    const d = descriviStatoDati('pronto', null, ADESSO, new Date(2026, 7, 30, 8, 0).getTime());
    expect(d.testo).toBe('Prezzi inclusi nell’app (del 30 agosto)');
  });
});

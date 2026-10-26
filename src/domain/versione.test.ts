import { describe, it, expect } from 'vitest';
import {
  confrontaVersioni, daProporre, leggiRilascio, numeriVersione, serveControllare, PAUSA_CONTROLLO_VERSIONE_MS,
} from './versione';

/** Una risposta di releases/latest ridotta all'osso. */
function rilascio(over: Record<string, unknown> = {}) {
  return {
    tag_name: 'v2.3.0',
    html_url: 'https://github.com/martucc/Fuel-Now/releases/tag/v2.3.0',
    draft: false,
    prerelease: false,
    body: 'Mappa più pulita.',
    assets: [
      { name: 'output-metadata.json', browser_download_url: 'https://example.invalid/meta.json' },
      { name: 'MartuccFuel-2.3.0.apk', browser_download_url: 'https://github.com/martucc/Fuel-Now/releases/download/v2.3.0/MartuccFuel-2.3.0.apk' },
    ],
    ...over,
  };
}

describe('numeriVersione e confrontaVersioni', () => {
  it('legge tag e versioni con o senza v e parti mancanti', () => {
    expect(numeriVersione('v2.2.0')).toEqual([2, 2, 0]);
    expect(numeriVersione('2.2')).toEqual([2, 2, 0]);
    expect(numeriVersione('2.10.1-beta')).toEqual([2, 10, 1]);
    expect(numeriVersione('ultima')).toBeNull();
  });

  it('confronta numero per numero, non come testo', () => {
    expect(confrontaVersioni('2.10.0', '2.9.9')).toBeGreaterThan(0);
    expect(confrontaVersioni('2.1.2', '2.2')).toBeLessThan(0);
    expect(confrontaVersioni('v2.2.0', '2.2')).toBe(0);
    expect(confrontaVersioni('x', '2.2')).toBeNull();
  });
});

describe('leggiRilascio', () => {
  it('prende versione, APK, pagina e note', () => {
    expect(leggiRilascio(rilascio())).toEqual({
      versione: '2.3.0',
      apk: 'https://github.com/martucc/Fuel-Now/releases/download/v2.3.0/MartuccFuel-2.3.0.apk',
      pagina: 'https://github.com/martucc/Fuel-Now/releases/tag/v2.3.0',
      note: 'Mappa più pulita.',
    });
  });

  it('niente APK, bozza o pre-release: niente da proporre', () => {
    expect(leggiRilascio(rilascio({ assets: [] }))).toBeNull();
    expect(leggiRilascio(rilascio({ draft: true }))).toBeNull();
    expect(leggiRilascio(rilascio({ prerelease: true }))).toBeNull();
    expect(leggiRilascio(rilascio({ tag_name: 'prezzi-di-oggi' }))).toBeNull();
    expect(leggiRilascio({ message: 'Not Found' })).toBeNull();
    expect(leggiRilascio(null)).toBeNull();
  });

  it('accorcia le note lunghe', () => {
    const r = leggiRilascio(rilascio({ body: 'a'.repeat(1000) }));
    expect(r?.note.length).toBeLessThanOrEqual(280);
    expect(r?.note.endsWith('…')).toBe(true);
  });
});

describe('daProporre', () => {
  const r = leggiRilascio(rilascio());

  it('propone solo una versione più nuova', () => {
    expect(daProporre('2.2.0', r, null)).toBe(r);
    expect(daProporre('2.3.0', r, null)).toBeNull();
    expect(daProporre('2.4.0', r, null)).toBeNull();
  });

  it('non ripropone quella che l’utente ha scartato, ma la successiva sì', () => {
    expect(daProporre('2.2.0', r, '2.3.0')).toBeNull();
    expect(daProporre('2.2.0', r, '2.2.5')).toBe(r);
  });

  it('con una versione installata illeggibile non propone niente', () => {
    expect(daProporre('sconosciuta', r, null)).toBeNull();
  });
});

describe('serveControllare', () => {
  const ADESSO = new Date(2026, 9, 26, 9, 0).getTime();
  it('al primo avvio sì, poi non prima della pausa', () => {
    expect(serveControllare(null, ADESSO)).toBe(true);
    expect(serveControllare(ADESSO - 60_000, ADESSO)).toBe(false);
    expect(serveControllare(ADESSO - PAUSA_CONTROLLO_VERSIONE_MS, ADESSO)).toBe(true);
  });

  it('con l’orologio tornato indietro ricontrolla', () => {
    expect(serveControllare(ADESSO + 86_400_000, ADESSO)).toBe(true);
  });
});

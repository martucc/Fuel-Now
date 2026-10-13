import { describe, it, expect } from 'vitest';
import { parseUpdatedAt, ageHours, confidenceFor, describeAge , descriviDati } from './freshness';

const NOW = new Date(2026, 5, 8, 12, 0); // 8 giugno 2026, 12:00 locali

describe('parseUpdatedAt', () => {
  it('legge il formato della pipeline', () => {
    const d = parseUpdatedAt('2026-06-08 10:04')!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(8);
    expect(d.getHours()).toBe(10);
    expect(d.getMinutes()).toBe(4);
  });

  it('restituisce null su input assente o malformato', () => {
    expect(parseUpdatedAt(null)).toBeNull();
    expect(parseUpdatedAt('')).toBeNull();
    expect(parseUpdatedAt('ieri')).toBeNull();
    expect(parseUpdatedAt('2026-13-45 99:99')).toBeNull();
  });
});

describe('ageHours', () => {
  it('conta le ore trascorse', () => {
    expect(ageHours('2026-06-08 10:00', NOW)).toBe(2);
    expect(ageHours('2026-06-07 12:00', NOW)).toBe(24);
  });

  it('azzera le età negative da orologio sfasato', () => {
    expect(ageHours('2026-06-09 12:00', NOW)).toBe(0);
  });

  it('restituisce null se il timestamp manca', () => {
    expect(ageHours(null, NOW)).toBeNull();
  });
});

describe('confidenceFor', () => {
  it('applica la tabella della spec ai bordi', () => {
    expect(confidenceFor(0)).toBe(1.0);
    expect(confidenceFor(24)).toBe(1.0);
    expect(confidenceFor(24.1)).toBe(0.9);
    expect(confidenceFor(48)).toBe(0.9);
    expect(confidenceFor(48.1)).toBe(0.75);
    expect(confidenceFor(72)).toBe(0.75);
    expect(confidenceFor(72.1)).toBe(0.5);
    expect(confidenceFor(120)).toBe(0.5);
    expect(confidenceFor(120.1)).toBe(0.3);
    expect(confidenceFor(10000)).toBe(0.3);
  });

  it('tratta il dato senza data come il più vecchio possibile', () => {
    expect(confidenceFor(null)).toBe(0.3);
  });
});

describe('describeAge', () => {
  it('parla italiano', () => {
    expect(describeAge(0)).toBe('adesso');
    expect(describeAge(2)).toBe('2h fa');
    expect(describeAge(30)).toBe('1 giorno fa');
    expect(describeAge(120)).toBe('5 giorni fa');
    expect(describeAge(null)).toBe('data ignota');
  });
});

describe('descriviDati', () => {
  const ora = new Date('2026-08-20T12:00:00');

  it('senza dati lo dice invece di tacere', () => {
    const f = descriviDati(null, ora);
    expect(f.etichetta).toContain('non ancora scaricati');
    expect(f.stantio).toBe(true);
  });

  it('preferisce l ora esatta dell ultimo prezzo alla data di estrazione', () => {
    // extracted_at direbbe «oggi» anche se il lotto e delle sei del mattino.
    const f = descriviDati(
      { extracted_at: '2026-08-20', source: { latest_price_at: '2026-08-20 10:45' } },
      ora
    );
    expect(f.etichetta).toBe('Prezzi di 1 ora fa');
    expect(f.stantio).toBe(false);
  });

  it('ripiega sulla data di estrazione quando la sorgente non dice l ora', () => {
    const f = descriviDati({ extracted_at: '2026-08-19' }, ora);
    expect(f.giorni).toBe(1);
    expect(f.etichetta).toBe('Prezzi di ieri');
  });

  it('marca stantii i prezzi di piu di tre giorni', () => {
    const f = descriviDati({ extracted_at: '2026-06-08' }, ora);
    expect(f.giorni).toBe(73);
    expect(f.stantio).toBe(true);
    expect(f.etichetta).toBe('Prezzi di 73 giorni fa');
  });

  it('non si fa spaventare da una data illeggibile', () => {
    const f = descriviDati({ extracted_at: 'boh' }, ora);
    expect(f.giorni).toBeNull();
    expect(f.stantio).toBe(true);
  });

  it('regge un lotto col timbro appena avanti all orologio del telefono', () => {
    const f = descriviDati({ extracted_at: '2026-08-20', source: { latest_price_at: '2026-08-20 12:30' } }, ora);
    expect(f.stantio).toBe(false);
    expect(f.giorni).toBe(0);
  });
});

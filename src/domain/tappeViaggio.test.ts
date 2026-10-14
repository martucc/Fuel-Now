import { describe, it, expect } from 'vitest';
import {
  calcolaViaggio,
  FRAZIONE_SERBATOIO,
  KM_PARTENZA,
  SCOSTAMENTO_STRATEGIA,
  serbatoioDi,
  tappeCandidate,
  testoImpossibile,
  testoSottoRiserva,
  type DatiViaggio,
} from './tappeViaggio';
import type { ImpiantoSulPercorso } from './lungoPercorso';
import { buildCohorts } from './market';
import type { StationRow } from './parse';
import { DEFAULT_TANK_L } from './units';
import type { Piano } from './viaggio';
import { numero } from '../lib/formato';

const ADESSO = new Date(2026, 9, 13, 12, 0);

function quando(oreFa: number): string {
  const d = new Date(ADESSO.getTime() - oreFa * 3_600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function riga(id: string, prezzo: number, over: Partial<StationRow> = {}): StationRow {
  return {
    id,
    name: `Impianto ${id}`,
    brand: 'Marchio',
    operator: '',
    prov: 'BO',
    city: 'Bologna',
    address: 'Via Emilia 1',
    isHighway: false,
    lat: 44.5,
    lng: 11.3,
    prices: { diesel: prezzo },
    servito: {},
    updated: quando(2),
    ...over,
  };
}

/**
 * La coorte di provincia: venti impianti fra 1,70 e 1,80. Media 1,75 e
 * scarto 0,05, cosi lo z di un prezzo si fa a mente.
 */
const COORTI = buildCohorts(Array.from({ length: 20 }, (_, i) => riga(`c${i}`, i % 2 ? 1.8 : 1.7)));

function sulPercorso(id: string, prezzo: number, kmDaPartenza: number, scostamentoKm = 0.1, over: Partial<StationRow> = {}, aSinistra = false): ImpiantoSulPercorso {
  return { row: riga(id, prezzo, over), prezzo, kmDaPartenza, scostamentoKm, aSinistra };
}

function dati(over: Partial<DatiViaggio> = {}): DatiViaggio {
  return {
    impianti: [],
    cohorts: COORTI,
    fuel: 'diesel',
    adesso: ADESSO,
    strategia: 'bilanciato',
    distanzaKm: 400,
    kml: 15,
    serbatoioL: 45,
    livello: 'meta',
    ...over,
  };
}

describe('serbatoioDi', () => {
  it('usa il serbatoio dell auto, o quello medio se l auto manca o il dato e assurdo', () => {
    expect(serbatoioDi(null)).toBe(DEFAULT_TANK_L);
    expect(serbatoioDi({ model: 'x', liters: 52, kml: 15 })).toBe(52);
    expect(serbatoioDi({ model: 'x', liters: 0, kml: 15 })).toBe(DEFAULT_TANK_L);
    expect(serbatoioDi({ model: 'x', liters: 900, kml: 15 })).toBe(DEFAULT_TANK_L);
  });
});

describe('tappeCandidate', () => {
  const o = { fuel: 'diesel' as const, cohorts: COORTI, adesso: ADESSO };

  it('la strategia decide quanto ci si allontana dalla strada', () => {
    const impianti = [
      sulPercorso('sulla-strada', 1.75, 10, 0.3),
      sulPercorso('a-800-m', 1.75, 20, 0.8),
      sulPercorso('a-2-km', 1.75, 30, 2),
    ];
    const ids = (s: 'veloce' | 'bilanciato' | 'risparmio') => tappeCandidate(impianti, { ...o, strategia: s }).map((t) => t.id);
    expect(ids('veloce')).toEqual(['sulla-strada']);
    expect(ids('bilanciato')).toEqual(['sulla-strada', 'a-800-m']);
    expect(ids('risparmio')).toEqual(['sulla-strada', 'a-800-m', 'a-2-km']);
    expect(SCOSTAMENTO_STRATEGIA.veloce).toBeLessThan(SCOSTAMENTO_STRATEGIA.bilanciato);
    expect(SCOSTAMENTO_STRATEGIA.bilanciato).toBeLessThan(SCOSTAMENTO_STRATEGIA.risparmio);
  });

  it('passa al piano la deviazione di sola andata e i km dalla partenza', () => {
    const [t] = tappeCandidate([sulPercorso('a', 1.75, 123, 0.7)], { ...o, strategia: 'bilanciato' });
    expect(t!.deviazioneKm).toBeCloseTo(0.7, 6);
    expect(t!.kmDaPartenza).toBe(123);
    expect(t!.prezzo).toBe(1.75);
    expect(t!.nome).toBe('Impianto a');
  });

  it('colora col livello della coorte dell impianto', () => {
    const tappe = tappeCandidate(
      [sulPercorso('economico', 1.65, 10), sulPercorso('medio', 1.75, 20), sulPercorso('caro', 1.83, 30)],
      { ...o, strategia: 'bilanciato' },
    );
    expect(tappe.map((t) => t.level)).toEqual(['best', 'normal', 'worst']);
  });

  it('scarta i prezzi fuori scala e quelli bassissimi ma vecchi', () => {
    const tappe = tappeCandidate(
      [
        sulPercorso('assurdo', 2.1, 10),
        sulPercorso('fantasma', 1.6, 20, 0.1, { updated: quando(72) }),
        sulPercorso('basso-di-oggi', 1.6, 30),
      ],
      { ...o, strategia: 'bilanciato' },
    );
    expect(tappe.map((t) => t.id)).toEqual(['basso-di-oggi']);
  });

  it('in autostrada scarta le aree di servizio sull altra carreggiata', () => {
    // Come Sillaro Ovest e Sillaro Est sull A14: andando verso Bologna la
    // prima sta a 43 m, ma a sinistra, sulla carreggiata per Ancona.
    const tappe = tappeCandidate(
      [
        sulPercorso('ovest-opposta', 1.74, 33, 0.04, { isHighway: true }, true),
        sulPercorso('est-giusta', 1.76, 33.1, 0.05, { isHighway: true }, false),
        // In citta a sinistra si gira: resta.
        sulPercorso('citta-a-sinistra', 1.75, 40, 0.05, {}, true),
      ],
      { ...o, strategia: 'bilanciato' },
    );
    expect(tappe.map((t) => t.id)).toEqual(['est-giusta', 'citta-a-sinistra']);
  });
});

describe('calcolaViaggio', () => {
  it('col pieno e un viaggio corto non si ferma nessuno', () => {
    const e = calcolaViaggio(
      dati({ livello: 'pieno', distanzaKm: 300, impianti: [sulPercorso('casa', 1.7, 2), sulPercorso('via', 1.8, 150)] }),
    );
    expect(e.piano.fattibile).toBe(true);
    expect(e.piano.soste).toEqual([]);
    expect(e.litriAdesso).toBe(45);
    expect(e.prezzoPartenza).toBe(1.7);
    expect(e.litriConsumati).toBeCloseTo(20, 6);
    expect(e.costoStimato).toBeCloseTo(20 * 1.7, 6);
  });

  it('il livello del serbatoio diventa litri', () => {
    for (const [livello, f] of Object.entries(FRAZIONE_SERBATOIO)) {
      expect(calcolaViaggio(dati({ livello: livello as DatiViaggio['livello'] })).litriAdesso).toBeCloseTo(45 * f, 6);
    }
    expect(FRAZIONE_SERBATOIO.riserva).toBeLessThan(FRAZIONE_SERBATOIO.quarto);
  });

  it('il prezzo di partenza e il piu basso nei primi km, e solo li', () => {
    const e = calcolaViaggio(
      dati({
        impianti: [
          sulPercorso('a', 1.78, 1),
          sulPercorso('b', 1.74, KM_PARTENZA - 1),
          sulPercorso('lontano', 1.66, KM_PARTENZA + 5),
        ],
      }),
    );
    expect(e.prezzoPartenza).toBe(1.74);
  });

  it('senza distributori vicino alla partenza non si ferma al primo che capita', () => {
    // Mezzo serbatoio: 22,5 L, riserva 5,4 L, quindi 256 km di autonomia.
    const e = calcolaViaggio(
      dati({
        distanzaKm: 450,
        impianti: [sulPercorso('primo-caro', 1.83, 50), sulPercorso('economico', 1.66, 120), sulPercorso('medio', 1.77, 200)],
      }),
    );
    expect(e.prezzoPartenza).toBeNull();
    expect(e.piano.fattibile).toBe(true);
    expect(e.piano.soste[0]!.tappa.id).toBe('economico');
    // Senza una pompa alla partenza il confronto col pieno prima non si fa.
    expect(e.piano.spesaPienoPrima).toBeNull();
    expect(e.piano.risparmioEur).toBeNull();
  });

  it('con un distributore alla partenza fa il confronto col pieno prima di partire', () => {
    const e = calcolaViaggio(
      dati({
        distanzaKm: 450,
        livello: 'quarto',
        impianti: [sulPercorso('casa', 1.82, 3), sulPercorso('economico', 1.66, 60)],
      }),
    );
    expect(e.prezzoPartenza).toBe(1.82);
    expect(e.piano.soste.map((s) => s.tappa.id)).toContain('economico');
    expect(e.piano.risparmioEur).not.toBeNull();
    expect(e.piano.risparmioEur!).toBeGreaterThan(0);
  });

  it('la strategia cambia le tappe possibili', () => {
    const impianti = [sulPercorso('casa', 1.8, 3, 0.1), sulPercorso('fuori-strada', 1.66, 100, 2), sulPercorso('sulla-strada', 1.79, 110, 0.1)];
    const risparmio = calcolaViaggio(dati({ distanzaKm: 450, impianti, strategia: 'risparmio' }));
    const veloce = calcolaViaggio(dati({ distanzaKm: 450, impianti, strategia: 'veloce' }));
    expect(risparmio.piano.soste.map((s) => s.tappa.id)).toContain('fuori-strada');
    expect(veloce.piano.soste.map((s) => s.tappa.id)).not.toContain('fuori-strada');
    expect(veloce.candidate.map((t) => t.id)).toEqual(['casa', 'sulla-strada']);
  });

  it('il carburante del viaggio comprende le deviazioni', () => {
    const e = calcolaViaggio(
      dati({ distanzaKm: 450, strategia: 'risparmio', impianti: [sulPercorso('casa', 1.8, 3), sulPercorso('fuori', 1.66, 100, 2)] }),
    );
    expect(e.piano.litriDeviazione).toBeGreaterThan(0);
    expect(e.litriConsumati).toBeCloseTo(450 / 15 + e.piano.litriDeviazione, 6);
    expect(e.costoStimato).not.toBeNull();
  });

  it('senza nessun prezzo non inventa un costo', () => {
    const e = calcolaViaggio(dati({ livello: 'pieno', distanzaKm: 100 }));
    expect(e.piano.fattibile).toBe(true);
    expect(e.costoStimato).toBeNull();
  });

  it('in riserva ti manda al distributore vicino e ti fa arrivare con la riserva', () => {
    // 4,5 L su 45: la spia e accesa. Il viaggio da 50 km si farebbe anche
    // cosi, ma arrivando quasi a secco: il piano fa fermare, e a quello
    // vicino. Andare all'altro vorrebbe dire 22 km in piu in riserva, fino
    // a 2,5 L, per risparmiare sessanta centesimi.
    const e = calcolaViaggio(
      dati({
        livello: 'riserva',
        distanzaKm: 50,
        impianti: [sulPercorso('vicino', 1.82, 8), sulPercorso('lontano', 1.68, 30)],
      }),
    );
    expect(e.piano.fattibile).toBe(true);
    expect(e.piano.arrivoSottoRiserva).toBe(false);
    expect(e.piano.primaSostaInRiserva).toBe(true);
    expect(e.piano.soste.map((s) => s.tappa.id)).toEqual(['vicino']);
    expect(e.piano.litriAllArrivo).toBeCloseTo(45 * 0.12, 6);
  });

  it('dice quando con il carburante che hai non arrivi al primo distributore', () => {
    const e = calcolaViaggio(dati({ livello: 'riserva', distanzaKm: 600, impianti: [sulPercorso('lontano', 1.7, 300)] }));
    expect(e.piano.fattibile).toBe(false);
    expect(e.piano.motivo).toBe('buco-troppo-lungo');
  });
});

describe('testoImpossibile', () => {
  const piano = (soste: number, bloccoAlKm?: number): Piano => ({
    fattibile: false,
    motivo: 'buco-troppo-lungo',
    bloccoAlKm,
    soste: Array.from({ length: soste }, () => ({
      tappa: { id: 'x', nome: '', brand: '', prezzo: 1.7, level: 'normal', kmDaPartenza: 10, deviazioneKm: 0 },
      litri: 10,
      spesa: 17,
      litriDopo: 40,
      kmRimanenti: 500,
      pieno: false,
    })),
    litriComprati: 0,
    spesaCarburante: 0,
    kmDeviazione: 0,
    litriDeviazione: 0,
    litriAllArrivo: 0,
    arrivoSottoRiserva: false,
    primaSostaInRiserva: false,
    spesaPienoPrima: null,
    risparmioEur: null,
  });

  it('senza soste dice dove si resta a secco', () => {
    const t = testoImpossibile(piano(0, 1234.4), 'risparmio');
    expect(t).toContain('resti a secco');
    expect(t).toContain(`km ${numero(1234)}`);
    expect(t).not.toContain('Prova con Risparmio');
  });

  it('quando si arriva in riserva lo dice, coi litri all arrivo', () => {
    const p = { ...piano(0), fattibile: true, motivo: undefined, arrivoSottoRiserva: true, litriAllArrivo: 2.34 };
    const t = testoSottoRiserva(p, 'bilanciato');
    expect(t).toContain('arrivi con circa 2,3 L');
    expect(t).toContain('spia della riserva');
    expect(t).toContain('Con Risparmio');
    expect(testoSottoRiserva(p, 'risparmio')).not.toContain('Con Risparmio');
    // Non dice che un distributore non c'e: magari c'e, e non conveniva.
    expect(t).not.toMatch(/non c.è un distributore/);
    expect(testoSottoRiserva({ ...p, soste: piano(2).soste }, 'risparmio')).toMatch(/^Con le 2 soste qui sotto arrivi/);
  });

  it('con una strategia stretta suggerisce di allargare', () => {
    expect(testoImpossibile(piano(0, 80), 'veloce')).toContain('Prova con Risparmio');
    expect(testoImpossibile(piano(2, 800), 'bilanciato')).toContain('resti a secco intorno al km 800');
  });
});

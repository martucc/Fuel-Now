import { describe, it, expect } from 'vitest';
import { pianificaViaggio, RISERVA, type PianoInput, type TappaCandidata } from './viaggio';

function tappa(over: Partial<TappaCandidata> & { id: string; kmDaPartenza: number; prezzo: number }): TappaCandidata {
  return {
    nome: 'Impianto',
    brand: 'Marchio',
    level: 'normal',
    deviazioneKm: 0,
    ...over,
  };
}

function input(over: Partial<PianoInput> = {}): PianoInput {
  return {
    distanzaKm: 600,
    kml: 15,
    serbatoioL: 50,
    litriAdesso: 50,
    candidate: [],
    ...over,
  };
}

describe('pianificaViaggio: quando non si puo', () => {
  it('senza distanza non pianifica', () => {
    const p = pianificaViaggio(input({ distanzaKm: 0 }));
    expect(p.fattibile).toBe(false);
    expect(p.motivo).toBe('senza-percorso');
  });

  it('senza consumo o serbatoio non pianifica', () => {
    expect(pianificaViaggio(input({ kml: 0 })).motivo).toBe('senza-consumo');
    expect(pianificaViaggio(input({ serbatoioL: 0 })).motivo).toBe('senza-consumo');
  });

  it('dice dove si arena quando fra due distributori c e troppa strada', () => {
    // Serbatoio da 50 a 15 km/l: 750 km lordi, ma la riserva ne toglie.
    const p = pianificaViaggio(
      input({ distanzaKm: 2000, candidate: [tappa({ id: 'a', kmDaPartenza: 100, prezzo: 1.8 })] })
    );
    expect(p.fattibile).toBe(false);
    expect(p.motivo).toBe('buco-troppo-lungo');
    expect(p.bloccoAlKm).toBeGreaterThan(100);
  });
});

describe('pianificaViaggio: quando basta quello che hai', () => {
  it('non ferma nessuno se il serbatoio arriva in fondo', () => {
    const p = pianificaViaggio(input({ distanzaKm: 400 }));
    expect(p.fattibile).toBe(true);
    expect(p.soste).toEqual([]);
    expect(p.spesaCarburante).toBe(0);
    // 400 km a 15 km/l sono 26,7 litri: ne restano 23,3.
    expect(p.litriAllArrivo).toBeCloseTo(50 - 400 / 15, 2);
  });

  it('tiene conto della riserva: non pianifica di arrivare col serbatoio a zero', () => {
    // 700 km ne consumano 46,7 su 50, ma sotto la riserva non ci si va.
    const p = pianificaViaggio(
      input({ distanzaKm: 700, candidate: [tappa({ id: 'a', kmDaPartenza: 300, prezzo: 1.8 })] })
    );
    expect(p.soste).toHaveLength(1);
    expect(p.litriAllArrivo).toBeGreaterThan(50 * RISERVA - 1);
  });
});

describe('pianificaViaggio: la regola del rifornimento', () => {
  it('mette il minimo quando poco piu avanti costa meno', () => {
    // Parte con poco, la prima tappa e cara ma c e una piu economica dopo:
    // qui si mette solo quanto basta ad arrivarci.
    const p = pianificaViaggio(
      input({
        distanzaKm: 500,
        litriAdesso: 15,
        prezzoPartenza: 2.0,
        candidate: [
          tappa({ id: 'cara', kmDaPartenza: 100, prezzo: 1.95 }),
          tappa({ id: 'economica', kmDaPartenza: 200, prezzo: 1.6 }),
        ],
      })
    );
    expect(p.fattibile).toBe(true);
    const prima = p.soste[0]!;
    expect(prima.tappa.id).toBe('cara');
    expect(prima.pieno).toBe(false);
    // Ne mette abbastanza per i 100 km fino alla piu economica, non di piu.
    expect(prima.litriDopo).toBeLessThan(20);
  });

  it('fa il pieno dove costa meno quando dopo non c e niente di meglio', () => {
    const p = pianificaViaggio(
      input({
        distanzaKm: 1200,
        litriAdesso: 25,
        prezzoPartenza: 1.6,
        candidate: [
          tappa({ id: 'a', kmDaPartenza: 200, prezzo: 1.9 }),
          tappa({ id: 'b', kmDaPartenza: 250, prezzo: 1.7 }),
          tappa({ id: 'c', kmDaPartenza: 700, prezzo: 2.1 }),
        ],
      })
    );
    expect(p.fattibile).toBe(true);
    // Fra le raggiungibili sceglie la piu economica e fa il pieno.
    expect(p.soste[0]!.tappa.id).toBe('b');
    expect(p.soste[0]!.pieno).toBe(true);
  });

  it('preferisce la piu economica anche se piu lontana, se ci arriva', () => {
    const p = pianificaViaggio(
      input({
        distanzaKm: 900,
        litriAdesso: 45,
        prezzoPartenza: 2.0,
        candidate: [
          tappa({ id: 'vicina-cara', kmDaPartenza: 100, prezzo: 2.1 }),
          tappa({ id: 'lontana-economica', kmDaPartenza: 400, prezzo: 1.7 }),
        ],
      })
    );
    expect(p.soste[0]!.tappa.id).toBe('lontana-economica');
  });
});

describe('pianificaViaggio: le deviazioni si pagano', () => {
  it('conta due volte i chilometri di deviazione', () => {
    const p = pianificaViaggio(
      input({
        distanzaKm: 900,
        litriAdesso: 40,
        candidate: [tappa({ id: 'a', kmDaPartenza: 400, prezzo: 1.8, deviazioneKm: 6 })],
      })
    );
    expect(p.kmDeviazione).toBeCloseTo(12, 3);
    expect(p.litriDeviazione).toBeCloseTo(12 / 15, 3);
  });

  it('non considera raggiungibile un impianto che la deviazione mette fuori portata', () => {
    // Autonomia utile appena sufficiente per il km, ma non per il giro.
    const utile = (50 - 50 * RISERVA) * 15;
    const p = pianificaViaggio(
      input({
        distanzaKm: 3000,
        candidate: [tappa({ id: 'oltre', kmDaPartenza: utile - 2, prezzo: 1.8, deviazioneKm: 50 })],
      })
    );
    expect(p.fattibile).toBe(false);
    expect(p.motivo).toBe('buco-troppo-lungo');
  });
});

describe('pianificaViaggio: il confronto col pieno prima di partire', () => {
  it('dice quanto si risparmia fermandosi dove costa meno', () => {
    const p = pianificaViaggio(
      input({
        distanzaKm: 500,
        litriAdesso: 12,
        prezzoPartenza: 2.1,
        candidate: [tappa({ id: 'economica', kmDaPartenza: 60, prezzo: 1.7 })],
      })
    );
    expect(p.spesaPienoPrima).not.toBeNull();
    expect(p.risparmioEur).not.toBeNull();
    expect(p.risparmioEur!).toBeGreaterThan(0);
  });

  it('non azzarda il confronto se non sa a quanto faresti il pieno a casa', () => {
    const p = pianificaViaggio(
      input({ distanzaKm: 500, litriAdesso: 12, candidate: [tappa({ id: 'a', kmDaPartenza: 60, prezzo: 1.7 })] })
    );
    expect(p.spesaPienoPrima).toBeNull();
    expect(p.risparmioEur).toBeNull();
  });

  it('non propone il pieno prima quando il serbatoio non basta comunque', () => {
    // 1500 km a 15 km/l sono cento litri: in un serbatoio da 50 non ci stanno.
    const p = pianificaViaggio(
      input({
        distanzaKm: 1500,
        litriAdesso: 50,
        prezzoPartenza: 1.9,
        candidate: [
          tappa({ id: 'a', kmDaPartenza: 500, prezzo: 1.8 }),
          tappa({ id: 'b', kmDaPartenza: 1000, prezzo: 1.85 }),
        ],
      })
    );
    expect(p.spesaPienoPrima).toBeNull();
  });
});

describe('pianificaViaggio: robustezza', () => {
  it('non sceglie fra due pompe nello stesso piazzale', () => {
    const p = pianificaViaggio(
      input({
        distanzaKm: 900,
        litriAdesso: 30,
        candidate: [
          tappa({ id: 'gemella-cara', kmDaPartenza: 300, prezzo: 2.0 }),
          tappa({ id: 'gemella-economica', kmDaPartenza: 300.1, prezzo: 1.7 }),
        ],
      })
    );
    // Ne resta una sola, ed e quella che costa meno.
    expect(p.soste.map((s) => s.tappa.id)).toEqual(['gemella-economica']);
  });

  it('ignora le tappe fuori dal percorso', () => {
    const p = pianificaViaggio(
      input({
        distanzaKm: 400,
        candidate: [
          tappa({ id: 'dietro', kmDaPartenza: -10, prezzo: 1.5 }),
          tappa({ id: 'oltre-arrivo', kmDaPartenza: 500, prezzo: 1.5 }),
        ],
      })
    );
    expect(p.fattibile).toBe(true);
    expect(p.soste).toEqual([]);
  });

  it('non entra in un giro infinito su molte tappe', () => {
    const molte = Array.from({ length: 60 }, (_, k) =>
      tappa({ id: `t${k}`, kmDaPartenza: (k + 1) * 40, prezzo: 1.7 + (k % 7) * 0.03 })
    );
    const p = pianificaViaggio(input({ distanzaKm: 2500, litriAdesso: 20, candidate: molte }));
    expect(p.fattibile).toBe(true);
    expect(p.soste.length).toBeGreaterThan(2);
    expect(p.soste.length).toBeLessThan(60);
  });

  it('la spesa e sempre la somma delle soste', () => {
    const p = pianificaViaggio(
      input({
        distanzaKm: 1400,
        litriAdesso: 12,
        prezzoPartenza: 2.0,
        candidate: [
          tappa({ id: 'a', kmDaPartenza: 120, prezzo: 1.92 }),
          tappa({ id: 'b', kmDaPartenza: 480, prezzo: 1.74, deviazioneKm: 2 }),
          tappa({ id: 'c', kmDaPartenza: 900, prezzo: 1.88 }),
        ],
      })
    );
    const somma = p.soste.reduce((a, s) => a + s.spesa, 0);
    expect(p.spesaCarburante).toBeCloseTo(somma, 6);
    expect(p.litriComprati).toBeCloseTo(p.soste.reduce((a, s) => a + s.litri, 0), 6);
  });
});

describe('pianificaViaggio: il confronto e fra due cose confrontabili', () => {
  it('mette a paragone due viaggi che finiscono con lo stesso serbatoio', () => {
    // Il piano arriva con la riserva in pancia. Se l'alternativa arrivasse
    // vuota, il piano sembrerebbe piu caro solo perche ha comprato quella
    // riserva: due viaggi diversi, non un confronto.
    const p = pianificaViaggio(
      input({
        distanzaKm: 500,
        litriAdesso: 12,
        prezzoPartenza: 2.1,
        candidate: [tappa({ id: 'economica', kmDaPartenza: 60, prezzo: 1.7 })],
      })
    );
    const riserva = 50 * RISERVA;
    expect(p.litriAllArrivo).toBeCloseTo(riserva, 1);
    // Chi fa il pieno prima deve comprare tanto quanto basta ad arrivare
    // con la stessa riserva.
    expect(p.spesaPienoPrima).toBeCloseTo((500 / 15 + riserva - 12) * 2.1, 2);
    expect(p.risparmioEur!).toBeGreaterThan(5);
  });

  it('col carburante allo stesso prezzo ovunque non promette risparmi', () => {
    const p = pianificaViaggio(
      input({
        distanzaKm: 900,
        litriAdesso: 20,
        prezzoPartenza: 1.8,
        candidate: [
          tappa({ id: 'a', kmDaPartenza: 300, prezzo: 1.8 }),
          tappa({ id: 'b', kmDaPartenza: 600, prezzo: 1.8 }),
        ],
      })
    );
    // Nessuna occasione da cogliere: il piano non puo fare meglio, e non
    // deve nemmeno raccontare di averlo fatto.
    expect(Math.abs(p.risparmioEur ?? 0)).toBeLessThan(1);
  });
});

describe('pianificaViaggio: non si compra piu del necessario', () => {
  it('all ultimo rifornimento mette solo quanto serve per arrivare', () => {
    // Restano 300 km: a 15 km/l sono 20 litri piu la riserva. Fare il pieno
    // di 50 a un prezzo alto vorrebbe dire portarsi dietro venti litri
    // pagati troppo.
    const p = pianificaViaggio(
      input({
        distanzaKm: 400,
        litriAdesso: 15,
        prezzoPartenza: 1.5,
        candidate: [tappa({ id: 'unica', kmDaPartenza: 100, prezzo: 2.2 })],
      })
    );
    const sosta = p.soste[0]!;
    expect(sosta.pieno).toBe(false);
    expect(sosta.litriDopo).toBeCloseTo(300 / 15 + 50 * RISERVA, 1);
    expect(sosta.litri).toBeLessThan(25);
  });

  it('il pieno resta pieno quando la strada che resta lo richiede', () => {
    const p = pianificaViaggio(
      input({
        distanzaKm: 1600,
        litriAdesso: 15,
        prezzoPartenza: 1.5,
        candidate: [
          tappa({ id: 'a', kmDaPartenza: 80, prezzo: 2.2 }),
          tappa({ id: 'b', kmDaPartenza: 700, prezzo: 2.2 }),
        ],
      })
    );
    expect(p.soste[0]!.pieno).toBe(true);
    expect(p.soste[0]!.litriDopo).toBeCloseTo(50, 1);
  });
});

import { describe, it, expect } from 'vitest';
import { COSTO_SOSTA_EUR, LITRI_SOSTA, MOTIVO_TESTO, pianificaViaggio, RISERVA, type PianoInput, type TappaCandidata } from './viaggio';
import { verificaPiano } from './__fixtures__/pianoRiferimento';

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
    // Da b (km 700) ai 1300 km servono 46 L: con un pieno ad a, che costa
    // meno, a b se ne mettono il meno possibile.
    const p = pianificaViaggio(
      input({
        distanzaKm: 1300,
        litriAdesso: 15,
        prezzoPartenza: 1.5,
        candidate: [
          tappa({ id: 'a', kmDaPartenza: 80, prezzo: 2.1 }),
          tappa({ id: 'b', kmDaPartenza: 700, prezzo: 2.2 }),
        ],
      })
    );
    expect(p.soste.map((s) => s.tappa.id)).toEqual(['a', 'b']);
    expect(p.soste[0]!.pieno).toBe(true);
    expect(p.soste[0]!.litriDopo).toBeCloseTo(50, 6);
    expect(p.soste[1]!.litri).toBeCloseTo(600 / 15 + 6 - (50 - 620 / 15), 6);
  });

  it('quando non ci si arriva, dice fin dove portano le soste', () => {
    // Da b (km 700) restano 900 km: con un pieno se ne fanno 750, a secco.
    const p = pianificaViaggio(
      input({
        distanzaKm: 1600,
        litriAdesso: 15,
        candidate: [
          tappa({ id: 'a', kmDaPartenza: 80, prezzo: 2.2 }),
          tappa({ id: 'b', kmDaPartenza: 700, prezzo: 2.2 }),
        ],
      })
    );
    expect(p.fattibile).toBe(false);
    expect(p.motivo).toBe('buco-troppo-lungo');
    expect(p.bloccoAlKm).toBeCloseTo(700 + 50 * 15, 6);
    expect(p.soste.map((s) => s.tappa.id)).toEqual(['a', 'b']);
    expect(p.soste[1]!.pieno).toBe(true);
  });
});

/*
 * I difetti trovati dalla revisione del 13 ottobre 2026 sul piano «goloso»:
 * ognuno di questi casi falliva con la versione che guardava solo
 * l'autonomia del momento e il prezzo «in pancia».
 */
describe('pianificaViaggio: costo minimo vero', () => {
  it('non fa il pieno caro quando poco piu avanti costa meno e ci si arriva', () => {
    // Si parte con 10 L: arrivati ad A (km 50) ne restano 6,7. A costa 2,10,
    // B (km 200) 1,70. Il conto giusto: ad A solo quanto basta per arrivare a
    // B con la riserva (9,3 L), il resto a B (26,7 L). Il piano goloso
    // riempiva ad A 36 L a 2,10: 10,67 € buttati.
    const p = pianificaViaggio(
      input({
        distanzaKm: 600,
        litriAdesso: 10,
        prezzoPartenza: 1.8,
        candidate: [tappa({ id: 'A', kmDaPartenza: 50, prezzo: 2.1 }), tappa({ id: 'B', kmDaPartenza: 200, prezzo: 1.7 })],
      })
    );
    expect(p.fattibile).toBe(true);
    expect(p.soste.map((s) => s.tappa.id)).toEqual(['A', 'B']);
    expect(p.soste[0]!.litri).toBeCloseTo(150 / 15 + 6 - (10 - 50 / 15), 6);
    expect(p.soste[1]!.litri).toBeCloseTo(400 / 15, 6);
    expect(p.spesaCarburante).toBeCloseTo((150 / 15 + 6 - (10 - 50 / 15)) * 2.1 + (400 / 15) * 1.7, 6);
  });

  it('senza prezzo di partenza non si ferma alla prima pompa che capita', () => {
    const p = pianificaViaggio(
      input({
        distanzaKm: 600,
        litriAdesso: 12,
        prezzoPartenza: null,
        candidate: [tappa({ id: 'cara', kmDaPartenza: 30, prezzo: 2.3 }), tappa({ id: 'economica', kmDaPartenza: 60, prezzo: 1.9 })],
      })
    );
    expect(p.soste.map((s) => s.tappa.id)).toEqual(['economica']);
    // Si arriva alla economica con 8 L e se ne mettono 34: 64,60 €, non 78,20.
    expect(p.spesaCarburante).toBeCloseTo(34 * 1.9, 6);
  });

  it('non fa soste da zero litri: una pompa dove non si compra niente non e una sosta', () => {
    // Col pieno a 40 L il piano goloso andava ad A (piu economica di casa),
    // ci metteva zero litri perche B costa ancora meno, e faceva due km di
    // deviazione per niente.
    const p = pianificaViaggio(
      input({
        distanzaKm: 700,
        litriAdesso: 40,
        prezzoPartenza: 2.0,
        candidate: [
          tappa({ id: 'A', kmDaPartenza: 100, prezzo: 1.9, deviazioneKm: 1 }),
          tappa({ id: 'B', kmDaPartenza: 200, prezzo: 1.8 }),
        ],
      })
    );
    expect(p.soste.map((s) => s.tappa.id)).toEqual(['B']);
    expect(p.soste.every((s) => s.litri >= 0.1)).toBe(true);
    expect(p.kmDeviazione).toBe(0);
  });

  it('chi parte in riserva si ferma e arriva con la riserva, se c e un distributore sulla strada', () => {
    // 5 L su 50: la spia e accesa. Prima il piano diceva «ci arrivi senza
    // fare benzina» e si arrivava con 2,3 L. Alla pompa ne bastano 2,3, ma
    // una sosta mette almeno cinque litri.
    const p = pianificaViaggio(
      input({ distanzaKm: 40, litriAdesso: 5, candidate: [tappa({ id: 'via', kmDaPartenza: 20, prezzo: 2.0 })] })
    );
    expect(p.fattibile).toBe(true);
    expect(p.soste.map((s) => s.tappa.id)).toEqual(['via']);
    expect(p.soste[0]!.litri).toBeCloseTo(LITRI_SOSTA, 6);
    expect(p.litriAllArrivo).toBeCloseTo(5 - 40 / 15 + LITRI_SOSTA, 6);
    expect(p.arrivoSottoRiserva).toBe(false);
    expect(p.sostaInRiserva).toBe(1);
  });

  it('se non c e nessun distributore ma il carburante basta, ci arrivi in riserva e lo dice', () => {
    const inRiserva = pianificaViaggio(input({ distanzaKm: 40, litriAdesso: 5 }));
    expect(inRiserva.fattibile).toBe(true);
    expect(inRiserva.soste).toEqual([]);
    expect(inRiserva.arrivoSottoRiserva).toBe(true);
    expect(inRiserva.litriAllArrivo).toBeCloseTo(5 - 40 / 15, 6);

    // 10 L: sopra la riserva, ma 120 km se la mangiano. Prima era «non ci
    // arrivi», e invece ci si arriva con 2 L.
    const sopra = pianificaViaggio(input({ distanzaKm: 120, litriAdesso: 10 }));
    expect(sopra.fattibile).toBe(true);
    expect(sopra.arrivoSottoRiserva).toBe(true);
    expect(sopra.litriAllArrivo).toBeCloseTo(2, 6);
  });
});

describe('pianificaViaggio: il pieno prima di partire deve stare nel serbatoio', () => {
  it('non conta un pieno che non entra: 32,7 L da mettere con 10 L di spazio', () => {
    // 1000 km a 15 km/l piu la riserva sono 72,7 L. Con 40 L dentro ne
    // servirebbero 32,7, ma nel serbatoio da 50 ne entrano 10.
    const p = pianificaViaggio(
      input({
        distanzaKm: 1000,
        litriAdesso: 40,
        prezzoPartenza: 2.0,
        candidate: [tappa({ id: 'a', kmDaPartenza: 500, prezzo: 1.9 })],
      })
    );
    expect(p.spesaPienoPrima).toBeNull();
    expect(p.risparmioEur).toBeNull();
  });

  it('non fa il confronto quando non serve comprare niente', () => {
    const p = pianificaViaggio(
      input({ distanzaKm: 300, litriAdesso: 50, prezzoPartenza: 2.0, candidate: [tappa({ id: 'a', kmDaPartenza: 100, prezzo: 1.5 })] })
    );
    expect(p.soste).toEqual([]);
    expect(p.spesaPienoPrima).toBeNull();
    expect(p.risparmioEur).toBeNull();
  });
});

describe('pianificaViaggio: le scelte che si spiegano', () => {
  it('a parita di costo sceglie il piano con meno soste', () => {
    // Servono 16 L e costano 2,00 ovunque: metterne 8 e 8 costa uguale a
    // metterne 16 in una volta, ma una sosta e meglio di due.
    const p = pianificaViaggio(
      input({
        distanzaKm: 600,
        litriAdesso: 30,
        candidate: [tappa({ id: 'a', kmDaPartenza: 150, prezzo: 2.0 }), tappa({ id: 'b', kmDaPartenza: 300, prezzo: 2.0 })],
      })
    );
    expect(p.soste).toHaveLength(1);
    expect(p.litriComprati).toBeCloseTo(16, 6);
  });

  it('non devia per un millesimo al litro', () => {
    // Come sull A1 il 13 ottobre: 2,190 sulla strada, 2,189 a 1,2 km. I 2,4
    // km in piu costano 35 centesimi, il millesimo ne fa risparmiare uno e
    // mezzo. Il piano goloso ci andava.
    const p = pianificaViaggio(
      input({
        distanzaKm: 300,
        litriAdesso: 12,
        prezzoPartenza: 2.2,
        candidate: [
          tappa({ id: 'sulla-strada', kmDaPartenza: 50, prezzo: 2.19 }),
          tappa({ id: 'fuori', kmDaPartenza: 60, prezzo: 2.189, deviazioneKm: 1.2 }),
        ],
      })
    );
    expect(p.soste.map((s) => s.tappa.id)).toEqual(['sulla-strada']);
    expect(p.kmDeviazione).toBe(0);
    expect(p.spesaCarburante).toBeCloseTo(14 * 2.19, 6);
  });

  it('fra due pompe nello stesso posto guarda anche la deviazione', () => {
    // Stesso piazzale lungo la strada, ma la piu economica di un millesimo
    // sta due km fuori: si va all altra. E mai a tutte e due.
    const p = pianificaViaggio(
      input({
        distanzaKm: 900,
        litriAdesso: 30,
        candidate: [
          tappa({ id: 'vicina', kmDaPartenza: 300, prezzo: 2.19 }),
          tappa({ id: 'lontana', kmDaPartenza: 300.2, prezzo: 2.189, deviazioneKm: 2 }),
        ],
      })
    );
    expect(p.soste.map((s) => s.tappa.id)).toEqual(['vicina']);
  });
});

/*
 * La seconda revisione del 13 ottobre: la riserva era un gradino (un
 * decilitro sopra o sotto cambiava tutto), chi partiva in riserva veniva
 * mandato alla pompa piu lontana raggiungibile, e una sosta costava un
 * decimo di centesimo, quindi ne spuntavano per pochi centesimi.
 */
describe('pianificaViaggio: la riserva senza gradini', () => {
  const T = 45;
  const R = T * RISERVA;

  it('appena sopra la riserva si ferma alla pompa sulla strada invece di arrivare in riserva', () => {
    // «1/4» di 45 L a 15 km/l: 11,25 L. Senza soste si arriva con 1,3 L;
    // fermandosi al km 100 ci si arriva con 4,6 L, se ne mettono cinque e
    // si arriva con piu della riserva.
    const p = pianificaViaggio(
      input({
        distanzaKm: 150,
        serbatoioL: T,
        litriAdesso: 11.25,
        candidate: [tappa({ id: 'km100', kmDaPartenza: 100, prezzo: 2.19, deviazioneKm: 0.1 })],
      }),
    );
    expect(p.fattibile).toBe(true);
    expect(p.soste.map((s) => s.tappa.id)).toEqual(['km100']);
    expect(p.arrivoSottoRiserva).toBe(false);
    expect(p.sostaInRiserva).toBe(1);
    expect(p.litriAllArrivo).toBeCloseTo(11.25 - 150.2 / 15 + LITRI_SOSTA, 6);
  });

  it('non dice «resti a secco al km 88» quando al km 100 ci arrivi', () => {
    const p = pianificaViaggio(
      input({
        distanzaKm: 300,
        serbatoioL: T,
        litriAdesso: 11.25,
        candidate: [tappa({ id: 'a', kmDaPartenza: 100, prezzo: 2.19 }), tappa({ id: 'b', kmDaPartenza: 200, prezzo: 2.19 })],
      }),
    );
    expect(p.fattibile).toBe(true);
    expect(p.arrivoSottoRiserva).toBe(false);
  });

  it('il piano non cambia da cosi a cosi per un decilitro in piu alla partenza', () => {
    // Con 5,3 L ci si fermava, con 6 no (e si arrivava con 3 L), con 6,5 di nuovo si.
    let prima = 0;
    for (const litriAdesso of [5.3, 5.39, 5.4, 5.41, 6, 6.5]) {
      const p = pianificaViaggio(
        input({ distanzaKm: 60, kml: 20, serbatoioL: T, litriAdesso, candidate: [tappa({ id: 'via', kmDaPartenza: 20, prezzo: 2.19 })] }),
      );
      expect(p.soste.map((s) => s.tappa.id)).toEqual(['via']);
      expect(p.litriAllArrivo).toBeGreaterThanOrEqual(R);
      // Con piu carburante alla partenza si arriva con di piu, mai con meno.
      expect(p.litriAllArrivo).toBeGreaterThanOrEqual(prima);
      prima = p.litriAllArrivo;
    }
  });

  it('se l ultimo tratto e piu lungo di un pieno con la riserva, ci arrivi in riserva, non «non ci arrivi»', () => {
    // 900 km a 20 km/l col pieno: senza soste si arriva a secco. Un rabbocco
    // al km 50 fa arrivare con 2,5 L. Prima a 900,1 km diventava impossibile.
    for (const distanzaKm of [900, 900.1]) {
      const p = pianificaViaggio(
        input({ distanzaKm, kml: 20, serbatoioL: T, litriAdesso: T, candidate: [tappa({ id: 'km50', kmDaPartenza: 50, prezzo: 2.19 })] }),
      );
      expect(p.fattibile).toBe(true);
      expect(p.soste.map((s) => s.tappa.id)).toEqual(['km50']);
      expect(p.soste[0]!.pieno).toBe(true);
      expect(p.litriAllArrivo).toBeCloseTo(T - (distanzaKm - 50) / 20, 6);
      expect(p.arrivoSottoRiserva).toBe(true);
    }
  });

  it('quando non si arriva al primo distributore dice dove si resta a secco davvero', () => {
    // 5 L a 15 km/l sono 75 km: la prima pompa e al km 100.
    const p = pianificaViaggio(
      input({ distanzaKm: 300, serbatoioL: T, litriAdesso: 5, candidate: [tappa({ id: 'a', kmDaPartenza: 100, prezzo: 2.19 })] }),
    );
    expect(p.fattibile).toBe(false);
    expect(p.soste).toEqual([]);
    expect(p.bloccoAlKm).toBeCloseTo(75, 6);
  });
});

describe('pianificaViaggio: chi parte in riserva va alla pompa vicina', () => {
  it('fra due pompe allo stesso prezzo, a 10 e a 50 km, sceglie quella a 10', () => {
    // Come Milano → Bologna con la spia accesa: il piano mandava ad A1
    // Somaglia, al km 51,5, arrivando con 0,03 L, per sei centesimi.
    const p = pianificaViaggio(
      input({
        distanzaKm: 220,
        kml: 13,
        serbatoioL: 40,
        litriAdesso: 4,
        candidate: [
          tappa({ id: 'vicina', kmDaPartenza: 10, prezzo: 1.99, deviazioneKm: 0.25 }),
          tappa({ id: 'lontana', kmDaPartenza: 50, prezzo: 1.99, deviazioneKm: 0.04 }),
        ],
      }),
    );
    expect(p.soste[0]!.tappa.id).toBe('vicina');
    expect(p.sostaInRiserva).toBe(1);
    // Alla pompa ci arriva con piu di tre litri, non a secco.
    expect(p.soste[0]!.litriDopo - p.soste[0]!.litri).toBeGreaterThan(3);
  });

  it('non va 40 km piu in la in riserva nemmeno per qualche centesimo al litro', () => {
    const p = pianificaViaggio(
      input({
        distanzaKm: 600,
        kml: 18,
        serbatoioL: 45,
        litriAdesso: 4.5,
        candidate: [tappa({ id: 'vicina', kmDaPartenza: 1.2, prezzo: 2.19, deviazioneKm: 0.13 }), tappa({ id: 'lontana', kmDaPartenza: 52.9, prezzo: 2.16 })],
      }),
    );
    expect(p.soste[0]!.tappa.id).toBe('vicina');
  });

  it('non devia all ultimo km per arrivare alla pompa con meno di quanto arriverebbe a casa', () => {
    // 100 km con 10,6 L a 18 km/l: senza soste si arriva con 5,04 L, un
    // filo sotto la riserva. L unica pompa e al km 99, a 2,5 km dalla
    // strada: ci si arriverebbe con 4,96 L, piu in basso che in fondo, per
    // comprarne cinque. Meglio arrivare, e dirlo.
    for (const litriAdesso of [10.4, 10.6, 10.8]) {
      const i = input({
        distanzaKm: 100,
        kml: 18,
        serbatoioL: 45,
        litriAdesso,
        candidate: [tappa({ id: 'in-fondo', kmDaPartenza: 99, prezzo: 2.19, deviazioneKm: 2.5 })],
      });
      const p = pianificaViaggio(i);
      expect(p.fattibile).toBe(true);
      expect(p.soste).toEqual([]);
      expect(p.arrivoSottoRiserva).toBe(true);
      expect(p.litriAllArrivo).toBeCloseTo(litriAdesso - 100 / 18, 6);
    }
    // La stessa pompa a 0,5 km dalla strada: ci si arriva con piu di quanto
    // si arriverebbe in fondo, e la sosta torna buona.
    const vicina = pianificaViaggio(
      input({ distanzaKm: 100, kml: 18, serbatoioL: 45, litriAdesso: 10.6, candidate: [tappa({ id: 'in-fondo', kmDaPartenza: 99, prezzo: 2.19, deviazioneKm: 0.5 })] }),
    );
    expect(vicina.soste.map((s) => s.tappa.id)).toEqual(['in-fondo']);
    expect(vicina.arrivoSottoRiserva).toBe(false);
  });

  it('con la riserva a zero non resta mai a secco, nemmeno di un soffio', () => {
    const lontana = { distanzaKm: 1, kml: 14, serbatoioL: 10, litriAdesso: 0, riservaFrazione: 0 };
    const p1 = pianificaViaggio(input({ ...lontana, candidate: [tappa({ id: 't0', kmDaPartenza: 0, prezzo: 2.19, deviazioneKm: 0.3 })] }));
    // A secco non si arriva nemmeno alla pompa: non ci si arriva, e lo dice.
    expect(p1.fattibile).toBe(false);

    const i = input({
      distanzaKm: 80.8,
      kml: 14,
      serbatoioL: 10,
      litriAdesso: 0,
      riservaFrazione: 0,
      candidate: [tappa({ id: 'qui', kmDaPartenza: 0, prezzo: 2.2 }), tappa({ id: 'dopo', kmDaPartenza: 0.5, prezzo: 2.19 })],
    });
    const p2 = pianificaViaggio(i);
    expect(p2.soste.map((s) => s.tappa.id)).toEqual(['qui']);
    expect(verificaPiano(i, p2)).toEqual([]);
  });
});

describe('pianificaViaggio: una sosta deve valere la sosta', () => {
  it('non fa rabbocchi da due decilitri: se si ferma, mette almeno cinque litri', () => {
    // Come Bologna → Firenze con «1/4»: senza soste si arriva con 5,2 L,
    // due decilitri sotto la riserva. Prima: sosta da 0,2 L a 0,44 €, e il
    // Riepilogo diceva «Metti 0 L in tutto».
    const p = pianificaViaggio(
      input({ distanzaKm: 105, kml: 18, serbatoioL: 45, litriAdesso: 5.2 + 105 / 18, candidate: [tappa({ id: 'quasi', kmDaPartenza: 100, prezzo: 2.209 })] }),
    );
    expect(p.soste.map((s) => s.tappa.id)).toEqual(['quasi']);
    expect(p.soste[0]!.litri).toBeCloseTo(LITRI_SOSTA, 6);
    expect(p.litriAllArrivo).toBeCloseTo(5.2 + LITRI_SOSTA, 6);
    expect(p.arrivoSottoRiserva).toBe(false);
  });

  it('spostare la pompa di un km non cambia la risposta', () => {
    // 110 km, 11,25 L a 18 km/l: senza soste si arriva con 5,14 L. Prima
    // con la pompa al km 105 si metteva 0,26 L, al km 106 «non c'e un
    // distributore». Ora sempre la stessa sosta da cinque litri; dal km 106
    // alla pompa si arriva un filo sotto la riserva, e lo dice.
    const esiti = [104, 105, 106, 107].map((km) =>
      pianificaViaggio(input({ distanzaKm: 110, kml: 18, serbatoioL: 45, litriAdesso: 11.25, candidate: [tappa({ id: 'A', kmDaPartenza: km, prezzo: 2.19 })] })),
    );
    for (const p of esiti) {
      expect(p.soste.map((s) => s.tappa.id)).toEqual(['A']);
      expect(p.soste[0]!.litri).toBeCloseTo(LITRI_SOSTA, 6);
      expect(p.arrivoSottoRiserva).toBe(false);
      expect(p.litriAllArrivo).toBeCloseTo(11.25 - 110 / 18 + LITRI_SOSTA, 6);
    }
    expect(esiti.map((p) => p.sostaInRiserva)).toEqual([null, null, 1, 1]);
  });

  it('non aggiunge una sosta per risparmiare meno di quanto costa fermarsi', () => {
    // Servono 40 L, e B senza fermarsi prima non si raggiunge. Metterne 20
    // ad A e 20 a B, un centesimo meno, fa risparmiare 20 centesimi: non
    // vale una seconda sosta.
    const p = pianificaViaggio(
      input({
        distanzaKm: 900,
        litriAdesso: 26,
        candidate: [tappa({ id: 'A', kmDaPartenza: 300, prezzo: 2.2 }), tappa({ id: 'B', kmDaPartenza: 600, prezzo: 2.19 })],
      }),
    );
    expect(p.soste).toHaveLength(1);
  });

  it('la seconda sosta si fa quando fa risparmiare piu di quanto costa fermarsi', () => {
    // Come sopra, ma B costa venti centesimi meno: 20 L × 0,20 = 4 €.
    const p = pianificaViaggio(
      input({
        distanzaKm: 900,
        litriAdesso: 26,
        candidate: [tappa({ id: 'A', kmDaPartenza: 300, prezzo: 2.2 }), tappa({ id: 'B', kmDaPartenza: 600, prezzo: 2.0 })],
      }),
    );
    expect(p.soste.map((s) => s.tappa.id)).toEqual(['A', 'B']);
  });

  it('fermarsi pesa cinque minuti al valore del tempo della Home, e nella spesa non entra', () => {
    expect(COSTO_SOSTA_EUR).toBeCloseTo(0.75, 6);
    const p = pianificaViaggio(input({ distanzaKm: 40, litriAdesso: 5, candidate: [tappa({ id: 'via', kmDaPartenza: 20, prezzo: 2.0 })] }));
    expect(p.spesaCarburante).toBeCloseTo(LITRI_SOSTA * 2.0, 6);
  });

  it('nessuna sosta mette meno di cinque litri, se non per fare il pieno', () => {
    const p = pianificaViaggio(
      input({
        distanzaKm: 1300,
        kml: 18,
        serbatoioL: 45,
        litriAdesso: 11.25,
        candidate: Array.from({ length: 40 }, (_, k) => tappa({ id: `t${k}`, kmDaPartenza: 15 + k * 32, prezzo: [2.19, 2.199, 2.149, 2.229][k % 4]! })),
      }),
    );
    expect(p.fattibile).toBe(true);
    for (const s of p.soste) expect(s.pieno || s.litri >= LITRI_SOSTA - 1e-9).toBe(true);
  });
});

describe('pianificaViaggio: soste obbligate in fila', () => {
  it('compra dove costa meno giusto quanto serve perche le soste obbligate dopo mettano il minimo', () => {
    // Serbatoio da 50 a 10 km/l, riserva di 5 L. C al km 0 costa 1,90; M1 e
    // M2, piu care, sono obbligate: col pieno da C non si arriva a M2, col
    // pieno da M1 non si arriva in fondo. A M1 e M2 si mettono 5 L, il
    // minimo; a C quanto basta perche con quei due minimi si arrivi con la
    // riserva: 39 L, non il pieno, che lascerebbe un litro pagato in piu.
    // La versione di prima guardava solo pochi livelli e faceva il pieno.
    const p = pianificaViaggio(
      input({
        distanzaKm: 540,
        kml: 10,
        serbatoioL: 50,
        litriAdesso: 10,
        riservaFrazione: 0.1,
        candidate: [
          tappa({ id: 'C', kmDaPartenza: 0, prezzo: 1.9 }),
          tappa({ id: 'M1', kmDaPartenza: 50, prezzo: 2.3 }),
          tappa({ id: 'M2', kmDaPartenza: 480, prezzo: 2.4 }),
        ],
      }),
    );
    expect(p.soste.map((s) => s.tappa.id)).toEqual(['C', 'M1', 'M2']);
    expect(p.soste.map((s) => s.litri)).toEqual([expect.closeTo(39, 6), expect.closeTo(5, 6), expect.closeTo(5, 6)]);
    expect(p.litriAllArrivo).toBeCloseTo(5, 6);
    expect(p.spesaCarburante).toBeCloseTo(39 * 1.9 + 5 * 2.3 + 5 * 2.4, 6);
  });

  it('non fa il pieno dove costa meno se poi una sosta obbligata non riesce a mettere il minimo', () => {
    // Da A (km 0) col pieno non si arriva a C (km 480) con la riserva: B, al
    // km 40 e piu cara, e obbligata. Il pieno ad A fa arrivare a B con 46 L,
    // e li si puo solo rabboccare 4 L a 2,30. Meglio 18 L ad A: a B se ne
    // mettono 5 e si arriva a C giusto con la riserva. La versione di prima
    // sceglieva la sequenza guardando pochi livelli, e spendeva 1,80 € in piu.
    const p = pianificaViaggio(
      input({
        distanzaKm: 500,
        kml: 10,
        serbatoioL: 50,
        litriAdesso: 30,
        riservaFrazione: 0.1,
        candidate: [
          tappa({ id: 'A', kmDaPartenza: 0, prezzo: 2.05 }),
          tappa({ id: 'B', kmDaPartenza: 40, prezzo: 2.3 }),
          tappa({ id: 'C', kmDaPartenza: 480, prezzo: 2.1 }),
        ],
      }),
    );
    expect(p.soste.map((s) => s.tappa.id)).toEqual(['A', 'B', 'C']);
    expect(p.soste.map((s) => s.litri)).toEqual([expect.closeTo(18, 6), expect.closeTo(5, 6), expect.closeTo(5, 6)]);
    expect(p.spesaCarburante).toBeCloseTo(18 * 2.05 + 5 * 2.3 + 5 * 2.1, 6);
  });
});

describe('pianificaViaggio: nessuna pompa si scarta in anticipo', () => {
  it('dopo una sosta obbligata usa la pompa economica vicina, anche se un altra uguale sembrava batterla', () => {
    // In riserva con 45 L a 18 km/l. P, sulla strada al km 40, e l unica a
    // cui si arriva col fondo. A e B costano 1,99, una mezzo km prima e
    // una mezzo km dopo P: A ha meno deviazione e «batte» B, ma dopo la
    // sosta a P non si puo piu tornare indietro. La versione che toglieva
    // B prima del conto metteva 17,57 L a P a 2,25 e spendeva 6 € in piu.
    const i = input({
      distanzaKm: 600,
      kml: 18,
      serbatoioL: 45,
      litriAdesso: 4.5,
      candidate: [
        tappa({ id: 'P', kmDaPartenza: 40, prezzo: 2.25 }),
        tappa({ id: 'A', kmDaPartenza: 39.5, prezzo: 1.99, deviazioneKm: 1.4 }),
        tappa({ id: 'B', kmDaPartenza: 40.5, prezzo: 1.99, deviazioneKm: 2.4 }),
        tappa({ id: 'Q', kmDaPartenza: 300, prezzo: 2.19 }),
      ],
    });
    const p = pianificaViaggio(i);
    expect(verificaPiano(i, p)).toEqual([]);
    expect(p.soste.map((s) => s.tappa.id)).toEqual(['P', 'B']);
    expect(p.soste.map((s) => s.litri)).toEqual([expect.closeTo(LITRI_SOSTA, 6), expect.closeTo(29.5, 6)]);
    expect(p.spesaCarburante).toBeCloseTo(LITRI_SOSTA * 2.25 + 29.5 * 1.99, 6);
  });
});

describe('MOTIVO_TESTO', () => {
  it('manda a scegliere l auto nelle impostazioni: il Garage nella 2.0 non c e piu', () => {
    expect(MOTIVO_TESTO['senza-consumo']).not.toContain('Garage');
    expect(MOTIVO_TESTO['senza-consumo']).toContain('impostazioni');
  });
});

import { describe, it, expect } from 'vitest';
import {
  campionaPercorso,
  impiantiLungoPercorso,
  indicizzaPercorso,
  semplificaPercorso,
  SCOSTAMENTO_MAX_KM,
  vistaPercorso,
} from './lungoPercorso';
import type { LatLng } from './geo';
import type { StationRow } from './parse';

/*
 * Tutto sintetico: percorsi e impianti costruiti a mano, niente
 * stations.json (che cambia a ogni seed).
 */

const RAD = Math.PI / 180;
const KM_LAT = 6371 * RAD;
const ADESSO = new Date(2026, 9, 13, 12, 0);

function quando(oreFa: number): string {
  const d = new Date(ADESSO.getTime() - oreFa * 3_600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function riga(id: string, p: LatLng, over: Partial<StationRow> = {}): StationRow {
  return {
    id,
    name: `Impianto ${id}`,
    brand: 'Marchio',
    operator: '',
    prov: null,
    city: '',
    address: '',
    isHighway: false,
    lat: p.lat,
    lng: p.lng,
    prices: { diesel: 1.7 },
    servito: {},
    updated: quando(2),
    ...over,
  };
}

/** Sposta un punto di tanti km verso nord (negativi: sud) e verso est (negativi: ovest). */
function sposta(p: LatLng, nordKm: number, estKm = 0): LatLng {
  return { lat: p.lat + nordKm / KM_LAT, lng: p.lng + estKm / (KM_LAT * Math.cos(p.lat * RAD)) };
}

/** Una retta verso est, un vertice ogni `passoKm`. */
function rettaEst(kmTotali: number, passoKm: number, da: LatLng = { lat: 44, lng: 11 }): LatLng[] {
  const n = Math.round(kmTotali / passoKm);
  return Array.from({ length: n + 1 }, (_, i) => sposta(da, 0, (kmTotali * i) / n));
}

const opz = { fuel: 'diesel' as const };

/** Generatore pseudo-casuale con seme: i test restano ripetibili. */
function casuale(seme: number): () => number {
  let a = seme >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Distanza piana punto-segmento in km, scritta qui da capo per fare da oracolo. */
function oracolo(p: LatLng, a: LatLng, b: LatLng): { km: number; t: number } {
  const k = Math.cos(p.lat * RAD);
  const vx = (b.lng - a.lng) * k;
  const vy = b.lat - a.lat;
  const px = (p.lng - a.lng) * k;
  const py = p.lat - a.lat;
  const l2 = vx * vx + vy * vy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, (px * vx + py * vy) / l2)) : 0;
  return { km: Math.hypot(px - t * vx, py - t * vy) * KM_LAT, t };
}

describe('semplificaPercorso', () => {
  it('lascia com e un percorso di due punti o meno', () => {
    expect(semplificaPercorso([])).toEqual([]);
    const uno = [{ lat: 44, lng: 11 }];
    expect(semplificaPercorso(uno)).toEqual(uno);
    const due = [{ lat: 44, lng: 11 }, { lat: 45, lng: 12 }];
    expect(semplificaPercorso(due)).toEqual(due);
  });

  it('di mille punti in fila tiene solo il primo e l ultimo', () => {
    const fila = rettaEst(100, 0.1);
    const s = semplificaPercorso(fila);
    expect(s).toHaveLength(2);
    expect(s[0]).toEqual(fila[0]);
    expect(s[1]).toEqual(fila[fila.length - 1]);
  });

  it('toglie i tremolii sotto i 30 metri', () => {
    const base = rettaEst(20, 0.05);
    const tremolante = base.map((p, i) => sposta(p, i % 2 ? 0.01 : -0.01));
    expect(semplificaPercorso(tremolante).length).toBeLessThanOrEqual(3);
  });

  it('tiene le curve vere', () => {
    // Dieci km verso est, poi dieci verso nord: l'angolo deve restare.
    const angolo = sposta({ lat: 44, lng: 11 }, 0, 10);
    const andata = rettaEst(10, 0.1);
    const salita = Array.from({ length: 101 }, (_, i) => sposta(angolo, i * 0.1));
    const s = semplificaPercorso([...andata, ...salita.slice(1)]);
    expect(s).toHaveLength(3);
    expect(s[1]!.lng).toBeCloseTo(angolo.lng, 6);
  });

  it('nessun punto originale resta a piu della tolleranza dalla spezzata semplificata', () => {
    const r = casuale(7);
    const punti: LatLng[] = [{ lat: 44, lng: 11 }];
    let dir = 0;
    for (let i = 0; i < 3000; i++) {
      dir += (r() - 0.5) * 0.6;
      punti.push(sposta(punti[i]!, Math.sin(dir) * 0.08, Math.cos(dir) * 0.08));
    }
    const s = semplificaPercorso(punti, 0.03);
    expect(s.length).toBeLessThan(punti.length / 3);
    for (const p of punti) {
      let min = Infinity;
      for (let i = 0; i < s.length - 1; i++) min = Math.min(min, oracolo(p, s[i]!, s[i + 1]!).km);
      expect(min).toBeLessThan(0.0305);
    }
  });
});

describe('impiantiLungoPercorso: chi e sulla strada', () => {
  const strada = rettaEst(40, 10);

  it('trova un impianto proprio sulla strada, su un vertice e in mezzo a un tratto', () => {
    const vertice = riga('vertice', strada[1]!);
    const mezzo = riga('mezzo', sposta(strada[0]!, 0, 15));
    const out = impiantiLungoPercorso(strada, [vertice, mezzo], opz);
    expect(out.map((x) => x.row.id)).toEqual(['vertice', 'mezzo']);
    expect(out[0]!.scostamentoKm).toBeLessThan(0.001);
    expect(out[0]!.kmDaPartenza).toBeCloseTo(10, 1);
    expect(out[1]!.scostamentoKm).toBeLessThan(0.001);
    expect(out[1]!.kmDaPartenza).toBeCloseTo(15, 1);
  });

  it('tiene chi sta appena dentro la soglia e scarta chi sta appena fuori', () => {
    const dentro = riga('dentro', sposta(strada[0]!, SCOSTAMENTO_MAX_KM - 0.05, 20));
    const fuori = riga('fuori', sposta(strada[0]!, -(SCOSTAMENTO_MAX_KM + 0.05), 20));
    const out = impiantiLungoPercorso(strada, [dentro, fuori], opz);
    expect(out.map((x) => x.row.id)).toEqual(['dentro']);
    expect(out[0]!.scostamentoKm).toBeCloseTo(SCOSTAMENTO_MAX_KM - 0.05, 2);
  });

  it('rispetta una soglia diversa da quella predefinita', () => {
    const a = riga('a', sposta(strada[0]!, 0.98, 5));
    const b = riga('b', sposta(strada[0]!, 1.02, 6));
    const out = impiantiLungoPercorso(strada, [a, b], { ...opz, maxScostamentoKm: 1 });
    expect(out.map((x) => x.row.id)).toEqual(['a']);
  });

  it('misura bene anche verso est, dove un grado vale meno km', () => {
    // Strada verso nord a 46°: un grado di longitudine e circa 77 km, non 111.
    const nord = Array.from({ length: 5 }, (_, i) => sposta({ lat: 46, lng: 11 }, i * 10));
    const dentro = riga('dentro', sposta(nord[0]!, 20, 2.4));
    const fuori = riga('fuori', sposta(nord[0]!, 20, -2.6));
    const out = impiantiLungoPercorso(nord, [dentro, fuori], opz);
    expect(out.map((x) => x.row.id)).toEqual(['dentro']);
    expect(out[0]!.scostamentoKm).toBeCloseTo(2.4, 1);
    expect(out[0]!.kmDaPartenza).toBeCloseTo(20, 0);
  });

  it('vicino a un vertice misura la distanza dal vertice, non dalle rette', () => {
    // Est per 10 km, poi nord per 10: l'esterno della curva e a sud-est.
    const angolo = sposta({ lat: 44, lng: 11 }, 0, 10);
    const curva = [{ lat: 44, lng: 11 }, angolo, sposta(angolo, 10)];
    // A 2,1 km dall'angolo: dentro.
    const vicino = riga('vicino', sposta(angolo, -1.5, 1.5));
    // A 2,8 km dall'angolo, ma a soli 2 km da ciascuna delle due rette: fuori.
    const lontano = riga('lontano', sposta(angolo, -2, 2));
    const out = impiantiLungoPercorso(curva, [vicino, lontano], opz);
    expect(out.map((x) => x.row.id)).toEqual(['vicino']);
    expect(out[0]!.scostamentoKm).toBeCloseTo(Math.hypot(1.5, 1.5), 1);
    expect(out[0]!.kmDaPartenza).toBeCloseTo(10, 0);
  });

  it('su un tratto dritto lunghissimo con due soli vertici vede anche chi sta nel mezzo', () => {
    const autostrada = rettaEst(300, 300);
    expect(autostrada).toHaveLength(2);
    const righe = [
      riga('meta', sposta(autostrada[0]!, 1, 150)),
      riga('quasi-fine', sposta(autostrada[0]!, -2, 290)),
      riga('troppo-lontano', sposta(autostrada[0]!, 3, 150)),
    ];
    const out = impiantiLungoPercorso(autostrada, righe, opz);
    expect(out.map((x) => x.row.id)).toEqual(['meta', 'quasi-fine']);
    expect(out[0]!.kmDaPartenza).toBeCloseTo(150, 0);
    expect(out[0]!.scostamentoKm).toBeCloseTo(1, 1);
  });

  it('su un tratto lungo in diagonale vede chi gli sta accanto in ogni punto', () => {
    const a = { lat: 41.5, lng: 12.5 };
    const b = { lat: 44.5, lng: 9.0 };
    const righe: StationRow[] = [];
    for (let i = 1; i < 20; i++) {
      const f = i / 20;
      const p = { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f };
      // Perpendicolare alla diagonale sul piano locale, a 2 km da una parte e dall'altra.
      const k = Math.cos(p.lat * RAD);
      const vx = (b.lng - a.lng) * k;
      const vy = b.lat - a.lat;
      const l = Math.hypot(vx, vy);
      const lato = i % 2 ? 1 : -1;
      const d = (2 / KM_LAT) * lato;
      righe.push(riga(`d${i}`, { lat: p.lat + (vx / l) * d, lng: p.lng + ((-vy / l) * d) / k }));
    }
    const out = impiantiLungoPercorso([a, b], righe, opz);
    expect(out).toHaveLength(19);
    for (const x of out) expect(x.scostamentoKm).toBeCloseTo(2, 1);
  });
});

describe('impiantiLungoPercorso: i km dalla partenza', () => {
  it('restituisce gli impianti in ordine di strada, non di elenco', () => {
    const strada = rettaEst(100, 5);
    const righe = [50, 10, 80, 30].map((km) => riga(`km${km}`, sposta(strada[0]!, 0.5, km)));
    const out = impiantiLungoPercorso(strada, righe, opz);
    expect(out.map((x) => x.row.id)).toEqual(['km10', 'km30', 'km50', 'km80']);
    for (const x of out) expect(x.kmDaPartenza).toBeCloseTo(Number(x.row.id.slice(2)), 0);
  });

  it('riporta i km sulla lunghezza stradale del router', () => {
    const strada = rettaEst(100, 5);
    const out = impiantiLungoPercorso(strada, [riga('a', sposta(strada[0]!, 0, 40))], { ...opz, kmStradali: 130 });
    expect(out[0]!.kmDaPartenza).toBeCloseTo(52, 0);
  });

  it('su andata e ritorno conta l impianto una volta sola, al primo passaggio', () => {
    const andata = rettaEst(50, 5);
    const giro = [...andata, ...andata.slice(0, -1).reverse()];
    const out = impiantiLungoPercorso(giro, [riga('a', sposta(andata[0]!, 1, 20))], opz);
    expect(out).toHaveLength(1);
    expect(out[0]!.kmDaPartenza).toBeCloseTo(20, 0);
  });
});

describe('impiantiLungoPercorso: chi resta fuori', () => {
  const strada = rettaEst(40, 10);
  const sulla = (km: number) => sposta(strada[0]!, 0.2, km);

  it('scarta i nascosti, chi non ha il carburante e i prezzi fermi da oltre una settimana', () => {
    const righe = [
      riga('buono', sulla(5)),
      riga('nascosto', sulla(10)),
      riga('solo-benzina', sulla(15), { prices: { benzina: 1.8 } }),
      riga('otto-giorni', sulla(20), { updated: quando(8 * 24) }),
      riga('sei-giorni', sulla(25), { updated: quando(6 * 24) }),
      riga('senza-data', sulla(30), { updated: null }),
    ];
    const out = impiantiLungoPercorso(strada, righe, { ...opz, nascosti: new Set(['nascosto']) });
    expect(out.map((x) => x.row.id)).toEqual(['buono', 'sei-giorni', 'senza-data']);
    expect(out[0]!.prezzo).toBe(1.7);
  });

  it('se è il lotto intero a essere vecchio, nessuno è «chiuso»', () => {
    // Telefono senza rete da dieci giorni: vecchi sono i dati, non i distributori.
    const righe = ['a', 'b', 'c'].map((id, i) => riga(id, sulla(5 + i * 5), { updated: quando(10 * 24 + i) }));
    expect(impiantiLungoPercorso(strada, righe, opz).map((x) => x.row.id)).toEqual(['a', 'b', 'c']);
  });

  it('con un percorso vuoto o di un punto solo non trova niente', () => {
    const r = [riga('a', { lat: 44, lng: 11 })];
    expect(impiantiLungoPercorso([], r, opz)).toEqual([]);
    expect(impiantiLungoPercorso([{ lat: 44, lng: 11 }], r, opz)).toEqual([]);
  });
});

describe('impiantiLungoPercorso: indice', () => {
  it('con l indice gia pronto da lo stesso risultato della spezzata', () => {
    const strada = rettaEst(60, 0.2);
    const righe = [5, 25, 45].map((km, i) => riga(`r${i}`, sposta(strada[0]!, i - 1, km)));
    const daSpezzata = impiantiLungoPercorso(strada, righe, opz);
    const daIndice = impiantiLungoPercorso(indicizzaPercorso(strada), righe, opz);
    expect(daIndice).toEqual(daSpezzata);
    expect(daIndice).toHaveLength(3);
  });

  it('un indice preparato per un margine stretto non nasconde chi sta piu in la', () => {
    const strada = rettaEst(60, 10);
    const stretto = indicizzaPercorso(strada, { margineKm: 0.5 });
    const out = impiantiLungoPercorso(stretto, [riga('a', sposta(strada[0]!, 2, 30))], opz);
    expect(out).toHaveLength(1);
  });

  it('da gli stessi impianti e gli stessi km di una ricerca a forza bruta', () => {
    const r = casuale(42);
    const punti: LatLng[] = [{ lat: 43.5, lng: 10.5 }];
    let dir = 0.4;
    for (let i = 0; i < 2500; i++) {
      dir += (r() - 0.5) * 0.3;
      punti.push(sposta(punti[i]!, Math.sin(dir) * 0.12, Math.cos(dir) * 0.12));
    }
    const indice = indicizzaPercorso(punti);
    const s = indice.punti;
    const righe: StationRow[] = [];
    for (let i = 0; i < 3000; i++) {
      const base = punti[Math.floor(r() * punti.length)]!;
      righe.push(riga(`r${i}`, sposta(base, (r() - 0.5) * 8, (r() - 0.5) * 8)));
    }

    const attesi = new Map<string, number>();
    for (const x of righe) {
      let best = { km: Infinity, s: -1, t: 0 };
      for (let i = 0; i < s.length - 1; i++) {
        const d = oracolo(x, s[i]!, s[i + 1]!);
        if (d.km < best.km) best = { km: d.km, s: i, t: d.t };
      }
      if (best.km <= SCOSTAMENTO_MAX_KM) {
        const lung = indice.cumulateKm[best.s + 1]! - indice.cumulateKm[best.s]!;
        attesi.set(x.id, indice.cumulateKm[best.s]! + best.t * lung);
      }
    }

    const out = impiantiLungoPercorso(indice, righe, opz);
    expect(attesi.size).toBeGreaterThan(500);
    expect(out).toHaveLength(attesi.size);
    for (const x of out) expect(x.kmDaPartenza).toBeCloseTo(attesi.get(x.row.id)!, 6);
  });
});

describe('impiantiLungoPercorso: velocita', () => {
  /** Un percorso lungo e mosso, un punto ogni cento metri, verso sud-est. */
  function percorsoLungo(km: number, seme: number): LatLng[] {
    const r = casuale(seme);
    const punti: LatLng[] = [{ lat: 45.6, lng: 8.8 }];
    let dir = -0.6;
    for (let i = 0; i < km * 10; i++) {
      dir += (r() - 0.5) * 0.08;
      dir = Math.max(-1.3, Math.min(0.2, dir));
      punti.push(sposta(punti[i]!, Math.sin(dir) * 0.1, Math.cos(dir) * 0.1));
    }
    return punti;
  }

  /** Impianti sparsi su tutta Italia, piu un migliaio vicino alla strada. */
  function impianti(n: number, vicinoA: LatLng[], seme: number): StationRow[] {
    const r = casuale(seme);
    const out: StationRow[] = [];
    for (let i = 0; i < n - 1000; i++) out.push(riga(`i${i}`, { lat: 37 + r() * 10, lng: 7 + r() * 11.5 }));
    for (let i = 0; i < 1000; i++) {
      const p = vicinoA[Math.floor(r() * vicinoA.length)]!;
      out.push(riga(`v${i}`, sposta(p, (r() - 0.5) * 6, (r() - 0.5) * 6)));
    }
    return out;
  }

  function cronometra(fn: () => unknown): number {
    let migliore = Infinity;
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      fn();
      migliore = Math.min(migliore, performance.now() - t0);
    }
    return migliore;
  }

  it('ventimila impianti su 600 km in molto meno di 100 ms', () => {
    const strada = percorsoLungo(600, 1);
    const righe = impianti(20_000, strada, 2);
    let trovati = 0;
    const ms = cronometra(() => {
      trovati = impiantiLungoPercorso(strada, righe, opz).length;
    });
    expect(trovati).toBeGreaterThan(300);
    expect(ms).toBeLessThan(100);
  });

  it('ventunomila impianti su 1200 km restano sotto i 100 ms', () => {
    const strada = percorsoLungo(1200, 3);
    const righe = impianti(21_000, strada, 4);
    const ms = cronometra(() => impiantiLungoPercorso(strada, righe, opz));
    expect(ms).toBeLessThan(100);
  });
});

describe('campionaPercorso', () => {
  it('tiene primo e ultimo e non supera il numero chiesto', () => {
    const p = rettaEst(100, 0.1);
    const c = campionaPercorso(p, 50);
    expect(c).toHaveLength(50);
    expect(c[0]).toEqual(p[0]);
    expect(c[49]).toEqual(p[p.length - 1]);
  });

  it('un percorso gia corto resta com e', () => {
    const p = rettaEst(10, 5);
    expect(campionaPercorso(p, 50)).toEqual(p);
  });
});

describe('vistaPercorso', () => {
  it('centra il percorso e allarga lo zoom quando il percorso si allunga', () => {
    const corto = vistaPercorso(rettaEst(20, 1))!;
    const lungo = vistaPercorso(rettaEst(600, 10))!;
    expect(corto.centro.lng).toBeCloseTo((rettaEst(20, 1)[0]!.lng + rettaEst(20, 1)[20]!.lng) / 2, 6);
    expect(corto.centro.lat).toBeCloseTo(44, 6);
    expect(lungo.zoom).toBeLessThan(corto.zoom);
    // Dimezzare la larghezza in gradi vale uno zoom in piu.
    const meta = vistaPercorso(rettaEst(300, 10))!;
    expect(meta.zoom - lungo.zoom).toBeCloseTo(1, 1);
  });

  it('un percorso nord-sud lo inquadra in altezza', () => {
    const nordSud = [{ lat: 45.5, lng: 9.2 }, { lat: 41.9, lng: 12.5 }];
    const v = vistaPercorso(nordSud, 360, 280, 36)!;
    expect(v.zoom).toBeGreaterThan(4);
    expect(v.zoom).toBeLessThan(7);
    expect(v.centro.lat).toBeGreaterThan(41.9);
    expect(v.centro.lat).toBeLessThan(45.5);
  });

  it('senza punti non c e vista, con un punto solo si avvicina senza esagerare', () => {
    expect(vistaPercorso([])).toBeNull();
    expect(vistaPercorso([{ lat: 44, lng: 11 }])!.zoom).toBe(15);
  });
});

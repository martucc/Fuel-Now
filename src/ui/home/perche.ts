import type { FuelKey } from '../../domain/raw';
import type { RankedStation, Riferimento } from '../../domain/ranking';
import { unitaConsumo } from '../../domain/units';
import { euro, numero, prezzo } from '../../lib/formato';
import { quantita } from '../kit/formatoUi';
import { unitaPrezzo } from '../prezzi/formatoPrezzi';

/**
 * Il conto del foglio «Perché», riga per riga. Viene dallo stesso calcolo
 * che ha deciso, quindi i numeri sono quelli della carta e della lista; e
 * nessuna riga smentisce un'altra.
 */
export interface Voce {
  etichetta: string;
  valore: string;
  nota?: string;
  forte?: boolean;
}

export interface OpzioniPerche {
  fuel: FuelKey;
  /** Il modello dell'auto usata per il conto, null se si usano i valori medi. */
  auto: string | null;
  /** «comunicato ieri alle 18:00»: l'eta del prezzo, gia scritta. */
  eta: string;
}

/** «2,40 €» o «− 2,40 €»: col meno tipografico, come le righe da togliere. */
function conSegno(v: number): string {
  return v < 0 ? `− ${euro(-v)}` : euro(v);
}

/**
 * Come si chiama il piu vicino, detto giusto: a volte ce ne sono di piu
 * vicini che non contano, col prezzo vecchio o col solo servito.
 */
export function nomeDelPiuVicino(rif: Riferimento): string {
  const vecchi = rif.piuVicini?.vecchi ?? 0;
  const alServito = rif.piuVicini?.alServito ?? 0;
  if (vecchi && alServito) return 'Il più vicino al self con un prezzo recente';
  if (vecchi) return 'Il più vicino con un prezzo recente';
  if (alServito) return 'Il più vicino al self';
  return 'Il più vicino a te';
}

/** Perche il pieno che faresti comunque e al servito: non c'e un self, o non conviene andarci. */
function notaServito(rif: Riferimento): string {
  if (!rif.alServito) return '';
  return rif.selfNonConviene
    ? ', al servito: il self più vicino è più in là e, contando strada e tempo, non conviene'
    : ', al servito, perché qui intorno un self non c’è';
}

function km(v: number): string {
  return `${numero(v, 1)} km`;
}

export function vociPerche(best: RankedStation, o: OpzioniPerche): Voce[] {
  const n = best.net;
  const rif = n.riferimento;
  const unita = unitaPrezzo(o.fuel);
  const p = (v: number) => `${prezzo(v)} ${unita}`;
  const voci: Voce[] = [];

  voci.push({
    etichetta: 'Pieno considerato',
    valore: quantita(n.liters, o.fuel),
    nota: o.auto ?? (o.fuel === 'metano' ? 'Bombole medie: scegli la tua auto nelle impostazioni' : 'Serbatoio medio: scegli la tua auto nelle impostazioni'),
  });
  voci.push({
    etichetta: best.alServito ? 'Prezzo qui, al servito' : 'Prezzo qui',
    valore: p(n.price),
    nota: best.alServito ? 'qui per questo carburante c’è solo il servito: è quello che paghi' : undefined,
  });

  const eQui = rif?.id === best.row.id;
  // Il «piu vicino» della riga qui sotto: il riferimento, o quello da cui ci si e spostati.
  const mostrato = rif?.vicinoCaro ?? rif;
  if (rif?.vicinoCaro) {
    const v = rif.vicinoCaro;
    voci.push({
      etichetta: nomeDelPiuVicino(rif),
      valore: p(v.price),
      nota: `a ${km(v.distanceKm)}: non è lì che faresti il pieno`,
    });
    voci.push({
      etichetta: 'Dove faresti il pieno comunque',
      valore: p(rif.price),
      nota: `a ${km(rif.distanceKm)}${eQui ? ', è questo' : ''}: poco più in là del più vicino e già più conveniente, contando strada e tempo${notaServito(rif)}`,
    });
  } else if (rif) {
    voci.push({
      etichetta: nomeDelPiuVicino(rif),
      valore: p(rif.price),
      nota: `a ${km(rif.distanceKm)}${eQui ? ', è questo' : ''}: è lì che faresti il pieno senza pensarci${notaServito(rif)}`,
    });
  } else {
    voci.push({ etichetta: 'Media della zona', valore: p(n.cohortAvg) });
  }

  voci.push({ etichetta: 'Risparmio sul carburante', valore: conSegno(n.gross) });
  if (n.confidence < 1 && n.gross > 0) {
    voci.push({
      etichetta: 'Prezzo non di oggi',
      valore: `× ${numero(n.confidence, 2)}`,
      nota: `comunicato ${o.eta}: il risparmio conta di meno`,
    });
  }

  const dove = rif ? 'il pieno che faresti comunque' : 'casa';
  voci.push({
    etichetta: 'Strada in più',
    valore: `− ${euro(n.roadCost)}`,
    nota:
      n.kmStrada > 0
        ? `circa ${km(n.kmStrada)} fra andata e ritorno oltre ${dove}, a ${numero(n.kml, 1)} ${unitaConsumo(o.fuel)}`
        : eQui
          ? 'nessuna: è qui che faresti il pieno comunque'
          : rif && best.distanceKm < rif.distanceKm
            ? 'nessuna: è più vicino del pieno che faresti comunque'
            : 'nessuna: è vicino quanto il pieno che faresti comunque',
  });
  voci.push({ etichetta: 'In tasca', valore: conSegno(n.net), forte: true });
  if (best.minutiInPiu >= 1) {
    // I minuti si contano dal piu vicino con un prezzo recente, servito
    // compreso: se non e quello della riga sopra, lo si dice.
    const daAltro = rif?.daKm !== undefined && mostrato !== undefined && rif.daKm < mostrato.distanceKm;
    voci.push({
      etichetta: 'Tempo in più',
      valore: `${numero(best.minutiInPiu, 0)} min`,
      nota: `andata e ritorno rispetto al più vicino${daAltro ? `, al servito, a ${km(rif.daKm!)}` : ''}: pesa nella scelta, non nel risparmio`,
    });
  }
  return voci;
}

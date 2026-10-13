import type { LatLng } from './geo';
import { haversineKm } from './geo';

/**
 * Il percorso vero verso casa, come lo restituisce il router: la spezzata
 * dei punti e la lunghezza stradale.
 *
 * Serve perche la deviazione stimata col triangolo (utente -> pompa -> casa
 * meno utente -> casa) e cieca su come gira la strada: una pompa dall'altra
 * parte del fiume risulta «sul percorso» perche in linea d'aria lo e, e una
 * pompa sulla tangenziale che fai comunque risulta una deviazione perche il
 * triangolo non sa che quella strada la percorri gia.
 */
export interface Percorso {
  /** Punti della spezzata, dal punto di partenza alla destinazione. */
  punti: LatLng[];
  /** Lunghezza stradale complessiva in km, dal router. */
  km: number;
}

export interface ProiezioneSuPercorso {
  /**
   * Distanza in linea d'aria fra la pompa e il punto piu vicino del percorso.
   * E la meta della deviazione: si esce e si rientra.
   */
  scostamentoKm: number;
  /** Quanto sei avanti sul percorso quando lasci la strada, da 0 a 1. */
  progresso: number;
  /** Km di percorso che restano da fare dopo il punto di uscita. */
  kmRimanenti: number;
}

const RAD = Math.PI / 180;
const R_KM = 6371;

/**
 * Proiezione equirettangolare locale, ancorata al primo punto del segmento.
 * Su distanze di pochi km l'errore e sotto il metro e ci risparmia una
 * haversine per ogni segmento di ogni pompa: il percorso ha centinaia di
 * punti e le pompe sono migliaia.
 */
function versoPiano(p: LatLng, origine: LatLng): { x: number; y: number } {
  return {
    x: (p.lng - origine.lng) * RAD * Math.cos(origine.lat * RAD) * R_KM,
    y: (p.lat - origine.lat) * RAD * R_KM,
  };
}

/** Distanza punto-segmento in km, e dove cade il piede della perpendicolare (0..1). */
function distanzaDalSegmento(
  punto: LatLng,
  a: LatLng,
  b: LatLng
): { km: number; t: number } {
  const pa = versoPiano(punto, a);
  const pb = versoPiano(b, a);

  const lung2 = pb.x * pb.x + pb.y * pb.y;
  if (lung2 === 0) {
    return { km: Math.hypot(pa.x, pa.y), t: 0 };
  }

  // Il piede della perpendicolare si tiene dentro il segmento: fuori non e
  // piu «di fianco a questo tratto», e a occuparsene sara il tratto accanto.
  const t = Math.max(0, Math.min(1, (pa.x * pb.x + pa.y * pb.y) / lung2));
  const dx = pa.x - t * pb.x;
  const dy = pa.y - t * pb.y;
  return { km: Math.hypot(dx, dy), t };
}

/**
 * Trova il punto del percorso piu vicino alla pompa.
 *
 * Restituisce anche il progresso perche una pompa a 200 m dal percorso ma
 * a due km da casa non e la stessa cosa di una a 200 m ma appena partito:
 * la prima la raggiungi col serbatoio ormai vuoto, e se il piano e «fai il
 * pieno tornando» conta arrivarci prima, non dopo.
 */
export function proiettaSuPercorso(percorso: Percorso, pompa: LatLng): ProiezioneSuPercorso {
  const punti = percorso.punti;
  if (punti.length === 0) {
    return { scostamentoKm: Infinity, progresso: 0, kmRimanenti: percorso.km };
  }
  if (punti.length === 1) {
    return { scostamentoKm: haversineKm(punti[0]!, pompa), progresso: 0, kmRimanenti: percorso.km };
  }

  // Lunghezze cumulate della spezzata: servono per il progresso, e sono in
  // linea d'aria fra punto e punto. Su una spezzata fitta coincidono con la
  // strada; la normalizzazione finale le riporta comunque sui km del router.
  let migliore = { km: Infinity, indice: 0, t: 0 };
  const cumulate: number[] = [0];

  for (let i = 0; i < punti.length - 1; i++) {
    const a = punti[i]!;
    const b = punti[i + 1]!;
    cumulate.push(cumulate[i]! + haversineKm(a, b));

    const d = distanzaDalSegmento(pompa, a, b);
    if (d.km < migliore.km) migliore = { km: d.km, indice: i, t: d.t };
  }

  const totale = cumulate[cumulate.length - 1]!;
  const percorsoFinoAQui =
    cumulate[migliore.indice]! +
    migliore.t * (cumulate[migliore.indice + 1]! - cumulate[migliore.indice]!);

  const progresso = totale > 0 ? percorsoFinoAQui / totale : 0;

  return {
    scostamentoKm: migliore.km,
    progresso,
    // I km del router sono quelli veri: la spezzata li sottostima sempre un po'.
    kmRimanenti: Math.max(0, percorso.km * (1 - progresso)),
  };
}

/**
 * Da scostamento a deviazione: si esce dal percorso e si rientra, quindi
 * il chilometraggio in piu e circa il doppio della distanza laterale.
 *
 * E una stima per difetto — la stradina di accesso non e mai perpendicolare
 * — ma sbaglia molto meno del triangolo, che su un percorso curvo puo dire
 * «zero deviazione» per una pompa che sta dall'altra parte della curva.
 */
export function deviazioneDaScostamento(scostamentoKm: number): number {
  return scostamentoKm * 2;
}

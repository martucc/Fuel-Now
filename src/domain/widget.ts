import type { HomeModel } from '../ui/home/homeModel';
import { ADVICE_LABEL } from '../ui/home/homeModel';
import type { FuelKey } from './raw';
import { LEVEL_LABEL } from './pricing';
import { describeAge } from './freshness';
import { prezzo, euro, chilometri } from '../lib/formato';

/**
 * Cosa il widget dice, deciso qui.
 *
 * Prima il widget si rifaceva il conto per suo conto — prezzo piu basso
 * entro venti chilometri — mentre la Home sceglieva per netto, scartava le
 * pompe geolocalizzate male e pesava la freschezza. Due schermi dello stesso
 * telefono indicavano due distributori diversi, e quello sbagliato era
 * sempre il widget, cioe quello che si guarda di corsa.
 *
 * Ora il widget non calcola niente: mostra il consiglio della Home, gia
 * fatto. Questo modulo lo traduce in stringhe italiane pronte da mettere in
 * pagina, perche il lato Android non sa ne il dominio ne la lingua.
 */

/** Sotto mezzo euro il risparmio non vale la riga che occupa. */
const RISPARMIO_MINIMO = 0.5;

const NOME_CARBURANTE: Record<FuelKey, string> = {
  benzina: 'Benzina',
  diesel: 'Diesel',
  gpl: 'GPL',
  metano: 'Metano',
};

/** Le chiavi sono il patto con MfNotte.java: cambiarle qui e la. */
export interface Istantanea {
  mf_w_prezzo: string;
  mf_w_livello: string;
  mf_w_dove: string;
  mf_w_scarto: string;
  mf_w_verdetto: string;
  mf_w_contesto: string;
  mf_w_eta: string;
  mf_w_lat: string;
  mf_w_lng: string;
  mf_w_scritto: string;
  /**
   * «casa» quando la Home sta ragionando sul rientro, «zona» altrimenti.
   *
   * Senza questo il widget tornerebbe al difetto che tutto questo file
   * esiste per togliere: la Home consiglia la pompa che ti allunga di un
   * chilometro tornando, il widget ne mostra un'altra scelta su un criterio
   * diverso, e quello sbagliato e sempre il widget, cioe quello che guardi
   * di corsa.
   */
  mf_w_modo: string;
  /** Destinazione finale, perche il widget possa navigare passando per la pompa. */
  mf_w_casa_lat: string;
  mf_w_casa_lng: string;
  /** Frase pronta per chi usa TalkBack: il widget letto ad alta voce. */
  mf_w_voce: string;
}

/** Tutto vuoto: il widget mostra «—» e invita ad aprire l'app. */
export function istantaneaVuota(quando: Date): Istantanea {
  return {
    mf_w_prezzo: '',
    mf_w_livello: '',
    mf_w_dove: '',
    mf_w_scarto: '',
    mf_w_verdetto: '',
    mf_w_contesto: '',
    mf_w_eta: '',
    mf_w_lat: '',
    mf_w_lng: '',
    mf_w_scritto: String(quando.getTime()),
    mf_w_modo: 'zona',
    mf_w_casa_lat: '',
    mf_w_casa_lng: '',
    mf_w_voce: 'Martucc Fuel: nessun prezzo ancora. Tocca per aprire l’app.',
  };
}

export function componiIstantanea(
  model: HomeModel | null,
  fuel: FuelKey,
  quando: Date
): Istantanea {
  const b = model?.best;
  if (!model || !b) return istantaneaVuota(quando);

  const inRientro = model.homeMode && b.detourKm !== undefined;

  // Tornando a casa la distanza da dove sei non e la domanda: quello che
  // vuoi sapere e di quanto ti allunga la strada.
  const contesto = inRientro
    ? `${NOME_CARBURANTE[fuel]} · +${chilometri(b.detourKm!, 1)} verso casa`
    : `${NOME_CARBURANTE[fuel]} · ${chilometri(b.distanceKm, 1)}`;

  return {
    mf_w_prezzo: prezzo(b.price),
    mf_w_livello: b.level,
    mf_w_dove: `${b.row.brand} · ${b.row.city || b.row.name}`,
    mf_w_scarto: scarto(model),
    mf_w_verdetto: ADVICE_LABEL[model.advice],
    mf_w_contesto: contesto,
    mf_w_eta: describeAge(b.ageH),
    mf_w_lat: String(b.row.lat),
    mf_w_lng: String(b.row.lng),
    mf_w_scritto: String(quando.getTime()),
    mf_w_modo: inRientro ? 'casa' : 'zona',
    mf_w_casa_lat: inRientro && model.homeLocation ? String(model.homeLocation.lat) : '',
    mf_w_casa_lng: inRientro && model.homeLocation ? String(model.homeLocation.lng) : '',
    mf_w_voce: voce(model, fuel, inRientro),
  };
}

/**
 * Il widget detto a voce, per TalkBack.
 *
 * Un widget fatto di numeri sparsi, letto da uno schermo, diventa «trattino,
 * uno virgola nove due nove, Tamoil punto Vimodrone»: tecnicamente tutto,
 * praticamente niente. Questa e la stessa cosa in una frase.
 */
function voce(model: HomeModel, fuel: FuelKey, inRientro: boolean): string {
  const b = model.best;
  if (!b) return 'Martucc Fuel: nessun prezzo ancora. Tocca per aprire l’app.';

  const dove = `${b.row.brand} a ${b.row.city || b.row.name}`;
  const quanto = `${NOME_CARBURANTE[fuel]} a ${prezzo(b.price)} euro al litro`;
  const strada = inRientro
    ? `ti allunga di ${chilometri(b.detourKm!, 1)} tornando a casa`
    : `a ${chilometri(b.distanceKm, 1)} da qui`;
  const giudizio = LEVEL_LABEL[b.level].toLowerCase();

  return `${quanto}, ${dove}, ${strada}. Prezzo ${giudizio}, aggiornato ${describeAge(b.ageH)}.`;
}

/**
 * La riga sotto il nome: il livello e, se c'e, quanto resta in tasca.
 * Quando la coorte e povera lo dice, invece di far passare per certo un
 * giudizio dato su quattro impianti.
 */
function scarto(model: HomeModel): string {
  const b = model.best;
  if (!b) return '';
  const livello = LEVEL_LABEL[b.level];
  if (!b.reliable) return `${livello} · pochi confronti`;
  if (b.net.net >= RISPARMIO_MINIMO) return `${livello} · ${euro(b.net.net)} in tasca`;
  return livello;
}

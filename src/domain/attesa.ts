import type { ForecastView } from './forecast';
import { adviceOfTheDay } from './forecast';
import type { PriceLevel } from './pricing';
import type { RitmoSettimanale } from './settimana';
import { centesimiCirca } from './andamento';
import { euro, numero } from '../lib/formato';

/**
 * «Conviene aspettare a fare il pieno?», detto in italiano.
 *
 * La decisione resta quella di `adviceOfTheDay`, la stessa regola della
 * previsione in tutta l'app; qui si sceglie solo come dirla. Le frasi di
 * `forecast.ts` scrivono i numeri col punto («1.2 cent»): in una schermata
 * italiana sono un altro numero, per questo il testo si compone qui con
 * `lib/formato`.
 *
 * Ogni cifra viene dalla previsione del backend. Se la previsione non e
 * affidabile non compare nessun numero sul futuro.
 */

export type VersoAttesa = 'aspetta' | 'ora' | 'indifferente' | 'incerto';

export interface RispostaAttesa {
  /** La risposta secca: «Sì», «No», «Non si può dire». */
  titolo: string;
  testo: string;
  verso: VersoAttesa;
  /** Euro in gioco su un pieno, quando la previsione regge. Positivo = si risparmia aspettando. */
  euroPieno: number | null;
}

export interface AttesaInput {
  forecast: ForecastView | null;
  /** Il livello del distributore consigliato vicino, se c'e. */
  bestLevel: PriceLevel | null;
  /** Litri di un pieno tipico. */
  litri: number;
}

function quando(giorni: number): string {
  const g = Math.max(1, Math.round(giorni));
  return g === 1 ? 'entro domani' : `nei prossimi ${g} giorni`;
}

function suUnPieno(f: ForecastView, litri: number): string {
  const e = (Math.abs(f.deltaC) / 100) * litri;
  // Sotto i dieci centesimi il conto in euro e rumore: si dice e basta.
  if (e < 0.1) return '';
  return ` Su un pieno da ${numero(litri, 0)} litri sono circa ${euro(e)}.`;
}

export function convieneAspettare(i: AttesaInput): RispostaAttesa {
  const f = i.forecast && i.forecast.usable ? i.forecast : null;
  const { advice } = adviceOfTheDay({ bestLevel: i.bestLevel, forecast: i.forecast, tankPct: null });
  const euroPieno = f ? (-f.deltaC / 100) * i.litri : null;

  if (advice === 'URGENT') {
    return { titolo: 'Fai rifornimento ora', testo: 'Sei in riserva: conta arrivarci, non risparmiare.', verso: 'ora', euroPieno: null };
  }

  if (advice === 'TEN-EURO' && f) {
    return {
      titolo: 'Sì, se puoi aspettare',
      testo:
        `I prezzi sono attesi in calo di ${centesimiCirca(f.deltaC)} al litro ${quando(f.daysAhead)}. ` +
        `Metti solo quello che ti serve e fai il pieno più avanti.${suUnPieno(f, i.litri)}`,
      verso: 'aspetta',
      euroPieno,
    };
  }

  if (advice === 'FILL-FULL' && f && f.direction === 'up') {
    return {
      titolo: 'No, meglio fare il pieno ora',
      testo:
        `I prezzi sono attesi in salita di ${centesimiCirca(f.deltaC)} al litro ${quando(f.daysAhead)}: ` +
        `aspettare costerebbe di più.${suUnPieno(f, i.litri)}`,
      verso: 'ora',
      euroPieno,
    };
  }

  if (advice === 'FILL-FULL') {
    // Il motivo e il prezzo di oggi qui vicino, non il futuro.
    const dopo = f
      ? ' Per i prossimi giorni non sono attesi cali.'
      : ' Per i prossimi giorni non c’è una previsione affidabile.';
    return {
      titolo: 'No, approfitta di oggi',
      testo: `Qui vicino c’è un prezzo ben sotto la media della zona.${dopo}`,
      verso: 'ora',
      euroPieno: null,
    };
  }

  if (!f) {
    return {
      titolo: 'Non si può dire',
      testo: 'Nessuna previsione affidabile per i prossimi giorni. Fai il pieno quando ti serve, dove costa meno.',
      verso: 'incerto',
      euroPieno: null,
    };
  }

  if (f.direction === 'down' && Math.abs(f.deltaC) >= 0.05) {
    // In calo, ma con una fiducia sotto la soglia per consigliare l'attesa.
    return {
      titolo: 'Non vale la pena aspettare',
      testo:
        `I prezzi potrebbero scendere di ${centesimiCirca(f.deltaC)} ${quando(f.daysAhead)}, ` +
        'ma la previsione è incerta. Fai il pieno quando ti serve.',
      verso: 'indifferente',
      euroPieno: null,
    };
  }

  return {
    titolo: 'Non serve aspettare',
    testo: `I prezzi dovrebbero restare stabili ${quando(f.daysAhead)}. Fai il pieno quando ti serve, dove costa meno.`,
    verso: 'indifferente',
    euroPieno: null,
  };
}

const ARTICOLO: Record<number, string> = { 0: 'la' };

/**
 * «Di solito il giorno più economico è il lunedì…», solo quando il ritmo
 * settimanale e significativo (vedi `settimana.ts`). Altrimenti null: la
 * schermata non mostra la riga invece di spacciare rumore per consiglio.
 */
export function fraseGiornoMigliore(r: RitmoSettimanale): string | null {
  const g = r.migliore;
  if (!r.significativo || !g) return null;
  const articolo = ARTICOLO[g.giorno] ?? 'il';
  return `Di solito il giorno più economico è ${articolo} ${g.nome}: ${centesimiCirca(g.scartoC)} sotto la media della settimana.`;
}

/** «Affidabilità alta» e simili, per dire quanto pesa la previsione senza un numero finto. */
export function affidabilita(f: ForecastView | null): string | null {
  if (!f || !f.usable) return null;
  if (f.confidence >= 0.7) return 'alta';
  if (f.confidence >= 0.5) return 'media';
  return 'bassa';
}

import type { FuelKey } from './raw';
import { FUEL_LABEL } from './fuel';

/**
 * Il dossier che accompagna ogni domanda al modello.
 *
 * Prima qui passava una riga sola — media, minimo, spread — e il modello
 * rispondeva da manuale di economia invece che sulla situazione di chi
 * chiede. Un contesto povero non si corregge col prompt: si corregge coi
 * dati. Vive in domain/ perche e logica pura e va provata senza browser.
 */

export interface ContestoIa {
  fuel: FuelKey;
  /** Prezzi confrontabili nella zona dell'utente. */
  zona: { media: number; minimo: number; massimo: number; campione: number } | null;
  /** Il distributore che l'app consiglia adesso. */
  consigliato: {
    nome: string;
    prezzo: number;
    km: number;
    /** Risparmio netto stimato sul pieno, detratto il carburante del giro. */
    risparmioEur?: number;
  } | null;
  /** Media nazionale giorno per giorno, dal piu vecchio al piu recente. */
  storico: { date: string; price: number }[];
  news: { title?: string; impact?: string }[];
  auto: { modello: string; serbatoioL?: number; kml?: number; kmlReale?: number } | null;
  budget: { mensile: number; speso: number; giorniRimasti: number } | null;
  /** Come sta la zona rispetto al paese e ai suoi stessi marchi. */
  mercato?: {
    prov: string | null;
    deltaZonaItaliaC: number | null;
    spreadC: number | null;
    autostradaC: number | null;
    servitoC: number | null;
    marchiEconomici: { brand: string; avg: number }[];
    frescoSuTotale: [number, number] | null;
  } | null;
}

const PUNTI_STORICO = 14;

function euro(v: number, d = 3) {
  return `€${v.toFixed(d)}`;
}

/** Variazione percentuale fra il primo e l'ultimo punto della serie. */
export function variazioneStorico(storico: { price: number }[]): number | null {
  if (storico.length < 2) return null;
  const primo = storico[0]?.price;
  const ultimo = storico[storico.length - 1]?.price;
  if (!primo || !ultimo) return null;
  return ((ultimo - primo) / primo) * 100;
}

export function buildAiContext(c: ContestoIa): string {
  const righe: string[] = [];

  righe.push(`Carburante in esame: ${FUEL_LABEL[c.fuel]}.`);

  if (c.zona && c.zona.campione > 0) {
    righe.push(
      `Prezzi nella zona dell'utente su ${c.zona.campione} distributori: ` +
        `media ${euro(c.zona.media)}, minimo ${euro(c.zona.minimo)}, massimo ${euro(c.zona.massimo)}, ` +
        `forbice ${((c.zona.massimo - c.zona.minimo) * 100).toFixed(1)} centesimi al litro.`
    );
  } else {
    righe.push("Nessun prezzo confrontabile nella zona dell'utente: non dedurre valori locali.");
  }

  if (c.consigliato) {
    const risparmio =
      c.consigliato.risparmioEur != null && c.consigliato.risparmioEur > 0
        ? `, risparmio netto stimato ${c.consigliato.risparmioEur.toFixed(2)} euro sul pieno gia detratto il carburante del giro`
        : '';
    righe.push(
      `L'app gli consiglia ${c.consigliato.nome} a ${euro(c.consigliato.prezzo)} ` +
        `a ${c.consigliato.km.toFixed(1)} km${risparmio}.`
    );
  }

  if (c.storico.length > 0) {
    const coda = c.storico.slice(-PUNTI_STORICO);
    const variazione = variazioneStorico(c.storico);
    righe.push(
      `Media nazionale, ultimi ${coda.length} rilevamenti dal piu vecchio: ` +
        coda.map((p) => `${p.date} ${euro(p.price)}`).join(', ') + '.'
    );
    if (variazione != null) {
      righe.push(
        `Sull'intero periodo fornito la media nazionale e ${variazione >= 0 ? 'salita' : 'scesa'} del ` +
          `${Math.abs(variazione).toFixed(1)}%.`
      );
    }
  } else {
    righe.push('Storico nazionale non disponibile: non inventare andamenti passati.');
  }

  if (c.auto) {
    const consumo =
      c.auto.kmlReale != null
        ? `consumo reale misurato sui suoi pieni ${c.auto.kmlReale.toFixed(1)} km/l`
        : c.auto.kml != null
          ? `consumo dichiarato ${c.auto.kml.toFixed(1)} km/l`
          : 'consumo sconosciuto';
    const serbatoio = c.auto.serbatoioL ? `, serbatoio ${c.auto.serbatoioL} litri` : '';
    righe.push(`Auto dell'utente: ${c.auto.modello}, ${consumo}${serbatoio}.`);
  }

  if (c.budget && c.budget.mensile > 0) {
    const resta = c.budget.mensile - c.budget.speso;
    righe.push(
      `Si e dato un tetto di ${c.budget.mensile.toFixed(0)} euro al mese, ne ha spesi ` +
        `${c.budget.speso.toFixed(2)} e gli restano ${resta.toFixed(2)} euro per ${c.budget.giorniRimasti} giorni.`
    );
  }

  const mercato = c.mercato;
  if (mercato) {
    if (mercato.deltaZonaItaliaC !== null) {
      const verso = mercato.deltaZonaItaliaC > 0 ? 'piu cara' : 'piu economica';
      righe.push(
        `La ${mercato.prov ? `provincia di ${mercato.prov}` : 'sua zona'} e ${verso} della media italiana di ` +
          `${Math.abs(mercato.deltaZonaItaliaC).toFixed(1)} centesimi al litro.`
      );
    }
    if (mercato.spreadC !== null) {
      righe.push(
        `Fra l'impianto piu caro e il piu economico che puo raggiungere ballano ` +
          `${mercato.spreadC.toFixed(1)} centesimi al litro.`
      );
    }
    if (mercato.autostradaC !== null) {
      righe.push(`In autostrada, nella sua zona, si paga ${mercato.autostradaC.toFixed(1)} centesimi in piu.`);
    }
    if (mercato.servitoC !== null) {
      righe.push(`Il servito costa ${mercato.servitoC.toFixed(1)} centesimi al litro piu del self.`);
    }
    if (mercato.marchiEconomici.length > 0) {
      righe.push(
        'Marchi piu economici in zona: ' +
          mercato.marchiEconomici
            .slice(0, 3)
            .map((m) => `${m.brand} (${euro(m.avg)})`)
            .join(', ') + '.'
      );
    }
    if (mercato.frescoSuTotale) {
      const [recenti, totale] = mercato.frescoSuTotale;
      righe.push(`Prezzi comunicati nelle ultime 48 ore: ${recenti} impianti su ${totale}.`);
    }
  }

  const notizie = c.news.filter((n) => n.title);
  if (notizie.length > 0) {
    righe.push(
      'Notizie recenti: ' +
        notizie
          .slice(0, 4)
          .map((n) => `[${(n.impact || 'neutro').toLowerCase()}] ${n.title}`)
          .join(' | ') +
        '.'
    );
  }

  return righe.join('\n');
}

import type { MarketAnalysis } from '../types';

interface HistoryPt { date: string; price: number }
interface NewsItem { title?: string; summary?: string; impact?: string; source?: string }

/** Oltre questo tempo non e piu una risposta, e un'attesa. */
const TIMEOUT_MS = 25_000;

/**
 * Errori con un codice, non solo un messaggio: la schermata deve poter
 * dire "la chiave e sbagliata" invece di "errore" per ogni caso.
 */
export type CodiceErroreIa = 'MISSING_KEY' | 'BAD_KEY' | 'QUOTA' | 'NETWORK' | 'TIMEOUT' | 'PARSE' | 'UNKNOWN';

export class ErroreIa extends Error {
  readonly codice: CodiceErroreIa;

  constructor(codice: CodiceErroreIa, messaggio: string) {
    super(messaggio);
    this.name = 'ErroreIa';
    this.codice = codice;
  }
}

export const MESSAGGIO_ERRORE: Record<CodiceErroreIa, string> = {
  MISSING_KEY: 'Manca la chiave Gemini nelle impostazioni.',
  BAD_KEY: 'La chiave Gemini non è valida: controllala nelle impostazioni.',
  QUOTA: 'Hai finito le richieste gratuite di Gemini per oggi.',
  NETWORK: 'Non riesco a raggiungere Gemini: controlla la connessione.',
  TIMEOUT: 'Gemini ci sta mettendo troppo. Riprova fra un momento.',
  PARSE: 'Gemini ha risposto in un formato che non so leggere.',
  UNKNOWN: 'Gemini non è disponibile in questo momento.',
};

function classifica(e: unknown): CodiceErroreIa {
  const testo = String((e instanceof Error ? e.message : e) || '').toLowerCase();
  if (testo.includes('api key') || testo.includes('api_key') || testo.includes('permission') || testo.includes('401') || testo.includes('403')) return 'BAD_KEY';
  if (testo.includes('quota') || testo.includes('resource_exhausted') || testo.includes('429')) return 'QUOTA';
  if (testo.includes('fetch') || testo.includes('network') || testo.includes('failed to fetch')) return 'NETWORK';
  return 'UNKNOWN';
}

const ISTRUZIONI = [
  "Sei l'analista di MartuccFuel, l'app italiana che dice all'automobilista dove conviene fare benzina.",
  'Parli italiano corrente, diretto, come un amico che se ne intende. Mai gergo militare, mai maiuscolo enfatico, mai «trattasi di».',
  'Usi solo i dati del dossier che ti viene dato. Se un numero non c e, lo dici invece di inventarlo.',
  'Le cifre le riporti come stanno nel dossier: non arrotondare i prezzi al litro.',
  'Le previsioni le ricavi dallo storico fornito: in condizioni normali non piu del 2% di variazione su sette giorni.',
  'Tieni conto di accise italiane, brent, cambio euro-dollaro, stagionalita e delle notizie del dossier.',
  "Se l'utente ha un budget o un'auto nel dossier, la risposta parla dei suoi numeri, non di quelli medi.",
].join(' ');

const SCHEMA_RISPOSTA = {
  type: 'object',
  properties: {
    advice: { type: 'string', enum: ['FILL-FULL', 'WAIT', 'TEN-EURO', 'URGENT'] },
    reasoning: { type: 'string' },
    detailedReport: { type: 'string' },
    trend: { type: 'string', enum: ['UP', 'DOWN', 'STABLE'] },
    categories: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['title', 'content'],
      },
    },
    tips: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          text: { type: 'string' },
          impact: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
        },
        required: ['title', 'text', 'impact'],
      },
    },
    forecast: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string' },
          price: { type: 'number' },
        },
        required: ['date', 'price'],
      },
    },
  },
  required: ['advice', 'reasoning', 'detailedReport', 'trend'],
} as const;

function promptDomanda(fuel: string, domanda: string, dossier: string) {
  return [
    `L'utente chiede, a proposito del ${fuel}: "${domanda}"`,
    '',
    'Dossier con i dati veri di adesso:',
    dossier,
    '',
    'Rispondigli.',
    '- reasoning: la risposta secca, una o due frasi, quella che leggerebbe al semaforo.',
    '- detailedReport: due o tre paragrafi che spiegano il perche, con i numeri del dossier.',
    '- advice e trend: coerenti con quello che hai detto.',
    '- categories, tips e forecast: lasciali vuoti, qui serve solo la risposta.',
  ].join('\n');
}

function promptBriefing(fuel: string, dossier: string) {
  return [
    `Analisi di oggi per il ${fuel} in Italia.`,
    '',
    'Dossier con i dati veri di adesso:',
    dossier,
    '',
    'Produci:',
    '- reasoning: cosa conviene fare oggi, una o due frasi motivate dai numeri.',
    '- detailedReport: tre o quattro paragrafi separati da a capo — quadro internazionale, situazione italiana, cosa aspettarsi nei prossimi sette giorni, cosa fare in pratica.',
    '- categories: tre voci, titolo breve e una o due frasi (contesto internazionale, mercato italiano, prossimi giorni).',
    '- tips: tre consigli concreti con impatto HIGH, MEDIUM e LOW.',
    '- forecast: sette punti, uno al giorno, etichettati +1g ... +7g, coerenti con lo storico.',
    '- advice e trend.',
  ].join('\n');
}

export async function analyzeFuelMarket(
  apiKey: string,
  model: string,
  fuelType: string = 'Benzina',
  question?: string,
  dossier?: string,
  historySeries?: HistoryPt[],
  news?: NewsItem[],
): Promise<MarketAnalysis> {
  if (!apiKey || apiKey.trim().length === 0) {
    throw new ErroreIa('MISSING_KEY', MESSAGGIO_ERRORE.MISSING_KEY);
  }

  // Chi chiama passa gia il dossier completo; storico e news restano
  // accettati perche i vecchi punti di chiamata li passano ancora sciolti.
  const extra: string[] = [];
  if (!dossier && historySeries?.length) {
    extra.push(
      `Media nazionale, ultimi ${Math.min(12, historySeries.length)} rilevamenti: ` +
        historySeries.slice(-12).map((p) => `${p.date} €${p.price.toFixed(3)}`).join(', ') + '.'
    );
  }
  if (!dossier && news?.length) {
    extra.push(
      'Notizie recenti: ' +
        news.slice(0, 4).map((n) => `[${(n.impact || 'neutro').toLowerCase()}] ${n.title || ''}`).join(' | ') + '.'
    );
  }
  const contesto = [dossier, ...extra].filter(Boolean).join('\n') || 'Nessun dato disponibile.';

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const richiesta = ai.models.generateContent({
    model: model || 'gemini-2.5-flash',
    contents: question ? promptDomanda(fuelType, question, contesto) : promptBriefing(fuelType, contesto),
    config: {
      systemInstruction: ISTRUZIONI,
      // Lo schema toglie di mezzo il parsing a naso: il modello non puo
      // rispondere in prosa, quindi non serve piu ripescare le graffe.
      responseMimeType: 'application/json',
      responseSchema: SCHEMA_RISPOSTA,
      temperature: question ? 0.4 : 0.7,
    },
  });

  let response: { text?: string } | undefined;
  try {
    response = await Promise.race<{ text?: string }>([
      richiesta,
      new Promise((_, rifiuta) =>
        setTimeout(() => rifiuta(new ErroreIa('TIMEOUT', MESSAGGIO_ERRORE.TIMEOUT)), TIMEOUT_MS)
      ),
    ]);
  } catch (e: unknown) {
    if (e instanceof ErroreIa) throw e;
    const codice = classifica(e);
    throw new ErroreIa(codice, MESSAGGIO_ERRORE[codice]);
  }

  const testo = (response?.text || '').trim();
  const parsed = estraiJson(testo);
  if (!parsed || typeof parsed !== 'object') throw new ErroreIa('PARSE', MESSAGGIO_ERRORE.PARSE);

  return normalizza(parsed);
}

/** Con responseSchema il testo e gia JSON; il resto e rete di sicurezza. */
export function estraiJson(testo: string): unknown {
  if (!testo) return null;
  const candidati = [testo];
  const dentroBacktick = testo.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (dentroBacktick?.[1]) candidati.unshift(dentroBacktick[1]);
  const prima = testo.indexOf('{');
  const ultima = testo.lastIndexOf('}');
  if (prima >= 0 && ultima > prima) candidati.push(testo.slice(prima, ultima + 1));

  for (const c of candidati) {
    try {
      return JSON.parse(c.trim());
    } catch {
      /* prova il prossimo */
    }
  }
  return null;
}

export function normalizza(parsed: unknown): MarketAnalysis {
  const analisi = parsed as MarketAnalysis;
  if (!Array.isArray(analisi.categories)) analisi.categories = [];
  if (!Array.isArray(analisi.tips)) analisi.tips = [];
  if (!Array.isArray(analisi.forecast)) analisi.forecast = [];
  if (!Array.isArray(analisi.historicalData)) analisi.historicalData = [];
  if (!analisi.trend) analisi.trend = 'STABLE';
  if (!analisi.advice) analisi.advice = 'FILL-FULL' as MarketAnalysis['advice'];
  analisi.reasoning = analisi.reasoning || '';
  analisi.detailedReport = analisi.detailedReport || '';
  // Un prezzo previsto che non e un numero e peggio di un prezzo assente.
  analisi.forecast = analisi.forecast.filter((f) => Number.isFinite(f?.price) && f.price > 0);
  return analisi;
}

/**
 * Prova la chiave con la domanda piu piccola possibile.
 * Serve a distinguere «chiave sbagliata» da «oggi Gemini non risponde»
 * senza far spendere un'analisi intera all'utente.
 */
export async function provaChiave(apiKey: string, model: string): Promise<{ ok: true } | { ok: false; codice: CodiceErroreIa; messaggio: string }> {
  if (!apiKey || apiKey.trim().length === 0) {
    return { ok: false, codice: 'MISSING_KEY', messaggio: MESSAGGIO_ERRORE.MISSING_KEY };
  }
  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const risposta = await Promise.race<{ text?: string }>([
      ai.models.generateContent({
        model: model || 'gemini-2.5-flash',
        contents: 'Rispondi solo con: ok',
      }),
      new Promise((_, rifiuta) => setTimeout(() => rifiuta(new ErroreIa('TIMEOUT', MESSAGGIO_ERRORE.TIMEOUT)), 12_000)),
    ]);
    if (!risposta?.text) {
      return { ok: false, codice: 'UNKNOWN', messaggio: MESSAGGIO_ERRORE.UNKNOWN };
    }
    return { ok: true };
  } catch (e: unknown) {
    const codice = e instanceof ErroreIa ? e.codice : classifica(e);
    return { ok: false, codice, messaggio: MESSAGGIO_ERRORE[codice] };
  }
}

export interface ModelloIa {
  id: string;
  nome: string;
  nota: string;
}

/**
 * I modelli di ripiego: quelli che si mostrano senza chiave, o se la
 * chiamata alla lista non riesce.
 *
 * Deliberatamente corta e vecchia. Google pubblica modelli nuovi ogni pochi
 * mesi e una lista scritta a mano invecchia peggio di quanto aiuti: prima
 * qui dentro c'erano sigle mai esistite, e chi le sceglieva prendeva un
 * errore senza capire perche. La lista vera la chiede chiediModelli.
 */
export const MODELLI_DI_RIPIEGO: ModelloIa[] = [
  { id: 'gemini-2.5-flash', nome: 'Gemini 2.5 Flash', nota: 'Il più equilibrato, consigliato' },
  { id: 'gemini-2.5-pro', nome: 'Gemini 2.5 Pro', nota: 'Risponde meglio, ci mette di più' },
  { id: 'gemini-2.5-flash-lite', nome: 'Gemini 2.5 Flash-Lite', nota: 'Il più veloce e leggero' },
  { id: 'gemini-2.0-flash', nome: 'Gemini 2.0 Flash', nota: 'Se le altre danno errore' },
];

/** Sigle che non hanno senso qui: immagini, audio, incorporamenti, conteggi. */
const DA_SCARTARE = /embedding|aqa|image|imagen|veo|tts|audio|native-audio|live-/i;

function nomeLeggibile(id: string, display?: string): string {
  if (display && display.trim()) return display.trim();
  return id
    .replace(/^models\//, '')
    .replace(/-/g, ' ')
    .replace(/\bgemini\b/i, 'Gemini');
}

/**
 * Chiede a Google quali modelli sono davvero disponibili per questa chiave.
 *
 * E l'unica fonte che non invecchia: la lista cambia quando Google la
 * cambia, non quando qualcuno si ricorda di aggiornare l'app. Tiene solo
 * chi sa generare testo, perche e l'unica cosa che l'app gli chiede.
 */
export async function chiediModelli(apiKey: string): Promise<ModelloIa[]> {
  if (!apiKey || apiKey.trim().length === 0) return MODELLI_DI_RIPIEGO;

  try {
    const risposta = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey.trim())}&pageSize=200`
    );
    if (!risposta.ok) return MODELLI_DI_RIPIEGO;

    /** Solo i campi che ci servono: il resto della risposta non ci riguarda. */
    interface ModelloGrezzo {
      name?: string;
      displayName?: string;
      description?: string;
      supportedGenerationMethods?: string[];
    }

    const dati: { models?: ModelloGrezzo[] } = await risposta.json();
    const grezzi: ModelloGrezzo[] = Array.isArray(dati?.models) ? dati.models : [];

    const modelli = grezzi
      .filter((m) => Array.isArray(m?.supportedGenerationMethods)
        ? m.supportedGenerationMethods.includes('generateContent')
        : true)
      .map((m) => String(m?.name || '').replace(/^models\//, ''))
      .filter((id) => id.startsWith('gemini') && !DA_SCARTARE.test(id))
      .map((id) => {
        const grezzo = grezzi.find((m) => String(m?.name || '').endsWith(id));
        return {
          id,
          nome: nomeLeggibile(id, grezzo?.displayName),
          nota: String(grezzo?.description || '').split('.')[0] || 'Disponibile con la tua chiave',
        };
      });

    // Più recenti in cima: le sigle ordinano male da sole (3.10 finirebbe
    // prima di 3.7), quindi si ordina sul numero di versione.
    modelli.sort((a, b) => versione(b.id) - versione(a.id) || a.id.localeCompare(b.id));

    return modelli.length > 0 ? modelli : MODELLI_DI_RIPIEGO;
  } catch {
    return MODELLI_DI_RIPIEGO;
  }
}

function versione(id: string): number {
  const m = /gemini-(\d+)(?:\.(\d+))?/.exec(id);
  if (!m) return 0;
  return Number(m[1]) * 100 + Number(m[2] ?? 0);
}

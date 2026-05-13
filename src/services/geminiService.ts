import type { MarketAnalysis } from '../types';

interface HistoryPt { date: string; price: number; }
interface NewsItem { title?: string; summary?: string; impact?: string; source?: string; }

export async function analyzeFuelMarket(
  apiKey: string,
  model: string,
  fuelType: string = 'Benzina',
  question?: string,
  localContext?: string,
  historySeries?: HistoryPt[],
  news?: NewsItem[],
): Promise<MarketAnalysis> {
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('MISSING_KEY');
  }

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  // === System instruction: identita, ruolo, regole costanti ===
  const systemInstruction = [
    "Sei l'analista AI di MartuccFuel, app italiana per i prezzi dei carburanti.",
    "Rispondi sempre in italiano, tono professionale ma diretto e accessibile, mai 'military' o iper-formale.",
    "Lavora SOLO sui dati reali forniti nel prompt utente: media, min, spread, storico, news. Non inventare numeri.",
    "Quando manca un dato, dichiaralo invece di tirarlo a indovinare.",
    "Output esclusivamente JSON valido. Nessun markdown, nessun testo prima o dopo, nessun backtick.",
    "Le previsioni devono essere coerenti col trend recente: estrapola dallo storico, non saltare di colpo.",
    "Considera fattori reali: accise IT, prezzo brent, cambio EUR/USD, stagionalita, raffinazione europea, news fornite.",
  ].join(' ');

  // === Compact history + news context ===
  const histLine = historySeries && historySeries.length > 0
    ? `Storico (${historySeries.length} punti, eta crescente): ${historySeries.slice(-12).map(p => `${p.date}=€${p.price.toFixed(3)}`).join(', ')}.`
    : '';
  const newsLine = news && news.length > 0
    ? `News recenti (impatto): ${news.slice(0, 4).map(n => `[${(n.impact || 'neutral').toLowerCase()}] ${n.title || ''}`).join(' | ')}.`
    : '';
  const ctx = [localContext, histLine, newsLine].filter(Boolean).join(' ');

  // === Prompt domanda: schema LEAN per risparmiare tokens ===
  const userPrompt = question
    ? `Domanda dell'utente sul carburante ${fuelType}: "${question}".
${ctx ? 'Contesto: ' + ctx : ''}

Rispondi all'utente in modo conciso e utile, basandoti sui dati forniti.
Output JSON con questa struttura ESATTA (nessun campo extra):
{
  "advice": "FILL-FULL" | "WAIT" | "TEN-EURO" | "URGENT",
  "reasoning": "Risposta breve diretta in 1-2 frasi",
  "detailedReport": "Risposta approfondita in 2-4 paragrafi separati da \\n",
  "trend": "UP" | "DOWN" | "STABLE",
  "categories": [],
  "tips": [],
  "forecast": []
}`
    : `Briefing giornaliero per ${fuelType} in Italia.
${ctx ? 'Contesto: ' + ctx : ''}

Genera l'analisi completa. Tono professionale, sintetico, italiano corrente.
Output JSON con questa struttura ESATTA:
{
  "advice": "FILL-FULL" | "WAIT" | "TEN-EURO" | "URGENT",
  "reasoning": "Cosa fare oggi in 1-2 frasi, motivato dai dati",
  "detailedReport": "3-4 paragrafi separati da \\n: (1) contesto macro (brent, EUR/USD, geopolitica), (2) situazione Italia (accise, distribuzione, MIMIT), (3) outlook 7 giorni, (4) consiglio operativo per l'automobilista. Cita numeri reali dal contesto quando possibile.",
  "categories": [
    {"title": "Macro", "content": "1-2 frasi su petrolio, cambio, geopolitica", "icon": "Globe"},
    {"title": "Mercato Italia", "content": "1-2 frasi su accise, logistica, prezzi MIMIT", "icon": "MapPin"},
    {"title": "Outlook 7G", "content": "1-2 frasi sulla direzione attesa", "icon": "Calendar"}
  ],
  "tips": [
    {"title": "Titolo breve", "text": "Consiglio concreto", "impact": "HIGH"},
    {"title": "Titolo breve", "text": "Consiglio concreto", "impact": "MEDIUM"},
    {"title": "Titolo breve", "text": "Consiglio concreto", "impact": "LOW"}
  ],
  "trend": "UP" | "DOWN" | "STABLE",
  "forecast": [
    {"date": "+1g", "price": 0.000},
    {"date": "+2g", "price": 0.000},
    {"date": "+3g", "price": 0.000},
    {"date": "+4g", "price": 0.000},
    {"date": "+5g", "price": 0.000},
    {"date": "+6g", "price": 0.000},
    {"date": "+7g", "price": 0.000}
  ]
}
Il forecast deve essere coerente con lo storico fornito: massimo ±2% di delta totale su 7 giorni in condizioni normali.`;

  try {
    const response = await ai.models.generateContent({
      model: model || 'gemini-2.5-flash',
      contents: userPrompt,
      config: { systemInstruction },
    } as any);

    const text = (response as any).text || '';
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
    let jsonStr = (jsonMatch[1] || text).trim();

    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace >= 0) {
      jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(jsonStr) as MarketAnalysis;

    // Safety: garantisci sempre array vuoti se l'AI omette
    if (!Array.isArray(parsed.categories)) parsed.categories = [];
    if (!Array.isArray(parsed.tips)) parsed.tips = [];
    if (!Array.isArray(parsed.forecast)) parsed.forecast = [];

    return parsed;
  } catch (error: any) {
    console.error('Gemini API error:', error);
    throw new Error('Errore API Gemini: ' + (error.message || 'Sconosciuto'));
  }
}

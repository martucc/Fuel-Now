import type { MarketAnalysis } from '../types';

export async function analyzeFuelMarket(
  apiKey: string,
  model: string,
  fuelType: string = 'Benzina',
  question?: string,
  localContext?: string
): Promise<MarketAnalysis> {
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('MISSING_KEY');
  }

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const ctx = localContext ? `Contesto dati locali attuali: ${localContext}. ` : '';

  const prompt = question
    ? `Sei un analista senior del mercato energetico e carburanti in Italia (Signal AI). Rispondi alla domanda dell'utente: "${question}".
Contesto carburante analizzato: ${fuelType}.
${ctx}
Fornisci una risposta analitica, tattica e altamente professionale. Non usare markdown fuori dal JSON.
Rispondi in formato JSON valido con questa struttura esatta:
{
  "advice": "FILL-FULL" | "WAIT" | "TEN-EURO" | "URGENT",
  "reasoning": "Sintesi di 1-2 frasi della risposta alla domanda",
  "detailedReport": "Risposta approfondita e dettagliata alla domanda, divisa in più frasi fluenti",
  "categories": [{"title":"Analisi Domanda","content":"...","icon":"Globe"}],
  "tips": [{"title":"...","text":"...","impact":"HIGH"}],
  "trend": "UP" | "DOWN" | "STABLE",
  "historicalData": [{"date":"-2g","price":1.800}],
  "forecast": [{"date":"+1g","price":1.800}]
}`
    : `Sei l'Intelligenza Artificiale "Signal Core" integrata in "MartuccFuel", un'app premium e tattica per l'analisi dei carburanti in Italia.
La tua missione è fornire il briefing operativo giornaliero per il carburante: ${fuelType}.
Considera le macro-dinamiche globali (prezzo petrolio brent, tensioni geopolitiche, cambio EUR/USD, raffinazione europea) e la situazione locale in Italia.
${ctx}
Lo stile del report deve essere professionale, sintetico, "military/tactical" (usando termini come 'Briefing', 'Outlook', 'Target') ma estremamente chiaro.

Rispondi in formato JSON valido con questa struttura esatta:
{
  "advice": "FILL-FULL" | "WAIT" | "TEN-EURO" | "URGENT",
  "reasoning": "Spiegazione tattica immediata in 1-2 frasi sul perché agire o aspettare oggi",
  "detailedReport": "Report di mercato esteso (3-4 paragrafi) che analizza i fattori globali, l'impatto sul mercato italiano e le prospettive a breve termine per il ${fuelType}.",
  "categories": [
    {"title":"Scenario Macro","content":"Contesto geopolitico e greggio","icon":"Globe"},
    {"title":"Dinamica Nazionale","content":"Accise, logistica e media MIMIT","icon":"MapPin"},
    {"title":"Outlook 7 Giorni","content":"Previsione a breve termine","icon":"Calendar"}
  ],
  "tips": [
    {"title":"Consiglio 1","text":"...","impact":"HIGH"},
    {"title":"Consiglio 2","text":"...","impact":"MEDIUM"},
    {"title":"Consiglio 3","text":"...","impact":"LOW"}
  ],
  "trend": "UP" | "DOWN" | "STABLE",
  "historicalData": [{"date":"-Xg","price":0.000} (esattamente 7 oggetti per gli ultimi 7 giorni)],
  "forecast": [{"date":"+Xg","price":0.000} (esattamente 7 oggetti per i prossimi 7 giorni)]
}
NON aggiungere alcun testo, markdown o backtick prima o dopo il JSON. Assicurati che il JSON sia formattato correttamente.`;

  try {
    const response = await ai.models.generateContent({
      model: model || 'gemini-2.5-flash',
      contents: prompt,
    });

    const text = response.text || '';
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
    let jsonStr = (jsonMatch[1] || text).trim();
    
    // In case AI leaves text around JSON
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace >= 0) {
      jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(jsonStr);
    return parsed as MarketAnalysis;
  } catch (error: any) {
    console.error('Gemini API error:', error);
    throw new Error('Errore API Gemini: ' + (error.message || 'Sconosciuto'));
  }
}

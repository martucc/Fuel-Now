import { GoogleGenerativeAI } from '@google/generative-ai';
import type { MarketAnalysis } from '../types';

function extractJson(text: string) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i)?.[1];
  const raw = fenced || text.match(/\{[\s\S]*\}/)?.[0] || text;
  return JSON.parse(raw);
}

function withAnalysisDefaults(value: Partial<MarketAnalysis>, fuelType: string): MarketAnalysis {
  const now = new Date().toISOString();
  const average = value.stats?.averagePrice || 1.8;
  return {
    advice: value.advice || 'WAIT',
    source: 'ai',
    generatedAt: now,
    reasoning: value.reasoning || `Analisi AI completata per ${fuelType}.`,
    detailedReport: value.detailedReport || value.reasoning || `Lettura sintetica del mercato ${fuelType}.`,
    stats: value.stats,
    categories: value.categories?.length ? value.categories : [
      { title: 'Prezzo locale', content: 'Confronta sempre il prezzo visto in mappa con la media locale.', icon: 'MapPin' },
      { title: 'Scenario', content: 'Valuta trend, distanza e tipo di servizio prima di fare deviazioni.', icon: 'Globe' },
      { title: 'Azione', content: 'Fai pieno solo quando trovi un valore chiaramente sotto media.', icon: 'Calendar' },
    ],
    tips: value.tips?.length ? value.tips : [
      { title: 'Sotto media', text: 'Scegli prezzi sotto la media della zona.', impact: 'HIGH' },
      { title: 'Deviazione breve', text: 'Il risparmio deve superare il costo del tragitto.', impact: 'MEDIUM' },
      { title: 'Self-service', text: 'Preferisci self quando il differenziale e netto.', impact: 'LOW' },
    ],
    trend: value.trend || 'STABLE',
    historicalData: value.historicalData?.length ? value.historicalData : [
      { date: '-6g', price: average },
      { date: '-3g', price: average },
      { date: 'Oggi', price: average },
    ],
    forecast: value.forecast?.length ? value.forecast : [
      { date: '+1g', price: average },
      { date: '+3g', price: average },
      { date: '+7g', price: average },
    ],
  };
}

export async function analyzeFuelMarket(
  apiKey?: string,
  model = 'gemini-1.5-flash',
  fuelType = 'Benzina',
  question?: string
): Promise<MarketAnalysis> {
  const today = new Date().toISOString().split('T')[0];
  const cacheKey = `fuelwise_analysis_${fuelType}_${today}`;
  
  // Check Cache
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const parsedCache = JSON.parse(cached);
      return parsedCache;
    } catch (e) {
      console.warn('Cache parsing failed', e);
    }
  }

  if (!apiKey?.trim()) throw new Error('MISSING_KEY');

  const genAI = new GoogleGenerativeAI(apiKey.trim());
  const gemini = genAI.getGenerativeModel({ model });
  const prompt = `Sei Martucc Fuel, un assistente finanziario per l'analisi dei prezzi carburante.
Carburante: ${fuelType}
Domanda: ${question || 'Analizza la convenienza locale vs nazionale e dai un consiglio operativo.'}

Rispondi solo con JSON valido:
{
  "advice": "FILL-FULL | WAIT | TEN-EURO | URGENT",
  "reasoning": "massimo 32 parole sui trend",
  "detailedReport": "massimo 120 parole",
  "categories": [{"title": "Prezzo locale", "content": "...", "icon": "MapPin"}],
  "tips": [{"title": "...", "text": "...", "impact": "HIGH | MEDIUM | LOW"}],
  "trend": "UP | DOWN | STABLE",
  "historicalData": [{"date": "-6g", "price": 1.8}],
  "forecast": [{"date": "+1g", "price": 1.8}]
}`;

  try {
    const result = await gemini.generateContent(prompt);
    const parsed = extractJson(result.response.text());
    const finalAnalysis = withAnalysisDefaults(parsed, fuelType);
    
    // Save to Cache
    localStorage.setItem(cacheKey, JSON.stringify(finalAnalysis));
    
    return finalAnalysis;
  } catch (error) {
    console.error('Gemini client analysis failed:', error);
    throw error;
  }
}

import type { FuelType } from '../types';

export interface ScannedReceipt {
  stationName?: string;
  fuelType?: FuelType;
  pricePerLiter?: number;
  total?: number;
  liters?: number;
  date?: string;
  odometer?: number;
}

export async function scanReceiptWithGemini(
  base64Image: string,
  mimeType: string,
  apiKey: string,
  model: string = 'gemini-2.5-flash'
): Promise<ScannedReceipt> {
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('MISSING_KEY');
  }

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Analizza questa foto di uno scontrino del distributore di benzina o del display della colonnina di carburante.
Estrai con precisione le seguenti informazioni in formato JSON:
- "stationName": string o null (nome del marchio o distributore, es. "Eni", "Q8", "IP", "Tamoil", "Esso", "Repsol", "Beyfin", "Pompa Bianca")
- "fuelType": "Benzina" | "Diesel" | "GPL" | "Metano" (identifica il tipo di carburante erogato)
- "pricePerLiter": number o null (prezzo unitario al litro in euro, es. 1.789)
- "total": number o null (importo totale speso in euro, es. 50.00)
- "liters": number o null (quantità di litri erogati, es. 27.95)
- "date": string o null (data del rifornimento in formato YYYY-MM-DD se leggibile)
- "odometer": number o null (chilometri del veicolo se scritti sullo scontrino)

Se alcuni valori non sono leggibili, impostali a null. Rispondi ESCLUSIVAMENTE con il JSON puro.`;

  const cleanBase64 = base64Image.includes('base64,')
    ? base64Image.split('base64,')[1]
    : base64Image;

  const res: any = await ai.models.generateContent({
    model: model || 'gemini-2.5-flash',
    contents: [
      {
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: cleanBase64,
        },
      },
      prompt,
    ],
    config: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    } as any,
  });

  const text = (res?.text || '').trim();
  if (!text) {
    throw new Error('Nessuna risposta ricevuta da Gemini.');
  }

  try {
    const data = JSON.parse(text);
    return {
      stationName: data.stationName || undefined,
      fuelType: data.fuelType || undefined,
      pricePerLiter: typeof data.pricePerLiter === 'number' ? data.pricePerLiter : undefined,
      total: typeof data.total === 'number' ? data.total : undefined,
      liters: typeof data.liters === 'number' ? data.liters : undefined,
      date: data.date || undefined,
      odometer: typeof data.odometer === 'number' ? data.odometer : undefined,
    };
  } catch {
    throw new Error('Impossibile interpretare i dati dello scontrino.');
  }
}

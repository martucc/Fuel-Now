import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FuelKey } from '../../domain/raw';
import { FUEL_LABEL } from '../../domain/fuel';
import type { CodiceErroreIa } from '../../services/geminiService';
import { analyzeFuelMarket } from '../../services/geminiService';
import type { AnalisiIa } from '../../services/analisiIa';
import { chiaveAnalisi, codiceErrore, daRisposta, leggiAnalisi, salvaAnalisi } from '../../services/analisiIa';

interface Opzioni {
  chiaveApi: string;
  modello: string;
  fuel: FuelKey;
  /** La firma del file dei prezzi; null finche non c'e un file. */
  firma: string | null;
  /** Il dossier coi numeri di oggi; null finche mancano i dati. */
  dossier: string | null;
  /** false mentre si aspetta ancora la posizione: un commento senza la zona va rifatto. */
  pronto: boolean;
  visibile: boolean;
}

interface StatoChiave {
  carico: boolean;
  errore: CodiceErroreIa | null;
  analisi: AnalisiIa | null;
}

export interface RispostaIa {
  id: number;
  fuel: FuelKey;
  domanda: string;
  carico: boolean;
  analisi: AnalisiIa | null;
  errore: CodiceErroreIa | null;
}

export interface StatoIa {
  attiva: boolean;
  analisi: AnalisiIa | null;
  /** Una richiesta e in corso, o sta per partire da sola. */
  carico: boolean;
  errore: CodiceErroreIa | null;
  rigenera: () => void;
  risposta: RispostaIa | null;
  chiedi: (domanda: string) => void;
}

/**
 * Prima di partire da sola la richiesta aspetta un attimo: chi scorre i
 * carburanti uno dopo l'altro non deve spendere quattro richieste.
 */
const ATTESA_AVVIO_MS = 700;

function inLinea(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

/**
 * Il commento dell'IA della scheda Prezzi.
 *
 * Una copia per carburante, modello e file dei prezzi: se c'e si mostra,
 * se manca si chiede a Gemini appena la scheda e a schermo. Gli errori
 * restano dentro la sezione, con un codice da tradurre in una frase: la
 * scheda non si blocca mai per la rete.
 */
export function useAnalisiIa(o: Opzioni): StatoIa {
  const attiva = o.chiaveApi.trim().length > 0;
  const chiave = attiva && o.firma ? chiaveAnalisi(o.fuel, o.modello, o.firma) : null;
  const [stati, setStati] = useState<ReadonlyMap<string, StatoChiave>>(() => new Map());
  const [risposta, setRisposta] = useState<RispostaIa | null>(null);
  const inVolo = useRef(new Set<string>());

  const salvata = useMemo(() => (chiave ? leggiAnalisi(chiave) : null), [chiave]);
  const stato = chiave ? stati.get(chiave) : undefined;

  const { chiaveApi, modello, fuel, firma, dossier } = o;

  const genera = useCallback(
    async (k: string) => {
      if (!dossier || !firma || inVolo.current.has(k)) return;
      inVolo.current.add(k);
      const aggiorna = (s: Partial<StatoChiave>) =>
        setStati((prima) => {
          const prec = prima.get(k) ?? { carico: false, errore: null, analisi: null };
          return new Map(prima).set(k, { ...prec, ...s });
        });
      aggiorna({ carico: true, errore: null });
      try {
        const r = await analyzeFuelMarket(chiaveApi, modello, FUEL_LABEL[fuel], undefined, dossier);
        const a = daRisposta(r, modello, Date.now());
        salvaAnalisi(k, firma, a);
        aggiorna({ carico: false, analisi: a });
      } catch (e) {
        aggiorna({ carico: false, errore: codiceErrore(e, inLinea()) });
      } finally {
        inVolo.current.delete(k);
      }
    },
    [chiaveApi, modello, fuel, firma, dossier],
  );

  // Parte da sola una volta per chiave: dopo un errore aspetta il tocco su «Riprova».
  const daAvviare = !!chiave && !!dossier && o.pronto && o.visibile && !salvata && !stato;
  useEffect(() => {
    if (!daAvviare || !chiave) return;
    const t = setTimeout(() => void genera(chiave), ATTESA_AVVIO_MS);
    return () => clearTimeout(t);
  }, [daAvviare, chiave, genera]);

  const rigenera = useCallback(() => {
    if (chiave) void genera(chiave);
  }, [chiave, genera]);

  const chiedi = useCallback(
    (testo: string) => {
      const domanda = testo.trim();
      if (!domanda || !dossier) return;
      const id = Date.now();
      setRisposta({ id, fuel, domanda, carico: true, analisi: null, errore: null });
      const chiudi = (s: Partial<RispostaIa>) => setRisposta((prima) => (prima?.id === id ? { ...prima, ...s, carico: false } : prima));
      analyzeFuelMarket(chiaveApi, modello, FUEL_LABEL[fuel], domanda, dossier)
        .then((r) => chiudi({ analisi: daRisposta(r, modello, Date.now()) }))
        .catch((e: unknown) => chiudi({ errore: codiceErrore(e, inLinea()) }));
    },
    [chiaveApi, modello, fuel, dossier],
  );

  return {
    attiva,
    analisi: stato?.analisi ?? salvata,
    carico: !!stato?.carico || daAvviare,
    errore: stato?.errore ?? null,
    rigenera,
    // La risposta riguarda il carburante per cui e stata chiesta.
    risposta: risposta && risposta.fuel === fuel ? risposta : null,
    chiedi,
  };
}

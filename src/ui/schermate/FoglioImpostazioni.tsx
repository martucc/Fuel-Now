import { useEffect, useMemo, useState } from 'react';
import { Car, Sparkles, MapPin, RefreshCw, EyeOff, Info, Check, Search, ChevronLeft, KeyRound, LocateFixed } from 'lucide-react';
import type { Modello } from '../../app/modello';
import { aggiornaImpostazioni } from '../../app/impostazioni';
import { cercaAuto, impostaNascosto, useElencoAuto } from '../../app/dati';
import { usaGps } from '../../app/posizione';
import { datasetStore } from '../../data/dataset';
import { descriviStatoDati } from '../../domain/aggiornamento';
import { numero } from '../../lib/formato';
import type { ModelloIa } from '../../services/geminiService';
import { chiediModelli, provaChiave, MODELLI_DI_RIPIEGO } from '../../services/geminiService';
import { Foglio } from '../kit/Foglio';
import { Gruppo, Riga } from '../kit/Gruppo';
import { Pulsante } from '../kit/Pulsante';

type Vista = 'principale' | 'auto' | 'ia';

/** Versione mostrata nelle impostazioni: tenerla allineata a android/app/build.gradle. */
export const VERSIONE_APP = '2.0';

/**
 * Le impostazioni: poche, e tutte cose che cambiano i conti. L'auto (litri
 * del pieno e consumo), la chiave Gemini, dove sei.
 */
export function FoglioImpostazioni({ m, onChiudi, onScegliLuogo }: { m: Modello; onChiudi: () => void; onScegliLuogo: () => void }) {
  const [vista, setVista] = useState<Vista>('principale');
  const stato = descriviStatoDati(m.dataset.fase, m.dataset.verificatoIl, m.adesso.getTime());

  const indietro = () => setVista('principale');
  const titolo =
    vista === 'auto' ? <Intestazione titolo="La tua auto" onIndietro={indietro} />
      : vista === 'ia' ? <Intestazione titolo="Google Gemini" onIndietro={indietro} />
        : 'Impostazioni';

  return (
    <Foglio titolo={titolo} onChiudi={onChiudi} altezza="alto">
      {vista === 'auto' ? (
        <SceltaAuto m={m} onIndietro={indietro} />
      ) : vista === 'ia' ? (
        <ChiaveIa m={m} />
      ) : (
      <div className="space-y-6 pb-2 pt-1">
        <Gruppo
          titolo="La tua auto"
          nota={`Per il risparmio vero: un pieno da ${numero(m.litri, 0)} L e ${numero(m.kml, 1)} km con un litro.`}
        >
          <Riga
            icona={<Car size={20} className="text-mf-ink-2" />}
            titolo={m.auto ? m.auto.model : 'Nessuna auto scelta'}
            sottotitolo={m.auto ? `Serbatoio ${m.auto.liters} L · ${numero(m.auto.kml, 1)} km/L` : 'Uso i valori medi: scegli la tua per conti giusti'}
            freccia
            onClick={() => setVista('auto')}
          />
        </Gruppo>

        <Gruppo titolo="Analisi dei prezzi" nota="La chiave resta sul telefono e serve solo per il commento dell’IA nella scheda Prezzi.">
          <Riga
            icona={<Sparkles size={20} className="text-mf-ink-2" />}
            titolo="Google Gemini"
            valore={m.impostazioni.chiaveGemini ? 'Attiva' : 'Non attiva'}
            freccia
            onClick={() => setVista('ia')}
          />
        </Gruppo>

        <Gruppo titolo="Posizione">
          {m.posizione.fase === 'manuale' ? (
            <>
              <Riga icona={<MapPin size={20} className="text-mf-ink-2" />} titolo={m.posizione.luogo ?? 'Luogo scelto'} sottotitolo="Scelto a mano" />
              <Riga icona={<LocateFixed size={20} className="text-mf-ink-2" />} titolo="Torna al GPS" onClick={() => void usaGps()} />
            </>
          ) : (
            <Riga icona={<LocateFixed size={20} className="text-mf-ink-2" />} titolo="GPS del telefono" sottotitolo={testoGps(m)} />
          )}
          <Riga icona={<Search size={20} className="text-mf-ink-2" />} titolo="Scegli una città" freccia onClick={onScegliLuogo} />
        </Gruppo>

        <Gruppo titolo="Prezzi" nota="Si aggiornano da soli ogni volta che apri l’app. Fonte: Ministero delle Imprese e del Made in Italy.">
          <Riga
            icona={<RefreshCw size={20} className={`text-mf-ink-2 ${m.dataset.fase === 'aggiorno' ? 'animate-spin' : ''}`} />}
            titolo="Aggiorna adesso"
            sottotitolo={stato.testo}
            onClick={() => void datasetStore().aggiorna('manuale')}
          />
          {m.nascosti.size > 0 && (
            <Riga
              icona={<EyeOff size={20} className="text-mf-ink-2" />}
              titolo={`Distributori nascosti: ${m.nascosti.size}`}
              valore="Mostra tutti"
              onClick={() => { for (const id of [...m.nascosti]) impostaNascosto(id, false); }}
            />
          )}
        </Gruppo>

        <Gruppo titolo="Informazioni">
          <Riga icona={<Info size={20} className="text-mf-ink-2" />} titolo="Martucc Fuel" valore={`Versione ${VERSIONE_APP}`} />
        </Gruppo>
        <p className="mf-caption px-4 text-mf-ink-2">
          Mappa © OpenStreetMap, OpenFreeMap. Percorsi OSRM. Ricerca luoghi Nominatim.
        </p>
      </div>
      )}
    </Foglio>
  );
}

function testoGps(m: Modello): string {
  switch (m.posizione.fase) {
    case 'gps': return m.posizione.precisioneM ? `Precisione circa ${Math.round(m.posizione.precisioneM)} m` : 'Attivo';
    case 'negata': return 'Permesso negato: concedilo dalle impostazioni di Android';
    case 'assente': return 'Il GPS non risponde';
    default: return 'Cerco…';
  }
}

function Intestazione({ titolo, onIndietro }: { titolo: string; onIndietro: () => void }) {
  return (
    <span className="flex items-center gap-1">
      <button type="button" onClick={onIndietro} onPointerDown={(e) => e.stopPropagation()} aria-label="Indietro" className="mf-press -ml-2 grid h-11 w-11 place-items-center text-mf-ink">
        <ChevronLeft size={24} />
      </button>
      {titolo}
    </span>
  );
}

function SceltaAuto({ m, onIndietro }: { m: Modello; onIndietro: () => void }) {
  const elenco = useElencoAuto();
  const [testo, setTesto] = useState('');
  const trovate = useMemo(() => (elenco ? cercaAuto(elenco, testo).slice(0, 80) : []), [elenco, testo]);
  const scegli = (model: string | null) => {
    aggiornaImpostazioni({ auto: model });
    onIndietro();
  };

  return (
    <>
      <div className="sticky top-0 z-10 bg-mf-surface pb-3 pt-1">
        <label className="flex h-11 items-center gap-2 rounded-mf-sm bg-mf-surface-2 px-3">
          <Search size={17} className="shrink-0 text-mf-ink-3" />
          <input
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            placeholder="Cerca: panda, golf, 500…"
            className="mf-body h-full min-w-0 flex-1 bg-transparent text-mf-ink outline-none placeholder:text-mf-ink-3"
            autoComplete="off"
            enterKeyHint="search"
          />
        </label>
      </div>
      <div className="overflow-hidden rounded-mf-lg bg-mf-surface-2 [&>*+*]:border-t [&>*+*]:border-mf-hairline">
        <Riga
          titolo="Nessuna auto"
          sottotitolo="Valori medi del carburante"
          valore={m.auto === null ? <Check size={18} className="text-mf-ink" /> : undefined}
          onClick={() => scegli(null)}
        />
        {elenco === null && <p className="mf-footnote px-4 py-3 text-mf-ink-2">Carico l’elenco…</p>}
        {trovate.map((a) => (
          <Riga
            key={a.model}
            titolo={a.model}
            sottotitolo={`Serbatoio ${a.liters} L · ${numero(a.kml, 1)} km/L`}
            valore={m.auto?.model === a.model ? <Check size={18} className="text-mf-ink" /> : undefined}
            onClick={() => scegli(a.model)}
          />
        ))}
        {elenco !== null && trovate.length === 0 && (
          <p className="mf-footnote px-4 py-3 text-mf-ink-2">Nessun modello trovato: prova col nome della casa, per esempio «Fiat».</p>
        )}
      </div>
    </>
  );
}

function ChiaveIa({ m }: { m: Modello }) {
  const [chiave, setChiave] = useState(m.impostazioni.chiaveGemini);
  const [modello, setModello] = useState(m.impostazioni.modelloGemini);
  const [modelli, setModelli] = useState<ModelloIa[]>(MODELLI_DI_RIPIEGO);
  const [prova, setProva] = useState<{ stato: 'ferma' | 'in-corso' | 'ok' | 'errore'; testo?: string }>({ stato: 'ferma' });

  useEffect(() => {
    let vivo = true;
    if (m.impostazioni.chiaveGemini) {
      void chiediModelli(m.impostazioni.chiaveGemini).then((l) => { if (vivo) setModelli(l); });
    }
    return () => { vivo = false; };
  }, [m.impostazioni.chiaveGemini]);

  const salva = async () => {
    const pulita = chiave.trim();
    aggiornaImpostazioni({ chiaveGemini: pulita, modelloGemini: modello });
    if (!pulita) {
      setProva({ stato: 'ferma' });
      return;
    }
    setProva({ stato: 'in-corso' });
    const esito = await provaChiave(pulita, modello);
    setProva(esito.ok ? { stato: 'ok', testo: 'Funziona.' } : { stato: 'errore', testo: esito.messaggio });
  };

  return (
      <div className="space-y-6 pb-2 pt-1">
        <p className="mf-subhead text-mf-ink-2">
          Con la tua chiave, nella scheda Prezzi l’IA commenta l’andamento e risponde alle domande. I numeri restano quelli calcolati dall’app.
        </p>
        <section>
          <h2 className="mf-section-label mb-2 px-1">Chiave API</h2>
          <label className="flex h-12 items-center gap-2 rounded-mf-md bg-mf-surface-2 px-3">
            <KeyRound size={17} className="shrink-0 text-mf-ink-3" />
            <input
              value={chiave}
              onChange={(e) => { setChiave(e.target.value); setProva({ stato: 'ferma' }); }}
              placeholder="Incolla qui la chiave"
              type="password"
              autoComplete="off"
              spellCheck={false}
              className="mf-body h-full min-w-0 flex-1 bg-transparent font-mono text-mf-ink outline-none placeholder:font-sans placeholder:text-mf-ink-3"
            />
          </label>
          <p className="mf-footnote mt-2 px-1 text-mf-ink-2">
            Gratis su{' '}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-mf-ink-2">
              Google AI Studio
            </a>
            .
          </p>
          {prova.testo && (
            <p className={`mf-footnote mt-2 px-1 ${prova.stato === 'ok' ? 'text-mf-best' : 'text-mf-danger'}`}>{prova.testo}</p>
          )}
          <Pulsante className="mt-4" largo misura="grande" onClick={() => void salva()} disabled={prova.stato === 'in-corso'}>
            {prova.stato === 'in-corso' ? 'Provo la chiave…' : 'Salva e prova'}
          </Pulsante>
        </section>
        <Gruppo titolo="Modello">
          {modelli.map((x) => (
            <Riga
              key={x.id}
              titolo={x.nome}
              sottotitolo={x.nota}
              valore={modello === x.id ? <Check size={18} className="text-mf-ink" /> : undefined}
              onClick={() => { setModello(x.id); setProva({ stato: 'ferma' }); }}
            />
          ))}
        </Gruppo>
        {m.impostazioni.chiaveGemini && (
          <Pulsante tono="semplice" largo onClick={() => { setChiave(''); aggiornaImpostazioni({ chiaveGemini: '' }); setProva({ stato: 'ferma' }); }}>
            Rimuovi la chiave
          </Pulsante>
        )}
      </div>
  );
}

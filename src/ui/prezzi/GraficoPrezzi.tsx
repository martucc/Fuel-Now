import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as EventoPuntatore, RefObject } from 'react';
import type { Estremi, PuntoSerie } from '../../domain/andamento';
import { numero, prezzo as formatoPrezzo } from '../../lib/formato';
import type { Punto } from './geometria';
import { geometria, piuVicino } from './geometria';
import { dataBreve, dataConAnno } from './formatoPrezzi';

interface Props {
  punti: readonly PuntoSerie[];
  previsione: readonly PuntoSerie[];
  estremi: Estremi | null;
  /** Una frase che dice cosa mostra il grafico, per chi non lo vede. */
  descrizione: string;
}

const ALTEZZA = 196;
const MARGINI = { sopra: 26, sotto: 40, sinistra: 0, destra: 46 } as const;
/** Oltre questi pixel in orizzontale un tocco diventa una lettura che scorre. */
const SOGLIA_TRASCINA = 6;

/** La larghezza del riquadro, aggiornata solo quando cambia davvero. */
function useLarghezza(rif: RefObject<HTMLDivElement | null>): number {
  const [larghezza, setLarghezza] = useState(0);
  useEffect(() => {
    const el = rif.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((voci) => {
      const w = Math.round(voci[0]?.contentRect.width ?? 0);
      setLarghezza((prima) => (prima === w ? prima : w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [rif]);
  return larghezza;
}

/**
 * Il grafico della media italiana, scritto a mano in SVG: una linea, la sua
 * velatura, la previsione tratteggiata e la lettura di un giorno col dito.
 * Niente librerie: e una spezzata, e una libreria di grafici peserebbe piu
 * di tutta la scheda.
 *
 * La linea e bianca, non blu: il blu nell'app vuol dire «vai qui».
 *
 * Col dito: un tocco legge il giorno (un secondo tocco lo toglie), un
 * trascinamento in orizzontale scorre i giorni. In verticale la pagina
 * scorre come sempre.
 */
export function GraficoPrezzi({ punti, previsione, estremi, descrizione }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const gesto = useRef<{ x: number; y: number; trascina: boolean } | null>(null);
  const larghezza = useLarghezza(box);
  /** Il giorno letto, per data: resta giusto anche se cambia la finestra. */
  const [scelto, setScelto] = useState<number | null>(null);

  const g = useMemo(
    () => (larghezza > 0 ? geometria(punti, previsione, { larghezza, altezza: ALTEZZA, ...MARGINI }) : null),
    [punti, previsione, larghezza],
  );
  const dati = useMemo(() => [...punti, ...previsione], [punti, previsione]);
  const posizioni = useMemo(() => (g ? [...g.punti, ...g.futuri] : []), [g]);

  const tsVicino = (clientX: number): number | null => {
    const el = box.current;
    if (!el || posizioni.length === 0) return null;
    const i = piuVicino(posizioni, clientX - el.getBoundingClientRect().left);
    return dati[i]?.ts ?? null;
  };

  const su = (e: EventoPuntatore<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') return;
    const gs = gesto.current;
    gesto.current = null;
    if (gs && !gs.trascina) {
      const ts = tsVicino(e.clientX);
      setScelto((prima) => (prima === ts ? null : ts));
    }
  };

  const muovi = (e: EventoPuntatore<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') {
      setScelto(tsVicino(e.clientX));
      return;
    }
    const gs = gesto.current;
    if (!gs) return;
    const dx = Math.abs(e.clientX - gs.x);
    if (!gs.trascina && dx > SOGLIA_TRASCINA && dx > Math.abs(e.clientY - gs.y)) gs.trascina = true;
    if (gs.trascina) setScelto(tsVicino(e.clientX));
  };

  const indiceMin = estremi ? punti.indexOf(estremi.minimo) : -1;
  const indiceMax = estremi ? punti.indexOf(estremi.massimo) : -1;
  const ultimo = g?.punti[g.punti.length - 1];
  const primo = punti[0];
  const fine = punti[punti.length - 1];
  const anniDiversi = !!primo && !!fine && new Date(primo.ts).getUTCFullYear() !== new Date(fine.ts).getUTCFullYear();

  let lettura: { p: Punto; testo: string } | null = null;
  const i = scelto === null ? -1 : dati.findIndex((d) => d.ts === scelto);
  const dato = dati[i];
  const pos = posizioni[i];
  if (g && dato && pos) {
    const futuro = i >= punti.length;
    lettura = { p: pos, testo: `${dataBreve(dato.ts)} · ${futuro ? 'previsto ' : ''}${formatoPrezzo(dato.prezzo)}` };
  }

  return (
    <div
      ref={box}
      role="img"
      aria-label={descrizione}
      className="relative select-none"
      style={{ height: ALTEZZA, touchAction: 'pan-y' }}
      onPointerDown={(e) => { if (e.pointerType !== 'mouse') gesto.current = { x: e.clientX, y: e.clientY, trascina: false }; }}
      onPointerMove={muovi}
      onPointerUp={su}
      onPointerCancel={() => { gesto.current = null; }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') setScelto(null); }}
    >
      {g && (
        <svg width={larghezza} height={ALTEZZA} className="absolute inset-0" aria-hidden>
          {g.righe.map((r) => (
            <line key={r.valore} x1={0} x2={larghezza - MARGINI.destra + 6} y1={r.y} y2={r.y} stroke="var(--color-mf-hairline)" strokeWidth={1} />
          ))}
          <path d={g.area} fill="var(--color-mf-ink)" fillOpacity={0.07} />
          <path d={g.linea} fill="none" stroke="var(--color-mf-ink)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {g.previsione && (
            <path d={g.previsione} fill="none" stroke="var(--color-mf-ink-2)" strokeWidth={2} strokeDasharray="3 5" strokeLinecap="round" />
          )}
          {lettura ? (
            <>
              <line x1={lettura.p.x} x2={lettura.p.x} y1={MARGINI.sopra - 4} y2={g.fondo} stroke="var(--color-mf-ink-3)" strokeWidth={1} />
              <circle cx={lettura.p.x} cy={lettura.p.y} r={4.5} fill="var(--color-mf-ink)" stroke="var(--color-mf-surface)" strokeWidth={2} />
            </>
          ) : (
            <>
              {[indiceMin, indiceMax].map((k) => {
                const p = k >= 0 && k < g.punti.length - 1 ? g.punti[k] : undefined;
                return p ? <circle key={k} cx={p.x} cy={p.y} r={3.5} fill="var(--color-mf-ink-2)" stroke="var(--color-mf-surface)" strokeWidth={2} /> : null;
              })}
              {ultimo && <circle cx={ultimo.x} cy={ultimo.y} r={4.5} fill="var(--color-mf-ink)" stroke="var(--color-mf-surface)" strokeWidth={2} />}
            </>
          )}
        </svg>
      )}

      {/* Le scritte sono HTML sopra l'SVG: restano nitide e usano i caratteri dell'app. */}
      {g?.righe.map((r) => (
        <span key={r.valore} className="mf-caption mf-num pointer-events-none absolute right-0 text-mf-ink-3" style={{ top: r.y - 8 }}>
          {numero(r.valore, g.passo < 0.01 ? 3 : 2)}
        </span>
      ))}

      {g && !lettura && estremi && (
        <>
          <Etichetta p={g.punti[indiceMax]} larghezza={larghezza} sopra testo={`massimo ${formatoPrezzo(estremi.massimo.prezzo)}`} />
          {indiceMin !== indiceMax && (
            <Etichetta p={g.punti[indiceMin]} larghezza={larghezza} testo={`minimo ${formatoPrezzo(estremi.minimo.prezzo)}`} />
          )}
        </>
      )}

      {lettura && (
        <span
          className="mf-caption mf-num pointer-events-none absolute top-0 whitespace-nowrap rounded-full bg-mf-surface-2 px-2 py-[3px] font-semibold text-mf-ink"
          style={versoInterno(lettura.p.x, larghezza)}
        >
          {lettura.testo}
        </span>
      )}

      {g && primo && fine && ultimo && (
        <>
          <span className="mf-caption pointer-events-none absolute bottom-0 left-0 text-mf-ink-3">
            {anniDiversi ? dataConAnno(primo.ts) : dataBreve(primo.ts)}
          </span>
          <span className="mf-caption pointer-events-none absolute bottom-0 text-mf-ink-3" style={{ right: larghezza - ultimo.x }}>
            {dataBreve(fine.ts)}
          </span>
        </>
      )}
    </div>
  );
}

/** Ancorata al punto e girata verso l'interno, cosi non esce mai dal riquadro. */
function versoInterno(x: number, larghezza: number): CSSProperties {
  return x < larghezza / 2 ? { left: Math.max(0, x - 6) } : { right: Math.max(0, larghezza - x - 6) };
}

function Etichetta({ p, larghezza, testo, sopra }: { p: Punto | undefined; larghezza: number; testo: string; sopra?: boolean }) {
  if (!p) return null;
  return (
    <span
      className="mf-caption mf-num pointer-events-none absolute whitespace-nowrap text-mf-ink-2"
      style={{ ...versoInterno(p.x, larghezza), top: sopra ? p.y - 22 : p.y + 7 }}
    >
      {testo}
    </span>
  );
}

import { useMemo, useState } from 'react';
import { MapPin, Settings, Navigation, RefreshCw, LocateFixed, ChevronRight, Info } from 'lucide-react';
import type { Modello } from '../../app/modello';
import { RAGGIO_HOME_KM } from '../../app/modello';
import type { HomeModel } from '../home/homeModel';
import type { CollezionePunti } from '../../domain/mappa';
import type { OrdineLista } from '../../app/impostazioni';
import { aggiornaImpostazioni } from '../../app/impostazioni';
import { aggiornaPosizione } from '../../app/posizione';
import { datasetStore } from '../../data/dataset';
import { descriviStatoDati } from '../../domain/aggiornamento';
import { FUEL_LABEL } from '../../domain/fuel';
import type { FuelKey } from '../../domain/raw';
import { FUEL_KEYS } from '../../domain/raw';
import { prezzoBreve } from '../../domain/mappa';
import type { RankedStation } from '../../domain/ranking';
import { parseUpdatedAt } from '../../domain/freshness';
import { euro, prezzo as formatoPrezzo } from '../../lib/formato';
import { portamiLi } from '../../services/navigazione';
import type { ListItem } from '../home/homeModel';
import { Segmentato } from '../kit/Segmentato';
import { Pulsante, PulsanteIcona } from '../kit/Pulsante';
import { Prezzo } from '../kit/Prezzo';
import { LogoMarchio } from '../kit/LogoMarchio';
import { Vuoto, Segnaposto } from '../kit/Stato';
import { nomeMarchio } from '../kit/marchio';
import { distanza, etaPrezzo, indirizzo, minutiGuida, oreDa } from '../kit/formatoUi';
import { MappaCarburanti } from '../mappa/MappaCarburanti';
import { FoglioPerche } from './FoglioPerche';

interface Props {
  m: Modello;
  home: HomeModel | null;
  punti: CollezionePunti | null;
  onApriImpianto: (id: string) => void;
  onApriMappa: () => void;
  onApriImpostazioni: () => void;
  onScegliLuogo: () => void;
}

const OPZIONI_CARBURANTE = FUEL_KEYS.map((k) => ({ valore: k, etichetta: FUEL_LABEL[k] }));
const OPZIONI_ORDINE: ReadonlyArray<{ valore: OrdineLista; etichetta: string }> = [
  { valore: 'risparmio', etichetta: 'Risparmio' },
  { valore: 'prezzo', etichetta: 'Prezzo' },
  { valore: 'distanza', etichetta: 'Distanza' },
];
/** Le righe mostrate prima di «Mostra tutti». */
const RIGHE_INIZIALI = 25;
/** Sotto questa cifra «risparmi» suona ridicolo: si dice che e il piu conveniente e basta. */
const RISPARMIO_MINIMO = 0.3;

/**
 * La Home: dove conviene fare il pieno qui vicino.
 *
 * Dall'alto: dove sei e lo stato dei prezzi, il carburante, il consiglio
 * (un distributore solo, con quanto si risparmia davvero), la mappa
 * intorno e la lista dei distributori entro 15 km.
 */
export function Home({ m, home, punti, onApriImpianto, onApriMappa, onApriImpostazioni, onScegliLuogo }: Props) {
  const [perche, setPerche] = useState(false);
  const [tutti, setTutti] = useState(false);
  const fuel = m.impostazioni.carburante;
  const ordine = m.impostazioni.ordineLista;

  const lista = useMemo(() => {
    if (!home) return [];
    const l = [...home.list];
    if (ordine === 'prezzo') l.sort((a, b) => a.price - b.price || a.distanceKm - b.distanceKm);
    if (ordine === 'distanza') l.sort((a, b) => a.distanceKm - b.distanceKm);
    return l;
  }, [home, ordine]);

  const best = home?.best ?? null;
  const stato = descriviStatoDati(m.dataset.fase, m.dataset.verificatoIl, m.adesso.getTime(), datiDel(m));

  return (
    <div className="mx-auto max-w-xl px-4 pb-6" style={{ paddingTop: 'calc(var(--mf-safe-top) + 8px)' }}>
      {/* Dove sei e le impostazioni */}
      <header className="flex items-center gap-2 py-2">
        <button
          type="button"
          onClick={m.posizione.fase === 'gps' ? () => void aggiornaPosizione() : onScegliLuogo}
          className="mf-press flex min-w-0 items-center gap-1.5 rounded-full bg-mf-surface px-3 py-1.5 text-mf-ink-2"
        >
          {m.posizione.fase === 'gps' ? <LocateFixed size={15} className="shrink-0 text-mf-accent" /> : <MapPin size={15} className="shrink-0" />}
          <span className="mf-footnote truncate">{testoPosizione(m)}</span>
        </button>
        <span className="flex-1" />
        <PulsanteIcona etichetta="Impostazioni" onClick={onApriImpostazioni}>
          <Settings size={19} />
        </PulsanteIcona>
      </header>

      <h1 className="mf-large-title mt-1">Dove conviene</h1>

      <Segmentato
        className="mt-3"
        etichetta="Carburante"
        valore={fuel}
        opzioni={OPZIONI_CARBURANTE}
        onCambia={(v) => aggiornaImpostazioni({ carburante: v as FuelKey })}
      />

      {/* Lo stato dei prezzi: tocca per ricontrollare. */}
      <button
        type="button"
        onClick={() => void datasetStore().aggiorna('manuale')}
        className="mf-press mt-3 flex items-center gap-2 text-left"
        aria-label={`${stato.testo}. Tocca per aggiornare`}
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${m.dataset.fase === 'aggiorno' || m.dataset.fase === 'carico' ? 'animate-pulse bg-mf-accent' : stato.avviso ? 'bg-mf-warn' : 'bg-mf-best'}`} />
        <span className={`mf-footnote ${stato.avviso ? 'text-mf-warn' : 'text-mf-ink-2'}`}>{stato.testo}</span>
        <RefreshCw size={13} className={`text-mf-ink-3 ${m.dataset.fase === 'aggiorno' ? 'animate-spin' : ''}`} />
      </button>

      {/* Il consiglio */}
      <section className="mt-4">
        {!m.posizione.punto ? (
          <SenzaPosizione m={m} onScegliLuogo={onScegliLuogo} />
        ) : !m.base ? (
          <Segnaposto className="h-[236px]" />
        ) : best ? (
          <SchedaConsiglio
            best={best}
            m={m}
            servito={m.base.perId.get(best.row.id)?.servito[fuel] ?? null}
            onPerche={() => setPerche(true)}
            onApri={() => onApriImpianto(best.row.id)}
          />
        ) : (
          <div className="rounded-mf-lg bg-mf-surface">
            <Vuoto
              titolo={`Nessun distributore di ${FUEL_LABEL[fuel].toLowerCase()} entro ${RAGGIO_HOME_KM} km`}
              testo="Prova un altro carburante o guarda la mappa."
              azione={<Pulsante tono="tinta" onClick={onApriMappa}>Apri la mappa</Pulsante>}
            />
          </div>
        )}
      </section>

      {/* La mappa intorno: un tocco apre la scheda Mappa. */}
      {m.posizione.punto && (
        <section className="relative mt-4 h-[200px] overflow-hidden rounded-mf-lg ring-1 ring-mf-hairline">
          <MappaCarburanti
            punti={punti}
            utente={m.posizione.punto}
            consigliato={best ? { id: best.row.id, lat: best.row.lat, lng: best.row.lng, testo: prezzoBreve(best.price) } : null}
            vistaIniziale={{ centro: m.posizione.punto, zoom: 12.6 }}
            interattiva={false}
          />
          <button type="button" onClick={onApriMappa} className="absolute inset-0" aria-label="Apri la mappa" />
          <span className="pointer-events-none absolute bottom-1.5 left-2.5 text-[9.5px] text-mf-ink-3">© OpenStreetMap</span>
          <span className="pointer-events-none absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-full bg-mf-veil px-2.5 py-1 text-[12px] font-medium text-mf-ink">
            Mappa <ChevronRight size={14} />
          </span>
        </section>
      )}

      {/* La lista */}
      {home && home.list.length > 0 && (
        <section className="mt-7">
          <div className="mb-3 flex items-end justify-between gap-3 px-1">
            <h2 className="mf-title">Qui vicino</h2>
            <span className="mf-footnote text-mf-ink-2">{home.list.length} entro {RAGGIO_HOME_KM} km</span>
          </div>
          <Segmentato
            etichetta="Ordina per"
            valore={ordine}
            opzioni={OPZIONI_ORDINE}
            onCambia={(v) => aggiornaImpostazioni({ ordineLista: v })}
          />
          <ul className="mt-3 overflow-hidden rounded-mf-lg bg-mf-surface [&>li+li]:border-t [&>li+li]:border-mf-hairline">
            {(tutti ? lista : lista.slice(0, RIGHE_INIZIALI)).map((it) => (
              <RigaImpianto
                key={it.id}
                it={it}
                m={m}
                ordine={ordine}
                consigliato={it.id === best?.row.id}
                bestPrice={best?.price ?? null}
                onApri={() => onApriImpianto(it.id)}
              />
            ))}
          </ul>
          {!tutti && lista.length > RIGHE_INIZIALI && (
            <div className="mt-3 flex justify-center">
              <Pulsante tono="semplice" onClick={() => setTutti(true)}>
                Mostra tutti ({lista.length})
              </Pulsante>
            </div>
          )}
          <p className="mf-caption mt-4 px-2 text-center text-mf-ink-3">
            Prezzi comunicati dai gestori al Ministero delle Imprese e del Made in Italy.
          </p>
        </section>
      )}

      {perche && best && <FoglioPerche best={best} m={m} onChiudi={() => setPerche(false)} />}
    </div>
  );
}

function datiDel(m: Modello): number | null {
  const s = m.dataset.dati?.source?.latest_price_at;
  return parseUpdatedAt(s)?.getTime() ?? null;
}

function testoPosizione(m: Modello): string {
  const p = m.posizione;
  if (p.fase === 'manuale') return p.luogo ?? 'Luogo scelto';
  if (p.fase === 'negata') return 'Posizione non concessa';
  if (p.fase === 'assente') return 'Posizione non disponibile';
  if (p.fase === 'cerco' || !p.punto) return 'Cerco la posizione…';
  return p.inCorso ? 'Aggiorno la posizione…' : 'La tua posizione';
}

function SenzaPosizione({ m, onScegliLuogo }: { m: Modello; onScegliLuogo: () => void }) {
  const cerco = m.posizione.fase === 'cerco';
  return (
    <div className="rounded-mf-lg bg-mf-surface">
      <Vuoto
        icona={<MapPin size={30} />}
        titolo={cerco ? 'Cerco dove sei…' : 'Non so dove sei'}
        testo={
          cerco
            ? 'Serve qualche secondo al GPS.'
            : 'Concedi la posizione all’app, oppure scegli una città: ti mostro i distributori lì intorno.'
        }
        azione={
          <div className="flex flex-col items-center gap-2">
            {!cerco && <Pulsante onClick={() => void aggiornaPosizione()}>Usa la posizione</Pulsante>}
            <Pulsante tono="semplice" onClick={onScegliLuogo}>Scegli una città</Pulsante>
          </div>
        }
      />
    </div>
  );
}

interface SchedaProps {
  best: RankedStation;
  m: Modello;
  servito: number | null;
  onPerche: () => void;
  onApri: () => void;
}

/** Il consiglio: un distributore solo, con quanto si risparmia davvero. */
function SchedaConsiglio({ best, m, servito, onPerche, onApri }: SchedaProps) {
  const r = best.row;
  const netto = best.net.net;
  const ore = oreDa(r.updated, m.adesso);
  const vecchio = ore !== null && ore > 72;
  const titolo = nomeMarchio(r.brand);
  return (
    <article className="rounded-mf-lg bg-mf-surface p-4">
      <p className="mf-caption font-semibold uppercase tracking-[0.06em] text-mf-accent">Vai qui</p>

      <button type="button" onClick={onApri} className="mf-press mt-2 flex w-full items-center gap-3 text-left">
        <LogoMarchio marchio={r.brand} misura={44} />
        <span className="min-w-0 flex-1">
          <span className="mf-headline block truncate">{titolo}</span>
          <span className="mf-footnote block truncate text-mf-ink-2">{indirizzo(r.address, r.city)}</span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-mf-ink-3" />
      </button>

      <div className="mt-4 flex items-end gap-4">
        <div>
          <Prezzo valore={best.price} livello={best.level} spento={vecchio} misura="eroe" />
          <p className="mf-caption mt-1 text-mf-ink-2">€/L self</p>
        </div>
        {servito !== null && servito !== best.price && (
          <div className="pb-[22px]">
            <span className="mf-num text-[17px] font-semibold text-mf-ink-2">{formatoPrezzo(servito)}</span>
            <p className="mf-caption text-mf-ink-3">servito</p>
          </div>
        )}
      </div>

      <p className="mf-subhead mt-3 text-mf-ink">
        {netto >= RISPARMIO_MINIMO ? (
          <>
            Risparmi <span className="mf-num font-semibold text-mf-best">{euro(netto)}</span> sul pieno
            <span className="text-mf-ink-2">, già tolta la strada per arrivarci.</span>
          </>
        ) : (
          <span className="text-mf-ink-2">È il più conveniente qui vicino, contando anche la strada.</span>
        )}
      </p>

      <p className="mf-footnote mt-1.5 text-mf-ink-2">
        {distanza(best.distanceKm)} · circa {minutiGuida(best.distanceKm)} min ·{' '}
        <span className={vecchio ? 'text-mf-warn' : ''}>prezzo {etaPrezzo(r.updated, m.adesso)}</span>
      </p>

      <div className="mt-4 flex gap-2.5">
        <Pulsante
          largo
          misura="grande"
          icona={<Navigation size={18} />}
          onClick={() => void portamiLi({ lat: r.lat, lng: r.lng, nome: `${titolo} ${indirizzo(r.address, r.city)}` })}
        >
          Portami lì
        </Pulsante>
        <Pulsante tono="grigio" misura="grande" icona={<Info size={18} />} onClick={onPerche} aria-label="Perché questo">
          Perché
        </Pulsante>
      </div>
    </article>
  );
}

interface RigaProps {
  it: ListItem;
  m: Modello;
  ordine: OrdineLista;
  consigliato: boolean;
  bestPrice: number | null;
  onApri: () => void;
}

function RigaImpianto({ it, m, ordine, consigliato, bestPrice, onApri }: RigaProps) {
  const riga = m.base?.perId.get(it.id);
  const servito = riga?.servito[m.impostazioni.carburante] ?? null;
  const ore = oreDa(riga?.updated, m.adesso);
  const vecchio = ore !== null && ore > 72;
  const spento = it.probabilmenteChiuso || !it.eligible;
  const delta = bestPrice !== null ? it.price - bestPrice : 0;

  return (
    <li>
      <button type="button" onClick={onApri} className="mf-press flex w-full items-center gap-3 px-3.5 py-3 text-left active:bg-mf-surface-2">
        <LogoMarchio marchio={it.brand} misura={38} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="mf-body truncate font-medium">{nomeMarchio(it.brand)}</span>
            {consigliato && <span className="shrink-0 rounded-full bg-mf-accent-soft px-1.5 py-[1px] text-[10.5px] font-semibold text-mf-accent">Consigliato</span>}
          </span>
          <span className="mf-footnote block truncate text-mf-ink-2">
            {distanza(it.distanceKm)} · <span className={vecchio ? 'text-mf-warn' : ''}>{etaPrezzo(riga?.updated, m.adesso)}</span>
          </span>
        </span>
        <span className="shrink-0 text-right">
          <Prezzo valore={it.price} livello={it.level} spento={spento} misura="riga" />
          <span className="mf-caption mf-num block text-mf-ink-2">
            {ordine === 'risparmio' && it.net >= RISPARMIO_MINIMO
              ? `risparmi ${euro(it.net)}`
              : ordine === 'prezzo' && delta > 0.0005
                ? `+${prezzoBreve(delta)}`
                : servito !== null
                  ? `servito ${formatoPrezzo(servito)}`
                  : ' '}
          </span>
        </span>
      </button>
    </li>
  );
}

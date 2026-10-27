import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Settings, Navigation, RefreshCw, LocateFixed, ChevronRight, Info, Clock, Route as IconaStrada } from 'lucide-react';
import type { Modello } from '../../app/modello';
import { RAGGIO_HOME_KM } from '../../app/modello';
import type { HomeModel } from '../home/homeModel';
import type { CollezionePunti } from '../../domain/mappa';
import type { OrdineLista } from '../../app/impostazioni';
import { aggiornaImpostazioni } from '../../app/impostazioni';
import { aggiornaPosizione } from '../../app/posizione';
import { datasetStore } from '../../data/dataset';
import { avvisoFonte, descriviStatoDati } from '../../domain/aggiornamento';
import { presiDalTelefono } from '../../domain/ministero';
import { FUEL_LABEL } from '../../domain/fuel';
import type { FuelKey } from '../../domain/raw';
import { FUEL_KEYS } from '../../domain/raw';
import { prezzoBreve } from '../../domain/mappa';
import type { RankedStation } from '../../domain/ranking';
import { ORE_PREZZO_VECCHIO, parseUpdatedAt, ultimoPrezzo } from '../../domain/freshness';
import { euro, prezzo as formatoPrezzo } from '../../lib/formato';
import { portamiLi } from '../../services/navigazione';
import type { ListItem } from '../home/homeModel';
import { Segmentato } from '../kit/Segmentato';
import { Pulsante, PulsanteIcona } from '../kit/Pulsante';
import { Prezzo } from '../kit/Prezzo';
import { LogoMarchio } from '../kit/LogoMarchio';
import { Vuoto, Segnaposto } from '../kit/Stato';
import { nomeMarchio } from '../kit/marchio';
import { distanza, etaPrezzo, indirizzo, minutiGuida } from '../kit/formatoUi';
import { MappaCarburanti } from '../mappa/MappaCarburanti';
import type { ComandiMappa } from '../mappa/MappaCarburanti';
import { unitaPrezzo } from '../prezzi/formatoPrezzi';
import type { QuadroUmore } from '../../domain/umore';
import { fraseUmore } from '../../domain/umore';
import { Termometro } from '../kit/Termometro';
import { righePreferiti } from '../../domain/preferiti';
import { FoglioPerche } from './FoglioPerche';
import { MieiDistributori } from './MieiDistributori';
import { useNuovaVersione } from '../../app/nuovaVersione';
import { AvvisoVersione } from '../kit/AvvisoVersione';

interface Props {
  m: Modello;
  home: HomeModel | null;
  umore: QuadroUmore;
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
export function Home({ m, home, umore, punti, onApriImpianto, onApriMappa, onApriImpostazioni, onScegliLuogo }: Props) {
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
  const { proposta } = useNuovaVersione();
  const utenteLat = m.posizione.punto?.lat;
  const utenteLng = m.posizione.punto?.lng;
  const preferiti = useMemo(() => {
    if (!m.base || !m.preferiti.size) return [];
    const punto = utenteLat !== undefined && utenteLng !== undefined ? { lat: utenteLat, lng: utenteLng } : null;
    return righePreferiti(m.preferiti, m.base.perId, m.base.cohorts, fuel, punto, ultimoPrezzo(m.base.rows));
  }, [m.preferiti, m.base, fuel, utenteLat, utenteLng]);
  const miniMappa = useRef<ComandiMappa | null>(null);
  const utente = m.posizione.punto;

  // La mini mappa parte inquadrando te e il consigliato, la risposta alla
  // domanda «dov'e?»; dopo la si puo muovere, e il bottone la riporta li.
  const idBest = best?.row.id;
  const inquadra = () => {
    if (!utente) return;
    if (best) miniMappa.current?.inquadra([utente, { lat: best.row.lat, lng: best.row.lng }], 40, 40);
    else miniMappa.current?.vola(utente, 12.6);
  };
  useEffect(() => {
    if (!utente || !best) return;
    const t = setTimeout(() => miniMappa.current?.inquadra([utente, { lat: best.row.lat, lng: best.row.lng }], 40, 40), 250);
    return () => clearTimeout(t);
    // si rifa solo se cambiano il consigliato o la posizione
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idBest, utente?.lat, utente?.lng]);

  const stato = descriviStatoDati(m.dataset.fase, m.dataset.verificatoIl, m.adesso.getTime(), datiDel(m), presiDalTelefono(m.dataset.dati));
  const fonteFerma = m.dataset.origine === 'pacchetto' ? null : avvisoFonte(datiDel(m), m.adesso.getTime());

  return (
    <div className="mx-auto max-w-xl px-4 pb-6" style={{ paddingTop: 'calc(var(--mf-safe-top) + 8px)' }}>
      {/* Dove sei e le impostazioni */}
      <header className="flex items-center gap-2 py-2">
        <button
          type="button"
          onClick={m.posizione.fase === 'gps' ? () => void aggiornaPosizione() : onScegliLuogo}
          className="mf-press mf-vetro flex min-w-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-mf-ink"
        >
          {m.posizione.fase === 'gps' ? <LocateFixed size={15} className="shrink-0" style={{ color: 'var(--mf-umore)' }} /> : <MapPin size={15} className="shrink-0" style={{ color: 'var(--mf-umore)' }} />}
          <span className="mf-footnote truncate">{testoPosizione(m)}</span>
        </button>
        <span className="flex-1" />
        <PulsanteIcona etichetta="Impostazioni" className="mf-vetro" onClick={onApriImpostazioni}>
          <Settings size={19} />
        </PulsanteIcona>
      </header>

      <h1 className="mf-large-title mt-3">
        Dove <span className="mf-testo-umore">conviene</span>
      </h1>
      {fraseUmore(umore) && <p className="mf-subhead mt-1.5 text-mf-ink-2">{fraseUmore(umore)}</p>}

      <Segmentato
        className="mt-4"
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
        <span className={`h-2 w-2 shrink-0 rounded-full ${m.dataset.fase === 'aggiorno' || m.dataset.fase === 'carico' ? 'animate-pulse bg-mf-ink-2' : stato.avviso ? 'bg-mf-warn' : 'bg-mf-best'}`} />
        <span className={`mf-footnote ${stato.avviso ? 'text-mf-warn' : 'text-mf-ink-2'}`}>{stato.testo}</span>
        <RefreshCw size={13} className={`text-mf-ink-3 ${m.dataset.fase === 'aggiorno' ? 'animate-spin' : ''}`} />
      </button>
      {fonteFerma && <p className="mf-footnote mt-1 pl-4 text-mf-warn">{fonteFerma}</p>}

      {proposta && <AvvisoVersione className="mt-4" rilascio={proposta} />}

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
          <div className="mf-carta">
            {home && home.list.length > 0 ? (
              <Vuoto
                titolo={`Nessun distributore da consigliare entro ${RAGGIO_HOME_KM} km`}
                testo="Quelli qui intorno sono in autostrada, forse chiusi, nascosti da te o con prezzi fuori mercato: li trovi nella lista qui sotto, ognuno col suo motivo."
                azione={<Pulsante tono="grigio" onClick={onApriMappa}>Apri la mappa</Pulsante>}
              />
            ) : (
              <Vuoto
                titolo={`Nessun distributore di ${FUEL_LABEL[fuel].toLowerCase()} entro ${RAGGIO_HOME_KM} km`}
                testo="Prova un altro carburante o guarda la mappa."
                azione={<Pulsante tono="grigio" onClick={onApriMappa}>Apri la mappa</Pulsante>}
              />
            )}
          </div>
        )}
      </section>

      {/*
        La mappa intorno, viva: si trascina e si allarga con le dita, e un
        tocco su un distributore apre la sua scheda. Mentre il dito e sulla
        mappa muove la mappa, non la pagina: per scorrere si tocca fuori.
      */}
      {m.posizione.punto && (
        <section className="relative mt-4 h-[232px] overflow-hidden rounded-mf-lg ring-1 ring-[rgb(255_255_255/0.08)] shadow-[0_18px_40px_-26px_rgb(0_0_0/0.9)]">
          <MappaCarburanti
            comandi={miniMappa}
            punti={punti}
            utente={m.posizione.punto}
            consigliato={best ? { id: best.row.id, lat: best.row.lat, lng: best.row.lng, testo: prezzoBreve(best.price) } : null}
            vistaIniziale={{ centro: m.posizione.punto, zoom: 12.6 }}
            onScegli={(id) => { if (id) onApriImpianto(id); }}
            attribuzione={false}
          />
          <span className="pointer-events-none absolute right-2.5 top-2.5 rounded bg-mf-veil px-1.5 py-0.5 text-[10px] text-mf-ink-2">© OpenStreetMap</span>
          <div className="pointer-events-none absolute bottom-2.5 left-2.5 flex gap-2">
            <button
              type="button"
              aria-label="Torna a te e al consigliato"
              onClick={inquadra}
              className="mf-press mf-vetro pointer-events-auto grid h-9 w-9 place-items-center rounded-full text-mf-ink"
            >
              <LocateFixed size={17} />
            </button>
            <button
              type="button"
              onClick={onApriMappa}
              className="mf-press mf-vetro pointer-events-auto flex h-9 items-center gap-1 rounded-full pl-3.5 pr-2.5 text-[13px] font-semibold text-mf-ink"
            >
              Mappa <ChevronRight size={15} />
            </button>
          </div>
        </section>
      )}

      {/* I distributori con la stella, anche lontani. */}
      <MieiDistributori
        className="mt-7"
        righe={preferiti}
        m={m}
        prezzoConsigliato={best?.price ?? null}
        onApri={onApriImpianto}
      />

      {/* La zona: dove sta la mediana qui intorno rispetto all'Italia. */}
      {umore.umore !== 'neutro' && umore.mediana !== null && umore.scarto !== null && (
        <Termometro className="mt-4" mediana={umore.mediana} scarto={umore.scarto} n={umore.n} />
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
          <ul className="mf-carta mt-3 overflow-hidden [&>li+li]:border-t [&>li+li]:border-mf-hairline">
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
          <p className="mf-caption mt-4 px-2 text-center text-mf-ink-2">
            Prezzi comunicati dai gestori al Ministero delle Imprese e del Made in Italy.
          </p>
        </section>
      )}

      {perche && best && <FoglioPerche best={best} m={m} onChiudi={() => setPerche(false)} />}
    </div>
  );
}

/** «€/L self», «€/L servito», «€/kg»: accanto al prezzo grande del consiglio. */
function etichettaPrezzo(fuel: FuelKey, alServito: boolean): string {
  if (alServito) return `${unitaPrezzo(fuel)} servito`;
  return fuel === 'diesel' || fuel === 'benzina' ? `${unitaPrezzo(fuel)} self` : unitaPrezzo(fuel);
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
    <div className="mf-carta">
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
            {!cerco && <Pulsante tono="grigio" onClick={() => void aggiornaPosizione()}>Usa la posizione</Pulsante>}
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
  const vecchio = (best.ritardoH ?? 0) > ORE_PREZZO_VECCHIO;
  const titolo = nomeMarchio(r.brand);
  return (
    <article className="mf-eroe p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-mf-accent-soft px-2.5 py-1 text-[12px] font-bold text-mf-accent">
          <Navigation size={12} strokeWidth={2.6} /> Vai qui
        </span>
        <span className={`mf-caption ${vecchio ? 'text-mf-warn' : 'text-mf-ink-2'}`}>prezzo {etaPrezzo(r.updated, m.adesso)}</span>
      </div>

      <button type="button" onClick={onApri} className="mf-press mt-4 flex w-full items-center gap-3 text-left">
        <LogoMarchio marchio={r.brand} misura={46} />
        <span className="min-w-0 flex-1">
          <span className="mf-headline block truncate">{titolo}</span>
          <span className="mf-footnote block truncate text-mf-ink-2">{indirizzo(r.address, r.city)}</span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-mf-ink-3" />
      </button>

      <div className="mt-5 flex items-end gap-4">
        <div>
          <Prezzo valore={best.price} livello={best.level} spento={vecchio} misura="eroe" bagliore />
          <p className="mf-caption mt-1.5 text-mf-ink-2">{etichettaPrezzo(m.impostazioni.carburante, best.alServito)}</p>
        </div>
        {servito !== null && servito !== best.price && (
          <div className="pb-[24px]">
            <span className="mf-num text-[17px] font-semibold text-mf-ink-2">{formatoPrezzo(servito)}</span>
            <p className="mf-caption text-mf-ink-3">servito</p>
          </div>
        )}
      </div>

      {netto >= RISPARMIO_MINIMO ? (
        <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-[rgb(46_229_157/0.12)] px-3 py-1.5 ring-1 ring-inset ring-[rgb(46_229_157/0.25)]">
          <span className="mf-subhead text-mf-ink">
            Risparmi <span className="mf-num font-bold text-mf-best">{euro(netto)}</span> sul pieno
          </span>
        </p>
      ) : (
        <p className="mf-subhead mt-4 text-mf-ink-2">È il più conveniente qui vicino, contando strada e tempo.</p>
      )}
      {netto >= RISPARMIO_MINIMO && <p className="mf-caption mt-1.5 text-mf-ink-3">Già tolta la strada per arrivarci.</p>}

      <p className="mf-footnote mt-3 flex items-center gap-3 text-mf-ink-2">
        <span className="inline-flex items-center gap-1"><IconaStrada size={14} /> {distanza(best.distanceKm)}</span>
        <span className="inline-flex items-center gap-1"><Clock size={14} /> circa {minutiGuida(best.distanceKm)} min</span>
      </p>

      <div className="mt-5 flex gap-2.5">
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
  const spento = it.probabilmenteChiuso || !it.eligible;
  const delta = bestPrice !== null ? it.price - bestPrice : 0;
  // Per risparmio: chi rende piu del consigliato ci mette piu minuti, e la
  // riga lo dice; chi non si consiglia non dice «risparmi», dice perche.
  const tempo = ordine === 'risparmio' && it.consigliabile && it.minutiInPiu >= 1 ? `+${it.minutiInPiu} min` : null;

  return (
    <li>
      <button type="button" onClick={onApri} className="mf-press flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-[rgb(255_255_255/0.04)]">
        <LogoMarchio marchio={it.brand} misura={38} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="mf-body truncate font-medium">{nomeMarchio(it.brand)}</span>
            {consigliato && <span className="shrink-0 rounded-full bg-mf-accent-soft px-1.5 py-[1px] text-[11px] font-semibold text-mf-accent">Consigliato</span>}
          </span>
          <span className="mf-footnote block truncate text-mf-ink-2">
            {distanza(it.distanceKm)}
            {tempo && ` · ${tempo}`}
            {it.motivo && ` · ${it.motivo}`} · <span className={it.vecchio ? 'text-mf-warn' : ''}>{etaPrezzo(riga?.updated, m.adesso)}</span>
            {it.alServito && ' · solo servito'}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <Prezzo valore={it.price} livello={it.level} spento={spento} misura="riga" />
          <span className="mf-caption mf-num block text-mf-ink-2">
            {ordine === 'risparmio' && it.consigliabile && it.net >= RISPARMIO_MINIMO
              ? `risparmi ${euro(it.net)}`
              : ordine === 'prezzo' && delta > 0.0005
                ? `+${prezzoBreve(delta)}`
                : servito !== null && !it.alServito
                  ? `servito ${formatoPrezzo(servito)}`
                  : ' '}
          </span>
        </span>
      </button>
    </li>
  );
}

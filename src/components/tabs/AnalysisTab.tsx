import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowDownRight, ArrowUpRight, Minus, Send, Mic, Sparkles, ChevronDown,
  KeyRound, RefreshCw, X, AlertCircle, Landmark, CalendarDays, Route, Fuel,
} from 'lucide-react';
import type { MarketAnalysis, FuelType } from '../../types';
import type { MarketModel } from '../../ui/market/marketModel';
import { LEVEL_LABEL, LEVEL_VAR, type PriceLevel } from '../../domain/pricing';
import { loadHistory, getSeries, type HistoryPoint, type Period } from '../../services/historyService';
import { PriceChart } from '../charts/PriceChart';
import { Card, Section, Empty } from '../../design/primitives/Surface';
import { Widget, WidgetGrid, BarraSegmenti } from '../../design/primitives/Widget';
import { Button } from '../../design/primitives/Button';
import { BrandLogo } from '../../design/primitives/BrandLogo';
import { PageTitle } from '../../ui/chrome/PageTitle';
import { FuelTabs } from '../../ui/home/FuelTabs';
import { SCHERMATA, BLOCCO, useNumeroAnimato } from '../../design/motion';
import { toFuelKey, toFuelType } from '../../domain/fuel';
import { euro, numero, prezzoEuro, delta as pctDelta } from '../../lib/formato';

interface Props {
  model: MarketModel | null;
  /** L'analisi del modello: commenta, non decide. */
  marketRef: MarketAnalysis | null;
  selectedFuel: FuelType;
  setSelectedFuel?: (f: FuelType) => void;
  apiKey: string;
  analysisLoading: boolean;
  userQuestion: string;
  setUserQuestion: (q: string) => void;
  analysisIsLocal: boolean;
  fetchAnalysis: (f: FuelType, force?: boolean, q?: string) => void;
  setShowSettings: (s: boolean) => void;
  tankLiters: number;
  aiAnswer: { question: string; answer: string; ts: number; source: 'ai' | 'local' } | null;
  clearAiAnswer: () => void;
  aiError?: string | null;
  clearAiError?: () => void;
  freschezzaDati?: string | null;
}

const PERIODI: Period[] = ['3M', '1Y', '5Y', 'MAX'];

const PERIODO_LABEL: Record<Period, string> = {
  '1M': 'un mese', '3M': 'tre mesi', '6M': 'sei mesi', '1Y': 'un anno', '5Y': 'cinque anni', MAX: 'dal 2020',
};

function colore(level: PriceLevel): string {
  return `var(${LEVEL_VAR[level]})`;
}

/** Verde quando il numero e una buona notizia per chi compra. */
function coloreDelta(v: number, soglia = 0.4): string {
  if (v <= -soglia) return 'var(--mf-price-best)';
  if (v >= soglia) return 'var(--mf-price-worst)';
  return 'var(--mf-ink-2)';
}

const cent = (v: number, dec = 1) => `${numero(Math.abs(v), dec)} cent`;
const segno = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '');

export function AnalysisTab(p: Props) {
  const [history, setHistory] = useState<Record<string, HistoryPoint[]>>({});
  const [period, setPeriod] = useState<Period>('1Y');
  const [hover, setHover] = useState<HistoryPoint | null>(null);
  const [tuttiMarchi, setTuttiMarchi] = useState(false);
  const [apertaCategoria, setApertaCategoria] = useState<number | null>(null);
  const [reportAperto, setReportAperto] = useState(false);
  const [ascolto, setAscolto] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  useEffect(() => { loadHistory().then(setHistory); }, []);

  // Dettatura: comoda in auto, dove scrivere non si puo.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = 'it-IT';
    rec.continuous = false;
    rec.interimResults = false;
    rec.onstart = () => setAscolto(true);
    rec.onend = () => setAscolto(false);
    rec.onerror = () => setAscolto(false);
    rec.onresult = (e: any) => {
      const testo = e.results?.[0]?.[0]?.transcript ?? '';
      if (testo.trim()) {
        p.setUserQuestion(testo);
        p.fetchAnalysis(p.selectedFuel, false, testo);
      }
      setAscolto(false);
    };
    setRecognition(rec);
    return () => { try { rec.abort(); } catch { /* era gia chiusa */ } };
  }, [p.selectedFuel, p.fetchAnalysis, p.setUserQuestion]);

  const serie = useMemo(() => getSeries(history, p.selectedFuel, period), [history, p.selectedFuel, period]);

  const m = p.model;
  const litri = p.tankLiters > 0 ? p.tankLiters : 50;
  const mediaZona = useNumeroAnimato(m?.zona?.avg ?? 0, !!m?.zona);

  const chiedi = () => {
    const q = p.userQuestion.trim();
    if (!q || p.analysisLoading) return;
    p.fetchAnalysis(p.selectedFuel, false, q);
  };

  const verso = m?.previsione?.direction ?? 'flat';
  const Freccia = verso === 'down' ? ArrowDownRight : verso === 'up' ? ArrowUpRight : Minus;
  const coloreVerso =
    verso === 'down' ? 'var(--mf-price-best)' : verso === 'up' ? 'var(--mf-price-worst)' : 'var(--mf-ink-2)';

  const massimoLivello = m ? Math.max(1, ...m.distribuzione.map((s) => s.n)) : 1;
  const marchiVisibili = m ? (tuttiMarchi ? m.marchi.slice(0, 12) : m.marchi.slice(0, 4)) : [];

  return (
    <motion.div
      key="analysis"
      variants={SCHERMATA}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-5 pb-32"
    >
      <motion.div variants={BLOCCO}>
        <PageTitle eyebrow="mercato" title="Come sta il prezzo" />
      </motion.div>

      <motion.div variants={BLOCCO} className="px-1">
        <FuelTabs
          value={toFuelKey(p.selectedFuel)}
          onChange={(k) => p.setSelectedFuel?.(toFuelType(k))}
        />
      </motion.div>

      {!m || m.campione === 0 || !m.zona ? (
        <motion.div variants={BLOCCO}>
          <Card pad="md">
            <Empty
              title="Ancora nessun confronto"
              hint="Serve la posizione e qualche impianto raggiungibile per dire come sta il prezzo qui."
            />
          </Card>
        </motion.div>
      ) : (
        <>
          {/* ── Il verdetto: una frase e il numero che la regge ──── */}
          <motion.div variants={BLOCCO}>
            <div
              className="px-6 py-6"
              style={{
                background: 'var(--mf-surface)',
                border: '1px solid var(--mf-hairline)',
                borderRadius: 'var(--mf-radius-lg)',
                boxShadow: 'var(--mf-edge-light)',
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  {m.verdetto && (
                    <>
                      <span
                        className="inline-flex items-center gap-2 px-3 py-1.5"
                        style={{
                          borderRadius: 'var(--mf-radius-pill)',
                          background: `color-mix(in srgb, ${colore(m.verdetto.tono)} 16%, transparent)`,
                          color: colore(m.verdetto.tono),
                          fontFamily: 'var(--mf-font-sans)',
                          fontWeight: 700,
                          fontSize: 12.5,
                        }}
                      >
                        {m.verdetto.titolo}
                      </span>
                      <p className="mt-4" style={{ color: 'var(--mf-ink)', fontSize: 15, lineHeight: 1.55 }}>
                        {m.verdetto.frase}
                      </p>
                    </>
                  )}
                </div>

                {m.previsione && (
                  <span
                    className="flex flex-shrink-0 items-center gap-1.5 px-2.5 py-1.5"
                    style={{
                      borderRadius: 'var(--mf-radius-pill)',
                      background: 'var(--mf-ground)',
                      border: '1px solid var(--mf-hairline)',
                      color: coloreVerso,
                      fontSize: 11.5,
                      fontWeight: 600,
                    }}
                  >
                    <Freccia size={13} />
                    {verso === 'down' ? 'in calo' : verso === 'up' ? 'in salita' : 'stabile'}
                  </span>
                )}
              </div>

              <div className="mt-6 flex items-end justify-between gap-4 pt-5" style={{ borderTop: '1px solid var(--mf-hairline)' }}>
                <div>
                  <div className="mf-label" style={{ fontSize: 9 }}>media della zona</div>
                  <div
                    className="mf-num mt-1.5"
                    style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.045em', color: 'var(--mf-ink)', lineHeight: 1 }}
                  >
                    {prezzoEuro(mediaZona)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="mf-label" style={{ fontSize: 9 }}>media italiana</div>
                  <div className="mf-num mt-1.5" style={{ fontSize: 20, color: 'var(--mf-ink-2)', fontWeight: 600 }}>
                    {m.nazionale ? prezzoEuro(m.nazionale.avg) : '—'}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── Le tessere: sei fatti, un colpo d'occhio ─────────── */}
          <WidgetGrid>
            {m.migliore && (
              <Widget
                label="il meglio raggiungibile"
                value={numero(m.migliore.price, 3)}
                color={colore(m.migliore.level)}
                icon={<Fuel size={11} />}
                sub={`${m.migliore.brand} · ${numero(m.migliore.km, 1)} km`}
              />
            )}
            <Widget
              label="quanto puoi risparmiare"
              value={m.risparmioMassimoEur !== null ? euro(m.risparmioMassimoEur) : null}
              color="var(--mf-price-best)"
              sub={m.spreadC !== null ? `${cent(m.spreadC, 0)} di forbice, su ${numero(litri)} litri` : undefined}
            />
            <Widget
              label="contro l’Italia"
              value={m.deltaZonaItaliaC !== null ? `${segno(m.deltaZonaItaliaC)}${cent(m.deltaZonaItaliaC)}` : null}
              color={m.deltaZonaItaliaC !== null ? coloreDelta(m.deltaZonaItaliaC, 0.8) : undefined}
              sub="al litro"
            />
            <Widget
              label="prezzi freschi"
              value={`${numero((m.freschezza.recenti / Math.max(1, m.freschezza.totale)) * 100, 0)}%`}
              color={
                m.freschezza.recenti / Math.max(1, m.freschezza.totale) > 0.5
                  ? 'var(--mf-price-best)'
                  : 'var(--mf-price-high)'
              }
              sub={`${m.freschezza.recenti} su ${m.freschezza.totale}, ultime 48 ore`}
            />
            {m.autostradaC !== null && (
              <Widget
                label="in autostrada"
                value={`+${cent(m.autostradaC)}`}
                color="var(--mf-price-worst)"
                icon={<Route size={11} />}
                sub={`${euro((m.autostradaC / 100) * litri)} a pieno`}
              />
            )}
            {m.servitoC !== null && (
              <Widget
                label="col servito"
                value={`+${cent(m.servitoC)}`}
                color="var(--mf-price-high)"
                sub={`${euro((m.servitoC / 100) * litri)} a pieno`}
              />
            )}
          </WidgetGrid>

          {/* ── Dove vanno i prezzi ──────────────────────────────── */}
          {m.previsione && (
            <motion.div variants={BLOCCO}>
              <Widget
                label={`previsione a ${m.previsione.daysAhead} giorni`}
                wide
                value={
                  m.previsione.usable
                    ? `${segno(m.previsione.deltaC)}${cent(m.previsione.deltaC)}`
                    : 'non pervenuta'
                }
                color={m.previsione.usable ? coloreDelta(m.previsione.deltaC, 0.3) : 'var(--mf-muted)'}
                sub={
                  !m.previsione.usable
                    ? 'Troppo incerta per metterci un numero sopra: meglio dirlo che inventarla.'
                    : m.previsioneEur !== null && m.previsioneEur > 0.3
                      ? <>Aspettare vale circa <b className="mf-num" style={{ color: 'var(--mf-price-best)' }}>{euro(m.previsioneEur)}</b> sul tuo pieno.</>
                      : m.previsioneEur !== null && m.previsioneEur < -0.3
                        ? <>Fare il pieno oggi vale circa <b className="mf-num" style={{ color: 'var(--mf-price-best)' }}>{euro(Math.abs(m.previsioneEur))}</b>.</>
                        : 'Niente che sposti la spesa: decidi sul prezzo di oggi.'
                }
              />
            </motion.div>
          )}

          {/* ── Dove finiscono i tuoi soldi ──────────────────────── */}
          {m.scomposizione && (
            <motion.div variants={BLOCCO}>
              <Widget label="dove finiscono i tuoi soldi" wide icon={<Landmark size={11} />}>
                <div className="mt-1">
                  <div
                    className="mf-num mb-4"
                    style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.035em', color: 'var(--mf-price-worst)', lineHeight: 1.05 }}
                  >
                    {numero(m.scomposizione.quotaTasse * 100, 0)}% tasse
                  </div>
                  <BarraSegmenti
                    segmenti={[
                      { quota: m.scomposizione.prodotto, colore: 'var(--mf-accent)', etichetta: `prodotto ${numero(m.scomposizione.prodotto, 3)}` },
                      { quota: m.scomposizione.accisa, colore: 'var(--mf-price-worst)', etichetta: `accisa ${numero(m.scomposizione.accisa, 3)}` },
                      { quota: m.scomposizione.iva, colore: 'var(--mf-price-high)', etichetta: `IVA ${numero(m.scomposizione.iva, 3)}` },
                    ]}
                  />
                  <p className="mt-4" style={{ color: 'var(--mf-ink-2)', fontSize: 12, lineHeight: 1.55 }}>
                    Di {prezzoEuro(m.scomposizione.prezzo)} al litro, <b className="mf-num">{prezzoEuro(m.scomposizione.tasse)}</b> sono
                    accisa e IVA. È anche il motivo per cui il prezzo si muove meno del petrolio: la parte che
                    oscilla è solo quella azzurra.
                  </p>
                </div>
              </Widget>
            </motion.div>
          )}

          {/* ── Il giorno della settimana ────────────────────────── */}
          {m.ritmo.giorni.length === 7 && (
            <motion.div variants={BLOCCO}>
              <Widget label="c’è un giorno migliore?" wide icon={<CalendarDays size={11} />}>
                <div className="mt-1">
                  <div
                    className="mf-num mb-4"
                    style={{
                      fontSize: 26,
                      fontWeight: 700,
                      letterSpacing: '-0.035em',
                      lineHeight: 1.1,
                      color: m.ritmo.significativo ? 'var(--mf-price-best)' : 'var(--mf-ink-2)',
                      fontFamily: 'var(--mf-font-sans)',
                    }}
                  >
                    {m.ritmo.significativo ? `Il ${m.ritmo.migliore!.nome}` : 'No, è una leggenda'}
                  </div>

                  <div className="flex items-end gap-1.5" style={{ height: 54 }}>
                    {[1, 2, 3, 4, 5, 6, 0].map((g) => {
                      const d = m.ritmo.giorni.find((x) => x.giorno === g);
                      if (!d) return <div key={g} className="flex-1" />;
                      const massimo = Math.max(...m.ritmo.giorni.map((x) => Math.abs(x.scartoC)), 0.1);
                      const h = (Math.abs(d.scartoC) / massimo) * 100;
                      const sotto = d.scartoC < 0;
                      return (
                        <div key={g} className="flex flex-1 flex-col items-center justify-end gap-1">
                          <div
                            title={`${d.nome}: ${segno(d.scartoC)}${numero(Math.abs(d.scartoC), 2)} cent`}
                            style={{
                              width: '100%',
                              height: `${Math.max(6, h)}%`,
                              borderRadius: 3,
                              background: sotto ? 'var(--mf-price-best)' : 'var(--mf-price-worst)',
                              opacity: m.ritmo.significativo ? 0.9 : 0.35,
                            }}
                          />
                          <span className="mf-label" style={{ fontSize: 8 }}>
                            {d.nome.slice(0, 2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <p className="mt-4" style={{ color: 'var(--mf-ink-2)', fontSize: 12, lineHeight: 1.55 }}>
                    {m.ritmo.significativo ? (
                      <>
                        Sullo storico, il {m.ritmo.migliore!.nome} costa in media{' '}
                        <b className="mf-num">{numero(Math.abs(m.ritmo.migliore!.scartoC), 2)} cent</b> meno della sua
                        settimana, il {m.ritmo.peggiore!.nome} è il peggiore. Su un pieno sono{' '}
                        {euro((m.ritmo.ampiezzaC / 100) * litri)}: poco, ma è gratis.
                      </>
                    ) : (
                      <>
                        Fra il giorno più economico e il più caro ballano{' '}
                        <b className="mf-num">{numero(m.ritmo.ampiezzaC, 2)} cent</b> al litro — dentro il rumore.
                        Aspettare il giorno giusto non serve: conta molto di più dove ti fermi.
                      </>
                    )}
                  </p>
                </div>
              </Widget>
            </motion.div>
          )}

          {/* ── Com'e messa la zona ──────────────────────────────── */}
          <motion.div variants={BLOCCO}>
            <Widget label="com’è messa la zona" wide>
              <div className="mt-3 space-y-2">
                {m.distribuzione.map((s) => (
                  <div key={s.level} className="flex items-center gap-3">
                    <span
                      className="flex-shrink-0"
                      style={{ width: 80, fontSize: 12, color: s.n > 0 ? 'var(--mf-ink)' : 'var(--mf-muted)' }}
                    >
                      {LEVEL_LABEL[s.level]}
                    </span>
                    <div
                      className="min-w-0 flex-1"
                      style={{ height: 7, borderRadius: 'var(--mf-radius-pill)', background: 'var(--mf-ground)' }}
                    >
                      <div
                        style={{
                          width: `${(s.n / massimoLivello) * 100}%`,
                          height: '100%',
                          borderRadius: 'var(--mf-radius-pill)',
                          background: colore(s.level),
                          transition: 'width 340ms ease-out',
                        }}
                      />
                    </div>
                    <span
                      className="mf-num flex-shrink-0 text-right"
                      style={{ width: 30, fontSize: 12, color: s.n > 0 ? 'var(--mf-ink)' : 'var(--mf-muted)' }}
                    >
                      {s.n}
                    </span>
                  </div>
                ))}
              </div>
            </Widget>
          </motion.div>

          {/* ── Chi costa meno ───────────────────────────────────── */}
          {m.marchi.length >= 2 && (
            <motion.div variants={BLOCCO}>
              <Section
                title="Chi costa meno"
                aside={
                  m.marchi.length > 4 ? (
                    <button
                      onClick={() => setTuttiMarchi((v) => !v)}
                      style={{ color: 'var(--mf-accent)', fontSize: 12, fontWeight: 600, fontFamily: 'var(--mf-font-sans)' }}
                    >
                      {tuttiMarchi ? 'meno' : `tutti e ${m.marchi.length}`}
                    </button>
                  ) : undefined
                }
              >
                <Card pad="none">
                  {marchiVisibili.map((b, i) => (
                    <div
                      key={b.brand}
                      className="flex items-center gap-3 px-4 py-3"
                      style={{ borderTop: i === 0 ? 'none' : '1px solid var(--mf-hairline)' }}
                    >
                      <BrandLogo brand={b.brand} size={28} />
                      <span
                        className="min-w-0 flex-1 truncate"
                        style={{ fontFamily: 'var(--mf-font-sans)', fontWeight: 500, fontSize: 14, color: 'var(--mf-ink)' }}
                      >
                        {b.brand}
                      </span>
                      <span
                        className="mf-num flex-shrink-0"
                        style={{ fontSize: 11, color: 'var(--mf-muted)', width: 26, textAlign: 'right' }}
                      >
                        {b.n}
                      </span>
                      <span
                        className="mf-num flex-shrink-0"
                        style={{ fontSize: 11.5, color: coloreDelta(b.delta), width: 54, textAlign: 'right' }}
                      >
                        {segno(b.delta)}{numero(Math.abs(b.delta), 1)}
                      </span>
                      <span
                        className="mf-num flex-shrink-0"
                        style={{ fontSize: 14, fontWeight: 600, color: 'var(--mf-ink)', width: 48, textAlign: 'right' }}
                      >
                        {numero(b.avg, 3)}
                      </span>
                    </div>
                  ))}
                </Card>
              </Section>
            </motion.div>
          )}

          {/* ── Storico ──────────────────────────────────────────── */}
          <motion.div variants={BLOCCO}>
            <Section title="Storico">
              <Card pad="md">
                <div className="mb-4 flex gap-1.5">
                  {PERIODI.map((per) => {
                    const attivo = per === period;
                    return (
                      <button
                        key={per}
                        onClick={() => setPeriod(per)}
                        className="mf-num flex-1 py-1.5 transition-colors"
                        style={{
                          borderRadius: 'var(--mf-radius-pill)',
                          fontSize: 11,
                          background: attivo ? 'var(--mf-accent)' : 'transparent',
                          color: attivo ? 'var(--mf-accent-ink)' : 'var(--mf-ink-2)',
                          border: `1px solid ${attivo ? 'var(--mf-accent)' : 'var(--mf-hairline)'}`,
                        }}
                      >
                        {per}
                      </button>
                    );
                  })}
                </div>

                <PriceChart data={serie} trend={p.marketRef?.trend ?? 'STABLE'} height={170} onHover={setHover} />

                <p className="mt-3" style={{ color: 'var(--mf-ink-2)', fontSize: 11.5, lineHeight: 1.5 }}>
                  {hover
                    ? `${new Date(hover.ts).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })} — ${prezzoEuro(hover.avg)}`
                    : `Media nazionale, ${PERIODO_LABEL[period]}.`}
                </p>

                {m.confronti.length > 0 && (
                  <div className="mt-4 flex gap-2 pt-4" style={{ borderTop: '1px solid var(--mf-hairline)' }}>
                    {m.confronti.map((c) => (
                      <div key={c.giorni} className="flex-1">
                        <div className="mf-label truncate" style={{ fontSize: 9 }}>{c.label}</div>
                        <div
                          className="mf-num mt-1"
                          style={{ fontSize: 16, fontWeight: 600, color: coloreDelta(c.delta) }}
                        >
                          {pctDelta(c.delta)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </Section>
          </motion.div>
        </>
      )}

      {/* ── Guasto dell'IA ─────────────────────────────────────── */}
      {p.aiError && (
        <motion.div variants={BLOCCO}>
          <Card pad="md" style={{ borderColor: 'var(--mf-price-high)' }}>
            <div className="flex items-start gap-3">
              <AlertCircle size={18} style={{ color: 'var(--mf-price-high)', flexShrink: 0, marginTop: 1 }} />
              <div className="min-w-0 flex-1">
                <p style={{ color: 'var(--mf-ink)', fontSize: 13.5, lineHeight: 1.5 }}>{p.aiError}</p>
                <p className="mt-1" style={{ color: 'var(--mf-ink-2)', fontSize: 12 }}>
                  Tutto quello che vedi qui sopra è calcolato sul telefono, quindi resta valido.
                </p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" tone="ghost" onClick={() => p.setShowSettings(true)}>Impostazioni</Button>
                  <Button size="sm" tone="quiet" onClick={() => p.fetchAnalysis(p.selectedFuel, true)}>Riprova</Button>
                </div>
              </div>
              {p.clearAiError && (
                <button onClick={p.clearAiError} aria-label="Chiudi l’avviso" style={{ color: 'var(--mf-muted)' }}>
                  <X size={16} />
                </button>
              )}
            </div>
          </Card>
        </motion.div>
      )}

      {/* ── Chiedi ─────────────────────────────────────────────── */}
      <motion.div variants={BLOCCO}>
        <Section title="Chiedi">
          <Card pad="md">
            {!p.apiKey && (
              <div className="mb-2">
                <Empty
                  icon={<KeyRound size={20} />}
                  title="Rispondo con i miei calcoli"
                  hint="Con una chiave Gemini nelle impostazioni le risposte diventano più discorsive e tengono conto delle notizie."
                  action={<Button size="sm" tone="ghost" onClick={() => p.setShowSettings(true)}>Impostazioni</Button>}
                />
              </div>
            )}

            <div className="flex items-center gap-2 px-1" style={{ opacity: p.analysisLoading ? 0.5 : 1 }}>
              <input
                value={p.userQuestion}
                onChange={(e) => p.setUserQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') chiedi(); }}
                placeholder="Conviene aspettare domani?"
                className="w-full border-none bg-transparent outline-none"
                style={{ color: 'var(--mf-ink)', fontFamily: 'var(--mf-font-sans)', fontSize: 15, padding: '10px 0' }}
              />
              {recognition && (
                <button
                  onClick={() => { try { if (ascolto) recognition.stop(); else recognition.start(); } catch { /* gia in corso */ } }}
                  aria-label="Detta la domanda"
                  className="flex flex-shrink-0 items-center justify-center"
                  style={{
                    width: 38, height: 38, borderRadius: 'var(--mf-radius-pill)',
                    background: ascolto ? 'var(--mf-accent)' : 'var(--mf-ground)',
                    color: ascolto ? 'var(--mf-accent-ink)' : 'var(--mf-ink-2)',
                    border: '1px solid var(--mf-hairline)',
                  }}
                >
                  <Mic size={16} />
                </button>
              )}
              <button
                onClick={chiedi}
                disabled={!p.userQuestion.trim() || p.analysisLoading}
                aria-label="Invia la domanda"
                className="flex flex-shrink-0 items-center justify-center"
                style={{
                  width: 38, height: 38, borderRadius: 'var(--mf-radius-pill)',
                  background: p.userQuestion.trim() ? 'var(--mf-accent)' : 'var(--mf-ground)',
                  color: p.userQuestion.trim() ? 'var(--mf-accent-ink)' : 'var(--mf-muted)',
                  border: '1px solid var(--mf-hairline)',
                }}
              >
                {p.analysisLoading ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>

            <AnimatePresence>
              {p.aiAnswer && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--mf-hairline)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <p style={{ color: 'var(--mf-ink-2)', fontSize: 12, fontStyle: 'italic' }}>
                        {p.aiAnswer.question}
                      </p>
                      <button onClick={p.clearAiAnswer} aria-label="Chiudi la risposta" style={{ color: 'var(--mf-muted)' }}>
                        <X size={16} />
                      </button>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap" style={{ color: 'var(--mf-ink)', fontSize: 14, lineHeight: 1.6 }}>
                      {p.aiAnswer.answer}
                    </p>
                    <p className="mf-label mt-3" style={{ fontSize: 9 }}>
                      {p.aiAnswer.source === 'ai' ? 'risposta ia' : 'calcolata sul telefono'}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </Section>
      </motion.div>

      {/* ── Il commento dell'analisi ───────────────────────────── */}
      {p.marketRef && !p.analysisIsLocal && (p.marketRef.reasoning || p.marketRef.categories?.length) && (
        <motion.div variants={BLOCCO}>
          <Section title="Cosa dice l’analisi">
            <Card pad="none">
              {p.marketRef.reasoning && (
                <div className="px-4 py-4">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <Sparkles size={12} style={{ color: 'var(--mf-accent)' }} />
                    <span className="mf-label" style={{ fontSize: 9 }}>lettura del mercato</span>
                  </div>
                  <p style={{ color: 'var(--mf-ink)', fontSize: 13.5, lineHeight: 1.6 }}>{p.marketRef.reasoning}</p>
                </div>
              )}

              {p.marketRef.categories?.map((c, i) => {
                const aperta = apertaCategoria === i;
                return (
                  <div key={i} style={{ borderTop: '1px solid var(--mf-hairline)' }}>
                    <button
                      onClick={() => setApertaCategoria(aperta ? null : i)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
                    >
                      <span style={{ fontFamily: 'var(--mf-font-sans)', fontWeight: 600, fontSize: 14, color: 'var(--mf-ink)' }}>
                        {c.title}
                      </span>
                      <ChevronDown
                        size={17}
                        style={{
                          color: 'var(--mf-muted)',
                          flexShrink: 0,
                          transform: aperta ? 'rotate(180deg)' : 'none',
                          transition: 'transform 160ms',
                        }}
                      />
                    </button>
                    <AnimatePresence>
                      {aperta && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <p className="px-4 pb-4" style={{ color: 'var(--mf-ink-2)', fontSize: 13, lineHeight: 1.6 }}>
                            {c.content}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {p.marketRef.detailedReport && (
                <div style={{ borderTop: '1px solid var(--mf-hairline)' }}>
                  <button
                    onClick={() => setReportAperto((v) => !v)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
                  >
                    <span style={{ fontFamily: 'var(--mf-font-sans)', fontWeight: 600, fontSize: 14, color: 'var(--mf-ink)' }}>
                      Report completo
                    </span>
                    <ChevronDown
                      size={17}
                      style={{ color: 'var(--mf-muted)', transform: reportAperto ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }}
                    />
                  </button>
                  <AnimatePresence>
                    {reportAperto && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <p className="whitespace-pre-wrap px-4 pb-4" style={{ color: 'var(--mf-ink-2)', fontSize: 13, lineHeight: 1.65 }}>
                          {p.marketRef.detailedReport}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </Card>
          </Section>
        </motion.div>
      )}

      <motion.div variants={BLOCCO} className="px-1 pt-1">
        <p className="mb-3 text-center" style={{ color: 'var(--mf-muted)', fontSize: 11 }}>
          {p.freschezzaDati}
        </p>
        <Button
          tone="ghost"
          size="sm"
          full
          icon={<RefreshCw size={14} />}
          disabled={p.analysisLoading}
          onClick={() => p.fetchAnalysis(p.selectedFuel, true)}
        >
          {p.analysisLoading ? 'Sto rileggendo i prezzi…' : 'Rileggi i prezzi'}
        </Button>
      </motion.div>
    </motion.div>
  );
}

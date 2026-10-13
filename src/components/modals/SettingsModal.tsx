import { useState, useEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import { Check, ExternalLink, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { Preferences } from '@capacitor/preferences';
import { Sheet } from '../../design/primitives/Sheet';
import { Button } from '../../design/primitives/Button';
import { Toggle } from '../../design/primitives/Toggle';
import { Field } from '../../design/primitives/Field';
import { provaChiave, chiediModelli, MODELLI_DI_RIPIEGO } from '../../services/geminiService';
import type { ModelloIa } from '../../services/geminiService';
import { resetDatasetCache } from '../../data/dataset';

interface Props {
  show: boolean; setShow: (v: boolean) => void;
  apiKey: string; setApiKey: (v: string) => void;
  apiModel: string; setApiModel: (v: string) => void;
  homeAddress?: string;
  onOpenHomeAddressModal?: () => void;
}


const ZOOM_LABEL: Record<number, string> = {
  11: 'tutta la citta',
  12: 'area urbana',
  13: 'quartiere largo',
  14: 'standard',
  15: 'quartiere stretto',
  16: 'strade vicine',
  17: 'molto vicino',
  18: 'massimo dettaglio',
};

type EsitoProva = { stato: 'idle' } | { stato: 'corso' } | { stato: 'ok' } | { stato: 'ko'; messaggio: string };

export function SettingsModal(p: Props) {
  const [zoom, setZoom] = useState(14);

  /**
   * La lista dei modelli la dice Google, non noi: con una chiave valida si
   * chiede l'elenco vero, senza chiave restano quattro sigle di ripiego.
   * Scriverla a mano voleva dire mostrare modelli inesistenti e far
   * prendere un errore a chi li sceglieva.
   */
  const [modelli, setModelli] = useState<ModelloIa[]>(MODELLI_DI_RIPIEGO);
  const [caricoModelli, setCaricoModelli] = useState(false);

  useEffect(() => {
    if (!p.show || !p.apiKey.trim()) return;
    let vivo = true;
    setCaricoModelli(true);
    chiediModelli(p.apiKey).then((lista) => {
      if (vivo) {
        setModelli(lista);
        setCaricoModelli(false);
      }
    });
    return () => { vivo = false; };
  }, [p.show, p.apiKey]);
  const [vibrazione, setVibrazione] = useState(true);
  const [mostraChiave, setMostraChiave] = useState(false);
  const [prova, setProva] = useState<EsitoProva>({ stato: 'idle' });

  useEffect(() => {
    if (!p.show) return;
    setProva({ stato: 'idle' });
    Preferences.get({ key: 'mf_widget_map_zoom' }).then((r: any) => {
      if (r.value) setZoom(parseInt(r.value) || 14);
    });
    Preferences.get({ key: 'mf_haptics_disabled' }).then((r: any) => {
      setVibrazione(r.value !== 'true');
    });
  }, [p.show]);

  const cambiaZoom = async (v: number) => {
    setZoom(v);
    await Preferences.set({ key: 'mf_widget_map_zoom', value: String(v) });
  };

  const cambiaVibrazione = async () => {
    const nuovo = !vibrazione;
    setVibrazione(nuovo);
    const spente = String(!nuovo);
    await Preferences.set({ key: 'mf_haptics_disabled', value: spente });
    localStorage.setItem('mf_haptics_disabled', spente);
  };

  const salvaChiave = (v: string) => {
    p.setApiKey(v);
    localStorage.setItem('martucc_fuel_api_key', v);
    setProva({ stato: 'idle' });
  };

  const eseguiProva = async () => {
    setProva({ stato: 'corso' });
    const esito = await provaChiave(p.apiKey, p.apiModel);
    setProva(esito.ok ? { stato: 'ok' } : { stato: 'ko', messaggio: esito.messaggio });
  };

  const ultimoAggiornamento = (() => {
    const t = localStorage.getItem('mf_last_fetch_time');
    if (!t) return null;
    const d = new Date(Number(t));
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  })();

  return (
    <AnimatePresence>
      {p.show && (
        <Sheet onClose={() => p.setShow(false)} title="Impostazioni">
          <div className="space-y-8 px-1 py-2">
            {/* Intelligenza artificiale */}
            <section>
              <div className="mf-label mb-3" style={{ fontSize: 9 }}>intelligenza artificiale</div>

              <Field
                label="chiave api google gemini"
                hint="Opzionale. Serve per le spiegazioni a parole, i consigli avanzati e lo scanner degli scontrini."
              >
                <div className="flex items-center gap-2">
                  <input
                    type={mostraChiave ? 'text' : 'password'}
                    value={p.apiKey}
                    onChange={(e) => salvaChiave(e.target.value)}
                    placeholder="AIzaSy..."
                    className="mf-num w-full min-w-0 border-none bg-transparent outline-none"
                    style={{ color: 'var(--mf-ink)', fontSize: 13 }}
                  />
                  <button
                    type="button"
                    onClick={() => setMostraChiave((v) => !v)}
                    className="p-1"
                    style={{ color: 'var(--mf-ink-2)' }}
                    aria-label={mostraChiave ? 'Nascondi chiave' : 'Mostra chiave'}
                  >
                    {mostraChiave ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </Field>

              <div className="mt-3 flex items-center gap-3">
                <Button
                  tone="primary"
                  size="sm"
                  disabled={!p.apiKey || prova.stato === 'corso'}
                  onClick={eseguiProva}
                  icon={prova.stato === 'corso' ? <Loader2 size={14} className="animate-spin" /> : undefined}
                >
                  {prova.stato === 'corso' ? 'Provo…' : 'Prova la chiave'}
                </Button>

                {prova.stato === 'ok' && (
                  <span className="flex items-center gap-1.5" style={{ color: 'var(--mf-price-best)', fontSize: 12 }}>
                    <Check size={14} /> funziona
                  </span>
                )}
                {prova.stato === 'ko' && (
                  <span className="flex min-w-0 items-start gap-1.5" style={{ color: 'var(--mf-price-worst)', fontSize: 12 }}>
                    <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                    <span>{prova.messaggio}</span>
                  </span>
                )}
              </div>

              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5"
                style={{ color: 'var(--mf-accent)', fontSize: 12.5 }}
              >
                Prendi una chiave gratis su Google AI Studio <ExternalLink size={12} />
              </a>

              <div className="mf-label mb-2 mt-6 flex items-center gap-2" style={{ fontSize: 9 }}>
                <span>modello</span>
                {caricoModelli && <Loader2 size={11} className="animate-spin" style={{ color: 'var(--mf-ink-2)' }} />}
              </div>
              <div
                style={{
                  background: 'var(--mf-ground)',
                  border: '1px solid var(--mf-hairline)',
                  borderRadius: 'var(--mf-radius-md)',
                  overflow: 'hidden',
                }}
              >
                {modelli.map((m, i) => {
                  const attivo = p.apiModel === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        p.setApiModel(m.id);
                        localStorage.setItem('martucc_fuel_api_model', m.id);
                        setProva({ stato: 'idle' });
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                      style={{ borderTop: i === 0 ? 'none' : '1px solid var(--mf-hairline)' }}
                    >
                      <span className="min-w-0 flex-1">
                        <span
                          className="block truncate"
                          style={{ fontFamily: 'var(--mf-font-sans)', fontWeight: attivo ? 600 : 500, fontSize: 14, color: 'var(--mf-ink)' }}
                        >
                          {m.nome}
                        </span>
                        <span className="block truncate" style={{ color: 'var(--mf-ink-2)', fontSize: 11.5 }}>
                          {m.nota}
                        </span>
                      </span>
                      {attivo && <Check size={16} style={{ color: 'var(--mf-accent)', flexShrink: 0 }} />}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3">
                <Field label="oppure id modello personalizzato">
                  <input
                    type="text"
                    value={p.apiModel}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      p.setApiModel(v);
                      localStorage.setItem('martucc_fuel_api_model', v);
                      setProva({ stato: 'idle' });
                    }}
                    placeholder="una sigla non in elenco"
                    className="mf-num w-full min-w-0 border-none bg-transparent outline-none"
                    style={{ color: 'var(--mf-ink)', fontSize: 13 }}
                  />
                </Field>
              </div>
            </section>

            {/* Indirizzo di Casa */}
            <section>
              <div className="mf-label mb-3" style={{ fontSize: 9 }}>indirizzo di casa</div>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div style={{ fontFamily: 'var(--mf-font-sans)', fontWeight: 600, fontSize: 14, color: 'var(--mf-ink)' }}>
                    Destinazione Casa
                  </div>
                  <p className="mt-0.5 truncate" style={{ color: 'var(--mf-ink-2)', fontSize: 12 }}>
                    {p.homeAddress ? p.homeAddress : 'Non ancora impostato'}
                  </p>
                </div>
                <Button
                  tone="primary"
                  size="sm"
                  onClick={p.onOpenHomeAddressModal}
                >
                  {p.homeAddress ? 'Modifica' : 'Imposta'}
                </Button>
              </div>
            </section>

            {/* Comportamento */}
            <section>
              <div className="mf-label mb-3" style={{ fontSize: 9 }}>comportamento</div>

              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div style={{ fontFamily: 'var(--mf-font-sans)', fontWeight: 600, fontSize: 14, color: 'var(--mf-ink)' }}>
                    Vibrazione al tocco
                  </div>
                  <p className="mt-0.5" style={{ color: 'var(--mf-ink-2)', fontSize: 12 }}>
                    Un colpetto quando premi qualcosa che conta.
                  </p>
                </div>
                <Toggle on={vibrazione} onChange={cambiaVibrazione} ariaLabel="Vibrazione al tocco" />
              </div>

              <div className="mt-6">
                <div className="flex items-baseline justify-between gap-3">
                  <div style={{ fontFamily: 'var(--mf-font-sans)', fontWeight: 600, fontSize: 14, color: 'var(--mf-ink)' }}>
                    Zoom del widget
                  </div>
                  <span className="mf-num" style={{ color: 'var(--mf-accent)', fontSize: 12 }}>
                    {ZOOM_LABEL[zoom] ?? zoom}
                  </span>
                </div>
                <p className="mt-0.5" style={{ color: 'var(--mf-ink-2)', fontSize: 12 }}>
                  Quanto stretta è la mappa nel widget della schermata home del telefono.
                </p>
                <input
                  type="range"
                  min={11}
                  max={18}
                  value={zoom}
                  onChange={(e) => cambiaZoom(Number(e.target.value))}
                  className="mt-3 w-full"
                  style={{ accentColor: 'var(--mf-accent)' }}
                />
              </div>
            </section>

            {/* Dati */}
            <section>
              <div className="mf-label mb-3" style={{ fontSize: 9 }}>dati</div>
              <p style={{ color: 'var(--mf-ink-2)', fontSize: 12.5, lineHeight: 1.55 }}>
                I prezzi arrivano dal Ministero e restano sul telefono, cosi l&apos;app funziona anche senza
                rete. {ultimoAggiornamento ? `Ultimo aggiornamento ${ultimoAggiornamento}.` : ''}
              </p>
              <div className="mt-4">
                <Button
                  full
                  tone="quiet"
                  size="md"
                  onClick={() => {
                    resetDatasetCache();
                    localStorage.removeItem('mf_last_fetch_time');
                    Object.keys(localStorage)
                      .filter((k) => k.startsWith('mf_analysis_'))
                      .forEach((k) => localStorage.removeItem(k));
                    window.location.reload();
                  }}
                >
                  Scarica di nuovo tutto
                </Button>
              </div>
            </section>

            <p className="pt-2 text-center" style={{ color: 'var(--mf-muted)', fontSize: 11 }}>
              MartuccFuel · prezzi del Ministero delle Imprese e del Made in Italy
            </p>
          </div>
        </Sheet>
      )}
    </AnimatePresence>
  );
}

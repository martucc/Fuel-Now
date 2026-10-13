import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Camera, Fuel, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';
import type { Fillup, FuelType } from '../types';
import {
  addFillup, computeStats, fillupsForCar, removeFillup, updateFillup, defaultFuelType,
} from '../services/fillupService';
import { scanReceiptWithGemini } from '../services/receiptScannerService';
import { Card, Section, Empty } from '../design/primitives/Surface';
import { Button } from '../design/primitives/Button';
import { Sheet } from '../design/primitives/Sheet';
import { Field, Input, ChipGroup } from '../design/primitives/Field';
import { Toggle } from '../design/primitives/Toggle';
import { euro, numero, prezzo, chilometri as km, litri } from '../lib/formato';

interface PrefillData {
  stationName?: string;
  pricePerLiter?: number;
  fuelType?: FuelType;
  total?: number;
  date?: string;
  odometer?: number;
  fromScan?: boolean;
}

interface Props {
  carModel: string;
  carTags?: string;
  wltpKml?: number;
  tankLiters?: number;
  prefillNew?: PrefillData | null;
  onPrefillConsumed?: () => void;
}

const FUELS: FuelType[] = ['Benzina', 'Diesel', 'GPL', 'Metano'];

const dataIt = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });

/** «1888» diventa «1.888»: al distributore si digita senza virgola. */
function prezzoAuto(v: string): string {
  if (/[.,]/.test(v)) return v;
  const cifre = v.replace(/\D/g, '');
  if (cifre.length === 0) return '';
  if (cifre.length === 1) return cifre;
  return cifre[0] + '.' + cifre.slice(1, 4);
}

export function FillupTracker({ carModel, carTags, wltpKml, tankLiters, prefillNew, onPrefillConsumed }: Props) {
  const [fills, setFills] = useState<Fillup[]>(() => fillupsForCar(carModel));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Fillup | null>(null);
  const [prefill, setPrefill] = useState<PrefillData | null>(null);
  const [daCancellare, setDaCancellare] = useState<string | null>(null);

  // Scanner scontrino state
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (prefillNew) {
      setEditing(null);
      setPrefill(prefillNew);
      setOpen(true);
      onPrefillConsumed?.();
    }
  }, [prefillNew]);

  useEffect(() => {
    setFills(fillupsForCar(carModel));
    setDaCancellare(null);
    setEditing(null);
  }, [carModel]);

  const stats = useMemo(() => computeStats(fills, wltpKml), [fills, wltpKml]);
  const ordinati = useMemo(() => [...fills].sort((a, b) => b.odometer - a.odometer), [fills]);
  const scostamento = stats.vsWltpPct;

  const aggiorna = (next: Fillup[]) => {
    setFills(next.filter((x) => x.carModel === carModel).sort((a, b) => a.odometer - b.odometer));
    window.dispatchEvent(new Event('mf-fillup-changed'));
  };

  const avviaScansione = () => {
    const key = localStorage.getItem('martucc_fuel_api_key') || '';
    if (!key.trim()) {
      setScanError('Per scansionare lo scontrino con l\'IA, inserisci la tua chiave Gemini nelle Impostazioni.');
      setTimeout(() => setScanError(null), 5000);
      return;
    }
    setScanError(null);
    fileInputRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const key = localStorage.getItem('martucc_fuel_api_key') || '';
    const model = localStorage.getItem('martucc_fuel_api_model') || 'gemini-2.5-flash';

    setScanning(true);
    setScanError(null);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64 = await base64Promise;

      const res = await scanReceiptWithGemini(base64, file.type, key, model);

      setPrefill({
        stationName: res.stationName,
        fuelType: res.fuelType,
        pricePerLiter: res.pricePerLiter,
        total: res.total,
        date: res.date,
        odometer: res.odometer,
        fromScan: true,
      });
      setEditing(null);
      setOpen(true);
    } catch (err: any) {
      setScanError(err?.message || 'Errore durante la lettura dello scontrino. Riprova con una foto più nitida.');
      setTimeout(() => setScanError(null), 6000);
    } finally {
      setScanning(false);
    }
  };

  return (
    <Section
      title="I tuoi pieni"
      aside={
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={fileInputRef}
            onChange={handleFile}
            className="hidden"
          />
          <button
            onClick={avviaScansione}
            disabled={scanning}
            className="flex items-center gap-1.5 transition-colors active:scale-95"
            style={{
              color: 'var(--mf-accent)',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'var(--mf-font-sans)',
            }}
          >
            {scanning ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            {scanning ? 'Leggo...' : 'Scontrino'}
          </button>
          <button
            onClick={() => { setEditing(null); setPrefill(null); setOpen(true); }}
            className="flex items-center gap-1"
            style={{ color: 'var(--mf-ink)', fontSize: 12, fontWeight: 600, fontFamily: 'var(--mf-font-sans)' }}
          >
            <Plus size={14} /> segna
          </button>
        </div>
      }
    >
      {/* Toast di errore / alert scansione */}
      {scanError && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3 px-3.5 py-2.5"
          style={{
            background: 'color-mix(in srgb, var(--mf-price-worst) 15%, transparent)',
            border: '1px solid var(--mf-price-worst)',
            borderRadius: 'var(--mf-radius-md)',
            color: 'var(--mf-price-worst)',
            fontSize: 12.5,
          }}
        >
          {scanError}
        </motion.div>
      )}

      {stats.count > 0 && (
        <Card pad="lg">
          <div className="mf-label" style={{ fontSize: 9 }}>
            {stats.realKml ? 'consumo reale' : 'consumo'}
          </div>
          <div className="flex items-baseline gap-2">
            <div
              className="mf-num mt-2"
              style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.045em', color: 'var(--mf-ink)', lineHeight: 1 }}
            >
              {stats.realKml ? numero(stats.realKml, 1) : '—'}
            </div>
            <span className="mf-num" style={{ color: 'var(--mf-ink-2)', fontSize: 16 }}>km/L</span>
          </div>

          <div
            className="mt-4 pt-3 flex items-center justify-between"
            style={{ borderTop: '1px solid var(--mf-hairline)', fontSize: 12.5 }}
          >
            <span style={{ color: 'var(--mf-ink-2)' }}>
              {stats.count} {stats.count === 1 ? 'pieno calcolato' : 'pieni calcolati'}
            </span>
            {/* vsWltpPct = (km/l reali − km/l dichiarati) / dichiarati.
                POSITIVO vuol dire che fai piu strada con un litro, cioe
                consumi meno: e il caso buono. Fra +3% e −3% e rumore di
                misura e non si da un verdetto. */}
            {wltpKml && scostamento != null ? (
              <span
                className="mf-num"
                style={{
                  color:
                    scostamento > 3
                      ? 'var(--mf-price-best)'
                      : scostamento < -3
                        ? 'var(--mf-price-worst)'
                        : 'var(--mf-ink-2)',
                  fontWeight: 600,
                }}
              >
                {scostamento > 3
                  ? `${numero(scostamento, 0)}% meglio del dichiarato`
                  : scostamento < -3
                    ? `${numero(Math.abs(scostamento), 0)}% peggio del dichiarato`
                    : 'in linea col dichiarato'}
              </span>
            ) : null}
          </div>
        </Card>
      )}

      <Card pad="none">
        {ordinati.length === 0 ? (
          <Empty
            icon={<Fuel size={24} />}
            title="Nessun pieno registrato"
            hint="Fotografa lo scontrino o tocca «segna» dopo aver fatto rifornimento."
          />
        ) : (
          ordinati.map((f, i) => (
            <div
              key={f.id}
              className="flex items-center gap-3 px-4 py-3.5"
              style={{ borderTop: i === 0 ? 'none' : '1px solid var(--mf-hairline)' }}
            >
              <button
                onClick={() => { setPrefill(null); setEditing(f); setOpen(true); }}
                className="min-w-0 flex-1 text-left"
              >
                <div className="flex items-baseline gap-2">
                  <span
                    className="truncate"
                    style={{ fontFamily: 'var(--mf-font-sans)', fontWeight: 600, fontSize: 14, color: 'var(--mf-ink)' }}
                  >
                    {f.stationName || f.fuelType}
                  </span>
                  <span className="mf-num flex-shrink-0" style={{ color: 'var(--mf-ink-2)', fontSize: 11 }}>
                    {dataIt(f.date)}
                  </span>
                </div>
                <div className="mf-num mt-0.5" style={{ color: 'var(--mf-ink-2)', fontSize: 12 }}>
                  {litri(f.liters)} · {prezzo(f.pricePerLiter)} €/L · {km(f.odometer)}
                </div>
              </button>
              <span className="mf-num flex-shrink-0" style={{ fontSize: 15, fontWeight: 600, color: 'var(--mf-ink)' }}>
                {euro(f.total)}
              </span>
              {daCancellare === f.id ? (
                <div className="flex flex-shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => { aggiorna(removeFillup(f.id)); setDaCancellare(null); }}
                    style={{ color: 'var(--mf-price-worst)', fontSize: 12, fontWeight: 600 }}
                  >
                    elimina
                  </button>
                  <button onClick={() => setDaCancellare(null)} style={{ color: 'var(--mf-muted)', fontSize: 12 }}>
                    no
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDaCancellare(f.id)}
                  aria-label="Elimina il pieno"
                  className="flex-shrink-0"
                  style={{ color: 'var(--mf-muted)', padding: 4 }}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))
        )}
      </Card>

      <AnimatePresence>
        {open && (
          <FoglioPieno
            key={editing?.id || 'nuovo'}
            carModel={carModel}
            carTags={carTags}
            tankLiters={tankLiters}
            ultimoOdometro={ordinati[0]?.odometer}
            esistente={editing}
            prefill={prefill}
            onScanTrigger={avviaScansione}
            onClose={() => { setOpen(false); setEditing(null); setPrefill(null); }}
            onSave={(f) => {
              if (editing) aggiorna(updateFillup(editing.id, f));
              else aggiorna(addFillup(f));
              setOpen(false);
              setEditing(null);
              setPrefill(null);
            }}
          />
        )}
      </AnimatePresence>
    </Section>
  );
}

function FoglioPieno({
  carModel, carTags, tankLiters, ultimoOdometro, esistente, prefill, onScanTrigger, onClose, onSave,
}: {
  carModel: string;
  carTags?: string;
  tankLiters?: number;
  ultimoOdometro?: number;
  esistente: Fillup | null;
  prefill: PrefillData | null;
  onScanTrigger: () => void;
  onClose: () => void;
  onSave: (f: Omit<Fillup, 'id'>) => void;
}) {
  const oggi = new Date().toISOString().slice(0, 10);
  const [tipo, setTipo] = useState<FuelType>(
    esistente?.fuelType || prefill?.fuelType || defaultFuelType(carTags)
  );
  const [data, setData] = useState(esistente?.date?.slice(0, 10) || prefill?.date || oggi);
  const [prezzo, setPrezzo] = useState(
    esistente ? String(esistente.pricePerLiter) : prefill?.pricePerLiter ? String(prefill.pricePerLiter) : ''
  );
  const [spesa, setSpesa] = useState(
    esistente ? String(esistente.total) : prefill?.total ? String(prefill.total) : ''
  );
  const [odometro, setOdometro] = useState(
    esistente ? String(esistente.odometer) : prefill?.odometer ? String(prefill.odometer) : ''
  );
  const [pieno, setPieno] = useState(esistente ? esistente.full : true);
  const [distributore, setDistributore] = useState(esistente?.stationName || prefill?.stationName || '');

  const prezzoN = parseFloat(prezzo.replace(',', '.')) || 0;
  const spesaN = parseFloat(spesa.replace(',', '.')) || 0;
  const odometroN = parseFloat(odometro.replace(',', '.')) || 0;
  const litriN = prezzoN > 0 ? spesaN / prezzoN : 0;

  const troppiLitri = tankLiters ? litriN > tankLiters * 1.15 : false;
  const odometroIndietro = ultimoOdometro != null && odometroN > 0 && odometroN < ultimoOdometro;
  const valido = prezzoN > 0 && spesaN > 0 && odometroN > 0 && !odometroIndietro;

  return (
    <Sheet title={esistente ? 'Modifica pieno' : 'Nuovo pieno'} onClose={onClose}>
      <div className="space-y-5 pb-2">
        {/* Banner scontrino estratto con successo o tasto scansione */}
        {prefill?.fromScan ? (
          <div
            className="flex items-center gap-2.5 px-3.5 py-2.5"
            style={{
              background: 'color-mix(in srgb, var(--mf-accent) 15%, transparent)',
              border: '1px solid var(--mf-accent)',
              borderRadius: 'var(--mf-radius-md)',
              color: 'var(--mf-ink)',
              fontSize: 12.5,
            }}
          >
            <Sparkles size={16} style={{ color: 'var(--mf-accent)', flexShrink: 0 }} />
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-white block">Dati scontrino estratti!</span>
              <span style={{ color: 'var(--mf-ink-2)', fontSize: 11.5 }}>
                Verifica i campi e inserisci i chilometri attuali del contachilometri.
              </span>
            </div>
          </div>
        ) : !esistente ? (
          <button
            onClick={onScanTrigger}
            type="button"
            className="flex w-full items-center justify-center gap-2 px-4 py-3 active:scale-98 transition-transform"
            style={{
              background: 'color-mix(in srgb, var(--mf-surface-raised) 85%, transparent)',
              border: '1px dashed var(--mf-accent)',
              borderRadius: 'var(--mf-radius-md)',
              color: 'var(--mf-accent)',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <Camera size={16} /> Scansiona scontrino con fotocamera
          </button>
        ) : null}

        <div>
          <div className="mf-label mb-2" style={{ fontSize: 9 }}>carburante</div>
          <ChipGroup
            options={FUELS.map((f) => ({ key: f, label: f }))}
            value={tipo}
            onChange={setTipo}
            columns={4}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="prezzo al litro">
            <Input
              value={prezzo}
              onChange={(v) => setPrezzo(prezzoAuto(v))}
              placeholder="1.899"
              inputMode="decimal"
              mono
              big
              autoFocus={!prefill}
            />
          </Field>
          <Field label="quanto hai speso">
            <Input value={spesa} onChange={setSpesa} placeholder="50,00" inputMode="decimal" mono big />
          </Field>
        </div>

        {litriN > 0 && (
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{
              background: 'var(--mf-ground)',
              border: `1px solid ${troppiLitri ? 'var(--mf-price-worst)' : 'var(--mf-hairline)'}`,
              borderRadius: 'var(--mf-radius-md)',
            }}
          >
            <span style={{ color: 'var(--mf-ink-2)', fontSize: 13 }}>
              {troppiLitri ? 'Piu del serbatoio: controlla i numeri' : 'Hai messo'}
            </span>
            <span
              className="mf-num"
              style={{ fontSize: 18, fontWeight: 600, color: troppiLitri ? 'var(--mf-price-worst)' : 'var(--mf-ink)' }}
            >
              {litri(litriN)}
            </span>
          </div>
        )}

        <Field
          label="chilometri sul contachilometri"
          hint={ultimoOdometro != null ? `L'ultima volta erano ${km(ultimoOdometro)}.` : undefined}
        >
          <Input value={odometro} onChange={setOdometro} placeholder="120000" inputMode="numeric" mono big />
        </Field>

        {odometroIndietro && (
          <p style={{ color: 'var(--mf-price-worst)', fontSize: 12 }}>
            I chilometri non possono tornare indietro rispetto all&apos;ultimo pieno.
          </p>
        )}

        <Field label="quando">
          <Input type="date" value={data} onChange={setData} mono />
        </Field>

        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div style={{ fontFamily: 'var(--mf-font-sans)', fontWeight: 600, fontSize: 14, color: 'var(--mf-ink)' }}>
              Pieno fino in cima
            </div>
            <p className="mt-0.5" style={{ color: 'var(--mf-ink-2)', fontSize: 12 }}>
              Solo i pieni completi entrano nel calcolo del consumo.
            </p>
          </div>
          <Toggle on={pieno} onChange={() => setPieno((v) => !v)} ariaLabel="Pieno completo" />
        </div>

        <Field label="distributore">
          <Input value={distributore} onChange={setDistributore} placeholder="Facoltativo" />
        </Field>

        <Button
          full
          size="lg"
          disabled={!valido}
          onClick={() =>
            onSave({
              carModel,
              date: data,
              fuelType: tipo,
              liters: litriN,
              pricePerLiter: prezzoN,
              total: spesaN,
              odometer: odometroN,
              full: pieno,
              stationName: distributore.trim() || undefined,
            })
          }
        >
          {esistente ? 'Salva' : 'Segna il pieno'}
        </Button>
      </div>
    </Sheet>
  );
}

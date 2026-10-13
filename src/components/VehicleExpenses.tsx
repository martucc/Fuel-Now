import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  Wallet, Plus, Trash2, Wrench, FileText, Shield, AlertTriangle,
  Coins, MoreHorizontal, Fuel,
} from 'lucide-react';
import type { Expense, ExpenseType } from '../types';
import {
  addExpense, updateExpense, removeExpense, expensesForCar,
  computeCarSpend, EXPENSE_LABELS, CATEGORY_LABELS, type CategoryKey,
} from '../services/expensesService';
import { Card, Section, Stat, Empty } from '../design/primitives/Surface';
import { Button } from '../design/primitives/Button';
import { Sheet } from '../design/primitives/Sheet';
import { Field, Input, ChipGroup } from '../design/primitives/Field';
import { euro } from '../lib/formato';

interface Props {
  carModel: string;
}

const ICONE: Record<ExpenseType, any> = {
  manutenzione: Wrench,
  bollo: FileText,
  assicurazione: Shield,
  multa: AlertTriangle,
  pedaggio: Coins,
  altro: MoreHorizontal,
};

const ICONE_CATEGORIA: Record<CategoryKey, any> = { fuel: Fuel, ...ICONE };

/* Le voci di spesa non sono prezzi: qui il colore serve solo a distinguerle
   fra loro, quindi resta sulla scala neutra e non su quella del prezzo. */
const COLORI: Record<CategoryKey, string> = {
  fuel: 'var(--mf-accent)',
  manutenzione: '#a78bfa',
  bollo: '#7dd3a0',
  assicurazione: '#f2b33c',
  multa: '#f2645a',
  pedaggio: '#f2a0c8',
  altro: 'var(--mf-muted)',
};

const dataIt = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });

export function VehicleExpenses({ carModel }: Props) {
  const [list, setList] = useState<Expense[]>(() => expensesForCar(carModel));
  const [refreshKey, setRefreshKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [daCancellare, setDaCancellare] = useState<string | null>(null);

  useEffect(() => {
    setList(expensesForCar(carModel));
    setDaCancellare(null);
    setEditing(null);
  }, [carModel]);

  useEffect(() => {
    const h = () => setRefreshKey((k) => k + 1);
    window.addEventListener('mf-fillup-changed', h);
    window.addEventListener('mf-expenses-changed', h);
    return () => {
      window.removeEventListener('mf-fillup-changed', h);
      window.removeEventListener('mf-expenses-changed', h);
    };
  }, []);

  const spesa = useMemo(() => computeCarSpend(carModel), [carModel, list, refreshKey]);

  const ordinate = useMemo(() => [...list].sort((a, b) => b.date.localeCompare(a.date)), [list]);

  const categorie = useMemo(
    () =>
      (Object.keys(spesa.byCategory) as CategoryKey[])
        .map((k) => ({ key: k, valore: spesa.byCategory[k] }))
        .filter((c) => c.valore > 0)
        .sort((a, b) => b.valore - a.valore),
    [spesa]
  );

  const massimoMese = Math.max(1, ...spesa.monthly.map((m) => m.total));
  const mesiConSpesa = spesa.monthly.filter((m) => m.total > 0).length;
  const mediaMensile = mesiConSpesa > 0 ? spesa.total / mesiConSpesa : 0;

  const aggiorna = (next: Expense[]) => {
    setList(next.filter((e) => e.carModel === carModel));
    setRefreshKey((k) => k + 1);
  };

  return (
    <Section
      title="Quanto ti costa"
      aside={
        <button
          onClick={() => { setEditing(null); setOpen(true); }}
          className="flex items-center gap-1"
          style={{ color: 'var(--mf-accent)', fontSize: 12, fontWeight: 600, fontFamily: 'var(--mf-font-sans)' }}
        >
          <Plus size={14} /> spesa
        </button>
      }
    >
      <Card pad="lg">
        <div className="mf-label" style={{ fontSize: 9 }}>ultimi 12 mesi</div>
        <div
          className="mf-num mt-2"
          style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.045em', color: 'var(--mf-ink)', lineHeight: 1 }}
        >
          {euro(spesa.total)}
        </div>
        <p className="mt-2" style={{ color: 'var(--mf-ink-2)', fontSize: 12 }}>
          {mediaMensile > 0 ? `circa ${euro(mediaMensile)} al mese` : 'ancora nessuna spesa registrata'}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <Stat label="carburante" value={euro(spesa.fuel)} sub={`${spesa.fuelCount} pieni`} />
          <Stat label="tutto il resto" value={euro(spesa.others)} sub={`${list.length} voci`} />
        </div>

        {/* Andamento mensile: colonne, non una linea. Sono importi, non un trend. */}
        {spesa.total > 0 && (
          <div className="mt-6">
            <div className="flex h-20 items-end gap-1">
              {spesa.monthly.map((m) => (
                <div key={m.key} className="flex h-full flex-1 flex-col justify-end gap-px" title={`${m.label}: ${euro(m.total)}`}>
                  <div
                    style={{
                      height: `${(m.others / massimoMese) * 100}%`,
                      background: 'var(--mf-ink-2)',
                      borderRadius: '3px 3px 0 0',
                      minHeight: m.others > 0 ? 2 : 0,
                    }}
                  />
                  <div
                    style={{
                      height: `${(m.fuel / massimoMese) * 100}%`,
                      background: 'var(--mf-accent)',
                      minHeight: m.fuel > 0 ? 2 : 0,
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="mf-label mt-2 flex justify-between" style={{ fontSize: 9 }}>
              {spesa.monthly.map((m, i) => (
                <span key={m.key} style={{ opacity: i % 2 === 0 ? 1 : 0 }}>{m.label}</span>
              ))}
            </div>
          </div>
        )}

        {categorie.length > 0 && (
          <div className="mt-6 space-y-2.5 pt-5" style={{ borderTop: '1px solid var(--mf-hairline)' }}>
            {categorie.map((c) => {
              const Icona = ICONE_CATEGORIA[c.key];
              const quota = (c.valore / spesa.total) * 100;
              return (
                <div key={c.key} className="flex items-center gap-3">
                  <Icona size={14} style={{ color: COLORI[c.key], flexShrink: 0 }} />
                  <span className="flex-shrink-0" style={{ fontSize: 12, color: 'var(--mf-ink-2)', width: 92 }}>
                    {CATEGORY_LABELS[c.key]}
                  </span>
                  <div
                    className="min-w-0 flex-1"
                    style={{ height: 5, borderRadius: 'var(--mf-radius-pill)', background: 'var(--mf-ground)' }}
                  >
                    <div
                      style={{
                        width: `${quota}%`,
                        height: '100%',
                        background: COLORI[c.key],
                        borderRadius: 'var(--mf-radius-pill)',
                      }}
                    />
                  </div>
                  <span className="mf-num flex-shrink-0" style={{ fontSize: 12, color: 'var(--mf-ink)' }}>
                    {euro(c.valore, 0)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card pad={ordinate.length === 0 ? 'md' : 'none'} className="mt-3">
        {ordinate.length === 0 ? (
          <Empty
            icon={<Wallet size={20} />}
            title="Nessuna spesa oltre al carburante"
            hint="Bollo, assicurazione, tagliando: li segni qui e li ritrovi nel costo reale dell’auto."
            action={<Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>Aggiungi</Button>}
          />
        ) : (
          ordinate.map((e, i) => {
            const Icona = ICONE[e.type];
            return (
              <div
                key={e.id}
                className="flex items-center gap-3 px-4 py-4"
                style={{ borderTop: i === 0 ? 'none' : '1px solid var(--mf-hairline)' }}
              >
                <span
                  className="flex flex-shrink-0 items-center justify-center"
                  style={{
                    width: 34, height: 34, borderRadius: 'var(--mf-radius-pill)',
                    background: 'var(--mf-ground)', border: '1px solid var(--mf-hairline)', color: COLORI[e.type],
                  }}
                >
                  <Icona size={15} />
                </span>
                <button onClick={() => { setEditing(e); setOpen(true); }} className="min-w-0 flex-1 text-left">
                  <div className="truncate" style={{ fontFamily: 'var(--mf-font-sans)', fontWeight: 600, fontSize: 14, color: 'var(--mf-ink)' }}>
                    {e.label || EXPENSE_LABELS[e.type]}
                  </div>
                  <div className="mf-num mt-0.5" style={{ fontSize: 11, color: 'var(--mf-ink-2)' }}>
                    {dataIt(e.date)}
                  </div>
                </button>
                <span className="mf-num flex-shrink-0" style={{ fontSize: 15, fontWeight: 600, color: 'var(--mf-ink)' }}>
                  {euro(e.amount)}
                </span>
                {daCancellare === e.id ? (
                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    <button
                      onClick={() => { aggiorna(removeExpense(e.id)); setDaCancellare(null); }}
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
                    onClick={() => setDaCancellare(e.id)}
                    aria-label="Elimina la spesa"
                    className="flex-shrink-0"
                    style={{ color: 'var(--mf-muted)', padding: 4 }}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            );
          })
        )}
      </Card>

      <AnimatePresence>
        {open && (
          <FoglioSpesa
            key={editing?.id || 'nuova'}
            carModel={carModel}
            esistente={editing}
            onClose={() => { setOpen(false); setEditing(null); }}
            onSave={(e) => {
              if (editing) aggiorna(updateExpense(editing.id, e));
              else aggiorna(addExpense(e));
              setOpen(false);
              setEditing(null);
            }}
          />
        )}
      </AnimatePresence>
    </Section>
  );
}

function FoglioSpesa({
  carModel, esistente, onClose, onSave,
}: {
  carModel: string;
  esistente: Expense | null;
  onClose: () => void;
  onSave: (e: Omit<Expense, 'id'>) => void;
}) {
  const oggi = new Date().toISOString().slice(0, 10);
  const [tipo, setTipo] = useState<ExpenseType>(esistente?.type || 'manutenzione');
  const [importo, setImporto] = useState(esistente ? String(esistente.amount) : '');
  const [data, setData] = useState(esistente?.date || oggi);
  const [etichetta, setEtichetta] = useState(esistente?.label || '');
  const [note, setNote] = useState(esistente?.notes || '');

  const valore = parseFloat(importo.replace(',', '.')) || 0;

  const tipi = (Object.keys(EXPENSE_LABELS) as ExpenseType[]).map((t) => {
    const Icona = ICONE[t];
    return { key: t, label: EXPENSE_LABELS[t], icon: <Icona size={15} /> };
  });

  return (
    <Sheet title={esistente ? 'Modifica spesa' : 'Nuova spesa'} onClose={onClose}>
      <div className="space-y-5 pb-2">
        <div>
          <div className="mf-label mb-2" style={{ fontSize: 9 }}>di cosa si tratta</div>
          <ChipGroup options={tipi} value={tipo} onChange={setTipo} columns={2} />
        </div>

        <Field label="quanto">
          <div className="flex items-baseline gap-2">
            <Input value={importo} onChange={setImporto} placeholder="0,00" inputMode="decimal" mono big autoFocus />
            <span className="mf-num flex-shrink-0" style={{ color: 'var(--mf-ink-2)', fontSize: 18 }}>€</span>
          </div>
        </Field>

        <Field label="quando">
          <Input type="date" value={data} onChange={setData} mono />
        </Field>

        <Field label="nome" hint="Lascialo vuoto e uso il nome della categoria.">
          <Input value={etichetta} onChange={setEtichetta} placeholder={EXPENSE_LABELS[tipo]} />
        </Field>

        <Field label="note">
          <Input value={note} onChange={setNote} placeholder="Officina, numero fattura..." />
        </Field>

        <Button
          full
          size="lg"
          disabled={valore <= 0 || !data}
          onClick={() =>
            onSave({
              carModel,
              type: tipo,
              date: data,
              amount: valore,
              label: etichetta.trim() || undefined,
              notes: note.trim() || undefined,
            })
          }
        >
          {esistente ? 'Salva' : 'Aggiungi'}
        </Button>
      </div>
    </Sheet>
  );
}

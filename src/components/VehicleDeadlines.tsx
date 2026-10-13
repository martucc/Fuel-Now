import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Calendar, Plus, Trash2, Wrench, FileText, Shield, Settings, CalendarClock } from 'lucide-react';
import type { Deadline, DeadlineType } from '../types';
import {
  addDeadline, updateDeadline, removeDeadline, deadlinesForCar,
  daysUntil, statusOf, nextDateFromRecurrence,
  DEADLINE_LABELS, DEFAULT_RECURRENCE,
} from '../services/deadlinesService';
import { Card, Section, Empty } from '../design/primitives/Surface';
import { Button } from '../design/primitives/Button';
import { Sheet } from '../design/primitives/Sheet';
import { Field, Input, ChipGroup } from '../design/primitives/Field';

interface Props {
  carModel: string;
}

const ICONE: Record<DeadlineType, any> = {
  revisione: Wrench,
  bollo: FileText,
  assicurazione: Shield,
  tagliando: Settings,
  altro: CalendarClock,
};

const COLORE_STATO = {
  overdue: 'var(--mf-price-worst)',
  urgent: 'var(--mf-price-high)',
  warn: 'var(--mf-price-normal)',
  ok: 'var(--mf-ink-2)',
} as const;

function dataIt(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function VehicleDeadlines({ carModel }: Props) {
  const [list, setList] = useState<Deadline[]>(() => deadlinesForCar(carModel));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Deadline | null>(null);
  const [daCancellare, setDaCancellare] = useState<string | null>(null);

  useEffect(() => {
    setList(deadlinesForCar(carModel));
    setDaCancellare(null);
    setEditing(null);
  }, [carModel]);

  const ordinate = useMemo(() => [...list].sort((a, b) => daysUntil(a.date) - daysUntil(b.date)), [list]);

  const aggiorna = (next: Deadline[]) => {
    setList(next.filter((d) => d.carModel === carModel).sort((a, b) => a.date.localeCompare(b.date)));
  };

  return (
    <Section
      title="Scadenze"
      aside={
        <button
          onClick={() => { setEditing(null); setOpen(true); }}
          className="flex items-center gap-1"
          style={{ color: 'var(--mf-accent)', fontSize: 12, fontWeight: 600, fontFamily: 'var(--mf-font-sans)' }}
        >
          <Plus size={14} /> aggiungi
        </button>
      }
    >
      <Card pad={list.length === 0 ? 'md' : 'none'}>
        {list.length === 0 ? (
          <Empty
            icon={<Calendar size={20} />}
            title="Niente in scadenza"
            hint="Metti revisione, bollo e assicurazione: ti avviso un mese prima, poi a una settimana e il giorno stesso."
            action={<Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>Aggiungi</Button>}
          />
        ) : (
          ordinate.map((d, i) => {
            const Icona = ICONE[d.type];
            const stato = statusOf(d);
            const colore = COLORE_STATO[stato];
            const giorni = daysUntil(d.date);
            const titolo = d.label || DEADLINE_LABELS[d.type];
            const quando =
              stato === 'overdue' ? `scaduta da ${Math.abs(giorni)} giorni`
                : giorni === 0 ? 'scade oggi'
                  : giorni === 1 ? 'scade domani'
                    : `fra ${giorni} giorni`;

            return (
              <div
                key={d.id}
                className="flex items-start gap-3 px-4 py-4"
                style={{ borderTop: i === 0 ? 'none' : '1px solid var(--mf-hairline)' }}
              >
                <span
                  className="flex flex-shrink-0 items-center justify-center"
                  style={{
                    width: 38, height: 38, borderRadius: 'var(--mf-radius-pill)',
                    background: 'var(--mf-ground)', border: '1px solid var(--mf-hairline)', color: colore,
                  }}
                >
                  <Icona size={17} />
                </span>

                <button
                  onClick={() => { setEditing(d); setOpen(true); }}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="truncate" style={{ fontFamily: 'var(--mf-font-sans)', fontWeight: 600, fontSize: 15, color: 'var(--mf-ink)' }}>
                    {titolo}
                  </div>
                  {/* Niente troncamento qui: «scaduta da…» e proprio la meta che serve leggere. */}
                  <div className="mf-num mt-0.5" style={{ fontSize: 11, color: 'var(--mf-ink-2)', lineHeight: 1.4 }}>
                    {dataIt(d.date)}
                    <br />
                    <span style={{ color: colore }}>{quando}</span>
                  </div>
                </button>

                <div className="flex flex-shrink-0 items-center gap-2">
                  {stato === 'overdue' && d.recurrence !== 'none' && (
                    <Button
                      size="sm"
                      tone="ghost"
                      onClick={() => {
                        const prossima = nextDateFromRecurrence(d.date, d.recurrence);
                        if (prossima) aggiorna(updateDeadline(d.id, { ...d, date: prossima }));
                      }}
                    >
                      Rinnova
                    </Button>
                  )}
                  {daCancellare === d.id ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => { aggiorna(removeDeadline(d.id)); setDaCancellare(null); }}
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
                      onClick={() => setDaCancellare(d.id)}
                      aria-label="Elimina la scadenza"
                      style={{ color: 'var(--mf-muted)', padding: 4 }}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </Card>

      <AnimatePresence>
        {open && (
          <FoglioScadenza
            key={editing?.id || 'nuova'}
            carModel={carModel}
            esistente={editing}
            onClose={() => { setOpen(false); setEditing(null); }}
            onSave={(d) => {
              if (editing) aggiorna(updateDeadline(editing.id, d));
              else aggiorna(addDeadline(d));
              setOpen(false);
              setEditing(null);
            }}
          />
        )}
      </AnimatePresence>
    </Section>
  );
}

const RINNOVI = [
  { key: 'none' as const, label: 'Mai' },
  { key: 'yearly' as const, label: 'Ogni anno' },
  { key: '2years' as const, label: 'Ogni 2 anni' },
];

function FoglioScadenza({
  carModel, esistente, onClose, onSave,
}: {
  carModel: string;
  esistente: Deadline | null;
  onClose: () => void;
  onSave: (d: Omit<Deadline, 'id'>) => void;
}) {
  const oggi = new Date().toISOString().slice(0, 10);
  const [tipo, setTipo] = useState<DeadlineType>(esistente?.type || 'revisione');
  const [etichetta, setEtichetta] = useState(esistente?.label || '');
  const [data, setData] = useState(esistente?.date || oggi);
  const [rinnovo, setRinnovo] = useState<Deadline['recurrence']>(
    esistente?.recurrence || DEFAULT_RECURRENCE[esistente?.type || 'revisione']
  );
  const [note, setNote] = useState(esistente?.notes || '');

  const tipi = (Object.keys(DEADLINE_LABELS) as DeadlineType[]).map((t) => {
    const Icona = ICONE[t];
    return { key: t, label: DEADLINE_LABELS[t], icon: <Icona size={15} /> };
  });

  return (
    <Sheet title={esistente ? 'Modifica scadenza' : 'Nuova scadenza'} onClose={onClose}>
      <div className="space-y-5 pb-2">
        <div>
          <div className="mf-label mb-2" style={{ fontSize: 9 }}>tipo</div>
          <ChipGroup
            options={tipi}
            value={tipo}
            onChange={(t) => {
              setTipo(t);
              if (!esistente) setRinnovo(DEFAULT_RECURRENCE[t]);
            }}
            columns={2}
          />
        </div>

        <Field label="quando scade">
          <Input type="date" value={data} onChange={setData} mono />
        </Field>

        <div>
          <div className="mf-label mb-2" style={{ fontSize: 9 }}>si ripete</div>
          <ChipGroup options={RINNOVI} value={rinnovo} onChange={setRinnovo} columns={3} />
        </div>

        <Field label="nome" hint="Lascialo vuoto e uso il nome del tipo.">
          <Input value={etichetta} onChange={setEtichetta} placeholder={DEADLINE_LABELS[tipo]} />
        </Field>

        <Field label="note">
          <Input value={note} onChange={setNote} placeholder="Numero polizza, importo, officina..." />
        </Field>

        <p style={{ color: 'var(--mf-muted)', fontSize: 11, lineHeight: 1.5 }}>
          Ti avviso a 30 giorni, a 7 e il giorno stesso — se hai lasciato attive le notifiche.
        </p>

        <Button
          full
          size="lg"
          disabled={!data}
          onClick={() =>
            onSave({
              carModel,
              type: tipo,
              label: etichetta.trim() || undefined,
              date: data,
              recurrence: rinnovo,
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

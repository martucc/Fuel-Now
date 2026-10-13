import { useEffect, useMemo, useState } from 'react';
import { PiggyBank, Target } from 'lucide-react';
import { calcolaBilancio, filtraAnno, type PienoFatto } from '../../domain/risparmio';
import { caricaConsigli } from '../../services/adviceLog';
import { fillupsForCar } from '../../services/fillupService';
import { toFuelKey } from '../../domain/fuel';
import { Card, Section, Stat, Empty } from '../../design/primitives/Surface';
import { euro, numero } from '../../lib/formato';

interface Props {
  carModel: string;
}

/**
 * Il cerchio che si chiude.
 *
 * Non dice «ti abbiamo fatto risparmiare», che non e misurabile: dice
 * quanto hai pagato rispetto alla media della tua provincia il giorno del
 * pieno, che e un fatto. E confronta quello che l'app aveva promesso con
 * quello che e successo davvero, perche un modello che nessuno verifica
 * col tempo si allontana dalla realta senza che nessuno se ne accorga.
 */
export function Risparmio({ carModel }: Props) {
  const [aggiorna, setAggiorna] = useState(0);

  useEffect(() => {
    const h = () => setAggiorna((k) => k + 1);
    window.addEventListener('mf-fillup-changed', h);
    window.addEventListener('mf-consigli-changed', h);
    return () => {
      window.removeEventListener('mf-fillup-changed', h);
      window.removeEventListener('mf-consigli-changed', h);
    };
  }, []);

  const bilancio = useMemo(() => {
    const pieni: PienoFatto[] = fillupsForCar(carModel).map((f) => ({
      id: f.id,
      date: f.date,
      fuel: toFuelKey(f.fuelType),
      liters: f.liters,
      pricePerLiter: f.pricePerLiter,
      stationName: f.stationName,
    }));
    return calcolaBilancio(pieni, caricaConsigli());
  }, [carModel, aggiorna]);

  const anno = new Date().getFullYear();
  const quest = useMemo(() => filtraAnno(bilancio, anno), [bilancio, anno]);

  if (bilancio.conConsiglio === 0) {
    return (
      <Section title="Quanto hai risparmiato">
        <Card pad="md">
          <Empty
            icon={<PiggyBank size={20} />}
            title="Ancora niente da misurare"
            hint="Da adesso segno ogni giorno dove conviene e a quanto sta la media della tua zona. Quando registri un pieno, li confronto: vedrai quanto hai pagato in meno, davvero."
          />
        </Card>
      </Section>
    );
  }

  const positivo = bilancio.totaleEur >= 0;
  const colore = positivo ? 'var(--mf-price-best)' : 'var(--mf-price-worst)';
  const scarto =
    bilancio.promessoEur !== null && bilancio.mantenutoEur !== null
      ? bilancio.mantenutoEur - bilancio.promessoEur
      : null;

  return (
    <Section title="Quanto hai risparmiato">
      <Card pad="lg">
        <div className="mf-label" style={{ fontSize: 9 }}>
          sotto la media della tua zona
        </div>
        <div
          className="mf-num mt-2"
          style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.045em', color: colore, lineHeight: 1 }}
        >
          {positivo ? '' : '−'}{euro(Math.abs(bilancio.totaleEur))}
        </div>
        <p className="mt-2" style={{ color: 'var(--mf-ink-2)', fontSize: 12.5, lineHeight: 1.5 }}>
          su {numero(bilancio.conConsiglio)} pieni misurati
          {quest.conConsiglio !== bilancio.conConsiglio && quest.conConsiglio > 0 && (
            <> · {euro(quest.totaleEur)} nel {anno}</>
          )}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <Stat
            label="in media a pieno"
            value={bilancio.mediaEur !== null ? euro(bilancio.mediaEur) : '—'}
            color={bilancio.mediaEur !== null && bilancio.mediaEur >= 0 ? 'var(--mf-price-best)' : 'var(--mf-price-worst)'}
          />
          <Stat
            label="consigli seguiti"
            value={`${bilancio.seguiti} di ${bilancio.conConsiglio}`}
            sub={bilancio.seguiti > 0 ? 'dove diceva l’app' : 'mai finora'}
          />
        </div>

        {/* La verifica del modello: promesso contro mantenuto. */}
        {scarto !== null && bilancio.seguiti > 0 && (
          <div className="mt-6 pt-5" style={{ borderTop: '1px solid var(--mf-hairline)' }}>
            <div className="mb-2 flex items-center gap-2">
              <Target size={13} style={{ color: 'var(--mf-accent)' }} />
              <span className="mf-label" style={{ fontSize: 9 }}>quanto ci prendo</span>
            </div>
            <p style={{ color: 'var(--mf-ink-2)', fontSize: 12.5, lineHeight: 1.6 }}>
              Sui {bilancio.seguiti} pieni fatti dove dicevo, avevo promesso{' '}
              <span className="mf-num">{euro(bilancio.promessoEur!)}</span> e ne sono usciti{' '}
              <span className="mf-num" style={{ color: scarto >= 0 ? 'var(--mf-price-best)' : 'var(--mf-price-high)' }}>
                {euro(bilancio.mantenutoEur!)}
              </span>
              {Math.abs(scarto) < 0.5
                ? '. Il conto torna.'
                : scarto > 0
                  ? '. Sono stato prudente: il risparmio vero è stato più alto.'
                  : '. Ho promesso più di quanto sia uscito: il calcolo va tarato.'}
            </p>
          </div>
        )}

        <p className="mt-5" style={{ color: 'var(--mf-muted)', fontSize: 11, lineHeight: 1.5 }}>
          Il paragone è la media della tua provincia il giorno del pieno, non quella di oggi:
          confrontare un pieno di marzo coi prezzi di agosto non misurerebbe niente.
        </p>
      </Card>
    </Section>
  );
}

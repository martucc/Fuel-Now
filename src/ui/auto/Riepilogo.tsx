import { useEffect, useMemo, useState } from 'react';
import { Fuel, Gauge, Wallet, CalendarClock } from 'lucide-react';
import { fillupsForCar, computeStats, predictNextFillup } from '../../services/fillupService';
import { computeCarSpend } from '../../services/expensesService';
import { Widget, WidgetGrid } from '../../design/primitives/Widget';
import { euro, numero, chilometri } from '../../lib/formato';

interface Props {
  carModel: string;
  wltpKml?: number;
  tankLiters?: number;
}

/**
 * Le quattro cose che si vogliono sapere aprendo la scheda dell'auto.
 *
 * Prima erano sparse in quattro schede alte mezzo schermo l'una: per
 * sapere quanto costa un chilometro bisognava scorrere fino in fondo.
 * Qui stanno tutte sopra la piega, e sotto resta il dettaglio per chi lo
 * vuole.
 */
export function Riepilogo({ carModel, wltpKml, tankLiters }: Props) {
  const [aggiorna, setAggiorna] = useState(0);

  useEffect(() => {
    const h = () => setAggiorna((k) => k + 1);
    window.addEventListener('mf-fillup-changed', h);
    window.addEventListener('mf-expenses-changed', h);
    return () => {
      window.removeEventListener('mf-fillup-changed', h);
      window.removeEventListener('mf-expenses-changed', h);
    };
  }, []);

  const { stats, previsione, spesa } = useMemo(() => {
    const pieni = fillupsForCar(carModel);
    return {
      stats: computeStats(pieni, wltpKml),
      previsione: predictNextFillup(pieni, wltpKml, tankLiters),
      spesa: computeCarSpend(carModel),
    };
  }, [carModel, wltpKml, tankLiters, aggiorna]);

  // Diviso dodici, non per i soli mesi in cui hai speso: il bollo cade una
  // volta l'anno e dividerlo per i due mesi movimentati direbbe che l'auto
  // costa trecento euro al mese, che non e vero.
  const MESI = spesa.monthly.length || 12;
  const alMese = spesa.total > 0 ? spesa.total / MESI : null;

  const giorni = previsione?.daysUntilEmpty != null ? Math.max(0, Math.round(previsione.daysUntilEmpty)) : null;
  const quotaSerbatoio = previsione ? previsione.tankPct : null;

  const scostamento = stats.vsWltpPct;

  return (
    <WidgetGrid>
      <Widget
        label="prossimo pieno"
        icon={<Fuel size={11} />}
        value={giorni != null ? `fra ${numero(giorni)} gg` : null}
        color={giorni != null && giorni <= 3 ? 'var(--mf-price-high)' : undefined}
        sub={
          quotaSerbatoio != null
            ? `serbatoio al ${numero((1 - quotaSerbatoio) * 100, 0)}%`
            : 'segna qualche pieno per la stima'
        }
      />

      <Widget
        label="consumo reale"
        icon={<Gauge size={11} />}
        value={stats.realKml ? `${numero(stats.realKml, 1)} km/L` : null}
        color={
          scostamento == null ? undefined : scostamento >= -3 ? 'var(--mf-price-best)' : 'var(--mf-price-high)'
        }
        sub={
          stats.realKml == null
            ? 'servono due pieni fatti in cima'
            : scostamento == null
              ? `su ${chilometri(stats.kmDriven)}`
              : Math.abs(scostamento) < 3
                ? 'come dichiarato'
                : scostamento < 0
                  ? `${numero(Math.abs(scostamento), 0)}% peggio del dichiarato`
                  : `${numero(scostamento, 0)}% meglio del dichiarato`
        }
      />

      <Widget
        label="ti costa al km"
        value={stats.costPerKm ? `${numero(stats.costPerKm, 3)} €` : null}
        sub={stats.avgPricePerL ? `${numero(stats.avgPricePerL, 3)} € al litro di media` : undefined}
      />

      <Widget
        label="al mese"
        icon={<Wallet size={11} />}
        value={alMese !== null ? euro(alMese) : null}
        sub={
          spesa.total > 0
            ? `media su ${MESI} mesi · ${euro(spesa.total, 0)} in tutto`
            : 'ancora nessuna spesa'
        }
      />

      {previsione?.predictedDate && (
        <Widget
          label="quando"
          wide
          icon={<CalendarClock size={11} />}
          value={new Date(previsione.predictedDate).toLocaleDateString('it-IT', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
          sub={
            previsione.rangeLeftKm
              ? `${chilometri(previsione.rangeLeftKm)} di autonomia · ${numero(previsione.kmPerDay, 0)} km al giorno · ultimo pieno ${numero(previsione.daysSinceLast, 0)} gg fa`
              : undefined
          }
        />
      )}
    </WidgetGrid>
  );
}

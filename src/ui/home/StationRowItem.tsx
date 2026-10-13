import type { ListItem } from './homeModel';
import { PriceText, formatEuro } from '../../design/primitives/PriceText';
import { BrandLogo } from '../../design/primitives/BrandLogo';

interface Props {
  item: ListItem;
  onClick?: (id: string) => void;
}

export function StationRowItem({ item, onClick }: Props) {
  // Il motivo per cui un impianto è fuori gioco vale più della sua etichetta
  // di prezzo: sapere che costa poco non serve, se poi non ci si va.
  const nota = (() => {
    if (item.reason === 'bloccato') return 'segnalato da te';
    if (item.reason === 'prezzo-assurdo') return 'prezzo non credibile';
    if (item.reason === 'prezzo-sospetto-stantio') return 'prezzo vecchio e sospetto';
    if (item.reason === 'deviazione-eccessiva') return 'troppo fuori strada';
    if (item.probabilmenteChiuso) return 'non aggiorna da oltre una settimana';
    return item.levelLabel;
  })();

  // In rientro conta quanto allunga, non quanto dista: la distanza da dove
  // sei adesso è la domanda sbagliata se casa è dall'altra parte.
  const strada =
    item.detourKm !== undefined
      ? `+${item.detourKm.toFixed(1).replace('.', ',')} km` +
        (item.minutiPersi !== undefined && item.minutiPersi >= 1
          ? ` · ${Math.round(item.minutiPersi)} min`
          : '')
      : `${item.distanceKm.toFixed(1).replace('.', ',')} km`;

  return (
    <button
      onClick={() => onClick?.(item.id)}
      className="flex w-full items-center justify-between gap-3 py-4 text-left"
      style={{ borderTop: '1px solid var(--mf-hairline)', opacity: item.eligible ? 1 : 0.45 }}
    >
      <BrandLogo brand={item.brand} name={item.name} size={34} />
      <div className="min-w-0 flex-1">
        <div
          className="truncate"
          style={{ fontFamily: 'var(--mf-font-sans)', fontWeight: 600, fontSize: 15, color: 'var(--mf-ink)' }}
        >
          {item.brand} · {item.city || item.name}
        </div>
        <div className="mf-num mt-0.5 truncate" style={{ color: 'var(--mf-ink-2)', fontSize: 11 }}>
          {strada} · {item.ageLabel} · {nota}
        </div>
      </div>
      <div className="flex-shrink-0 text-right">
        <PriceText price={item.price} level={item.level} />
        {item.deltaVsBest > 0 && (
          <div className="mf-num" style={{ color: 'var(--mf-ink-2)', fontSize: 11 }}>
            +{formatEuro(item.deltaVsBest)}
          </div>
        )}
      </div>
    </button>
  );
}

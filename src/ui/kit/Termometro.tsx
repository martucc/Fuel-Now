import { prezzo as formatoPrezzo, numero } from '../../lib/formato';

interface Props {
  /** Mediana dei prezzi della zona. */
  mediana: number;
  /** Mediana meno media italiana, in euro. */
  scarto: number;
  /** Quanti distributori sono entrati nel conto. */
  n: number;
  className?: string;
}

/** Fin dove arriva la scala, per parte: oltre si resta sul bordo. */
const SCALA_EURO = 0.08;

/**
 * Il termometro della zona: una barra dal verde al rosso con la media
 * italiana nel mezzo e un segno dove sta la zona. È il colore d'atmosfera
 * dell'app spiegato in un'immagine sola.
 */
export function Termometro({ mediana, scarto, n, className = '' }: Props) {
  const posizione = 50 + (Math.max(-SCALA_EURO, Math.min(SCALA_EURO, scarto)) / SCALA_EURO) * 46;
  const italia = mediana - scarto;
  return (
    <section className={`mf-carta p-4 ${className}`} aria-label="Prezzi della zona rispetto all'Italia">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="mf-headline">La tua zona</h2>
        <span className="mf-caption text-mf-ink-2">{numero(n)} distributori entro 15 km</span>
      </div>

      <div className="relative mt-4 h-9">
        <div
          className="absolute inset-x-0 top-3 h-2.5 rounded-full"
          style={{
            background:
              'linear-gradient(90deg, var(--color-mf-best), var(--color-mf-good) 30%, var(--color-mf-normal) 50%, var(--color-mf-high) 72%, var(--color-mf-worst))',
            opacity: 0.85,
          }}
        />
        {/* La media italiana, ferma nel mezzo. */}
        <div className="absolute top-1.5 h-5.5 w-[2px] -translate-x-1/2 rounded-full bg-[rgb(255_255_255/0.55)]" style={{ left: '50%', height: 22 }} />
        {/* La zona. */}
        <div
          className="absolute top-0 grid h-[34px] w-[34px] -translate-x-1/2 place-items-center rounded-full transition-[left] duration-700 ease-[var(--ease-mf)]"
          style={{ left: `${posizione}%` }}
        >
          <span
            className="h-5 w-5 rounded-full border-[3px] border-white"
            style={{ background: 'var(--mf-umore)', boxShadow: '0 0 0 4px color-mix(in srgb, var(--mf-umore) 30%, transparent), 0 6px 16px -4px color-mix(in srgb, var(--mf-umore) 80%, transparent)' }}
          />
        </div>
      </div>

      <div className="mt-1 flex justify-between">
        <div>
          <p className="mf-caption text-mf-ink-3">Qui, a metà lista</p>
          <p className="mf-num text-[17px] font-bold" style={{ color: 'var(--mf-umore)' }}>{formatoPrezzo(mediana)}</p>
        </div>
        <div className="text-right">
          <p className="mf-caption text-mf-ink-3">Media italiana</p>
          <p className="mf-num text-[17px] font-semibold text-mf-ink-2">{formatoPrezzo(italia)}</p>
        </div>
      </div>
    </section>
  );
}

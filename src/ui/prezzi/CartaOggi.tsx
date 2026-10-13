import type { QuadroOggi, Freschezza } from '../../domain/quadro';
import type { RankedStation } from '../../domain/ranking';
import type { FuelKey } from '../../domain/raw';
import { RAGGIO_HOME_KM } from '../../app/modello';
import { numero } from '../../lib/formato';
import { Gruppo, Riga } from '../kit/Gruppo';
import { Prezzo } from '../kit/Prezzo';
import { nomeMarchio } from '../kit/marchio';
import { distanza, oreDa } from '../kit/formatoUi';
import { unitaPrezzo } from './formatoPrezzi';

interface Props {
  fuel: FuelKey;
  quadro: QuadroOggi;
  /** Il consigliato della Home; null senza posizione o senza impianti vicini. */
  migliore: RankedStation | null;
  conPosizione: boolean;
  adesso: Date;
}

/** Sotto questo scarto la provincia e «in linea» col paese: mezzo centesimo non e una notizia. */
const IN_LINEA_C = 0.5;

/**
 * Oggi in tre righe: quanto costa in Italia, quanto nella tua provincia,
 * quanto dal piu conveniente vicino a te. Sotto, quanti prezzi sono freschi.
 */
export function CartaOggi({ fuel, quadro, migliore, conPosizione, adesso }: Props) {
  const { nazionale, provincia, freschezza } = quadro;
  const vecchio = migliore ? (oreDa(migliore.row.updated, adesso) ?? Infinity) > 72 : false;

  return (
    <Gruppo nota={`${fuel === 'diesel' || fuel === 'benzina' ? 'Prezzi self' : 'Prezzi'} in ${unitaPrezzo(fuel)}, comunicati dai gestori al Ministero delle Imprese e del Made in Italy.`}>
      <Riga
        titolo="Media in Italia"
        sottotitolo={nazionale ? `su ${numero(nazionale.campione)} distributori` : 'Non disponibile'}
        valore={nazionale ? <Prezzo valore={nazionale.media} /> : '—'}
      />
      {provincia ? (
        <Riga
          titolo={`Provincia di ${provincia.nome}`}
          sottotitolo={confrontoPaese(provincia.deltaC)}
          valore={<Prezzo valore={provincia.media} />}
        />
      ) : (
        <Riga
          titolo="La tua provincia"
          sottotitolo={conPosizione ? 'Troppi pochi distributori per una media' : 'Serve sapere dove sei'}
          valore="—"
        />
      )}
      {migliore ? (
        <Riga
          titolo="Il più conveniente qui vicino"
          sottotitolo={`${nomeMarchio(migliore.row.brand)} · ${distanza(migliore.distanceKm)}`}
          valore={<Prezzo valore={migliore.price} livello={migliore.level} spento={vecchio} />}
        />
      ) : conPosizione ? (
        <Riga titolo="Il più conveniente qui vicino" sottotitolo={`Nessun distributore entro ${RAGGIO_HOME_KM} km`} valore="—" />
      ) : null}
      <Freschi f={freschezza} />
    </Gruppo>
  );
}

function confrontoPaese(deltaC: number | null): string {
  if (deltaC === null) return 'Senza confronto col paese';
  if (Math.abs(deltaC) < IN_LINEA_C) return 'In linea con la media italiana';
  return `${numero(Math.abs(deltaC), 1)} cent ${deltaC < 0 ? 'sotto' : 'sopra'} la media italiana`;
}

/**
 * Quanti prezzi sono di oggi: una barra in tre grigi e una riga di testo.
 * Grigi e non colori: verde e rosso nell'app sono dei prezzi.
 */
function Freschi({ f }: { f: Freschezza }) {
  if (f.totale === 0) return null;
  const vecchi = f.piuVecchi + f.senzaData;
  const parti = [
    { n: f.ultimoGiorno, classe: 'bg-mf-ink' },
    { n: f.entroTreGiorni, classe: 'bg-mf-ink-2' },
    { n: vecchi, classe: 'bg-mf-surface-3' },
  ].filter((p) => p.n > 0);
  const quota = Math.round((f.ultimoGiorno / f.totale) * 100);

  return (
    <div className="px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="mf-body text-mf-ink">Aggiornati nelle ultime 24 ore</span>
        <span className="mf-body mf-num shrink-0 text-mf-ink-2">{quota}%</span>
      </div>
      <div className="mt-2 flex h-2 gap-[2px] overflow-hidden rounded-full" aria-hidden>
        {parti.map((p, i) => (
          <span key={i} className={p.classe} style={{ flexGrow: p.n, flexBasis: 0 }} />
        ))}
      </div>
      <p className="mf-footnote mf-num mt-2 text-mf-ink-2">
        <Chiave classe="bg-mf-ink" /> {numero(f.ultimoGiorno)} in 24 ore ·{' '}
        <Chiave classe="bg-mf-ink-2" /> {numero(f.entroTreGiorni)} entro tre giorni ·{' '}
        <Chiave classe="bg-mf-surface-3" /> {numero(vecchi)} più vecchi
      </p>
    </div>
  );
}

function Chiave({ classe }: { classe: string }) {
  return <span className={`inline-block h-2 w-2 rounded-full align-middle ${classe}`} aria-hidden />;
}

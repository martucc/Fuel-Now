import { CalendarDays, Check, CircleHelp, Clock, Fuel } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { RispostaAttesa, VersoAttesa } from '../../domain/attesa';
import type { Scomposizione } from '../../domain/accise';
import { IVA } from '../../domain/accise';
import { numero, prezzo as formatoPrezzo } from '../../lib/formato';

const ICONA: Record<VersoAttesa, LucideIcon> = {
  aspetta: Clock,
  ora: Fuel,
  indifferente: Check,
  incerto: CircleHelp,
};

/**
 * «Conviene aspettare?»: la risposta secca, il perché in una frase e, se i
 * dati lo reggono, il giorno della settimana che di solito costa meno.
 */
export function CartaAttesa({ r, affidabilita, giorno }: { r: RispostaAttesa; affidabilita: string | null; giorno: string | null }) {
  const Icona = ICONA[r.verso];
  return (
    <div className="rounded-mf-lg bg-mf-surface p-4">
      <div className="flex gap-3">
        <Icona size={22} className="mt-0.5 shrink-0 text-mf-ink-2" aria-hidden />
        <div className="min-w-0">
          <p className="mf-headline text-mf-ink">{r.titolo}</p>
          <p className="mf-subhead mt-1 text-mf-ink-2">{r.testo}</p>
          {affidabilita && (
            <p className="mf-caption mt-2 text-mf-ink-3">Previsione dell’app sull’andamento dei prezzi, affidabilità {affidabilita}.</p>
          )}
        </div>
      </div>
      {giorno && (
        <div className="mt-4 flex gap-3 border-t border-mf-hairline pt-3">
          <CalendarDays size={20} className="mt-0.5 shrink-0 text-mf-ink-2" aria-hidden />
          <p className="mf-subhead text-mf-ink">{giorno}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Cosa c'è dentro un litro: accisa, IVA e il carburante vero. Una barra in
 * grigi: è una composizione, non un giudizio sul prezzo.
 */
export function BarraTasse({ s }: { s: Scomposizione }) {
  const parti = [
    { nome: 'Prodotto e margine', valore: s.prodotto, classe: 'bg-mf-ink' },
    { nome: 'Accisa', valore: s.accisa, classe: 'bg-mf-ink-2' },
    { nome: 'IVA', valore: s.iva, classe: 'bg-mf-surface-3' },
  ];
  return (
    <div className="rounded-mf-lg bg-mf-surface p-4">
      <p className="mf-subhead text-mf-ink">
        Su <span className="mf-num">{formatoPrezzo(s.prezzo)} €</span>, le tasse sono{' '}
        <span className="mf-num font-semibold">{formatoPrezzo(s.tasse)} €</span>: il {numero(s.quotaTasse * 100, 0)}% del prezzo.
      </p>
      <div className="mt-3 flex h-2.5 gap-[2px] overflow-hidden rounded-full" aria-hidden>
        {parti.map((p) => (
          <span key={p.nome} className={p.classe} style={{ flexGrow: p.valore, flexBasis: 0 }} />
        ))}
      </div>
      <ul className="mt-3 space-y-1.5">
        {parti.map((p) => (
          <li key={p.nome} className="mf-footnote flex items-center gap-2 text-mf-ink-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${p.classe}`} aria-hidden />
            <span className="flex-1">{p.nome}</span>
            <span className="mf-num text-mf-ink">{formatoPrezzo(p.valore)} €</span>
          </li>
        ))}
      </ul>
      <p className="mf-caption mt-3 text-mf-ink-3">
        Accisa in vigore dal 2025 e IVA al {numero(IVA * 100, 0)}%. Per questo il prezzo alla pompa si muove meno del petrolio:
        l’accisa resta fissa al litro e oscilla solo il resto.
      </p>
    </div>
  );
}

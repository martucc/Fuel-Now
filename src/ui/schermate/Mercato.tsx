import { useMemo, useRef, useState } from 'react';
import { LineChart } from 'lucide-react';
import type { Modello } from '../../app/modello';
import { aggiornaImpostazioni } from '../../app/impostazioni';
import type { HomeModel } from '../home/homeModel';
import { FUEL_LABEL } from '../../domain/fuel';
import type { FuelKey } from '../../domain/raw';
import { FUEL_KEYS } from '../../domain/raw';
import { readForecast } from '../../domain/forecast';
import { ritmoSettimanale } from '../../domain/settimana';
import { scomponiPrezzo } from '../../domain/accise';
import { descriviDati } from '../../domain/freshness';
import type { Finestra } from '../../domain/andamento';
import { pulisciStorico } from '../../domain/andamento';
import { provinciaPiuVicina, quadroOggi } from '../../domain/quadro';
import { affidabilita, convieneAspettare, fraseGiornoMigliore } from '../../domain/attesa';
import { dossierPrezzi } from '../../domain/dossierPrezzi';
import { firmaDataset } from '../../services/analisiIa';
import { Segmentato } from '../kit/Segmentato';
import { Segnaposto, Vuoto } from '../kit/Stato';
import { nomeMarchio } from '../kit/marchio';
import { CartaOggi } from '../prezzi/CartaOggi';
import { CartaAndamento } from '../prezzi/CartaAndamento';
import { BarraTasse, CartaAttesa } from '../prezzi/CartaAttesa';
import { SezioneIa } from '../prezzi/SezioneIa';
import { useAnalisiIa } from '../prezzi/useAnalisiIa';
import { useSchedaVisibile } from '../prezzi/useSchedaVisibile';

interface Props {
  m: Modello;
  home: HomeModel | null;
  onApriImpostazioni: () => void;
}

const OPZIONI_CARBURANTE = FUEL_KEYS.map((k) => ({ valore: k, etichetta: FUEL_LABEL[k] }));

/**
 * La scheda Prezzi: come vanno i prezzi e se conviene aspettare a fare il
 * pieno.
 *
 * Dall'alto: i numeri di oggi (Italia, provincia, qui vicino), l'andamento
 * della media italiana con la previsione, la risposta a «conviene
 * aspettare?», quanto pesano le tasse e, con la chiave Gemini, il commento
 * dell'IA. Ogni numero esce dal dominio; l'IA commenta e basta.
 *
 * I conti su ventunomila impianti stanno in useMemo legati al file dei
 * prezzi, al carburante e alla finestra del grafico: la scheda resta
 * montata e non ricalcola niente finche quelli non cambiano.
 */
export function Mercato({ m, home, onApriImpostazioni }: Props) {
  const radice = useRef<HTMLDivElement>(null);
  const visibile = useSchedaVisibile(radice);
  const [finestra, setFinestra] = useState<Finestra>(90);
  const fuel = m.impostazioni.carburante;
  const base = m.base;
  const dataset = base?.dataset ?? null;

  const storico = useMemo(() => pulisciStorico(dataset?.history?.[fuel]), [dataset, fuel]);
  const previsione = useMemo(() => (dataset ? readForecast(dataset, fuel) : null), [dataset, fuel]);
  const ritmo = useMemo(() => ritmoSettimanale(dataset?.history?.[fuel] ?? []), [dataset, fuel]);

  const prov = useMemo(
    () => (home && base ? provinciaPiuVicina(home.list, base.perId) ?? home.best?.row.prov ?? null : null),
    [home, base],
  );
  const quadro = useMemo(
    () =>
      base
        ? quadroOggi({ rows: base.rows, cohorts: base.cohorts, dataset: base.dataset, fuel, now: m.adesso, provincia: prov })
        : null,
    [base, fuel, m.adesso, prov],
  );

  const best = home?.best ?? null;
  const attesa = useMemo(
    () => convieneAspettare({ forecast: previsione, bestLevel: best?.level ?? null, litri: m.litri }),
    [previsione, best, m.litri],
  );
  const tasse = quadro?.nazionale ? scomponiPrezzo(quadro.nazionale.media, fuel) : null;

  const chiaveApi = m.impostazioni.chiaveGemini;
  const dossier = useMemo(() => {
    if (!chiaveApi || !base || !quadro) return null;
    return dossierPrezzi({
      fuel,
      quadro,
      vicini: home?.list ?? [],
      perId: base.perId,
      cohorts: base.cohorts,
      consigliato: best
        ? { nome: `${nomeMarchio(best.row.brand)} ${best.row.city}`.trim(), prezzo: best.price, km: best.distanceKm, risparmioEur: best.net.net }
        : null,
      storico,
      previsione,
      ritmo,
      auto: m.auto ? { modello: m.auto.model, serbatoioL: m.auto.liters, kml: m.auto.kml } : null,
      now: m.adesso,
    });
  }, [chiaveApi, base, quadro, fuel, home, best, storico, previsione, ritmo, m.auto, m.adesso]);

  const inAttesaDeiDati = !base || m.posizione.fase === 'cerco';
  const ia = useAnalisiIa({
    chiaveApi,
    modello: m.impostazioni.modelloGemini,
    fuel,
    firma: firmaDataset(dataset),
    dossier,
    pronto: !inAttesaDeiDati,
    visibile,
  });

  return (
    <div ref={radice} className="mx-auto max-w-xl px-4 pb-6" style={{ paddingTop: 'calc(var(--mf-safe-top) + 8px)' }}>
      <h1 className="mf-large-title">Prezzi</h1>

      <Segmentato
        className="mt-3"
        etichetta="Carburante"
        valore={fuel}
        opzioni={OPZIONI_CARBURANTE}
        onCambia={(v) => aggiornaImpostazioni({ carburante: v as FuelKey })}
      />

      {!base || !quadro ? (
        m.dataset.fase === 'errore' && !m.dataset.dati ? (
          <div className="mt-6 rounded-mf-lg bg-mf-surface">
            <Vuoto
              icona={<LineChart size={30} />}
              titolo="Prezzi non disponibili"
              testo="Non riesco a scaricare i prezzi. Riprovo da solo appena torna la rete."
            />
          </div>
        ) : (
          <div className="mt-6 space-y-4" aria-busy="true">
            <Segnaposto className="h-[236px]" />
            <Segnaposto className="h-[420px]" />
          </div>
        )
      ) : (
        <>
          <section className="mt-6">
            <div className="mb-3 flex items-end justify-between gap-3 px-1">
              <h2 className="mf-title">Oggi</h2>
              <span className="mf-footnote text-mf-ink-2">{descriviDati(dataset, m.adesso).etichetta}</span>
            </div>
            <CartaOggi fuel={fuel} quadro={quadro} migliore={best} conPosizione={!!m.posizione.punto} />
          </section>

          <section className="mt-7">
            <h2 className="mf-title mb-3 px-1">Andamento</h2>
            <CartaAndamento
              fuel={fuel}
              storico={storico}
              previsione={previsione}
              finestra={finestra}
              onFinestra={setFinestra}
              adesso={m.adesso}
            />
          </section>

          <section className="mt-7">
            <h2 className="mf-title mb-3 px-1">Conviene aspettare?</h2>
            <CartaAttesa r={attesa} affidabilita={affidabilita(previsione)} giorno={fraseGiornoMigliore(ritmo)} />
          </section>

          {tasse && (
            <section className="mt-7">
              <h2 className="mf-title mb-3 px-1">Dentro un litro</h2>
              <BarraTasse s={tasse} />
            </section>
          )}
        </>
      )}

      <SezioneIa ia={ia} inAttesaDeiDati={inAttesaDeiDati} onApriImpostazioni={onApriImpostazioni} />
    </div>
  );
}

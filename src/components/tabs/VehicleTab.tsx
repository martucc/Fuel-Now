import { motion } from 'motion/react';
import { Car, Search, ChevronRight } from 'lucide-react';
import { Card, Stat, Empty, Row } from '../../design/primitives/Surface';
import { Button } from '../../design/primitives/Button';
import { PageTitle } from '../../ui/chrome/PageTitle';

interface Props {
  cars: any[];
  selectedCar: any;
  setSelectedCar: (c: any) => void;
  carSearchQuery: string;
  setCarSearchQuery: (q: string) => void;
  handleSelectCar: (c: any) => void;
  /** Dentro la scheda Auto il titolo lo mette chi compone, non questo pezzo. */
  embedded?: boolean;
}

export function VehicleTab(p: Props) {
  const filtrate = p.cars.filter(
    (car) =>
      car.model.toLowerCase().includes(p.carSearchQuery.toLowerCase()) ||
      (car.tags || '').toLowerCase().includes(p.carSearchQuery.toLowerCase())
  );

  const contenuto = (
    <>
      {p.selectedCar ? (
        <>
          <Card pad="lg">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="mf-label" style={{ fontSize: 9 }}>
                  auto attiva
                </div>
                <h2
                  className="mt-2 break-words"
                  style={{
                    fontFamily: 'var(--mf-font-sans)',
                    fontWeight: 800,
                    fontSize: 24,
                    letterSpacing: '-0.035em',
                    lineHeight: 1.1,
                    color: 'var(--mf-ink)',
                  }}
                >
                  {p.selectedCar.model}
                </h2>
                {p.selectedCar.tags && (
                  <p className="mt-1.5 break-words" style={{ color: 'var(--mf-ink-2)', fontSize: 12 }}>
                    {p.selectedCar.tags}
                  </p>
                )}
              </div>
              <Button size="sm" tone="ghost" onClick={() => p.setSelectedCar(null)}>
                Cambia
              </Button>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <Stat label="serbatoio" value={`${p.selectedCar.liters} L`} />
              <Stat label="consumo dichiarato" value={`${p.selectedCar.kml} km/L`} />
            </div>

            <p className="mt-5" style={{ color: 'var(--mf-ink-2)', fontSize: 11, lineHeight: 1.5 }}>
              Con almeno tre pieni registrati usiamo il tuo consumo reale al posto di questo,
              perché è quello che conta quando si decide dove fermarsi.
            </p>
          </Card>

        </>
      ) : (
        <>
          <Card pad="sm">
            <div className="flex items-center gap-3 px-1">
              <Search size={18} style={{ color: 'var(--mf-muted)', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Cerca modello…"
                value={p.carSearchQuery}
                onChange={(e) => p.setCarSearchQuery(e.target.value)}
                className="w-full border-none bg-transparent outline-none"
                style={{
                  color: 'var(--mf-ink)',
                  fontFamily: 'var(--mf-font-sans)',
                  fontSize: 15,
                  padding: '8px 0',
                }}
              />
            </div>
          </Card>

          <Card pad="md">
            <div className="mf-label mb-1 flex items-center justify-between" style={{ fontSize: 9 }}>
              <span>modelli</span>
              <span className="mf-num" style={{ color: 'var(--mf-ink-2)' }}>
                {filtrate.length}
              </span>
            </div>
            {filtrate.length === 0 ? (
              <Empty title="Nessun modello trovato" hint="Prova col nome della casa, per esempio «Fiat» o «Golf»." />
            ) : (
              <div className="max-h-[58vh] overflow-y-auto">
                {filtrate.slice(0, 200).map((car, idx) => (
                  <Row key={`${car.model}-${idx}`} first={idx === 0} onClick={() => p.handleSelectCar(car)}>
                    <span
                      className="flex flex-shrink-0 items-center justify-center"
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 'var(--mf-radius-pill)',
                        background: 'var(--mf-ground)',
                        border: '1px solid var(--mf-hairline)',
                        color: 'var(--mf-ink-2)',
                      }}
                    >
                      <Car size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className="block truncate"
                        style={{ fontFamily: 'var(--mf-font-sans)', fontWeight: 600, fontSize: 15, color: 'var(--mf-ink)' }}
                      >
                        {car.model}
                      </span>
                      <span className="mf-num block truncate" style={{ color: 'var(--mf-ink-2)', fontSize: 11 }}>
                        {car.liters} L · {car.kml} km/L
                      </span>
                    </span>
                    <ChevronRight size={18} style={{ color: 'var(--mf-muted)', flexShrink: 0 }} />
                  </Row>
                ))}
                {filtrate.length > 200 && (
                  <p className="mf-label py-4 text-center" style={{ fontSize: 9 }}>
                    altri {filtrate.length - 200} — restringi la ricerca
                  </p>
                )}
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );

  if (p.embedded) return contenuto;

  return (
    <motion.div
      key="veicolo"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="space-y-5 pb-32"
    >
      <PageTitle
        eyebrow="garage"
        title={p.selectedCar ? 'La tua auto' : 'Scegli l’auto'}
        sub={
          p.selectedCar
            ? 'Serbatoio e consumo entrano nel calcolo di quanto conviene davvero'
            : 'Serve a calcolare litri, consumo e costo del viaggio sui tuoi numeri'
        }
      />
      {contenuto}
    </motion.div>
  );
}
